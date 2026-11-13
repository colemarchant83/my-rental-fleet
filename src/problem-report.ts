import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const OPERATORS = new Set(['colemarchant3@gmail.com', 'colemarchant@ymail.com']);

const SKIP =
  /leave this screen open|page unavailable offline|not confirmed yet|enter an email|enter a valid email|already has an account|at least 6 characters|email or password is not right|too many tries|connection is needed to sign in|opening your account/i;

const recent = new Map<string, number>();
let mailedAt = 0;

export function isOperator(email?: string | null) {
  return OPERATORS.has((email || auth.currentUser?.email || '').trim().toLowerCase());
}

async function pingOwner() {
  const now = Date.now();
  if (now - mailedAt < 15 * 60 * 1000) return;
  mailedAt = now;
  await fetch('https://formsubmit.co/ajax/cole@my-rental-fleet.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: 'My Rental Fleet problem',
      _template: 'box',
      _captcha: 'false',
      message: 'A user hit a problem. Open My Rental Fleet, tap the name at the top, then Problem reports.',
    }),
  }).catch(() => undefined);
}

export async function reportProblem(message: string, where = 'app') {
  const text = message.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text || SKIP.test(text) || /^script error\.?$/i.test(text) || /resizeobserver/i.test(text)) return;
  const user = auth.currentUser;
  const key = `${user?.uid || 'signed-out'}|${where}|${text}`;
  const now = Date.now();
  if (now - (recent.get(key) || 0) < 30 * 60 * 1000) return;
  recent.set(key, now);
  const page = typeof window === 'undefined' ? '' : window.location.pathname.slice(0, 120);
  await addDoc(collection(db, 'problems'), {
    ownerId: user?.uid || '',
    email: user?.email || '',
    message: text,
    where: where.slice(0, 40),
    page,
    createdAt: serverTimestamp(),
  }).catch(() => undefined);
  void pingOwner();
}
