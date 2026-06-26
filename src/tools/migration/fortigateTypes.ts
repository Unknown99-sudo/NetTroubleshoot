export type Severity = 'SUCCESS' | 'WARNING' | 'ERROR';
export type Feasibility = 'SUPPORTED' | 'PARTIALLY SUPPORTED' | 'UNSUPPORTED' | 'MISSING';

export interface FortiGateModel {
  name: string;
  series: string;
  verified?: boolean;
  portCount: number;
  portNames: string[];
  portTypes: Record<string, string>;
  wanPorts: string[];
  lanPorts: string[];
  dmzPorts: string[];
  fortiLinkPorts: string[];
  switchPorts: string[];
  hardwareSwitchSupport: boolean;
  haSupport: boolean;
  sdWanSupport: boolean;
  switchControllerSupport: boolean;
  fortiLinkSupport: boolean;
  interfaceSummary?: string;
  profileSource?: string;
  profileAccuracy?: string;
  migrationRules: string[];
  knownRestrictions: string[];
  knownExceptions: string[];
  removedPorts?: string[];
}

export interface TargetCapabilityOverride {
  wan: number | 'auto';
  lan: number | 'auto';
  dmz: number | 'auto';
  hasPortA: boolean;
  hasPortB: boolean;
  hasFortiLink: boolean;
  hasModem: boolean;
  haHaPort: boolean;
}

export interface ConfigBlock {
  path: string;
  name: string;
  lines: string[];
  settings: Record<string, string>;
  children?: ConfigBlock[];
}

export interface FortiInterface {
  name: string;
  alias?: string;
  type?: string;
  role: string;
  status: string;
  ip?: string;
  vlanId?: string;
  parent?: string;
  members?: string[];
  refs: number;
  notes: string[];
}

export interface FortiGateAnalysis {
  raw: string;
  fileName: string;
  hostname: string;
  sourceModel: string;
  autoDetectedModel?: string;
  modelConfidence?: number;
  uploadDate?: string;
  checksum?: string;
  vdomMode?: 'Single VDOM' | 'Multi VDOM';
  vdoms?: string[];
  fortiosVersion: string;
  blocks: ConfigBlock[];
  interfaces: FortiInterface[];
  counts: Record<string, number>;
  features: Record<string, boolean>;
  references: Record<string, Set<string>>;
}

export interface InterfaceMapping {
  source: string;
  role: string;
  target: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  notes: string;
  targetMembers?: string[];
  targetParent?: string;
}

export interface ValidationIssue {
  severity: Severity;
  objectType: string;
  objectName: string;
  issue: string;
  recommendation: string;
  sourceLine?: number;
  generatedLine?: number;
}

export interface MigrationOptions {
  removeSerial: boolean;
  removeRegistration: boolean;
  removeFortiCloud: boolean;
  replaceHostname: boolean;
  newHostname: string;
  keepPolicies: boolean;
  keepObjects: boolean;
  keepRoutes: boolean;
  keepVlans: boolean;
  keepSdwan: boolean;
  keepNat: boolean;
  keepDhcp: boolean;
  keepVips: boolean;
  keepVpn: boolean;
  keepUsers: boolean;
  keepAdmins: boolean;
  keepCertificates: boolean;
  keepFortiLink?: boolean;
  keepModem?: boolean;
  keepSwitchController?: boolean;
  keepSecurityFabric?: boolean;
  keepBgp?: boolean;
  keepOspf?: boolean;
  keepZones?: boolean;
  skipUnusedObjects?: boolean;
  targetFortiosVersion?: string;
  targetBuildNumber?: string;
  firmwareMode?: 'preserve' | 'target' | 'strict-legacy';
  migrationMode?: 'standard' | 'strict' | 'd-series-safe';
  migrateFortiManager?: boolean;
  adminAccessMode?: 'preserve' | 'emergency';
  emergencyAdminUsername?: string;
  emergencyAdminPassword?: string;
  emergencyAdminConfirm?: string;
  generateAnyway: boolean;
}

export interface MigrationResult {
  migratedConfig: string;
  removedLines: string[];
  modifiedLines: Array<{ before: string; after: string }>;
  coverage: Array<{ component: string; percent: number; feasibility: Feasibility; notes: string }>;
  score: number;
  migrationDirection?: 'upgrade' | 'downgrade' | 'same-version' | 'same-model';
  sourceVersionValue?: number;
  targetVersionValue?: number;
  strippedPasswordAdmins?: string[];
  importProbability?: number;
  restoreConfidence?: number;
  compatibilityScore?: number;
  parserValidation?: Array<Record<string, string | number>>;
  dependencyGraph?: Array<Record<string, string | number>>;
  sectionCoverage?: Array<Record<string, string | number>>;
  readiness: string;
  issues: ValidationIssue[];
  checklist: string[];
  reportHtml: string;
  errorsHtml: string;
}
