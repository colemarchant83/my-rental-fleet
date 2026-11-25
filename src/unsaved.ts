import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UnsavedInspection = { mode: 'checkout' | 'checkin'; renterName: string };

export function startedDraft(raw: string | null, mode: 'checkout' | 'checkin'): UnsavedInspection | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as {
      renterName?: string;
      side?: {
        fuel?: string;
        miles?: string;
        hours?: string;
        notes?: string;
        videoUri?: string;
        videoUrl?: string;
        spots?: Record<string, { status?: string; note?: string; photos?: { localUri?: string; remoteUrl?: string }[] }>;
      };
    };
    const side = saved.side;
    const name = saved.renterName?.trim() || '';
    const spots = Object.values(side?.spots || {});
    const started = !!(
      name ||
      side?.miles?.trim() ||
      side?.hours?.trim() ||
      side?.notes?.trim() ||
      side?.videoUri ||
      side?.videoUrl ||
      (side?.fuel && side.fuel !== 'Not recorded') ||
      spots.some((spot) => spot.status === 'issue' || spot.note?.trim() || spot.photos?.some((photo) => photo.localUri || photo.remoteUrl))
    );
    return started ? { mode, renterName: name } : null;
  } catch {
    return null;
  }
}

async function draftValue(key: string) {
  if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

export async function unsavedForVehicle(vehicleId: string) {
  const next: UnsavedInspection[] = [];
  for (const mode of ['checkout', 'checkin'] as const) {
    const found = startedDraft(await draftValue(`fleet-inspection-draft:${vehicleId}:${mode}`), mode);
    if (found) next.push(found);
  }
  return next;
}

export async function unsavedVehicleIds() {
  const keys = Platform.OS === 'web'
    ? Object.keys(typeof localStorage === 'undefined' ? {} : localStorage)
    : await AsyncStorage.getAllKeys();
  const ids = new Set<string>();
  await Promise.all(keys.filter((key) => key.startsWith('fleet-inspection-draft:')).map(async (key) => {
    const [, vehicleId, modeRaw] = key.split(':');
    const mode = modeRaw === 'checkin' ? 'checkin' : 'checkout';
    if (vehicleId && startedDraft(await draftValue(key), mode)) ids.add(vehicleId);
  }));
  return [...ids];
}
