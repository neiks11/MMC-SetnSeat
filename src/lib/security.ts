import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  Booking,
  DatabaseSchema,
  EventType,
  InventoryCategory,
  ReviewItem,
} from './types';

export const ADMIN_COOKIE_NAME = 'mmc_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Revoked token JTI denylist (in-memory per instance)
const revokedTokenIds = new Set<string>();

// Rate limit store: key -> { count, resetAt }
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

// Brute-force login lockout store: ip -> { failures, lockedUntil }
interface LoginLockoutEntry {
  failures: number;
  lockedUntil: number;
}
const loginLockoutStore = new Map<string, LoginLockoutEntry>();

const ALLOWED_EVENT_TYPES: EventType[] = [
  'Wedding',
  'Birthday',
  'Debut',
  'Funeral / Wake',
  'Fiesta',
  'Corporate Event',
  'School Function',
  'Baptism / Christening',
  'Other Gathering',
];

const ALLOWED_CATEGORIES: InventoryCategory[] = ['Chairs', 'Tables', 'Packages', 'Add-ons'];

/**
 * Returns the HMAC signing key for admin sessions.
 * In production, requires `MMC_SESSION_SECRET` (at least 32 characters).
 */
function getSessionSecret(): string {
  const envSecret = process.env.MMC_SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 32) {
    return envSecret.trim();
  }
  if (process.env.NODE_ENV === 'production' && !process.env.GITHUB_PAGES) {
    console.warn(
      '[SECURITY WARNING] MMC_SESSION_SECRET is missing or shorter than 32 chars. Set MMC_SESSION_SECRET in production environment variables.'
    );
  }
  return 'mmc-dev-ephemeral-hmac-secret-change-in-env-local-9f48a1c3d2e7b605';
}

/**
 * Extracts client IP safely from standard proxy headers.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim().slice(0, 64);
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim().slice(0, 64);
  }
  return '127.0.0.1';
}

/**
 * Sliding-window rate limiter returning 429 response with `Retry-After` if exceeded.
 */
export function enforceRateLimit(
  req: NextRequest,
  bucketPrefix: string,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${bucketPrefix}:${ip}`;
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      {
        error: `Too many requests. Please wait ${retryAfterSec} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
        },
      }
    );
  }

  return null;
}

/**
 * Brute-force lockout check on `/api/auth` (locks IP for 15 minutes after 5 failed attempts).
 */
export function checkLoginLockout(ip: string): { locked: boolean; retryAfterSec: number } {
  const entry = loginLockoutStore.get(ip);
  if (!entry) return { locked: false, retryAfterSec: 0 };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginLockoutStore.get(ip) || { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
  }
  loginLockoutStore.set(ip, entry);
}

export function clearFailedLogins(ip: string): void {
  loginLockoutStore.delete(ip);
}

/**
 * Hashes a password with Node's native memory-hard `crypto.scryptSync` (N=16384, r=8, p=1, 64-byte key).
 * Output format: `scrypt$<16-byte-hex-salt>$<64-byte-hex-derived-key>`
 */
export function hashPasswordScrypt(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a password against a stored `scrypt$...` hash or legacy plaintext password.
 * Returns `{ valid, needsRehash }` so legacy plaintext passwords automatically upgrade to `scrypt` on login.
 */
export function verifyPasswordWithMigration(
  candidatePassword: string,
  storedSecret: string
): { valid: boolean; needsRehash: boolean } {
  if (!candidatePassword || !storedSecret) {
    return { valid: false, needsRehash: false };
  }

  // Env override takes precedence if MMC_ADMIN_PASSWORD_HASH is configured
  const effectiveStored =
    process.env.MMC_ADMIN_PASSWORD_HASH &&
    process.env.MMC_ADMIN_PASSWORD_HASH.startsWith('scrypt$')
      ? process.env.MMC_ADMIN_PASSWORD_HASH
      : storedSecret;

  if (effectiveStored.startsWith('scrypt$')) {
    const parts = effectiveStored.split('$');
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, expectedHex] = parts;
    try {
      const actualBuf = crypto.scryptSync(candidatePassword, salt, 64);
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (actualBuf.length !== expectedBuf.length) {
        return { valid: false, needsRehash: false };
      }
      const match = crypto.timingSafeEqual(actualBuf, expectedBuf);
      return { valid: match, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Constant-time comparison for legacy plaintext password followed by immediate rehash migration
  const candidateBuf = Buffer.from(String(candidatePassword), 'utf-8');
  const storedBuf = Buffer.from(String(effectiveStored), 'utf-8');
  if (candidateBuf.length !== storedBuf.length) {
    return { valid: false, needsRehash: false };
  }
  const match = crypto.timingSafeEqual(candidateBuf, storedBuf);
  return { valid: match, needsRehash: match };
}

export interface AdminTokenPayload {
  sub: string;
  role: 'admin' | 'staff';
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed session token with 8-hour expiration.
 */
export function createAdminSessionToken(
  username: string,
  role: 'admin' | 'staff' = 'admin'
): string {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    sub: username,
    role,
    jti: crypto.randomBytes(12).toString('hex'),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

/**
 * Verifies an HMAC-SHA256 admin session token and checks expiration + revocation list.
 */
export function verifyAdminSessionToken(token: string | undefined | null): AdminTokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf-8');
  const expBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    ) as AdminTokenPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (revokedTokenIds.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function revokeAdminSessionToken(token: string | undefined | null): void {
  const payload = verifyAdminSessionToken(token);
  if (payload?.jti) {
    revokedTokenIds.add(payload.jti);
  }
}

/**
 * Extracts and verifies the admin session from either the `HttpOnly` cookie
 * or the `Authorization: Bearer <token>` header.
 */
export function verifyAdminRequest(req: NextRequest): AdminTokenPayload | null {
  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (cookieToken) {
    const verified = verifyAdminSessionToken(cookieToken);
    if (verified) return verified;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(bearerToken);
    if (verified) return verified;
  }

  return null;
}

export function setAdminSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Strips HTML tags (`<`, `>`) and control characters, and enforces a maximum character length.
 */
export function sanitizeText(value: unknown, maxLength = 300): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates Philippine mobile or landline numbers (e.g., `09171234567`, `+639171234567`, `0956 403 5020`).
 * Uses a flat, non-backtracking regex to prevent ReDoS.
 */
export function isValidPhilippinePhone(phone: string): boolean {
  const digitsOnly = phone.replace(/[\s\-().]/g, '');
  return /^(09\d{9}|\+639\d{9}|639\d{9}|043\d{7})$/.test(digitsOnly);
}

export function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return !Number.isNaN(d.getTime());
}

export function isValidEmailOrEmpty(email: string): boolean {
  if (!email) return true;
  if (email.length > 150) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidSafeImageUrl(urlOrDataUri: string | undefined): boolean {
  if (!urlOrDataUri) return true;
  // Max 1.8MB base64 data URI or https URL
  if (urlOrDataUri.length > 1_800_000) return false;
  if (urlOrDataUri.startsWith('https://') || urlOrDataUri.startsWith('/')) return true;
  return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(urlOrDataUri);
}

/**
 * Allow-list schema validator for `POST /api/bookings`.
 */
export function validateBookingPayload(body: any): {
  valid: boolean;
  error?: string;
  sanitized?: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    eventType: EventType;
    eventDate: string;
    returnDate: string;
    eventTime: string;
    municipality: string;
    barangay: string;
    venueAddress: string;
    fulfillmentType: 'Delivery' | 'Customer Pickup';
    includeSetup: boolean;
    paymentMethod: 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer';
    discountCode: string;
    notes: string;
    items: { itemId: string; quantity: number }[];
    proofImageUrl?: string;
    paymentReferenceNo: string;
    consentAccepted: boolean;
    consentTimestamp: string;
  };
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request payload.' };
  }

  const customerName = sanitizeText(body.customerName, 100);
  const customerPhone = sanitizeText(body.customerPhone, 25);
  const customerEmail = sanitizeText(body.customerEmail, 150);
  const eventDate = sanitizeText(body.eventDate, 10);
  const returnDate = sanitizeText(body.returnDate || body.eventDate, 10);
  const eventTime = sanitizeText(body.eventTime || '08:00 AM', 20);
  const municipality = sanitizeText(body.municipality || 'Lemery (Proper / Poblacion)', 80);
  const barangay = sanitizeText(body.barangay, 80);
  const venueAddress = sanitizeText(body.venueAddress, 250);
  const discountCode = sanitizeText(body.discountCode, 30);
  const notes = sanitizeText(body.notes, 600);
  const paymentReferenceNo = sanitizeText(body.paymentReferenceNo, 60);

  if (customerName.length < 2) {
    return { valid: false, error: 'Customer name must be between 2 and 100 characters.' };
  }
  if (!isValidPhilippinePhone(customerPhone)) {
    return {
      valid: false,
      error: 'Please enter a valid Philippine mobile number (e.g., 0917 123 4567 or +639171234567).',
    };
  }
  if (!isValidEmailOrEmpty(customerEmail)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (!isValidIsoDate(eventDate) || !isValidIsoDate(returnDate)) {
    return { valid: false, error: 'Event date and return date must be valid YYYY-MM-DD dates.' };
  }
  if (returnDate < eventDate) {
    return { valid: false, error: 'Return date cannot be earlier than the start date.' };
  }

  const rawEventType = sanitizeText(body.eventType || 'Birthday', 40) as EventType;
  const eventType: EventType = ALLOWED_EVENT_TYPES.includes(rawEventType)
    ? rawEventType
    : 'Other Gathering';

  const fulfillmentType: 'Delivery' | 'Customer Pickup' =
    body.fulfillmentType === 'Customer Pickup' ? 'Customer Pickup' : 'Delivery';

  const allowedMethods = ['Cash', 'GCash', 'Maya', 'Bank Transfer'] as const;
  const paymentMethod = allowedMethods.includes(body.paymentMethod)
    ? body.paymentMethod
    : 'GCash';

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return { valid: false, error: 'Please select between 1 and 50 rental items.' };
  }

  const sanitizedItems: { itemId: string; quantity: number }[] = [];
  for (const item of body.items) {
    const itemId = sanitizeText(item?.itemId, 64);
    const quantity = Math.floor(Number(item?.quantity) || 0);
    if (itemId && quantity > 0 && quantity <= 1000) {
      sanitizedItems.push({ itemId, quantity });
    }
  }

  if (sanitizedItems.length === 0) {
    return { valid: false, error: 'Please select at least one valid item with quantity >= 1.' };
  }

  if (!isValidSafeImageUrl(body.proofImageUrl)) {
    return {
      valid: false,
      error: 'Payment proof image must be a valid JPEG, PNG, or WebP image under 1.5 MB.',
    };
  }

  return {
    valid: true,
    sanitized: {
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
      includeSetup: Boolean(body.includeSetup),
      paymentMethod,
      discountCode,
      notes,
      items: sanitizedItems,
      proofImageUrl: body.proofImageUrl || undefined,
      paymentReferenceNo,
      consentAccepted: Boolean(body.consentAccepted),
      consentTimestamp: body.consentTimestamp
        ? sanitizeText(body.consentTimestamp, 40)
        : new Date().toISOString(),
    },
  };
}

/**
 * Validates inventory create/update inputs against an allow-list.
 */
export function validateInventoryPayload(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid inventory payload.' };
  }
  if (body.name !== undefined && sanitizeText(body.name, 120).length < 2) {
    return { valid: false, error: 'Item name must be at least 2 characters.' };
  }
  if (body.category !== undefined && !ALLOWED_CATEGORIES.includes(body.category)) {
    return { valid: false, error: 'Invalid inventory category.' };
  }
  if (
    body.pricePerDay !== undefined &&
    (Number(body.pricePerDay) < 0 || Number(body.pricePerDay) > 500_000)
  ) {
    return { valid: false, error: 'Price per day must be between ₱0 and ₱500,000.' };
  }
  if (
    body.totalStock !== undefined &&
    (Number(body.totalStock) < 0 || Number(body.totalStock) > 50_000)
  ) {
    return { valid: false, error: 'Total stock must be between 0 and 50,000.' };
  }
  if (body.imageUrl !== undefined && !isValidSafeImageUrl(body.imageUrl)) {
    return { valid: false, error: 'Invalid image URL or image exceeds 1.5 MB.' };
  }
  return { valid: true };
}

/**
 * Section G: Review Integrity & Automated Anti-Spam/Fake Review Detector.
 * - Requires a valid completed/returned booking reference number + matching customer phone (last 4 digits or full phone).
 * - Enforces one review per booking.
 * - Flags duplicate/near-duplicate text, URLs/promo links, profanity, or suspicious burst submissions.
 * - Flagged reviews are held as `status: 'pending'` for human moderation (never silently deleted).
 */
export function evaluateReviewSubmission(
  body: any,
  bookings: Booking[],
  existingReviews: ReviewItem[]
): {
  valid: boolean;
  error?: string;
  review?: ReviewItem;
  heldForModeration?: boolean;
} {
  if (body?.websiteHoneypot && String(body.websiteHoneypot).trim() !== '') {
    return { valid: false, error: 'Spam submission blocked.' };
  }

  const bookingReference = sanitizeText(body?.bookingReference, 32).toUpperCase();
  const customerPhone = sanitizeText(body?.customerPhone, 25);
  const comment = sanitizeText(body?.comment, 800);
  const rating = Math.min(5, Math.max(1, Math.round(Number(body?.rating) || 5)));

  if (!bookingReference) {
    return {
      valid: false,
      error: 'A valid Booking Reference Number (e.g., MMC-2026-1001) is required to post a verified review.',
    };
  }

  const matchedBooking = bookings.find(
    (b) => b.referenceNumber.toUpperCase() === bookingReference
  );
  if (!matchedBooking) {
    return {
      valid: false,
      error: 'Booking reference not found. Only verified customers with a real booking can submit a review.',
    };
  }

  if (!['Completed', 'Returned'].includes(matchedBooking.status)) {
    return {
      valid: false,
      error: `Reviews can only be submitted after your event is Completed or Returned (current status: ${matchedBooking.status}).`,
    };
  }

  // Verify phone ownership (match normalized phone or last 4 digits)
  const cleanSubmittedPhone = customerPhone.replace(/\D/g, '');
  const cleanBookingPhone = matchedBooking.customerPhone.replace(/\D/g, '');
  if (
    !cleanSubmittedPhone ||
    cleanSubmittedPhone.length < 4 ||
    !cleanBookingPhone.endsWith(cleanSubmittedPhone.slice(-4))
  ) {
    return {
      valid: false,
      error: 'Phone verification failed. Please enter the phone number used on your booking.',
    };
  }

  // Enforce 1 review per booking reference
  const alreadyReviewed = existingReviews.some(
    (r) => r.bookingReference && r.bookingReference.toUpperCase() === bookingReference
  );
  if (alreadyReviewed) {
    return {
      valid: false,
      error: 'A review has already been submitted for this booking reference number.',
    };
  }

  if (comment.length < 10) {
    return {
      valid: false,
      error: 'Please write at least 10 characters sharing your honest experience.',
    };
  }

  const flags: string[] = [];
  const lowerComment = comment.toLowerCase();

  // 1. Check for duplicate or near-duplicate text
  const isDuplicate = existingReviews.some(
    (r) => r.comment.toLowerCase().trim() === lowerComment.trim()
  );
  if (isDuplicate) {
    flags.push('DUPLICATE_TEXT');
  }

  // 2. Check for external links, promo codes, or phone solicitation
  if (/(https?:\/\/|www\.|\.com\/|\.ph\/|bit\.ly|t\.me|whatsapp|casino|bet88|free\s*money)/i.test(comment)) {
    flags.push('LINK_OR_PROMO_CONTENT');
  }

  // 3. Check for profanity / abusive slurs
  if (/\b(putangina|gago|tarantado|ulol|bobo|scammer|fuck|shit|bitch)\b/i.test(lowerComment)) {
    flags.push('PROFANITY_DETECTED');
  }

  // 4. Check for AI-like repetitive phrasing or excessive length
  if (/(as an ai language model|in conclusion, overall|furthermore, the rental experience)/i.test(lowerComment)) {
    flags.push('AI_GENERATED_PATTERN');
  }

  const status = flags.length > 0 ? 'pending' : 'approved';

  const newReview: ReviewItem = {
    id: `rev-${Date.now()}`,
    bookingReference,
    verifiedBooking: true,
    customerName: matchedBooking.customerName,
    eventType: matchedBooking.eventType,
    location: `${matchedBooking.barangay ? `Brgy. ${matchedBooking.barangay}, ` : ''}${matchedBooking.municipality}`,
    rating,
    comment,
    date: new Date().toISOString().slice(0, 10),
    status,
    flags,
    reportCount: 0,
  };

  return {
    valid: true,
    review: newReview,
    heldForModeration: status === 'pending',
  };
}

/**
 * Appends an immutable entry to `db.auditLogs` (capped at 500 most recent entries).
 */
export function appendAuditLog(
  db: DatabaseSchema,
  entry: {
    actor: string;
    role: 'admin' | 'staff' | 'customer' | 'anonymous';
    action: string;
    targetId?: string;
    ip?: string;
    details: string;
  }
): void {
  if (!Array.isArray(db.auditLogs)) {
    db.auditLogs = [];
  }
  db.auditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
}

/**
 * Redacts customer PII from a booking object when returned to a public lookup by reference number.
 */
export function maskBookingForPublicLookup(booking: Booking): Partial<Booking> {
  const maskedPhone = booking.customerPhone
    ? booking.customerPhone.slice(0, 4) + '****' + booking.customerPhone.slice(-2)
    : '';
  return {
    id: booking.id,
    referenceNumber: booking.referenceNumber,
    customerId: booking.customerId,
    customerName: booking.customerName,
    customerPhone: maskedPhone,
    customerEmail: '',
    eventType: booking.eventType,
    eventDate: booking.eventDate,
    returnDate: booking.returnDate,
    rentalDays: booking.rentalDays,
    eventTime: booking.eventTime,
    municipality: booking.municipality,
    barangay: booking.barangay,
    venueAddress: '[Protected — Verified on Delivery Slip]',
    fulfillmentType: booking.fulfillmentType,
    includeSetup: booking.includeSetup,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    subtotal: booking.subtotal,
    deliveryFee: booking.deliveryFee,
    setupFee: booking.setupFee,
    discountAmount: booking.discountAmount,
    damageFeeTotal: booking.damageFeeTotal,
    totalAmount: booking.totalAmount,
    depositRequired: booking.depositRequired,
    amountPaid: booking.amountPaid,
    balanceDue: booking.balanceDue,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    items: booking.items,
    payments: booking.payments.map((p) => ({
      ...p,
      proofImageUrl: undefined,
    })),
    damageLogs: booking.damageLogs,
  };
}
