'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Settings, X } from 'lucide-react';
import {
  getSavedCookieConsent,
  saveCookieConsent,
  getAssetPath,
} from '@/lib/client-api';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = getSavedCookieConsent();
    if (!existing) {
      setVisible(true);
    } else {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
    }
  }, []);

  if (!visible) return null;

  function handleEssentialOnly() {
    saveCookieConsent({ analytics: false, marketing: false });
    setVisible(false);
  }

  function handleAcceptAll() {
    saveCookieConsent({ analytics: true, marketing: true });
    setVisible(false);
  }

  function handleSaveCustom() {
    saveCookieConsent({ analytics, marketing });
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie and Privacy Consent Banner"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 bg-stone-950/95 text-white border-t border-amber-400/30 backdrop-blur-md shadow-2xl"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 text-xs sm:text-sm text-stone-200 max-w-3xl">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Your Privacy & Cookie Choices (RA 10173 Compliant)</span>
            </div>
            <p className="leading-relaxed text-stone-300">
              We use strictly necessary storage to remember your rental cart and booking session. With your
              explicit consent, we also use optional analytics cookies (Google Analytics) to improve mobile
              speed and booking usability. Non-essential scripts remain blocked until you opt in. Read our{' '}
              <Link href={getAssetPath('/privacy')} className="underline text-amber-300 hover:text-amber-200 font-semibold">
                Privacy Policy
              </Link>
              ,{' '}
              <Link href={getAssetPath('/cookies')} className="underline text-amber-300 hover:text-amber-200 font-semibold">
                Cookie Policy
              </Link>
              , and{' '}
              <Link href={getAssetPath('/terms')} className="underline text-amber-300 hover:text-amber-200 font-semibold">
                Terms & Conditions
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCustomize(!showCustomize)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-200 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              Customize
            </button>
            <button
              type="button"
              onClick={handleEssentialOnly}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs transition"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs transition shadow"
            >
              Accept All
            </button>
          </div>
        </div>

        {showCustomize && (
          <div className="mt-4 pt-4 border-t border-stone-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-stone-900 border border-stone-800">
              <div className="flex items-center justify-between font-bold text-white mb-1">
                <span>1. Essential (Required)</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300">
                  Always Active
                </span>
              </div>
              <p className="text-stone-400">
                Required for your rental quote cart, date selection, cookie consent record, and admin security session.
              </p>
            </div>

            <label className="p-3 rounded-xl bg-stone-900 border border-stone-800 cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>2. Analytics Cookies</span>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                </div>
                <p className="text-stone-400">
                  Helps us measure page load performance and popular rental packages via Google Analytics (anonymized IP).
                </p>
              </div>
            </label>

            <label className="p-3 rounded-xl bg-stone-900 border border-stone-800 cursor-pointer flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between font-bold text-white mb-1">
                  <span>3. Marketing & Social</span>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                </div>
                <p className="text-stone-400">
                  Used only if we embed optional Facebook/Messenger promotional widgets in the future.
                </p>
              </div>
            </label>

            <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveCustom}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs transition"
              >
                Save My Preferences
              </button>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                aria-label="Close customization panel"
                className="min-h-[44px] px-3 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
