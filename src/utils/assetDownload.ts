import * as FileSystem from 'expo-file-system/legacy';

function guessMimeFromUrl(url: string, fallback: string): string {
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.pdf')) return 'application/pdf';
  return fallback;
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const clean = url.split('?')[0].split('#')[0];
    const last = clean.substring(clean.lastIndexOf('/') + 1);
    return last && last.length > 0 && last.length < 120 ? decodeURIComponent(last) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Downloads an image URL and returns it as a base64 data URI so it's
 * embedded with the rest of the app data and works offline — same format
 * produced by the manual image picker. Returns null on failure.
 */
export async function downloadImageAsDataUri(url: string): Promise<string | null> {
  const tmpUri = `${FileSystem.cacheDirectory}bulk-img-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  try {
    const result = await FileSystem.downloadAsync(url, tmpUri);
    if (result.status < 200 || result.status >= 300) return null;
    const headerMime = (result.headers?.['Content-Type'] || result.headers?.['content-type'] || '').split(';')[0];
    const mime = headerMime && headerMime.startsWith('image/') ? headerMime : guessMimeFromUrl(url, 'image/jpeg');
    const base64 = await FileSystem.readAsStringAsync(tmpUri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    console.error('downloadImageAsDataUri failed for', url, e);
    return null;
  } finally {
    FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => {});
  }
}

/**
 * Downloads a datasheet (PDF, etc.) into the app's persistent document
 * directory (survives longer than the cache dir) and returns metadata
 * compatible with the DataSheet type. Returns null on failure.
 */
export async function downloadDatasheetFile(
  url: string,
  suggestedName?: string
): Promise<{ name: string; fileData: string; fileType: string; size?: number } | null> {
  try {
    const dir = `${FileSystem.documentDirectory}bulk-datasheets/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const name = suggestedName?.trim() || filenameFromUrl(url, 'datasheet.pdf');
    const safeName = name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
    const localUri = `${dir}${Date.now()}-${safeName}`;

    const result = await FileSystem.downloadAsync(url, localUri);
    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
      return null;
    }
    const headerMime = (result.headers?.['Content-Type'] || result.headers?.['content-type'] || '').split(';')[0];
    const fileType = headerMime || guessMimeFromUrl(url, 'application/pdf');
    const info = await FileSystem.getInfoAsync(localUri, { size: true } as any);
    const size = (info as any)?.size;

    return { name: safeName, fileData: localUri, fileType, size };
  } catch (e) {
    console.error('downloadDatasheetFile failed for', url, e);
    return null;
  }
}
