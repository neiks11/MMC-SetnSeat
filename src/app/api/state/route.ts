import { NextRequest, NextResponse } from 'next/server';
import { readDb, getAvailabilityForDateRange } from '@/lib/db';
import { getActiveFirebaseConfig } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || new Date().toISOString().slice(0, 10);
  const endDate = searchParams.get('endDate') || startDate;
  const ref = searchParams.get('ref');

  const db = await readDb();
  const availability = await getAvailabilityForDateRange(startDate, endDate, undefined, db);
  const fbConfig = getActiveFirebaseConfig();

  if (ref) {
    const found = db.bookings.find(
      (b) => b.referenceNumber.toLowerCase() === ref.toLowerCase().trim()
    );
    return NextResponse.json({
      booking: found || null,
      settings: {
        ...db.settings,
        adminPassword: '***',
      },
    });
  }

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
  });
}
