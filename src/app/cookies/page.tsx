'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getSavedCookieConsent,
  saveCookieConsent,
  getAssetPath,
} from '@/lib/client-api';

export default function CookiePolicyPage() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [consentedAt, setConsentedAt] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    const prefs = getSavedCookieConsent();
    if (prefs) {
      setAnalytics(prefs.analytics);
      setMarketing(prefs.marketing);
      setConsentedAt(prefs.consentedAt);
    }
  }, []);

  function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    const updated = saveCookieConsent({ analytics, marketing });
    setConsentedAt(updated.consentedAt);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  }

  function handleWithdrawAll() {
    const updated = saveCookieConsent({ analytics: false, marketing: false });
    setAnalytics(false);
    setMarketing(false);
    setConsentedAt(updated.consentedAt);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-stone-900 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-10 space-y-6">
        <div className="border-b border-stone-200 pb-5">
          <Link
            href={getAssetPath('/')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#7B2D26] hover:underline mb-3"
          >
            ← Back to MMC Set n Seat Rentals
          </Link>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#7B2D26]">
            Cookie & Local Storage Transparency
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
            Cookie Policy & Preference Center
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Effective Date: November 6, 2026 | Policy Version: 2026-11-RA10173
          </p>
        </div>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">1. How We Use Cookies & Local Storage</h2>
          <p>
            <strong>MMC Set n Seat Rentals</strong> uses browser cookies and local/session storage to keep
            your rental cart active, secure the administrator dashboard, and—only if you explicitly opt in—measure
            website performance. Non-essential scripts (such as Google Analytics) are strictly blocked by default
            until you grant consent.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">2. Categories of Cookies & Storage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-stone-200 text-xs sm:text-sm">
              <thead className="bg-stone-100 text-stone-800">
                <tr>
                  <th className="p-3 border border-stone-200">Name / Key</th>
                  <th className="p-3 border border-stone-200">Category</th>
                  <th className="p-3 border border-stone-200">Purpose</th>
                  <th className="p-3 border border-stone-200">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-stone-200 font-mono">mmc_cookie_consent_v1</td>
                  <td className="p-3 border border-stone-200 font-bold text-emerald-800">Essential</td>
                  <td className="p-3 border border-stone-200">Stores your cookie consent choices and timestamp.</td>
                  <td className="p-3 border border-stone-200">12 months</td>
                </tr>
                <tr>
                  <td className="p-3 border border-stone-200 font-mono">mmc_admin_session</td>
                  <td className="p-3 border border-stone-200 font-bold text-emerald-800">Essential</td>
                  <td className="p-3 border border-stone-200">HttpOnly, SameSite=Strict signed session cookie for authenticated staff/admins.</td>
                  <td className="p-3 border border-stone-200">8 hours (Session)</td>
                </tr>
                <tr>
                  <td className="p-3 border border-stone-200 font-mono">_ga / _ga_*</td>
                  <td className="p-3 border border-stone-200 font-bold text-amber-800">Analytics (Opt-In)</td>
                  <td className="p-3 border border-stone-200">Google Analytics 4 measurement of page views and mobile load speed. Blocked unless you opt in.</td>
                  <td className="p-3 border border-stone-200">Up to 13 months</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <form onSubmit={handleSavePreferences} className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-[#7B2D26]">
              3. Manage or Withdraw Your Cookie Consent
            </h2>
            {consentedAt && (
              <span className="text-xs text-stone-500">
                Last updated: {new Date(consentedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-200">
              <div>
                <p className="font-bold text-stone-900">Essential Storage & Security Cookies</p>
                <p className="text-xs text-stone-500">Required for booking forms, security tokens, and consent storage.</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Always Active
              </span>
            </div>

            <label className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-200 cursor-pointer">
              <div>
                <p className="font-bold text-stone-900">Analytics Cookies (Google Analytics)</p>
                <p className="text-xs text-stone-500">Allow anonymous traffic and mobile performance measurement.</p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="w-5 h-5 accent-[#7B2D26]"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-200 cursor-pointer">
              <div>
                <p className="font-bold text-stone-900">Marketing & Social Media Cookies</p>
                <p className="text-xs text-stone-500">Allow optional social embeds and promotional retargeting.</p>
              </div>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="w-5 h-5 accent-[#7B2D26]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#7B2D26] hover:bg-[#5e211b] text-white font-bold text-xs sm:text-sm transition"
            >
              Save Cookie Preferences
            </button>
            <button
              type="button"
              onClick={handleWithdrawAll}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs sm:text-sm transition"
            >
              Withdraw All Non-Essential Consent
            </button>
            {savedToast && (
              <span className="text-xs font-bold text-emerald-700">
                ✓ Preferences saved and recorded!
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
