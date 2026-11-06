import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import {
  ADMIN_COOKIE_NAME,
  appendAuditLog,
  checkLoginLockout,
  clearAdminSessionCookie,
  clearFailedLogins,
  createAdminSessionToken,
  enforceRateLimit,
  getClientIp,
  hashPasswordScrypt,
  recordFailedLogin,
  revokeAdminSessionToken,
  sanitizeText,
  setAdminSessionCookie,
  verifyPasswordWithMigration,
} from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const rateLimited = enforceRateLimit(req, 'auth_login', 10, 15 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const ip = getClientIp(req);
    const lockout = checkLoginLockout(ip);
    if (lockout.locked) {
      return NextResponse.json(
        {
          error: `Account login temporarily locked due to multiple failed attempts. Try again in ${lockout.retryAfterSec} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(lockout.retryAfterSec) },
        }
      );
    }

    const body = await req.json();
    const username = sanitizeText(body?.username, 64);
    const password = String(body?.password || '');

    const db = await readDb();
    const expectedUsername = (
      process.env.MMC_ADMIN_USERNAME ||
      db.settings.adminUsername ||
      'admin'
    ).toLowerCase();

    const validUser = username.toLowerCase() === expectedUsername;
    const { valid: validPass, needsRehash } = verifyPasswordWithMigration(
      password,
      db.settings.adminPassword
    );

    if (!validUser || !validPass) {
      recordFailedLogin(ip);
      appendAuditLog(db, {
        actor: username || 'unknown',
        role: 'anonymous',
        action: 'ADMIN_LOGIN_FAILED',
        ip,
        details: 'Failed admin authentication attempt.',
      });
      await writeDb(db);

      return NextResponse.json(
        { error: 'Invalid username or password.' },
        { status: 401 }
      );
    }

    clearFailedLogins(ip);

    // Safe password hash migration: automatically upgrade plaintext password to scrypt on login
    if (needsRehash) {
      db.settings.adminPassword = hashPasswordScrypt(password);
    }

    appendAuditLog(db, {
      actor: db.settings.adminUsername,
      role: 'admin',
      action: 'ADMIN_LOGIN_SUCCESS',
      ip,
      details: needsRehash
        ? 'Admin login succeeded; legacy password migrated to scrypt hash.'
        : 'Admin login succeeded.',
    });
    await writeDb(db);

    const token = createAdminSessionToken(db.settings.adminUsername, 'admin');
    const res = NextResponse.json({
      authenticated: true,
      success: true,
      token,
      user: {
        username: db.settings.adminUsername,
        role: 'Owner / Administrator',
        businessName: db.settings.businessName,
      },
    });
    setAdminSessionCookie(res, token);
    return res;
  } catch {
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

  revokeAdminSessionToken(cookieToken || bearerToken);
  const res = NextResponse.json({ success: true, loggedOut: true });
  clearAdminSessionCookie(res);
  return res;
}
