import fs from 'fs';
import path from 'path';
import {
  DatabaseSchema,
  Booking,
  BookingStatus,
} from './types';
import { getInitialSeedData } from './seed-data';
import {
  readFromFirestore,
  writeToFirestore,
  getActiveFirebaseConfig,
} from './firebase';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'mmc-database.json');

function readLocalCache(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch (err) {
    console.error('Error reading local cache, falling back to initial seed:', err);
    return getInitialSeedData();
  }
}

function writeLocalCache(data: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Reads from Firebase Cloud Firestore if configured, otherwise uses local cache
 * (and automatically seeds Firestore on first connection).
 */
export async function readDb(): Promise<DatabaseSchema> {
  const localData = readLocalCache();
  const fbConfig = getActiveFirebaseConfig();
  if (fbConfig) {
    const cloudData = await readFromFirestore(localData);
    if (cloudData) {
      writeLocalCache(cloudData);
      return cloudData;
    }
  }
  return localData;
}

/**
 * Writes to Firebase Cloud Firestore and updates local cache.
 */
export async function writeDb(data: DatabaseSchema): Promise<{ syncedToFirebase: boolean }> {
  writeLocalCache(data);
  const fbConfig = getActiveFirebaseConfig();
  if (fbConfig) {
    const ok = await writeToFirestore(data);
    return { syncedToFirebase: ok };
  }
  return { syncedToFirebase: false };
}

export async function resetDbToSeed(): Promise<DatabaseSchema> {
  const initial = getInitialSeedData();
  await writeDb(initial);
  return initial;
}

/**
 * Checks if two inclusive YYYY-MM-DD date ranges overlap.
 */
export function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}

/**
 * Calculates number of rental days between eventDate and returnDate (inclusive minimum 1 day).
 */
export function calculateRentalDays(eventDate: string, returnDate: string): number {
  if (!eventDate || !returnDate) return 1;
  const start = new Date(eventDate + 'T00:00:00');
  const end = new Date(returnDate + 'T00:00:00');
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export interface ItemAvailability {
  itemId: string;
  totalStock: number;
  bookedQty: number;
  remainingStock: number;
  isAvailable: boolean;
}

/**
 * Server-side stock & availability calculator for a given date range using Firebase data.
 * Blocks stock from any booking whose status is Pending, Confirmed, Out for Delivery, or In Use.
 */
export async function getAvailabilityForDateRange(
  startDate: string,
  endDate: string,
  excludeBookingId?: string,
  preloadedDb?: DatabaseSchema
): Promise<Record<string, ItemAvailability>> {
  const db = preloadedDb || (await readDb());
  const effectiveEnd = endDate && endDate >= startDate ? endDate : startDate;

  const activeStatuses: BookingStatus[] = [
    'Pending',
    'Confirmed',
    'Out for Delivery',
    'In Use',
  ];

  const overlappingBookings = db.bookings.filter((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (!activeStatuses.includes(b.status)) return false;
    return datesOverlap(startDate, effectiveEnd, b.eventDate, b.returnDate || b.eventDate);
  });

  // Track direct & component usage
  const bookedMap: Record<string, number> = {};
  for (const item of db.inventory) {
    bookedMap[item.id] = 0;
  }

  for (const booking of overlappingBookings) {
    for (const line of booking.items) {
      bookedMap[line.itemId] = (bookedMap[line.itemId] || 0) + line.quantity;

      // If this booked item is a package with includedItems, also reserve component stock
      const invItem = db.inventory.find((i) => i.id === line.itemId);
      if (invItem?.includedItems && invItem.includedItems.length > 0) {
        for (const comp of invItem.includedItems) {
          if (bookedMap[comp.itemId] !== undefined) {
            bookedMap[comp.itemId] += comp.quantity * line.quantity;
          }
        }
      }
    }
  }

  const result: Record<string, ItemAvailability> = {};

  // First pass: individual items
  for (const item of db.inventory) {
    const bookedQty = bookedMap[item.id] || 0;
    const remainingStock = Math.max(0, item.totalStock - bookedQty);
    result[item.id] = {
      itemId: item.id,
      totalStock: item.totalStock,
      bookedQty,
      remainingStock,
      isAvailable: item.active && remainingStock > 0,
    };
  }

  // Second pass: for packages, constrain remaining package stock by component availability too
  for (const item of db.inventory) {
    if (item.includedItems && item.includedItems.length > 0) {
      let maxByComponents = result[item.id].remainingStock;
      for (const comp of item.includedItems) {
        const compAvail = result[comp.itemId];
        if (compAvail && comp.quantity > 0) {
          const possibleBundles = Math.floor(compAvail.remainingStock / comp.quantity);
          maxByComponents = Math.min(maxByComponents, possibleBundles);
        }
      }
      result[item.id].remainingStock = Math.max(0, maxByComponents);
      result[item.id].isAvailable = item.active && result[item.id].remainingStock > 0;
    }
  }

  return result;
}

/**
 * Generates a unique booking reference number like MMC-2026-1005
 */
export function generateReferenceNumber(existingBookings: Booking[]): string {
  const year = new Date().getFullYear();
  const maxNum = existingBookings.reduce((acc, b) => {
    const match = b.referenceNumber.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      return n > acc ? n : acc;
    }
    return acc;
  }, 1000);
  return `MMC-${year}-${maxNum + 1}`;
}
