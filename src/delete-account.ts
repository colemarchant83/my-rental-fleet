import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteUser } from 'firebase/auth';
import { collection, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { deleteVehicleRecord, loadCachedVehicles } from './fleet-store';
import { deleteMaintenance, loadMaintenance } from './maintenance-store';
import { deleteStoredObject } from './r2';

const LOCAL_KEYS = ['fleet.rentals.v1', 'fleet.covers.v1', 'fleet.vehicles.v1', 'fleet.maintenance.v1'];

function collectUrls(value: unknown, urls: string[]) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ['remoteUrl', 'videoUrl', 'photoUrl']) {
    if (typeof record[key] === 'string') urls.push(record[key]);
  }
  for (const child of Object.values(record)) collectUrls(child, urls);
}

async function eraseDocMedia(data: unknown) {
  const urls: string[] = [];
  collectUrls(data, urls);
  for (const url of urls) await deleteStoredObject(url).catch(() => undefined);
}

export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before deleting the account.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('An internet connection is needed to delete the account.');
  }
  const token = await user.getIdTokenResult();
  const authTime = Date.parse(token.authTime);
  if (!Number.isFinite(authTime) || Date.now() - authTime > 5 * 60 * 1000) {
    throw new Error('Sign out, sign in again, and then delete the account.');
  }

  const uid = user.uid;
  const cached = await loadCachedVehicles();
  const vehicles = await getDocs(query(collection(db, 'vehicles'), where('ownerId', '==', uid)));
  const ids = new Set<string>();
  for (const vehicle of cached) {
    if (!vehicle.ownerId || vehicle.ownerId === uid) ids.add(vehicle.id);
  }
  for (const item of vehicles.docs) ids.add(item.id);

  for (const id of ids) {
    const records = await loadMaintenance(id);
    for (const record of records) await deleteMaintenance(record.localId);
    await deleteVehicleRecord(id);
  }

  for (const name of ['rentals', 'maintenance', 'uploadAlerts'] as const) {
    const extra = await getDocs(query(collection(db, name), where('ownerId', '==', uid))).catch(() => null);
    if (!extra) continue;
    for (const item of extra.docs) {
      await eraseDocMedia(item.data());
      await deleteDoc(item.ref);
    }
  }

  await AsyncStorage.multiRemove([...LOCAL_KEYS, `fleet.vehicles.v1.${uid}`]);
  try {
    await deleteUser(user);
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
    if (code === 'auth/requires-recent-login') {
      throw new Error('The records were erased. Sign out, sign in again, and tap Delete account once more to remove the login.');
    }
    throw err;
  }
}
