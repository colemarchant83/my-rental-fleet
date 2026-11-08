import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { readStoredBlob } from './media';

// Uploads go through a Cloudflare Worker. The R2 key never lives in the app.

const SIGNER = (process.env.EXPO_PUBLIC_R2_SIGNER ?? 'https://my-rental-fleet-media.colemarchant.workers.dev').replace(/\/$/, '');

async function fileBody(localUri: string, contentType: string) {
  const stored = await readStoredBlob(localUri).catch(() => null);
  if (stored) return stored.type ? stored : new Blob([stored], { type: contentType });
  const response = await fetch(localUri).catch(() => null);
  if (!response?.ok) throw new Error('Could not read the saved photo.');
  const blob = await response.blob();
  return blob.type ? blob : new Blob([blob], { type: contentType });
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

export async function deleteStoredObject(remoteUrl?: string) {
  if (!remoteUrl || !SIGNER || !remoteUrl.startsWith(`${SIGNER}/media/`)) return;
  const response = await fetch(remoteUrl, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error('Could not delete the stored photo.');
  }
}
