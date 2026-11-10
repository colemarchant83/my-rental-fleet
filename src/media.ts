import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Image, Platform } from 'react-native';

function extension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.mp4')) return 'mp4';
  if (clean.endsWith('.mov')) return 'mov';
  if (clean.endsWith('.webp')) return 'webp';
  return fallback;
}

export function contentTypeFor(uri: string) {
  const ext = extension(uri, 'jpg');
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'mp4' || ext === 'mov') return 'video/mp4';
  return 'image/jpeg';
}

export function isStoredFile(uri?: string) {
  return !!uri && (uri.includes('fleet-media/') || uri.startsWith('idb:'));
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fleet-media', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function mediaByteSize(uri?: string) {
  if (!uri) return 0;
  const stored = await readStoredBlob(uri).catch(() => null);
  if (stored) return stored.size;
  if (Platform.OS !== 'web') {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number') return info.size;
  }
  const response = await fetch(uri).catch(() => null);
  if (!response?.ok) return 0;
  return (await response.blob()).size;
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function fingerprint(uri?: string) {
  if (!uri || typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  try {
    const stored = await readStoredBlob(uri).catch(() => null);
    const blob = stored ?? (await fetch(uri).then((response) => (response.ok ? response.blob() : null)).catch(() => null));
    if (!blob) return undefined;
    return hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  } catch {
    return undefined;
  }
}

export async function readStoredBlob(uri?: string): Promise<Blob | null> {
  if (!uri?.startsWith('idb:') || typeof indexedDB === 'undefined') return null;
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('files', 'readonly').objectStore('files').get(uri.slice(4));
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function rememberBlob(blob: Blob) {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return `idb:${key}`;
}

export function useDisplayUri(localUri?: string, remoteUrl?: string) {
  const [shown, setShown] = useState('');
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    setRemoteFailed(false);
    let live = true;
    const stored = [localUri, remoteUrl].find((uri) => isStoredFile(uri));
    if (!stored) {
      setShown('');
      return () => {
        live = false;
      };
    }
    if (stored.startsWith('idb:')) {
      void readStoredBlob(stored)
        .then((blob) => {
          if (live && blob) setShown(URL.createObjectURL(blob));
        })
        .catch(() => {
          if (live) setShown('');
        });
      return () => {
        live = false;
      };
    }
    if (Platform.OS === 'web') {
      setShown('');
      return () => {
        live = false;
      };
    }
    void FileSystem.readAsStringAsync(stored, { encoding: FileSystem.EncodingType.Base64 })
      .then((base64) => {
        if (live && base64) setShown(`data:${contentTypeFor(stored)};base64,${base64}`);
      })
      .catch(() => {
        if (live) setShown('');
      });
    return () => {
      live = false;
    };
  }, [localUri, remoteUrl]);

  const direct = [localUri, remoteUrl].find((uri) => !!uri && (uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:')));
  return {
    uri: shown || (!remoteFailed ? direct ?? '' : ''),
    failRemote: () => setRemoteFailed(true),
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Copy a picked photo or video into app storage so it survives a refresh and a lost signal. */
export async function persistMedia(uri: string, fallbackExt: string) {
  if (Platform.OS === 'web') {
    if (typeof indexedDB === 'undefined') throw new Error('Could not keep this photo on the device.');
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not keep this photo on the device.');
    return await rememberBlob(await response.blob());
  }
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) throw new Error('Could not keep this photo on the device.');
  const dir = `${root}fleet-media/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const dest = `${dir}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension(uri, fallbackExt)}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    const response = await fetch(uri);
    const dataUrl = await blobToDataUrl(await response.blob());
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) throw new Error('Could not keep this photo on the device.');
    await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  }
}

export async function deleteStoredFile(uri?: string) {
  if (uri?.startsWith('idb:') && typeof indexedDB !== 'undefined') {
    const db = await openMediaDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(uri.slice(4));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return;
  }
  if (!isStoredFile(uri) || !uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

/** True only when the uploaded file can actually be opened. A private link does not count. */
export function remoteMediaLoads(url: string, kind: 'image' | 'video') {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      const done = (ok: boolean) => {
        clearTimeout(timer);
        resolve(ok);
      };
      if (kind === 'video') {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.onloadedmetadata = () => done(true);
        video.onerror = () => done(false);
        video.src = url;
        return;
      }
      const img = new window.Image();
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
    });
  }
  if (kind === 'image') {
    return Image.prefetch(url).then((ok) => ok !== false).catch(() => false);
  }
  return fetch(url, { method: 'HEAD' }).then((res) => res.ok).catch(() => false);
}
