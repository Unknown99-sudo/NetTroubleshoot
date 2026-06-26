import type { FortiGateModel } from './fortigateTypes';

const models = require('./data/fortigate_models.json') as FortiGateModel[];

const requestedModels = [
  'FG-30D', 'FG-30D-POE', 'FG-60D', 'FG-60D-POE', 'FG-70D', 'FG-70D-POE', 'FG-80D', 'FG-90D', 'FG-90D-POE', 'FG-92D', 'FG-94D-POE', 'FG-98D-POE', 'FG-100D', 'FG-140D', 'FG-140D-POE', 'FG-200D', 'FG-200D-POE', 'FG-240D', 'FG-240D-POE', 'FG-280D-POE', 'FG-300D', 'FG-400D', 'FG-500D', 'FG-600D', 'FG-800D', 'FG-900D', 'FG-1000D', 'FG-1200D', 'FG-1500D', 'FG-1500DT', 'FG-3000D', 'FG-3100D', 'FG-3200D', 'FG-3700D', 'FG-3800D', 'FG-3810D', 'FG-3815D', 'FG-5001D',
  'FG-30E', 'FG-30E-3G4G-INTL', 'FG-30E-3G4G-NAM', 'FG-50E', 'FG-51E', 'FG-52E', 'FG-60E', 'FG-60E-POE', 'FG-60E-DSL', 'FG-61E', 'FG-80E', 'FG-80E-POE', 'FG-81E', 'FG-81E-POE', 'FG-90E', 'FG-91E', 'FG-100E', 'FG-100EF', 'FG-101E', 'FG-140E', 'FG-140E-POE', 'FG-200E', 'FG-201E', 'FG-300E', 'FG-301E', 'FG-500E', 'FG-501E', 'FG-600E', 'FG-601E', 'FG-1000E', 'FG-1100E', 'FG-1101E', 'FG-2000E', 'FG-2500E', 'FG-3400E', 'FG-3401E', 'FG-3600E', 'FG-3601E', 'FG-3960E', 'FG-3980E', 'FG-5001E', 'FG-5001E1',
  'FG-40F', 'FG-40F-3G4G', 'FG-60F', 'FG-61F', 'FG-80F', 'FG-80F-Bypass', 'FG-81F', 'FG-100F', 'FG-101F', 'FG-200F', 'FG-201F', 'FG-300F', 'FG-301F', 'FG-400F', 'FG-401F', 'FG-600F', 'FG-601F', 'FG-1000F', 'FG-1800F', 'FG-1801F', 'FG-2600F', 'FG-3000F', 'FG-3001F', 'FG-3200F', 'FG-3300F', 'FG-3700F', 'FG-3701F', 'FG-4200F', 'FG-4201F', 'FG-4400F', 'FG-4401F', 'FG-6300F', 'FG-6500F', 'FG-7081F',
  'FG-30G', 'FG-50G', 'FG-70G', 'FG-90G', 'FG-120G', 'FG-200G', 'FG-400G', 'FG-600G', 'FG-900G', 'FG-900G-DC', 'FG-901G', 'FG-901G-DC', 'FG-1000G', 'FG-3000G',
];

const verified = models.map(model => ({ ...model, verified: model.verified ?? true }));
const verifiedNames = new Set(verified.map(model => model.name.toUpperCase()));
const unknownModels: FortiGateModel[] = requestedModels
  .filter(name => !verifiedNames.has(name.toUpperCase()))
  .map(name => ({
    name,
    series: name.match(/^FG-\d+([A-Z])/)?.[1] || 'Unknown',
    verified: false,
    portCount: 0,
    portNames: [],
    portTypes: {},
    wanPorts: [],
    lanPorts: [],
    dmzPorts: [],
    fortiLinkPorts: [],
    switchPorts: [],
    hardwareSwitchSupport: false,
    haSupport: false,
    sdWanSupport: false,
    switchControllerSupport: false,
    fortiLinkSupport: false,
    migrationRules: ['Hardware specifications are not verified in the local database. Manual validation required.'],
    knownRestrictions: ['Unknown / Not Verified'],
    knownExceptions: [],
  }));

export const fortigateModels = [...verified, ...unknownModels].sort((a, b) => a.name.localeCompare(b.name));

export function findFortiGateModel(name: string) {
  const clean = name.trim().toUpperCase().replace(/^FORTIGATE-?/, 'FG-').replace(/^FGT/, 'FG-');
  return fortigateModels.find(model => model.name.toUpperCase() === clean);
}

export function modelOptions() {
  return fortigateModels.map(model => model.name);
}
