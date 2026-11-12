import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
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
  cost: string;
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

function cloudPhotos(photos: PhotoRef[]) {
  return photos.map((photo) => ({
    id: photo.id,
    localUri: '',
    remoteUrl: photo.remoteUrl || '',
    addedAt: photo.addedAt || '',
    serverAddedAt: photo.serverAddedAt || '',
    sha256: photo.sha256 || '',
  }));
}

function fromCloud(id: string, data: Record<string, unknown>): MaintenanceRecord {
  const photos = Array.isArray(data.photos) ? data.photos : [];
  return {
    localId: String(data.localId || id),
    vehicleId: String(data.vehicleId || ''),
    date: String(data.date || ''),
    work: String(data.work || ''),
    notes: String(data.notes || ''),
    notesAt: data.notesAt ? String(data.notesAt) : undefined,
    miles: String(data.miles || ''),
    hours: String(data.hours || ''),
    cost: String(data.cost || ''),
    photos: photos.map((photo) => {
      const item = photo as Partial<PhotoRef>;
      return {
        id: String(item.id || ''),
        localUri: '',
        remoteUrl: item.remoteUrl ? String(item.remoteUrl) : undefined,
        addedAt: item.addedAt ? String(item.addedAt) : undefined,
        serverAddedAt: item.serverAddedAt ? String(item.serverAddedAt) : undefined,
        sha256: item.sha256 ? String(item.sha256) : undefined,
      };
    }),
    savedAt: String(data.savedAt || ''),
    serverSavedAt: data.serverSavedAt ? String(data.serverSavedAt) : undefined,
  };
}

async function pushRecord(record: MaintenanceRecord) {
  await setDoc(doc(db, 'maintenance', record.localId), {
    localId: record.localId,
    vehicleId: record.vehicleId,
    date: record.date,
    work: record.work,
    notes: record.notes,
    miles: record.miles,
    hours: record.hours,
    cost: record.cost,
    photos: cloudPhotos(record.photos),
    savedAt: record.savedAt,
    ...(record.notesAt ? { notesAt: record.notesAt } : {}),
    ...(record.serverSavedAt ? { serverSavedAt: record.serverSavedAt } : {}),
  });
}

async function pullRecords(vehicleId: string) {
  const snap = await getDocs(query(collection(db, 'maintenance'), where('vehicleId', '==', vehicleId)));
  return snap.docs.map((item) => fromCloud(item.id, item.data() as Record<string, unknown>));
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
  const local = await fillServerTimes(await readAll());
  let remote: MaintenanceRecord[] = [];
  try {
    remote = await pullRecords(vehicleId);
  } catch {
    remote = [];
  }
  const remoteIds = new Set(remote.map((record) => record.localId));
  for (const record of local) {
    if (record.vehicleId === vehicleId && !remoteIds.has(record.localId)) {
      await pushRecord(record).catch(() => undefined);
    }
  }
  const byId = new Map<string, MaintenanceRecord>();
  for (const record of local) {
    if (record.vehicleId === vehicleId) byId.set(record.localId, record);
  }
  for (const record of remote) {
    const existing = byId.get(record.localId);
    if (!existing) {
      byId.set(record.localId, record);
      continue;
    }
    byId.set(record.localId, {
      ...record,
      ...existing,
      photos: existing.photos.length ? existing.photos : record.photos,
      serverSavedAt: existing.serverSavedAt || record.serverSavedAt,
    });
  }
  const merged = [...byId.values()];
  const others = local.filter((record) => record.vehicleId !== vehicleId);
  await writeAll([...merged, ...others]);
  return merged.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export async function deleteMaintenance(localId: string) {
  const records = await readAll();
  const target = records.find((record) => record.localId === localId);
  await deleteDoc(doc(db, 'maintenance', localId));
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
    cost: (record.cost || '').trim(),
    photos,
    savedAt,
    serverSavedAt,
  };
  const without = records.filter((item) => item.localId !== next.localId);
  await writeAll([next, ...without]);
  await pushRecord(next);
  return next;
}
