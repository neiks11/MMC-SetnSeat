import { NextRequest, NextResponse } from 'next/server';
import { getAvailabilityForDateRange, readDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || new Date().toISOString().slice(0, 10);
  const endDate = searchParams.get('endDate') || startDate;
  const month = searchParams.get('month'); // Optional YYYY-MM for calendar view

  const db = await readDb();
  const availability = await getAvailabilityForDateRange(startDate, endDate, undefined, db);

  if (month) {
    // Compute daily booking counts and stock utilization for the requested month
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, m, 0).getDate();

    const calendarDays: Record<
      string,
      {
        date: string;
        bookingsCount: number;
        bookings: {
          id: string;
          referenceNumber: string;
          customerName: string;
          eventType: string;
          status: string;
          municipality: string;
          totalAmount: number;
        }[];
        chairsBooked: number;
        tablesBooked: number;
      }
    > = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
      const dayAvail = await getAvailabilityForDateRange(dateStr, dateStr, undefined, db);
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

    return NextResponse.json({ availability, calendarDays });
  }

  return NextResponse.json({ availability, startDate, endDate });
}
