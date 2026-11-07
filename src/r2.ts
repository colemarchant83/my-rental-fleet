import * as FileSystem from 'expo-file-system/legacy';

// Expo-compatible R2 upload.
// Uses the legacy FileSystem API to avoid deprecation warnings.
// Direct PUT works when the bucket allows it; later we can switch to signed URLs.

const ENDPOINT = process.env.EXPO_PUBLIC_R2_ENDPOINT;
const BUCKET = process.env.EXPO_PUBLIC_R2_BUCKET;

export async function uploadFile(localUri: string, key: string, contentType: string): Promise<string> {
  if (!ENDPOINT || !BUCKET) {
    throw new Error('R2 environment variables missing. Check your .env file.');
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([binary], { type: contentType });

  const url = `${ENDPOINT.replace(/\/$/, '')}/${BUCKET}/${key}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`R2 upload failed (${response.status}): ${text}`);
  }

  return url;
}
