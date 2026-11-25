import { collection, deleteField, doc, getDoc, getDocs, increment, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { currentOwnerId } from './account';

export const PLAN_SIZES = [5, 10, 30] as const;

export type PlanAccount = { limit: number | null; credits: number };

export function readPlanLimit(value: unknown) {
  return value === 5 || value === 10 || value === 30 ? value : null;
}

export function machineOnPlan(vehicle: { onPlan?: boolean }) {
  return vehicle.onPlan !== false;
}

function accountFrom(data: Record<string, unknown> | undefined): PlanAccount {
  const credits = data?.reactivationCredits;
  return {
    limit: readPlanLimit(data?.planLimit),
    credits: typeof credits === 'number' && credits > 0 ? credits : 0,
  };
}

export async function fleetOverPlan() {
  const limit = await loadPlanLimit();
  const uid = currentOwnerId();
  if (!limit || !uid) return false;
  const snap = await getDocs(query(collection(db, 'vehicles'), where('ownerId', '==', uid)));
  return snap.docs.length > limit;
}

export async function loadPlanLimit() {
  const uid = currentOwnerId();
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'accounts', uid));
  return readPlanLimit(snap.data()?.planLimit);
}

export function watchPlanLimit(onChange: (limit: number | null) => void) {
  return watchPlanAccount((plan) => onChange(plan.limit));
}

export function watchPlanAccount(onChange: (plan: PlanAccount) => void) {
  const uid = currentOwnerId();
  if (!uid) {
    onChange({ limit: null, credits: 0 });
    return () => undefined;
  }
  return onSnapshot(doc(db, 'accounts', uid), (snap) => {
    onChange(accountFrom(snap.data()));
  }, () => onChange({ limit: null, credits: 0 }));
}

export async function savePlanLimit(limit: number | null) {
  const uid = currentOwnerId();
  if (!uid) throw new Error('Sign in first.');
  await setDoc(doc(db, 'accounts', uid), { ownerId: uid, planLimit: limit ?? 0 }, { merge: true });
}

export async function savePlanChoices(items: { id: string; onPlan: boolean; planLock?: number | null }[]) {
  await Promise.all(items.map((item) => updateDoc(doc(db, 'vehicles', item.id), {
    onPlan: item.onPlan,
    planLock: item.planLock == null ? deleteField() : item.planLock,
  })));
}

export async function noteActiveMachineDeleted() {
  const uid = currentOwnerId();
  if (!uid) return;
  await setDoc(doc(db, 'accounts', uid), { ownerId: uid, reactivationCredits: increment(1) }, { merge: true });
}

export async function useReactivationCredits(count: number) {
  const uid = currentOwnerId();
  if (!uid || count <= 0) return;
  await setDoc(doc(db, 'accounts', uid), { ownerId: uid, reactivationCredits: increment(-count) }, { merge: true });
}
