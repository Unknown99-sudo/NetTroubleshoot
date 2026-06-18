import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { DataSheet } from '../types';

/**
 * Opens native document picker, copies each selected file to the app's
 * persistent document directory so it survives cache clears and can be
 * opened later via IntentLauncher / openDatasheet().
 */
export async function pickDatasheets(): Promise<Omit<DataSheet, 'id'>[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return [];

  const dir = `${FileSystem.documentDirectory}datasheets/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});

  const sheets: Omit<DataSheet, 'id'>[] = [];
  for (const asset of result.assets ?? []) {
    try {
      const safeName = asset.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
      const destUri = `${dir}${Date.now()}_${safeName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });
      sheets.push({
        name: asset.name,
        fileData: destUri,          // persistent file:// URI
        fileType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });
    } catch (e) {
      console.error('datasheetPicker: copy failed for', asset.name, e);
      // Fallback: store the cache URI — may not survive long but better than nothing
      sheets.push({
        name: asset.name,
        fileData: asset.uri,
        fileType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });
    }
  }
  return sheets;
}
