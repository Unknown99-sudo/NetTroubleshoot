import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export interface NativeLanScanRow {
  IP: string;
  Status: string;
  'Response Time': string;
  'Open Ports': string;
  MAC: string;
  Vendor: string;
  Method: string;
}

export interface NativeLanNetworkInfo {
  ip?: string;
  cidr?: number;
  subnet?: string;
  range?: string;
  gateway?: string;
  ssid?: string;
}

interface NetTroubleLanScannerModule {
  getCurrentNetwork(): Promise<NativeLanNetworkInfo>;
  scan(target: string, limit: number, ports: string): Promise<NativeLanScanRow[]>;
}

let nativeModule: NetTroubleLanScannerModule | null | undefined;

function getNativeModule() {
  if (Platform.OS !== 'android') return null;
  if (nativeModule !== undefined) return nativeModule;
  try {
    nativeModule = requireNativeModule<NetTroubleLanScannerModule>('NetTroubleLanScanner');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

export async function scanNativeLan(target: string, limit: number, ports: string) {
  const scanner = getNativeModule();
  if (!scanner) {
    return { available: false, rows: [] as NativeLanScanRow[] };
  }
  const rows = await scanner.scan(target, limit, ports);
  return { available: true, rows };
}

export async function getNativeLanNetworkInfo() {
  const scanner = getNativeModule();
  if (!scanner) {
    return { available: false, info: {} as NativeLanNetworkInfo };
  }
  const info = await scanner.getCurrentNetwork();
  return { available: true, info };
}
