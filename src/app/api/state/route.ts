import { NextRequest, NextResponse } from 'next/server';
import { readDb, getAvailabilityForDateRange } from '@/lib/db';
import { getActiveFirebaseConfig } from '@/lib/firebase';
import {
  enforceRateLimit,
  maskBookingForPublicLookup,
  sanitizeText,
  verifyAdminRequest,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = sanitizeText(
    searchParams.get('startDate') || new Date().toISOString().slice(0, 10),
    10
  );
  const endDate = sanitizeText(searchParams.get('endDate') || startDate, 10);
  const ref = searchParams.get('ref');

  const adminSession = verifyAdminRequest(req);
  const db = await readDb();

  // Public booking lookup by reference number (rate-limited + PII masked)
  if (ref) {
    const rateLimited = enforceRateLimit(req, 'booking_lookup', 15, 5 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const cleanRef = sanitizeText(ref, 32).toLowerCase();
    const found = db.bookings.find(
      (b) => b.referenceNumber.toLowerCase() === cleanRef
    );
    return NextResponse.json({
      booking: found
        ? adminSession
          ? found
          : maskBookingForPublicLookup(found)
        : null,
      settings: {
        ...db.settings,
        adminUsername: '***',
        adminPassword: '***',
      },
    });
  }

  const availability = await getAvailabilityForDateRange(startDate, endDate, undefined, db);
  const fbConfig = getActiveFirebaseConfig();

  // Authenticated Admin response: includes full operational dataset
  if (adminSession) {
    return NextResponse.json({
      firebaseStatus: {
        connected: Boolean(fbConfig?.projectId && fbConfig?.apiKey),
        projectId: fbConfig?.projectId || null,
        authDomain: fbConfig?.authDomain || null,
      },
      settings: {
        ...db.settings,
        adminPassword: '***',
      },
      inventory: db.inventory,
      availability,
      bookings: db.bookings,
      customers: db.customers,
      damageLogs: db.damageLogs,
      notifications: db.notifications,
      gallery: db.gallery,
      reviews: db.reviews,
      auditLogs: db.auditLogs || [],
    });
  }

  // Unauthenticated Public Customer response: NEVER expose bookings, customers, damageLogs, or notifications
  const approvedReviews = (db.reviews || []).filter(
    (r) => !r.status || r.status === 'approved'
  );

  return NextResponse.json({
    firebaseStatus: {
      connected: Boolean(fbConfig?.projectId && fbConfig?.apiKey),
      projectId: null,
      authDomain: null,
    },
    settings: {
      ...db.settings,
      adminUsername: '***',
      adminPassword: '***',
    },
    inventory: db.inventory,
    availability,
    bookings: [],
    customers: [],
    damageLogs: [],
    notifications: [],
    gallery: db.gallery,
    reviews: approvedReviews,
  });
}
