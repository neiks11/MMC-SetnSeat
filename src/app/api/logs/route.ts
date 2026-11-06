import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import {
  enforceRateLimit,
  getClientIp,
  sanitizeText,
  verifyAdminRequest,
} from '@/lib/security';
import {
  ALLOWED_VISITOR_EVENTS,
  AllowedVisitorEventName,
  VisitorLogEvent,
} from '@/lib/visitor-logger';

const ALLOWED_CORS_ORIGINS = [
  'http://localhost:3000',
  'https://neiks11.github.io',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : []),
];

function getCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_CORS_ORIGINS.includes(origin)
    ? origin
    : 'https://neiks11.github.io';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

/**
 * Generates a daily-rotating salted hash of the client IP (never stores raw IP).
 */
function getDailyRotatingIpHash(ip: string): string {
  const daySalt = new Date().toISOString().slice(0, 10); // rotates every UTC day
  const secret = process.env.MMC_SESSION_SECRET || 'mmc-daily-privacy-salt';
  return crypto
    .createHash('sha256')
    .update(`${ip}:${daySalt}:${secret}`)
    .digest('hex')
    .slice(0, 16);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = getCorsHeaders(req);
  try {
    // 1. Max payload size check (<= 8KB)
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 8192) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413, headers: cors });
    }

    // 2. Bot filtering
    const ua = req.headers.get('user-agent') || '';
    if (/(bot|crawler|spider|slurp|lighthouse|headlesschrome)/i.test(ua)) {
      return NextResponse.json({ ok: true, ignored: 'bot' }, { status: 202, headers: cors });
    }

    // 3. Rate limit per IP
    const rateLimited = enforceRateLimit(req, 'visitor_logs_post', 90, 5 * 60 * 1000);
    if (rateLimited) return rateLimited;

    const rawText = await req.text();
    if (rawText.length > 8192) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413, headers: cors });
    }

    const body = JSON.parse(rawText);
    if (body?.websiteHoneypot) {
      return NextResponse.json({ ok: true }, { status: 202, headers: cors });
    }

    const eventName = sanitizeText(body?.eventName, 32) as AllowedVisitorEventName;
    if (!ALLOWED_VISITOR_EVENTS.includes(eventName)) {
      return NextResponse.json({ error: 'Invalid event type.' }, { status: 400, headers: cors });
    }

    const ip = getClientIp(req);
    const ipSaltedHash = getDailyRotatingIpHash(ip);
    const edgeCountry = sanitizeText(
      req.headers.get('cf-ipcountry') ||
        req.headers.get('x-vercel-ip-country') ||
        body?.regionHint ||
        'PH / Asia-Manila',
      40
    );

    const now = new Date();
    const cleanEvent: VisitorLogEvent = {
      id: `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventName,
      timestampUtc: now.toISOString(),
      timestampManila: sanitizeText(body?.timestampManila || now.toISOString(), 32),
      anonSessionId: sanitizeText(body?.anonSessionId || 'anon-session', 40),
      pagePath: sanitizeText(body?.pagePath || '/', 80),
      referrer: sanitizeText(body?.referrer || 'Direct', 60),
      utmSource: sanitizeText(body?.utmSource, 40),
      utmMedium: sanitizeText(body?.utmMedium, 40),
      utmCampaign: sanitizeText(body?.utmCampaign, 40),
      language: sanitizeText(body?.language || 'en-PH', 16),
      deviceType:
        body?.deviceType === 'Desktop' || body?.deviceType === 'Tablet'
          ? body.deviceType
          : 'Mobile',
      browserFamily: sanitizeText(body?.browserFamily || 'Other', 24),
      osFamily: sanitizeText(body?.osFamily || 'Other', 24),
      screenSize: sanitizeText(body?.screenSize || '0x0', 20),
      regionHint: edgeCountry,
      metaKey: sanitizeText(body?.metaKey, 40),
      metaValue: sanitizeText(body?.metaValue, 80),
      ipSaltedHash,
    };

    const db = await readDb();
    if (!Array.isArray(db.visitorLogs)) {
      db.visitorLogs = [];
    }

    // 4. Automatic 90-day retention purge + 30-day IP hash scrubbing
    const ninetyDaysAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

    db.visitorLogs.unshift(cleanEvent);
    db.visitorLogs = db.visitorLogs
      .filter((ev: VisitorLogEvent) => {
        const t = new Date(ev.timestampUtc).getTime();
        return !Number.isNaN(t) && t >= ninetyDaysAgoMs;
      })
      .slice(0, 1500)
      .map((ev: VisitorLogEvent) => {
        const t = new Date(ev.timestampUtc).getTime();
        if (t < thirtyDaysAgoMs && ev.ipSaltedHash) {
          return { ...ev, ipSaltedHash: undefined };
        }
        return ev;
      });

    // 5. Spike & Error Alert Detection (Task 6.7)
    const fiveMinAgoMs = Date.now() - 5 * 60 * 1000;
    const recent5m = db.visitorLogs.filter(
      (ev: VisitorLogEvent) => new Date(ev.timestampUtc).getTime() >= fiveMinAgoMs
    );
    const recentErrors = recent5m.filter((ev: VisitorLogEvent) => ev.eventName === 'client_error');

    if (recentErrors.length === 5) {
      db.notifications.unshift({
        id: `notif-err-spike-${Date.now()}`,
        type: 'STATUS_CHANGE',
        title: 'Alert: Client Error Spike Detected',
        message: `5 client-side JavaScript errors logged in the last 5 minutes (latest: ${cleanEvent.metaValue || 'unknown'}). Check /admin/logs.`,
        read: false,
        createdAt: now.toISOString(),
      });
    }

    await writeDb(db);
    return NextResponse.json({ ok: true }, { status: 201, headers: cors });
  } catch {
    return NextResponse.json({ error: 'Log ingestion failed.' }, { status: 400, headers: cors });
  }
}

export async function GET(req: NextRequest) {
  const cors = getCorsHeaders(req);
  const adminSession = verifyAdminRequest(req);
  if (!adminSession) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin authentication required.' },
      { status: 401, headers: cors }
    );
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days')) || 30));
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const db = await readDb();
  const allLogs: VisitorLogEvent[] = Array.isArray(db.visitorLogs) ? db.visitorLogs : [];
  const filtered = allLogs.filter(
    (ev) => new Date(ev.timestampUtc).getTime() >= cutoffMs
  );

  return NextResponse.json(
    {
      logs: filtered,
      totalStored: allLogs.length,
      retentionDays: 90,
    },
    { status: 200, headers: cors }
  );
}

export async function DELETE(req: NextRequest) {
  const cors = getCorsHeaders(req);
  const adminSession = verifyAdminRequest(req);
  if (!adminSession) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin authentication required.' },
      { status: 401, headers: cors }
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('anonSessionId');
  const db = await readDb();
  const beforeCount = Array.isArray(db.visitorLogs) ? db.visitorLogs.length : 0;

  if (sessionId) {
    db.visitorLogs = (db.visitorLogs || []).filter(
      (ev: VisitorLogEvent) => ev.anonSessionId !== sessionId
    );
  } else {
    db.visitorLogs = [];
  }

  await writeDb(db);
  return NextResponse.json(
    {
      success: true,
      deletedCount: beforeCount - (db.visitorLogs?.length || 0),
    },
    { status: 200, headers: cors }
  );
}

