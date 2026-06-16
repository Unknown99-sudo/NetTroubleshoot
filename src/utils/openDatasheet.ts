import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Writes a base64 data-URI datasheet to a temporary file and opens
 * the native share/preview sheet so the user can view or save it.
 */
export async function openDatasheet(fileData: string, name: string): Promise<void> {
  try {
    const match = fileData.match(/^data:(.*?);base64,(.*)$/);
    const base64 = match ? match[2] : fileData;

    const safeName = name && name.trim() ? name : 'datasheet';
    const fileUri = `${FileSystem.cacheDirectory}${safeName}`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri);
    }
  } catch {
    // silently ignore — UI shows no error state for this in the original app
  }
}
