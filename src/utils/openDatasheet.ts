import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';

/**
 * Opens a datasheet for viewing.
 * Handles three forms of fileData:
 *   1. Persistent file:// URI  (from datasheetPicker or bulk download)
 *   2. content:// URI
 *   3. base64 data URI         (older data / bulk import fallback)
 */
export async function openDatasheet(fileData: string, name: string): Promise<void> {
  try {
    let fileUri = fileData;

    if (fileData.startsWith('data:')) {
      // base64 data URI — write to cache and open from there
      const match = fileData.match(/^data:(.*?);base64,(.*)$/s);
      const mime = match?.[1] || 'application/pdf';
      const base64 = match?.[2] || fileData;
      const safeName = (name || 'datasheet.pdf').replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
      fileUri = `${FileSystem.cacheDirectory}${safeName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else if (fileData.startsWith('file://')) {
      // Confirm the file still exists
      const info = await FileSystem.getInfoAsync(fileData);
      if (!info.exists) {
        Alert.alert('File Not Found', `The file "${name}" could not be found. It may have been deleted.`);
        return;
      }
      fileUri = fileData;
    }
    // content:// falls through unchanged

    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/pdf',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } else {
      // iOS — expo-sharing is the safest cross-app open
      const { default: Sharing } = await import('expo-sharing');
      await Sharing.shareAsync(fileUri);
    }
  } catch (e: any) {
    console.error('openDatasheet failed', e);
    Alert.alert('Could Not Open File', e?.message || 'An error occurred opening the datasheet.');
  }
}
