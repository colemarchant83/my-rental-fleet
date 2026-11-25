import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { currentOwnerId } from './account';

export const PLAN_SIZES = [5, 10, 30] as const;

export function readPlanLimit(value: unknown) {
  return value === 5 || value === 10 || value === 30 ? value : null;
}

export function machineOnPlan(vehicle: { onPlan?: boolean }) {
  return vehicle.onPlan !== false;
}

export async function loadPlanLimit() {
  const uid = currentOwnerId();
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'accounts', uid));
  return readPlanLimit(snap.data()?.planLimit);
}

export function watchPlanLimit(onChange: (limit: number | null) => void) {
  const uid = currentOwnerId();
  if (!uid) {
    onChange(null);
    return () => undefined;
  }
  return onSnapshot(doc(db, 'accounts', uid), (snap) => {
    onChange(readPlanLimit(snap.data()?.planLimit));
  }, () => onChange(null));
}

export async function savePlanLimit(limit: number | null) {
  const uid = currentOwnerId();
  if (!uid) throw new Error('Sign in first.');
  await setDoc(doc(db, 'accounts', uid), { ownerId: uid, planLimit: limit ?? 0 }, { merge: true });
}

export async function savePlanChoices(ids: { id: string; onPlan: boolean }[]) {
  await Promise.all(ids.map((item) => updateDoc(doc(db, 'vehicles', item.id), { onPlan: item.onPlan })));
}
