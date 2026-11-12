import AsyncStorage from '@react-native-async-storage/async-storage';
import { proofTimes, type PhotoRef } from './fleet-store';
import { contentTypeFor, deleteStoredFile } from './media';
import { beginUpload, deleteStoredObject } from './r2';

const KEY = 'fleet.maintenance.v1';

export type MaintenanceRecord = {
  localId: string;
  vehicleId: string;
  date: string;
  work: string;
  notes: string;
  notesAt?: string;
  miles: string;
  hours: string;
  photos: PhotoRef[];
  savedAt: string;
  serverSavedAt?: string;
};

async function readAll(): Promise<MaintenanceRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as MaintenanceRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(records: MaintenanceRecord[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
}

/** The phone time stays as it was. A missing server time is filled the next time there is a connection. */
async function fillServerTimes(records: MaintenanceRecord[]) {
  if (!records.some((record) => !record.serverSavedAt)) return records;
  const { serverSavedAt } = await proofTimes();
  if (!serverSavedAt) return records;
  const next = records.map((record) => (record.serverSavedAt ? record : { ...record, serverSavedAt }));
  await writeAll(next);
  return next;
}

export async function loadMaintenance(vehicleId: string) {
  const records = await fillServerTimes(await readAll());
  return records
    .filter((record) => record.vehicleId === vehicleId)
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export async function deleteMaintenance(localId: string) {
  const records = await readAll();
  const target = records.find((record) => record.localId === localId);
  for (const photo of target?.photos ?? []) {
    await deleteStoredObject(photo.remoteUrl);
    await deleteStoredFile(photo.localUri);
  }
  await writeAll(records.filter((record) => record.localId !== localId));
}

export async function loadMaintenanceRecord(localId: string) {
  const records = await readAll();
  return records.find((record) => record.localId === localId) ?? null;
}

export async function saveMaintenance(record: Omit<MaintenanceRecord, 'localId' | 'savedAt' | 'serverSavedAt' | 'notesAt' | 'photos'> & { localId?: string; photos?: PhotoRef[] }) {
  const records = await readAll();
  const existing = record.localId ? records.find((item) => item.localId === record.localId) : undefined;
  let savedAt = existing?.savedAt;
  let serverSavedAt = existing?.serverSavedAt;
  if (!savedAt || !serverSavedAt) {
    const times = await proofTimes();
    savedAt = savedAt || times.savedAt;
    serverSavedAt = serverSavedAt || times.serverSavedAt;
  }
  const notes = record.notes.trim();
  const localId = record.localId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const photos: PhotoRef[] = [];
  for (const photo of record.photos ?? []) {
    if (photo.remoteUrl) {
      photos.push(photo);
      continue;
    }
    try {
      const remoteUrl = await beginUpload(photo.localUri, `maintenance/${record.vehicleId}/${localId}/${photo.id}.jpg`, contentTypeFor(photo.localUri));
      photos.push({ ...photo, remoteUrl, serverAddedAt: photo.serverAddedAt || serverSavedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not upload the photo.';
      throw new Error(
        /video is still on this phone/i.test(message)
          ? 'A photo is still on this phone. Stay on this page and tap Save record again.'
          : message
      );
    }
  }
  const next: MaintenanceRecord = {
    localId,
    vehicleId: record.vehicleId,
    date: record.date,
    work: record.work.trim(),
    notes,
    notesAt: notes ? existing?.notesAt || savedAt : undefined,
    miles: record.miles.trim(),
    hours: record.hours.trim(),
    photos,
    savedAt,
    serverSavedAt,
  };
  const without = records.filter((item) => item.localId !== next.localId);
  await writeAll([next, ...without]);
  return next;
}
