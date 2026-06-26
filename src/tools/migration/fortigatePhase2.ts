import * as XLSX from 'xlsx';
import type { ConfigBlock, FortiGateAnalysis, FortiGateModel, InterfaceMapping, MigrationOptions, MigrationResult, ValidationIssue } from './fortigateTypes';

export function overrideSourceModel(analysis: FortiGateAnalysis, sourceModel: string): FortiGateAnalysis {
  return { ...analysis, sourceModel, modelConfidence: sourceModel === analysis.autoDetectedModel ? analysis.modelConfidence : 100 };
}

export function backupFingerprint(analysis: FortiGateAnalysis) {
  return [
    ['Hostname', analysis.hostname],
    ['Model', analysis.sourceModel],
    ['Auto Detected Model', analysis.autoDetectedModel || 'UNKNOWN'],
    ['Detection Confidence', `${analysis.modelConfidence || 0}%`],
    ['FortiOS Version', analysis.fortiosVersion],
    ['Upload Date', analysis.uploadDate ? new Date(analysis.uploadDate).toLocaleString() : 'UNKNOWN'],
    ['Configuration Checksum', analysis.checksum || 'UNKNOWN'],
  ] as Array<[string, string]>;
}

export function featureMatrix(analysis: FortiGateAnalysis, result?: MigrationResult | null) {
  const changed = new Set((result?.modifiedLines || []).map(line => line.before).join('\n').match(/"([^"]+)"/g)?.map(v => v.replace(/"/g, '')) || []);
  const featureRows = [
    ['BGP', analysis.features.bgp],
    ['OSPF', analysis.features.ospf],
    ['RIP', analysis.features.rip],
    ['VRF', analysis.features.vrf],
    ['SD-WAN', analysis.features.sdwan],
    ['IPsec VPN', analysis.features.ipsecVpn],
    ['SSL VPN', analysis.features.sslVpn],
    ['Certificates', analysis.features.certificates],
    ['HA', analysis.features.ha],
    ['FortiLink', analysis.features.fortilink],
    ['Security Fabric', analysis.features.securityFabric],
    ['Switch Controller', analysis.features.fortilink],
    ['Virtual Wire Pair', analysis.features.virtualWirePair],
    ['Zones', (analysis.counts.zones || 0) > 0],
  ];
  return featureRows.map(([feature, detected]) => {
    const name = String(feature);
    const isDetected = Boolean(detected);
    const unsupported = ['HA', 'Security Fabric'].includes(name) && isDetected;
    const requiresValidation = ['IPsec VPN', 'SSL VPN', 'Certificates', 'FortiLink', 'SD-WAN', 'VRF', 'Virtual Wire Pair'].includes(name) && isDetected;
    return {
      Feature: name,
      Status: isDetected ? 'Configured' : 'Not Configured',
      Detected: isDetected ? 'Yes' : 'No',
      Converted: isDetected && !unsupported ? 'Partial' : isDetected ? 'Manual Review' : 'N/A',
      Migrated: isDetected && !unsupported ? 'Yes' : isDetected ? 'No' : 'N/A',
      Modified: changed.has(name) ? 'Yes' : 'Review',
      Skipped: isDetected && unsupported ? 'Yes' : 'No',
      'Manual Review': requiresValidation || unsupported ? 'Required' : 'Not Required',
      'Requires Validation': requiresValidation ? 'Yes' : 'No',
      Unsupported: unsupported ? 'Yes' : 'No',
    };
  });
}

export function targetCapabilityRows(model: FortiGateModel) {
  const yn = (value: boolean) => model.verified === false ? 'Unknown' : value ? 'Yes' : 'No';
  const supported = model.verified === false ? 'Not Verified' : 'Yes';
  return [
    ['Model Name', model.name],
    ['Series', model.series],
    ['Verification', model.verified === false ? 'Not Verified' : 'Verified Local Profile'],
    ['Interface Summary', model.interfaceSummary || `${model.portCount} mapped interfaces`],
    ['Profile Source', model.profileSource || 'Local migration profile'],
    ['Profile Accuracy', model.profileAccuracy || 'Migration mapping profile'],
    ['Port Count', model.verified === false ? 'Unknown' : model.portCount],
    ['HA Support', yn(model.haSupport)],
    ['SD-WAN Support', yn(model.sdWanSupport)],
    ['VPN Support', supported],
    ['FortiLink Support', yn(model.fortiLinkSupport)],
    ['Switch Controller Support', yn(model.switchControllerSupport)],
    ['BGP Support', supported],
    ['OSPF Support', supported],
    ['VRF Support', model.verified === false ? 'Unknown' : 'Partial'],
    ['Virtual Wire Pair Support', model.verified === false ? 'Unknown' : model.series === 'D' ? 'Manual Review' : 'Yes'],
    ['Hardware Switch Support', yn(model.hardwareSwitchSupport)],
    ['FortiOS Compatibility Notes', model.knownRestrictions.join(' ') || 'Validate FortiOS target version before import.'],
  ] as Array<[string, string | number]>;
}

export function interfaceUtilization(analysis: FortiGateAnalysis) {
  return analysis.interfaces.map(item => ({
    Interface: item.name,
    Role: item.role,
    Policies: countBlocksUsing(analysis.blocks, 'firewall policy', item.name),
    Routes: countBlocksUsing(analysis.blocks, 'router static', item.name),
    VPN: countBlocksUsing(analysis.blocks, 'vpn ipsec', item.name) + countBlocksUsing(analysis.blocks, 'vpn ssl', item.name),
    'SD-WAN': countBlocksUsing(analysis.blocks, 'system sdwan', item.name),
    Status: item.status,
  }));
}

export function impactSummary(analysis: FortiGateAnalysis, result?: MigrationResult | null) {
  const modified = result?.modifiedLines.length || 0;
  const failed = result?.issues.filter(issue => issue.severity === 'ERROR').length || 0;
  return [
    { Area: 'Policies', Found: analysis.counts.policies || 0, Migrated: analysis.counts.policies || 0, Modified: modified ? 'Review diff' : 0, Failed: failed },
    { Area: 'Routes', Found: analysis.counts.routes || 0, Migrated: analysis.counts.routes || 0, Modified: modified ? 'Review diff' : 0, Failed: failed },
    { Area: 'VPN', Found: analysis.counts.vpn || 0, Migrated: analysis.counts.vpn || 0, Modified: 'Requires validation', Failed: 0 },
    { Area: 'Address Objects', Found: analysis.counts.addressObjects || 0, Migrated: analysis.counts.addressObjects || 0, Modified: 0, Failed: 0 },
    { Area: 'Address Groups', Found: analysis.counts.addressGroups || 0, Migrated: analysis.counts.addressGroups || 0, Modified: 0, Failed: 0 },
    { Area: 'Service Objects', Found: analysis.counts.serviceObjects || 0, Migrated: analysis.counts.serviceObjects || 0, Modified: 0, Failed: 0 },
    { Area: 'Service Groups', Found: analysis.counts.serviceGroups || 0, Migrated: analysis.counts.serviceGroups || 0, Modified: 0, Failed: 0 },
    { Area: 'Certificates', Found: analysis.counts.certificates || 0, Migrated: analysis.counts.certificates || 0, Modified: 'Requires validation', Failed: 0 },
  ];
}

export function migrationSummaryRows(analysis: FortiGateAnalysis, result?: MigrationResult | null) {
  const errors = result?.issues.filter(item => item.severity === 'ERROR').length || 0;
  const warnings = result?.issues.filter(item => item.severity === 'WARNING').length || 0;
  const sourceTarget = (value: number, skipped = 0) => `${value} -> ${Math.max(value - skipped, 0)}`;
  return [
    ['Interfaces', sourceTarget(analysis.counts.interfaces || 0)],
    ['Address Objects', sourceTarget(analysis.counts.addressObjects || 0)],
    ['Address Groups', sourceTarget(analysis.counts.addressGroups || 0)],
    ['Policies', sourceTarget(analysis.counts.policies || 0)],
    ['Routes', sourceTarget(analysis.counts.routes || 0)],
    ['VPN', sourceTarget(analysis.counts.vpn || 0)],
    ['BGP', sourceTarget(analysis.counts.bgp || 0)],
    ['OSPF', sourceTarget(analysis.counts.ospf || 0)],
    ['Certificates', sourceTarget(analysis.counts.certificates || 0)],
    ['Admins', sourceTarget(analysis.counts.admins || 0)],
    ['Users', sourceTarget(analysis.counts.users || 0)],
    ['Warnings', warnings],
    ['Errors', errors],
  ] as Array<[string, string | number]>;
}

export function unusedObjects(analysis: FortiGateAnalysis) {
  const candidates = analysis.blocks.filter(block =>
    ['firewall address', 'firewall addrgrp', 'firewall service custom', 'firewall service group'].includes(block.path)
  );
  return candidates.map(block => {
    const referencedBy = analysis.blocks
      .filter(other => other !== block && JSON.stringify(other.settings).includes(block.name))
      .map(other => `${other.path} ${other.name}`);
    return {
      Object: block.name,
      Type: block.path.replace('firewall ', ''),
      Used: referencedBy.length ? 'Yes' : 'No',
      'Referenced By': referencedBy.slice(0, 5).join(', ') || 'None',
      Status: referencedBy.length ? 'Used' : 'Unused',
    };
  });
}

export function referencedByAnalysis(analysis: FortiGateAnalysis, name: string) {
  if (!name.trim()) return [];
  const q = name.trim();
  return analysis.blocks
    .filter(block => block.name !== q && `${block.name} ${JSON.stringify(block.settings)} ${block.lines.join('\n')}`.includes(q))
    .map(block => ({
      Object: q,
      'Referenced By': `${block.path} ${block.name}`,
      Type: block.path,
      Match: block.lines.find(line => line.includes(q))?.trim() || JSON.stringify(block.settings).slice(0, 120),
    }));
}

export function migrationChangeLog(analysis: FortiGateAnalysis, result: MigrationResult | null) {
  const rows: Array<Record<string, string | number>> = [
    { Category: 'Hostname', Original: analysis.hostname, Migrated: result?.migratedConfig.match(/set hostname "?([^"\n]+)"?/)?.[1] || analysis.hostname, Status: 'Unchanged' },
    { Category: 'Interfaces', Original: analysis.counts.interfaces || 0, Migrated: analysis.counts.interfaces || 0, Status: result?.modifiedLines.some(line => /set (srcintf|dstintf|interface|device)/.test(line.before)) ? 'Modified' : 'Unchanged' },
    { Category: 'Policies', Original: analysis.counts.policies || 0, Migrated: analysis.counts.policies || 0, Status: 'Migrated' },
    { Category: 'Routes', Original: analysis.counts.routes || 0, Migrated: analysis.counts.routes || 0, Status: 'Migrated' },
    { Category: 'Objects', Original: (analysis.counts.addressObjects || 0) + (analysis.counts.addressGroups || 0), Migrated: (analysis.counts.addressObjects || 0) + (analysis.counts.addressGroups || 0), Status: 'Migrated' },
    { Category: 'Warnings', Original: 0, Migrated: result?.issues.filter(issue => issue.severity === 'WARNING').length || 0, Status: 'Warning' },
    { Category: 'Unsupported Features', Original: 0, Migrated: result?.coverage.filter(item => item.feasibility === 'UNSUPPORTED').length || 0, Status: 'Unsupported' },
    { Category: 'Skipped Components', Original: 0, Migrated: result?.removedLines.length || 0, Status: result?.removedLines.length ? 'Skipped' : 'Unchanged' },
  ];
  (result?.modifiedLines || []).slice(0, 40).forEach(line => rows.push({ Category: 'Modified Line', Original: line.before.trim(), Migrated: line.after.trim(), Status: 'Modified' }));
  (result?.removedLines || []).slice(0, 40).forEach(line => rows.push({ Category: 'Removed Line', Original: line.trim(), Migrated: '-', Status: 'Skipped' }));
  return rows;
}

export function unsupportedCommands(analysis: FortiGateAnalysis, target: FortiGateModel) {
  const rows: Array<{ Command: string; Reason: string; Recommendation: string }> = [];
  if (target.verified === false) rows.push({ Command: target.name, Reason: 'Target hardware profile is not verified in the local database.', Recommendation: 'Validate port names, capabilities, and FortiOS compatibility manually.' });
  if (analysis.features.ha && !target.haSupport) rows.push({ Command: 'config system ha', Reason: 'Target profile does not support HA.', Recommendation: 'Remove HA or select HA-capable hardware.' });
  if (analysis.features.fortilink && !target.fortiLinkSupport) rows.push({ Command: 'config switch-controller / fortilink', Reason: 'Target profile does not support FortiLink.', Recommendation: 'Select FortiLink-capable target or rebuild switch design.' });
  if (analysis.features.securityFabric) rows.push({ Command: 'config system csf', Reason: 'Security Fabric is device/fabric specific.', Recommendation: 'Rejoin Security Fabric after migration.' });
  if (analysis.features.virtualWirePair && target.series === 'D') rows.push({ Command: 'virtual-wire-pair', Reason: 'Virtual wire pair support depends on FortiOS and hardware.', Recommendation: 'Validate in lab before production import.' });
  return rows;
}

export function compatibilityNotes(analysis: FortiGateAnalysis, options: MigrationOptions) {
  const targetVersion = options.targetFortiosVersion?.trim();
  if (!targetVersion || analysis.fortiosVersion === 'UNKNOWN') return [{ Status: 'Unknown', Note: 'Enter target FortiOS version to evaluate compatibility.' }];
  const src = versionValue(analysis.fortiosVersion);
  const dst = versionValue(targetVersion);
  if (src > dst) return [{ Status: 'Potential Issues', Note: `Source FortiOS ${analysis.fortiosVersion} is newer than target ${targetVersion}. Commands introduced later may fail on import.` }];
  if (src === dst) return [{ Status: 'Compatible', Note: 'Source and target FortiOS versions match.' }];
  return [{ Status: 'Partially Compatible', Note: `Target FortiOS ${targetVersion} is newer. Review deprecated commands and migration release notes.` }];
}

export function globalMigrationSearch(analysis: FortiGateAnalysis, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return analysis.blocks
    .filter(block => `${block.path} ${block.name} ${JSON.stringify(block.settings)} ${block.lines.join('\n')}`.toLowerCase().includes(q))
    .map(block => ({
      Type: block.path,
      Name: block.name,
      Match: block.lines.find(line => line.toLowerCase().includes(q))?.trim() || block.name,
      'Used In': block.path,
    }));
}

export function scoreExplanation(result: MigrationResult | null) {
  if (!result) return 'Generate migration output to calculate final readiness score.';
  const errors = result.issues.filter(item => item.severity === 'ERROR').length;
  const warnings = result.issues.filter(item => item.severity === 'WARNING').length;
  if (result.score >= 100) return '100%: No issues found.';
  if (result.score >= 95) return `95%+: Minor warnings detected. Warnings: ${warnings}.`;
  if (result.score >= 80) return `80%+: Manual validation required. Warnings: ${warnings}, Errors: ${errors}.`;
  if (result.score >= 60) return `60%+: High risk. Resolve critical issues and validate unsupported features.`;
  return 'Below 50-60%: Migration not recommended without remediation.';
}

export function buildExcelBase64(analysis: FortiGateAnalysis, mappings: InterfaceMapping[], result: MigrationResult | null) {
  const workbook = XLSX.utils.book_new();
  const sheets: Array<[string, Array<Record<string, any>>]> = [
    ['Interfaces', interfaceUtilization(analysis)],
    ['Policies', blocksToRows(analysis.blocks, 'firewall policy')],
    ['Address Objects', blocksToRows(analysis.blocks, 'firewall address')],
    ['Address Groups', blocksToRows(analysis.blocks, 'firewall addrgrp')],
    ['Services', [...blocksToRows(analysis.blocks, 'firewall service custom'), ...blocksToRows(analysis.blocks, 'firewall service group')]],
    ['Routes', blocksToRows(analysis.blocks, 'router static')],
    ['VPN', analysis.blocks.filter(block => block.path.startsWith('vpn ')).map(blockToRow)],
    ['VIP', [...blocksToRows(analysis.blocks, 'firewall vip'), ...blocksToRows(analysis.blocks, 'firewall vipgrp')]],
    ['Validation Results', (result?.issues || []).map(issue => ({ Severity: issue.severity, Type: issue.objectType, Name: issue.objectName, Issue: issue.issue, Recommendation: issue.recommendation }))],
    ['Migration Summary', migrationSummaryRows(analysis, result).map(([Metric, Value]) => ({ Metric, Value }))],
    ['Interface Mapping', mappings],
    ['Unused Objects', unusedObjects(analysis)],
    ['Change Log', migrationChangeLog(analysis, result)],
    ['Section Coverage', result?.sectionCoverage || []],
    ['Dependency Graph', result?.dependencyGraph || []],
    ['Parser Simulation', result?.parserValidation || []],
  ];
  sheets.forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No rows' }]), name.slice(0, 31));
  });
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
}

function countBlocksUsing(blocks: ConfigBlock[], pathPrefix: string, value: string) {
  return blocks.filter(block => block.path.startsWith(pathPrefix) && JSON.stringify(block.settings).includes(value)).length;
}

function blocksToRows(blocks: ConfigBlock[], path: string) {
  return blocks.filter(block => block.path === path).map(blockToRow);
}

function blockToRow(block: ConfigBlock) {
  return { Type: block.path, Name: block.name, ...block.settings };
}

function versionValue(version: string) {
  const parts = version.split('.').map(part => Number(part) || 0);
  return (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
}
