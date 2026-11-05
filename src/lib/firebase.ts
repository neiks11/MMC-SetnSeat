import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  writeBatch,
} from 'firebase/firestore';
import {
  getDatabase,
  Database,
  ref as dbRef,
  get as dbGet,
  set as dbSet,
} from 'firebase/database';
import { DatabaseSchema } from './types';

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  databaseURL?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigData = {
  apiKey: 'AIzaSyBON-Jjt0-p10vBR0DhO3Zg9Ue6rnI2T9k',
  authDomain: 'mmcsetandseat.firebaseapp.com',
  databaseURL: 'https://mmcsetandseat-default-rtdb.firebaseio.com',
  projectId: 'mmcsetandseat',
  storageBucket: 'mmcsetandseat.firebasestorage.app',
  messagingSenderId: '401059693863',
  appId: '1:401059693863:web:d575ab3db44106bd521502',
  measurementId: 'G-RC7BLP8FG3',
};

const DATA_DIR = path.join(process.cwd(), 'data');
const FB_CONFIG_FILE = path.join(DATA_DIR, 'firebase-config.json');

/**
 * Normalizes data returned from Firebase Realtime Database or Firestore
 * (since Realtime Database strips empty arrays `[]` when storing objects).
 */
export function normalizeDatabaseSchema(raw: Partial<DatabaseSchema> | null | undefined, fallback: DatabaseSchema): DatabaseSchema {
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    settings: {
      ...fallback.settings,
      ...(raw.settings || {}),
      deliveryZones: Array.isArray(raw.settings?.deliveryZones)
        ? raw.settings!.deliveryZones
        : fallback.settings.deliveryZones,
      promoCodes: Array.isArray(raw.settings?.promoCodes)
        ? raw.settings!.promoCodes
        : fallback.settings.promoCodes,
    },
    inventory: Array.isArray(raw.inventory) ? raw.inventory : fallback.inventory,
    bookings: Array.isArray(raw.bookings)
      ? raw.bookings.map((b) => ({
          ...b,
          items: Array.isArray(b.items) ? b.items : [],
          payments: Array.isArray(b.payments) ? b.payments : [],
          damageLogs: Array.isArray(b.damageLogs) ? b.damageLogs : [],
        }))
      : [],
    customers: Array.isArray(raw.customers) ? raw.customers : [],
    damageLogs: Array.isArray(raw.damageLogs) ? raw.damageLogs : [],
    notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
    gallery: Array.isArray(raw.gallery) ? raw.gallery : fallback.gallery,
    reviews: Array.isArray(raw.reviews) ? raw.reviews : fallback.reviews,
  };
}

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
      databaseURL:
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
        DEFAULT_FIREBASE_CONFIG.databaseURL,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    };
  }

  // 2. Check runtime config saved via Admin Dashboard
  try {
    if (fs.existsSync(FB_CONFIG_FILE)) {
      const raw = fs.readFileSync(FB_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as FirebaseConfigData;
      if (parsed.apiKey && parsed.projectId) {
        return {
          ...DEFAULT_FIREBASE_CONFIG,
          ...parsed,
        };
      }
    }
  } catch (err) {
    console.error('Error reading firebase-config.json:', err);
  }

  // 3. Fall back to the configured mmcsetandseat Firebase project
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveRuntimeFirebaseConfig(config: FirebaseConfigData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(FB_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getFirebaseAppInstance(): { app: FirebaseApp | null; config: FirebaseConfigData | null } {
  const config = getActiveFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, config: null };
  }
  try {
    const appName = `mmc-firebase-${config.projectId}`;
    const existing = getApps().find((a) => a.name === appName);
    const app: FirebaseApp = existing || initializeApp(config, appName);
    return { app, config };
  } catch (err) {
    console.error('Failed to initialize Firebase App:', err);
    return { app: null, config: null };
  }
}

export function getFirestoreDb(): { db: Firestore | null; rtdb: Database | null; projectId: string | null } {
  const { app, config } = getFirebaseAppInstance();
  if (!app || !config) {
    return { db: null, rtdb: null, projectId: null };
  }

  let db: Firestore | null = null;
  let rtdb: Database | null = null;

  try {
    if (config.databaseURL) {
      rtdb = getDatabase(app, config.databaseURL);
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Realtime Database:', err);
  }

  try {
    db = getFirestore(app);
  } catch (err) {
    console.error('Failed to initialize Firebase Firestore:', err);
  }

  return { db, rtdb, projectId: config.projectId };
}

/**
 * Reads the complete application state from Firebase Realtime Database (primary)
 * or Cloud Firestore (fallback), and automatically seeds the database on first connection.
 */
export async function readFromFirestore(fallbackSeed: DatabaseSchema): Promise<DatabaseSchema | null> {
  const { db, rtdb } = getFirestoreDb();

  // 1. Try Firebase Realtime Database first (https://mmcsetandseat-default-rtdb.firebaseio.com)
  if (rtdb) {
    try {
      const snap = await dbGet(dbRef(rtdb, 'mmc_system/state_snapshot'));
      if (snap.exists()) {
        return normalizeDatabaseSchema(snap.val(), fallbackSeed);
      } else {
        await writeToFirestore(fallbackSeed);
        return fallbackSeed;
      }
    } catch (err) {
      console.error('Realtime Database read error (checking Firestore/local fallback):', err);
    }
  }

  // 2. Fallback to Cloud Firestore
  if (db) {
    try {
      const snapshotRef = doc(db, 'mmc_system', 'state_snapshot');
      const snap = await getDoc(snapshotRef);

      if (snap.exists()) {
        return normalizeDatabaseSchema(snap.data() as DatabaseSchema, fallbackSeed);
      } else {
        await writeToFirestore(fallbackSeed);
        return fallbackSeed;
      }
    } catch (err) {
      console.error('Firestore read error (falling back to local cache):', err);
    }
  }

  return null;
}

/**
 * Writes the state to Firebase Realtime Database and/or Cloud Firestore:
 * 1. Updates `mmc_system/state_snapshot` for atomic reads
 * 2. Syncs top-level nodes/collections (`settings`, `inventory`, `bookings`, `customers`, `damage_logs`)
 *    so the owner can inspect all live records in the Firebase Console.
 */
export async function writeToFirestore(data: DatabaseSchema): Promise<boolean> {
  const { db, rtdb } = getFirestoreDb();
  const cleanData = JSON.parse(JSON.stringify(data)) as DatabaseSchema;
  let synced = false;

  // 1. Write to Firebase Realtime Database (`https://mmcsetandseat-default-rtdb.firebaseio.com`)
  if (rtdb) {
    try {
      await dbSet(dbRef(rtdb, 'mmc_system/state_snapshot'), cleanData);
      await dbSet(dbRef(rtdb, 'settings'), cleanData.settings);
      await dbSet(dbRef(rtdb, 'inventory'), cleanData.inventory);
      await dbSet(dbRef(rtdb, 'bookings'), cleanData.bookings);
      await dbSet(dbRef(rtdb, 'customers'), cleanData.customers);
      await dbSet(dbRef(rtdb, 'damage_logs'), cleanData.damageLogs);
      synced = true;
    } catch (err) {
      console.error('Realtime Database write error:', err);
    }
  }

  // 2. Also attempt Cloud Firestore sync if enabled
  if (db) {
    try {
      const snapshotRef = doc(db, 'mmc_system', 'state_snapshot');
      await setDoc(snapshotRef, cleanData);

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
      synced = true;
    } catch {
      // Ignore if Firestore is not enabled on the project and only Realtime Database is used
    }
  }

  return synced;
}
