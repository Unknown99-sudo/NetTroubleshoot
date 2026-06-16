import * as DocumentPicker from 'expo-document-picker';
import { DataSheet } from '../types';
export async function pickDatasheets(): Promise<Omit<DataSheet, 'id'>[]> {
 const result = await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:true});
 if (result.canceled) return [];
 return (result.assets ?? []).map(asset => ({
   name: asset.name,
   fileData: asset.uri,
   fileType: asset.mimeType || 'application/octet-stream',
   size: asset.size,
 }));
}
