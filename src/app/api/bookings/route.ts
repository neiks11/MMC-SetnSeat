import { NextRequest, NextResponse } from 'next/server';
import {
  readDb,
  writeDb,
  getAvailabilityForDateRange,
  calculateRentalDays,
  generateReferenceNumber,
} from '@/lib/db';
import { Booking, BookingItemLine, BookingStatus, PaymentStatus } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Basic spam protection (honeypot field)
    if (body.websiteHoneypot && String(body.websiteHoneypot).trim() !== '') {
      return NextResponse.json(
        { error: 'Spam detected.' },
        { status: 400 }
      );
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
      items, // [{ itemId, quantity }]
      proofImageUrl,
      paymentReferenceNo,
    } = body;

    if (!customerName || !customerPhone || !eventDate || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Please complete all required customer details, event date, and select at least one rental item.' },
        { status: 400 }
      );
    }

    const effectiveReturnDate = returnDate && returnDate >= eventDate ? returnDate : eventDate;
    const rentalDays = calculateRentalDays(eventDate, effectiveReturnDate);

    const db = await readDb();
    const availability = await getAvailabilityForDateRange(eventDate, effectiveReturnDate, undefined, db);

    // 2. Server-side stock check (prevents double-booking)
    const bookingLines: BookingItemLine[] = [];
    let subtotal = 0;

    for (const reqItem of items) {
      const qty = Number(reqItem.quantity);
      if (!qty || qty <= 0) continue;

      const invItem = db.inventory.find((i) => i.id === reqItem.itemId);
      if (!invItem || !invItem.active) {
        return NextResponse.json(
          { error: `Item "${reqItem.itemId}" is no longer available.` },
          { status: 400 }
        );
      }

      const avail = availability[invItem.id];
      if (!avail || qty > avail.remainingStock) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${invItem.name}" on ${eventDate}. Only ${avail ? avail.remainingStock : 0} left for those dates.`,
          },
          { status: 409 }
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

    if (bookingLines.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one valid item with quantity > 0.' },
        { status: 400 }
      );
    }

    // 3. Compute delivery fee, setup fee, discount, total, and required deposit
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

    // 4. Find or create customer
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

    // 5. Add owner notification alert
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      type: 'NEW_BOOKING',
      title: `New Booking: ${referenceNumber} (${customerName})`,
      message: `${eventType} on ${eventDate} in ${municipality} — Total: ₱${totalAmount.toLocaleString()} (Deposit: ₱${depositRequired.toLocaleString()})`,
      referenceNumber,
      read: false,
      createdAt: new Date().toISOString(),
    });

    await writeDb(db);

    return NextResponse.json({
      success: true,
      booking: newBooking,
      notificationSimulated: {
        ownerEmail: db.settings.email,
        ownerPhone: db.settings.phone,
        customerSms: `MMC Set n Seat Rentals: Thank you ${customerName}! Your booking ${referenceNumber} for ${eventDate} is received. Required deposit (${db.settings.depositPercent}%): PHP ${depositRequired.toLocaleString()}. Questions? Call/Text ${db.settings.phone}.`,
      },
    });
  } catch (err: any) {
    console.error('Error creating booking:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create booking.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, action } = body;

    const db = await readDb();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString().slice(0, 10);

    if (action === 'update_status') {
      const newStatus = body.status as BookingStatus;
      booking.status = newStatus;
      if (body.adminNotes !== undefined) {
        booking.adminNotes = body.adminNotes;
      }
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
        if (booking.status === 'Pending') {
          booking.status = 'Confirmed';
        }
      }
      booking.updatedAt = nowIso;
    } else if (action === 'reschedule') {
      const { newEventDate, newReturnDate, newEventTime } = body;
      if (!newEventDate) {
        return NextResponse.json({ error: 'New event date is required.' }, { status: 400 });
      }
      const effReturn = newReturnDate && newReturnDate >= newEventDate ? newReturnDate : newEventDate;
      // Verify stock availability excluding this booking itself
      const avail = await getAvailabilityForDateRange(newEventDate, effReturn, booking.id, db);
      for (const line of booking.items) {
        const itemAvail = avail[line.itemId];
        if (itemAvail && line.quantity > itemAvail.remainingStock) {
          return NextResponse.json(
            {
              error: `Cannot reschedule: "${line.itemName}" only has ${itemAvail.remainingStock} available on ${newEventDate}.`,
            },
            { status: 409 }
          );
        }
      }

      const newDays = calculateRentalDays(newEventDate, effReturn);
      booking.eventDate = newEventDate;
      booking.returnDate = effReturn;
      if (newEventTime) booking.eventTime = newEventTime;
      booking.rentalDays = newDays;

      // Recompute subtotal & total for updated rental days
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
      if (amount <= 0) {
        return NextResponse.json({ error: 'Payment amount must be greater than 0.' }, { status: 400 });
      }
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
        if (booking.balanceDue === 0) {
          booking.paymentStatus = 'Fully Paid';
        } else if (booking.amountPaid >= booking.depositRequired) {
          booking.paymentStatus = 'Deposit Paid';
        }
        if (booking.status === 'Pending' && booking.amountPaid >= booking.depositRequired) {
          booking.status = 'Confirmed';
        }
      } else {
        db.notifications.unshift({
          id: `notif-${Date.now()}`,
          type: 'PAYMENT_UPLOADED',
          title: `Payment Proof Uploaded: ${booking.referenceNumber}`,
          message: `${booking.customerName} submitted ₱${amount.toLocaleString()} via ${payLog.method} (Ref: ${payLog.referenceNo || 'N/A'}).`,
          referenceNumber: booking.referenceNumber,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
      booking.updatedAt = nowIso;
    } else if (action === 'verify_payment') {
      const { paymentId } = body;
      const p = booking.payments.find((x) => x.id === paymentId);
      if (p && !p.verifiedByAdmin) {
        p.verifiedByAdmin = true;
        booking.amountPaid += p.amount;
        booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
        if (booking.balanceDue === 0) {
          booking.paymentStatus = 'Fully Paid';
        } else if (booking.amountPaid >= booking.depositRequired) {
          booking.paymentStatus = 'Deposit Paid';
        }
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
        if (booking.paymentStatus === 'Fully Paid' && fee > 0) {
          booking.paymentStatus = 'Deposit Paid';
        }
      } else {
        booking.amountPaid += fee;
      }
      booking.updatedAt = nowIso;
    } else if (action === 'toggle_damage_resolved') {
      const { damageId } = body;
      const dmgInBooking = booking.damageLogs.find((d) => d.id === damageId);
      const dmgInGlobal = db.damageLogs.find((d) => d.id === damageId);
      if (dmgInBooking) {
        dmgInBooking.resolved = !dmgInBooking.resolved;
        if (dmgInBooking.resolved) {
          booking.amountPaid += dmgInBooking.feeCharged;
          booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
          if (booking.balanceDue === 0) booking.paymentStatus = 'Fully Paid';
        }
      }
      if (dmgInGlobal) {
        dmgInGlobal.resolved = !dmgInGlobal.resolved;
      }
      booking.updatedAt = nowIso;
    }

    await writeDb(db);
    return NextResponse.json({ success: true, booking, damageLogs: db.damageLogs });
  } catch (err: any) {
    console.error('Error updating booking:', err);
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 });
  }
}
