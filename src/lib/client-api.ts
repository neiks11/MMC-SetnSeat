'use client';

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
  DatabaseSchema,
  Booking,
  BookingItemLine,
  BookingStatus,
  PaymentStatus,
  InventoryItem,
} from './types';
import { getInitialSeedData } from './seed-data';

export interface ItemAvailability {
  itemId: string;
  totalStock: number;
  bookedQty: number;
  remainingStock: number;
  isAvailable: boolean;
}

export interface ClientFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const LOCAL_DB_KEY = 'mmc_setnseat_db_v1';
const LOCAL_FB_CONFIG_KEY = 'mmc_setnseat_fb_config_v1';

/**
 * Resolves public asset paths (such as `/logo.jpg`) so they work both on
 * localhost (`/logo.jpg`) and on GitHub Pages (`/MMC-SetnSeat/logo.jpg`).
 */
export function getAssetPath(relativePath: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const clean = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${basePath}${clean}`;
}

export function getClientFirebaseConfig(): ClientFirebaseConfig | null {
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

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LOCAL_FB_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ClientFirebaseConfig;
        if (parsed.apiKey && parsed.projectId) return parsed;
      }
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

function saveClientFirebaseConfig(config: ClientFirebaseConfig): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_FB_CONFIG_KEY, JSON.stringify(config));
  }
}

function getClientFirestore(): { db: Firestore | null; projectId: string | null } {
  const config = getClientFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { db: null, projectId: null };
  }
  try {
    const appName = `mmc-client-fb-${config.projectId}`;
    const existing = getApps().find((a) => a.name === appName);
    const app: FirebaseApp = existing || initializeApp(config, appName);
    return { db: getFirestore(app), projectId: config.projectId };
  } catch {
    return { db: null, projectId: null };
  }
}

function readBrowserCache(): DatabaseSchema {
  if (typeof window === 'undefined') return getInitialSeedData();
  try {
    const raw = window.localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      const seed = getInitialSeedData();
      window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    return getInitialSeedData();
  }
}

function writeBrowserCache(data: DatabaseSchema): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data));
    } catch {
      // ignore quota error
    }
  }
}

async function readClientDb(): Promise<DatabaseSchema> {
  const local = readBrowserCache();
  const { db } = getClientFirestore();
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'mmc_system', 'state_snapshot'));
      if (snap.exists()) {
        const cloud = snap.data() as DatabaseSchema;
        writeBrowserCache(cloud);
        return cloud;
      } else {
        await writeClientDb(local);
        return local;
      }
    } catch {
      return local;
    }
  }
  return local;
}

async function writeClientDb(data: DatabaseSchema): Promise<{ syncedToFirebase: boolean }> {
  writeBrowserCache(data);
  const { db } = getClientFirestore();
  if (!db) return { syncedToFirebase: false };

  try {
    const cleanData = JSON.parse(JSON.stringify(data)) as DatabaseSchema;
    await setDoc(doc(db, 'mmc_system', 'state_snapshot'), cleanData);

    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'settings'), 'default'), cleanData.settings);
    for (const item of cleanData.inventory.slice(0, 50)) {
      batch.set(doc(collection(db, 'inventory'), item.id), item);
    }
    for (const booking of cleanData.bookings.slice(0, 50)) {
      batch.set(doc(collection(db, 'bookings'), booking.id), booking);
    }
    await batch.commit();
    return { syncedToFirebase: true };
  } catch {
    return { syncedToFirebase: false };
  }
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}

function calculateRentalDays(eventDate: string, returnDate: string): number {
  if (!eventDate || !returnDate) return 1;
  const start = new Date(eventDate + 'T00:00:00');
  const end = new Date(returnDate + 'T00:00:00');
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function generateReferenceNumber(existingBookings: Booking[]): string {
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

function computeAvailability(
  db: DatabaseSchema,
  startDate: string,
  endDate: string,
  excludeBookingId?: string
): Record<string, ItemAvailability> {
  const effectiveEnd = endDate && endDate >= startDate ? endDate : startDate;
  const activeStatuses: BookingStatus[] = ['Pending', 'Confirmed', 'Out for Delivery', 'In Use'];

  const overlappingBookings = db.bookings.filter((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (!activeStatuses.includes(b.status)) return false;
    return datesOverlap(startDate, effectiveEnd, b.eventDate, b.returnDate || b.eventDate);
  });

  const bookedMap: Record<string, number> = {};
  for (const item of db.inventory) {
    bookedMap[item.id] = 0;
  }

  for (const booking of overlappingBookings) {
    for (const line of booking.items) {
      bookedMap[line.itemId] = (bookedMap[line.itemId] || 0) + line.quantity;
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

function makeJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Universal API handler that uses server routes when running on Node/Vercel,
 * and seamlessly runs in the browser (Firebase Cloud Firestore + localStorage)
 * when hosted on GitHub Pages (`neiks11.github.io/MMC-SetnSeat`).
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

  if (!isStaticExport) {
    try {
      const res = await fetch(input, init);
      if (res.status !== 404 && res.status !== 405) {
        return res;
      }
    } catch {
      // Fall through to client-side database engine
    }
  }

  const urlObj = new URL(input, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;
  const method = (init?.method || 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};

  // 1. /api/state
  if (pathname.endsWith('/api/state')) {
    const startDate = searchParams.get('startDate') || new Date().toISOString().slice(0, 10);
    const endDate = searchParams.get('endDate') || startDate;
    const ref = searchParams.get('ref');

    const db = await readClientDb();
    const availability = computeAvailability(db, startDate, endDate);
    const fbConfig = getClientFirebaseConfig();

    if (ref) {
      const found = db.bookings.find(
        (b) => b.referenceNumber.toLowerCase() === ref.toLowerCase().trim()
      );
      return makeJsonResponse({
        booking: found || null,
        settings: { ...db.settings, adminPassword: '***' },
      });
    }

    return makeJsonResponse({
      firebaseStatus: {
        connected: Boolean(fbConfig?.projectId && fbConfig?.apiKey),
        projectId: fbConfig?.projectId || null,
        authDomain: fbConfig?.authDomain || null,
      },
      settings: { ...db.settings, adminPassword: '***' },
      inventory: db.inventory,
      availability,
      bookings: db.bookings,
      customers: db.customers,
      damageLogs: db.damageLogs,
      notifications: db.notifications,
      gallery: db.gallery,
      reviews: db.reviews,
    });
  }

  // 2. /api/availability
  if (pathname.endsWith('/api/availability')) {
    const startDate = searchParams.get('startDate') || new Date().toISOString().slice(0, 10);
    const endDate = searchParams.get('endDate') || startDate;
    const month = searchParams.get('month');

    const db = await readClientDb();
    const availability = computeAvailability(db, startDate, endDate);

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, m, 0).getDate();
      const calendarDays: Record<string, any> = {};

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
        const dayAvail = computeAvailability(db, dateStr, dateStr);
        const dayBookings = db.bookings.filter(
          (b) =>
            b.status !== 'Cancelled' &&
            b.eventDate <= dateStr &&
            (b.returnDate || b.eventDate) >= dateStr
        );

        let chairsBooked = 0;
        let tablesBooked = 0;
        for (const item of db.inventory) {
          const av = dayAvail[item.id];
          if (av) {
            if (item.category === 'Chairs') chairsBooked += av.bookedQty;
            if (item.category === 'Tables') tablesBooked += av.bookedQty;
          }
        }

        calendarDays[dateStr] = {
          date: dateStr,
          bookingsCount: dayBookings.length,
          bookings: dayBookings.map((b) => ({
            id: b.id,
            referenceNumber: b.referenceNumber,
            customerName: b.customerName,
            eventType: b.eventType,
            status: b.status,
            municipality: b.municipality,
            totalAmount: b.totalAmount,
          })),
          chairsBooked,
          tablesBooked,
        };
      }
      return makeJsonResponse({ availability, calendarDays });
    }

    return makeJsonResponse({ availability, startDate, endDate });
  }

  // 3. /api/auth
  if (pathname.endsWith('/api/auth') && method === 'POST') {
    const db = await readClientDb();
    const { username, password } = body;
    const validUser = db.settings.adminUsername || 'admin';
    const validPass = db.settings.adminPassword || 'password123';
    if (username === validUser && password === validPass) {
      return makeJsonResponse({
        authenticated: true,
        username: validUser,
        businessName: db.settings.businessName,
      });
    }
    return makeJsonResponse({ error: 'Invalid admin username or password.' }, 401);
  }

  // 4. /api/bookings
  if (pathname.endsWith('/api/bookings')) {
    const db = await readClientDb();

    if (method === 'POST') {
      if (body.websiteHoneypot && String(body.websiteHoneypot).trim() !== '') {
        return makeJsonResponse({ error: 'Spam detected.' }, 400);
      }

      const {
        customerName,
        customerPhone,
        customerEmail,
        eventType,
        eventDate,
        returnDate,
        eventTime,
        municipality,
        barangay,
        venueAddress,
        fulfillmentType,
        includeSetup,
        paymentMethod,
        discountCode,
        notes,
        items,
        proofImageUrl,
        paymentReferenceNo,
      } = body;

      if (!customerName || !customerPhone || !eventDate || !Array.isArray(items) || items.length === 0) {
        return makeJsonResponse(
          { error: 'Please complete all required customer details, event date, and select at least one rental item.' },
          400
        );
      }

      const effectiveReturnDate = returnDate && returnDate >= eventDate ? returnDate : eventDate;
      const rentalDays = calculateRentalDays(eventDate, effectiveReturnDate);
      const availability = computeAvailability(db, eventDate, effectiveReturnDate);

      const bookingLines: BookingItemLine[] = [];
      let subtotal = 0;

      for (const reqItem of items) {
        const qty = Number(reqItem.quantity);
        if (!qty || qty <= 0) continue;
        const invItem = db.inventory.find((i) => i.id === reqItem.itemId);
        if (!invItem || !invItem.active) {
          return makeJsonResponse({ error: `Item "${reqItem.itemId}" is no longer available.` }, 400);
        }
        const avail = availability[invItem.id];
        if (!avail || qty > avail.remainingStock) {
          return makeJsonResponse(
            {
              error: `Insufficient stock for "${invItem.name}" on ${eventDate}. Only ${avail ? avail.remainingStock : 0} left for those dates.`,
            },
            409
          );
        }
        const lineTotal = invItem.pricePerDay * qty * rentalDays;
        subtotal += lineTotal;
        bookingLines.push({
          id: `bki-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: invItem.id,
          itemName: invItem.name,
          category: invItem.category,
          quantity: qty,
          pricePerDay: invItem.pricePerDay,
          lineTotal,
        });
      }

      let deliveryFee = 0;
      if (fulfillmentType === 'Delivery') {
        if (subtotal >= db.settings.freeDeliveryMinOrder && db.settings.freeDeliveryMinOrder > 0) {
          deliveryFee = 0;
        } else {
          const zone = db.settings.deliveryZones.find((z) => z.municipality === municipality);
          deliveryFee = zone ? zone.fee : db.settings.defaultDeliveryFee;
        }
      }

      const setupFee = includeSetup ? db.settings.defaultSetupFee : 0;
      let discountAmount = 0;
      let appliedCode: string | undefined = undefined;
      if (discountCode) {
        const foundPromo = db.settings.promoCodes.find(
          (p) => p.active && p.code.toUpperCase() === String(discountCode).trim().toUpperCase()
        );
        if (foundPromo) {
          discountAmount = Math.round(subtotal * (foundPromo.discountPercent / 100));
          appliedCode = foundPromo.code;
        }
      }

      const totalAmount = Math.max(0, subtotal + deliveryFee + setupFee - discountAmount);
      const depositRequired = Math.round(totalAmount * (db.settings.depositPercent / 100));

      const normalizedPhone = String(customerPhone).trim();
      let customer = db.customers.find(
        (c) =>
          c.phone.replace(/\s+/g, '') === normalizedPhone.replace(/\s+/g, '') ||
          (customerEmail && c.email.toLowerCase() === String(customerEmail).toLowerCase())
      );

      const nowIso = new Date().toISOString().slice(0, 10);
      if (!customer) {
        customer = {
          id: `cust-${Date.now()}`,
          name: customerName.trim(),
          phone: normalizedPhone,
          email: (customerEmail || '').trim(),
          municipality: municipality || 'Lemery (Proper / Poblacion)',
          address: `${barangay ? `Brgy. ${barangay}, ` : ''}${venueAddress || ''}, ${municipality || 'Batangas'}`,
          totalBookings: 1,
          totalSpent: totalAmount,
          lastEventDate: eventDate,
          createdAt: nowIso,
        };
        db.customers.unshift(customer);
      } else {
        customer.totalBookings += 1;
        customer.totalSpent += totalAmount;
        customer.lastEventDate = eventDate;
      }

      const referenceNumber = generateReferenceNumber(db.bookings);
      const bookingId = `bk-${Date.now()}`;
      const initialPayments = [];
      if (proofImageUrl || paymentReferenceNo) {
        initialPayments.push({
          id: `pay-${Date.now()}`,
          bookingId,
          amount: depositRequired,
          type: 'Deposit' as const,
          method: (paymentMethod || 'GCash') as 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer',
          referenceNo: paymentReferenceNo || 'Uploaded with booking',
          proofImageUrl: proofImageUrl || undefined,
          verifiedByAdmin: false,
          createdAt: nowIso,
        });
      }

      const newBooking: Booking = {
        id: bookingId,
        referenceNumber,
        customerId: customer.id,
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        customerEmail: (customerEmail || '').trim(),
        eventType: eventType || 'Birthday',
        eventDate,
        returnDate: effectiveReturnDate,
        rentalDays,
        eventTime: eventTime || '08:00 AM',
        municipality: municipality || 'Lemery (Proper / Poblacion)',
        barangay: barangay || '',
        venueAddress: venueAddress || '',
        fulfillmentType: fulfillmentType || 'Delivery',
        includeSetup: Boolean(includeSetup),
        status: 'Pending',
        paymentStatus: 'Unpaid',
        paymentMethod: paymentMethod || 'GCash',
        subtotal,
        deliveryFee,
        setupFee,
        discountAmount,
        discountCode: appliedCode,
        damageFeeTotal: 0,
        totalAmount,
        depositRequired,
        amountPaid: 0,
        balanceDue: totalAmount,
        notes: notes || '',
        adminNotes: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        items: bookingLines,
        payments: initialPayments,
        damageLogs: [],
      };

      db.bookings.unshift(newBooking);
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        type: 'NEW_BOOKING',
        title: `New Booking: ${referenceNumber} (${customerName})`,
        message: `${eventType} on ${eventDate} in ${municipality} — Total: ₱${totalAmount.toLocaleString()} (Deposit: ₱${depositRequired.toLocaleString()})`,
        referenceNumber,
        read: false,
        createdAt: new Date().toISOString(),
      });

      await writeClientDb(db);
      return makeJsonResponse({
        success: true,
        booking: newBooking,
        notificationSimulated: {
          ownerEmail: db.settings.email,
          ownerPhone: db.settings.phone,
          customerSms: `MMC Set n Seat Rentals: Thank you ${customerName}! Your booking ${referenceNumber} for ${eventDate} is received. Required deposit (${db.settings.depositPercent}%): PHP ${depositRequired.toLocaleString()}. Questions? Call/Text ${db.settings.phone}.`,
        },
      });
    }

    if (method === 'PATCH') {
      const { bookingId, action } = body;
      const booking = db.bookings.find((b) => b.id === bookingId);
      if (!booking) return makeJsonResponse({ error: 'Booking not found' }, 404);
      const nowIso = new Date().toISOString().slice(0, 10);

      if (action === 'update_status') {
        booking.status = body.status as BookingStatus;
        if (body.adminNotes !== undefined) booking.adminNotes = body.adminNotes;
        booking.updatedAt = nowIso;
      } else if (action === 'update_payment_status') {
        const newPayStatus = body.paymentStatus as PaymentStatus;
        booking.paymentStatus = newPayStatus;
        if (newPayStatus === 'Fully Paid') {
          booking.amountPaid = booking.totalAmount;
          booking.balanceDue = 0;
        } else if (newPayStatus === 'Deposit Paid' && booking.amountPaid === 0) {
          booking.amountPaid = booking.depositRequired;
          booking.balanceDue = Math.max(0, booking.totalAmount - booking.depositRequired);
          if (booking.status === 'Pending') booking.status = 'Confirmed';
        }
        booking.updatedAt = nowIso;
      } else if (action === 'reschedule') {
        const { newEventDate, newReturnDate, newEventTime } = body;
        const effReturn = newReturnDate && newReturnDate >= newEventDate ? newReturnDate : newEventDate;
        const avail = computeAvailability(db, newEventDate, effReturn, booking.id);
        for (const line of booking.items) {
          const itemAvail = avail[line.itemId];
          if (itemAvail && line.quantity > itemAvail.remainingStock) {
            return makeJsonResponse(
              {
                error: `Cannot reschedule: "${line.itemName}" only has ${itemAvail.remainingStock} available on ${newEventDate}.`,
              },
              409
            );
          }
        }
        const newDays = calculateRentalDays(newEventDate, effReturn);
        booking.eventDate = newEventDate;
        booking.returnDate = effReturn;
        if (newEventTime) booking.eventTime = newEventTime;
        booking.rentalDays = newDays;
        let newSubtotal = 0;
        for (const line of booking.items) {
          line.lineTotal = line.pricePerDay * line.quantity * newDays;
          newSubtotal += line.lineTotal;
        }
        booking.subtotal = newSubtotal;
        booking.totalAmount = Math.max(
          0,
          newSubtotal + booking.deliveryFee + booking.setupFee + booking.damageFeeTotal - booking.discountAmount
        );
        booking.depositRequired = Math.round(booking.totalAmount * (db.settings.depositPercent / 100));
        booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
        booking.updatedAt = nowIso;
      } else if (action === 'add_payment') {
        const amount = Number(body.amount) || 0;
        const payLog = {
          id: `pay-${Date.now()}`,
          bookingId: booking.id,
          amount,
          type: body.type || 'Deposit',
          method: body.method || 'GCash',
          referenceNo: body.referenceNo || '',
          proofImageUrl: body.proofImageUrl || undefined,
          verifiedByAdmin: body.verifiedByAdmin !== undefined ? Boolean(body.verifiedByAdmin) : true,
          createdAt: nowIso,
        };
        booking.payments.push(payLog);
        if (payLog.verifiedByAdmin) {
          booking.amountPaid += amount;
          booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
          if (booking.balanceDue === 0) booking.paymentStatus = 'Fully Paid';
          else if (booking.amountPaid >= booking.depositRequired) booking.paymentStatus = 'Deposit Paid';
          if (booking.status === 'Pending' && booking.amountPaid >= booking.depositRequired) {
            booking.status = 'Confirmed';
          }
        }
        booking.updatedAt = nowIso;
      } else if (action === 'verify_payment') {
        const p = booking.payments.find((x) => x.id === body.paymentId);
        if (p && !p.verifiedByAdmin) {
          p.verifiedByAdmin = true;
          booking.amountPaid += p.amount;
          booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
          if (booking.balanceDue === 0) booking.paymentStatus = 'Fully Paid';
          else if (booking.amountPaid >= booking.depositRequired) booking.paymentStatus = 'Deposit Paid';
          if (booking.status === 'Pending' && booking.amountPaid >= booking.depositRequired) {
            booking.status = 'Confirmed';
          }
        }
        booking.updatedAt = nowIso;
      } else if (action === 'add_damage') {
        const fee = Number(body.feeCharged) || 0;
        const qty = Number(body.quantity) || 1;
        const dmg = {
          id: `dmg-${Date.now()}`,
          bookingId: booking.id,
          referenceNumber: booking.referenceNumber,
          customerName: booking.customerName,
          itemName: body.itemName || 'Rental Item',
          issueType: body.issueType || 'Damaged',
          quantity: qty,
          feeCharged: fee,
          resolved: Boolean(body.resolved),
          notes: body.notes || '',
          createdAt: nowIso,
        };
        booking.damageLogs.push(dmg);
        db.damageLogs.unshift(dmg);
        booking.damageFeeTotal += fee;
        booking.totalAmount += fee;
        if (!dmg.resolved) {
          booking.balanceDue += fee;
          if (booking.paymentStatus === 'Fully Paid' && fee > 0) booking.paymentStatus = 'Deposit Paid';
        } else {
          booking.amountPaid += fee;
        }
        booking.updatedAt = nowIso;
      } else if (action === 'toggle_damage_resolved') {
        const dmgInBooking = booking.damageLogs.find((d) => d.id === body.damageId);
        const dmgInGlobal = db.damageLogs.find((d) => d.id === body.damageId);
        if (dmgInBooking) {
          dmgInBooking.resolved = !dmgInBooking.resolved;
          if (dmgInBooking.resolved) {
            booking.amountPaid += dmgInBooking.feeCharged;
            booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
            if (booking.balanceDue === 0) booking.paymentStatus = 'Fully Paid';
          }
        }
        if (dmgInGlobal) dmgInGlobal.resolved = !dmgInGlobal.resolved;
        booking.updatedAt = nowIso;
      }

      await writeClientDb(db);
      return makeJsonResponse({ success: true, booking, damageLogs: db.damageLogs });
    }
  }

  // 5. /api/inventory
  if (pathname.endsWith('/api/inventory')) {
    const db = await readClientDb();
    if (method === 'POST') {
      const newItem: InventoryItem = {
        id: `item-${Date.now()}`,
        sku: body.sku || `MMC-${Math.floor(100 + Math.random() * 900)}`,
        name: body.name || 'New Rental Item',
        category: body.category || 'Chairs',
        description: body.description || '',
        pricePerDay: Number(body.pricePerDay) || 0,
        totalStock: Number(body.totalStock) || 0,
        imageUrl:
          body.imageUrl ||
          'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=900&q=80',
        featured: Boolean(body.featured),
        active: body.active !== undefined ? Boolean(body.active) : true,
        guestCapacity: body.guestCapacity ? Number(body.guestCapacity) : undefined,
        includedItems: Array.isArray(body.includedItems) ? body.includedItems : undefined,
        replacementFee: Number(body.replacementFee) || 500,
        unitLabel: body.unitLabel || 'per unit / day',
      };
      db.inventory.push(newItem);
      await writeClientDb(db);
      return makeJsonResponse({ success: true, item: newItem, inventory: db.inventory });
    }

    if (method === 'PUT') {
      const idx = db.inventory.findIndex((i) => i.id === body.id);
      if (idx === -1) return makeJsonResponse({ error: 'Item not found' }, 404);
      const existing = db.inventory[idx];
      db.inventory[idx] = {
        ...existing,
        ...body,
        pricePerDay: body.pricePerDay !== undefined ? Number(body.pricePerDay) : existing.pricePerDay,
        totalStock: body.totalStock !== undefined ? Number(body.totalStock) : existing.totalStock,
      };
      await writeClientDb(db);
      return makeJsonResponse({ success: true, item: db.inventory[idx], inventory: db.inventory });
    }

    if (method === 'DELETE') {
      const id = searchParams.get('id');
      db.inventory = db.inventory.filter((i) => i.id !== id);
      await writeClientDb(db);
      return makeJsonResponse({ success: true, inventory: db.inventory });
    }
  }

  // 6. /api/settings
  if (pathname.endsWith('/api/settings') && method === 'PUT') {
    if (body.action === 'save_firebase_config') {
      const { apiKey, projectId, authDomain, appId } = body.firebaseConfig || {};
      if (!apiKey || !projectId) {
        return makeJsonResponse({ error: 'Firebase API Key and Project ID are required.' }, 400);
      }
      saveClientFirebaseConfig({
        apiKey: String(apiKey).trim(),
        projectId: String(projectId).trim(),
        authDomain: authDomain ? String(authDomain).trim() : `${String(projectId).trim()}.firebaseapp.com`,
        appId: appId ? String(appId).trim() : '',
      });
      const currentData = await readClientDb();
      const { syncedToFirebase } = await writeClientDb(currentData);
      return makeJsonResponse({
        success: true,
        syncedToFirebase,
        projectId: String(projectId).trim(),
      });
    }

    if (body.action === 'reset_seed') {
      const fresh = getInitialSeedData();
      await writeClientDb(fresh);
      return makeJsonResponse({ success: true, state: fresh });
    }

    const db = await readClientDb();
    db.settings = {
      ...db.settings,
      ...body.settings,
      adminPassword:
        body.settings?.adminPassword && body.settings.adminPassword !== '***'
          ? body.settings.adminPassword
          : db.settings.adminPassword,
    };
    const { syncedToFirebase } = await writeClientDb(db);
    return makeJsonResponse({
      success: true,
      syncedToFirebase,
      settings: { ...db.settings, adminPassword: '***' },
    });
  }

  return makeJsonResponse({ error: 'Endpoint not found' }, 404);
}

