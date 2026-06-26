import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode } from '../../theme/colors';
import { fortigateModels, findFortiGateModel } from './fortigateModels';
import { parseFortiGateConfig } from './fortigateParser';
import {
  applyCapabilityOverride,
  defaultMigrationOptions,
  defaultTargetCapabilityOverride,
  generateMigration,
  suggestMappings,
  validateMigration,
} from './fortigateMigrationEngine';
import type { FortiGateAnalysis, InterfaceMapping, MigrationOptions, MigrationResult, TargetCapabilityOverride, ValidationIssue } from './fortigateTypes';
import {
  backupFingerprint,
  buildExcelBase64,
  compatibilityNotes,
  featureMatrix,
  globalMigrationSearch,
  impactSummary,
  interfaceUtilization,
  migrationSummaryRows,
  overrideSourceModel,
  referencedByAnalysis,
  scoreExplanation,
  targetCapabilityRows,
  unsupportedCommands,
  unusedObjects,
  migrationChangeLog,
} from './fortigatePhase2';

const steps = ['Upload', 'Analyze', 'Target', 'Mapping', 'Validation', 'Export'];

export default function FortiGateMigrationAssistant() {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<FortiGateAnalysis | null>(null);
  const [targetModel, setTargetModel] = useState('FG-90G');
  const [overrides, setOverrides] = useState<Record<string, TargetCapabilityOverride>>({});
  const [mappings, setMappings] = useState<InterfaceMapping[]>([]);
  const [options, setOptions] = useState<MigrationOptions>(defaultMigrationOptions);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const baseTarget = findFortiGateModel(targetModel) || fortigateModels[0];
  const currentOverride = overrides[baseTarget.name] || defaultTargetCapabilityOverride;
  const target = useMemo(() => applyCapabilityOverride(baseTarget, currentOverride), [baseTarget, currentOverride]);
  const issues = useMemo(() => analysis ? validateMigration(analysis, target, mappings, options) : [], [analysis, target, mappings, options]);
  const critical = issues.some(item => item.severity === 'ERROR');

  const upload = async () => {
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['text/plain', '*/*'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseFortiGateConfig(content, asset.name || 'original-backup.conf');
      const suggestedTarget = suggestInitialTarget(parsed.sourceModel);
      const model = findFortiGateModel(suggestedTarget) || baseTarget;
      const effectiveModel = applyCapabilityOverride(model, overrides[model.name] || defaultTargetCapabilityOverride);
      setAnalysis(parsed);
      setTargetModel(model.name);
      setMappings(suggestMappings(parsed, effectiveModel));
      setResult(null);
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const regenerateMappings = (modelName: string) => {
    setTargetModel(modelName);
    const nextTarget = findFortiGateModel(modelName);
    if (analysis && nextTarget) setMappings(suggestMappings(analysis, applyCapabilityOverride(nextTarget, overrides[nextTarget.name] || defaultTargetCapabilityOverride)));
    setResult(null);
  };

  const updateOverride = (modelName: string, updater: (current: TargetCapabilityOverride) => TargetCapabilityOverride) => {
    const base = findFortiGateModel(modelName);
    const nextOverride = updater(overrides[modelName] || defaultTargetCapabilityOverride);
    setOverrides(prev => ({ ...prev, [modelName]: nextOverride }));
    if (analysis && base) setMappings(suggestMappings(analysis, applyCapabilityOverride(base, nextOverride)));
    setResult(null);
  };

  const generate = () => {
    if (!analysis) return;
    const next = generateMigration(analysis, target, mappings, options);
    setResult(next);
    setStep(5);
  };

  return (
    <View style={styles.container}>
      <WizardHeader step={step} analysis={analysis} targetModel={targetModel} issues={issues} result={result} />
      <StepBar step={step} setStep={setStep} disabled={!analysis} />
      {analysis ? <StickySummary analysis={analysis} target={targetModel} issues={issues} result={result} /> : null}
      {step === 0 ? (
        <Panel title="Upload FortiGate Backup" subtitle="Fully offline. No data leaves this device.">
          <TouchableOpacity style={styles.uploadBox} onPress={upload} disabled={busy}>
            {busy ? <ActivityIndicator color={theme.colors.blue400} /> : <Ionicons name="cloud-upload-outline" size={28} color={theme.colors.blue400} />}
            <Text style={styles.uploadTitle}>{busy ? 'Analyzing backup...' : 'Upload FortiGate Backup'}</Text>
            <Text style={styles.muted}>Tap to select .conf or .txt file</Text>
          </TouchableOpacity>
          <View style={styles.infoCard}>
            <Text style={styles.title}>What this tool does</Text>
            <BulletList rows={[
              'Parses FortiGate backup files locally',
              'Auto-detects source model and FortiOS version',
              'Maps interfaces to target hardware',
              'Generates cleaned config and reports',
              'Exports PDF, Excel, HTML, config, and checklist',
            ]} tone="success" />
          </View>
        </Panel>
      ) : null}
      {analysis && step === 1 ? <AnalyzeStep analysis={analysis} setAnalysis={setAnalysis} setMappings={setMappings} target={target} onNext={() => setStep(2)} /> : null}
      {analysis && step === 2 ? <TargetStep analysis={analysis} targetModel={targetModel} target={target} override={currentOverride} updateOverride={updateOverride} setTargetModel={regenerateMappings} options={options} setOptions={setOptions} onNext={() => setStep(3)} /> : null}
      {analysis && step === 3 ? <MappingStep analysis={analysis} target={target} mappings={mappings} setMappings={setMappings} onNext={() => setStep(4)} /> : null}
      {analysis && step === 4 ? <ValidationStep analysis={analysis} target={target} issues={issues} options={options} setOptions={setOptions} critical={critical} onGenerate={generate} result={result} /> : null}
      {analysis && step === 5 ? <GenerateStep analysis={analysis} result={result} targetModel={targetModel} mappings={mappings} target={target} options={options} generate={generate} /> : null}
    </View>
  );
}

function suggestInitialTarget(sourceModel: string) {
  if (/60D|60E/i.test(sourceModel)) return 'FG-90G';
  if (/80D|90D|80E/i.test(sourceModel)) return 'FG-90G';
  if (/100D|100E/i.test(sourceModel)) return 'FG-100F';
  if (/200D|200E|200F/i.test(sourceModel)) return 'FG-120G';
  return 'FG-90G';
}

function WizardHeader({ step, analysis, targetModel, issues, result }: {
  step: number;
  analysis: FortiGateAnalysis | null;
  targetModel: string;
  issues: ValidationIssue[];
  result: MigrationResult | null;
}) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const errors = issues.filter(item => item.severity === 'ERROR').length;
  const warnings = issues.filter(item => item.severity === 'WARNING').length;
  return (
    <View style={styles.hero}>
      <View style={styles.heroIcon}>
        <Ionicons name="shield-checkmark-outline" size={22} color={theme.colors.blue400} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroTitle}>FortiGate migration</Text>
        <Text style={styles.heroSub}>
          {analysis ? `${analysis.sourceModel || 'UNKNOWN'} to ${targetModel} - ${steps[step]}` : 'Offline device-local processing'}
        </Text>
      </View>
      {result ? <StatusBadge label={`${result.score}% ${result.readiness}`} tone={result.score >= 90 ? 'success' : result.score >= 70 ? 'warning' : 'error'} /> : null}
      {!result && analysis ? <StatusBadge label={errors ? `${errors} error` : warnings ? `${warnings} warning` : 'Ready'} tone={errors ? 'error' : warnings ? 'warning' : 'success'} /> : null}
    </View>
  );
}

function StepBar({ step, setStep, disabled }: { step: number; setStep: (step: number) => void; disabled: boolean }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepBar}>
      {steps.map((label, index) => (
        <TouchableOpacity key={label} disabled={disabled && index > 0} onPress={() => setStep(index)} style={[styles.stepPill, step === index && styles.stepPillActive]}>
          <Text style={[styles.stepText, step === index && styles.stepTextActive]}>{index + 1}. {label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function StickySummary({ analysis, target, issues, result }: { analysis: FortiGateAnalysis; target: string; issues: ValidationIssue[]; result: MigrationResult | null }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const errors = issues.filter(item => item.severity === 'ERROR').length;
  const warnings = issues.filter(item => item.severity === 'WARNING').length;
  return (
    <View style={styles.summaryBar}>
      <SummaryItem label="Source" value={analysis.sourceModel} />
      <SummaryItem label="Target" value={target} />
      <SummaryItem label="Host" value={analysis.hostname} />
      <View style={[styles.badge, errors ? styles.badgeRed : warnings ? styles.badgeYellow : styles.badgeGreen]}>
        <Text style={styles.badgeText}>{result ? `${result.score}% ${result.readiness}` : errors ? `${errors} errors` : warnings ? `${warnings} warnings` : 'Ready'}</Text>
      </View>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>{value || 'UNKNOWN'}</Text>
    </View>
  );
}

function AnalyzeStep({ analysis, setAnalysis, setMappings, target, onNext }: { analysis: FortiGateAnalysis; setAnalysis: (analysis: FortiGateAnalysis) => void; setMappings: React.Dispatch<React.SetStateAction<InterfaceMapping[]>>; target: NonNullable<ReturnType<typeof findFortiGateModel>>; onNext: () => void }) {
  const [search, setSearch] = useState('');
  const applySource = (model: string) => {
    const next = overrideSourceModel(analysis, model);
    setAnalysis(next);
    setMappings(suggestMappings(next, target));
  };
  return (
    <Panel title="Backup Analysis" subtitle="Parsed source identity, object counts, and interface usage.">
      <SectionTitle title="Backup Fingerprint" />
      <MetricGrid rows={backupFingerprint(analysis)} />
      <SectionTitle title="Source Model" />
      <ModelSelector value={analysis.sourceModel} onChange={applySource} />
      <MetricGrid rows={[
        ['Source Model', analysis.sourceModel],
        ['Detection Confidence', `${analysis.modelConfidence || 0}%`],
        ['VDOM Mode', analysis.vdomMode || 'Single VDOM'],
        ['VDOM Names', (analysis.vdoms || ['root']).join(', ')],
        ['FortiOS', analysis.fortiosVersion],
        ['Hostname', analysis.hostname],
        ['Interfaces', analysis.counts.interfaces],
        ['Policies', analysis.counts.policies],
        ['Address Objects', analysis.counts.addressObjects],
        ['VIPs', analysis.counts.vips],
        ['DHCP', analysis.counts.dhcp],
        ['Routes', analysis.counts.routes],
        ['VPN', analysis.counts.vpn],
        ['Loopbacks', analysis.counts.loopbacks || 0],
        ['Tunnels', analysis.counts.tunnels || 0],
        ['VLANs', analysis.counts.vlan],
        ['WiFi/VAP', analysis.counts.wifi || 0],
        ['Aggregates', analysis.counts.aggregates || 0],
        ['SD-WAN', analysis.counts.sdwan],
        ['Zones', analysis.counts.zones],
        ['Certificates', analysis.counts.certificates],
        ['Admins', analysis.counts.admins],
        ['Users', analysis.counts.users],
      ]} />
      <SectionTitle title="Configured Features" />
      <FeatureList rows={featureMatrix(analysis)} />
      <SectionTitle title="Global Migration Search" />
      <Field label="Search Everything" value={search} onChangeText={setSearch} />
      <SimpleTable rows={globalMigrationSearch(analysis, search).slice(0, 30)} />
      <SectionTitle title="Interface Usage" />
      <SimpleTable rows={analysis.interfaces.map(item => ({
        Interface: item.name,
        Role: item.role,
        Status: item.status,
        IP: item.ip || '-',
        VLAN: item.vlanId || '-',
        Parent: item.parent || '-',
        Type: interfaceTypeBadge(item.type, item.role),
      }))} />
      <ActionButton label="Select Target Model" icon="arrow-forward-outline" onPress={onNext} />
    </Panel>
  );
}

function TargetStep({ analysis, targetModel, target, override, updateOverride, setTargetModel, options, setOptions, onNext }: { analysis: FortiGateAnalysis; targetModel: string; target: NonNullable<ReturnType<typeof findFortiGateModel>>; override: TargetCapabilityOverride; updateOverride: (modelName: string, updater: (current: TargetCapabilityOverride) => TargetCapabilityOverride) => void; setTargetModel: (model: string) => void; options: MigrationOptions; setOptions: React.Dispatch<React.SetStateAction<MigrationOptions>>; onNext: () => void }) {
  const baseTarget = findFortiGateModel(targetModel) || fortigateModels[0];
  const source = findFortiGateModel(analysis.sourceModel);
  const setOverride = (next: Partial<TargetCapabilityOverride>) => updateOverride(targetModel, current => ({ ...current, ...next }));
  const resetOverride = () => updateOverride(targetModel, () => defaultTargetCapabilityOverride);
  return (
    <Panel title="Target Model Selection" subtitle="Choose replacement hardware from the local FortiGate model database.">
      <CompareStrip source={analysis.sourceModel} target={target.name} targetSeries={target.series} />
      <SectionTitle title="Target Model" />
      <ModelSelector value={targetModel} onChange={setTargetModel} />
      <TargetCapabilityOverridePanel target={target} baseTarget={baseTarget} override={override} setOverride={setOverride} resetOverride={resetOverride} />
      <MetricGrid rows={[
        ['Target', target.name],
        ['Series', target.series],
        ['Port Count', target.portCount],
        ['HA Support', target.haSupport ? 'Yes' : 'No'],
        ['SD-WAN', target.sdWanSupport ? 'Yes' : 'No'],
        ['FortiLink', target.fortiLinkSupport ? 'Yes' : 'No'],
        ['Switch Controller', target.switchControllerSupport ? 'Yes' : 'No'],
        ['Source Ports', source?.portCount || 'Unknown'],
        ['DB Port Count', baseTarget.portCount],
        ['Removed By Override', target.removedPorts?.join(', ') || '-'],
      ]} />
      <SectionTitle title="Target Capabilities" />
      <MetricGrid rows={targetCapabilityRows(target)} />
      <Field label="Target FortiOS Version" value={options.targetFortiosVersion || ''} onChangeText={targetFortiosVersion => setOptions(prev => ({ ...prev, targetFortiosVersion }))} />
      <Field label="Target Build Number" value={options.targetBuildNumber || ''} onChangeText={targetBuildNumber => setOptions(prev => ({ ...prev, targetBuildNumber }))} />
      <SectionTitle title="Firmware Mode" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Choice label="Use Target Version" active={options.firmwareMode === 'target'} onPress={() => setOptions(prev => ({ ...prev, firmwareMode: 'target' }))} />
        <Choice label="Preserve Source Version" active={(options.firmwareMode || 'target') === 'preserve'} onPress={() => setOptions(prev => ({ ...prev, firmwareMode: 'preserve' }))} />
        <Choice label="Strict Legacy Compatibility" active={options.firmwareMode === 'strict-legacy'} onPress={() => setOptions(prev => ({ ...prev, firmwareMode: 'strict-legacy', migrationMode: 'strict' }))} />
      </View>
      <SectionTitle title="Migration Mode" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Choice label="Standard" active={(options.migrationMode || 'standard') === 'standard'} onPress={() => setOptions(prev => ({ ...prev, migrationMode: 'standard' }))} />
        <Choice label="Strict Compatibility" active={options.migrationMode === 'strict'} onPress={() => setOptions(prev => ({ ...prev, migrationMode: 'strict' }))} />
        <Choice label="D-Series Safe Mode" active={options.migrationMode === 'd-series-safe'} onPress={() => setOptions(prev => ({ ...prev, migrationMode: 'd-series-safe', firmwareMode: prev.firmwareMode === 'preserve' ? 'strict-legacy' : prev.firmwareMode }))} />
      </View>
      <TextHint text={(options.firmwareMode || 'target') === 'preserve' ? 'Config generation preserves source FortiOS headers except target hardware token.' : 'Config generation uses a single target firmware/build profile and removes unsupported cosmetic or firmware-specific commands.'} tone="normal" />
      <SectionTitle title="FortiOS Compatibility" />
      <SimpleTable rows={compatibilityNotes(analysis, options)} />
      <SectionTitle title="Target Ports" />
      <TagRow values={target.portNames} />
      <SectionTitle title="Migration Notes" />
      <BulletList rows={[...target.migrationRules, ...target.knownRestrictions, ...target.knownExceptions]} />
      <ActionButton label="Build Interface Mapping" icon="git-compare-outline" onPress={onNext} />
    </Panel>
  );
}

function TargetCapabilityOverridePanel({ target, baseTarget, override, setOverride, resetOverride }: { target: NonNullable<ReturnType<typeof findFortiGateModel>>; baseTarget: NonNullable<ReturnType<typeof findFortiGateModel>>; override: TargetCapabilityOverride; setOverride: (next: Partial<TargetCapabilityOverride>) => void; resetOverride: () => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.infoCard}>
      <View style={styles.interfaceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Target Capabilities</Text>
          <Text style={styles.muted}>{target.name}</Text>
        </View>
        <StatusBadge label={`${target.portCount} effective ports`} tone="info" />
      </View>
      <OverridePicker label="WAN" value={override.wan} values={['auto', 1, 2, 3, 4]} onChange={wan => setOverride({ wan })} />
      <OverridePicker label="LAN" value={override.lan} values={['auto', ...Array.from({ length: 24 }, (_item, index) => index + 1)]} onChange={lan => setOverride({ lan })} />
      <OverridePicker label="DMZ" value={override.dmz} values={['auto', 0, 1, 2]} onChange={dmz => setOverride({ dmz })} />
      <View style={styles.memberGrid}>
        <OverrideToggle label="Port A" value={override.hasPortA} onChange={hasPortA => setOverride({ hasPortA })} />
        <OverrideToggle label="Port B" value={override.hasPortB} onChange={hasPortB => setOverride({ hasPortB })} />
        <OverrideToggle label="FortiLink" value={override.hasFortiLink} onChange={hasFortiLink => setOverride({ hasFortiLink })} />
        <OverrideToggle label="Modem" value={override.hasModem} onChange={hasModem => setOverride({ hasModem })} />
        <OverrideToggle label="HA Port" value={override.haHaPort} onChange={haHaPort => setOverride({ haHaPort })} />
      </View>
      <MetricGrid rows={[
        ['Effective Port Count', target.portCount],
        ['DB Port Count', baseTarget.portCount],
        ['WAN Ports', target.wanPorts.join(', ') || '-'],
        ['LAN Ports', target.lanPorts.join(', ') || '-'],
        ['DMZ Ports', target.dmzPorts.join(', ') || '-'],
        ['FortiLink Ports', target.fortiLinkPorts.join(', ') || '-'],
        ['Modem', target.portNames.includes('modem') ? 'Yes' : 'No'],
      ]} />
      {target.removedPorts?.length ? <TextHint text={`Override removed these DB ports: ${target.removedPorts.join(', ')}. Existing mappings to removed ports will be flagged for remap.`} tone="warning" /> : null}
      <TouchableOpacity style={styles.actionButton} onPress={resetOverride}>
        <Ionicons name="refresh-outline" size={16} color="#fff" />
        <Text style={styles.stepTextActive}>Reset to DB defaults</Text>
      </TouchableOpacity>
    </View>
  );
}

function OverridePicker({ label, value, values, onChange }: { label: string; value: number | 'auto'; values: Array<number | 'auto'>; onChange: (value: number | 'auto') => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {values.map(item => {
          const active = value === item;
          return (
            <TouchableOpacity key={`${label}-${item}`} style={[styles.memberChoice, active && styles.memberChoiceActive]} onPress={() => onChange(item)}>
              <Ionicons name={active ? 'checkbox-outline' : 'square-outline'} size={16} color={active ? theme.colors.green400 : theme.colors.gray400} />
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{item === 'auto' ? 'Auto' : String(item)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function OverrideToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <TouchableOpacity style={[styles.memberChoice, value && styles.memberChoiceActive]} onPress={() => onChange(!value)}>
      <Ionicons name={value ? 'toggle-outline' : 'toggle'} size={18} color={value ? theme.colors.green400 : theme.colors.gray400} />
      <Text style={[styles.choiceText, value && styles.choiceTextActive]}>{label}: {value ? 'Yes' : 'No'}</Text>
    </TouchableOpacity>
  );
}

function MappingStep({ analysis, target, mappings, setMappings, onNext }: {
  analysis: FortiGateAnalysis;
  target: ReturnType<typeof findFortiGateModel>;
  mappings: InterfaceMapping[];
  setMappings: React.Dispatch<React.SetStateAction<InterfaceMapping[]>>;
  onNext: () => void;
}) {
  const [tab, setTab] = useState('Interfaces');
  const [refSearch, setRefSearch] = useState('');
  const [interfaceSearch, setInterfaceSearch] = useState('');
  if (!target) return null;
  const setTarget = (source: string, nextTarget: string) => {
    setMappings(prev => prev.map(item => item.source === source ? {
      ...item,
      target: nextTarget,
      status: nextTarget ? 'OK' : 'ERROR',
      notes: nextTarget ? 'Manual override selected' : 'No target selected',
    } : item));
  };
  const toggleMember = (source: string, member: string) => {
    setMappings(prev => prev.map(item => {
      if (item.source !== source) return item;
      const current = item.targetMembers || [];
      const nextMembers = current.includes(member) ? current.filter(value => value !== member) : [...current, member];
      return {
        ...item,
        targetMembers: nextMembers,
        status: nextMembers.length ? 'OK' : 'ERROR',
        notes: nextMembers.length ? `Target members selected: ${nextMembers.join(', ')}` : 'No target member ports selected',
      };
    }));
  };
  const setVlanParent = (source: string, targetParent: string) => {
    setMappings(prev => prev.map(item => item.source === source ? {
      ...item,
      targetParent,
      status: targetParent ? 'OK' : 'ERROR',
      notes: targetParent ? `VLAN parent mapped to ${targetParent}` : 'No VLAN parent selected',
    } : item));
  };
  const parentChoices = vlanParentChoices(analysis, target, mappings);
  const visibleMappings = mappings.filter(mapping => {
    if (!target.fortiLinkSupport && (mapping.role === 'FortiLink' || /fortilink/i.test(mapping.source))) return false;
    if (!target.portNames.includes('modem') && /^modem$/i.test(mapping.source)) return false;
    return true;
  });
  return (
    <Panel title="Interface Mapping" subtitle="Review auto-suggested mappings and override target interfaces where needed.">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {['Interfaces', 'Loopbacks', 'VLANs', 'Tunnels', 'WiFi/VAP', 'Policies', 'VPN', 'Routes', 'Objects', 'Services', 'Certificates', 'BGP', 'OSPF'].map(name => <Choice key={name} label={name} active={tab === name} onPress={() => setTab(name)} />)}
      </ScrollView>
      {tab === 'Interfaces' ? <Field label="Search Interface" value={interfaceSearch} onChangeText={setInterfaceSearch} /> : null}
      {tab === 'Interfaces' ? visibleMappings.filter(mapping => {
        const source = analysis.interfaces.find(item => item.name === mapping.source);
        const q = interfaceSearch.trim().toLowerCase();
        if (!q) return true;
        return `${mapping.source} ${mapping.role} ${mapping.target} ${mapping.notes} ${source?.ip || ''} ${source?.alias || ''}`.toLowerCase().includes(q);
      }).map(mapping => {
        const source = analysis.interfaces.find(item => item.name === mapping.source);
        return (
          <InterfaceMappingCard key={mapping.source} mapping={mapping} source={source} ports={[...new Set([...target.switchPorts, ...target.portNames])]} vlanParentPorts={parentChoices} memberPorts={target.lanPorts.length ? target.lanPorts : target.portNames} onSelect={port => setTarget(mapping.source, port)} onToggleMember={member => toggleMember(mapping.source, member)} onSelectParent={parent => setVlanParent(mapping.source, parent)} />
        );
      }) : null}
      {tab === 'Interfaces' ? <><SectionTitle title="Interface Utilization Analysis" /><SimpleTable rows={interfaceUtilization(analysis).map(row => ({ ...row, Type: interfaceTypeBadge(analysis.interfaces.find(item => item.name === row.Interface)?.type, analysis.interfaces.find(item => item.name === row.Interface)?.role || '') }))} /></> : null}
      {tab === 'Loopbacks' ? <LogicalInterfaceTable rows={analysis.interfaces.filter(item => item.role === 'Loopback')} /> : null}
      {tab === 'VLANs' ? visibleMappings.filter(mapping => analysis.interfaces.find(item => item.name === mapping.source)?.role === 'VLAN').map(mapping => {
        const source = analysis.interfaces.find(item => item.name === mapping.source);
        return (
          <InterfaceMappingCard key={mapping.source} mapping={mapping} source={source} ports={[...new Set([...target.switchPorts, ...target.portNames])]} vlanParentPorts={parentChoices} memberPorts={target.lanPorts.length ? target.lanPorts : target.portNames} onSelect={port => setTarget(mapping.source, port)} onToggleMember={member => toggleMember(mapping.source, member)} onSelectParent={parent => setVlanParent(mapping.source, parent)} />
        );
      }) : null}
      {tab === 'Tunnels' ? <LogicalInterfaceTable rows={analysis.interfaces.filter(item => item.role === 'Tunnel')} /> : null}
      {tab === 'WiFi/VAP' ? <LogicalInterfaceTable rows={analysis.interfaces.filter(item => item.role === 'WiFi/VAP')} /> : null}
      {tab === 'Policies' ? <SimpleTable rows={impactSummary(analysis).filter(row => row.Area === 'Policies')} /> : null}
      {tab === 'VPN' ? <SimpleTable rows={impactSummary(analysis).filter(row => row.Area === 'VPN')} /> : null}
      {tab === 'Routes' ? <SimpleTable rows={impactSummary(analysis).filter(row => row.Area === 'Routes')} /> : null}
      {tab === 'Objects' ? <><SimpleTable rows={impactSummary(analysis).filter(row => ['Address Objects', 'Address Groups'].includes(row.Area))} /><SectionTitle title="Unused Object Detection" /><SimpleTable rows={unusedObjects(analysis).filter(row => row.Type.includes('address')).slice(0, 40)} /></> : null}
      {tab === 'Services' ? <SimpleTable rows={impactSummary(analysis).filter(row => ['Service Objects', 'Service Groups'].includes(row.Area))} /> : null}
      {tab === 'Certificates' ? <SimpleTable rows={impactSummary(analysis).filter(row => row.Area === 'Certificates')} /> : null}
      {tab === 'BGP' ? <SimpleTable rows={[{ Found: analysis.counts.bgp || 0, Migrated: analysis.counts.bgp || 0, Modified: 'Requires validation', Failed: 0 }]} /> : null}
      {tab === 'OSPF' ? <SimpleTable rows={[{ Found: analysis.counts.ospf || 0, Migrated: analysis.counts.ospf || 0, Modified: 'Requires validation', Failed: 0 }]} /> : null}
      <SectionTitle title="Referenced By Drill-Down" />
      <Field label="Object / Interface / IP" value={refSearch} onChangeText={setRefSearch} />
      <SimpleTable rows={referencedByAnalysis(analysis, refSearch).slice(0, 30)} />
      <ActionButton label="Validate Migration" icon="shield-checkmark-outline" onPress={onNext} />
    </Panel>
  );
}

function ValidationStep({ analysis, target, issues, options, setOptions, critical, onGenerate, result }: {
  analysis: FortiGateAnalysis;
  target: NonNullable<ReturnType<typeof findFortiGateModel>>;
  issues: ValidationIssue[];
  options: MigrationOptions;
  setOptions: React.Dispatch<React.SetStateAction<MigrationOptions>>;
  critical: boolean;
  onGenerate: () => void;
  result: MigrationResult | null;
}) {
  const [onlyCritical, setOnlyCritical] = useState(false);
  const visible = onlyCritical ? issues.filter(item => item.severity === 'ERROR') : issues;
  return (
    <Panel title="Validation & Migration Options" subtitle="Critical errors block generation unless Generate Anyway is enabled.">
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Choice label="All Results" active={!onlyCritical} onPress={() => setOnlyCritical(false)} />
        <Choice label="Critical Only" active={onlyCritical} onPress={() => setOnlyCritical(true)} />
      </View>
      <SectionTitle title="Migration Readiness Score" />
      <ReadinessCard result={result} issues={issues} explanation={scoreExplanation(result)} />
      <SectionTitle title="Warnings, Errors, and Recommendations" />
      <IssueList rows={visible} />
      <SectionTitle title="Migration Summary" />
      <MetricGrid rows={[
        ...migrationSummaryRows(analysis, result),
        ['Admin Accounts Found', analysis.counts.admins || 0],
        ['Emergency Admin', options.adminAccessMode === 'emergency' ? options.emergencyAdminUsername || 'migration-admin' : 'Disabled'],
        ['Management Access', issues.some(item => item.objectType === 'Management Access' && item.severity === 'ERROR') ? 'Missing' : 'Detected'],
        ['Migration Mode', options.migrationMode || 'standard'],
        ['FortiManager', options.migrateFortiManager ? 'Migrate' : 'Remove'],
      ]} />
      <SectionTitle title="Migration Change Log" />
      <SimpleTable rows={migrationChangeLog(analysis, result).slice(0, 40)} />
      <SectionTitle title="Unsupported Command Report" />
      <SimpleTable rows={unsupportedCommands(analysis, target)} />
      <SectionTitle title="Migration Options" />
      <ToggleGrid options={options} setOptions={setOptions} />
      <AdminAccessOptions options={options} setOptions={setOptions} />
      {options.replaceHostname ? <Field label="New Hostname" value={options.newHostname} onChangeText={newHostname => setOptions(prev => ({ ...prev, newHostname }))} /> : null}
      {critical ? <TextHint text="Critical issues exist. Final config generation is blocked unless Generate Anyway is enabled." tone="warning" /> : null}
      <ActionButton label={critical && !options.generateAnyway ? 'Resolve Errors or Enable Generate Anyway' : 'Generate Config and Reports'} icon="download-outline" disabled={critical && !options.generateAnyway} onPress={onGenerate} />
    </Panel>
  );
}

function GenerateStep({ analysis, result, targetModel, mappings, target, options, generate }: { analysis: FortiGateAnalysis; result: MigrationResult | null; targetModel: string; mappings: InterfaceMapping[]; target: NonNullable<ReturnType<typeof findFortiGateModel>>; options: MigrationOptions; generate: () => void }) {
  if (!result) {
    return <Panel title="Generate Output" subtitle="Run generation after validation."><ActionButton label="Generate Now" icon="download-outline" onPress={generate} /></Panel>;
  }
  const files = buildOutputFiles(analysis, result, targetModel);
  return (
    <Panel title="Final Output" subtitle="Generated locally. Export files before importing the migrated config into a replacement firewall.">
      <MetricGrid rows={[
        ['Readiness Score', `${result.score}%`],
        ['Status', result.readiness],
        ['Modified Lines', result.modifiedLines.length],
        ['Removed Lines', result.removedLines.length],
        ['Validation Issues', result.issues.length],
        ['Import Probability', `${result.importProbability ?? result.score}%`],
        ['Restore Confidence', `${result.restoreConfidence ?? result.score}%`],
        ['Compatibility Score', `${result.compatibilityScore ?? result.score}%`],
      ]} />
      <SectionTitle title="Feature Coverage Matrix" />
      <CoverageBars rows={result.coverage} />
      <SectionTitle title="Final Pre-Download Summary" />
      <MetricGrid rows={[
        ['Readiness Score', `${result.score}%`],
        ['Warnings', result.issues.filter(item => item.severity === 'WARNING').length],
        ['Errors', result.issues.filter(item => item.severity === 'ERROR').length],
        ['Unsupported Features', unsupportedCommands(analysis, target).length],
        ['Objects Modified', result.modifiedLines.length],
        ['Objects Skipped', result.removedLines.length],
        ['VPN Validation', analysis.features.ipsecVpn || analysis.features.sslVpn ? 'Required' : 'Not used'],
      ]} />
      <SimpleTable rows={compatibilityNotes(analysis, options)} />
      <SectionTitle title="Parser Simulation" />
      <SimpleTable rows={result.parserValidation || []} />
      <SectionTitle title="Section Coverage Report" />
      <SimpleTable rows={result.sectionCoverage || []} />
      <SectionTitle title="Dependency Graph" />
      <SimpleTable rows={(result.dependencyGraph || []).slice(0, 60)} />
      <SimpleTable rows={unsupportedCommands(analysis, target)} />
      <SectionTitle title="Migration Change Log" />
      <SimpleTable rows={migrationChangeLog(analysis, result).slice(0, 60)} />
      <SectionTitle title="Config Difference Viewer" />
      <DiffView result={result} />
      <SectionTitle title="Post Migration Checklist" />
      <BulletList rows={result.checklist} />
      <SectionTitle title="Generated Files" />
      {files.map(file => (
        <FileCard key={file.name} name={file.name} size={file.content.length} onCopy={() => Clipboard.setStringAsync(file.content)} onExport={() => exportFile(file.name, file.content)} />
      ))}
      <ActionButton label="Export Migration Report PDF" icon="document-text-outline" onPress={() => exportPdf(result.reportHtml)} />
      <ActionButton label="Export Migration Report Excel" icon="grid-outline" onPress={() => exportExcel(analysis, mappings, result)} />
    </Panel>
  );
}

function CompareStrip({ source, target, targetSeries }: { source: string; target: string; targetSeries: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.compareStrip}>
      <View style={styles.compareCard}>
        <Text style={styles.label}>Source</Text>
        <Text style={styles.value}>{source || 'UNKNOWN'}</Text>
      </View>
      <Ionicons name="arrow-forward-outline" size={18} color={theme.colors.gray400} />
      <View style={styles.compareCard}>
        <Text style={styles.label}>Target</Text>
        <Text style={styles.value}>{target}</Text>
      </View>
      <StatusBadge label={targetSeries} tone="success" />
    </View>
  );
}

function ModelSelector({ value, onChange }: { value: string; onChange: (model: string) => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const selected = findFortiGateModel(value);
  const seriesOrder = ['D', 'E', 'F', 'G', 'Unknown'];
  const initialSeries = selected?.series && seriesOrder.includes(selected.series) ? selected.series : 'G';
  const [open, setOpen] = useState(false);
  const [series, setSeries] = useState(initialSeries);
  const models = fortigateModels.filter(model => (model.series || 'Unknown') === series);
  return (
    <View style={styles.selectorCard}>
      <TouchableOpacity style={styles.selectorHeader} onPress={() => setOpen(prev => !prev)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Select Model</Text>
          <Text style={styles.value}>{value || 'Select FortiGate model'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={theme.colors.gray300} />
      </TouchableOpacity>
      {open ? (
        <View style={{ gap: 9 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {seriesOrder.map(item => (
              <Choice key={item} label={`${item}-Series`} active={series === item} onPress={() => setSeries(item)} />
            ))}
          </ScrollView>
          <View style={styles.modelGrid}>
            {models.map(model => (
              <TouchableOpacity key={model.name} onPress={() => { onChange(model.name); setOpen(false); }} style={[styles.modelOption, value === model.name && styles.modelOptionActive]}>
                <Text style={[styles.modelOptionText, value === model.name && styles.choiceTextActive]}>{model.name}</Text>
                {model.verified === false ? <Text style={styles.modelMeta}>unverified</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatusBadge({ label, tone = 'info' }: { label: string; tone?: 'success' | 'warning' | 'error' | 'info' }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={[styles.statusBadge, tone === 'success' ? styles.statusGreen : tone === 'warning' ? styles.statusYellow : tone === 'error' ? styles.statusRed : styles.statusBlue]}>
      <Text style={[styles.statusBadgeText, tone === 'success' ? styles.statusTextGreen : tone === 'warning' ? styles.statusTextYellow : tone === 'error' ? styles.statusTextRed : styles.statusTextBlue]}>{label}</Text>
    </View>
  );
}

function statusTone(value: string): 'success' | 'warning' | 'error' | 'info' {
  const normalized = value.toLowerCase();
  if (normalized.includes('not configured')) return 'info';
  if (normalized.includes('configured')) return 'success';
  if (normalized.includes('unsupported') || normalized.includes('missing') || normalized.includes('error') || normalized.includes('failed') || normalized.includes('not migrated')) return 'error';
  if (normalized.includes('partial') || normalized.includes('manual') || normalized.includes('warning') || normalized.includes('validate') || normalized.includes('review')) return 'warning';
  if (normalized.includes('support') || normalized.includes('ready') || normalized.includes('ok') || normalized.includes('yes') || normalized.includes('detected')) return 'success';
  return 'info';
}

function FeatureList({ rows }: { rows: Array<Record<string, any>> }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  if (!rows.length) return <Text style={styles.muted}>No feature detections found.</Text>;
  return (
    <View style={styles.statusList}>
      {rows.map((row, index) => {
        const status = String(row.Status || row.status || row.Feasibility || '');
        const tone = statusTone(status);
        return (
          <View key={`${row.Feature || row.Component || index}`} style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{String(row.Feature || row.Component || 'Feature')}</Text>
              <Text style={styles.muted}>
                {String(row.Converted ? `Converted: ${row.Converted}` : row.Migrated ? `Migrated: ${row.Migrated}` : row.Notes || row.Note || row.Detail || '')}
                {row['Manual Review'] ? ` - Manual Review: ${row['Manual Review']}` : ''}
              </Text>
            </View>
            <StatusBadge label={status || String(row.Value || 'Detected')} tone={tone} />
          </View>
        );
      })}
    </View>
  );
}

function InterfaceMappingCard({ mapping, source, ports, vlanParentPorts, memberPorts, onSelect, onToggleMember, onSelectParent }: {
  mapping: InterfaceMapping;
  source?: FortiGateAnalysis['interfaces'][number];
  ports: string[];
  vlanParentPorts: string[];
  memberPorts: string[];
  onSelect: (port: string) => void;
  onToggleMember: (port: string) => void;
  onSelectParent: (parent: string) => void;
}) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const tone = mapping.status === 'ERROR' ? 'error' : mapping.status === 'WARNING' ? 'warning' : 'success';
  const isLogical = isLogicalUiInterface(source, mapping);
  const isSwitchLike = isSwitchLikeUiInterface(source, mapping);
  return (
    <View style={styles.interfaceCard}>
      <View style={styles.interfaceHeader}>
        <View style={styles.interfaceNameRow}>
          <View style={[styles.statusDot, tone === 'error' ? styles.dotRed : tone === 'warning' ? styles.dotYellow : styles.dotGreen]} />
          <Text style={styles.title}>{mapping.source}</Text>
        </View>
        <StatusBadge label={interfaceTypeBadge(source?.type, mapping.role)} tone={mapping.role === 'WAN' ? 'success' : mapping.role === 'LAN' ? 'info' : tone} />
        <StatusBadge label={mapping.role || 'Unknown'} tone={mapping.role === 'WAN' ? 'success' : mapping.role === 'LAN' ? 'error' : 'info'} />
      </View>
      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.label}>IP</Text>
          <Text style={styles.value}>{source?.ip || '-'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.label}>Parent</Text>
          <Text style={styles.value}>{source?.parent || '-'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.label}>VLAN</Text>
          <Text style={styles.value}>{source?.vlanId || '-'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.label}>References</Text>
          <Text style={styles.value}>{source?.refs ?? 0}</Text>
        </View>
      </View>
      {source?.alias ? <Text style={styles.muted}>Alias: {source.alias}</Text> : null}
      {source?.members?.length ? <Text style={styles.muted}>Source members: {source.members.join(', ')}</Text> : null}
      <Text style={styles.muted}>Structure: {source?.notes?.length ? source.notes.join(', ') : mapping.notes}</Text>
      {isSwitchLike ? (
        <>
          <Text style={styles.label}>Target Members</Text>
          <View style={styles.memberGrid}>
            {memberPorts.map(port => {
              const active = Boolean(mapping.targetMembers?.includes(port));
              return (
                <TouchableOpacity key={port} style={[styles.memberChoice, active && styles.memberChoiceActive]} onPress={() => onToggleMember(port)}>
                  <Ionicons name={active ? 'checkbox-outline' : 'square-outline'} size={16} color={active ? theme.colors.green400 : theme.colors.gray400} />
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{port}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextHint text={`${mapping.source} will stay as the logical interface. Selected ports become members under it, preserving IP, DHCP, policies, VLAN hierarchy, and management access.`} />
        </>
      ) : isLogical ? (
        <TextHint text={`${mapping.source} is a logical ${mapping.role} interface. Its name is preserved; only parent physical references are remapped where needed.`} />
      ) : (
        <>
          <Text style={styles.label}>Map Physical Port To</Text>
          <View style={styles.memberGrid}>
            <TouchableOpacity style={[styles.memberChoice, !mapping.target && styles.memberChoiceActive]} onPress={() => onSelect('')}>
              <Ionicons name={!mapping.target ? 'checkbox-outline' : 'square-outline'} size={16} color={!mapping.target ? theme.colors.green400 : theme.colors.gray400} />
              <Text style={[styles.choiceText, !mapping.target && styles.choiceTextActive]}>Unmapped</Text>
            </TouchableOpacity>
            {ports.map(port => {
              const active = mapping.target === port;
              return (
                <TouchableOpacity key={port} style={[styles.memberChoice, active && styles.memberChoiceActive]} onPress={() => onSelect(port)}>
                  <Ionicons name={active ? 'checkbox-outline' : 'square-outline'} size={16} color={active ? theme.colors.green400 : theme.colors.gray400} />
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{port}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      {source?.vlanId ? (
        <>
          <SectionTitle title="Target VLAN Parent" />
          <TextHint text={`${mapping.source} keeps VLAN ID ${source.vlanId}. Choose the target interface that should carry this VLAN as a sub-interface.`} />
          <View style={styles.memberGrid}>
            {vlanParentPorts.map(port => {
              const active = (mapping.targetParent || source.parent) === port;
              return (
                <TouchableOpacity key={port} style={[styles.memberChoice, active && styles.memberChoiceActive]} onPress={() => onSelectParent(port)}>
                  <Ionicons name={active ? 'checkbox-outline' : 'square-outline'} size={16} color={active ? theme.colors.green400 : theme.colors.gray400} />
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{port}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}
      {mapping.status !== 'OK' ? <TextHint text={mapping.notes} tone={mapping.status === 'ERROR' ? 'warning' : 'normal'} /> : null}
    </View>
  );
}

function isLogicalUiInterface(source: FortiGateAnalysis['interfaces'][number] | undefined, mapping: InterfaceMapping) {
  const type = (source?.type || '').toLowerCase();
  return Boolean(source?.vlanId || source?.parent || ['vlan', 'loopback', 'tunnel', 'aggregate', 'fortilink', 'switch', 'hard-switch', 'vap-switch', 'wl-mesh', 'wlan', 'wireless'].includes(type) || ['VLAN', 'Loopback', 'Tunnel', 'Aggregate', 'Switch', 'FortiLink', 'WiFi/VAP'].includes(mapping.role));
}

function isSwitchLikeUiInterface(source: FortiGateAnalysis['interfaces'][number] | undefined, mapping: InterfaceMapping) {
  const type = (source?.type || '').toLowerCase();
  return ['hard-switch', 'switch', 'aggregate'].includes(type) || ['Switch', 'Aggregate', 'FortiLink'].includes(mapping.role);
}

function vlanParentChoices(analysis: FortiGateAnalysis, target: NonNullable<ReturnType<typeof findFortiGateModel>>, mappings: InterfaceMapping[]) {
  const physical = [...target.switchPorts, ...target.portNames];
  const parentCapable = analysis.interfaces
    .filter(item => {
      const type = (item.type || '').toLowerCase();
      return ['hard-switch', 'switch', 'aggregate'].includes(type) || ['Switch', 'Aggregate', 'FortiLink', 'LAN'].includes(item.role);
    })
    .map(item => {
      const row = mappings.find(mapping => mapping.source === item.name);
      return row?.target || item.name;
    });
  const currentParents = analysis.interfaces.filter(item => item.vlanId && item.parent).map(item => item.parent as string);
  return [...new Set([...parentCapable, ...currentParents, ...physical].filter(Boolean))];
}

function ReadinessCard({ result, issues, explanation }: { result: MigrationResult | null; issues: ValidationIssue[]; explanation: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const errors = issues.filter(item => item.severity === 'ERROR').length;
  const warnings = issues.filter(item => item.severity === 'WARNING').length;
  const ok = Math.max(0, issues.length - errors - warnings);
  const score = result?.score ?? Math.max(0, 100 - errors * 25 - warnings * 7);
  const tone = score >= 90 ? 'success' : score >= 70 ? 'warning' : 'error';
  return (
    <View style={styles.readinessCard}>
      <View style={[styles.scoreCircle, tone === 'success' ? styles.scoreGreen : tone === 'warning' ? styles.scoreYellow : styles.scoreRed]}>
        <Text style={styles.scoreText}>{score}%</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={styles.title}>{result?.readiness || (errors ? 'Manual validation recommended' : warnings ? 'Review warnings before generating' : 'Ready to generate')}</Text>
        <Text style={styles.muted}>{explanation}</Text>
        <View style={styles.statusCounterRow}>
          <StatusBadge label={`${errors} errors`} tone={errors ? 'error' : 'success'} />
          <StatusBadge label={`${warnings} warnings`} tone={warnings ? 'warning' : 'success'} />
          <StatusBadge label={`${ok} ok`} tone="success" />
        </View>
      </View>
    </View>
  );
}

function IssueList({ rows }: { rows: ValidationIssue[] }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  if (!rows.length) return <Text style={styles.muted}>No validation issues found.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((item, index) => {
        const tone = item.severity === 'ERROR' ? 'error' : item.severity === 'WARNING' ? 'warning' : 'info';
        return (
          <View key={`${item.objectType}-${item.objectName}-${index}`} style={[styles.issueCard, tone === 'error' ? styles.issueRed : tone === 'warning' ? styles.issueYellow : styles.issueBlue]}>
            <View style={styles.interfaceHeader}>
              <Text style={styles.title}>{item.objectType} - {item.objectName}</Text>
              <StatusBadge label={item.severity} tone={tone} />
            </View>
            <Text style={styles.tableText}>{item.issue}</Text>
            <Text style={styles.muted}>{item.recommendation}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CoverageBars({ rows }: { rows: MigrationResult['coverage'] }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  if (!rows.length) return <Text style={styles.muted}>No coverage data available.</Text>;
  return (
    <View style={styles.coverageCard}>
      {rows.map(item => {
        const tone = statusTone(item.feasibility);
        const barStyle = tone === 'success' ? styles.barGreen : tone === 'warning' ? styles.barYellow : tone === 'error' ? styles.barRed : styles.barBlue;
        return (
          <View key={item.component} style={styles.coverageRow}>
            <View style={styles.coverageTop}>
              <Text style={styles.tableText}>{item.component}</Text>
              <Text style={styles.value}>{item.percent}%</Text>
              <StatusBadge label={item.feasibility} tone={tone} />
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, barStyle, { width: `${Math.max(4, Math.min(100, item.percent))}%` }]} />
            </View>
            <Text style={styles.muted}>{item.notes}</Text>
          </View>
        );
      })}
    </View>
  );
}

function FileCard({ name, size, onCopy, onExport }: { name: string; size: number; onCopy: () => void; onExport: () => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.fileRow}>
      <View style={styles.fileIcon}>
        <Ionicons name={name.endsWith('.conf') ? 'document-text-outline' : name.endsWith('.html') ? 'globe-outline' : 'list-outline'} size={17} color={theme.colors.blue400} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.muted}>{size.toLocaleString()} characters</Text>
      </View>
      <TouchableOpacity style={styles.iconButton} onPress={onCopy}>
        <Ionicons name="copy-outline" size={16} color={theme.colors.gray300} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconButton} onPress={onExport}>
        <Ionicons name="download-outline" size={16} color={theme.colors.gray300} />
      </TouchableOpacity>
    </View>
  );
}

function LogicalInterfaceTable({ rows }: { rows: FortiGateAnalysis['interfaces'] }) {
  if (!rows.length) return <TextHint text="No interfaces found in this category." />;
  return <SimpleTable rows={rows.map(item => ({
    Name: item.name,
    Type: interfaceTypeBadge(item.type, item.role),
    Role: item.role,
    IP: item.ip || '-',
    Parent: item.parent || '-',
    VLAN: item.vlanId || '-',
    References: item.refs,
    Status: 'Name preserved',
  }))} />;
}

function AdminAccessOptions({ options, setOptions }: { options: MigrationOptions; setOptions: React.Dispatch<React.SetStateAction<MigrationOptions>> }) {
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title="Admin Access" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Choice label="Preserve Existing Admin Accounts" active={(options.adminAccessMode || 'preserve') === 'preserve'} onPress={() => setOptions(prev => ({ ...prev, adminAccessMode: 'preserve' }))} />
        <Choice label="Create Emergency Admin Account" active={options.adminAccessMode === 'emergency'} onPress={() => setOptions(prev => ({ ...prev, adminAccessMode: 'emergency' }))} />
      </View>
      {options.adminAccessMode === 'emergency' ? (
        <View style={{ gap: 8 }}>
          <Field label="Emergency Username" value={options.emergencyAdminUsername || 'migration-admin'} onChangeText={emergencyAdminUsername => setOptions(prev => ({ ...prev, emergencyAdminUsername }))} />
          <Field label="Emergency Password" value={options.emergencyAdminPassword || ''} onChangeText={emergencyAdminPassword => setOptions(prev => ({ ...prev, emergencyAdminPassword }))} />
          <Field label="Confirm Emergency Password" value={options.emergencyAdminConfirm || ''} onChangeText={emergencyAdminConfirm => setOptions(prev => ({ ...prev, emergencyAdminConfirm }))} />
          <TextHint text="Emergency admin will be appended to the generated config as a fallback login. Remove or rotate it after cutover." tone="warning" />
        </View>
      ) : (
        <TextHint text="Existing admin accounts and password hashes will be preserved. Validation will still check for management access." />
      )}
    </View>
  );
}

function ToggleGrid({ options, setOptions }: { options: MigrationOptions; setOptions: React.Dispatch<React.SetStateAction<MigrationOptions>> }) {
  const labels: Array<[keyof MigrationOptions, string]> = [
    ['removeSerial', 'Remove Serial Number'],
    ['removeRegistration', 'Remove Device Registration'],
    ['removeFortiCloud', 'Remove FortiCloud Registration'],
    ['replaceHostname', 'Replace Hostname'],
    ['keepPolicies', 'Keep Policies'],
    ['keepObjects', 'Keep Objects'],
    ['keepRoutes', 'Keep Routes'],
    ['keepVlans', 'Keep VLANs'],
    ['keepSdwan', 'Keep SD-WAN'],
    ['keepNat', 'Keep NAT'],
    ['keepDhcp', 'Keep DHCP'],
    ['keepVips', 'Keep VIPs'],
    ['keepVpn', 'Keep VPN'],
    ['keepUsers', 'Keep Users'],
    ['keepAdmins', 'Keep Admins'],
    ['keepCertificates', 'Keep Certificates'],
    ['keepFortiLink', 'Keep FortiLink'],
    ['keepSwitchController', 'Keep Switch Controller'],
    ['keepSecurityFabric', 'Keep Security Fabric'],
    ['keepBgp', 'Keep BGP'],
    ['keepOspf', 'Keep OSPF'],
    ['keepZones', 'Keep Zones'],
    ['migrateFortiManager', 'Migrate FortiManager Settings'],
    ['skipUnusedObjects', 'Skip Unused Objects During Migration'],
    ['generateAnyway', 'Generate Anyway'],
  ];
  return (
    <View style={{ gap: 8 }}>
      {labels.map(([key, label]) => (
        <Choice key={key} label={`${options[key] ? 'On' : 'Off'} - ${label}`} active={Boolean(options[key])} onPress={() => setOptions(prev => ({ ...prev, [key]: !prev[key] }))} />
      ))}
    </View>
  );
}

function DiffView({ result }: { result: MigrationResult }) {
  const modified = result.modifiedLines.slice(0, 40).map(item => ({ Type: 'Modified', Before: item.before.trim(), After: item.after.trim() }));
  const removed = result.removedLines.slice(0, 40).map(line => ({ Type: 'Removed', Before: line.trim(), After: '-' }));
  return <SimpleTable rows={[...modified, ...removed]} />;
}

function buildOutputFiles(analysis: FortiGateAnalysis, result: MigrationResult, targetModel: string) {
  return [
    { name: `${targetModel}-Migrated.conf`, content: result.migratedConfig || '' },
    { name: 'migration-report.html', content: result.reportHtml },
    { name: 'migration-errors.html', content: result.errorsHtml },
    { name: 'post-migration-checklist.txt', content: result.checklist.map((item, index) => `${index + 1}. ${item}`).join('\n') },
    { name: 'original-backup.conf', content: analysis.raw },
  ];
}

async function exportFile(name: string, content: string) {
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
}

async function exportPdf(html: string) {
  const pdf = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(pdf.uri);
}

async function exportExcel(analysis: FortiGateAnalysis, mappings: InterfaceMapping[], result: MigrationResult | null) {
  const uri = `${FileSystem.cacheDirectory}migration-report.xlsx`;
  await FileSystem.writeAsStringAsync(uri, buildExcelBase64(analysis, mappings, result), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      <View style={{ height: 8 }} />
      {children}
    </View>
  );
}

function MetricGrid({ rows }: { rows: Array<[string, string | number]> }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.metricGrid}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.metricCard}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function SimpleTable({ rows }: { rows: Array<Record<string, any>> }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  if (!rows.length) return <Text style={styles.muted}>No rows to display.</Text>;
  const keys = Object.keys(rows[0]);
  return (
    <View style={styles.table}>
      {rows.map((row, index) => (
        <View key={index} style={styles.tableRow}>
          {keys.map(key => (
            <View key={key} style={styles.tableCell}>
              <Text style={styles.label}>{key}</Text>
              <Text style={styles.tableText}>{String(row[key] ?? '')}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function BulletList({ rows, tone = 'normal' }: { rows: string[]; tone?: 'normal' | 'success' }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row, index) => (
        <View key={`${row}-${index}`} style={styles.bulletRow}>
          <Ionicons name={tone === 'success' ? 'checkmark-outline' : 'ellipse'} size={tone === 'success' ? 15 : 5} color={tone === 'success' ? theme.colors.green400 : theme.colors.gray400} />
          <Text style={styles.bullet}>{row}</Text>
        </View>
      ))}
    </View>
  );
}

function TagRow({ values }: { values: string[] }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{values.map(value => <Choice key={value} label={value} active={false} onPress={() => {}} />)}</ScrollView>;
}

function interfaceTypeBadge(type?: string, role?: string) {
  if (role === 'FortiLink') return 'FortiLink';
  if (role === 'Loopback' || type === 'loopback') return 'Loopback';
  if (role === 'Tunnel' || type === 'tunnel') return 'Tunnel';
  if (role === 'WiFi/VAP' || type === 'vap-switch') return 'WiFi/VAP';
  if (type === 'vlan') return 'VLAN';
  if (type === 'loopback') return 'Loopback';
  if (type === 'aggregate') return 'Aggregate';
  if (type === 'tunnel') return 'Tunnel';
  if (type === 'hard-switch' || type === 'switch') return 'Hardware Switch';
  if (type === 'vwire') return 'Virtual Wire';
  return 'Physical';
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (text: string) => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholderTextColor={theme.colors.gray500} style={styles.input} />
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <TouchableOpacity onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({ label, icon, onPress, disabled = false }: { label: string; icon: string; onPress: () => void; disabled?: boolean }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.actionButton, disabled && styles.disabled]}>
      <Ionicons name={icon as any} size={16} color="#fff" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function TextHint({ text, tone = 'normal' }: { text: string; tone?: 'normal' | 'warning' }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return <Text style={[styles.hint, tone === 'warning' && styles.warningHint]}>{text}</Text>;
}

const createStyles = (colors: typeof import('../../theme/colors').colors) => StyleSheet.create({
  container: { gap: 12 },
  hero: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg900, borderRadius: 8, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  heroIcon: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.blue500_30, backgroundColor: colors.blue600_20, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontSize: 17, fontWeight: '900' },
  heroSub: { color: colors.gray400, fontSize: 12, marginTop: 2 },
  stepBar: { gap: 7, paddingBottom: 2 },
  stepPill: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  stepPillActive: { borderColor: colors.blue500, backgroundColor: colors.blue600_20 },
  stepText: { color: colors.gray400, fontSize: 12, fontWeight: '900' },
  stepTextActive: { color: colors.blue400 },
  summaryBar: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_60, padding: 10, borderRadius: 8, gap: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  summaryItem: { minWidth: 88, flex: 1 },
  panel: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg900, borderRadius: 8, padding: 12, gap: 10 },
  panelTitle: { color: colors.white, fontSize: 18, fontWeight: '900' },
  sectionTitle: { color: colors.white, fontSize: 14, fontWeight: '900', marginTop: 8 },
  muted: { color: colors.gray400, fontSize: 12, lineHeight: 17 },
  label: { color: colors.gray500, fontSize: 10, textTransform: 'uppercase', fontWeight: '900' },
  value: { color: colors.white, fontSize: 13, fontWeight: '900' },
  uploadBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.blue500, backgroundColor: colors.blue600_20, borderRadius: 8, paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  uploadTitle: { color: colors.white, fontSize: 15, fontWeight: '900' },
  infoCard: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 8, padding: 12, gap: 9 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '48%', minWidth: 132, flexGrow: 1, borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 6, padding: 10, gap: 4 },
  table: { borderWidth: 1, borderColor: colors.border700, borderRadius: 8, overflow: 'hidden', gap: 0 },
  tableRow: { borderBottomWidth: 1, borderBottomColor: colors.border700, padding: 9, gap: 7, backgroundColor: colors.bg800_40 },
  tableCell: { gap: 2 },
  tableText: { color: colors.gray200, fontSize: 12, lineHeight: 16 },
  choice: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 },
  choiceActive: { borderColor: colors.green500, backgroundColor: colors.green500_20 },
  choiceText: { color: colors.gray300, fontSize: 12, fontWeight: '900' },
  choiceTextActive: { color: colors.green400 },
  actionButton: { backgroundColor: colors.blue600, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  badge: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  badgeGreen: { borderColor: colors.green500_30, backgroundColor: colors.green500_20 },
  badgeYellow: { borderColor: colors.yellow500_30, backgroundColor: colors.yellow500_20 },
  badgeRed: { borderColor: colors.red500_30, backgroundColor: colors.red500_20 },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  statusBadge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusGreen: { borderColor: colors.green500_30, backgroundColor: colors.green500_20 },
  statusYellow: { borderColor: colors.yellow500_30, backgroundColor: colors.yellow500_20 },
  statusRed: { borderColor: colors.red500_30, backgroundColor: colors.red500_20 },
  statusBlue: { borderColor: colors.blue500_30, backgroundColor: colors.blue600_20 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  statusTextGreen: { color: colors.green400 },
  statusTextYellow: { color: colors.yellow400 },
  statusTextRed: { color: colors.red400 },
  statusTextBlue: { color: colors.blue400 },
  compareStrip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  compareCard: { minWidth: 108, flex: 1, borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 6, padding: 10, gap: 4 },
  selectorCard: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 8, padding: 10, gap: 10 },
  selectorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelOption: { minWidth: 92, borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 8, gap: 2 },
  modelOptionActive: { borderColor: colors.green500, backgroundColor: colors.green500_20 },
  modelOptionText: { color: colors.gray300, fontSize: 12, fontWeight: '900' },
  modelMeta: { color: colors.yellow400, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  statusList: { borderWidth: 1, borderColor: colors.border700, borderRadius: 8, overflow: 'hidden' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border700, backgroundColor: colors.bg800_40, padding: 10 },
  interfaceCard: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 8, padding: 11, gap: 9 },
  interfaceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  interfaceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChoice: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberChoiceActive: { borderColor: colors.green500, backgroundColor: colors.green500_20 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  dotGreen: { backgroundColor: colors.green500 },
  dotYellow: { backgroundColor: colors.yellow500 },
  dotRed: { backgroundColor: colors.red500 },
  readinessCard: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreCircle: { width: 66, height: 66, borderRadius: 33, borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg900 },
  scoreGreen: { borderColor: colors.green500 },
  scoreYellow: { borderColor: colors.yellow500 },
  scoreRed: { borderColor: colors.red500 },
  scoreText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  statusCounterRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  issueCard: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 7 },
  issueRed: { borderColor: colors.red500_30, backgroundColor: colors.red500_10 },
  issueYellow: { borderColor: colors.yellow500_30, backgroundColor: colors.yellow500_10 },
  issueBlue: { borderColor: colors.blue500_30, backgroundColor: colors.blue500_20 },
  coverageCard: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 8, padding: 10, gap: 11 },
  coverageRow: { gap: 6 },
  coverageTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  barTrack: { height: 6, borderRadius: 6, backgroundColor: colors.bg700_40, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 6 },
  barGreen: { backgroundColor: colors.green500 },
  barYellow: { backgroundColor: colors.yellow500 },
  barRed: { backgroundColor: colors.red500 },
  barBlue: { backgroundColor: colors.blue500 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800_40, borderRadius: 8, padding: 10 },
  fileIcon: { width: 34, height: 34, borderRadius: 7, borderWidth: 1, borderColor: colors.blue500_30, backgroundColor: colors.blue600_20, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 34, height: 34, borderRadius: 7, borderWidth: 1, borderColor: colors.border700, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg800 },
  title: { color: colors.white, fontSize: 13, fontWeight: '900' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bullet: { color: colors.gray300, fontSize: 12, lineHeight: 17, flex: 1 },
  input: { borderWidth: 1, borderColor: colors.border700, backgroundColor: colors.bg800, color: colors.white, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13 },
  hint: { color: colors.gray300, backgroundColor: colors.bg800_40, borderWidth: 1, borderColor: colors.border700, padding: 9, borderRadius: 8, fontSize: 12, lineHeight: 17 },
  warningHint: { color: colors.yellow400, borderColor: colors.yellow500_30, backgroundColor: colors.yellow500_10 },
});
