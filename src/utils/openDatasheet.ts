import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
export async function openDatasheet(fileData: string, name: string): Promise<void> {
 try {
   let fileUri=fileData;
   if (!fileData.startsWith('file://') && !fileData.startsWith('content://')) {
      const match=fileData.match(/^data:(.*?);base64,(.*)$/);
      const base64=match?match[2]:fileData;
      fileUri=`${FileSystem.cacheDirectory}${name||'datasheet'}`;
      await FileSystem.writeAsStringAsync(fileUri, base64,{encoding:FileSystem.EncodingType.Base64});
   }
   if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri);
 } catch(e){ console.error('Open datasheet failed',e); }
}
