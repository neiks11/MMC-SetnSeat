import { NextRequest, NextResponse } from 'next/server';
import {
  readDb,
  writeDb,
  getAvailabilityForDateRange,
  calculateRentalDays,
  generateReferenceNumber,
} from '@/lib/db';
import { Booking, BookingItemLine, BookingStatus, PaymentStatus } from '@/lib/types';
import {
  appendAuditLog,
  enforceRateLimit,
  getClientIp,
  isValidIsoDate,
  isValidSafeImageUrl,
  sanitizeText,
  validateBookingPayload,
  verifyAdminRequest,
} from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(req, 'bookings_create', 10, 15 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const body = await req.json();

    // 1. Honeypot check
    if (body.websiteHoneypot && String(body.websiteHoneypot).trim() !== '') {
      return NextResponse.json({ error: 'Spam detected.' }, { status: 400 });
    }

    // 2. Strict allow-list input validation
    const validation = validateBookingPayload(body);
    if (!validation.valid || !validation.sanitized) {
      return NextResponse.json(
        { error: validation.error || 'Invalid booking details.' },
        { status: 400 }
      );
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      eventType,
      eventDate,
      returnDate: effectiveReturnDate,
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
      consentTimestamp,
    } = validation.sanitized;

    const rentalDays = calculateRentalDays(eventDate, effectiveReturnDate);
    const db = await readDb();
    const availability = await getAvailabilityForDateRange(
      eventDate,
      effectiveReturnDate,
      undefined,
      db
    );

    // 3. Server-side stock check & server-authoritative pricing (never trust client price)
    const bookingLines: BookingItemLine[] = [];
    let subtotal = 0;

    for (const reqItem of items) {
      const qty = reqItem.quantity;
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
            error: `Insufficient stock for "${invItem.name}" on ${eventDate}. Only ${
              avail ? avail.remainingStock : 0
            } left for those dates.`,
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

    // 4. Server-authoritative fees & discounts
    let deliveryFee = 0;
    if (fulfillmentType === 'Delivery') {
      if (
        subtotal >= db.settings.freeDeliveryMinOrder &&
        db.settings.freeDeliveryMinOrder > 0
      ) {
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
        (p) => p.active && p.code.toUpperCase() === discountCode.toUpperCase()
      );
      if (foundPromo) {
        discountAmount = Math.round(subtotal * (foundPromo.discountPercent / 100));
        appliedCode = foundPromo.code;
      }
    }

    const totalAmount = Math.max(0, subtotal + deliveryFee + setupFee - discountAmount);
    const depositRequired = Math.round(totalAmount * (db.settings.depositPercent / 100));

    // 5. Find or create customer record
    const normalizedPhone = customerPhone.trim();
    let customer = db.customers.find(
      (c) =>
        c.phone.replace(/\s+/g, '') === normalizedPhone.replace(/\s+/g, '') ||
        (customerEmail && c.email.toLowerCase() === customerEmail.toLowerCase())
    );

    const nowIso = new Date().toISOString().slice(0, 10);
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        name: customerName,
        phone: normalizedPhone,
        email: customerEmail,
        municipality,
        address: `${barangay ? `Brgy. ${barangay}, ` : ''}${venueAddress}, ${municipality}`,
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
        method: paymentMethod,
        referenceNo: paymentReferenceNo || 'Uploaded with booking',
        proofImageUrl,
        verifiedByAdmin: false,
        createdAt: nowIso,
      });
    }

    const newBooking: Booking = {
      id: bookingId,
      referenceNumber,
      customerId: customer.id,
      customerName,
      customerPhone: normalizedPhone,
      customerEmail,
      eventType,
      eventDate,
      returnDate: effectiveReturnDate,
      rentalDays,
      eventTime,
      municipality,
      barangay,
      venueAddress,
      fulfillmentType,
      includeSetup,
      status: 'Pending',
      paymentStatus: 'Unpaid',
      paymentMethod,
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
      notes,
      adminNotes: '',
      consentTimestamp,
      privacyPolicyVersion: '2026-11-RA10173',
      termsVersion: '2026-11',
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

    appendAuditLog(db, {
      actor: customerName,
      role: 'customer',
      action: 'BOOKING_CREATED',
      targetId: referenceNumber,
      ip: getClientIp(req),
      details: `Created booking ${referenceNumber} for ${eventDate} (Total: ₱${totalAmount.toLocaleString()}, Consent: ${consentTimestamp})`,
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
  } catch {
    return NextResponse.json(
      { error: 'Unable to process booking request. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(req, 'bookings_patch', 30, 5 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const { bookingId, action } = body;
    const adminSession = verifyAdminRequest(req);

    // Only allow unauthenticated callers to submit an unverified customer payment proof
    const isCustomerPaymentUpload =
      action === 'add_payment' && body.verifiedByAdmin === false;

    if (!adminSession && !isCustomerPaymentUpload) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    const db = await readDb();
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString().slice(0, 10);

    if (action === 'update_status') {
      const allowedStatuses: BookingStatus[] = [
        'Pending',
        'Confirmed',
        'Out for Delivery',
        'In Use',
        'Returned',
        'Completed',
        'Cancelled',
      ];
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid booking status.' }, { status: 400 });
      }
      booking.status = body.status as BookingStatus;
      if (body.adminNotes !== undefined) {
        booking.adminNotes = sanitizeText(body.adminNotes, 500);
      }
      booking.updatedAt = nowIso;
    } else if (action === 'update_payment_status') {
      const allowedPayStatuses: PaymentStatus[] = [
        'Unpaid',
        'Deposit Paid',
        'Fully Paid',
        'Refunded',
      ];
      if (!allowedPayStatuses.includes(body.paymentStatus)) {
        return NextResponse.json({ error: 'Invalid payment status.' }, { status: 400 });
      }
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
      const newEventDate = sanitizeText(body.newEventDate, 10);
      const newReturnDate = sanitizeText(body.newReturnDate || newEventDate, 10);
      const newEventTime = sanitizeText(body.newEventTime, 20);
      if (!isValidIsoDate(newEventDate) || !isValidIsoDate(newReturnDate)) {
        return NextResponse.json({ error: 'Valid event date is required.' }, { status: 400 });
      }
      const effReturn = newReturnDate >= newEventDate ? newReturnDate : newEventDate;
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

      let newSubtotal = 0;
      for (const line of booking.items) {
        line.lineTotal = line.pricePerDay * line.quantity * newDays;
        newSubtotal += line.lineTotal;
      }
      booking.subtotal = newSubtotal;
      booking.totalAmount = Math.max(
        0,
        newSubtotal +
          booking.deliveryFee +
          booking.setupFee +
          booking.damageFeeTotal -
          booking.discountAmount
      );
      booking.depositRequired = Math.round(
        booking.totalAmount * (db.settings.depositPercent / 100)
      );
      booking.balanceDue = Math.max(0, booking.totalAmount - booking.amountPaid);
      booking.updatedAt = nowIso;
    } else if (action === 'add_payment') {
      const amount = Number(body.amount) || 0;
      if (amount <= 0 || amount > 1_000_000) {
        return NextResponse.json(
          { error: 'Payment amount must be between ₱1 and ₱1,000,000.' },
          { status: 400 }
        );
      }
      if (!isValidSafeImageUrl(body.proofImageUrl)) {
        return NextResponse.json(
          { error: 'Invalid payment proof image or file exceeds 1.5 MB.' },
          { status: 400 }
        );
      }

      // Only authenticated admins can mark verifiedByAdmin = true
      const verifiedByAdmin = adminSession
        ? body.verifiedByAdmin !== undefined
          ? Boolean(body.verifiedByAdmin)
          : true
        : false;

      const payLog = {
        id: `pay-${Date.now()}`,
        bookingId: booking.id,
        amount,
        type: body.type || 'Deposit',
        method: body.method || 'GCash',
        referenceNo: sanitizeText(body.referenceNo, 60),
        proofImageUrl: body.proofImageUrl || undefined,
        verifiedByAdmin,
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
          message: `${booking.customerName} submitted ₱${amount.toLocaleString()} via ${
            payLog.method
          } (Ref: ${payLog.referenceNo || 'N/A'}).`,
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
      const fee = Math.max(0, Number(body.feeCharged) || 0);
      const qty = Math.max(1, Math.floor(Number(body.quantity) || 1));
      const dmg = {
        id: `dmg-${Date.now()}`,
        bookingId: booking.id,
        referenceNumber: booking.referenceNumber,
        customerName: booking.customerName,
        itemName: sanitizeText(body.itemName || 'Rental Item', 100),
        issueType: body.issueType || 'Damaged',
        quantity: qty,
        feeCharged: fee,
        resolved: Boolean(body.resolved),
        notes: sanitizeText(body.notes, 300),
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

    appendAuditLog(db, {
      actor: adminSession ? adminSession.sub : booking.customerName,
      role: adminSession ? 'admin' : 'customer',
      action: `BOOKING_${String(action).toUpperCase()}`,
      targetId: booking.referenceNumber,
      ip: getClientIp(req),
      details: `Booking ${booking.referenceNumber} updated via action "${action}"`,
    });

    await writeDb(db);
    return NextResponse.json({ success: true, booking, damageLogs: db.damageLogs });
  } catch {
    return NextResponse.json({ error: 'Booking update failed.' }, { status: 500 });
  }
}
