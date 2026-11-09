import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { readStoredBlob } from './media';

// Uploads go through a Cloudflare Worker. The R2 key never lives in the app.

const SIGNER = (process.env.EXPO_PUBLIC_R2_SIGNER ?? 'https://my-rental-fleet-media.colemarchant.workers.dev').replace(/\/$/, '');

function timeoutSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(45_000);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

async function fileBody(localUri: string, contentType: string) {
  const stored = await readStoredBlob(localUri).catch(() => null);
  if (stored) {
    const type = stored.type && stored.type !== 'application/octet-stream' ? stored.type : contentType;
    const body = stored.type ? stored : new Blob([stored], { type });
    return { body: body.slice(0, body.size, type), type };
  }
  const response = await fetch(localUri).catch(() => null);
  if (!response?.ok) throw new Error('Could not read the saved photo.');
  const blob = await response.blob();
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : contentType;
  const body = blob.type ? blob : new Blob([blob], { type });
  return { body: body.slice(0, body.size, type), type };
}

function putBlob(endpoint: string, body: Blob, type: string, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => {
      xhr.abort();
      reject(new Error('The upload did not finish. It is still saved on this phone and will try again.'));
    }, 45_000);
    const fail = () => {
      clearTimeout(timer);
      reject(new Error('The upload did not finish. It is still saved on this phone and will try again.'));
    };
    xhr.open('PUT', endpoint);
    xhr.setRequestHeader('Content-Type', type);
    xhr.onload = () => {
      clearTimeout(timer);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Media upload failed (${xhr.status})`));
        return;
      }
      resolve(xhr.responseText.trim());
    };
    xhr.onerror = fail;
    xhr.onabort = fail;
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function uploadMultipart(key: string, body: Blob, type: string, signal?: AbortSignal) {
  const start = await fetch(`${SIGNER}/upload/start?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': type },
    signal: timeoutSignal(signal),
  });
  if (start.status === 404) return '';
  if (!start.ok) throw new Error(`Media upload failed (${start.status})`);
  const { uploadId } = (await start.json()) as { uploadId?: string };
  if (!uploadId) throw new Error('Media upload failed');
  const size = 6 * 1024 * 1024;
  const parts: { partNumber: number; etag: string }[] = [];
  for (let index = 0; index * size < body.size; index += 1) {
    const chunk = body.slice(index * size, Math.min(body.size, (index + 1) * size), type);
    const response = await putBlob(
      `${SIGNER}/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${index + 1}`,
      chunk,
      type,
      signal
    );
    const part = JSON.parse(response) as { partNumber: number; etag: string };
    parts.push(part);
  }
  const finish = await fetch(`${SIGNER}/upload/finish?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
    signal: timeoutSignal(signal),
  });
  if (!finish.ok) throw new Error(`Media upload failed (${finish.status})`);
  const uploaded = (await finish.text()).trim();
  return uploaded.startsWith('http') ? uploaded : `${SIGNER}/media/${key}`;
}

export async function uploadFile(localUri: string, key: string, contentType: string, signal?: AbortSignal): Promise<string> {
  if (!SIGNER) {
    throw new Error('Media storage is not connected yet.');
  }

  const endpoint = `${SIGNER}/upload?key=${encodeURIComponent(key)}`;

  if (Platform.OS === 'web') {
    const file = await fileBody(localUri, contentType);
    if (!file.body.size) throw new Error('Could not read the saved photo.');
    if (file.body.size > 20 * 1024 * 1024) {
      const multipart = await uploadMultipart(key, file.body, file.type, signal).catch((error) => {
        if (error instanceof Error && /404/.test(error.message)) return '';
        throw error;
      });
      if (multipart) return multipart;
    }
    const uploaded = await putBlob(endpoint, file.body, file.type, signal);
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
