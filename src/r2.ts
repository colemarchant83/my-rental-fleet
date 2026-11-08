import * as FileSystem from 'expo-file-system/legacy';

// Expo-compatible R2 upload using FileSystem.uploadAsync.
// Avoids the React Native Blob / ArrayBuffer limitation.
// The bucket address is public. Access keys must never live in this file.

const ENDPOINT =
  process.env.EXPO_PUBLIC_R2_ENDPOINT ??
  'https://8f479ed6a7e43bbb26474ba9e29b781e.r2.cloudflarestorage.com';
const BUCKET = process.env.EXPO_PUBLIC_R2_BUCKET ?? 'my-rental-fleet';

export async function uploadFile(localUri: string, key: string, contentType: string): Promise<string> {
  if (!ENDPOINT || !BUCKET) {
    throw new Error('R2 environment variables missing. Check your .env file.');
  }

  const url = `${ENDPOINT.replace(/\/$/, '')}/${BUCKET}/${key}`;

  const result = await FileSystem.uploadAsync(url, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`R2 upload failed (${result.status}): ${result.body}`);
  }

  return url;
}
