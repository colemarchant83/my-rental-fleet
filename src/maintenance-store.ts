import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fleet.maintenance.v1';

export type MaintenanceRecord = {
  localId: string;
  vehicleId: string;
  date: string;
  work: string;
  notes: string;
  miles: string;
  hours: string;
  savedAt: string;
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

export async function loadMaintenance(vehicleId: string) {
  const records = await readAll();
  return records
    .filter((record) => record.vehicleId === vehicleId)
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export async function loadMaintenanceRecord(localId: string) {
  const records = await readAll();
  return records.find((record) => record.localId === localId) ?? null;
}

export async function saveMaintenance(record: Omit<MaintenanceRecord, 'localId' | 'savedAt'> & { localId?: string }) {
  const records = await readAll();
  const next: MaintenanceRecord = {
    localId: record.localId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vehicleId: record.vehicleId,
    date: record.date,
    work: record.work.trim(),
    notes: record.notes.trim(),
    miles: record.miles.trim(),
    hours: record.hours.trim(),
    savedAt: new Date().toISOString(),
  };
  const without = records.filter((item) => item.localId !== next.localId);
  await AsyncStorage.setItem(KEY, JSON.stringify([next, ...without]));
  return next;
}
