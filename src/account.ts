import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const OWNED = ['vehicles', 'rentals', 'maintenance', 'uploadAlerts'];

export function currentOwnerId() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in before saving.');
  return uid;
}

export function watchAccount(onChange: (user: User | null) => void) {
  return onAuthStateChanged(auth, onChange);
}

export async function createAccount(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await claimExistingRecords(credential.user.uid);
  return credential.user;
}

export async function signInAccount(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await claimExistingRecords(credential.user.uid);
  return credential.user;
}

export async function signOutAccount() {
  await signOut(auth);
}

/** Records saved before accounts existed have no owner. The signed-in account takes those, and only those. */
export async function claimExistingRecords(uid: string) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const name of OWNED) {
    const snap = await getDocs(collection(db, name)).catch(() => null);
    if (!snap) continue;
    for (const item of snap.docs) {
      if (!item.get('ownerId')) await updateDoc(item.ref, { ownerId: uid }).catch(() => undefined);
    }
  }
}

export function accountError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/email-already-in-use') return 'That email already has an account. Sign in instead.';
  if (code === 'auth/weak-password') return 'Use a password of at least 6 characters.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'That email or password is not right.';
  if (code === 'auth/operation-not-allowed') return 'Email sign-in is not turned on yet. In Firebase, open Authentication, then Sign-in method, and turn on Email/Password.';
  if (code === 'auth/network-request-failed') return 'A connection is needed to sign in the first time.';
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a few minutes and try again.';
  return error instanceof Error ? error.message : 'Could not sign in.';
}
