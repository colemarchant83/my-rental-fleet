import AsyncStorage from '@react-native-async-storage/async-storage';
import { proofTimes } from './fleet-store';

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
  await writeAll(records.filter((record) => record.localId !== localId));
}

export async function loadMaintenanceRecord(localId: string) {
  const records = await readAll();
  return records.find((record) => record.localId === localId) ?? null;
}

export async function saveMaintenance(record: Omit<MaintenanceRecord, 'localId' | 'savedAt' | 'serverSavedAt' | 'notesAt'> & { localId?: string }) {
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
  const next: MaintenanceRecord = {
    localId: record.localId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vehicleId: record.vehicleId,
    date: record.date,
    work: record.work.trim(),
    notes,
    notesAt: notes ? existing?.notesAt || savedAt : undefined,
    miles: record.miles.trim(),
    hours: record.hours.trim(),
    savedAt,
    serverSavedAt,
  };
  const without = records.filter((item) => item.localId !== next.localId);
  await writeAll([next, ...without]);
  return next;
}
