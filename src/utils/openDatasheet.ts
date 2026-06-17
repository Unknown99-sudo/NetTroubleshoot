import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
export async function openDatasheet(fileData: string, name: string): Promise<void> {
 try {
   let fileUri=fileData;
   if (!fileData.startsWith('file://') && !fileData.startsWith('content://')) {
      const match=fileData.match(/^data:(.*?);base64,(.*)$/);
      const base64=match?match[2]:fileData;
      fileUri=`${FileSystem.cacheDirectory}${name||'datasheet.pdf'}`;
      await FileSystem.writeAsStringAsync(fileUri, base64,{encoding:FileSystem.EncodingType.Base64});
   }
   const contentUri=await FileSystem.getContentUriAsync(fileUri);
   await IntentLauncher.startActivityAsync('android.intent.action.VIEW',{data:contentUri,type:'application/pdf',flags:1});
 } catch(e){ console.error('Open datasheet failed',e); }
}
