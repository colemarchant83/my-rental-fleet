import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Uploads go through a Cloudflare Worker. The R2 key never lives in the app.

const SIGNER = (process.env.EXPO_PUBLIC_R2_SIGNER ?? 'https://my-rental-fleet-media.colemarchant.workers.dev').replace(/\/$/, '');

async function fileBody(localUri: string, contentType: string) {
  try {
    const response = await fetch(localUri);
    if (response.ok) return await response.blob();
  } catch {
    // The copy is in app storage, not a browser address.
  }
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

export async function uploadFile(localUri: string, key: string, contentType: string): Promise<string> {
  if (!SIGNER) {
    throw new Error('Media storage is not connected yet.');
  }

  const endpoint = `${SIGNER}/upload?key=${encodeURIComponent(key)}`;

  if (Platform.OS === 'web') {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: await fileBody(localUri, contentType),
    });
    if (!response.ok) throw new Error(`Media upload failed (${response.status})`);
    const uploaded = (await response.text()).trim();
    return uploaded.startsWith('http') ? uploaded : `${SIGNER}/media/${key}`;
  }

  const result = await FileSystem.uploadAsync(endpoint, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });

  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Media upload failed (${result.status})`);
  }

  const uploaded = result.body?.trim();
  return uploaded && uploaded.startsWith('http') ? uploaded : `${SIGNER}/media/${key}`;
}
