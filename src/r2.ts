import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { readStoredBlob } from './media';

// Uploads go through a Cloudflare Worker. The R2 key never lives in the app.

const SIGNER = (process.env.EXPO_PUBLIC_R2_SIGNER ?? 'https://my-rental-fleet-media.colemarchant.workers.dev').replace(/\/$/, '');

function uploadBudget(bytes: number) {
  const steps = Math.ceil(bytes / (5 * 1024 * 1024));
  return Math.min(15 * 60_000, Math.max(3 * 60_000, steps * 45_000));
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

function putBlob(endpoint: string, body: Blob, type: string) {
  const budget = uploadBudget(body.size);
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => {
      xhr.abort();
    }, budget);
    const fail = () => {
      clearTimeout(timer);
      reject(new Error('The video is still on this phone. Leave this screen open while it uploads.'));
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
    xhr.send(body);
  });
}

async function uploadMultipart(key: string, body: Blob, type: string) {
  const start = await fetch(`${SIGNER}/upload/start?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': type },
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
      type
    );
    const part = JSON.parse(response) as { partNumber: number; etag: string };
    parts.push(part);
  }
  const finish = await fetch(`${SIGNER}/upload/finish?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
  if (!finish.ok) throw new Error(`Media upload failed (${finish.status})`);
  const uploaded = (await finish.text()).trim();
  return uploaded.startsWith('http') ? uploaded : `${SIGNER}/media/${key}`;
}

let chunkedUploads: Promise<boolean> | null = null;

function canChunkUploads() {
  if (!chunkedUploads) {
    chunkedUploads = fetch(`${SIGNER}/upload/start`, { method: 'GET' })
      .then((response) => response.ok)
      .catch(() => false);
  }
  return chunkedUploads;
}

export async function uploadFile(localUri: string, key: string, contentType: string, signal?: AbortSignal): Promise<string> {
  if (!SIGNER) {
    throw new Error('Media storage is not connected yet.');
  }

  const endpoint = `${SIGNER}/upload?key=${encodeURIComponent(key)}`;

  if (Platform.OS === 'web') {
    const file = await fileBody(localUri, contentType);
    if (!file.body.size) throw new Error('Could not read the saved photo.');
    if (file.body.size > 20 * 1024 * 1024 && (await canChunkUploads())) {
      const multipart = await uploadMultipart(key, file.body, file.type);
      if (multipart) return multipart;
    }
    const uploaded = await putBlob(endpoint, file.body, file.type);
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
