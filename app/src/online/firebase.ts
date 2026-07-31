import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

let db: Firestore | null = null;
let authed = false;

export const isFirebaseConfigured = (): boolean => firebaseConfig !== null;

export async function ensureFirebase(): Promise<Firestore> {
  if (!firebaseConfig) {
    throw new Error('Multi-phone mode is not set up yet — the Firebase config is missing.');
  }
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  if (!db) {
    // Auto-detect long polling keeps Firestore working inside Expo Go / RN networking.
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
  if (!authed) {
    await signInAnonymously(getAuth(app));
    authed = true;
  }
  return db;
}
