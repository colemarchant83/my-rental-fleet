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
  return !!uri && uri.includes('fleet-media/');
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
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) return uri;
  const dir = `${root}fleet-media/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const dest = `${dir}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension(uri, fallbackExt)}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    try {
      const response = await fetch(uri);
      const dataUrl = await blobToDataUrl(await response.blob());
      const base64 = dataUrl.split(',')[1] ?? '';
      if (!base64) return uri;
      await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
      return dest;
    } catch {
      return uri;
    }
  }
}

export async function deleteStoredFile(uri?: string) {
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
        video.preload = 'metadata';
        video.onloadeddata = () => done(true);
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
