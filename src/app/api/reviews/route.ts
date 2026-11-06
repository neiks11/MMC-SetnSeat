import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import {
  appendAuditLog,
  enforceRateLimit,
  evaluateReviewSubmission,
  getClientIp,
  sanitizeText,
  verifyAdminRequest,
} from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(req, 'reviews_submit', 5, 15 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const db = await readDb();

    const result = evaluateReviewSubmission(body, db.bookings, db.reviews || []);
    if (!result.valid || !result.review) {
      return NextResponse.json(
        { error: result.error || 'Review validation failed.' },
        { status: 400 }
      );
    }

    db.reviews.unshift(result.review);
    appendAuditLog(db, {
      actor: result.review.customerName,
      role: 'customer',
      action: result.heldForModeration ? 'REVIEW_HELD_FOR_MODERATION' : 'REVIEW_PUBLISHED',
      targetId: result.review.id,
      ip: getClientIp(req),
      details: `Booking ${result.review.bookingReference}: ${result.review.rating}/5 stars (Flags: ${
        (result.review.flags || []).join(', ') || 'none'
      })`,
    });

    await writeDb(db);

    return NextResponse.json({
      success: true,
      review: result.review,
      heldForModeration: result.heldForModeration,
      reviews: db.reviews.filter((r) => !r.status || r.status === 'approved'),
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to submit review at this time.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(req, 'reviews_patch', 20, 10 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const { reviewId, action } = body;
    const db = await readDb();
    const target = db.reviews.find((r) => r.id === reviewId);
    if (!target) {
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }

    // Public action: customers can report a review that violates guidelines
    if (action === 'report') {
      target.reportCount = (target.reportCount || 0) + 1;
      if (target.reportCount >= 3 && (!target.status || target.status === 'approved')) {
        target.status = 'pending';
        target.flags = Array.from(new Set([...(target.flags || []), 'USER_REPORTED']));
      }
      appendAuditLog(db, {
        actor: 'public_reporter',
        role: 'customer',
        action: 'REVIEW_REPORTED',
        targetId: target.id,
        ip: getClientIp(req),
        details: `Review ${target.id} reported (count: ${target.reportCount})`,
      });
      await writeDb(db);
      return NextResponse.json({
        success: true,
        review: target,
      });
    }

    // Admin-only actions: moderate (approve/reject with reason) or post official owner response
    const adminSession = verifyAdminRequest(req);
    if (!adminSession) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    if (action === 'moderate') {
      const newStatus = body.status === 'rejected' ? 'rejected' : 'approved';
      const reason = sanitizeText(body.reason, 200);
      if (newStatus === 'rejected' && !reason) {
        return NextResponse.json(
          { error: 'A written guideline violation reason is required when rejecting a review.' },
          { status: 400 }
        );
      }
      target.status = newStatus;
      target.moderationReason = reason;
      appendAuditLog(db, {
        actor: adminSession.sub,
        role: 'admin',
        action: `REVIEW_MODERATED_${newStatus.toUpperCase()}`,
        targetId: target.id,
        ip: getClientIp(req),
        details: `Moderated review ${target.id} -> ${newStatus} (Reason: ${reason || 'Meets guidelines'})`,
      });
    } else if (action === 'owner_reply') {
      target.ownerResponse = sanitizeText(body.ownerResponse, 500);
      target.ownerResponseDate = new Date().toISOString().slice(0, 10);
      appendAuditLog(db, {
        actor: adminSession.sub,
        role: 'admin',
        action: 'REVIEW_OWNER_RESPONSE',
        targetId: target.id,
        ip: getClientIp(req),
        details: `Posted owner response to review ${target.id}`,
      });
    }

    await writeDb(db);
    return NextResponse.json({
      success: true,
      review: target,
      reviews: db.reviews,
    });
  } catch {
    return NextResponse.json({ error: 'Review update failed.' }, { status: 500 });
  }
}
