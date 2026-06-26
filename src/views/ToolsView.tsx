import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { colors, useThemeMode } from '../theme/colors';
import { getNativeLanNetworkInfo, scanNativeLan } from '../native/lanScanner';
import FortiGateMigrationAssistant from '../tools/migration/FortiGateMigrationAssistant';

type CategoryId = 'network' | 'config' | 'reference' | 'wireless' | 'aci' | 'migration';
type ToolId =
  | 'ip-calculator' | 'subnet-calculator' | 'vlsm-calculator' | 'route-summary' | 'ipv6-calculator' | 'lan-scanner'
  | 'acl-builder' | 'vlan-planner' | 'static-route' | 'prefix-list' | 'route-summary-config' | 'redundancy' | 'ospf' | 'dhcp' | 'bgp-builder'
  | 'port-db' | 'sfp-db' | 'poe-reference' | 'poe-budget'
  | 'wifi-reference' | 'rf-calculator' | 'ap-planner'
  | 'aci-naming' | 'aci-contracts' | 'aci-mapping' | 'aci-cli'
  | 'fortigate-migration';

interface ToolDef {
  id: ToolId;
  category: CategoryId;
  name: string;
  description: string;
  icon: string;
}

const categories: Array<{ id: CategoryId; name: string; description: string; icon: string }> = [
  { id: 'network', name: 'Network Tools', description: 'IP, subnetting, summarization, IPv6, and LAN checks.', icon: 'git-network-outline' },
  { id: 'config', name: 'Config Generators', description: 'Generate Cisco, Aruba, Fortinet, routing, and services config.', icon: 'code-slash-outline' },
  { id: 'reference', name: 'Reference Databases', description: 'Offline ports, MAC vendors, optics, and PoE references.', icon: 'library-outline' },
  { id: 'wireless', name: 'Wireless Tools', description: 'Channels, RF conversions, and AP planning guidance.', icon: 'wifi-outline' },
  { id: 'aci', name: 'ACI Tools', description: 'Naming, contracts, mappings, and Cisco ACI command references.', icon: 'cube-outline' },
  { id: 'migration', name: 'Migration Tools', description: 'Firewall Migration & Hardware Refresh Assistant.', icon: 'swap-horizontal-outline' },
];

const tools: ToolDef[] = [
  { id: 'ip-calculator', category: 'network', name: 'IP Calculator', description: 'CIDR, mask, wildcard, network, broadcast, host range.', icon: 'calculator-outline' },
  { id: 'subnet-calculator', category: 'network', name: 'Subnet Calculator', description: 'Split a network into equal subnets.', icon: 'grid-outline' },
  { id: 'vlsm-calculator', category: 'network', name: 'VLSM Calculator', description: 'Allocate optimized subnets from host requirements.', icon: 'layers-outline' },
  { id: 'route-summary', category: 'network', name: 'Route Summarization', description: 'Summarize multiple IPv4 routes.', icon: 'contract-outline' },
  { id: 'ipv6-calculator', category: 'network', name: 'IPv6 Calculator', description: 'Expand, compress, classify, and show network prefix.', icon: 'infinite-outline' },
  { id: 'lan-scanner', category: 'network', name: 'LAN Scanner Lite', description: 'Reachability scan and common web-port checks where available.', icon: 'radio-outline' },
  { id: 'acl-builder', category: 'config', name: 'ACL Builder', description: 'Build Cisco ACL rules with live preview.', icon: 'shield-checkmark-outline' },
  { id: 'vlan-planner', category: 'config', name: 'VLAN Planner', description: 'Plan VLANs with Cisco, Aruba, Fortinet, and summary tabs.', icon: 'albums-outline' },
  { id: 'static-route', category: 'config', name: 'Static Route Builder', description: 'Generate Cisco static routes.', icon: 'trail-sign-outline' },
  { id: 'prefix-list', category: 'config', name: 'Prefix List Builder', description: 'Generate Cisco prefix-list lines.', icon: 'list-outline' },
  { id: 'route-summary-config', category: 'config', name: 'Summary Config', description: 'Generate summarized route plus Cisco-style config notes.', icon: 'swap-horizontal-outline' },
  { id: 'redundancy', category: 'config', name: 'Redundancy Builder', description: 'Generate HSRP, VRRP, and GLBP snippets.', icon: 'repeat-outline' },
  { id: 'ospf', category: 'config', name: 'OSPF Builder', description: 'Generate network statements and area assignments.', icon: 'share-social-outline' },
  { id: 'dhcp', category: 'config', name: 'DHCP Builder', description: 'DHCP pools, exclusions, DNS, and gateway config.', icon: 'server-outline' },
  { id: 'bgp-builder', category: 'config', name: 'BGP Builder', description: 'Generate Cisco BGP neighbors, networks, and policy basics.', icon: 'git-branch-outline' },
  { id: 'port-db', category: 'reference', name: 'Port Database', description: 'Search common TCP/UDP and vendor ports offline.', icon: 'search-outline' },
  { id: 'sfp-db', category: 'reference', name: 'SFP Database', description: 'Curated transceiver speed, distance, fiber, connector, wavelength.', icon: 'hardware-chip-outline' },
  { id: 'poe-reference', category: 'reference', name: 'PoE Reference', description: '802.3af/at/bt power and device guidance.', icon: 'flash-outline' },
  { id: 'poe-budget', category: 'reference', name: 'PoE Budget Calculator', description: 'Calculate switch PoE budget, AP load, and remaining power.', icon: 'battery-charging-outline' },
  { id: 'wifi-reference', category: 'wireless', name: 'WiFi Channel Reference', description: '2.4 GHz, 5 GHz, 6 GHz, DFS, and overlap guidance.', icon: 'wifi-outline' },
  { id: 'rf-calculator', category: 'wireless', name: 'RF Calculator', description: 'dBm to mW, mW to dBm, RSSI and SNR references.', icon: 'analytics-outline' },
  { id: 'ap-planner', category: 'wireless', name: 'AP Planning Estimator', description: 'Estimate AP count from area, users, and environment.', icon: 'cellular-outline' },
  { id: 'aci-naming', category: 'aci', name: 'ACI Naming Generator', description: 'Generate common ACI object names.', icon: 'pricetag-outline' },
  { id: 'aci-contracts', category: 'aci', name: 'ACI Contract Matrix', description: 'Build provider/consumer contract and filter matrix.', icon: 'git-compare-outline' },
  { id: 'aci-mapping', category: 'aci', name: 'ACI VLAN / EPG Planner', description: 'Plan VLAN, domain, AAEP, EPG, BD, and policy group mappings.', icon: 'map-outline' },
  { id: 'aci-cli', category: 'aci', name: 'ACI CLI Quick Reference', description: 'Search APIC, leaf/spine, endpoint, VLAN, contract, and fault commands.', icon: 'terminal-outline' },
  { id: 'fortigate-migration', category: 'migration', name: 'FortiGate Migration Assistant', description: 'FortiGate-to-FortiGate hardware refresh parser, mapper, validator, and report generator.', icon: 'shield-half-outline' },
];

const stopWords = new Set(['how', 'to', 'the', 'a', 'an', 'for', 'of', 'in', 'on', 'and']);
const commonPorts = [22, 23, 80, 443, 3389, 8080];
const customDataFile = `${FileSystem.documentDirectory}nettrouble_tools_custom.json`;
const toolStateFile = `${FileSystem.documentDirectory}nettrouble_tools_state.json`;

function parseIPv4(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

function formatIPv4(num: number) {
  return [24, 16, 8, 0].map(s => ((num >>> s) & 255).toString()).join('.');
}

function maskFromCidr(cidr: number) {
  if (cidr === 0) return 0;
  return (0xffffffff << (32 - cidr)) >>> 0;
}

function wildcardFromCidr(cidr: number) {
  return (~maskFromCidr(cidr)) >>> 0;
}

function parseNetwork(value: string, fallbackCidr?: number) {
  const trimmed = value.trim();
  const [ipPart, cidrPart] = trimmed.split('/');
  const cidr = cidrPart !== undefined ? Number(cidrPart) : fallbackCidr;
  const ip = parseIPv4(ipPart);
  if (ip === null || cidr === undefined || !Number.isInteger(cidr) || cidr < 0 || cidr > 32) return null;
  const mask = maskFromCidr(cidr);
  return { ip, cidr, network: (ip & mask) >>> 0, mask };
}

function parseScanTargets(value: string, limitInput: string) {
  const maxLimit = Math.min(Math.max(Number(limitInput) || 64, 1), 512);
  const cleaned = value.trim();
  if (cleaned.includes('-')) {
    const [startRaw, endRaw] = cleaned.split('-').map(v => v.trim());
    const start = parseIPv4(startRaw);
    const end = parseIPv4(endRaw);
    if (start === null || end === null || end < start) return [];
    const total = Math.min(end - start + 1, maxLimit);
    return Array.from({ length: total }, (_, i) => formatIPv4((start + i) >>> 0));
  }
  const parsed = parseNetwork(cleaned);
  if (!parsed) return [];
  const first = parsed.cidr >= 31 ? parsed.network : parsed.network + 1;
  const last = parsed.cidr >= 31 ? (parsed.network | wildcardFromCidr(parsed.cidr)) >>> 0 : ((parsed.network | wildcardFromCidr(parsed.cidr)) - 1) >>> 0;
  const total = Math.min(Math.max(last - first + 1, 0), maxLimit);
  return Array.from({ length: total }, (_, i) => formatIPv4((first + i) >>> 0));
}

function emptyScanRow(ip: string, method: string) {
  return {
    IP: ip,
    Status: 'No response',
    'Response Time': '-',
    'Open Ports': '-',
    MAC: 'Unavailable',
    Vendor: 'Unavailable',
    Method: method,
  };
}

function ipInfo(ipInput: string, cidrInput: string) {
  const cidr = Number(cidrInput);
  const parsed = parseNetwork(ipInput, cidr);
  if (!parsed) return null;
  const wildcard = wildcardFromCidr(parsed.cidr);
  const broadcast = (parsed.network | wildcard) >>> 0;
  const total = parsed.cidr === 32 ? 1 : Math.pow(2, 32 - parsed.cidr);
  const usable = parsed.cidr >= 31 ? total : Math.max(total - 2, 0);
  return {
    'Network Address': formatIPv4(parsed.network),
    'Broadcast Address': formatIPv4(broadcast),
    'Subnet Mask': formatIPv4(parsed.mask),
    'Wildcard Mask': formatIPv4(wildcard),
    CIDR: `/${parsed.cidr}`,
    'Total Hosts': total.toLocaleString(),
    'Usable Hosts': usable.toLocaleString(),
    'First Host': parsed.cidr >= 31 ? formatIPv4(parsed.network) : formatIPv4((parsed.network + 1) >>> 0),
    'Last Host': parsed.cidr >= 31 ? formatIPv4(broadcast) : formatIPv4((broadcast - 1) >>> 0),
  };
}

function splitSubnets(networkInput: string, countInput: string) {
  const parsed = parseNetwork(networkInput);
  const count = Number(countInput);
  if (!parsed || !Number.isInteger(count) || count < 1) return [];
  const bits = Math.ceil(Math.log2(count));
  const newCidr = parsed.cidr + bits;
  if (newCidr > 32) return [];
  const block = Math.pow(2, 32 - newCidr);
  return Array.from({ length: count }, (_, i) => `${formatIPv4((parsed.network + i * block) >>> 0)}/${newCidr}`);
}

function hostToCidr(hosts: number) {
  const needed = hosts <= 1 ? 2 : hosts + 2;
  const bits = Math.ceil(Math.log2(needed));
  return 32 - bits;
}

function summarizeNetworks(values: string[]) {
  const nets = values.map(v => parseNetwork(v)).filter(Boolean) as Array<{ network: number; cidr: number; mask: number }>;
  if (nets.length === 0) return null;
  let min = Math.min(...nets.map(n => n.network));
  let max = Math.max(...nets.map(n => (n.network | wildcardFromCidr(n.cidr)) >>> 0));
  let diff = (min ^ max) >>> 0;
  let prefix = 32;
  while (diff > 0) {
    prefix--;
    diff = diff >>> 1;
  }
  const mask = maskFromCidr(prefix);
  const network = (min & mask) >>> 0;
  return { route: `${formatIPv4(network)}/${prefix}`, mask: formatIPv4(mask), network: formatIPv4(network), cidr: prefix };
}

function expandIPv6(address: string) {
  const value = address.trim().toLowerCase();
  if (!value.includes(':')) return null;
  const parts = value.split('::');
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  if ([...left, ...right].some(p => !/^[0-9a-f]{0,4}$/.test(p))) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [...left, ...Array(missing).fill('0'), ...right].map(p => p.padStart(4, '0')).join(':');
}

function compressIPv6(expanded: string) {
  const parts = expanded.split(':').map(p => p.replace(/^0+/, '') || '0');
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  parts.forEach((p, i) => {
    if (p === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
    } else {
      curStart = -1; curLen = 0;
    }
  });
  if (bestLen < 2) return parts.join(':');
  const before = parts.slice(0, bestStart).join(':');
  const after = parts.slice(bestStart + bestLen).join(':');
  return `${before}::${after}`.replace(/^:/, '::').replace(/:$/, '::');
}

function classifyIPv6(expanded: string) {
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return 'Loopback';
  if (expanded.startsWith('fe80')) return 'Link-local';
  if (/^f[cd]/.test(expanded)) return 'Unique local';
  if (/^ff/.test(expanded)) return 'Multicast';
  if (expanded.startsWith('0000:0000:0000:0000:0000:0000:0000:0000')) return 'Unspecified';
  return 'Global unicast or routable';
}

function ipv6Info(address: string, prefix: string) {
  const expanded = expandIPv6(address);
  const p = Number(prefix);
  if (!expanded || !Number.isInteger(p) || p < 0 || p > 128) return null;
  const hextets = expanded.split(':');
  const whole = Math.floor(p / 16);
  const remainder = p % 16;
  const network = hextets.map((h, i) => {
    if (i < whole) return h;
    if (i > whole || remainder === 0) return '0000';
    const value = parseInt(h, 16);
    const mask = (0xffff << (16 - remainder)) & 0xffff;
    return (value & mask).toString(16).padStart(4, '0');
  }).join(':');
  return {
    'Expanded Address': expanded,
    'Compressed Address': compressIPv6(expanded),
    Prefix: `/${p}`,
    'Address Type': classifyIPv6(expanded),
    'Network Prefix': `${compressIPv6(network)}/${p}`,
  };
}

async function copyText(text: string) {
  await Clipboard.setStringAsync(text);
}

async function exportText(name: string, text: string) {
  const uri = `${FileSystem.cacheDirectory}${name}-${Date.now()}.txt`;
  await FileSystem.writeAsStringAsync(uri, text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
}

function resultText(rows: Record<string, string | number>[]) {
  return rows.map(row => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join('\n')).join('\n\n');
}

function useCustomRows<T extends Record<string, string>>(key: string, defaults: T[]) {
  const [rows, setRows] = useState<T[]>(defaults);

  useEffect(() => {
    let mounted = true;
    FileSystem.readAsStringAsync(customDataFile)
      .then(content => {
        const parsed = JSON.parse(content);
        if (mounted && Array.isArray(parsed?.[key])) {
          setRows([...defaults, ...parsed[key]]);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [key]);

  const saveCustom = async (customRows: T[]) => {
    let existing: Record<string, T[]> = {};
    try {
      existing = JSON.parse(await FileSystem.readAsStringAsync(customDataFile));
    } catch {}
    existing[key] = customRows;
    await FileSystem.writeAsStringAsync(customDataFile, JSON.stringify(existing, null, 2));
    setRows([...defaults, ...customRows]);
  };

  const customRows = rows.slice(defaults.length);
  return { rows, customRows, saveCustom };
}

async function readToolStateFile() {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(toolStateFile));
  } catch {
    return {};
  }
}

function usePersistedToolState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    readToolStateFile().then(existing => {
      if (mounted && existing?.[key] !== undefined) setValue(existing[key]);
      if (mounted) setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    readToolStateFile().then(existing => {
      existing[key] = value;
      FileSystem.writeAsStringAsync(toolStateFile, JSON.stringify(existing, null, 2)).catch(() => {});
    });
  }, [key, loaded, value]);

  return [value, setValue, loaded] as const;
}

function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.gray500}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function SmallButton({ label, icon, onPress, tone = 'default', disabled = false }: {
  label: string;
  icon?: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallBtn, tone === 'primary' && styles.primaryBtn, tone === 'danger' && styles.dangerBtn, disabled && styles.disabled]}
    >
      {icon ? <Ionicons name={icon as any} size={13} color={tone === 'default' ? theme.colors.white : '#fff'} /> : null}
      <Text style={[styles.smallBtnText, tone !== 'default' && styles.primaryBtnText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultRows({ rows }: { rows: Array<{ label: string; value: string | number }> }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.resultCard}>
      {rows.map(row => (
        <View key={row.label} style={styles.resultRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultLabel}>{row.label}</Text>
            <Text style={styles.resultValue}>{row.value}</Text>
          </View>
          <TouchableOpacity onPress={() => copyText(String(row.value))} style={styles.copyIcon}>
            <Ionicons name="copy-outline" size={14} color={theme.colors.gray400} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function IPTool() {
  const [state, setState] = usePersistedToolState('ip-calculator', { ip: '192.168.1.10', cidr: '24' });
  const { ip, cidr } = state;
  const setIp = (ip: string) => setState(prev => ({ ...prev, ip }));
  const setCidr = (cidr: string) => setState(prev => ({ ...prev, cidr }));
  const info = ipInfo(ip, cidr);
  const rows = info ? Object.entries(info).map(([label, value]) => ({ label, value })) : [];
  return (
    <ToolShell>
      <Field label="IP Address" value={ip} onChangeText={setIp} placeholder="192.168.1.10" />
      <Field label="CIDR" value={cidr} onChangeText={setCidr} placeholder="24" keyboardType="numeric" />
      {rows.length ? <ResultRows rows={rows} /> : <Empty message="Enter a valid IPv4 address and CIDR." />}
      <SmallButton label="Copy All" icon="copy-outline" tone="primary" onPress={() => copyText(rows.map(r => `${r.label}: ${r.value}`).join('\n'))} disabled={!rows.length} />
    </ToolShell>
  );
}

function SubnetTool() {
  const [state, setState] = usePersistedToolState('subnet-calculator', { network: '10.10.0.0/24', count: '4' });
  const { network, count } = state;
  const setNetwork = (network: string) => setState(prev => ({ ...prev, network }));
  const setCount = (count: string) => setState(prev => ({ ...prev, count }));
  const subnets = splitSubnets(network, count);
  return (
    <ToolShell>
      <Field label="Network / CIDR" value={network} onChangeText={setNetwork} placeholder="10.10.0.0/24" />
      <Field label="Number of Subnets" value={count} onChangeText={setCount} keyboardType="numeric" />
      <List rows={subnets.map(s => ({ title: s, subtitle: 'Generated subnet' }))} />
      <ActionRow text={subnets.join('\n')} name="subnets" />
    </ToolShell>
  );
}

function VLSMTool() {
  const [state, setState] = usePersistedToolState('vlsm-calculator', {
    base: '10.10.0.0/24',
    groups: [
    { name: 'Users', hosts: '60' },
    { name: 'Voice', hosts: '30' },
    { name: 'Servers', hosts: '12' },
    ],
  });
  const { base, groups } = state;
  const setBase = (base: string) => setState(prev => ({ ...prev, base }));
  const setGroups = (updater: React.SetStateAction<Array<{ name: string; hosts: string }>>) => setState(prev => ({ ...prev, groups: typeof updater === 'function' ? updater(prev.groups) : updater }));
  const rows = useMemo(() => {
    const parsed = parseNetwork(base);
    if (!parsed) return [];
    let cursor = parsed.network;
    const sorted = groups
      .map(g => ({ ...g, hostNum: Number(g.hosts) }))
      .filter(g => g.name.trim() && Number.isFinite(g.hostNum) && g.hostNum > 0)
      .sort((a, b) => b.hostNum - a.hostNum);
    return sorted.map(g => {
      const cidr = hostToCidr(g.hostNum);
      const size = Math.pow(2, 32 - cidr);
      const network = cursor;
      const broadcast = (network + size - 1) >>> 0;
      cursor = (cursor + size) >>> 0;
      return {
        Name: g.name,
        Network: `${formatIPv4(network)}/${cidr}`,
        Mask: formatIPv4(maskFromCidr(cidr)),
        Range: cidr >= 31 ? `${formatIPv4(network)} - ${formatIPv4(broadcast)}` : `${formatIPv4((network + 1) >>> 0)} - ${formatIPv4((broadcast - 1) >>> 0)}`,
        Broadcast: formatIPv4(broadcast),
        Required: g.hostNum,
        Available: cidr >= 31 ? size : size - 2,
      };
    });
  }, [base, groups]);
  return (
    <ToolShell>
      <Field label="Base Network" value={base} onChangeText={setBase} placeholder="10.10.0.0/24" />
      {groups.map((g, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Name" value={g.name} onChangeText={v => setGroups(prev => prev.map((x, idx) => idx === i ? { ...x, name: v } : x))} /></View>
          <View style={{ width: 100 }}><Field label="Hosts" value={g.hosts} onChangeText={v => setGroups(prev => prev.map((x, idx) => idx === i ? { ...x, hosts: v } : x))} keyboardType="numeric" /></View>
          <SmallButton label="" icon="trash-outline" tone="danger" onPress={() => setGroups(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add Group" icon="add-outline" onPress={() => setGroups(prev => [...prev, { name: '', hosts: '' }])} />
      <Table rows={rows} />
      <ActionRow text={resultText(rows)} name="vlsm-allocation" />
    </ToolShell>
  );
}

function RouteSummaryTool({ configMode = false }: { configMode?: boolean }) {
  const [input, setInput] = usePersistedToolState(configMode ? 'route-summary-config' : 'route-summary', '10.10.0.0/24\n10.10.1.0/24\n10.10.2.0/24\n10.10.3.0/24');
  const summary = summarizeNetworks(input.split(/\n|,/).map(v => v.trim()).filter(Boolean));
  const text = summary ? [
    `Summary Route: ${summary.route}`,
    `Subnet Mask: ${summary.mask}`,
    configMode ? `Cisco Example: ip route ${summary.network} ${summary.mask} <next-hop>` : `Cisco Example: network ${summary.network} mask ${summary.mask}`,
  ].join('\n') : '';
  return (
    <ToolShell>
      <Field label="Networks" value={input} onChangeText={setInput} multiline placeholder="One network per line" />
      {summary ? (
        <ResultRows rows={[
          { label: 'Summarized Route', value: summary.route },
          { label: 'Subnet Mask', value: summary.mask },
          { label: 'Cisco Example', value: configMode ? `ip route ${summary.network} ${summary.mask} <next-hop>` : `network ${summary.network} mask ${summary.mask}` },
        ]} />
      ) : <Empty message="Enter valid IPv4 networks." />}
      <ActionRow text={text} name="route-summary" />
    </ToolShell>
  );
}

function IPv6Tool() {
  const [state, setState] = usePersistedToolState('ipv6-calculator', { address: '2001:db8::10', prefix: '64' });
  const { address, prefix } = state;
  const setAddress = (address: string) => setState(prev => ({ ...prev, address }));
  const setPrefix = (prefix: string) => setState(prev => ({ ...prev, prefix }));
  const info = ipv6Info(address, prefix);
  const rows = info ? Object.entries(info).map(([label, value]) => ({ label, value })) : [];
  return (
    <ToolShell>
      <Field label="IPv6 Address" value={address} onChangeText={setAddress} />
      <Field label="Prefix Length" value={prefix} onChangeText={setPrefix} keyboardType="numeric" />
      {rows.length ? <ResultRows rows={rows} /> : <Empty message="Enter a valid IPv6 address and prefix." />}
      <SmallButton label="Copy All" icon="copy-outline" tone="primary" onPress={() => copyText(rows.map(r => `${r.label}: ${r.value}`).join('\n'))} disabled={!rows.length} />
    </ToolShell>
  );
}

function LANScannerTool() {
  const [state, setState, stateLoaded] = usePersistedToolState('lan-scanner', { subnet: '192.168.1.1-192.168.1.32', limit: '64', ports: '22,80,443,3389,8080' });
  const { subnet, limit, ports } = state;
  const setSubnet = (subnet: string) => setState(prev => ({ ...prev, subnet }));
  const setLimit = (limit: string) => setState(prev => ({ ...prev, limit }));
  const setPorts = (ports: string) => setState(prev => ({ ...prev, ports }));
  const [networkInfo, setNetworkInfo] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState('Ready');
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [scanToken, setScanToken] = useState(0);

  useEffect(() => {
    if (!stateLoaded) return;
    let mounted = true;
    getNativeLanNetworkInfo()
      .then(({ available, info }) => {
        if (!mounted || !available || !info.ip) return;
        const detectedTarget = info.subnet || info.range;
        setNetworkInfo([
          `Detected: ${info.ip}${info.cidr ? `/${info.cidr}` : ''}`,
          info.gateway ? `Gateway ${info.gateway}` : '',
          info.ssid ? `SSID ${info.ssid}` : '',
        ].filter(Boolean).join(' | '));
        if (detectedTarget && subnet === '192.168.1.1-192.168.1.32') {
          setSubnet(detectedTarget);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [stateLoaded]);

  const scan = async () => {
    const targets = parseScanTargets(subnet, limit);
    const portList = ports.split(',').map(p => Number(p.trim())).filter(p => Number.isInteger(p) && p > 0 && p < 65536);
    if (!targets.length) return;
    const token = scanToken + 1;
    setScanToken(token);
    setScanning(true);
    setRows([]);
    setScanMode(`Scanning 0/${targets.length}`);
    const results: Array<Record<string, string>> = [];

    try {
      const probe = await scanNativeLan(targets[0], 1, ports);
      if (probe.available) {
        if (probe.rows[0]) {
          results.push({ ...probe.rows[0] });
          setRows([...results]);
        }
        for (let i = 1; i < targets.length; i++) {
          setScanMode(`Native Android scan ${i}/${targets.length}`);
          const nativeResult = await scanNativeLan(targets[i], 1, ports);
          if (nativeResult.rows[0]) {
            results.push({ ...nativeResult.rows[0] });
          } else {
            results.push(emptyScanRow(targets[i], 'Native Android'));
          }
          setRows([...results]);
        }
        setScanMode(`Complete: ${results.length} checked`);
        setScanning(false);
        return;
      }
    } catch {
      setScanMode('Native failed, using Lite fallback');
    }

    setScanMode('Expo Lite fallback');
    for (const ip of targets) {
      const t = Date.now();
      let reachable = false;
      const open: number[] = [];
      for (const port of portList) {
        try {
          await Promise.race([
            fetch(`http${port === 443 ? 's' : ''}://${ip}:${port}`, { method: 'HEAD' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 550)),
          ]);
          reachable = true;
          open.push(port);
        } catch {}
      }
      results.push({
        IP: ip,
        Status: reachable ? 'Reachable' : 'No web response',
        'Response Time': `${Date.now() - t} ms`,
        'Open Ports': open.length ? open.join(', ') : '-',
        MAC: 'Unavailable',
        Vendor: 'Unavailable',
        Method: 'Expo Lite',
      });
      setRows([...results]);
      setScanMode(`Expo Lite scan ${results.length}/${targets.length}`);
    }
    setScanMode(`Complete: ${results.length} checked`);
    setScanning(false);
  };
  return (
    <ToolShell>
      <Field label="Subnet / CIDR or Range" value={subnet} onChangeText={setSubnet} placeholder="192.168.30.0/24 or 192.168.30.1-192.168.30.254" />
      <Field label="Scan Limit" value={limit} onChangeText={setLimit} keyboardType="numeric" />
      <Field label="Ports to Check" value={ports} onChangeText={setPorts} placeholder="80,443,8080" />
      {networkInfo ? <TextHint text={networkInfo} /> : null}
      <TextHint text={`Mode: ${scanMode}. Native Android scan uses reachability, TCP connect checks, and ARP/neighbour table where Android exposes it. MAC/vendor may still show unavailable on newer Android versions or before the phone has talked to that device. Common ports: ${commonPorts.join(', ')}.`} />
      <SmallButton label={scanning ? 'Scanning...' : 'Scan'} icon="radio-outline" tone="primary" onPress={scan} disabled={scanning} />
      {scanning ? <ActivityIndicator color={colors.blue400} /> : null}
      <Table rows={rows} />
      <ActionRow text={resultText(rows)} name="lan-scan" />
    </ToolShell>
  );
}

function ACLBuilder() {
  const [state, setState] = usePersistedToolState('acl-builder', {
    vendor: 'Cisco',
    acl: '101',
    rules: [{ action: 'permit', protocol: 'tcp', source: '192.168.10.0 0.0.0.255', dest: 'any', port: '443' }],
  });
  const { vendor, acl, rules } = state;
  const setVendor = (vendor: string) => setState(prev => ({ ...prev, vendor }));
  const setAcl = (acl: string) => setState(prev => ({ ...prev, acl }));
  const setRules = (updater: React.SetStateAction<Array<{ action: string; protocol: string; source: string; dest: string; port: string }>>) => setState(prev => ({ ...prev, rules: typeof updater === 'function' ? updater(prev.rules) : updater }));
  const lines = vendor === 'Aruba'
    ? [
        `ip access-list ${acl || 'ACL-NAME'}`,
        ...rules.map(r => ` ${r.action || 'permit'} ${r.protocol || 'ip'} ${r.source || 'any'} ${r.dest || 'any'}${r.port ? ` eq ${r.port}` : ''}`),
        ' exit',
      ]
    : rules.map(r => `access-list ${acl} ${r.action || 'permit'} ${r.protocol || 'ip'} ${r.source || 'any'} ${r.dest || 'any'}${r.port ? ` eq ${r.port}` : ''}`);
  return (
    <ToolShell>
      <Tabs tabs={['Cisco', 'Aruba']} active={vendor} setActive={setVendor} />
      <Field label={vendor === 'Aruba' ? 'ACL Name' : 'ACL Number/Name'} value={acl} onChangeText={setAcl} />
      {rules.map((r, i) => <RuleEditor key={i} rule={r} onChange={next => setRules(prev => prev.map((x, idx) => idx === i ? next : x))} onDelete={() => setRules(prev => prev.filter((_, idx) => idx !== i))} />)}
      <SmallButton label="Add Rule" icon="add-outline" onPress={() => setRules(prev => [...prev, { action: 'permit', protocol: 'ip', source: 'any', dest: 'any', port: '' }])} />
      <CodeBlock code={lines.join('\n')} />
    </ToolShell>
  );
}

function RuleEditor({ rule, onChange, onDelete }: { rule: any; onChange: (rule: any) => void; onDelete: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Action" value={rule.action} onChangeText={v => onChange({ ...rule, action: v })} /></View>
        <View style={{ flex: 1 }}><Field label="Protocol" value={rule.protocol} onChangeText={v => onChange({ ...rule, protocol: v })} /></View>
      </View>
      <Field label="Source" value={rule.source} onChangeText={v => onChange({ ...rule, source: v })} />
      <Field label="Destination" value={rule.dest} onChangeText={v => onChange({ ...rule, dest: v })} />
      <Field label="Port" value={rule.port} onChangeText={v => onChange({ ...rule, port: v })} />
      <SmallButton label="Remove Rule" icon="trash-outline" tone="danger" onPress={onDelete} />
    </View>
  );
}

function VLANPlanner() {
  const [tab, setTab] = usePersistedToolState('vlan-planner-tab', 'Cisco');
  const [vlans, setVlans] = usePersistedToolState('vlan-planner', [{ id: '10', name: 'USERS', subnet: '10.10.10.0/24', gateway: '10.10.10.1' }]);
  const outputs: Record<string, string> = {
    Cisco: vlans.map(v => `vlan ${v.id}\n name ${v.name}\ninterface vlan ${v.id}\n ip address ${v.gateway} ${parseNetwork(v.subnet)?.mask !== undefined ? formatIPv4(parseNetwork(v.subnet)!.mask) : '<mask>'}`).join('\n\n'),
    Aruba: vlans.map(v => `vlan ${v.id}\n name "${v.name}"\ninterface vlan ${v.id}\n ip address ${v.gateway}/${parseNetwork(v.subnet)?.cidr ?? '<cidr>'}`).join('\n\n'),
    Fortinet: vlans.map(v => `config system interface\n edit "vlan${v.id}_${v.name}"\n  set vlanid ${v.id}\n  set ip ${v.gateway}/${parseNetwork(v.subnet)?.cidr ?? '<cidr>'}\n next\nend`).join('\n\n'),
    Summary: vlans.map(v => `VLAN ${v.id} | ${v.name} | ${v.subnet} | GW ${v.gateway}`).join('\n'),
  };
  return (
    <ToolShell>
      {vlans.map((v, i) => <VLANRow key={i} vlan={v} onChange={next => setVlans(prev => prev.map((x, idx) => idx === i ? next : x))} onDelete={() => setVlans(prev => prev.filter((_, idx) => idx !== i))} />)}
      <SmallButton label="Add VLAN" icon="add-outline" onPress={() => setVlans(prev => [...prev, { id: '', name: '', subnet: '', gateway: '' }])} />
      <Tabs tabs={Object.keys(outputs)} active={tab} setActive={setTab} />
      <CodeBlock code={outputs[tab]} />
    </ToolShell>
  );
}

function VLANRow({ vlan, onChange, onDelete }: { vlan: any; onChange: (v: any) => void; onDelete: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ width: 84 }}><Field label="VLAN" value={vlan.id} onChangeText={v => onChange({ ...vlan, id: v })} /></View>
        <View style={{ flex: 1 }}><Field label="Name" value={vlan.name} onChangeText={v => onChange({ ...vlan, name: v })} /></View>
      </View>
      <Field label="Subnet" value={vlan.subnet} onChangeText={v => onChange({ ...vlan, subnet: v })} />
      <Field label="Gateway" value={vlan.gateway} onChangeText={v => onChange({ ...vlan, gateway: v })} />
      <SmallButton label="Remove VLAN" icon="trash-outline" tone="danger" onPress={onDelete} />
    </View>
  );
}

function StaticRouteBuilder() {
  const [routes, setRoutes] = usePersistedToolState('static-route', [{ destination: '10.20.0.0/16', nextHop: '10.10.10.254', distance: '' }]);
  const lines = routes.map(r => {
    const parsed = parseNetwork(r.destination);
    return `ip route ${parsed ? formatIPv4(parsed.network) : r.destination.replace(/\/.*/, '')} ${parsed ? formatIPv4(parsed.mask) : '<mask>'} ${r.nextHop}${r.distance ? ` ${r.distance}` : ''}`;
  });
  return (
    <ToolShell>
      {routes.map((route, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="Destination Network" value={route.destination} onChangeText={v => setRoutes(prev => prev.map((r, idx) => idx === i ? { ...r, destination: v } : r))} />
          <Field label="Next Hop" value={route.nextHop} onChangeText={v => setRoutes(prev => prev.map((r, idx) => idx === i ? { ...r, nextHop: v } : r))} />
          <Field label="Administrative Distance" value={route.distance} onChangeText={v => setRoutes(prev => prev.map((r, idx) => idx === i ? { ...r, distance: v } : r))} />
          <SmallButton label="Remove Route" icon="trash-outline" tone="danger" onPress={() => setRoutes(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add Route" icon="add-outline" onPress={() => setRoutes(prev => [...prev, { destination: '', nextHop: '', distance: '' }])} />
      <CodeBlock code={lines.join('\n')} />
    </ToolShell>
  );
}

function PrefixListBuilder() {
  const [rows, setRows] = usePersistedToolState('prefix-list', [{ name: 'PL-BRANCH', seq: '10', action: 'permit', prefix: '10.20.0.0/16', ge: '', le: '' }]);
  const lines = rows.map(r => `ip prefix-list ${r.name} seq ${r.seq} ${r.action} ${r.prefix}${r.ge ? ` ge ${r.ge}` : ''}${r.le ? ` le ${r.le}` : ''}`);
  return (
    <ToolShell>
      {rows.map((row, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="List Name" value={row.name} onChangeText={v => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, name: v } : r))} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Sequence" value={row.seq} onChangeText={v => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, seq: v } : r))} /></View>
            <View style={{ flex: 1 }}><Field label="Action" value={row.action} onChangeText={v => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, action: v } : r))} /></View>
          </View>
          <Field label="Prefix" value={row.prefix} onChangeText={v => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, prefix: v } : r))} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="GE" value={row.ge} onChangeText={v => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ge: v } : r))} /></View>
            <View style={{ flex: 1 }}><Field label="LE" value={row.le} onChangeText={v => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, le: v } : r))} /></View>
          </View>
          <SmallButton label="Remove Entry" icon="trash-outline" tone="danger" onPress={() => setRows(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add Prefix Entry" icon="add-outline" onPress={() => setRows(prev => [...prev, { name: 'PL-BRANCH', seq: String((prev.length + 1) * 10), action: 'permit', prefix: '', ge: '', le: '' }])} />
      <CodeBlock code={lines.join('\n')} />
    </ToolShell>
  );
}

function BGPBuilder() {
  const [state, setState] = usePersistedToolState('bgp-builder', {
    asn: '65001',
    routerId: '10.255.255.1',
    neighbors: [{ ip: '10.10.10.2', remoteAs: '65002', description: 'WAN-PEER' }],
    networks: ['10.20.0.0/16'],
  });
  const { asn, routerId, neighbors, networks } = state;
  const setAsn = (asn: string) => setState(prev => ({ ...prev, asn }));
  const setRouterId = (routerId: string) => setState(prev => ({ ...prev, routerId }));
  const setNeighbors = (updater: React.SetStateAction<Array<{ ip: string; remoteAs: string; description: string }>>) => setState(prev => ({ ...prev, neighbors: typeof updater === 'function' ? updater(prev.neighbors) : updater }));
  const setNetworks = (updater: React.SetStateAction<string[]>) => setState(prev => ({ ...prev, networks: typeof updater === 'function' ? updater(prev.networks) : updater }));
  const lines = [
    `router bgp ${asn}`,
    ` bgp router-id ${routerId}`,
    ...neighbors.flatMap(n => [
      ` neighbor ${n.ip} remote-as ${n.remoteAs}`,
      n.description ? ` neighbor ${n.ip} description ${n.description}` : '',
    ].filter(Boolean)),
    ...networks.map(n => {
      const parsed = parseNetwork(n);
      return parsed ? ` network ${formatIPv4(parsed.network)} mask ${formatIPv4(parsed.mask)}` : ` network ${n}`;
    }),
  ];
  return (
    <ToolShell>
      <Field label="Local ASN" value={asn} onChangeText={setAsn} />
      <Field label="Router ID" value={routerId} onChangeText={setRouterId} />
      {neighbors.map((n, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="Neighbor IP" value={n.ip} onChangeText={v => setNeighbors(prev => prev.map((x, idx) => idx === i ? { ...x, ip: v } : x))} />
          <Field label="Remote AS" value={n.remoteAs} onChangeText={v => setNeighbors(prev => prev.map((x, idx) => idx === i ? { ...x, remoteAs: v } : x))} />
          <Field label="Description" value={n.description} onChangeText={v => setNeighbors(prev => prev.map((x, idx) => idx === i ? { ...x, description: v } : x))} />
          <SmallButton label="Remove Neighbor" icon="trash-outline" tone="danger" onPress={() => setNeighbors(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add Neighbor" icon="add-outline" onPress={() => setNeighbors(prev => [...prev, { ip: '', remoteAs: '', description: '' }])} />
      {networks.map((n, i) => <Field key={i} label={`Network ${i + 1}`} value={n} onChangeText={v => setNetworks(prev => prev.map((x, idx) => idx === i ? v : x))} />)}
      <SmallButton label="Add Network" icon="add-outline" onPress={() => setNetworks(prev => [...prev, ''])} />
      <CodeBlock code={lines.filter(Boolean).join('\n')} />
    </ToolShell>
  );
}

function SimpleConfigTool({ kind }: { kind: 'static' | 'prefix' | 'redundancy' | 'ospf' | 'dhcp' }) {
  const [state, setState] = useState<Record<string, string>>({
    destination: '10.20.0.0/16', nextHop: '10.10.10.254', distance: '',
    name: 'PL-BRANCH', seq: '10', action: 'permit', prefix: '10.20.0.0/16', ge: '', le: '',
    protocol: 'HSRP', interface: 'Vlan10', vip: '10.10.10.1', priority: '110', group: '10', preempt: 'yes',
    process: '1', network: '10.10.0.0', wildcard: '0.0.255.255', area: '0',
    pool: 'USERS', dhcpNetwork: '10.10.10.0', mask: '255.255.255.0', gateway: '10.10.10.1', dns: '8.8.8.8 1.1.1.1', excluded: '10.10.10.1 10.10.10.20',
  });
  const set = (k: string, v: string) => setState(prev => ({ ...prev, [k]: v }));
  const staticParsed = parseNetwork(state.destination);
  const code = kind === 'static'
    ? `ip route ${staticParsed ? formatIPv4(staticParsed.network) : state.destination.replace(/\/.*/, '')} ${staticParsed ? formatIPv4(staticParsed.mask) : '<mask>'} ${state.nextHop}${state.distance ? ` ${state.distance}` : ''}`
    : kind === 'prefix'
      ? `ip prefix-list ${state.name} seq ${state.seq} ${state.action} ${state.prefix}${state.ge ? ` ge ${state.ge}` : ''}${state.le ? ` le ${state.le}` : ''}`
      : kind === 'redundancy'
        ? `${state.protocol.toUpperCase() === 'VRRP' ? 'vrrp' : state.protocol.toUpperCase() === 'GLBP' ? 'glbp' : 'standby'} ${state.group} ip ${state.vip}\n${state.protocol.toUpperCase() === 'VRRP' ? 'vrrp' : state.protocol.toUpperCase() === 'GLBP' ? 'glbp' : 'standby'} ${state.group} priority ${state.priority}${state.preempt.toLowerCase().startsWith('y') ? `\n${state.protocol.toUpperCase() === 'VRRP' ? 'vrrp' : state.protocol.toUpperCase() === 'GLBP' ? 'glbp' : 'standby'} ${state.group} preempt` : ''}`
        : kind === 'ospf'
          ? `router ospf ${state.process}\n network ${state.network} ${state.wildcard} area ${state.area}`
          : `ip dhcp excluded-address ${state.excluded}\nip dhcp pool ${state.pool}\n network ${state.dhcpNetwork} ${state.mask}\n default-router ${state.gateway}\n dns-server ${state.dns}`;
  return (
    <ToolShell>
      {kind === 'static' && <>
        <Field label="Destination Network" value={state.destination} onChangeText={v => set('destination', v)} />
        <Field label="Next Hop" value={state.nextHop} onChangeText={v => set('nextHop', v)} />
        <Field label="Administrative Distance" value={state.distance} onChangeText={v => set('distance', v)} />
      </>}
      {kind === 'prefix' && <>
        <Field label="List Name" value={state.name} onChangeText={v => set('name', v)} />
        <Field label="Sequence" value={state.seq} onChangeText={v => set('seq', v)} />
        <Field label="Action" value={state.action} onChangeText={v => set('action', v)} />
        <Field label="Prefix" value={state.prefix} onChangeText={v => set('prefix', v)} />
        <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Field label="GE" value={state.ge} onChangeText={v => set('ge', v)} /></View><View style={{ flex: 1 }}><Field label="LE" value={state.le} onChangeText={v => set('le', v)} /></View></View>
      </>}
      {kind === 'redundancy' && <>
        <Field label="Protocol" value={state.protocol} onChangeText={v => set('protocol', v)} placeholder="HSRP, VRRP, GLBP" />
        <Field label="Interface" value={state.interface} onChangeText={v => set('interface', v)} />
        <Field label="Group Number" value={state.group} onChangeText={v => set('group', v)} />
        <Field label="Virtual IP" value={state.vip} onChangeText={v => set('vip', v)} />
        <Field label="Priority" value={state.priority} onChangeText={v => set('priority', v)} />
        <Field label="Preempt" value={state.preempt} onChangeText={v => set('preempt', v)} />
      </>}
      {kind === 'ospf' && <>
        <Field label="Process ID" value={state.process} onChangeText={v => set('process', v)} />
        <Field label="Network" value={state.network} onChangeText={v => set('network', v)} />
        <Field label="Wildcard Mask" value={state.wildcard} onChangeText={v => set('wildcard', v)} />
        <Field label="Area" value={state.area} onChangeText={v => set('area', v)} />
      </>}
      {kind === 'dhcp' && <>
        <Field label="Pool Name" value={state.pool} onChangeText={v => set('pool', v)} />
        <Field label="Network" value={state.dhcpNetwork} onChangeText={v => set('dhcpNetwork', v)} />
        <Field label="Subnet Mask" value={state.mask} onChangeText={v => set('mask', v)} />
        <Field label="Default Gateway" value={state.gateway} onChangeText={v => set('gateway', v)} />
        <Field label="DNS Servers" value={state.dns} onChangeText={v => set('dns', v)} />
        <Field label="Excluded Addresses" value={state.excluded} onChangeText={v => set('excluded', v)} />
      </>}
      <CodeBlock code={kind === 'redundancy' ? `interface ${state.interface}\n ${code.replace(/\n/g, '\n ')}` : code} />
    </ToolShell>
  );
}

function RedundancyBuilder() {
  const [rows, setRows] = usePersistedToolState('redundancy-builder', [
    { protocol: 'HSRP', interface: 'Vlan10', group: '10', vip: '10.10.10.1', priority: '110', preempt: 'yes' },
  ]);
  const lineFor = (row: typeof rows[number]) => {
    const keyword = row.protocol.toUpperCase() === 'VRRP' ? 'vrrp' : row.protocol.toUpperCase() === 'GLBP' ? 'glbp' : 'standby';
    return [
      `interface ${row.interface}`,
      ` ${keyword} ${row.group} ip ${row.vip}`,
      ` ${keyword} ${row.group} priority ${row.priority}`,
      row.preempt.toLowerCase().startsWith('y') ? ` ${keyword} ${row.group} preempt` : '',
    ].filter(Boolean).join('\n');
  };
  const code = rows.map(lineFor).join('\n\n');
  return (
    <ToolShell>
      {rows.map((row, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="Protocol" value={row.protocol} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, protocol: v } : x))} placeholder="HSRP, VRRP, GLBP" />
          <Field label="Interface" value={row.interface} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, interface: v } : x))} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Group" value={row.group} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, group: v } : x))} /></View>
            <View style={{ flex: 1 }}><Field label="Priority" value={row.priority} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, priority: v } : x))} /></View>
          </View>
          <Field label="Virtual IP" value={row.vip} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, vip: v } : x))} />
          <Field label="Preempt" value={row.preempt} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, preempt: v } : x))} />
          <SmallButton label="Remove Redundancy Entry" icon="trash-outline" tone="danger" onPress={() => setRows(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add Redundancy Entry" icon="add-outline" onPress={() => setRows(prev => [...prev, { protocol: 'HSRP', interface: '', group: '', vip: '', priority: '100', preempt: 'yes' }])} />
      <CodeBlock code={code} />
    </ToolShell>
  );
}

function OSPFBuilder() {
  const [state, setState] = usePersistedToolState('ospf-builder', {
    process: '1',
    routerId: '',
    rows: [{ network: '10.10.0.0', wildcard: '0.0.255.255', area: '0' }],
  });
  const code = [
    `router ospf ${state.process}`,
    state.routerId ? ` router-id ${state.routerId}` : '',
    ...state.rows.map(row => ` network ${row.network} ${row.wildcard} area ${row.area}`),
  ].filter(Boolean).join('\n');
  return (
    <ToolShell>
      <Field label="Process ID" value={state.process} onChangeText={process => setState(prev => ({ ...prev, process }))} />
      <Field label="Router ID" value={state.routerId} onChangeText={routerId => setState(prev => ({ ...prev, routerId }))} />
      {state.rows.map((row, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="Network" value={row.network} onChangeText={v => setState(prev => ({ ...prev, rows: prev.rows.map((x, idx) => idx === i ? { ...x, network: v } : x) }))} />
          <Field label="Wildcard Mask" value={row.wildcard} onChangeText={v => setState(prev => ({ ...prev, rows: prev.rows.map((x, idx) => idx === i ? { ...x, wildcard: v } : x) }))} />
          <Field label="Area" value={row.area} onChangeText={v => setState(prev => ({ ...prev, rows: prev.rows.map((x, idx) => idx === i ? { ...x, area: v } : x) }))} />
          <SmallButton label="Remove Network" icon="trash-outline" tone="danger" onPress={() => setState(prev => ({ ...prev, rows: prev.rows.filter((_, idx) => idx !== i) }))} />
        </View>
      ))}
      <SmallButton label="Add OSPF Network" icon="add-outline" onPress={() => setState(prev => ({ ...prev, rows: [...prev.rows, { network: '', wildcard: '', area: '0' }] }))} />
      <CodeBlock code={code} />
    </ToolShell>
  );
}

function DHCPBuilder() {
  const [rows, setRows] = usePersistedToolState('dhcp-builder', [
    { pool: 'USERS', network: '10.10.10.0', mask: '255.255.255.0', gateway: '10.10.10.1', dns: '8.8.8.8 1.1.1.1', excluded: '10.10.10.1 10.10.10.20' },
  ]);
  const code = rows.map(row => [
    row.excluded ? `ip dhcp excluded-address ${row.excluded}` : '',
    `ip dhcp pool ${row.pool}`,
    ` network ${row.network} ${row.mask}`,
    ` default-router ${row.gateway}`,
    row.dns ? ` dns-server ${row.dns}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  return (
    <ToolShell>
      {rows.map((row, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="Pool Name" value={row.pool} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, pool: v } : x))} />
          <Field label="Network" value={row.network} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, network: v } : x))} />
          <Field label="Subnet Mask" value={row.mask} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, mask: v } : x))} />
          <Field label="Default Gateway" value={row.gateway} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, gateway: v } : x))} />
          <Field label="DNS Servers" value={row.dns} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, dns: v } : x))} />
          <Field label="Excluded Addresses" value={row.excluded} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, excluded: v } : x))} />
          <SmallButton label="Remove DHCP Pool" icon="trash-outline" tone="danger" onPress={() => setRows(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add DHCP Pool" icon="add-outline" onPress={() => setRows(prev => [...prev, { pool: '', network: '', mask: '', gateway: '', dns: '', excluded: '' }])} />
      <CodeBlock code={code} />
    </ToolShell>
  );
}

const portRows = [
  { Port: '20/21', Protocol: 'TCP', Service: 'FTP', Description: 'File Transfer Protocol control/data' },
  { Port: '22', Protocol: 'TCP', Service: 'SSH/SCP/SFTP', Description: 'Secure shell and secure file copy' },
  { Port: '23', Protocol: 'TCP', Service: 'Telnet', Description: 'Legacy terminal access' },
  { Port: '25', Protocol: 'TCP', Service: 'SMTP', Description: 'Mail transport' },
  { Port: '53', Protocol: 'TCP/UDP', Service: 'DNS', Description: 'Name resolution and zone transfers' },
  { Port: '67/68', Protocol: 'UDP', Service: 'DHCP', Description: 'Dynamic Host Configuration Protocol' },
  { Port: '80/443', Protocol: 'TCP', Service: 'HTTP/HTTPS', Description: 'Web services and management portals' },
  { Port: '123', Protocol: 'UDP', Service: 'NTP', Description: 'Network time synchronization' },
  { Port: '161/162', Protocol: 'UDP', Service: 'SNMP', Description: 'Monitoring and traps' },
  { Port: '389/636', Protocol: 'TCP/UDP', Service: 'LDAP/LDAPS', Description: 'Directory services' },
  { Port: '445', Protocol: 'TCP', Service: 'SMB', Description: 'Windows file sharing' },
  { Port: '514', Protocol: 'UDP/TCP', Service: 'Syslog', Description: 'Logging' },
  { Port: '1812/1813', Protocol: 'UDP', Service: 'RADIUS', Description: 'Authentication and accounting' },
  { Port: '3389', Protocol: 'TCP/UDP', Service: 'RDP', Description: 'Remote Desktop Protocol' },
  { Port: '4789', Protocol: 'UDP', Service: 'VXLAN', Description: 'Overlay encapsulation' },
  { Port: '5246/5247', Protocol: 'UDP', Service: 'CAPWAP', Description: 'Wireless controller AP control/data' },
  { Port: '830', Protocol: 'TCP', Service: 'NETCONF', Description: 'Network configuration protocol' },
  { Port: '902/903', Protocol: 'TCP/UDP', Service: 'VMware', Description: 'VMware ESXi console and services' },
  { Port: '9392', Protocol: 'TCP', Service: 'Veeam', Description: 'Veeam backup console' },
  { Port: '8400-8403', Protocol: 'TCP', Service: 'Nakivo', Description: 'Nakivo transporter/director services' },
  { Port: '179', Protocol: 'TCP', Service: 'BGP', Description: 'Border Gateway Protocol' },
  { Port: '500/4500', Protocol: 'UDP', Service: 'IPsec/IKE/NAT-T', Description: 'VPN negotiation and NAT traversal' },
  { Port: '1701', Protocol: 'UDP', Service: 'L2TP', Description: 'Layer 2 tunneling protocol' },
  { Port: '1723', Protocol: 'TCP', Service: 'PPTP', Description: 'Legacy VPN control channel' },
  { Port: '2049', Protocol: 'TCP/UDP', Service: 'NFS', Description: 'Network File System' },
  { Port: '3260', Protocol: 'TCP', Service: 'iSCSI', Description: 'Storage target access' },
  { Port: '8443', Protocol: 'TCP', Service: 'Alt HTTPS', Description: 'Common appliance management portal' },
  { Port: '8883', Protocol: 'TCP', Service: 'MQTT TLS', Description: 'Secure IoT messaging' },
  { Port: '9443', Protocol: 'TCP', Service: 'VMware / Apps', Description: 'Common secure app management' },
  { Port: '5900', Protocol: 'TCP', Service: 'VNC', Description: 'Remote graphical console' },
  { Port: '69', Protocol: 'UDP', Service: 'TFTP', Description: 'Network device image/config transfer' },
  { Port: '514', Protocol: 'TCP/UDP', Service: 'Syslog', Description: 'Network logging' },
  { Port: '636', Protocol: 'TCP', Service: 'LDAPS', Description: 'Secure LDAP' },
  { Port: '989/990', Protocol: 'TCP', Service: 'FTPS', Description: 'FTP over TLS' },
  { Port: '1433', Protocol: 'TCP', Service: 'MSSQL', Description: 'Microsoft SQL Server' },
  { Port: '1521', Protocol: 'TCP', Service: 'Oracle DB', Description: 'Oracle listener' },
  { Port: '3306', Protocol: 'TCP', Service: 'MySQL', Description: 'MySQL database' },
  { Port: '5432', Protocol: 'TCP', Service: 'PostgreSQL', Description: 'PostgreSQL database' },
  { Port: '6379', Protocol: 'TCP', Service: 'Redis', Description: 'Redis database/cache' },
  { Port: '27017', Protocol: 'TCP', Service: 'MongoDB', Description: 'MongoDB database' },
];

const sfpRows = [
  { Model: 'Cisco GLC-SX-MMD', Speed: '1G', Distance: '550 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Cisco GLC-LH-SMD', Speed: '1G', Distance: '10 km', Fiber: 'SMF/MMF', Connector: 'LC', Wavelength: '1310 nm' },
  { Model: 'Cisco SFP-10G-SR', Speed: '10G', Distance: '300 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Cisco SFP-10G-LR', Speed: '10G', Distance: '10 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1310 nm' },
  { Model: 'Aruba J9150D', Speed: '10G', Distance: '300 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Aruba J9151E', Speed: '10G', Distance: '10 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1310 nm' },
  { Model: 'HPE J4858D', Speed: '1G', Distance: '550 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Generic 1000BASE-T', Speed: '1G', Distance: '100 m', Fiber: 'Copper', Connector: 'RJ45', Wavelength: 'N/A' },
  { Model: 'Cisco SFP-10G-ER', Speed: '10G', Distance: '40 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1550 nm' },
  { Model: 'Cisco SFP-10G-ZR', Speed: '10G', Distance: '80 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1550 nm' },
  { Model: 'Cisco QSFP-40G-SR4', Speed: '40G', Distance: '100/150 m', Fiber: 'MMF', Connector: 'MPO', Wavelength: '850 nm' },
  { Model: 'Cisco QSFP-40G-LR4', Speed: '40G', Distance: '10 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1310 nm' },
  { Model: 'Cisco QSFP-100G-SR4-S', Speed: '100G', Distance: '70/100 m', Fiber: 'MMF', Connector: 'MPO', Wavelength: '850 nm' },
  { Model: 'Cisco QSFP-100G-LR4-S', Speed: '100G', Distance: '10 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1310 nm' },
  { Model: 'Aruba J9152D', Speed: '10G', Distance: '40 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1550 nm' },
  { Model: 'Aruba R0Z30A', Speed: '25G', Distance: '100 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Aruba JL563A', Speed: '100G', Distance: '100 m', Fiber: 'MMF', Connector: 'MPO', Wavelength: '850 nm' },
  { Model: 'Fortinet FN-TRAN-SX', Speed: '1G', Distance: '550 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Fortinet FN-TRAN-LX', Speed: '1G', Distance: '10 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1310 nm' },
  { Model: 'Fortinet FN-TRAN-SFP+SR', Speed: '10G', Distance: '300 m', Fiber: 'MMF', Connector: 'LC', Wavelength: '850 nm' },
  { Model: 'Fortinet FN-TRAN-SFP+LR', Speed: '10G', Distance: '10 km', Fiber: 'SMF', Connector: 'LC', Wavelength: '1310 nm' },
];

const poeRows = [
  { Standard: '802.3af', Class: 'PoE', PSE: '15.4 W', PD: '12.95 W', Devices: 'Phones, basic APs, cameras' },
  { Standard: '802.3at', Class: 'PoE+', PSE: '30 W', PD: '25.5 W', Devices: 'Modern APs, PTZ cameras' },
  { Standard: '802.3bt Type 3', Class: 'PoE++', PSE: '60 W', PD: '51 W', Devices: 'High-power APs, thin clients' },
  { Standard: '802.3bt Type 4', Class: 'PoE++', PSE: '90-100 W', PD: '71-90 W', Devices: 'Displays, lighting, high draw endpoints' },
];

function ReferenceTool({ kind }: { kind: 'ports' | 'sfp' | 'poe' }) {
  const [q, setQ] = usePersistedToolState(`${kind}-reference-search`, '');
  const defaults = kind === 'ports' ? portRows : kind === 'sfp' ? sfpRows : poeRows;
  const fields = Object.keys(defaults[0]);
  const { rows, customRows, saveCustom } = useCustomRows(kind, defaults as any);
  const [draft, setDraft] = usePersistedToolState<Record<string, string>>(`${kind}-reference-draft`, Object.fromEntries(fields.map(f => [f, ''])));
  const filtered = rows.filter(row => JSON.stringify(row).toLowerCase().includes(q.toLowerCase()));
  const addCustom = async () => {
    if (!Object.values(draft).some(v => v.trim())) return;
    await saveCustom([...customRows, draft as any]);
    setDraft(Object.fromEntries(fields.map(f => [f, ''])));
  };
  const deleteCustom = async (index: number) => {
    await saveCustom(customRows.filter((_, i) => i !== index));
  };
  return (
    <ToolShell>
      <Field label="Search" value={q} onChangeText={setQ} placeholder="Search offline reference..." />
      <Table rows={filtered} />
      <SectionTitle title="Add Custom Entry" subtitle="Saved locally on this device for future use." />
      {fields.map(field => <Field key={field} label={field} value={draft[field] || ''} onChangeText={v => setDraft(prev => ({ ...prev, [field]: v }))} />)}
      <SmallButton label="Save Custom Entry" icon="save-outline" tone="primary" onPress={addCustom} />
      {customRows.length ? (
        <>
          <SectionTitle title="Custom Entries" subtitle="Only custom entries can be removed." />
          {customRows.map((row: any, i: number) => (
            <View key={i} style={{ gap: 8 }}>
              <List rows={[{ title: `Custom ${i + 1}`, subtitle: Object.values(row).join(' | ') }]} />
              <SmallButton label="Delete Custom Entry" icon="trash-outline" tone="danger" onPress={() => deleteCustom(i)} />
            </View>
          ))}
        </>
      ) : null}
      <ActionRow text={resultText(filtered as any)} name={`${kind}-reference`} />
    </ToolShell>
  );
}

function PoEBudgetCalculator() {
  const [state, setState] = usePersistedToolState('poe-budget', { budget: '370', devices: '12', perDevice: '18.5', reserve: '15' });
  const { budget, devices, perDevice, reserve } = state;
  const setBudget = (budget: string) => setState(prev => ({ ...prev, budget }));
  const setDevices = (devices: string) => setState(prev => ({ ...prev, devices }));
  const setPerDevice = (perDevice: string) => setState(prev => ({ ...prev, perDevice }));
  const setReserve = (reserve: string) => setState(prev => ({ ...prev, reserve }));
  const totalBudget = Number(budget) || 0;
  const totalLoad = (Number(devices) || 0) * (Number(perDevice) || 0);
  const reserveWatts = totalBudget * ((Number(reserve) || 0) / 100);
  const remaining = totalBudget - totalLoad - reserveWatts;
  return (
    <ToolShell>
      <Field label="Switch PoE Budget W" value={budget} onChangeText={setBudget} keyboardType="numeric" />
      <Field label="Number of Powered Devices" value={devices} onChangeText={setDevices} keyboardType="numeric" />
      <Field label="Power Per Device W" value={perDevice} onChangeText={setPerDevice} keyboardType="numeric" />
      <Field label="Reserve %" value={reserve} onChangeText={setReserve} keyboardType="numeric" />
      <ResultRows rows={[
        { label: 'Total Device Load', value: `${totalLoad.toFixed(1)} W` },
        { label: 'Reserved Headroom', value: `${reserveWatts.toFixed(1)} W` },
        { label: 'Remaining Budget', value: `${remaining.toFixed(1)} W` },
        { label: 'Status', value: remaining >= 0 ? 'Within budget' : 'Over budget' },
      ]} />
    </ToolShell>
  );
}

function WiFiReference() {
  const defaults = [
    { Band: '2.4 GHz', Range: '2412-2472 MHz', Channels: '1, 6, 11', Type: 'Non-overlap', Notes: 'Use 20 MHz only for enterprise. Avoid channel bonding.' },
    { Band: '5 GHz UNII-1', Range: '5150-5250 MHz', Channels: '36, 40, 44, 48', Type: 'Non-DFS', Notes: 'Good default indoor channels, low radar risk.' },
    { Band: '5 GHz UNII-2A', Range: '5250-5350 MHz', Channels: '52, 56, 60, 64', Type: 'DFS/Radar', Notes: 'More capacity, but clients/APs may move after radar events.' },
    { Band: '5 GHz UNII-2C/2E', Range: '5470-5725 MHz', Channels: '100-144', Type: 'DFS/Radar', Notes: 'Large channel pool, validate DFS behavior.' },
    { Band: '5 GHz UNII-3', Range: '5725-5850 MHz', Channels: '149, 153, 157, 161, 165', Type: 'Non-DFS', Notes: 'Useful for high availability and outdoor where allowed.' },
    { Band: '6 GHz', Range: '5925-7125 MHz', Channels: 'PSC 5, 21, 37...', Type: 'Wi-Fi 6E/7', Notes: 'Clean spectrum; use PSC channels for discovery.' },
    { Band: 'Channel Width', Range: 'All', Channels: '20/40/80/160 MHz', Type: 'Design', Notes: '20 MHz for density, 40 MHz balanced, 80 MHz low-density throughput.' },
  ];
  const { rows, customRows, saveCustom } = useCustomRows('wifi', defaults);
  const [draft, setDraft] = usePersistedToolState('wifi-reference-draft', { Band: '', Range: '', Channels: '', Type: '', Notes: '' });
  const deleteCustom = async (index: number) => {
    await saveCustom(customRows.filter((_, i) => i !== index));
  };
  return (
    <ToolShell>
      <Table rows={rows} />
      <TextHint text="For 2.4 GHz, avoid 40 MHz channels in most enterprise deployments. For 5 GHz, mix non-DFS and DFS based on client/radar tolerance." />
      <SectionTitle title="Add Custom WiFi Note" subtitle="Saved locally on this device." />
      {Object.keys(draft).map(k => <Field key={k} label={k} value={(draft as any)[k]} onChangeText={v => setDraft(prev => ({ ...prev, [k]: v }))} />)}
      <SmallButton label="Save Custom Note" icon="save-outline" tone="primary" onPress={async () => {
        await saveCustom([...customRows, draft]);
        setDraft({ Band: '', Range: '', Channels: '', Type: '', Notes: '' });
      }} />
      {customRows.length ? (
        <>
          <SectionTitle title="Custom WiFi Notes" subtitle="Only custom notes can be removed." />
          {customRows.map((row: any, i: number) => (
            <View key={i} style={{ gap: 8 }}>
              <List rows={[{ title: `Custom ${i + 1}`, subtitle: Object.values(row).join(' | ') }]} />
              <SmallButton label="Delete Custom Note" icon="trash-outline" tone="danger" onPress={() => deleteCustom(i)} />
            </View>
          ))}
        </>
      ) : null}
    </ToolShell>
  );
}

function RFCalculator() {
  const [state, setState] = usePersistedToolState('rf-calculator', { dbm: '20', mw: '100' });
  const { dbm, mw } = state;
  const setDbm = (dbm: string) => setState(prev => ({ ...prev, dbm }));
  const setMw = (mw: string) => setState(prev => ({ ...prev, mw }));
  const mwFromDbm = Math.pow(10, Number(dbm) / 10);
  const dbmFromMw = 10 * Math.log10(Number(mw));
  return (
    <ToolShell>
      <Field label="dBm" value={dbm} onChangeText={setDbm} keyboardType="numeric" />
      <Field label="mW" value={mw} onChangeText={setMw} keyboardType="numeric" />
      <ResultRows rows={[
        { label: 'dBm to mW', value: Number.isFinite(mwFromDbm) ? `${mwFromDbm.toFixed(3)} mW` : 'Invalid' },
        { label: 'mW to dBm', value: Number.isFinite(dbmFromMw) ? `${dbmFromMw.toFixed(2)} dBm` : 'Invalid' },
        { label: 'RSSI Guide', value: '-67 dBm voice/video, -70 dBm data, -80 dBm minimum' },
        { label: 'SNR Guide', value: '25+ dB excellent, 20 dB good, 15 dB minimum' },
      ]} />
    </ToolShell>
  );
}

function APPlanner() {
  const [state, setState] = usePersistedToolState('ap-planner', { area: '10000', users: '120', env: 'office', apps: 'data', devicesPerUser: '2' });
  const { area, users, env, apps, devicesPerUser } = state;
  const setArea = (area: string) => setState(prev => ({ ...prev, area }));
  const setUsers = (users: string) => setState(prev => ({ ...prev, users }));
  const setEnv = (env: string) => setState(prev => ({ ...prev, env }));
  const setApps = (apps: string) => setState(prev => ({ ...prev, apps }));
  const setDevicesPerUser = (devicesPerUser: string) => setState(prev => ({ ...prev, devicesPerUser }));
  const envFactor = env.toLowerCase().includes('warehouse') ? 3500 : env.toLowerCase().includes('dense') ? 1500 : env.toLowerCase().includes('open') ? 3000 : 2200;
  const appFactor = apps.toLowerCase().includes('voice') || apps.toLowerCase().includes('video') ? 25 : 35;
  const byArea = Math.ceil((Number(area) || 0) / envFactor);
  const clientCount = (Number(users) || 0) * (Number(devicesPerUser) || 1);
  const byUsers = Math.ceil(clientCount / appFactor);
  const apCount = Math.max(byArea, byUsers, 1);
  return (
    <ToolShell>
      <Field label="Area Size sq ft" value={area} onChangeText={setArea} keyboardType="numeric" />
      <Field label="User Count" value={users} onChangeText={setUsers} keyboardType="numeric" />
      <Field label="Environment Type" value={env} onChangeText={setEnv} placeholder="office, dense, warehouse" />
      <Field label="Application Type" value={apps} onChangeText={setApps} placeholder="data, voice, video" />
      <Field label="Devices Per User" value={devicesPerUser} onChangeText={setDevicesPerUser} keyboardType="numeric" />
      <ResultRows rows={[
        { label: 'Estimated AP Count', value: apCount },
        { label: 'Estimated Clients', value: clientCount },
        { label: 'Channel Width', value: env.toLowerCase().includes('dense') ? '20 MHz recommended' : '20/40 MHz recommended' },
        { label: 'Coverage Recommendation', value: `Start with ${apCount} AP(s), then validate with a site survey.` },
        { label: 'Deployment Guidance', value: 'Use 5/6 GHz for capacity, keep 2.4 GHz low power, validate channel reuse, roaming, RSSI and SNR.' },
      ]} />
    </ToolShell>
  );
}

function ACINaming() {
  const [entries, setEntries] = usePersistedToolState('aci-naming', [
    { site: 'BLR', env: 'PROD', app: 'ERP', vlan: '110', role: 'WEB', interfaceId: '1-101' },
  ]);
  const generated = entries.flatMap((entry, index) => {
    const base = `${entry.site}-${entry.env}-${entry.app}-${entry.role}`.toUpperCase();
    return [
      { Entry: String(index + 1), Object: 'Tenant', Name: `TN-${entry.site}-${entry.env}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'VRF', Name: `VRF-${entry.site}-${entry.env}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'Bridge Domain', Name: `BD-${base}-V${entry.vlan}` },
      { Entry: String(index + 1), Object: 'BD Subnet', Name: `SUBNET-${base}-V${entry.vlan}` },
      { Entry: String(index + 1), Object: 'Application Profile', Name: `AP-${entry.site}-${entry.env}-${entry.app}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'EPG', Name: `EPG-${base}-V${entry.vlan}` },
      { Entry: String(index + 1), Object: 'Contract', Name: `CON-${entry.app}-${entry.role}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'Filter', Name: `FLT-${entry.app}-${entry.role}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'Subject', Name: `SUBJ-${entry.app}-${entry.role}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'Domain', Name: `PHYDOM-${entry.site}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'AAEP', Name: `AAEP-${entry.site}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'Policy Group', Name: `IPG-${entry.site}-${entry.role}`.toUpperCase() },
      { Entry: String(index + 1), Object: 'Interface Selector', Name: `INTSEL-${entry.site}-${entry.interfaceId}`.toUpperCase() },
    ];
  });
  return (
    <ToolShell>
      {entries.map((entry, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field label="Site Code" value={entry.site} onChangeText={v => setEntries(prev => prev.map((x, idx) => idx === i ? { ...x, site: v } : x))} />
          <Field label="Environment" value={entry.env} onChangeText={v => setEntries(prev => prev.map((x, idx) => idx === i ? { ...x, env: v } : x))} />
          <Field label="Application" value={entry.app} onChangeText={v => setEntries(prev => prev.map((x, idx) => idx === i ? { ...x, app: v } : x))} />
          <Field label="Role / Function" value={entry.role} onChangeText={v => setEntries(prev => prev.map((x, idx) => idx === i ? { ...x, role: v } : x))} />
          <Field label="VLAN ID" value={entry.vlan} onChangeText={v => setEntries(prev => prev.map((x, idx) => idx === i ? { ...x, vlan: v } : x))} />
          <Field label="Interface Selector ID" value={entry.interfaceId} onChangeText={v => setEntries(prev => prev.map((x, idx) => idx === i ? { ...x, interfaceId: v } : x))} />
          <SmallButton label="Remove ACI Entry" icon="trash-outline" tone="danger" onPress={() => setEntries(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add ACI Entry" icon="add-outline" onPress={() => setEntries(prev => [...prev, { site: '', env: '', app: '', vlan: '', role: '', interfaceId: '' }])} />
      <Table rows={generated} />
      <ActionRow text={generated.map(r => `Entry ${r.Entry} | ${r.Object}: ${r.Name}`).join('\n')} name="aci-names" />
    </ToolShell>
  );
}

function ACIContracts() {
  const [rows, setRows] = usePersistedToolState('aci-contracts', [{ provider: 'EPG-APP', consumer: 'EPG-WEB', protocol: 'tcp', port: '443', action: 'permit' }]);
  return (
    <ToolShell>
      {rows.map((r, i) => <View key={i} style={{ gap: 8 }}>
        <Field label="Provider EPG" value={r.provider} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, provider: v } : x))} />
        <Field label="Consumer EPG" value={r.consumer} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, consumer: v } : x))} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Protocol" value={r.protocol} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, protocol: v } : x))} /></View>
          <View style={{ flex: 1 }}><Field label="Port" value={r.port} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, port: v } : x))} /></View>
        </View>
        <Field label="Action" value={r.action} onChangeText={v => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, action: v } : x))} />
        <SmallButton label="Remove" icon="trash-outline" tone="danger" onPress={() => setRows(prev => prev.filter((_, idx) => idx !== i))} />
      </View>)}
      <SmallButton label="Add Contract Rule" icon="add-outline" onPress={() => setRows(prev => [...prev, { provider: '', consumer: '', protocol: 'tcp', port: '', action: 'permit' }])} />
      <Table rows={rows.map(r => ({ Provider: r.provider, Consumer: r.consumer, Protocol: r.protocol, Port: r.port, Action: r.action, Filter: `FLT-${r.protocol}-${r.port}`.toUpperCase() }))} />
      <ActionRow text={resultText(rows as any)} name="aci-contract-matrix" />
    </ToolShell>
  );
}

function ACIMapping() {
  const [rows, setRows] = usePersistedToolState('aci-mapping', [{ vlan: '110', domain: 'PHYDOM-BLR', aaep: 'AAEP-BLR', epg: 'EPG-BLR-PROD-ERP-WEB-V110', bd: 'BD-BLR-PROD-ERP-WEB-V110', ipg: 'IPG-BLR-WEB' }]);
  const checks = rows.flatMap(row => [
    `VLAN ${row.vlan}: create/verify VLAN in domain ${row.domain}.`,
    `EPG ${row.epg}: associate domain ${row.domain} and BD ${row.bd}.`,
    `AAEP ${row.aaep}: verify domain and policy group ${row.ipg}.`,
  ]);
  return (
    <ToolShell>
      {rows.map((row, i) => (
        <View key={i} style={{ gap: 8 }}>
          {Object.entries(row).map(([k, v]) => <Field key={k} label={`${k.toUpperCase()} ${i + 1}`} value={v} onChangeText={next => setRows(prev => prev.map((item, idx) => idx === i ? ({ ...item, [k]: next }) : item))} />)}
          <SmallButton label="Remove Mapping" icon="trash-outline" tone="danger" onPress={() => setRows(prev => prev.filter((_, idx) => idx !== i))} />
        </View>
      ))}
      <SmallButton label="Add Mapping" icon="add-outline" onPress={() => setRows(prev => [...prev, { vlan: '', domain: '', aaep: '', epg: '', bd: '', ipg: '' }])} />
      <Table rows={rows.map(row => ({ VLAN: row.vlan, Domain: row.domain, AAEP: row.aaep, EPG: row.epg, BD: row.bd, IPG: row.ipg }))} />
      <List rows={checks.map(c => ({ title: c }))} />
      <ActionRow text={checks.join('\n')} name="aci-mapping-checklist" />
    </ToolShell>
  );
}

const aciCommands = [
  { Area: 'APIC', Command: 'acidiag avread', Where: 'APIC CLI', Description: 'Check APIC cluster health.' },
  { Area: 'APIC', Command: 'acidiag fnvread', Where: 'APIC CLI', Description: 'List fabric nodes and registration state.' },
  { Area: 'Faults', Command: 'show faults', Where: 'APIC or leaf', Description: 'Display active faults.' },
  { Area: 'Endpoint', Command: 'show endpoint ip <ip>', Where: 'Leaf CLI', Description: 'Find endpoint by IP.' },
  { Area: 'Endpoint', Command: 'show endpoint mac <mac>', Where: 'Leaf CLI', Description: 'Find endpoint by MAC.' },
  { Area: 'Interface', Command: 'show interface ethernet x/y', Where: 'Leaf CLI', Description: 'Interface status and counters.' },
  { Area: 'VLAN', Command: 'show vlan extended', Where: 'Leaf CLI', Description: 'Show platform VLAN mappings.' },
  { Area: 'Contracts', Command: 'show zoning-rule', Where: 'Leaf CLI', Description: 'Show programmed contract rules.' },
  { Area: 'Contracts', Command: 'show logging ip access-list internal packet-log deny', Where: 'Leaf CLI', Description: 'Check contract deny drops.' },
  { Area: 'Fabric', Command: 'show lldp neighbors', Where: 'Leaf/Spine CLI', Description: 'Verify fabric and external LLDP neighbors.' },
  { Area: 'Fabric', Command: 'show isis adjacency', Where: 'Leaf/Spine CLI', Description: 'Check fabric IS-IS adjacencies.' },
  { Area: 'Fabric', Command: 'show platform internal hal health-stats', Where: 'Leaf/Spine CLI', Description: 'Check hardware abstraction health.' },
  { Area: 'VPC', Command: 'show vpc brief', Where: 'Leaf CLI', Description: 'Verify vPC status.' },
  { Area: 'VPC', Command: 'show port-channel summary', Where: 'Leaf CLI', Description: 'Check port-channel membership.' },
  { Area: 'Interface', Command: 'show interface counters errors', Where: 'Leaf CLI', Description: 'Check interface errors.' },
  { Area: 'Endpoint', Command: 'show system internal epm endpoint all', Where: 'Leaf CLI', Description: 'Detailed endpoint manager table.' },
  { Area: 'VLAN', Command: 'show system internal epm vlan all', Where: 'Leaf CLI', Description: 'Endpoint VLAN mapping details.' },
  { Area: 'Contracts', Command: 'show zoning-rule scope <vrf-vnid>', Where: 'Leaf CLI', Description: 'Filter zoning rules by VRF scope.' },
  { Area: 'Troubleshooting', Command: 'iping -V <vrf> <destination>', Where: 'Leaf CLI', Description: 'Ping from a tenant VRF.' },
  { Area: 'Troubleshooting', Command: 'itraceroute -V <vrf> <destination>', Where: 'Leaf CLI', Description: 'Traceroute from a tenant VRF.' },
  { Area: 'APIC', Command: 'moquery -c faultInst', Where: 'APIC CLI', Description: 'Query APIC fault managed objects.' },
  { Area: 'APIC', Command: 'moquery -c fvCEp -f "fv.CEp.ip==\\"<ip>\\""', Where: 'APIC CLI', Description: 'Find endpoint object by IP.' },
];

function ACIQuickRef() {
  const [q, setQ] = usePersistedToolState('aci-cli-search', '');
  const { rows, customRows, saveCustom } = useCustomRows('aciCommands', aciCommands);
  const [draft, setDraft] = usePersistedToolState('aci-cli-draft', { Area: '', Command: '', Where: '', Description: '' });
  const terms = q.toLowerCase().split(/\s+/).filter(t => t && !stopWords.has(t));
  const filtered = rows.filter(r => terms.length === 0 || terms.every(t => JSON.stringify(r).toLowerCase().includes(t)));
  const deleteCustom = async (index: number) => {
    await saveCustom(customRows.filter((_, i) => i !== index));
  };
  return (
    <ToolShell>
      <Field label="Search ACI Commands" value={q} onChangeText={setQ} />
      <Table rows={filtered} />
      <SectionTitle title="Add Custom ACI Command" subtitle="Saved locally on this device." />
      {Object.keys(draft).map(k => <Field key={k} label={k} value={(draft as any)[k]} onChangeText={v => setDraft(prev => ({ ...prev, [k]: v }))} />)}
      <SmallButton label="Save Custom Command" icon="save-outline" tone="primary" onPress={async () => {
        await saveCustom([...customRows, draft]);
        setDraft({ Area: '', Command: '', Where: '', Description: '' });
      }} />
      {customRows.length ? (
        <>
          <SectionTitle title="Custom ACI Commands" subtitle="Only custom commands can be removed." />
          {customRows.map((row: any, i: number) => (
            <View key={i} style={{ gap: 8 }}>
              <List rows={[{ title: `Custom ${i + 1}`, subtitle: Object.values(row).join(' | ') }]} />
              <SmallButton label="Delete Custom Command" icon="trash-outline" tone="danger" onPress={() => deleteCustom(i)} />
            </View>
          ))}
        </>
      ) : null}
    </ToolShell>
  );
}

function ToolShell({ children }: { children: React.ReactNode }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return <View style={styles.toolShell}>{children}</View>;
}

function TextHint({ text }: { text: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return <Text style={styles.hint}>{text}</Text>;
}

function Empty({ message }: { message: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return <Text style={styles.emptyText}>{message}</Text>;
}

function ActionRow({ text, name }: { text: string; name: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <SmallButton label="Copy All" icon="copy-outline" tone="primary" onPress={() => copyText(text)} disabled={!text} />
      <SmallButton label="Export" icon="download-outline" onPress={() => exportText(name, text)} disabled={!text} />
    </View>
  );
}

function List({ rows }: { rows: Array<{ title: string; subtitle?: string }> }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  if (!rows.length) return <Empty message="No results yet." />;
  return <View style={styles.listBox}>{rows.map((r, i) => (
    <View key={`${r.title}-${i}`} style={styles.listItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{r.title}</Text>
        {r.subtitle ? <Text style={styles.listSubtitle}>{r.subtitle}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => copyText(r.title)} style={styles.copyIcon}>
        <Ionicons name="copy-outline" size={14} color={theme.colors.gray400} />
      </TouchableOpacity>
    </View>
  ))}</View>;
}

function Table({ rows }: { rows: Array<Record<string, any>> }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  if (!rows.length) return <Empty message="No rows to display." />;
  const keys = Object.keys(rows[0]);
  return (
    <View style={styles.table}>
      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow}>
          {keys.map(k => (
            <View key={k} style={styles.tableCell}>
              <Text style={styles.resultLabel}>{k}</Text>
              <Text style={styles.tableValue}>{String(row[k])}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => copyText(Object.values(row).join(' | '))} style={styles.copyIcon}>
            <Ionicons name="copy-outline" size={14} color={theme.colors.gray400} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function Tabs({ tabs, active, setActive }: { tabs: string[]; active: string; setActive: (tab: string) => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return <View style={styles.tabs}>{tabs.map(t => <TouchableOpacity key={t} onPress={() => setActive(t)} style={[styles.tabPill, active === t && styles.tabPillActive]}><Text style={[styles.tabPillText, active === t && styles.tabPillTextActive]}>{t}</Text></TouchableOpacity>)}</View>;
}

function CodeBlock({ code }: { code: string }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeText}>{code || 'Complete the fields to generate output.'}</Text>
      <ActionRow text={code} name="tool-output" />
    </View>
  );
}

function renderTool(toolId: ToolId) {
  switch (toolId) {
    case 'ip-calculator': return <IPTool />;
    case 'subnet-calculator': return <SubnetTool />;
    case 'vlsm-calculator': return <VLSMTool />;
    case 'route-summary': return <RouteSummaryTool />;
    case 'ipv6-calculator': return <IPv6Tool />;
    case 'lan-scanner': return <LANScannerTool />;
    case 'acl-builder': return <ACLBuilder />;
    case 'vlan-planner': return <VLANPlanner />;
    case 'static-route': return <StaticRouteBuilder />;
    case 'prefix-list': return <PrefixListBuilder />;
    case 'route-summary-config': return <RouteSummaryTool configMode />;
    case 'redundancy': return <RedundancyBuilder />;
    case 'ospf': return <OSPFBuilder />;
    case 'dhcp': return <DHCPBuilder />;
    case 'bgp-builder': return <BGPBuilder />;
    case 'port-db': return <ReferenceTool kind="ports" />;
    case 'sfp-db': return <ReferenceTool kind="sfp" />;
    case 'poe-reference': return <ReferenceTool kind="poe" />;
    case 'poe-budget': return <PoEBudgetCalculator />;
    case 'wifi-reference': return <WiFiReference />;
    case 'rf-calculator': return <RFCalculator />;
    case 'ap-planner': return <APPlanner />;
    case 'aci-naming': return <ACINaming />;
    case 'aci-contracts': return <ACIContracts />;
    case 'aci-mapping': return <ACIMapping />;
    case 'aci-cli': return <ACIQuickRef />;
    case 'fortigate-migration': return <FortiGateMigrationAssistant />;
    default: return null;
  }
}

export default function ToolsView({ search = '', backTick = 0, onRootBack }: { search?: string; backTick?: number; onRootBack?: () => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [tool, setTool] = useState<ToolId | null>(null);
  const lastBackTick = useRef(backTick);
  const q = search.trim().toLowerCase();
  const activeTool = tool ? tools.find(t => t.id === tool) : null;
  const categoryTools = category ? tools.filter(t => t.category === category) : [];
  const filteredTools = (category ? categoryTools : tools).filter(t => !q || `${t.name} ${t.description}`.toLowerCase().includes(q));

  useEffect(() => {
    if (!backTick || backTick === lastBackTick.current) return;
    lastBackTick.current = backTick;
    if (tool) {
      setTool(null);
      return;
    }
    if (category) {
      setCategory(null);
      return;
    }
    onRootBack?.();
  }, [backTick]);

  if (activeTool) {
    return (
      <View style={styles.container}>
        <View style={styles.toolHeader}>
          <TouchableOpacity onPress={() => setTool(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.gray300} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{activeTool.name}</Text>
            <Text style={styles.screenSubtitle}>{activeTool.description}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderTool(activeTool.id)}
        </ScrollView>
      </View>
    );
  }

  if (category) {
    const cat = categories.find(c => c.id === category)!;
    return (
      <View style={styles.container}>
        <View style={styles.toolHeader}>
          <TouchableOpacity onPress={() => setCategory(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.gray300} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{cat.name}</Text>
            <Text style={styles.screenSubtitle}>{cat.description}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {filteredTools.map(t => <ToolCard key={t.id} tool={t} onPress={() => setTool(t.id)} />)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionTitle title="Tools" subtitle="Offline network engineering toolkit" />
        {q ? (
          filteredTools.map(t => <ToolCard key={t.id} tool={t} onPress={() => setTool(t.id)} />)
        ) : (
          categories.map(cat => {
            const count = tools.filter(t => t.category === cat.id).length;
            return (
              <TouchableOpacity key={cat.id} style={styles.categoryCard} onPress={() => setCategory(cat.id)}>
                <View style={styles.categoryIcon}><Ionicons name={cat.icon as any} size={20} color={theme.colors.blue400} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{cat.name}</Text>
                  <Text style={styles.cardSubtitle}>{cat.description}</Text>
                  <Text style={styles.toolCount}>{count} tools</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.gray500} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function ToolCard({ tool, onPress }: { tool: ToolDef; onPress: () => void }) {
  const theme = useThemeMode();
  const styles = createStyles(theme.colors);
  return (
    <TouchableOpacity style={styles.toolCard} onPress={onPress}>
      <View style={styles.toolIcon}><Ionicons name={tool.icon as any} size={18} color={theme.colors.green400} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{tool.name}</Text>
        <Text style={styles.cardSubtitle}>{tool.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.gray500} />
    </TouchableOpacity>
  );
}

const createStyles = (colors: typeof import('../theme/colors').colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg950 },
  scrollContent: { padding: 14, paddingBottom: 32, gap: 12 },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border800,
    backgroundColor: colors.bg950,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
  },
  screenTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  screenSubtitle: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.white },
  sectionSubtitle: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border700_60,
    backgroundColor: colors.bg800_60,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue600_20,
    borderWidth: 1,
    borderColor: colors.blue600_30,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border700_60,
    backgroundColor: colors.bg800_40,
  },
  toolIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green500_10,
    borderWidth: 1,
    borderColor: colors.green500_30,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.white },
  cardSubtitle: { fontSize: 11, color: colors.gray400, marginTop: 2, lineHeight: 16 },
  toolCount: { fontSize: 10, color: colors.blue400, marginTop: 6, fontWeight: '600' },
  toolShell: { gap: 12 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 11, color: colors.gray400, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7 },
  input: {
    backgroundColor: colors.bg800,
    borderWidth: 1,
    borderColor: colors.border700,
    color: colors.white,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
  },
  textarea: { minHeight: 92, textAlignVertical: 'top' },
  smallBtn: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.bg700,
    borderWidth: 1,
    borderColor: colors.border600,
  },
  smallBtnText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  primaryBtn: { backgroundColor: colors.blue600, borderColor: colors.blue600 },
  dangerBtn: { backgroundColor: colors.red600, borderColor: colors.red600 },
  primaryBtnText: { color: '#fff' },
  disabled: { opacity: 0.45 },
  resultCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border700_60,
    backgroundColor: colors.bg800_60,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border700_40,
  },
  resultLabel: { fontSize: 10, color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.6 },
  resultValue: { fontSize: 13, color: colors.white, fontWeight: '600', marginTop: 2 },
  copyIcon: { padding: 8 },
  listBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border700_60,
    backgroundColor: colors.bg800_40,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border700_40,
  },
  listTitle: { fontSize: 13, color: colors.white, fontWeight: '600' },
  listSubtitle: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  emptyText: { color: colors.gray500, textAlign: 'center', paddingVertical: 24, fontSize: 13 },
  hint: { fontSize: 11, color: colors.gray500, lineHeight: 16 },
  table: { gap: 8 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border700_60,
    backgroundColor: colors.bg800_40,
  },
  tableCell: { minWidth: 92, flex: 1 },
  tableValue: { fontSize: 12, color: colors.white, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.bg800,
  },
  tabPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  tabPillActive: { backgroundColor: colors.blue600 },
  tabPillText: { color: colors.gray400, fontSize: 12, fontWeight: '600' },
  tabPillTextActive: { color: '#fff' },
  codeBlock: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border700,
    backgroundColor: colors.bg800,
  },
  codeText: { color: colors.gray200, fontSize: 12, lineHeight: 18, fontFamily: 'monospace' },
});
