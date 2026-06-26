import type { ConfigBlock, FortiGateAnalysis, FortiInterface } from './fortigateTypes';

const sectionMap: Record<string, string> = {
  'firewall address': 'addressObjects',
  'firewall addrgrp': 'addressGroups',
  'firewall service custom': 'serviceObjects',
  'firewall service group': 'serviceGroups',
  'firewall policy': 'policies',
  'firewall vip': 'vips',
  'firewall vipgrp': 'vipGroups',
  'system dhcp server': 'dhcp',
  'router static': 'routes',
  'system sdwan': 'sdwan',
  'vpn ipsec phase1-interface': 'ipsecVpn',
  'vpn ipsec phase2-interface': 'ipsecVpn',
  'vpn ssl settings': 'sslVpn',
  'vpn certificate local': 'certificates',
  'user local': 'users',
  'system admin': 'admins',
  'system ha': 'ha',
  'switch-controller managed-switch': 'fortilink',
  'system csf': 'securityFabric',
  'system fortimanager': 'fortimanager',
  'log fortianalyzer setting': 'fortianalyzer',
  'system zone': 'zones',
};

export function parseFortiGateConfig(raw: string, fileName = 'original-backup.conf'): FortiGateAnalysis {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = flattenBlocks(parseBlocks(normalized));
  const systemGlobal = blocks.find(block => block.path === 'system global' && block.name === '__root__');
  const hostname = cleanValue(systemGlobal?.settings.hostname) || 'UNKNOWN';
  const detected = detectModel(normalized);
  const sourceModel = detected.model;
  const fortiosVersion = detectVersion(normalized);
  const vdoms = detectVdoms(normalized);
  const interfaces = extractInterfaces(blocks, normalized);
  const counts = buildCounts(blocks, interfaces);
  const features = buildFeatures(blocks, normalized);
  const references = buildReferences(blocks);

  return {
    raw: normalized,
    fileName,
    hostname,
    sourceModel,
    autoDetectedModel: detected.model,
    modelConfidence: detected.confidence,
    uploadDate: new Date().toISOString(),
    checksum: checksum(normalized),
    vdomMode: vdoms.length > 1 ? 'Multi VDOM' : 'Single VDOM',
    vdoms,
    fortiosVersion,
    blocks,
    interfaces,
    counts,
    features,
    references,
  };
}

function flattenBlocks(blocks: ConfigBlock[]): ConfigBlock[] {
  const result: ConfigBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children?.length) result.push(...flattenBlocks(block.children));
  }
  return result;
}

function parseBlocks(raw: string): ConfigBlock[] {
  const lines = raw.split('\n');
  const stack: Array<{ path: string; current?: ConfigBlock }> = [];
  const blocks: ConfigBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const config = trimmed.match(/^config\s+(.+)$/);
    if (config) {
      const currentFrame = stack[stack.length - 1];
      if (currentFrame?.current) {
        const parent = currentFrame.current;
        const child: ConfigBlock = { path: config[1], name: '__root__', lines: [line], settings: {} };
        parent.children = [...(parent.children || []), child];
        stack.push({ path: config[1], current: child });
        continue;
      }
      stack.push({ path: config[1] });
      continue;
    }
    if (!stack.length) continue;
    const top = stack[stack.length - 1];
    const edit = trimmed.match(/^edit\s+(.+)$/);
    if (edit) {
      if (top.current && top.current.name === '__root__') {
        const placeholder = top.current;
        const nextBlock: ConfigBlock = { path: top.path, name: cleanValue(edit[1]), lines: [line], settings: {}, children: [] };
        const parent = stack.length > 1 ? stack[stack.length - 2].current : undefined;
        if (parent) parent.children = [...(parent.children || []).filter(child => child !== placeholder), nextBlock];
        top.current = nextBlock;
        continue;
      }
      top.current = { path: top.path, name: cleanValue(edit[1]), lines: [line], settings: {}, children: [] };
      continue;
    }
    if (trimmed === 'next') {
      if (top.current) {
        top.current.lines.push(line);
        blocks.push(top.current);
        top.current = undefined;
      }
      continue;
    }
    if (trimmed === 'end') {
      if (top.current) {
        top.current.lines.push(line);
        blocks.push(top.current);
        top.current = undefined;
      } else {
        const rootSettings = collectRootSettings(lines, top.path);
        if (Object.keys(rootSettings).length) blocks.push({ path: top.path, name: '__root__', lines: [], settings: rootSettings });
      }
      stack.pop();
      continue;
    }
    if (top.current) {
      top.current.lines.push(line);
      const set = trimmed.match(/^set\s+(\S+)\s+(.+)$/);
      if (set) top.current.settings[set[1]] = cleanValue(set[2]);
    }
  }
  return blocks;
}

function collectRootSettings(lines: string[], path: string) {
  const settings: Record<string, string> = {};
  let inside = false;
  let depth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === `config ${path}`) {
      inside = true;
      depth = 1;
      continue;
    }
    if (!inside) continue;
    if (trimmed.startsWith('config ')) depth++;
    if (trimmed === 'end') {
      depth--;
      if (depth === 0) break;
    }
    if (depth === 1) {
      const set = trimmed.match(/^set\s+(\S+)\s+(.+)$/);
      if (set) settings[set[1]] = cleanValue(set[2]);
    }
  }
  return settings;
}

function detectModel(raw: string) {
  const configVersion = raw.match(/#?config-version\s*=\s*([A-Z]+[-]?\d+[A-Z0-9-]*)/i)?.[1];
  const normalizedConfig = normalizeModel(configVersion);
  if (normalizedConfig) return { model: normalizedConfig, confidence: 95 };
  const header = raw.match(/#\s*FortiGate[-\s]+([A-Z]+[-]?\d+[A-Z0-9-]*)/i)?.[1];
  const normalizedHeader = normalizeModel(header);
  if (normalizedHeader) return { model: normalizedHeader, confidence: 85 };
  const anywhere = raw.match(/\b(FG|FGT|FORTIGATE)[-]?(\d+[A-Z][A-Z0-9-]*)\b/i)?.[0];
  const normalizedAnywhere = normalizeModel(anywhere);
  if (normalizedAnywhere) return { model: normalizedAnywhere, confidence: 65 };
  return { model: 'UNKNOWN', confidence: 0 };
}

export function normalizeModel(value?: string) {
  if (!value) return '';
  const clean = value.trim().toUpperCase().replace(/^FORTIGATE[-\s]?/, 'FGT').replace(/[^A-Z0-9-]/g, '');
  const match = clean.match(/^(?:FGT|FG)[-]?(\d+[A-Z][A-Z0-9-]*?)(?:-\d.*)?$/);
  return match ? `FG-${match[1]}` : '';
}

function detectVersion(raw: string) {
  return raw.match(/v?(\d+\.\d+\.\d+)/)?.[1] || raw.match(/FortiOS.*?(\d+\.\d+)/i)?.[1] || 'UNKNOWN';
}

function detectVdoms(raw: string) {
  const names: string[] = [];
  const lines = raw.split('\n');
  let inVdom = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'config vdom') {
      inVdom = true;
      continue;
    }
    if (!inVdom) continue;
    if (trimmed === 'end') break;
    const edit = trimmed.match(/^edit\s+(.+)$/);
    if (edit) names.push(cleanValue(edit[1]));
  }
  return names.length ? names : ['root'];
}

function extractInterfaces(blocks: ConfigBlock[], raw: string): FortiInterface[] {
  const interfaceBlocks = blocks.filter(block => block.path === 'system interface');
  return interfaceBlocks.map(block => {
    const settings = block.settings;
    const name = block.name;
    const role = detectRole(name, settings, raw);
    const refs = countRefs(raw, name);
    const members = detectInterfaceMembers(block, blocks, raw);
    const notes: string[] = [];
    if (members.length) notes.push(`Members ${members.join(', ')}`);
    if (settings.interface) notes.push(`VLAN parent ${settings.interface}`);
    if (settings.type) notes.push(`Type ${settings.type}`);
    if (settings.type === 'aggregate') notes.push('Aggregate interface');
    if (settings.type === 'loopback') notes.push('Loopback interface');
    if (settings.type === 'tunnel') notes.push('Tunnel interface');
    if (settings.type === 'vdom-link') notes.push('Inter-VDOM link interface');
    if (settings.type === 'vap-switch' || /wqtn\.|vap|wifi|guest/i.test(name)) notes.push('WiFi/VAP interface');
    if (settings.vdom) notes.push(`VDOM ${settings.vdom}`);
    return {
      name,
      alias: settings.alias,
      type: settings.type,
      role,
      status: settings.status === 'down' || settings.status === 'disable' ? 'Disabled' : refs > 1 ? 'Used' : 'Unused',
      ip: settings.ip,
      vlanId: settings.vlanid,
      parent: settings.interface,
      members,
      refs,
      notes,
    };
  });
}

function detectInterfaceMembers(block: ConfigBlock, blocks: ConfigBlock[], raw: string) {
  const direct = cleanList(block.settings.member || block.settings.members || block.settings.port || '');
  const related = blocks
    .filter(item => ['system virtual-switch', 'system switch-interface'].includes(item.path) && (item.name === block.name || item.settings.interface === block.name))
    .flatMap(item => cleanList(item.settings.member || item.settings.members || item.settings.port || '').concat(item.lines.flatMap(line => {
      const match = line.trim().match(/^(?:set|append)\s+(?:member|members|port)\s+(.+)$/i);
      return match ? cleanList(match[1]) : [];
    })));
  const lineMembers = block.lines.flatMap(line => {
    const match = line.trim().match(/^(?:set|append)\s+(?:member|members|port)\s+(.+)$/i);
    return match ? cleanList(match[1]) : [];
  });
  const guessed = block.settings.type === 'hard-switch' || block.settings.type === 'switch'
    ? [...raw.matchAll(new RegExp(`set\\\\s+interface\\\\s+\"?${escapeRegex(block.name)}\"?`, 'gi'))].map(() => '').filter(Boolean)
    : [];
  return [...new Set([...direct, ...related, ...lineMembers, ...guessed].filter(Boolean))];
}

function detectRole(name: string, settings: Record<string, string>, raw: string) {
  const value = `${name} ${settings.alias || ''} ${settings.role || ''} ${settings.description || ''}`.toLowerCase();
  if (settings.type === 'loopback') return 'Loopback';
  if (settings.type === 'vdom-link') return 'VDOM Link';
  if (settings.type === 'tunnel' || /^ssl\.root$/i.test(name)) return 'Tunnel';
  if (settings.type === 'aggregate') return 'Aggregate';
  if (settings.type === 'hard-switch' || settings.type === 'switch') return 'Switch';
  if (settings.type === 'vap-switch' || /wqtn\.|vap|wifi|guest/i.test(value)) return 'WiFi/VAP';
  if (settings.type === 'vlan' || settings.vlanid) return 'VLAN';
  if (value.includes('fortilink') || raw.includes(`set fortilink "${name}"`)) return 'FortiLink';
  if (value.includes('wan') || value.includes('internet') || value.includes('isp')) return 'WAN';
  if (value.includes('dmz')) return 'DMZ';
  if (value.includes('ha')) return 'HA';
  if (value.includes('mgmt') || value.includes('management')) return 'MGMT';
  if (value.includes('lan') || value.includes('internal')) return 'LAN';
  return countRefs(raw, name) > 1 ? 'LAN' : 'Unused';
}

function buildCounts(blocks: ConfigBlock[], interfaces: FortiInterface[]) {
  const counts: Record<string, number> = {
    interfaces: interfaces.length,
    policies: 0,
    addressObjects: 0,
    addressGroups: 0,
    serviceObjects: 0,
    serviceGroups: 0,
    vips: 0,
    vipGroups: 0,
    dhcp: 0,
    routes: 0,
    vpn: 0,
    vlan: interfaces.filter(item => item.vlanId).length,
    sdwan: 0,
    zones: 0,
    certificates: 0,
    admins: 0,
    users: 0,
    loopbacks: interfaces.filter(item => item.type === 'loopback').length,
    tunnels: interfaces.filter(item => item.type === 'tunnel' || item.name === 'ssl.root').length,
    wifi: interfaces.filter(item => item.type === 'vap-switch' || /wqtn\.|vap|wifi|guest/i.test(item.name)).length,
    aggregates: interfaces.filter(item => item.type === 'aggregate').length,
    bgp: 0,
    ospf: 0,
    rip: 0,
  };
  for (const block of blocks) {
    const key = sectionMap[block.path];
    if (key) counts[key] = (counts[key] || 0) + (block.name === '__root__' ? 1 : 1);
  }
  counts.vpn = (counts.ipsecVpn || 0) + (counts.sslVpn || 0);
  counts.bgp = blocks.some(block => block.path === 'router bgp') ? 1 : 0;
  counts.ospf = blocks.some(block => block.path === 'router ospf') ? 1 : 0;
  counts.rip = blocks.some(block => block.path === 'router rip') ? 1 : 0;
  return counts;
}

function buildFeatures(blocks: ConfigBlock[], raw: string) {
  return {
    policies: blocks.some(block => block.path === 'firewall policy'),
    objects: blocks.some(block => block.path.startsWith('firewall address') || block.path.startsWith('firewall service')),
    routes: blocks.some(block => block.path === 'router static'),
    vips: blocks.some(block => block.path === 'firewall vip' || block.path === 'firewall vipgrp'),
    dhcp: blocks.some(block => block.path === 'system dhcp server'),
    sdwan: blocks.some(block => block.path === 'system sdwan'),
    bgp: blocks.some(block => block.path === 'router bgp'),
    ospf: blocks.some(block => block.path === 'router ospf'),
    rip: blocks.some(block => block.path === 'router rip'),
    vrf: /\bset vrf\b|config router vrf/i.test(raw),
    virtualWirePair: /virtual-wire-pair|config system virtual-wire-pair/i.test(raw),
    ipsecVpn: blocks.some(block => block.path.startsWith('vpn ipsec')),
    sslVpn: blocks.some(block => block.path.startsWith('vpn ssl')),
    certificates: blocks.some(block => block.path.includes('certificate')) || /BEGIN CERTIFICATE/.test(raw),
    ha: blocks.some(block => block.path === 'system ha'),
    fortilink: /fortilink|switch-controller/i.test(raw),
    securityFabric: /config system csf|security-fabric/i.test(raw),
    fortimanager: /fortimanager/i.test(raw),
    fortianalyzer: /fortianalyzer/i.test(raw),
    wifi: /wireless-controller|vap-switch|wtp-profile|wqtn\./i.test(raw),
  };
}

function buildReferences(blocks: ConfigBlock[]) {
  const references: Record<string, Set<string>> = {};
  const interfaceRefKeys = /^(srcintf|dstintf|interface|device|outgoing-interface|associated-interface|listen-interface|update-source|source-interface|egress-interface|ingress-interface|fortilink|member|members|port)$/i;
  const add = (type: string, name: string) => {
    if (!references[type]) references[type] = new Set();
    if (name) references[type].add(name);
  };
  blocks.forEach(block => {
    Object.entries(block.settings).forEach(([key, value]) => {
      if (interfaceRefKeys.test(key)) {
        cleanList(value).forEach(item => add(key, item));
      }
    });
  });
  return references;
}

export function cleanValue(value = '') {
  return value.trim().replace(/^"|"$/g, '');
}

export function cleanList(value = '') {
  const quoted = [...value.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  if (quoted.length) return quoted;
  return value.split(/\s+/).map(cleanValue).filter(Boolean);
}

function countRefs(raw: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refPattern = new RegExp(
    `(?:set|append)\\s+(?:srcintf|dstintf|interface|device|member|members|port|outgoing-interface|associated-interface|listen-interface|source-interface|egress-interface|ingress-interface|fortilink)\\s+(?:[^\\n]*?"${escaped}"[^\\n]*|[^\\n]*\\b${escaped}\\b[^\\n]*)`,
    'gi'
  );
  return (raw.match(refPattern) || []).length;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checksum(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
