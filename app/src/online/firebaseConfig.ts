import type { FirebaseOptions } from 'firebase/app';

/**
 * Firebase web-app config for the run-good project.
 * Web configs are public app identifiers, not secrets — safe to commit.
 * Access control lives in Firestore security rules.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyCL57xVkGD9P2WVhrRaJP9Ee1dylM6TG_I',
  authDomain: 'run-good-203bb.firebaseapp.com',
  projectId: 'run-good-203bb',
  storageBucket: 'run-good-203bb.firebasestorage.app',
  messagingSenderId: '895130677771',
  appId: '1:895130677771:web:e2d0e445fafd2c8d47cd0e',
};
