import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { DataSheet } from '../types';

/**
 * Opens the native document picker (multi-select) and returns
 * DataSheet objects with base64 data URI content (no id assigned),
 * ready to attach to a product.
 */
export async function pickDatasheets(): Promise<Omit<DataSheet, 'id'>[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled) return [];

  const sheets: Omit<DataSheet, 'id'>[] = [];

  for (const asset of result.assets ?? []) {
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mime = asset.mimeType || 'application/octet-stream';
      sheets.push({
        name: asset.name,
        fileData: `data:${mime};base64,${base64}`,
        fileType: mime,
      });
    } catch {
      // skip files that fail to read
    }
  }

  return sheets;
}
