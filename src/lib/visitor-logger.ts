'use client';

import { getSavedCookieConsent, getClientFirebaseConfig } from './client-api';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, push, ref as dbRef } from 'firebase/database';

export type AllowedVisitorEventName =
  | 'page_view'
  | 'date_checked'
  | 'item_added'
  | 'item_removed'
  | 'package_viewed'
  | 'book_now_clicked'
  | 'booking_form_started'
  | 'booking_submitted'
  | 'chat_button_clicked'
  | 'phone_clicked'
  | 'messenger_clicked'
  | 'track_booking_lookup'
  | 'faq_opened'
  | 'client_error';

export const ALLOWED_VISITOR_EVENTS: AllowedVisitorEventName[] = [
  'page_view',
  'date_checked',
  'item_added',
  'item_removed',
  'package_viewed',
  'book_now_clicked',
  'booking_form_started',
  'booking_submitted',
  'chat_button_clicked',
  'phone_clicked',
  'messenger_clicked',
  'track_booking_lookup',
  'faq_opened',
  'client_error',
];

export interface VisitorLogEvent {
  id?: string;
  eventName: AllowedVisitorEventName;
  timestampUtc: string;
  timestampManila: string;
  anonSessionId: string;
  pagePath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  language: string;
  deviceType: 'Mobile' | 'Tablet' | 'Desktop';
  browserFamily: string;
  osFamily: string;
  screenSize: string;
  regionHint: string;
  // Non-PII event metadata (e.g., itemId/itemName, checkedDate, errorCode — NEVER customer PII)
  metaKey?: string;
  metaValue?: string;
  ipSaltedHash?: string;
}

// In-memory-only anonymous session ID (never stored in cookies or localStorage)
let memoryAnonSessionId: string | null = null;
let errorListenersAttached = false;

function getMemorySessionId(): string {
  if (!memoryAnonSessionId) {
    const rand = Math.random().toString(36).slice(2, 10);
    const timePart = Date.now().toString(36).slice(-6);
    memoryAnonSessionId = `anon-${timePart}-${rand}`;
  }
  return memoryAnonSessionId;
}

function cleanField(val: unknown, maxLen = 80): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Checks whether tracking is blocked by Do Not Track (DNT), Global Privacy Control (GPC),
 * known bot user-agents, or lack of explicit Cookie Banner consent.
 */
export function isVisitorLoggingPermitted(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  // 1. Respect Do Not Track (DNT) & Global Privacy Control (GPC)
  const dnt =
    navigator.doNotTrack === '1' ||
    (window as any).doNotTrack === '1' ||
    (navigator as any).msDoNotTrack === '1';
  const gpc = Boolean((navigator as any).globalPrivacyControl);
  if (dnt || gpc) return false;

  // 2. Ignore automated crawlers / headless bots
  const ua = navigator.userAgent || '';
  if (/(bot|crawler|spider|slurp|lighthouse|headlesschrome|playwright|puppeteer)/i.test(ua)) {
    return false;
  }

  // 3. Require explicit opt-in consent from the Cookie Consent Banner
  const consent = getSavedCookieConsent();
  return Boolean(consent && consent.analytics === true);
}

function detectDeviceType(): 'Mobile' | 'Tablet' | 'Desktop' {
  if (typeof window === 'undefined') return 'Mobile';
  const w = window.innerWidth || 390;
  if (w < 768) return 'Mobile';
  if (w < 1024) return 'Tablet';
  return 'Desktop';
}

function detectBrowserFamily(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  return 'Other';
}

function detectOsFamily(ua: string): string {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Other';
}

function formatManilaTime(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Non-blocking privacy-first event logger.
 * - Does nothing unless user opted in via Cookie Banner and DNT/GPC are off.
 * - Never logs names, phone numbers, addresses, or form input values.
 * - Uses `navigator.sendBeacon` with `fetch(..., { keepalive: true })` fallback.
 */
export function logVisitorEvent(
  eventName: AllowedVisitorEventName,
  meta?: { key?: string; value?: string }
): void {
  try {
    if (!isVisitorLoggingPermitted()) return;
    if (!ALLOWED_VISITOR_EVENTS.includes(eventName)) return;

    const now = new Date();
    const ua = navigator.userAgent || '';
    const urlObj = new URL(window.location.href);

    let referrerHost = 'Direct';
    if (document.referrer) {
      try {
        referrerHost = new URL(document.referrer).hostname || 'Direct';
      } catch {
        referrerHost = 'Direct';
      }
    }

    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';

    const payload: VisitorLogEvent = {
      eventName,
      timestampUtc: now.toISOString(),
      timestampManila: formatManilaTime(now),
      anonSessionId: getMemorySessionId(),
      pagePath: cleanField(urlObj.pathname + urlObj.hash, 80) || '/',
      referrer: cleanField(referrerHost, 60),
      utmSource: cleanField(urlObj.searchParams.get('utm_source'), 40),
      utmMedium: cleanField(urlObj.searchParams.get('utm_medium'), 40),
      utmCampaign: cleanField(urlObj.searchParams.get('utm_campaign'), 40),
      language: cleanField(navigator.language || 'en-PH', 16),
      deviceType: detectDeviceType(),
      browserFamily: detectBrowserFamily(ua),
      osFamily: detectOsFamily(ua),
      screenSize: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      regionHint: cleanField(tz, 40),
      metaKey: cleanField(meta?.key, 40),
      metaValue: cleanField(meta?.value, 80),
    };

    const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
    const jsonBody = JSON.stringify(payload);

    if (!isStaticExport) {
      if (typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([jsonBody], { type: 'application/json' });
        const queued = navigator.sendBeacon('/api/logs', blob);
        if (queued) return;
      }
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
        keepalive: true,
      }).catch(() => {});
      return;
    }

    // Static GitHub Pages fallback: append to localStorage ring buffer + Firebase RTDB `visitor_logs` if configured
    const rawLocal = window.localStorage.getItem('mmc_visitor_logs_v1');
    const existing: VisitorLogEvent[] = rawLocal ? JSON.parse(rawLocal) : [];
    existing.unshift({ ...payload, id: `vlog-${Date.now()}` });
    window.localStorage.setItem(
      'mmc_visitor_logs_v1',
      JSON.stringify(existing.slice(0, 300))
    );

    const fbConfig = getClientFirebaseConfig();
    if (fbConfig?.apiKey && fbConfig?.projectId && fbConfig?.databaseURL) {
      const appName = `mmc-client-fb-${fbConfig.projectId}`;
      const app =
        getApps().find((a) => a.name === appName) ||
        initializeApp(fbConfig, appName);
      const rtdb = getDatabase(app, fbConfig.databaseURL);
      push(dbRef(rtdb, 'visitor_logs'), payload).catch(() => {});
    }
  } catch {
    // Always fail silently so ad blockers or network errors never break the UI
  }
}

/**
 * Attaches a global `window.onerror` listener (scrubbed of any PII) once per session.
 */
export function initGlobalErrorLogger(): void {
  if (typeof window === 'undefined' || errorListenersAttached) return;
  errorListenersAttached = true;

  window.addEventListener('error', (event) => {
    try {
      const msg = cleanField(event.message || 'runtime_error', 80);
      logVisitorEvent('client_error', { key: 'window.onerror', value: msg });
    } catch {
      // fail silently
    }
  });
}

