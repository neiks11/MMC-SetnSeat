import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  writeBatch,
} from 'firebase/firestore';
import { DatabaseSchema } from './types';

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FB_CONFIG_FILE = path.join(DATA_DIR, 'firebase-config.json');

export function getActiveFirebaseConfig(): FirebaseConfigData | null {
  // 1. Check environment variables first
  if (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your_api_key_here'
  ) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain:
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    };
  }

  // 2. Check runtime config saved via Admin Dashboard
  try {
    if (fs.existsSync(FB_CONFIG_FILE)) {
      const raw = fs.readFileSync(FB_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as FirebaseConfigData;
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading firebase-config.json:', err);
  }

  return null;
}

export function saveRuntimeFirebaseConfig(config: FirebaseConfigData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FB_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getFirestoreDb(): { db: Firestore | null; projectId: string | null } {
  const config = getActiveFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { db: null, projectId: null };
  }

  try {
    const appName = `mmc-firebase-${config.projectId}`;
    const existing = getApps().find((a) => a.name === appName);
    const app: FirebaseApp = existing || initializeApp(config, appName);
    const db = getFirestore(app);
    return { db, projectId: config.projectId };
  } catch (err) {
    console.error('Failed to initialize Firebase Firestore:', err);
    return { db: null, projectId: null };
  }
}

/**
 * Reads the complete application state from Firebase Cloud Firestore
 * (and automatically seeds Firestore if the project is empty).
 */
export async function readFromFirestore(fallbackSeed: DatabaseSchema): Promise<DatabaseSchema | null> {
  const { db } = getFirestoreDb();
  if (!db) return null;

  try {
    const snapshotRef = doc(db, 'mmc_system', 'state_snapshot');
    const snap = await getDoc(snapshotRef);

    if (snap.exists()) {
      return snap.data() as DatabaseSchema;
    } else {
      // First time connecting to this Firestore database: seed it automatically!
      await writeToFirestore(fallbackSeed);
      return fallbackSeed;
    }
  } catch (err) {
    console.error('Firestore read error (falling back to local cache):', err);
    return null;
  }
}

/**
 * Writes the state to Firebase Cloud Firestore:
 * 1. Updates `mmc_system/state_snapshot` for fast atomic reads
 * 2. Syncs top-level collections (`settings`, `inventory`, `bookings`, `customers`, `damage_logs`)
 *    so the owner can also inspect individual documents in the Firebase Console!
 */
export async function writeToFirestore(data: DatabaseSchema): Promise<boolean> {
  const { db } = getFirestoreDb();
  if (!db) return false;

  try {
    const cleanData = JSON.parse(JSON.stringify(data)) as DatabaseSchema;

    // 1. Write primary state snapshot document
    const snapshotRef = doc(db, 'mmc_system', 'state_snapshot');
    await setDoc(snapshotRef, cleanData);

    // 2. Sync structured collections in a batch so Firebase Console shows individual collections
    const batch = writeBatch(db);

    const settingsRef = doc(collection(db, 'settings'), 'default');
    batch.set(settingsRef, cleanData.settings);

    for (const item of cleanData.inventory.slice(0, 50)) {
      batch.set(doc(collection(db, 'inventory'), item.id), item);
    }

    for (const booking of cleanData.bookings.slice(0, 50)) {
      batch.set(doc(collection(db, 'bookings'), booking.id), booking);
    }

    for (const customer of cleanData.customers.slice(0, 50)) {
      batch.set(doc(collection(db, 'customers'), customer.id), customer);
    }

    for (const dmg of cleanData.damageLogs.slice(0, 50)) {
      batch.set(doc(collection(db, 'damage_logs'), dmg.id), dmg);
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.error('Firestore write error:', err);
    return false;
  }
}

