import * as FileSystem from 'expo-file-system/legacy';

// Uploads go through a Cloudflare Worker. The R2 key never lives in the app.
// Set EXPO_PUBLIC_R2_SIGNER to the worker address after it is deployed.

const SIGNER = (process.env.EXPO_PUBLIC_R2_SIGNER ?? 'https://my-rental-fleet-media.colemarchant.workers.dev').replace(/\/$/, '');

export async function uploadFile(localUri: string, key: string, contentType: string): Promise<string> {
  if (!SIGNER) {
    throw new Error('Media storage is not connected yet.');
  }

  const endpoint = `${SIGNER}/upload?key=${encodeURIComponent(key)}`;
  const result = await FileSystem.uploadAsync(endpoint, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Media upload failed (${result.status})`);
  }

  const uploaded = result.body?.trim();
  return uploaded && uploaded.startsWith('http') ? uploaded : `${SIGNER}/media/${key}`;
}
