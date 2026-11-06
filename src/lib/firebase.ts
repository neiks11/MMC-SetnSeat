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

const DATA_DIR = path.join(process.cwd(), 'data');
const FB_CONFIG_FILE = path.join(DATA_DIR, 'firebase-config.json');

/**
 * Normalizes data returned from Firebase Realtime Database or Firestore
 * (since Realtime Database strips empty arrays `[]` when storing objects).
 */
export function normalizeDatabaseSchema(
  raw: Partial<DatabaseSchema> | null | undefined,
  fallback: DatabaseSchema
): DatabaseSchema {
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    settings: {
      ...fallback.settings,
      ...(raw.settings || {}),
      // Never overwrite local adminPassword hash with a redacted placeholder
      adminPassword:
        raw.settings?.adminPassword && raw.settings.adminPassword !== '***'
          ? raw.settings.adminPassword
          : fallback.settings.adminPassword,
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
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
  };
}

/**
 * Reads Firebase configuration strictly from environment variables or the gitignored
 * server-side `data/firebase-config.json` file (no hardcoded keys in source control).
 */
export function getActiveFirebaseConfig(): FirebaseConfigData | null {
  // 1. Check environment variables first
  if (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your_api_key_here' &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your_firebase_web_api_key_here'
  ) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain:
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      databaseURL:
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
        `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    };
  }

  // 2. Check gitignored runtime config (`data/firebase-config.json`)
  try {
    if (fs.existsSync(FB_CONFIG_FILE)) {
      const raw = fs.readFileSync(FB_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as FirebaseConfigData;
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // Do not log raw config errors to stdout in production
  }

  return null;
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
  } catch {
    return { app: null, config: null };
  }
}

export function getFirestoreDb(): {
  db: Firestore | null;
  rtdb: Database | null;
  projectId: string | null;
} {
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
  } catch {
    // ignore rtdb init error
  }

  try {
    db = getFirestore(app);
  } catch {
    // ignore firestore init error
  }

  return { db, rtdb, projectId: config.projectId };
}

export async function readFromFirestore(
  fallbackSeed: DatabaseSchema
): Promise<DatabaseSchema | null> {
  const { db, rtdb } = getFirestoreDb();

  if (rtdb) {
    try {
      const snap = await dbGet(dbRef(rtdb, 'mmc_system/state_snapshot'));
      if (snap.exists()) {
        return normalizeDatabaseSchema(snap.val(), fallbackSeed);
      } else {
        await writeToFirestore(fallbackSeed);
        return fallbackSeed;
      }
    } catch {
      // Fall through to Firestore / local cache
    }
  }

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
    } catch {
      // Fall through to local cache
    }
  }

  return null;
}

export async function writeToFirestore(data: DatabaseSchema): Promise<boolean> {
  const { db, rtdb } = getFirestoreDb();
  const cleanData = JSON.parse(JSON.stringify(data)) as DatabaseSchema;
  // Redact adminPassword from public settings node
  const publicSettings = {
    ...cleanData.settings,
    adminPassword: '***',
  };
  let synced = false;

  if (rtdb) {
    try {
      await dbSet(dbRef(rtdb, 'mmc_system/state_snapshot'), {
        ...cleanData,
        settings: publicSettings,
      });
      await dbSet(dbRef(rtdb, 'settings'), publicSettings);
      await dbSet(dbRef(rtdb, 'inventory'), cleanData.inventory);
      await dbSet(dbRef(rtdb, 'bookings'), cleanData.bookings);
      await dbSet(dbRef(rtdb, 'customers'), cleanData.customers);
      await dbSet(dbRef(rtdb, 'damage_logs'), cleanData.damageLogs);
      synced = true;
    } catch {
      // ignore RTDB write error
    }
  }

  if (db) {
    try {
      const snapshotRef = doc(db, 'mmc_system', 'state_snapshot');
      await setDoc(snapshotRef, {
        ...cleanData,
        settings: publicSettings,
      });

      const batch = writeBatch(db);
      const settingsRef = doc(collection(db, 'settings'), 'default');
      batch.set(settingsRef, publicSettings);

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
      // ignore Firestore write error
    }
  }

  return synced;
}
