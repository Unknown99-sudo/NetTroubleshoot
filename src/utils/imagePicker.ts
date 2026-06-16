import * as ImagePicker from 'expo-image-picker';

/**
 * Opens the native image library picker and returns the selected
 * image as a base64 data URI.
 */
export async function pickImageAsBase64(): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.7,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (result.canceled) return null;

    const asset = result.assets?.[0];
    if (!asset?.base64) return null;

    const mime = asset.mimeType || 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  } catch (error) {
    console.error('Image picker error', error);
    return null;
  }
}
