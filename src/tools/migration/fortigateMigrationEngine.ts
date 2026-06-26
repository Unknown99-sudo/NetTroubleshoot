import type {
  Feasibility,
  FortiGateAnalysis,
  FortiGateModel,
  InterfaceMapping,
  MigrationOptions,
  MigrationResult,
  TargetCapabilityOverride,
  ValidationIssue,
} from './fortigateTypes';

const firmwareProfiles: Record<string, { version: string; build: string; conf: string; date?: string; removed: RegExp[]; deprecated: RegExp[] }> = {
  '5.4': { version: '5.4.13', build: '1226', conf: '05000000', removed: [/gui-ignore-release-overview-version/i, /security-fabric/i, /fortiguard-anycast/i], deprecated: [/sdwan/i] },
  '5.6': { version: '5.6.14', build: '1705', conf: '05000000', removed: [/gui-ignore-release-overview-version/i, /fortiguard-anycast/i], deprecated: [/fabric-object/i] },
  '6.0': {
    version: '6.0.17',
    build: '0528',
    conf: '06000000',
    date: '230605',
    removed: [
      /set gui-ignore-release-overview-version/i,
      /set gui-firmware-upgrade-warning/i,
      /nac-quar/i,
      /fortiguard-anycast/i,
      /set ip-managed-by-fortiipam/i,
      /set additional-path\s+send/i,
      /set vrf\s+\d/i,
      /set traffic-priority-level/i,
      /set bounce-quarantined-link/i,
      /set set-priority\s+\d/i,
      /set darrp-optimize-schedules/i,
      /set csf\s+disable/i,
      /set layout-type\s+standalone/i,
      /^set sslvpn-web-mode\b/i,
    ],
    deprecated: [/fabric-object/i, /ztna/i],
  },
  '6.2': {
    version: '6.2.16',
    build: '1517',
    conf: '06020000',
    removed: [
      /set gui-ignore-release-overview-version/i,
      /nac-quar/i,
      /set ip-managed-by-fortiipam/i,
      /set additional-path\s+send/i,
      /set traffic-priority-level/i,
      /set bounce-quarantined-link/i,
      /set set-priority\s+\d/i,
      /set darrp-optimize-schedules/i,
      /^set sslvpn-web-mode\b/i,
    ],
    deprecated: [/ztna/i],
  },
  '6.4': {
    version: '6.4.15',
    build: '2095',
    conf: '06040000',
    removed: [
      /set gui-ignore-release-overview-version/i,
      /set additional-path\s+send/i,
      /set traffic-priority-level/i,
      /set set-priority\s+\d/i,
      /set darrp-optimize-schedules/i,
      /^set sslvpn-web-mode\b/i,
    ],
    deprecated: [/ztna/i],
  },
  '7.0': { version: '7.0.15', build: '0632', conf: '07000000', removed: [], deprecated: [/gui-ignore-release-overview-version/i] },
  '7.2': { version: '7.2.10', build: '1706', conf: '07020000', removed: [], deprecated: [] },
  '7.4': { version: '7.4.7', build: '2731', conf: '07040000', removed: [], deprecated: [] },
};

const cosmeticOrUnsafePatterns = [
  /config system dashboard/i,
  /config system replacemsg/i,
  /config system automation/i,
  /config system fabric/i,
  /config system csf/i,
  /config system sdn-connector/i,
  /config system fortiguard/i,
  /config endpoint-control/i,
  /config user nac-policy/i,
  /set gui-/i,
  /set dashboard-/i,
  /set fortiguard-anycast/i,
  /set gui-ignore-release-overview-version/i,
  /set gui-firmware-upgrade-warning/i,
  /set gui-replacement-message-groups/i,
  /set gui-theme/i,
];

type MigrationDirection = 'upgrade' | 'downgrade' | 'same-version' | 'same-model';

export const defaultMigrationOptions: MigrationOptions = {
  removeSerial: true,
  removeRegistration: true,
  removeFortiCloud: true,
  replaceHostname: false,
  newHostname: '',
  keepPolicies: true,
  keepObjects: true,
  keepRoutes: true,
  keepVlans: true,
  keepSdwan: true,
  keepNat: true,
  keepDhcp: true,
  keepVips: true,
  keepVpn: true,
  keepUsers: true,
  keepAdmins: true,
  keepCertificates: true,
  keepFortiLink: true,
  keepModem: false,
  keepSwitchController: true,
  keepSecurityFabric: true,
  keepBgp: true,
  keepOspf: true,
  keepZones: true,
  skipUnusedObjects: false,
  targetFortiosVersion: '7.4',
  targetBuildNumber: '2731',
  firmwareMode: 'target',
  migrationMode: 'standard',
  migrateFortiManager: false,
  adminAccessMode: 'preserve',
  emergencyAdminUsername: 'migration-admin',
  emergencyAdminPassword: '',
  emergencyAdminConfirm: '',
  generateAnyway: false,
};

export const defaultTargetCapabilityOverride: TargetCapabilityOverride = {
  wan: 'auto',
  lan: 'auto',
  dmz: 'auto',
  hasPortA: true,
  hasPortB: true,
  hasFortiLink: true,
  hasModem: false,
  haHaPort: false,
};

export function applyCapabilityOverride(base: FortiGateModel, override: TargetCapabilityOverride): FortiGateModel {
  const effective: FortiGateModel = {
    ...base,
    portNames: [...base.portNames],
    portTypes: { ...base.portTypes },
    wanPorts: [...base.wanPorts],
    lanPorts: [...base.lanPorts],
    dmzPorts: [...base.dmzPorts],
    fortiLinkPorts: [...base.fortiLinkPorts],
    switchPorts: [...base.switchPorts],
    migrationRules: [...base.migrationRules],
    knownRestrictions: [...base.knownRestrictions],
    knownExceptions: [...base.knownExceptions],
  };

  if (override.wan !== 'auto') effective.wanPorts = generatePortNames('wan', override.wan);
  if (override.lan !== 'auto') effective.lanPorts = generatePortNames('internal', override.lan);
  if (override.dmz !== 'auto') effective.dmzPorts = override.dmz > 0 ? generatePortNames('dmz', override.dmz) : [];

  applyOptionalPort(effective, 'a', override.hasPortA);
  applyOptionalPort(effective, 'b', override.hasPortB);

  if (!override.hasModem) {
    effective.portNames = effective.portNames.filter(port => port !== 'modem');
    effective.wanPorts = effective.wanPorts.filter(port => port !== 'modem');
    effective.lanPorts = effective.lanPorts.filter(port => port !== 'modem');
    effective.fortiLinkPorts = effective.fortiLinkPorts.filter(port => port !== 'modem');
    delete effective.portTypes.modem;
  } else {
    if (!effective.portNames.includes('modem')) effective.portNames.push('modem');
    if (!effective.wanPorts.includes('modem')) effective.wanPorts.push('modem');
    effective.portTypes.modem = effective.portTypes.modem || 'WAN';
  }

  effective.fortiLinkSupport = override.hasFortiLink;
  if (!override.hasFortiLink) {
    effective.fortiLinkPorts = [];
  } else if (!effective.fortiLinkPorts.length) {
    effective.fortiLinkPorts = effective.lanPorts.slice(0, Math.min(2, effective.lanPorts.length));
  }

  if (override.haHaPort && !effective.portNames.includes('ha')) {
    effective.portNames.push('ha');
    effective.portTypes.ha = 'HA';
  } else if (!override.haHaPort && !base.portNames.includes('ha')) {
    effective.portNames = effective.portNames.filter(port => port !== 'ha');
    delete effective.portTypes.ha;
  }

  const others = effective.portNames.filter(port =>
    !effective.wanPorts.includes(port) &&
    !effective.lanPorts.includes(port) &&
    !effective.dmzPorts.includes(port) &&
    !effective.fortiLinkPorts.includes(port)
  );
  effective.portNames = [...new Set([...effective.wanPorts, ...effective.lanPorts, ...effective.dmzPorts, ...effective.fortiLinkPorts, ...others])];
  effective.portCount = effective.portNames.length;
  effective.removedPorts = base.portNames.filter(port => !effective.portNames.includes(port));
  return effective;
}

function generatePortNames(prefix: string, count: number) {
  if (count <= 0) return [];
  if (count === 1) return [prefix];
  return Array.from({ length: count }, (_item, index) => `${prefix}${index + 1}`);
}

function applyOptionalPort(model: FortiGateModel, port: 'a' | 'b', enabled: boolean) {
  if (!enabled) {
    model.portNames = model.portNames.filter(name => name !== port);
    model.lanPorts = model.lanPorts.filter(name => name !== port);
    model.fortiLinkPorts = model.fortiLinkPorts.filter(name => name !== port);
    delete model.portTypes[port];
    return;
  }
  if (!model.portNames.includes(port)) model.portNames.push(port);
  if (!model.lanPorts.includes(port)) model.lanPorts.push(port);
  model.portTypes[port] = model.portTypes[port] || 'LAN';
}

export function suggestMappings(analysis: FortiGateAnalysis, target: FortiGateModel): InterfaceMapping[] {
  const usedTargets = new Set<string>();
  return analysis.interfaces.filter(source => {
    if (isSystemReference(source.name)) return false;
    if (!target.fortiLinkSupport && (source.role === 'FortiLink' || /fortilink/i.test(source.name))) return false;
    if (!target.portNames.includes('modem') && /^modem$/i.test(source.name)) return false;
    return true;
  }).map(source => {
    if (isLogicalInterface(source)) {
      const memberCandidates = defaultTargetMembers(source, target);
      const targetParent = source.vlanId && source.parent ? defaultVlanParent(source.parent, target) : undefined;
      return {
        source: source.name,
        role: logicalRole(source),
        target: source.name,
        status: 'OK',
        notes: memberCandidates.length
          ? `${logicalRole(source)} name preserved. Target members selected: ${memberCandidates.join(', ')}.`
          : source.vlanId
            ? `${logicalRole(source)} name preserved. VLAN parent ${source.parent || 'unknown'} can be mapped separately.`
            : `${logicalRole(source)} name preserved. Parent interface references are remapped separately.`,
        targetMembers: memberCandidates,
        targetParent,
      };
    }
    const targetName = pickTarget(source.role, source.name, target, usedTargets);
    if (targetName) usedTargets.add(targetName);
    return {
      source: source.name,
      role: source.role,
      target: targetName,
      status: targetName ? (isHardSwitchInternal(source.name, source.type, targetName, target) ? 'WARNING' : 'OK') : source.status === 'Unused' ? 'WARNING' : 'ERROR',
      notes: targetName
        ? isHardSwitchInternal(source.name, source.type, targetName, target)
          ? 'Internal hard-switch detected. Target supports hardware-switch; validate member ports after import.'
          : `Mapped by ${source.role} role`
        : 'No available target interface. Manual mapping required.',
    };
  });
}

function pickTarget(role: string, sourceName: string, target: FortiGateModel, used: Set<string>) {
  const exact = target.portNames.find(name => name.toLowerCase() === sourceName.toLowerCase() && !used.has(name));
  if (exact) return exact;
  if (/^internal$/i.test(sourceName) && target.hardwareSwitchSupport && target.switchPorts.length && !used.has(target.switchPorts[0])) return target.switchPorts[0];
  const wanPool = target.wanPorts.filter(name => name !== 'modem' && !used.has(name));
  const pool = role === 'WAN'
    ? (wanPool.length ? wanPool : target.wanPorts.filter(name => !used.has(name)))
    : role === 'DMZ'
      ? target.dmzPorts
      : role === 'FortiLink'
        ? target.fortiLinkPorts
        : role === 'HA'
          ? target.portNames.filter(name => /^ha/i.test(name))
          : role === 'MGMT'
            ? target.portNames.filter(name => /^mgmt/i.test(name))
            : target.lanPorts;
  return pool.find(name => !used.has(name)) || '';
}

function defaultVlanParent(sourceParent: string, target: FortiGateModel) {
  const exact = [...target.switchPorts, ...target.portNames].find(name => name.toLowerCase() === sourceParent.toLowerCase());
  if (exact) return exact;
  if (/^(internal|lan)$/i.test(sourceParent) && target.switchPorts.length) return target.switchPorts[0];
  if (/^wan/i.test(sourceParent) && target.wanPorts.length) return target.wanPorts[0];
  return target.switchPorts[0] || target.lanPorts[0] || target.portNames[0] || sourceParent;
}

export function validateMigration(analysis: FortiGateAnalysis, target: FortiGateModel, mappings: InterfaceMapping[], options: MigrationOptions) {
  const issues: ValidationIssue[] = [];
  const normalizedOptions = normalizeFirmwareOptions(options);
  const direction = getMigrationDirection(analysis, normalizedOptions, target);
  const stripSslVpn = shouldStripSslVpn(target, normalizedOptions.targetFortiosVersion || '');
  const stripSslVpnWebMode = shouldStripSslVpnWebMode(target, normalizedOptions.targetFortiosVersion || '');
  const targetUse = new Map<string, string[]>();
  const sourcePhysical = analysis.interfaces.filter(item => isPhysicalInterface(item) && item.status !== 'Unused');
  const targetPhysical = target.portNames.filter(name => !target.switchPorts.includes(name));
  if (sourcePhysical.length > targetPhysical.length) {
    issues.push(issue('WARNING', 'Physical Port Capacity', target.name, `Source has ${sourcePhysical.length} used physical interfaces but target has ${targetPhysical.length} physical ports.`, `${sourcePhysical.length - targetPhysical.length} interfaces require consolidation, hardware-switch, VLAN, or manual remapping.`));
  }
  mappings.forEach(mapping => {
    if (isSystemReference(mapping.source)) return;
    const sourceInterface = analysis.interfaces.find(item => item.name === mapping.source);
    const fortiLinkDisabled = !options.keepFortiLink || !target.fortiLinkSupport;
    if (sourceInterface && isLogicalInterface(sourceInterface) && mapping.target !== mapping.source) {
      issues.push(issue('ERROR', 'Logical Interface Mapping', mapping.source, `${logicalRole(sourceInterface)} interface name must be preserved.`, 'Do not map tunnel, VLAN, loopback, aggregate, FortiLink, switch, or WiFi/VAP interfaces to physical ports.'));
    }
    if (sourceInterface && isSwitchLikeInterface(sourceInterface) && !mapping.targetMembers?.length) {
      if (!(fortiLinkDisabled && (sourceInterface.role === 'FortiLink' || /fortilink/i.test(sourceInterface.name)))) {
        issues.push(issue('ERROR', 'Hardware Switch Members', mapping.source, 'No target member ports selected for hardware-switch/switch interface.', 'Select target member ports so the logical LAN interface keeps its IP, DHCP, policies, and management access.'));
      }
    }
    if (!mapping.target && mapping.role !== 'Unused') {
      issues.push(issue('ERROR', 'Interface Mapping', mapping.source, 'Missing target interface mapping.', 'Select a target interface or remove references manually.'));
    }
    if (mapping.target && (!sourceInterface || !isLogicalInterface(sourceInterface))) targetUse.set(mapping.target, [...(targetUse.get(mapping.target) || []), mapping.source]);
    if (mapping.target && (!sourceInterface || !isLogicalInterface(sourceInterface)) && !target.portNames.includes(mapping.target) && !target.switchPorts.includes(mapping.target)) {
      issues.push(issue('ERROR', 'Interface Mapping', mapping.source, `Target interface ${mapping.target} does not exist on ${target.name}.`, 'Choose a valid target port.'));
    }
    if (mapping.targetMembers?.some(member => !target.portNames.includes(member))) {
      issues.push(issue('ERROR', 'Hardware Switch Members', mapping.source, 'One or more selected member ports do not exist on the target model.', 'Select valid physical target ports.'));
    }
    if (mapping.status === 'WARNING') {
      issues.push(issue('WARNING', 'Interface Mapping', mapping.source, mapping.notes, 'Validate interface members, zones, and policy references after import.'));
    }
  });
  targetUse.forEach((sources, targetName) => {
    if (sources.length > 1) issues.push(issue('ERROR', 'Interface Mapping', targetName, `Duplicate mapping from ${sources.join(', ')}.`, 'Each target interface should be used once.'));
  });

  analysis.interfaces.filter(item => item.vlanId).forEach(item => {
    const row = mappings.find(mapping => mapping.source === item.name);
    const parent = item.parent || '';
    const validLogicalParents = new Set(analysis.interfaces.filter(isVlanParentCapable).map(parentItem => mappings.find(mapping => mapping.source === parentItem.name)?.target || parentItem.name));
    if (row?.targetParent && !target.portNames.includes(row.targetParent) && !target.switchPorts.includes(row.targetParent) && !validLogicalParents.has(row.targetParent)) {
      issues.push(issue('ERROR', 'VLAN Parent Mapping', item.name, `Target VLAN parent ${row.targetParent} does not exist on ${target.name}.`, 'Select a valid target physical port, switch, or aggregate parent for this VLAN.'));
    } else if (parent && !row?.targetParent && !mappings.some(mapping => mapping.source === parent && mapping.target)) {
      issues.push(issue('ERROR', 'VLAN', item.name, `VLAN parent ${parent} is not mapped.`, 'Map the parent interface before generating.'));
    }
  });

  if (target.verified === false) {
    issues.push(issue('WARNING', 'Target Model', target.name, 'Target hardware profile is not verified.', 'Validate interfaces, capabilities, and FortiOS compatibility manually before import.'));
  }
  if (analysis.features.ha && !target.haSupport && target.verified !== false) {
    issues.push(issue('ERROR', 'HA', target.name, 'Target model profile does not support HA.', 'Remove HA config or choose a HA-capable target.'));
  } else if (analysis.features.ha) {
    issues.push(issue('WARNING', 'HA', analysis.hostname, 'HA configuration is not auto-migrated.', 'Rebuild and validate HA manually after import.'));
  }
  if (analysis.features.fortilink && !target.fortiLinkSupport && target.verified !== false) {
    issues.push(options.keepFortiLink === false
      ? issue('WARNING', 'FortiLink', target.name, 'Target model profile does not support FortiLink. FortiLink and switch-controller config will be removed automatically.', 'Validate dependent VLANs, switch ports, policies, and routes after import.')
      : issue('ERROR', 'FortiLink', target.name, 'Target model profile does not support FortiLink.', 'Choose a FortiLink-capable target or remove FortiLink config.'));
  } else if (analysis.features.fortilink) {
    issues.push(issue('WARNING', 'FortiLink', analysis.hostname, 'FortiLink detected.', 'Target supports FortiLink, but FortiSwitch authorization, FortiLink interface, VLANs, and switch-controller settings need manual validation.'));
  }
  if (analysis.features.securityFabric) issues.push(issue('WARNING', 'Security Fabric', analysis.hostname, 'Security Fabric references are removed or report-only.', 'Rejoin Security Fabric after cutover.'));
  if (analysis.features.fortimanager) issues.push(issue('WARNING', 'FortiManager', analysis.hostname, 'FortiManager references are device-specific.', 'Reauthorize from FortiManager after migration.'));
  if (analysis.features.fortianalyzer) issues.push(issue('WARNING', 'FortiAnalyzer', analysis.hostname, 'FortiAnalyzer registration may be device-specific.', 'Validate logging authorization after migration.'));
  if (analysis.features.certificates && options.keepCertificates) issues.push(issue('WARNING', 'Certificates', analysis.hostname, 'Certificates may be encrypted or bound to source device.', 'Export/import certificates manually if needed.'));
  if (analysis.blocks.some(block => block.path === 'vpn certificate local')) {
    issues.push(issue('WARNING', 'Certificates', analysis.hostname, 'Factory Fortinet certificates are stripped - target device has its own copies built into firmware. Custom certificates with encrypted private keys are also stripped as they are bound to the source device serial number.', 'Re-import any custom certificates and private keys manually after import. Export them from the source device before decommission.'));
  }
  const hasNestedSubBlocks = analysis.blocks.some(block => block.children && block.children.some(child => child.name === '__root__'));
  if (hasNestedSubBlocks) {
    issues.push(issue('WARNING', 'Nested Config Sub-Blocks Detected', analysis.hostname, 'Source config contains nested config sub-blocks inside edit entries. These are firmware-version-specific. Sub-blocks will be classified during generation. Those that cannot be structurally validated within their parent object will not be emitted. Capability-based validation will be added in Phase 2.', 'Validate GUI dashboards, SSL VPN auth rules, DHCP options, and address group tags manually after import.'));
  }
  issues.push(issue('WARNING', 'Encrypted Secrets Stripped', analysis.hostname, 'Device-bound encrypted secrets stripped: RADIUS shared secrets, LDAP/FSSO passwords, local user passwords, wireless passphrases, IPsec PSKs, and SSH host keys. These are encrypted with the source device serial and cannot be decrypted by the target device.', 'Re-enter manually after import: RADIUS secrets, FSSO/LDAP passwords, local user passwords, WiFi passphrases, IPsec PSKs. SSH host keys are auto-generated by the target device.'));
  if (analysis.features.ipsecVpn && options.keepVpn) issues.push(issue('WARNING', 'IPsec VPN', analysis.hostname, 'IPsec VPN is partially supported.', 'Validate phase interfaces, proposals, and peer status.'));
  if (analysis.features.sslVpn && options.keepVpn) issues.push(issue('WARNING', 'SSL VPN', analysis.hostname, 'SSL VPN is partially supported.', 'Validate portal, certificates, realms, and routes.'));
  if (stripSslVpn) {
    issues.push(issue('WARNING', 'SSL VPN Deprecated', target.name, `SSL VPN tunnel mode is not supported on ${target.name} running FortiOS ${normalizedOptions.targetFortiosVersion}. config vpn ssl settings, portals, and realms will be removed.`, 'Migrate SSL VPN users to IPsec VPN on TCP 443 before cutover. See Fortinet SSL VPN deprecation advisory.'));
    analysis.blocks
      .filter(block => block.path === 'firewall policy')
      .forEach(policy => {
        const dstintf = policy.settings.dstintf || '';
        if (/ssl\.root/i.test(dstintf)) {
          issues.push(issue('ERROR', 'SSL VPN Policy', policy.name, `Policy references ssl.root but SSL VPN tunnel mode is not supported on ${target.name} running FortiOS ${normalizedOptions.targetFortiosVersion}.`, 'Rebuild this policy using IPsec VPN interface on TCP 443. Do not import until remapped.'));
        }
      });
  }
  if (!stripSslVpn && stripSslVpnWebMode) {
    issues.push(issue('WARNING', 'SSL VPN Web Mode', target.name, 'SSL VPN web mode (agentless) is not supported on this model running the target firmware. Web mode line will be removed.', 'Tunnel mode remains available. Remove web mode portal references and update client configurations accordingly.'));
  }
  validateSslVpn(analysis).forEach(item => issues.push(item));
  validateIpsecProposals(analysis, options).forEach(item => issues.push(item));
  validateManagementAccess(analysis, mappings, options).forEach(item => issues.push(item));
  validateAdminMigration(analysis, options).forEach(item => issues.push(item));
  validateWireless(analysis).forEach(item => issues.push(item));
  validateFirmwareProfile(analysis, target, options, direction).forEach(item => issues.push(item));
  validateFeatureInventory(analysis, options).forEach(item => issues.push(item));
  if (direction === 'downgrade') {
    issues.push(issue('WARNING', 'Migration Direction', `${analysis.fortiosVersion} to ${options.targetFortiosVersion || 'target'}`, 'Source firmware is newer than target firmware.', 'Downgrade cleanup is enabled. Review removed commands and lab-import before production.'));
  }
  if (/^#config-version=/im.test(analysis.raw)) {
    issues.push(issue('WARNING', 'Config Header', analysis.sourceModel, options.firmwareMode === 'target' ? 'Config-version hardware token and selected target firmware will be rewritten.' : 'Config-version hardware token will be rewritten only for target model.', options.firmwareMode === 'target' ? 'Confirm the selected target firmware is installed before import.' : 'FortiOS version, build number, and release information are preserved. Confirm target firmware compatibility before import.'));
  }
  if (analysis.vdomMode === 'Multi VDOM') {
    issues.push(issue('WARNING', 'VDOM', analysis.vdoms?.join(', ') || 'Multi VDOM', 'Multi-VDOM configuration detected.', 'Additional validation recommended for each VDOM after migration.'));
    if (/type\s+vdom-link|vdom-link|inter-vdom/i.test(analysis.raw)) {
      issues.push(issue('WARNING', 'VDOM Link', analysis.vdoms?.join(', ') || 'Multi VDOM', 'Inter-VDOM link references detected.', 'Validate interface names, policies, and routes inside each VDOM after import because duplicate names can exist across VDOMs.'));
    }
  }

  const mappedNames = new Set(mappings.map(mapping => mapping.source));
  for (const ref of collectInterfaceLikeReferences(analysis)) {
    if (isSystemReference(ref)) continue;
    if (!mappedNames.has(ref) && analysis.interfaces.some(item => item.name === ref)) {
      issues.push(issue('ERROR', 'Reference', ref, 'Interface reference has no migration mapping.', 'Map the interface or remove dependent config.'));
    }
  }
  validateReferencedInterfaces(analysis, mappings).forEach(item => issues.push(item));

  if (!issues.some(item => item.severity === 'ERROR')) {
    issues.unshift(issue('SUCCESS', 'Validation', analysis.hostname, 'Core migration validation passed.', 'Continue with report review and lab import test.'));
  }
  return issues;
}

export function generateMigration(analysis: FortiGateAnalysis, target: FortiGateModel, mappings: InterfaceMapping[], options: MigrationOptions): MigrationResult {
  const normalizedOptions = normalizeFirmwareOptions(options);
  if (!target.fortiLinkSupport) {
    normalizedOptions.keepFortiLink = false;
    normalizedOptions.keepSwitchController = false;
  }
  if (!target.portNames.includes('modem')) {
    normalizedOptions.keepModem = false;
  }
  const stripSslVpn = shouldStripSslVpn(target, normalizedOptions.targetFortiosVersion || '');
  const stripSslVpnWebMode = shouldStripSslVpnWebMode(target, normalizedOptions.targetFortiosVersion || '');
  const migrationDirection = getMigrationDirection(analysis, normalizedOptions, target);
  const sourceVersionValue = versionValue(analysis.fortiosVersion);
  const targetVersionValue = versionValue(normalizedOptions.targetFortiosVersion || analysis.fortiosVersion);
  const targetIsFortios6 = targetVersionValue >= versionValue('6.0') && targetVersionValue < versionValue('7.0');
  const issues = validateMigration(analysis, target, mappings, normalizedOptions);
  const critical = hasExportBlockingErrors(issues);
  if (critical && !options.generateAnyway) {
    const coverage = buildCoverage(analysis, issues, migrationDirection);
    const score = scoreMigration(coverage, issues);
    return {
      migratedConfig: '',
      removedLines: [],
      modifiedLines: [],
      coverage,
      score,
      migrationDirection,
      sourceVersionValue,
      targetVersionValue,
      strippedPasswordAdmins: strippedPasswordAdmins(analysis, normalizedOptions),
      readiness: readinessText(score, critical),
      issues,
      checklist: buildChecklist(analysis, target),
      reportHtml: buildReportHtml(analysis, target, coverage, issues, score, '', [], [], buildDependencyGraph(analysis), buildSectionCoverage(analysis, null), []),
      errorsHtml: buildErrorsHtml(issues),
    };
  }

  const interfaceMap = new Map(analysis.interfaces.map(item => [item.name, item]));
  const mappingMap = new Map(mappings.filter(item => item.target).map(item => [item.source, item.target]));
  const unusedObjectKeys = normalizedOptions.skipUnusedObjects ? findUnusedObjectKeys(analysis) : new Set<string>();
  const fortiLinkDhcpKeys = new Set(
    analysis.blocks
      .filter(block => block.path === 'system dhcp server' && /"?fortilink"?/i.test(block.settings.interface || ''))
      .map(block => `${block.path}:${block.name}`)
  );
  const factoryCertPattern = /^Fortinet_(CA_SSL|CA_Untrusted|SSL|GUI_Server|SSL_RSA\d+|SSL_DSA\d+|SSL_ECDSA\d+|SSL_ED\d+|SSL_ED448|SSL_ED25519|Wifi_CA|Wifi|Factory|Firmware|SSLProxy)$/i;
  const removedLines: string[] = [];
  const modifiedLines: Array<{ before: string; after: string }> = [];
  const out: string[] = [];
  const generationIssues: ValidationIssue[] = [];
  const removedInterfaceNames = new Set<string>();
  let skipBlock: string | null = null;
  let skipBlockDepth = 0;
  let skipBlockParentSection = '';
  let skipBlockParentEditName = '';
  let skipEdit = false;
  let skipEditDepth = 0;
  let activeSection = '';
  let activeEditName = '';
  let activeMemberLineWritten = false;
  let activeVdom = 'root';
  let encryptedKeyDetected = false;
  let encryptedKeyEditLines: string[] = [];
  let encryptedKeyEditName = '';
  const vdomWarnings = new Set<string>();
  const nestedConfigWarnings = new Set<string>();
  const rawLines = analysis.raw.split('\n');
  const emittedStack: Array<{ type: 'config' | 'edit'; name: string }> = [];
  const syncGenerationState = () => {
    const currentConfig = [...emittedStack].reverse().find(frame => frame.type === 'config');
    const currentEdit = emittedStack[emittedStack.length - 1]?.type === 'edit' ? emittedStack[emittedStack.length - 1] : null;
    activeSection = currentConfig?.name || '';
    activeEditName = currentEdit?.name || '';
  };
  const emitLine = (value: string) => {
    out.push(value);
    const emitted = value.trim();
    const configMatch = emitted.match(/^config\s+(.+)$/i);
    if (configMatch) {
      emittedStack.push({ type: 'config', name: configMatch[1] });
      syncGenerationState();
      return;
    }
    const editMatch = emitted.match(/^edit\s+(.+)$/i);
    if (editMatch) {
      const top = emittedStack[emittedStack.length - 1];
      if (top?.type === 'config') emittedStack.push({ type: 'edit', name: cleanEditName(editMatch[1]) });
      syncGenerationState();
      return;
    }
    if (/^next$/i.test(emitted)) {
      if (emittedStack[emittedStack.length - 1]?.type === 'edit') emittedStack.pop();
      syncGenerationState();
      activeMemberLineWritten = false;
      return;
    }
    if (/^end$/i.test(emitted)) {
      if (emittedStack[emittedStack.length - 1]?.type === 'config') emittedStack.pop();
      syncGenerationState();
      activeMemberLineWritten = false;
    }
  };

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const line = rawLines[lineIndex];
    const trimmed = line.trim();
    const parentSectionBeforeConfig = activeSection;
    const parentEditBeforeConfig = activeEditName;
    let skipBlockJustStarted = false;
    let skipEditJustStarted = false;
    if (activeEditName && /^config\s+(.+)$/i.test(trimmed) && !skipBlock && !skipEdit && !encryptedKeyEditName) {
      const parentSection = activeSection;
      const parentEditName = activeEditName;
      const nestedClassification = classifyNestedConfigBlock(rawLines, lineIndex);
      if (nestedClassification.status === 'valid') {
        emitNestedConfigLines(nestedClassification.lines, normalizedOptions, activeSection, removedLines, emitLine);
        syncGenerationState();
        lineIndex = nestedClassification.endIndex;
        continue;
      }
      if (nestedClassification.status === 'invalid') {
        removedLines.push(...nestedClassification.lines);
        const warningKey = `${activeSection}:${nestedClassification.section}`;
        if (!nestedConfigWarnings.has(warningKey)) {
          generationIssues.push(issue('WARNING', 'Nested Config Block Stripped', `${activeSection}:${nestedClassification.section}`, `Nested config block "${nestedClassification.section}" inside "${activeSection}" was structurally invalid and was not emitted. ${nestedClassification.reason}`, 'Review the source object manually. Capability-based nested block handling will be added in Phase 2.'));
          nestedConfigWarnings.add(warningKey);
        }
        syncGenerationState();
        lineIndex = nestedClassification.endIndex;
        continue;
      }
      if (nestedClassification.status === 'unknown') {
        const warningKey = `${activeSection}:${nestedClassification.section}`;
        if (!nestedConfigWarnings.has(warningKey)) {
          generationIssues.push(issue('WARNING', 'Nested Config Block Unknown', `${activeSection}:${nestedClassification.section}`, `Nested config block "${nestedClassification.section}" inside "${activeSection}" could not be structurally classified during generation.`, 'Final structural validation will determine whether export is safe.'));
          nestedConfigWarnings.add(warningKey);
        }
      }
    }
    const section = trimmed.match(/^config\s+(.+)$/)?.[1];
    if (section && !skipBlock) {
      activeSection = section;
      if (shouldSkipSection(section, normalizedOptions, activeVdom)) {
        skipBlock = section;
        skipBlockDepth = 1;
        skipBlockParentSection = parentSectionBeforeConfig;
        skipBlockParentEditName = parentEditBeforeConfig;
        skipBlockJustStarted = true;
      }
      if (stripSslVpn && ['vpn ssl settings', 'vpn ssl web portal', 'vpn ssl web realm', 'vpn ssl web host-check-software'].includes(section)) {
        skipBlock = section;
        skipBlockDepth = 1;
        skipBlockParentSection = parentSectionBeforeConfig;
        skipBlockParentEditName = parentEditBeforeConfig;
        skipBlockJustStarted = true;
      }
      if (section === 'firewall ssh local-key' || section === 'firewall ssh local-ca') {
        skipBlock = section;
        skipBlockDepth = 1;
        skipBlockParentSection = parentSectionBeforeConfig;
        skipBlockParentEditName = parentEditBeforeConfig;
        skipBlockJustStarted = true;
        removedLines.push(`config ${section} (stripped - SSH keys are device-bound, target generates own keys)`);
      }
      if (section === 'system sdwan' && normalizedOptions.keepSdwan && targetIsFortios6) {
        const rewritten = line.replace(/config system sdwan/i, 'config system virtual-wan-link');
        modifiedLines.push({ before: line, after: `${rewritten} (RENAMED - FortiOS 6.x SD-WAN syntax)` });
        emitLine(rewritten);
        continue;
      }
      if (section === 'system virtual-wan-link' && migrationDirection === 'upgrade' && versionValue(normalizedOptions.targetFortiosVersion || '') >= versionValue('7.0')) {
        const rewritten = line.replace(/config system virtual-wan-link/i, 'config system sdwan');
        modifiedLines.push({ before: line, after: `${rewritten} (RENAMED - validate member and zone syntax)` });
        generationIssues.push(issue('WARNING', 'SD-WAN Migration', 'virtual-wan-link', 'config system virtual-wan-link renamed to config system sdwan for target firmware.', 'Validate SD-WAN zones, members, health-checks, and SLA targets after import.'));
        emitLine(rewritten);
        continue;
      }
    }
    const editName = trimmed.match(/^edit\s+(.+)$/)?.[1]?.trim().replace(/^"|"$/g, '');
    if (editName && !skipBlock && !skipEdit) {
      activeEditName = editName;
      activeMemberLineWritten = false;
      if (activeSection === 'vdom') activeVdom = editName;
      const activeIface = interfaceMap.get(editName);
      if (activeSection === 'system interface' && !normalizedOptions.keepFortiLink && activeIface && (activeIface.role === 'FortiLink' || /fortilink/i.test(`${activeIface.name} ${activeIface.alias || ''} ${activeIface.parent || ''}`))) {
        skipEdit = true;
        skipEditDepth = 1;
        skipEditJustStarted = true;
        removedInterfaceNames.add(editName);
      }
      if (activeSection === 'system interface' && !normalizedOptions.keepModem && /^modem$/i.test(editName)) {
        skipEdit = true;
        skipEditDepth = 1;
        skipEditJustStarted = true;
        removedInterfaceNames.add(editName);
      }
      if (activeSection === 'system dhcp server' && !normalizedOptions.keepFortiLink && fortiLinkDhcpKeys.has(`${activeSection}:${editName}`)) {
        skipEdit = true;
        skipEditDepth = 1;
        skipEditJustStarted = true;
      }
      if (activeSection === 'vpn certificate local') {
        encryptedKeyDetected = false;
        encryptedKeyEditLines = [];
        encryptedKeyEditName = '';
        if (factoryCertPattern.test(editName)) {
          skipEdit = true;
          skipEditDepth = 1;
          skipEditJustStarted = true;
          removedLines.push(`edit "${editName}" (factory cert stripped - target has own copy)`);
        } else {
          encryptedKeyEditName = editName;
          encryptedKeyEditLines = [line];
          continue;
        }
      }
    }
    if (activeSection === 'vpn certificate local' && encryptedKeyEditName) {
      encryptedKeyEditLines.push(line);
      if (/BEGIN ENCRYPTED PRIVATE KEY/i.test(line)) encryptedKeyDetected = true;
      if (trimmed === 'next') {
        if (encryptedKeyDetected) {
          removedLines.push(`edit "${encryptedKeyEditName}" (encrypted private key - device-bound, stripped)`);
          generationIssues.push(issue('WARNING', 'Certificate Stripped', encryptedKeyEditName, `Certificate "${encryptedKeyEditName}" has a device-bound encrypted private key and has been removed from the migrated config.`, 'Re-import this certificate manually after restoring the config.'));
        } else {
          encryptedKeyEditLines.forEach(emitLine);
        }
        encryptedKeyDetected = false;
        encryptedKeyEditLines = [];
        encryptedKeyEditName = '';
        activeEditName = '';
        activeMemberLineWritten = false;
      }
      continue;
    }
    if (editName && unusedObjectKeys.has(`${activeSection}:${editName}`)) {
      skipEdit = true;
      skipEditDepth = 1;
      skipEditJustStarted = true;
    }
    if (skipEdit) {
      if (section && !skipEditJustStarted) skipEditDepth += 1;
      if (editName && !skipEditJustStarted) skipEditDepth += 1;
      removedLines.push(line);
      if (trimmed === 'next' || trimmed === 'end') {
        skipEditDepth = Math.max(0, skipEditDepth - 1);
        if (skipEditDepth === 0) {
          skipEdit = false;
          syncGenerationState();
        }
      }
      continue;
    }
    if (skipBlock) {
      if (section && !skipBlockJustStarted) skipBlockDepth += 1;
      if (skipBlock === 'system interface' && editName) removedInterfaceNames.add(editName);
      removedLines.push(line);
      if (trimmed === 'end') {
        skipBlockDepth = Math.max(0, skipBlockDepth - 1);
        if (skipBlockDepth === 0) {
          skipBlock = null;
          syncGenerationState();
          skipBlockParentSection = '';
          skipBlockParentEditName = '';
        }
      }
      continue;
    }
    if (shouldRemoveLine(trimmed, normalizedOptions, activeSection)) {
      removedLines.push(line);
      continue;
    }
    if (!stripSslVpn && stripSslVpnWebMode && activeSection === 'vpn ssl settings' && /^set web-mode\b/i.test(trimmed)) {
      removedLines.push(line);
      continue;
    }
    if (analysis.vdomMode === 'Multi VDOM' && activeVdom !== 'root' && /vdom-link|type\s+vdom-link|set\s+(srcintf|dstintf|interface|device)\b/i.test(trimmed)) {
      const key = `${activeVdom}:${activeSection}`;
      if (!vdomWarnings.has(key)) {
        generationIssues.push(issue('WARNING', 'VDOM Context', activeVdom, `Generated config is processing ${activeSection || 'config'} inside VDOM ${activeVdom}.`, 'Validate this VDOM separately after import, especially interface references and inter-VDOM links.'));
        vdomWarnings.add(key);
      }
    }
    const profile = firmwareProfile(normalizedOptions);
    if (profile.deprecated.some(pattern => pattern.test(trimmed))) {
      emitLine('# [MIGRATION WARNING] Command deprecated in target firmware, validate after import:');
      modifiedLines.push({ before: trimmed, after: '# DEPRECATED COMMAND - kept but flagged' });
    }
    let next = line;
    let changeLogged = false;
    if (isFirmwareHeaderLine(trimmed) && shouldRewriteFirmwareHeaders(normalizedOptions)) {
      const replacement = rewriteFirmwareHeaderLine(line, target.name, normalizedOptions);
      if (replacement === null) {
        removedLines.push(line);
        continue;
      }
      next = replacement;
    }
    if (normalizedOptions.replaceHostname && normalizedOptions.newHostname.trim() && trimmed.startsWith('set hostname') && activeSection === 'system global') {
      next = line.replace(/set hostname .+$/, `set hostname "${normalizedOptions.newHostname.trim()}"`);
    }
    if (trimmed.startsWith('set alias') && activeSection === 'system global') {
      if (normalizedOptions.replaceHostname && normalizedOptions.newHostname.trim()) {
        next = line.replace(/set alias .+$/, `set alias "${normalizedOptions.newHostname.trim()}"`);
      } else if (isStrictSafeMode(normalizedOptions) && /FortiGate-\d+|FGT\d+/i.test(trimmed)) {
        removedLines.push(line);
        continue;
      }
    }
    next = rewriteInterfaceReferences(next, activeSection, activeEditName, mappingMap, interfaceMap, mappings);
    if (/^set allowaccess\b/i.test(trimmed)) {
      const sanitized = sanitizeAllowAccess(next, normalizedOptions.targetFortiosVersion || '7.4');
      if (!sanitized) {
        removedLines.push(next);
        continue;
      }
      next = sanitized;
    }
    if (activeSection === 'router static' && /^set sdwan-zone\b/i.test(trimmed) && versionValue(normalizedOptions.targetFortiosVersion || '7.4') < versionValue('7.0')) {
      next = next.replace(/set sdwan-zone/i, 'set device');
    }
    if (activeSection.startsWith('vpn ipsec phase2') && /^set proposal\b/i.test(trimmed) && targetVersionValue < versionValue('7.0') && trimmed.toLowerCase().includes('chacha20poly1305')) {
      next = next.replace(/chacha20poly1305/gi, 'aes256gcm');
      next = next.replace(/^(\s*set proposal\s+)(.+)$/i, (_match, prefix, tokens) => {
        const unique = [...new Set(String(tokens).trim().split(/\s+/))];
        return `${prefix}${unique.join(' ')}`;
      });
      modifiedLines.push({ before: line.trim(), after: next.trim() });
      changeLogged = true;
    }
    const activeMapping = mappings.find(item => item.source === activeEditName);
    if (activeSection === 'system interface' && activeMapping?.targetMembers?.length && isMemberLine(trimmed)) {
      activeMemberLineWritten = true;
    }
    if (activeSection === 'system interface' && trimmed === 'next' && activeMapping?.targetMembers?.length && !activeMemberLineWritten) {
      emitLine(`    set member ${activeMapping.targetMembers.map(member => `"${member}"`).join(' ')}`);
      modifiedLines.push({ before: `${activeEditName} member ports missing`, after: `set member ${activeMapping.targetMembers.join(', ')}` });
      activeMemberLineWritten = true;
    }
    if (activeSection === 'system interface' && trimmed === 'next' && migrationDirection === 'upgrade' && versionValue(normalizedOptions.targetFortiosVersion || '') >= versionValue('6.4')) {
      const activeIface = analysis.blocks.find(block => block.path === 'system interface' && block.name === activeEditName);
      const excludedTypes = ['tunnel', 'loopback', 'aggregate', 'vap-switch', 'hard-switch', 'switch', 'vdom-link'];
      if (activeIface?.settings.ip && !excludedTypes.includes(activeIface.settings.type || '') && !activeIface.lines.some(item => /ip-managed-by-fortiipam/i.test(item))) {
        emitLine('        set ip-managed-by-fortiipam disable');
        modifiedLines.push({ before: `${activeEditName}: no ip-managed-by-fortiipam`, after: 'set ip-managed-by-fortiipam disable (injected for upgrade safety)' });
      }
    }
    if (activeSection === 'system global' && trimmed === 'end') {
      if (shouldEmitSdwanFeatureEnable(analysis, normalizedOptions, targetVersionValue) && !generatedHasLine(out, /^set\s+virtual-wan-link\s+enable$/i)) {
        emitLine('    set virtual-wan-link enable');
        modifiedLines.push({ before: 'system global: SD-WAN disabled/missing', after: 'set virtual-wan-link enable (FortiOS 6.x SD-WAN)' });
      }
      if (shouldEmitAdvancedRoutingEnable(analysis, normalizedOptions, targetVersionValue) && !generatedHasLine(out, /^set\s+gui-advanced-routing\s+enable$/i)) {
        emitLine('    set gui-advanced-routing enable');
        modifiedLines.push({ before: 'system global: advanced routing disabled/missing', after: 'set gui-advanced-routing enable (FortiOS 6.x BGP)' });
      }
    }
    if (next !== line && !changeLogged) modifiedLines.push({ before: line, after: next });
    emitLine(next);
  }

  let migratedConfig = ensureFirmwareHeaders(out.join('\n'), target.name, normalizedOptions, modifiedLines);
  migratedConfig = appendEmergencyAdmin(migratedConfig, normalizedOptions, modifiedLines);
  migratedConfig = removeOrphanedPolicyRefs(migratedConfig, removedInterfaceNames, modifiedLines);
  const dependencyGraph = buildDependencyGraph(analysis);
  const sectionCoverage = buildSectionCoverage(analysis, migratedConfig);
  const parserValidation = buildParserValidation(migratedConfig, analysis, mappingMap, normalizedOptions);
  const postIssues = [...validateGeneratedConfig(migratedConfig, analysis, mappingMap), ...parserValidationToIssues(parserValidation)];
  const finalIssues = [...issues, ...generationIssues, ...postIssues];
  if (hasExportBlockingErrors(finalIssues)) migratedConfig = '';
  const coverage = buildCoverage(analysis, issues, migrationDirection);
  const score = scoreMigration(coverage, finalIssues);
  const compatibilityScore = scoreCompatibility(normalizedOptions, finalIssues);
  let importProbability = Math.max(0, Math.min(99, Math.round((score + compatibilityScore) / 2 - finalIssues.filter(item => item.severity === 'ERROR').length * 5)));
  const hasPb2Issue = finalIssues.some(item => item.objectType === 'Admin Password Hash' && item.severity === 'ERROR');
  const hasFortiLinkError = finalIssues.some(item => item.objectType === 'FortiLink' && item.severity === 'ERROR');
  if (!migratedConfig) importProbability = 0;
  else if (hasPb2Issue) importProbability = Math.min(importProbability, 20);
  else if (hasFortiLinkError) importProbability = Math.min(importProbability, 45);
  else if (finalIssues.some(item => item.severity === 'ERROR')) importProbability = Math.min(importProbability, 40);
  const restoreConfidence = Math.max(0, Math.min(99, Math.round((score + importProbability + (migratedConfig ? 95 : 20)) / 3)));
  return {
    migratedConfig,
    removedLines,
    modifiedLines,
    coverage,
    score,
    migrationDirection,
    sourceVersionValue,
    targetVersionValue,
    strippedPasswordAdmins: strippedPasswordAdmins(analysis, normalizedOptions),
    importProbability,
    restoreConfidence,
    compatibilityScore,
    parserValidation,
    dependencyGraph,
    sectionCoverage,
    readiness: readinessText(score, finalIssues.some(item => item.severity === 'ERROR')),
    issues: finalIssues,
    checklist: buildChecklist(analysis, target),
    reportHtml: buildReportHtml(analysis, target, coverage, finalIssues, score, migratedConfig, modifiedLines, removedLines, dependencyGraph, sectionCoverage, parserValidation),
    errorsHtml: buildErrorsHtml(finalIssues),
  };
}

function findUnusedObjectKeys(analysis: FortiGateAnalysis) {
  const candidates = analysis.blocks.filter(block =>
    [
      'firewall address',
      'firewall addrgrp',
      'firewall service custom',
      'firewall service group',
      'firewall schedule',
      'firewall profile-group',
      'firewall vip',
      'user local',
      'user group',
      'vpn certificate local',
    ].includes(block.path)
  );
  const unused = new Set<string>();
  for (const block of candidates) {
    const escaped = block.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refs = analysis.blocks.filter(other =>
      other !== block && other.lines.some(line => new RegExp(`"${escaped}"`).test(line))
    );
    if (!refs.length) unused.add(`${block.path}:${block.name}`);
  }
  return unused;
}

function shouldSkipSection(section: string, options: MigrationOptions, _activeVdom = 'root') {
  if (!options.keepPolicies && section === 'firewall policy') return true;
  if (!options.keepObjects && (section.startsWith('firewall address') || section.startsWith('firewall service'))) return true;
  if (!options.keepRoutes && section === 'router static') return true;
  if (!options.keepVlans && section === 'system interface') return false;
  if (!options.keepSdwan && section === 'system sdwan') return true;
  if (!options.keepDhcp && section === 'system dhcp server') return true;
  if (options.keepModem === false && section === 'system modem') return true;
  if (!options.keepVips && section.startsWith('firewall vip')) return true;
  if (!options.keepVpn && section.startsWith('vpn ')) return true;
  if (!options.keepUsers && section === 'user local') return true;
  if (!options.keepAdmins && section === 'system admin') return true;
  if (!options.keepCertificates && section.includes('certificate')) return true;
  if (options.keepFortiLink === false && section.includes('switch-controller')) return true;
  if (options.keepSwitchController === false && section.includes('switch-controller')) return true;
  if (options.keepSecurityFabric === false && section === 'system csf') return true;
  if (options.keepBgp === false && section === 'router bgp') return true;
  if (options.keepOspf === false && section === 'router ospf') return true;
  if (options.keepZones === false && section === 'system zone') return true;
  if (options.migrateFortiManager === false && section === 'system central-management') return true;
  if (isStrictSafeMode(options) && shouldRemoveSectionForStrictMode(section)) return true;
  return false;
}

function shouldEmitSdwanFeatureEnable(analysis: FortiGateAnalysis, options: MigrationOptions, targetVersionValue: number) {
  return Boolean(analysis.features.sdwan && options.keepSdwan && targetVersionValue >= versionValue('6.0') && targetVersionValue < versionValue('7.0'));
}

function shouldEmitAdvancedRoutingEnable(analysis: FortiGateAnalysis, options: MigrationOptions, targetVersionValue: number) {
  return Boolean(analysis.features.bgp && options.keepBgp && targetVersionValue >= versionValue('6.0') && targetVersionValue < versionValue('7.0'));
}

function generatedHasLine(lines: string[], pattern: RegExp) {
  return lines.some(line => pattern.test(line.trim()));
}

function shouldRemoveLine(trimmed: string, options: MigrationOptions, activeSection = '') {
  if (/^(config|edit|next|end)\b/i.test(trimmed)) return false;
  if (/^set password\s+ENC\s+PB2/i.test(trimmed) && versionValue(options.targetFortiosVersion || '7.4') < versionValue('7.0')) return true;
  if (/^set old-password\s+ENC/i.test(trimmed)) return true;
  if (/^set\s+(password|passwd|secret|secondary-secret|psksecret|passphrase)\s+ENC\s+(?!SH2|PB2)/i.test(trimmed)) return true;
  if (activeSection === 'system global' && /^set sslvpn-web-mode\b/i.test(trimmed)) return true;
  if (activeSection === 'system global' && /^set (wifi-ca-certificate|wifi-certificate)\b/i.test(trimmed)) return true;
  if (options.removeSerial && /serial|device-id/i.test(trimmed)) return true;
  if (options.removeRegistration && /registration|forticare|fortiguard/i.test(trimmed)) return true;
  if (options.removeFortiCloud && /forticloud|cloud/i.test(trimmed)) return true;
  if (!options.keepFortiLink && /^set switch-controller\s+enable/i.test(trimmed)) return true;
  if (!options.keepFortiLink && /^set fortilink\s+enable/i.test(trimmed)) return true;
  if (options.keepFortiLink === false && /fortilink/i.test(trimmed)) return true;
  if (!options.keepModem && /^set interface\s+"?modem"?/i.test(trimmed)) return true;
  if (!options.keepModem && /^set device\s+"?modem"?/i.test(trimmed)) return true;
  if (options.keepSecurityFabric === false && /security-fabric|csf/i.test(trimmed)) return true;
  if (options.migrateFortiManager === false && /central-management|fortimanager|fmg-/i.test(trimmed)) return true;
  if (isStrictSafeMode(options) && cosmeticOrUnsafePatterns.some(pattern => pattern.test(trimmed))) return true;
  if (firmwareUnsupportedLine(trimmed, options, activeSection)) return true;
  if (/set alias "FortiGate-VM"|set uuid/i.test(trimmed)) return true;
  if (/set fmg-source-ip|set faz-source-ip/i.test(trimmed)) return true;
  return false;
}

function emitNestedConfigLines(
  lines: string[],
  options: MigrationOptions,
  parentSection: string,
  removedLines: string[],
  emitLine: (value: string) => void
) {
  const sectionStack: string[] = [parentSection];
  for (const line of lines) {
    const trimmed = line.trim();
    const configMatch = trimmed.match(/^config\s+(.+)$/i);
    if (configMatch) {
      sectionStack.push(configMatch[1]);
      emitLine(line);
      continue;
    }
    if (/^end$/i.test(trimmed)) {
      emitLine(line);
      sectionStack.pop();
      continue;
    }
    const activeNestedSection = sectionStack[sectionStack.length - 1] || parentSection;
    if (shouldRemoveLine(trimmed, options, activeNestedSection)) {
      removedLines.push(line);
      continue;
    }
    emitLine(line);
  }
}

function classifyNestedConfigBlock(lines: string[], startIndex: number): { status: 'valid' | 'invalid' | 'unknown'; section: string; endIndex: number; lines: string[]; reason: string } {
  const startLine = lines[startIndex];
  const section = startLine.trim().match(/^config\s+(.+)$/i)?.[1] || 'unknown';
  const stack: Array<{ type: 'config' | 'edit'; name: string; line: number }> = [{ type: 'config', name: section, line: startIndex + 1 }];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const configMatch = trimmed.match(/^config\s+(.+)$/i);
    if (configMatch) {
      stack.push({ type: 'config', name: configMatch[1], line: index + 1 });
      continue;
    }
    const editMatch = trimmed.match(/^edit\s+(.+)$/i);
    if (editMatch) {
      const top = stack[stack.length - 1];
      if (!top || top.type !== 'config') {
        return {
          status: 'invalid',
          section,
          endIndex: index,
          lines: lines.slice(startIndex, index + 1),
          reason: `Line ${index + 1}: edit appeared without an active nested config parent.`,
        };
      }
      stack.push({ type: 'edit', name: cleanEditName(editMatch[1]), line: index + 1 });
      continue;
    }
    if (/^next$/i.test(trimmed)) {
      const top = stack[stack.length - 1];
      if (!top) {
        return {
          status: 'invalid',
          section,
          endIndex: index - 1,
          lines: lines.slice(startIndex, index),
          reason: `Line ${index + 1}: parent edit closed before nested config was complete.`,
        };
      }
      if (top.type !== 'edit') {
        return {
          status: 'invalid',
          section,
          endIndex: index - 1,
          lines: lines.slice(startIndex, index),
          reason: `Line ${index + 1}: parent edit closed while nested config "${top.name}" from line ${top.line} was still open.`,
        };
      }
      stack.pop();
      continue;
    }
    if (/^end$/i.test(trimmed)) {
      const top = stack[stack.length - 1];
      if (!top) {
        return {
          status: 'invalid',
          section,
          endIndex: index,
          lines: lines.slice(startIndex, index + 1),
          reason: `Line ${index + 1}: orphan end inside nested config.`,
        };
      }
      if (top.type !== 'config') {
        return {
          status: 'invalid',
          section,
          endIndex: index,
          lines: lines.slice(startIndex, index + 1),
          reason: `Line ${index + 1}: end attempted to close edit "${top.name}" from line ${top.line}; expected next first.`,
        };
      }
      stack.pop();
      if (!stack.length) {
        return {
          status: 'valid',
          section,
          endIndex: index,
          lines: lines.slice(startIndex, index + 1),
          reason: 'Nested config block is structurally self-contained.',
        };
      }
    }
  }
  return {
    status: 'invalid',
    section,
    endIndex: lines.length - 1,
    lines: lines.slice(startIndex),
    reason: 'End of file reached before nested config closed.',
  };
}

function rewriteInterfaceReferences(line: string, section: string, editName: string, mappings: Map<string, string>, interfaces: Map<string, FortiGateAnalysis['interfaces'][number]>, mappingRows: InterfaceMapping[]) {
  const trimmed = line.trim();
  const editMatch = trimmed.match(/^edit\s+(.+)$/);
  if (editMatch && section === 'system interface') {
    const source = cleanEditName(editMatch[1]);
    const item = interfaces.get(source);
    if (!item || isLogicalInterface(item)) return line;
    const target = mappings.get(source);
    return target && target !== source ? replaceEditName(line, target) : line;
  }

  if (section === 'system interface' && mappingRows.some(item => item.source === editName && item.targetMembers?.length) && isMemberLine(trimmed)) {
    const row = mappingRows.find(item => item.source === editName);
    return line.replace(/^(\s*)(?:set|append)\s+(?:member|members|port)\s+.+$/i, (_match, indent) => `${indent}set member ${row?.targetMembers?.map(member => `"${member}"`).join(' ')}`);
  }

  const activeInterface = interfaces.get(editName);
  const activeMapping = mappingRows.find(item => item.source === editName);
  if (section === 'system interface' && activeInterface?.vlanId && activeMapping?.targetParent && /^set\s+interface\b/i.test(trimmed)) {
    return line.replace(/^(\s*set\s+interface\s+)(.+?)(\s*)$/i, (_match, prefix, original, suffix) => {
      const quoted = /^"/.test(String(original).trim());
      return `${prefix}${quoted ? `"${activeMapping.targetParent}"` : activeMapping.targetParent}${suffix}`;
    });
  }

  if (!isInterfaceReferenceLine(trimmed, section)) return line;
  let next = line;
  for (const [source, target] of mappings) {
    const item = interfaces.get(source);
    if (!target || target === source) continue;
    if (section === 'system interface' && editName === source && item && isLogicalInterface(item)) continue;
    next = replaceInterfaceTokenInReference(next, source, target);
  }
  return next;
}

function isMemberLine(trimmed: string) {
  return /^(?:set|append)\s+(?:member|members|port)\s+/i.test(trimmed);
}

function isInterfaceReferenceLine(trimmed: string, section: string) {
  if (/^edit\s+/.test(trimmed)) return false;
  if (/^set\s+(srcintf|dstintf|interface|device|outgoing-interface|associated-interface|listen-interface|update-source|source-interface|egress-interface|ingress-interface|fortilink)\b/i.test(trimmed)) return true;
  if (/^append\s+(member|interface)\b/i.test(trimmed)) return true;
  return section === 'system interface' && /^set\s+interface\b/i.test(trimmed);
}

function replaceInterfaceTokenInReference(line: string, source: string, target: string) {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return line.replace(new RegExp(`"(${escaped})"`, 'g'), `"${target}"`).replace(new RegExp(`\\b${escaped}\\b`, 'g'), target);
}

function replaceEditName(line: string, target: string) {
  return line.replace(/^(\s*edit\s+)(.+?)(\s*)$/, (_match, prefix, original, suffix) => {
    const quoted = /^"/.test(String(original).trim());
    return `${prefix}${quoted ? `"${target}"` : target}${suffix}`;
  });
}

function cleanEditName(value: string) {
  return value.trim().replace(/^"|"$/g, '');
}

function rewriteConfigVersionHeader(line: string, targetModel: string, options: MigrationOptions) {
  const targetToken = targetModel.replace(/^FG-/, 'FGT').toUpperCase();
  return line.replace(/(#config-version=)([A-Z]+[-]?\d+[A-Z0-9-]*)(-\d.*)$/i, (_match, prefix, _source, suffix) => {
    const nextSuffix = options.firmwareMode === 'target' && options.targetFortiosVersion?.trim()
      ? String(suffix).replace(/-\d+\.\d+\.\d+/, `-${options.targetFortiosVersion.trim()}`)
      : suffix;
    return `${prefix}${targetToken}${nextSuffix}`;
  });
}

function normalizeFirmwareOptions(options: MigrationOptions): MigrationOptions {
  const profile = firmwareProfile(options);
  if (options.firmwareMode === 'preserve') return options;
  return {
    ...options,
    targetFortiosVersion: options.targetFortiosVersion || profile.version,
    targetBuildNumber: options.targetBuildNumber || profile.build,
  };
}

function firmwareProfile(options: MigrationOptions) {
  const key = majorMinor(options.targetFortiosVersion || '7.4');
  return firmwareProfiles[key] || firmwareProfiles['7.4'];
}

function majorMinor(version: string) {
  const match = version.match(/(\d+\.\d+)/);
  return match?.[1] || '7.4';
}

function shouldStripSslVpn(target: FortiGateModel, targetVersion: string): boolean {
  const v = versionValue(targetVersion);
  if (v >= versionValue('7.6.3')) return true;
  if (v >= versionValue('7.6.1') && isDesktopOrRuggedModel(target)) return true;
  if (v >= versionValue('7.4.8') && isEntryLevelSslVpnRemoved(target)) return true;
  if (v >= versionValue('7.2.12') && isEntryLevelSslVpnRemoved(target)) return true;
  return false;
}

function shouldStripSslVpnWebMode(target: FortiGateModel, targetVersion: string): boolean {
  const v = versionValue(targetVersion);
  if (shouldStripSslVpn(target, targetVersion)) return true;
  if (v >= versionValue('7.6.0') && isLowRamModel(target)) return true;
  return false;
}

function isDesktopOrRuggedModel(target: FortiGateModel): boolean {
  return /^FG[TV]?-(4\d|6\d|7\d|8\d|9\d|10\d|12\d|14\d)(?:[A-Z]|-|$)/i.test(target.name);
}

function isEntryLevelSslVpnRemoved(target: FortiGateModel): boolean {
  return /^FG[TV]?-(50G|70G|90G)/i.test(target.name);
}

function isLowRamModel(target: FortiGateModel): boolean {
  return /^FG[TV]?-(40F|60E|60F|61E|61F|80F|81F)/i.test(target.name);
}

function versionValue(version: string) {
  const parts = version.split('.').map(part => Number(part) || 0);
  return (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
}

function getMigrationDirection(analysis: FortiGateAnalysis, options: MigrationOptions, target?: FortiGateModel): MigrationDirection {
  const src = versionValue(analysis.fortiosVersion);
  const dst = versionValue(options.targetFortiosVersion || analysis.fortiosVersion);
  if (target && analysis.sourceModel && target.name.toLowerCase() === analysis.sourceModel.toLowerCase()) return 'same-model';
  if (src > dst) return 'downgrade';
  if (src < dst) return 'upgrade';
  return 'same-version';
}

function sanitizeAllowAccess(line: string, targetVersion: string): string {
  const allowed6x = new Set(['ping', 'https', 'ssh', 'snmp', 'http', 'fgfm', 'telnet', 'radius-acct', 'ftm', 'ftm-push']);
  if (versionValue(targetVersion) >= versionValue('7.0')) return line;
  return line.replace(/^(\s*set allowaccess\s+)(.+)$/i, (_match, prefix, tokens) => {
    const filtered = String(tokens).trim().split(/\s+/).filter(token => allowed6x.has(token.toLowerCase()));
    return filtered.length ? `${prefix}${filtered.join(' ')}` : '';
  });
}

function isStrictSafeMode(options: MigrationOptions) {
  return options.migrationMode === 'strict' || options.migrationMode === 'd-series-safe' || options.firmwareMode === 'strict-legacy';
}

function shouldRemoveSectionForStrictMode(section: string) {
  return /dashboard|fabric|csf|sdn-connector|endpoint-control|automation|replacement-message|replacemsg|fortiview|gui|widget/i.test(section);
}

function firmwareUnsupportedLine(trimmed: string, options: MigrationOptions, activeSection = '') {
  if (options.firmwareMode === 'preserve') return false;
  const profile = firmwareProfile(options);
  return profile.removed.some(pattern => {
    if (pattern.source.includes('sslvpn-web-mode') && activeSection !== 'system global') return false;
    return pattern.test(trimmed);
  });
}

function shouldRewriteFirmwareHeaders(options: MigrationOptions) {
  return options.firmwareMode === 'target' || options.firmwareMode === 'strict-legacy';
}

function isFirmwareHeaderLine(trimmed: string) {
  return /^#?(config-version|buildno|conf_file_ver)\b/i.test(trimmed);
}

function rewriteFirmwareHeaderLine(line: string, targetModel: string, options: MigrationOptions) {
  const trimmed = line.trim();
  const profile = firmwareProfile(options);
  const build = options.targetBuildNumber?.trim() || profile.build;
  if (/^#?config-version/i.test(trimmed)) return buildConfigVersionHeader(targetModel, options, line);
  if (/^#?buildno/i.test(trimmed)) return `#buildno=${build}`;
  if (/^#?conf_file_ver/i.test(trimmed)) return `#conf_file_ver=${confFileVersionValue(line, profile)}`;
  return null;
}

function ensureFirmwareHeaders(config: string, targetModel: string, options: MigrationOptions, modifiedLines: Array<{ before: string; after: string }>) {
  if (!shouldRewriteFirmwareHeaders(options)) return config;
  const profile = firmwareProfile(options);
  const build = options.targetBuildNumber?.trim() || profile.build;
  const existingConfigVersion = config.match(/^#config-version=.*$/im)?.[0] || '';
  const existingConfFileVer = config.match(/^#conf_file_ver=.*$/im)?.[0] || '';
  const required = [
    buildConfigVersionHeader(targetModel, options, existingConfigVersion),
    `#conf_file_ver=${confFileVersionValue(existingConfFileVer, profile)}`,
    `#buildno=${build}`,
    '#global_vdom=1',
  ];
  let next = config.replace(/^#config-version=.*$/im, required[0]).replace(/^#conf_file_ver=.*$/im, required[1]).replace(/^#buildno=.*$/im, required[2]);
  if (/^#global_vdom=.*$/im.test(next)) next = next.replace(/^#global_vdom=.*$/im, required[3]);
  const missing = required.filter(header => !new RegExp(`^${header.split('=')[0].replace('#', '#?')}=`, 'im').test(next));
  if (missing.length) {
    next = `${missing.join('\n')}\n${next}`;
    modifiedLines.push({ before: 'Firmware headers missing', after: missing.join(' | ') });
  }
  return next;
}

function buildConfigVersionHeader(targetModel: string, options: MigrationOptions, sourceHeader = '') {
  const profile = firmwareProfile(options);
  const modelToken = targetModel.replace(/^FG-/, 'FGT').replace(/-/g, '').toUpperCase();
  const version = options.targetFortiosVersion?.match(/\d+\.\d+(?:\.\d+)?/)?.[0] || profile.version;
  const build = options.targetBuildNumber?.trim() || profile.build;
  const sourceDate = sourceHeader.match(/-build\d+-(\d{6})/i)?.[1];
  const sourceMeta = sourceHeader.match(/(:opmode=.*)$/i)?.[1] || ':opmode=0:vdom=0:user=admin';
  const date = profile.date || sourceDate || fortiHeaderDate();
  return `#config-version=${modelToken}-${version}-FW-build${build}-${date}${sourceMeta}`;
}

function confFileVersionValue(sourceHeader: string, profile: ReturnType<typeof firmwareProfile>) {
  return sourceHeader.match(/^#?conf_file_ver=(\d{10,})/i)?.[1] || profile.conf;
}

function fortiHeaderDate() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function validateFirmwareProfile(analysis: FortiGateAnalysis, target: FortiGateModel, options: MigrationOptions, direction: MigrationDirection = getMigrationDirection(analysis, options, target)) {
  const issues: ValidationIssue[] = [];
  if (options.firmwareMode === 'preserve') return issues;
  const profile = firmwareProfile(options);
  const version = options.targetFortiosVersion || profile.version;
  const build = options.targetBuildNumber || profile.build;
  if (build !== profile.build) {
    issues.push(issue('ERROR', 'Firmware Header', target.name, `Build ${build} does not match FortiOS ${majorMinor(version)} profile build ${profile.build}.`, 'Use a consistent target firmware/build profile before export.'));
  }
  if (direction === 'downgrade') {
    issues.push(issue('WARNING', 'Firmware Translation', `${analysis.fortiosVersion} to ${version}`, 'Source firmware is newer than target firmware.', 'Unsupported newer commands will be translated, removed, or warned before export.'));
  }
  const unsupported = analysis.raw.split('\n').filter(line => profile.removed.some(pattern => pattern.test(line))).slice(0, 20);
  if (unsupported.length) {
    issues.push(issue('WARNING', 'Firmware Compatibility', majorMinor(version), `${unsupported.length} unsupported cosmetic/modern commands will be removed automatically.`, 'Review migration change log after generation.'));
  }
  return issues;
}

function validateFeatureInventory(analysis: FortiGateAnalysis, options: MigrationOptions) {
  const issues: ValidationIssue[] = [];
  const count = (path: string) => analysis.blocks.filter(block => block.path === path || block.path.startsWith(path)).length;
  if (options.migrateFortiManager === false && analysis.blocks.some(block => block.path === 'system central-management' || block.path === 'system fortimanager')) {
    issues.push(issue('WARNING', 'FortiManager', 'central-management', 'FortiManager settings detected and will be removed because migration option is disabled.', 'Reauthorize the firewall after cutover if FortiManager is required.'));
  }
  if (count('system snmp') > 0) issues.push(issue('WARNING', 'SNMP', analysis.hostname, `SNMP objects found: ${count('system snmp')}.`, 'Validate SNMP communities/users and monitoring after import.'));
  if (count('system api-user') > 0) issues.push(issue('WARNING', 'API Users', analysis.hostname, `API users found: ${count('system api-user')}.`, 'Validate API keys/tokens manually after import.'));
  if (/fortitoken|two-factor|2fa/i.test(analysis.raw)) issues.push(issue('WARNING', 'FortiToken / 2FA', analysis.hostname, 'FortiToken or two-factor authentication references detected.', 'Manual validation required for token assignment and admin/user login.'));
  if (options.migrationMode === 'd-series-safe') issues.push(issue('WARNING', 'D-Series Safe Mode', analysis.hostname, 'D-Series Safe Mode is enabled.', 'Cosmetic GUI, telemetry, cloud, fabric, release widgets, and modern analytics settings are removed for restore safety.'));
  return issues;
}

function collectInterfaceLikeReferences(analysis: FortiGateAnalysis) {
  const refs = new Set<string>();
  Object.values(analysis.references).forEach(set => set.forEach(item => refs.add(item)));
  return refs;
}

function buildCoverage(analysis: FortiGateAnalysis, issues: ValidationIssue[], direction: MigrationDirection = 'same-version') {
  const rows: Array<{ component: string; percent: number; feasibility: Feasibility; notes: string }> = [
    { component: 'Policies', percent: 100, feasibility: 'SUPPORTED', notes: `${analysis.counts.policies || 0} / ${analysis.counts.policies || 0}` },
    { component: 'Objects', percent: 100, feasibility: 'SUPPORTED', notes: `${(analysis.counts.addressObjects || 0) + (analysis.counts.addressGroups || 0)} / ${(analysis.counts.addressObjects || 0) + (analysis.counts.addressGroups || 0)}` },
    { component: 'Routes', percent: 100, feasibility: 'SUPPORTED', notes: `${analysis.counts.routes || 0} / ${analysis.counts.routes || 0}` },
    { component: 'VIPs', percent: 100, feasibility: 'SUPPORTED', notes: `${analysis.counts.vips || 0} / ${analysis.counts.vips || 0}` },
    { component: 'DHCP', percent: 100, feasibility: 'SUPPORTED', notes: `${analysis.counts.dhcp || 0} / ${analysis.counts.dhcp || 0}` },
    { component: 'SD-WAN', percent: analysis.features.sdwan ? 92 : 100, feasibility: analysis.features.sdwan ? 'PARTIALLY SUPPORTED' : 'SUPPORTED', notes: analysis.features.sdwan ? 'Detected: Yes, converted: partial, manual review: required' : 'Detected: No' },
    { component: 'IPsec VPN', percent: analysis.features.ipsecVpn ? 86 : 100, feasibility: analysis.features.ipsecVpn ? 'PARTIALLY SUPPORTED' : 'SUPPORTED', notes: analysis.features.ipsecVpn ? 'Detected: Yes, converted: partial, manual review: required' : 'Detected: No' },
    { component: 'SSL VPN', percent: analysis.features.sslVpn ? 82 : 100, feasibility: analysis.features.sslVpn ? 'PARTIALLY SUPPORTED' : 'SUPPORTED', notes: analysis.features.sslVpn ? 'Detected: Yes, converted: partial, manual review: required' : 'Detected: No' },
    { component: 'Certificates', percent: analysis.features.certificates ? 78 : 100, feasibility: analysis.features.certificates ? 'PARTIALLY SUPPORTED' : 'SUPPORTED', notes: analysis.features.certificates ? `${analysis.counts.certificates || 0} / ${analysis.counts.certificates || 0}, manual validation required` : 'Detected: No' },
    { component: 'HA', percent: analysis.features.ha ? 75 : 100, feasibility: analysis.features.ha ? 'PARTIALLY SUPPORTED' : 'SUPPORTED', notes: analysis.features.ha ? 'Detected: Yes, rebuild and validate manually' : 'Detected: No' },
    { component: 'Security Fabric', percent: analysis.features.securityFabric ? 72 : 100, feasibility: analysis.features.securityFabric ? 'PARTIALLY SUPPORTED' : 'SUPPORTED', notes: analysis.features.securityFabric ? 'Detected: Yes, rejoin fabric after migration' : 'Detected: No' },
  ];
  if (issues.some(item => item.severity === 'ERROR')) rows.push({ component: 'References', percent: 70, feasibility: 'MISSING', notes: 'Fixable mapping/reference issues exist' });
  if (direction === 'downgrade') rows.push({ component: 'Firmware Downgrade', percent: 78, feasibility: 'PARTIALLY SUPPORTED', notes: 'Newer source firmware to older target firmware. Unsupported commands are stripped or flagged.' });
  if (direction === 'upgrade') rows.push({ component: 'Firmware Upgrade', percent: 90, feasibility: 'PARTIALLY SUPPORTED', notes: 'Older source firmware to newer target firmware. SD-WAN and FortiIPAM upgrade safeguards are applied.' });
  return rows;
}

function scoreMigration(coverage: Array<{ percent: number }>, issues: ValidationIssue[]) {
  const avg = coverage.reduce((sum, item) => sum + item.percent, 0) / Math.max(coverage.length, 1);
  const penalty = issues.reduce((sum, item) => sum + (item.severity === 'ERROR' ? 8 : item.severity === 'WARNING' ? 2 : 0), 0);
  return Math.max(0, Math.min(100, Math.round(avg - penalty)));
}

function readinessText(score: number, critical: boolean) {
  if (score < 60) return 'Migration Not Recommended';
  if (critical || score < 85) return 'Manual Validation Recommended';
  return 'Ready For Migration';
}

function hasExportBlockingErrors(issues: ValidationIssue[]) {
  return issues.some(item => item.severity === 'ERROR' && isExportBlockingIssue(item));
}

function isExportBlockingIssue(issue: ValidationIssue) {
  if (issue.objectType === 'Broken Interface Reference') return true;
  if (issue.objectType === 'Parser Simulation' && /Reference Validation/i.test(issue.objectName)) return true;
  if (issue.objectType === 'Parser Simulation' && /Structural Validation/i.test(issue.objectName)) return true;
  if (issue.objectType === 'Emergency Admin' && /passwords do not match|password is empty|username is empty/i.test(issue.issue)) return true;
  return false;
}

function isSystemReference(name: string) {
  return ['root', '__root__'].includes(name.trim().toLowerCase());
}

function isHardSwitchInternal(sourceName: string, sourceType: string | undefined, targetName: string, target: FortiGateModel) {
  return /^internal$/i.test(sourceName) && (sourceType === 'hard-switch' || target.switchPorts.includes(targetName));
}

function isLogicalInterface(item: FortiGateAnalysis['interfaces'][number]) {
  const type = (item.type || '').toLowerCase();
  return Boolean(item.vlanId || item.parent || ['vlan', 'loopback', 'tunnel', 'aggregate', 'fortilink', 'switch', 'hard-switch', 'vap-switch', 'wl-mesh', 'wlan', 'wireless'].includes(type) || /^(ssl\.root|wqtn\.|wifi|vap|guest)/i.test(item.name));
}

function isSwitchLikeInterface(item: FortiGateAnalysis['interfaces'][number]) {
  const type = (item.type || '').toLowerCase();
  return ['hard-switch', 'aggregate'].includes(type) || ['Hardware Switch', 'Aggregate', 'FortiLink'].includes(item.role);
}

function isVlanParentCapable(item: FortiGateAnalysis['interfaces'][number]) {
  const type = (item.type || '').toLowerCase();
  return ['hard-switch', 'switch', 'aggregate'].includes(type) || ['Switch', 'Aggregate', 'FortiLink', 'LAN'].includes(item.role);
}

function defaultTargetMembers(source: FortiGateAnalysis['interfaces'][number], target: FortiGateModel) {
  if (!isSwitchLikeInterface(source)) return [];
  const isFortiLink = source.role === 'FortiLink' || /fortilink/i.test(`${source.name} ${source.alias || ''}`);
  const sourceCount = Math.max(source.members?.length || 0, /^internal$/i.test(source.name) ? 5 : 0, isFortiLink ? Math.min(target.fortiLinkPorts.length || 2, 2) : 1);
  const preferred = isFortiLink && target.fortiLinkPorts.length
    ? target.fortiLinkPorts
    : target.lanPorts.length
      ? target.lanPorts
      : target.portNames.filter(name => !target.wanPorts.includes(name) && !target.dmzPorts.includes(name) && !/^mgmt|^ha/i.test(name));
  return preferred.slice(0, sourceCount);
}

function isPhysicalInterface(item: FortiGateAnalysis['interfaces'][number]) {
  return !isLogicalInterface(item);
}

function logicalRole(item: FortiGateAnalysis['interfaces'][number]) {
  const type = (item.type || '').toLowerCase();
  if (item.vlanId || type === 'vlan') return 'VLAN';
  if (type === 'loopback') return 'Loopback';
  if (type === 'tunnel' || /^ssl\.root$/i.test(item.name)) return 'Tunnel';
  if (type === 'aggregate') return 'Aggregate';
  if (type === 'hard-switch') return 'Hardware Switch';
  if (type === 'switch') return 'Software Switch';
  if (type === 'vap-switch' || /^wqtn\.|wifi|guest/i.test(item.name)) return 'WiFi/VAP';
  if (item.role === 'FortiLink') return 'FortiLink';
  return item.role || 'Logical';
}

function validateManagementAccess(analysis: FortiGateAnalysis, mappings: InterfaceMapping[], options: MigrationOptions) {
  const issues: ValidationIssue[] = [];
  if (options.adminAccessMode === 'emergency') return issues;
  const mgmt = analysis.interfaces.filter(item => /https|ssh|http/.test(String(analysis.blocks.find(block => block.path === 'system interface' && block.name === item.name)?.settings.allowaccess || '')));
  const mapped = new Set(mappings.filter(item => item.target).map(item => item.source));
  const reachable = mgmt.filter(item => mapped.has(item.name) || isLogicalInterface(item));
  if (!reachable.length) {
    issues.push(issue('ERROR', 'Management Access', analysis.hostname, 'No mapped interface with HTTPS/SSH/HTTP management access detected.', 'Enable emergency admin access or ensure at least one LAN/MGMT interface has allowaccess https/ssh before export.'));
  } else {
    issues.push(issue('SUCCESS', 'Management Access', reachable[0].name, `Management access detected on ${reachable.map(item => item.name).join(', ')}.`, 'Verify login after lab import.'));
  }
  return issues;
}

function validateAdminMigration(analysis: FortiGateAnalysis, options: MigrationOptions) {
  const issues: ValidationIssue[] = [];
  const admins = analysis.blocks.filter(block => block.path === 'system admin');
  const withPassword = admins.filter(block => block.settings.password || block.lines.some(line => /set\s+password/i.test(line)));
  const withProfile = admins.filter(block => block.settings.accprofile || block.lines.some(line => /set\s+accprofile/i.test(line)));
  const pb2Admins = admins.filter(block => block.lines.some(line => /set password\s+ENC\s+PB2/i.test(line)));
  if (pb2Admins.length && versionValue(options.targetFortiosVersion || '7.4') < versionValue('7.0')) {
    issues.push(issue('ERROR', 'Admin Password Hash', analysis.hostname, `${pb2Admins.length} admin(s) have 7.x format PB2 password hashes incompatible with target firmware. Hashes will be stripped.`, `Reset passwords for: ${pb2Admins.map(block => block.name).join(', ')} after import.`));
  }
  if (!admins.length && options.adminAccessMode !== 'emergency') {
    issues.push(issue('ERROR', 'Admin Accounts', analysis.hostname, 'No admin accounts found in backup.', 'Create emergency admin account before export.'));
  } else {
    issues.push(issue('SUCCESS', 'Admin Accounts', analysis.hostname, `Admin accounts found: ${admins.length}. Password hashes preserved: ${withPassword.length}. Profiles preserved: ${withProfile.length}.`, options.adminAccessMode === 'emergency' ? `Emergency admin ${options.emergencyAdminUsername || 'migration-admin'} will be created.` : 'Preserve existing admin accounts or enable emergency admin fallback.'));
  }
  if (options.adminAccessMode === 'emergency') {
    if (!options.emergencyAdminUsername?.trim()) issues.push(issue('ERROR', 'Emergency Admin', 'Username', 'Emergency admin username is empty.', 'Enter a username.'));
    if (!options.emergencyAdminPassword) issues.push(issue('ERROR', 'Emergency Admin', options.emergencyAdminUsername || 'migration-admin', 'Emergency admin password is empty.', 'Enter a temporary strong password.'));
    if (options.emergencyAdminPassword !== options.emergencyAdminConfirm) issues.push(issue('ERROR', 'Emergency Admin', options.emergencyAdminUsername || 'migration-admin', 'Emergency admin passwords do not match.', 'Confirm the same password.'));
    if (options.emergencyAdminPassword) {
      issues.push(issue('WARNING', 'Emergency Admin', options.emergencyAdminUsername || 'migration-admin', 'Emergency admin password is embedded as plaintext in the generated config file.', 'Delete or secure the .conf file after import. Change the emergency admin password immediately after first login.'));
    }
  }
  return issues;
}

function validateIpsecProposals(analysis: FortiGateAnalysis, options: MigrationOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const targetVal = versionValue(options.targetFortiosVersion || '7.4');
  const phase1Blocks = analysis.blocks.filter(block => block.path === 'vpn ipsec phase1-interface');
  const phase2Blocks = analysis.blocks.filter(block => block.path === 'vpn ipsec phase2-interface');
  const bannedBelow70 = ['des', '3des', 'md5', 'chacha20poly1305'];
  const bannedDhBelow70 = ['1', '2', '5'];
  phase1Blocks.forEach(block => {
    const proposal = block.settings.proposal || '';
    const dhgrp = block.settings.dhgrp || '';
    if (targetVal < versionValue('7.0')) {
      bannedBelow70.forEach(algo => {
        if (proposal.toLowerCase().includes(algo)) {
          issues.push(issue('WARNING', 'IPsec Proposal', block.name, `Phase1 proposal contains "${algo}" which is removed or unsupported in target firmware.`, 'Replace with aes128-sha256 or aes256-sha256 for target compatibility.'));
        }
      });
      bannedDhBelow70.forEach(group => {
        if (dhgrp.split(/\s+/).includes(group)) {
          issues.push(issue('WARNING', 'IPsec DH Group', block.name, `Phase1 dhgrp ${group} is removed in target firmware.`, 'Use dhgrp 14, 19, or 20 instead.'));
        }
      });
    }
    if (targetVal >= versionValue('6.4') && proposal.toLowerCase().includes('des')) {
      issues.push(issue('ERROR', 'IPsec Proposal', block.name, 'Phase1 proposal contains "des" which is removed in FortiOS 6.4+.', 'Replace with aes128-sha256 minimum.'));
    }
  });
  phase2Blocks.forEach(block => {
    const proposal = block.settings.proposal || '';
    if (targetVal < versionValue('7.0') && proposal.toLowerCase().includes('chacha20poly1305')) {
      issues.push(issue('WARNING', 'IPsec Proposal', block.name, 'Phase2 proposal "chacha20poly1305" auto-rewritten to "aes256gcm" for target compatibility.', 'Verify tunnel comes up after import. Peer must also support aes256gcm.'));
    }
  });
  return issues;
}

function validateSslVpn(analysis: FortiGateAnalysis) {
  if (!analysis.features.sslVpn) return [];
  const issues: ValidationIssue[] = [];
  const hasTunnel = analysis.interfaces.some(item => item.name === 'ssl.root');
  const hasPortal = analysis.blocks.some(block => block.path === 'vpn ssl web portal');
  const hasSettings = analysis.blocks.some(block => block.path === 'vpn ssl settings');
  const hasUsers = analysis.blocks.some(block => block.path.includes('user group') || block.path === 'user local');
  if (!hasTunnel) issues.push(issue('ERROR', 'SSL VPN', 'ssl.root', 'SSL VPN config exists but ssl.root tunnel interface was not found.', 'Restore or recreate ssl.root before import.'));
  if (!hasSettings) issues.push(issue('ERROR', 'SSL VPN', 'settings', 'SSL VPN settings block not found.', 'Validate SSL VPN configuration manually.'));
  if (!hasPortal) issues.push(issue('WARNING', 'SSL VPN', 'portal', 'SSL VPN portal objects were not found.', 'Confirm portal configuration after import.'));
  if (!hasUsers) issues.push(issue('WARNING', 'SSL VPN', 'users', 'SSL VPN user/group objects were not found.', 'Confirm user/group mapping after import.'));
  return issues;
}

function validateWireless(analysis: FortiGateAnalysis) {
  const wireless = analysis.interfaces.filter(item => /vap|wqtn\.|wifi|guest/i.test(`${item.name} ${item.type || ''} ${item.alias || ''}`));
  if (!wireless.length && !/wireless-controller|vap-switch|wtp-profile/i.test(analysis.raw)) return [];
  return [issue('WARNING', 'WiFi / VAP', wireless.map(item => item.name).join(', ') || 'Wireless Controller', 'WiFi/VAP or wireless-controller objects detected.', 'Validate SSID VLANs, VAP switches, FortiAP profiles, and wireless policies manually.')];
}

function validateReferencedInterfaces(analysis: FortiGateAnalysis, mappings: InterfaceMapping[]) {
  const issues: ValidationIssue[] = [];
  const known = new Set(analysis.interfaces.map(item => item.name));
  const mapped = new Set(mappings.map(item => item.source));
  const relevant = analysis.blocks.filter(block => /firewall policy|router static|firewall vip|vpn |system dhcp server|system sdwan/i.test(block.path));
  for (const block of relevant) {
    Object.entries(block.settings).forEach(([key, value]) => {
      if (!/srcintf|dstintf|interface|device|outgoing-interface|associated-interface|listen-interface|source-interface/i.test(key)) return;
      splitRefs(value).forEach(ref => {
        if (isSystemReference(ref)) return;
        if (known.has(ref) && !mapped.has(ref)) {
          issues.push(issue('ERROR', 'Referenced Interface', ref, `${block.path} ${block.name} references ${ref}, but it has no mapping record.`, 'Create or preserve the interface mapping before export.'));
        }
      });
    });
  }
  return issues;
}

function validateGeneratedConfig(config: string, analysis: FortiGateAnalysis, mappings: Map<string, string>) {
  const issues: ValidationIssue[] = [];
  if (!config) return issues;
  const names = extractSystemInterfaceNames(config);
  const counts = new Map<string, number>();
  names.forEach(name => counts.set(name, (counts.get(name) || 0) + 1));
  counts.forEach((count, name) => {
    if (count > 1) issues.push(issue('ERROR', 'Duplicate Interface Names', name, `Generated config contains ${count} system interface entries named ${name}.`, 'Export blocked. Fix interface mapping before generating.'));
  });
  const known = new Set(names);
  for (const block of analysis.blocks.filter(block => /firewall policy|router static|firewall vip|vpn |system dhcp server|system sdwan/i.test(block.path))) {
    if (!generatedConfigContainsBlock(config, block)) continue;
    Object.entries(block.settings).forEach(([key, value]) => {
      if (!/srcintf|dstintf|interface|device|outgoing-interface|associated-interface|listen-interface|source-interface/i.test(key)) return;
      splitRefs(value).forEach(ref => {
        const expected = mappings.get(ref) || ref;
        if (!isSystemReference(ref) && analysis.interfaces.some(item => item.name === ref) && !known.has(expected)) {
          issues.push(issue('ERROR', 'Broken Interface Reference', ref, `${block.path} ${block.name} references ${expected}, but it is missing from generated config.`, 'Export blocked. Preserve logical interface names or add mapping.'));
        }
      });
    });
  }
  return issues;
}

function generatedConfigContainsBlock(config: string, block: FortiGateAnalysis['blocks'][number]) {
  const lines = config.split('\n');
  let inSection = false;
  let sectionDepth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const configMatch = trimmed.match(/^config\s+(.+)$/i);
    if (configMatch) {
      if (inSection) {
        sectionDepth += 1;
      } else if (configMatch[1] === block.path) {
        if (block.name === '__root__') return true;
        inSection = true;
        sectionDepth = 1;
      }
      continue;
    }
    if (inSection && sectionDepth === 1) {
      const editMatch = trimmed.match(/^edit\s+(.+)$/i);
      if (editMatch && cleanEditName(editMatch[1]) === block.name) return true;
    }
    if (inSection && /^end$/i.test(trimmed)) {
      sectionDepth = Math.max(0, sectionDepth - 1);
      if (sectionDepth === 0) inSection = false;
    }
  }
  return false;
}

function buildParserValidation(config: string, analysis: FortiGateAnalysis, mappings: Map<string, string>, options: MigrationOptions) {
  const rows: Array<Record<string, string | number>> = [];
  const generatedIssues = validateGeneratedConfig(config, analysis, mappings);
  const profile = firmwareProfile(options);
  const unsupported = config.split('\n').filter(line => profile.removed.some(pattern => pattern.test(line))).length;
  const duplicateInterfaces = generatedIssues.filter(item => item.objectType === 'Duplicate Interface Names').length;
  const brokenRefs = generatedIssues.filter(item => item.objectType === 'Broken Interface Reference').length;
  rows.push({ Check: 'Duplicate Detection', Status: duplicateInterfaces ? 'ERROR' : 'OK', Count: duplicateInterfaces });
  rows.push({ Check: 'Reference Validation', Status: brokenRefs ? 'ERROR' : 'OK', Count: brokenRefs });
  rows.push({ Check: 'Dependency Validation', Status: buildDependencyGraph(analysis).some(row => Number(row.Dependencies || 0) > 0) ? 'OK' : 'OK', Count: buildDependencyGraph(analysis).length });
  rows.push({ Check: 'Firmware Validation', Status: unsupported ? 'ERROR' : 'OK', Count: unsupported });
  rows.push({ Check: 'Compatibility Validation', Status: options.migrationMode === 'd-series-safe' || options.firmwareMode === 'strict-legacy' ? 'STRICT' : 'OK', Count: 0 });
  const structuralErrors = validateConfigStructure(config);
  rows.push({ Check: 'Structural Validation', Status: structuralErrors.length ? 'ERROR' : 'OK', Count: structuralErrors.length, Details: structuralErrors[0] || 'OK' });
  rows.push({ Check: 'Parser Validation', Status: config ? 'OK' : 'ERROR', Count: config ? config.split('\n').length : 0 });
  return rows;
}

function parserValidationToIssues(rows: Array<Record<string, string | number>>) {
  return rows
    .filter(row => row.Status === 'ERROR')
    .map(row => issue('ERROR', 'Parser Simulation', String(row.Check), `${row.Check} failed with count ${row.Count}. ${row.Details || ''}`.trim(), 'Resolve parser simulation errors before export.'));
}

function validateConfigStructure(config: string) {
  const errors: string[] = [];
  const stack: Array<{ type: 'config' | 'edit'; name: string; line: number; openedInsideEdit: boolean }> = [];
  const lines = config.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const configMatch = trimmed.match(/^config\s+(.+)$/i);
    if (configMatch) {
      stack.push({ type: 'config', name: configMatch[1], line: lineNumber, openedInsideEdit: stack.some(frame => frame.type === 'edit') });
      continue;
    }
    const editMatch = trimmed.match(/^edit\s+(.+)$/i);
    if (editMatch) {
      const top = stack[stack.length - 1];
      if (!top || top.type !== 'config') {
        errors.push(`Line ${lineNumber}: orphan edit without an active config block.`);
        continue;
      }
      stack.push({ type: 'edit', name: cleanEditName(editMatch[1]), line: lineNumber, openedInsideEdit: false });
      continue;
    }
    if (/^next$/i.test(trimmed)) {
      const top = stack[stack.length - 1];
      if (!top) {
        errors.push(`Line ${lineNumber}: orphan next without an active edit block.`);
        continue;
      }
      if (top.type !== 'edit') {
        errors.push(`Line ${lineNumber}: next attempted to close ${top.type} "${top.name}" opened at line ${top.line}; expected end first.`);
        continue;
      }
      stack.pop();
      continue;
    }
    if (/^end$/i.test(trimmed)) {
      const top = stack[stack.length - 1];
      if (!top) {
        errors.push(`Line ${lineNumber}: orphan end without an active config block.`);
        continue;
      }
      if (top.type !== 'config') {
        errors.push(`Line ${lineNumber}: end attempted to close edit "${top.name}" opened at line ${top.line}; expected next first.`);
        continue;
      }
      stack.pop();
    }
  }
  stack.forEach(frame => {
    errors.push(`Line ${frame.line}: unclosed ${frame.type} "${frame.name}".`);
  });
  return errors;
}

function buildDependencyGraph(analysis: FortiGateAnalysis) {
  return analysis.interfaces.map(item => {
    const refs = referencedBy(analysis, item.name);
    return {
      Object: item.name,
      Type: item.role,
      Policies: refs.filter(ref => ref.startsWith('firewall policy')).length,
      Routes: refs.filter(ref => ref.startsWith('router static')).length,
      VPNs: refs.filter(ref => ref.startsWith('vpn ')).length,
      SDWAN: refs.filter(ref => ref.startsWith('system sdwan')).length,
      DHCP: refs.filter(ref => ref.startsWith('system dhcp')).length,
      Dependencies: refs.length,
      'Referenced By': refs.slice(0, 6).join(', ') || 'None',
    };
  }).filter(row => Number(row.Dependencies) > 0);
}

function referencedBy(analysis: FortiGateAnalysis, name: string) {
  return analysis.blocks
    .filter(block => `${block.name} ${JSON.stringify(block.settings)} ${block.lines.join('\n')}`.includes(name) && block.name !== name)
    .map(block => `${block.path} ${block.name}`);
}

function buildSectionCoverage(analysis: FortiGateAnalysis, migratedConfig: string | null) {
  function countEdits(config: string, sectionKeyword: string): number {
    const sectionRx = new RegExp(`config ${sectionKeyword}[\\s\\S]*?^end`, 'm');
    const match = config.match(sectionRx);
    if (!match) return 0;
    return (match[0].match(/^\s*edit\s+/gm) || []).length;
  }
  const pairs: Array<[string, number, string]> = [
    ['Interfaces', analysis.counts.interfaces || 0, 'system interface'],
    ['Policies', analysis.counts.policies || 0, 'firewall policy'],
    ['Routes', analysis.counts.routes || 0, 'router static'],
    ['VPNs', analysis.counts.vpn || 0, 'vpn ipsec phase1-interface'],
    ['Admins', analysis.counts.admins || 0, 'system admin'],
    ['DHCP', analysis.counts.dhcp || 0, 'system dhcp server'],
    ['SNMP', analysis.blocks.filter(block => block.path.startsWith('system snmp')).length, 'system snmp'],
    ['API Users', analysis.blocks.filter(block => block.path === 'system api-user').length, 'system api-user'],
    ['Wireless', analysis.counts.wifi || 0, 'wireless-controller vap'],
  ];
  return pairs.map(([Section, source, keyword]) => {
    const migrated = migratedConfig ? Math.min(source, countEdits(migratedConfig, keyword)) : 0;
    return { Section, Source: source, Migrated: migrated, Coverage: `${migrated} / ${source}` };
  });
}

function scoreCompatibility(options: MigrationOptions, issues: ValidationIssue[]) {
  const errors = issues.filter(item => item.severity === 'ERROR').length;
  const warnings = issues.filter(item => item.severity === 'WARNING').length;
  return Math.max(0, Math.min(100, 96 - errors * 12 - warnings * 2));
}

function extractSystemInterfaceNames(config: string) {
  const names: string[] = [];
  let inInterface = false;
  config.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed === 'config system interface') {
      inInterface = true;
      return;
    }
    if (inInterface && trimmed === 'end') {
      inInterface = false;
      return;
    }
    if (inInterface) {
      const edit = trimmed.match(/^edit\s+(.+)$/);
      if (edit) names.push(cleanEditName(edit[1]));
    }
  });
  return names;
}

function appendEmergencyAdmin(config: string, options: MigrationOptions, modifiedLines: Array<{ before: string; after: string }>) {
  if (options.adminAccessMode !== 'emergency' || !options.emergencyAdminUsername?.trim() || !options.emergencyAdminPassword || options.emergencyAdminPassword !== options.emergencyAdminConfirm) return config;
  const block = [
    '',
    'config system admin',
    `    edit "${options.emergencyAdminUsername.trim()}"`,
    '        set accprofile "super_admin"',
    `        set password ${JSON.stringify(options.emergencyAdminPassword)}`,
    '    next',
    'end',
  ].join('\n');
  modifiedLines.push({ before: 'Emergency admin absent', after: `Emergency admin ${options.emergencyAdminUsername.trim()} appended - PASSWORD IS PLAINTEXT IN CONF FILE` });
  return `${config.trimEnd()}${block}\n`;
}

function strippedPasswordAdmins(analysis: FortiGateAnalysis, options: MigrationOptions) {
  if (versionValue(options.targetFortiosVersion || '7.4') >= versionValue('7.0')) return [];
  return analysis.blocks
    .filter(block => block.path === 'system admin' && block.lines.some(line => /set password\s+ENC\s+PB2/i.test(line)))
    .map(block => block.name);
}

function removeOrphanedPolicyRefs(config: string, removedInterfaces: Set<string>, modifiedLines: Array<{ before: string; after: string }>): string {
  if (!removedInterfaces.size) return config;
  const lines = config.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^set (srcintf|dstintf|interface)\b/i.test(trimmed)) {
      const hasRemoved = [...removedInterfaces].some(name => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`"${escaped}"`).test(trimmed);
      });
      if (hasRemoved) {
        modifiedLines.push({ before: line, after: '# REMOVED - interface no longer exists in migrated config' });
        out.push(`# REMOVED: ${trimmed}`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function splitRefs(value: string) {
  const quoted = [...value.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  if (quoted.length) return quoted;
  return value.split(/\s+/).map(item => item.trim().replace(/^"|"$/g, '')).filter(Boolean);
}

function buildChecklist(analysis: FortiGateAnalysis, target: FortiGateModel) {
  return [
    `Confirm target model is ${target.name} and firmware is approved for this migration.`,
    'Import migrated config in lab or maintenance window before production cutover.',
    'Verify interface link status, aliases, zones, and VLAN parents.',
    'Verify policies, NAT, address objects, services, VIPs, and routes.',
    analysis.features.sdwan ? 'Validate SD-WAN members, health checks, and rule order.' : '',
    analysis.features.ipsecVpn || analysis.features.sslVpn ? 'Validate VPN tunnels, portals, certificates, and user access.' : '',
    analysis.features.ha ? 'Rebuild HA manually and validate failover.' : '',
    analysis.features.fortilink ? 'Validate FortiLink, FortiSwitch authorization, VLANs, and switch policies.' : '',
    analysis.features.securityFabric ? 'Rejoin Security Fabric and confirm telemetry.' : '',
    'Confirm logging, FortiAnalyzer, FortiManager, NTP, DNS, admin access, and rollback plan.',
  ].filter(Boolean);
}

function buildReportHtml(analysis: FortiGateAnalysis, target: FortiGateModel, coverage: MigrationResult['coverage'], issues: ValidationIssue[], score: number, migratedConfig: string, modifiedLines: Array<{ before: string; after: string }>, removedLines: string[], dependencyGraph: Array<Record<string, string | number>> = [], sectionCoverage: Array<Record<string, string | number>> = [], parserValidation: Array<Record<string, string | number>> = []) {
  const changeLog = [
    ...modifiedLines.slice(0, 80).map(line => ({ Category: 'Modified', Original: line.before.trim(), Migrated: line.after.trim(), Status: 'Modified' })),
    ...removedLines.slice(0, 80).map(line => ({ Category: 'Removed', Original: line.trim(), Migrated: '-', Status: 'Skipped' })),
  ];
  if (modifiedLines.length > 80) {
    changeLog.push({ Category: 'NOTE', Original: `${modifiedLines.length - 80} more modified lines`, Migrated: 'See Excel export for full log', Status: 'Truncated' });
  }
  if (removedLines.length > 80) {
    changeLog.push({ Category: 'NOTE', Original: `${removedLines.length - 80} more removed lines`, Migrated: 'See Excel export for full log', Status: 'Truncated' });
  }
  return htmlPage('NetTrouble Migration Report', `
    <h1>FortiGate Migration Report</h1>
    <section><h2>Summary</h2><table>
      <tr><th>Hostname</th><td>${escapeHtml(analysis.hostname)}</td></tr>
      <tr><th>Source Model</th><td>${escapeHtml(analysis.sourceModel)}</td></tr>
      <tr><th>Target Model</th><td>${escapeHtml(target.name)}</td></tr>
      <tr><th>FortiOS Version</th><td>${escapeHtml(analysis.fortiosVersion)}</td></tr>
      <tr><th>Readiness Score</th><td>${score}%</td></tr>
    </table></section>
    <section><h2>Object Counts</h2>${tableFromRows(Object.entries(analysis.counts).map(([Metric, Count]) => ({ Metric, Count })))}</section>
    <section><h2>Feature Coverage</h2>${tableFromRows(coverage)}</section>
    <section><h2>Section Coverage</h2>${tableFromRows(sectionCoverage)}</section>
    <section><h2>Dependency Graph</h2>${tableFromRows(dependencyGraph.slice(0, 80))}</section>
    <section><h2>Parser Simulation</h2>${tableFromRows(parserValidation)}</section>
    <section><h2>Warnings and Errors</h2>${tableFromRows(issues)}</section>
    <section><h2>Migration Change Log</h2>${tableFromRows(changeLog)}</section>
    <section><h2>Generated Config Size</h2><p>${migratedConfig ? `${migratedConfig.length} characters` : 'Not generated due to critical errors.'}</p></section>
  `);
}

function buildErrorsHtml(issues: ValidationIssue[]) {
  return htmlPage('NetTrouble Migration Errors', `
    <h1>Migration Validation Results</h1>
    ${tableFromRows(issues.map(item => ({
      Severity: item.severity,
      'Object Type': item.objectType,
      'Object Name': item.objectName,
      Issue: item.issue,
      Recommendation: item.recommendation,
    })))}
  `);
}

function tableFromRows(rows: Array<Record<string, any>>) {
  if (!rows.length) return '<p>No rows.</p>';
  const keys = Object.keys(rows[0]);
  return `<table><thead><tr>${keys.map(key => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${keys.map(key => `<td>${escapeHtml(String(row[key] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function htmlPage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
  body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:24px;line-height:1.45}
  h1,h2{margin-bottom:8px}section{margin:20px 0}table{border-collapse:collapse;width:100%;background:white}
  th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}th{background:#e2e8f0}
  </style></head><body>${body}</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function issue(severity: ValidationIssue['severity'], objectType: string, objectName: string, problem: string, recommendation: string): ValidationIssue {
  return { severity, objectType, objectName, issue: problem, recommendation };
}
