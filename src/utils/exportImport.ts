import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Writes the export JSON to a temporary file and opens the native share
 * sheet. This is the legacy JSON export path, kept for cross-device
 * compatibility when the recipient doesn't have the app's .db format.
 */
export async function exportDataToFile(jsonStr: string): Promise<{ success: boolean; message: string }> {
  try {
    const fileName = `nettrouble_backup_${Date.now()}.json`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export NetTrouble Data (JSON)',
        UTI: 'public.json',
      });
      return { success: true, message: 'Export ready — choose where to save or share it.' };
    }

    return { success: true, message: `Saved to ${fileUri}` };
  } catch (e: any) {
    console.error('Export failed', e);
    return { success: false, message: e?.message || 'Failed to export data.' };
  }
}

/**
 * Opens the native document picker so the user can select a previously
 * exported .json file, then returns its contents as a string.
 */
export async function pickImportFile(): Promise<{ success: boolean; content?: string; message?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) {
      return { success: false, message: 'cancelled' };
    }

    const asset = result.assets?.[0];
    if (!asset) {
      return { success: false, message: 'No file selected.' };
    }

    const content = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return { success: true, content };
  } catch (e: any) {
    console.error('Import failed', e);
    return { success: false, message: e?.message || 'Failed to read the selected file.' };
  }
}
