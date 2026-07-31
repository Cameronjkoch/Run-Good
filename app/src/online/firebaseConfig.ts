import type { FirebaseOptions } from 'firebase/app';

/**
 * Paste your Firebase web-app config here.
 * Firebase console → Project settings (gear icon) → Your apps → SDK setup and
 * configuration → "Config". It looks like:
 *
 *   export const firebaseConfig: FirebaseOptions | null = {
 *     apiKey: '...',
 *     authDomain: '...',
 *     projectId: '...',
 *     storageBucket: '...',
 *     messagingSenderId: '...',
 *     appId: '...',
 *   };
 *
 * Web configs are public app identifiers, not secrets — safe to commit.
 * Access control lives in Firestore security rules.
 */
export const firebaseConfig: FirebaseOptions | null = null;
