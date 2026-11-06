'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  BarChart3,
  Download,
  Trash2,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { apiFetch, getAssetPath } from '@/lib/client-api';
import { VisitorLogEvent } from '@/lib/visitor-logger';

export default function AdminVisitorLogsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [daysFilter, setDaysFilter] = useState<number>(30);
  const [logs, setLogs] = useState<VisitorLogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteSessionInput, setDeleteSessionInput] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('mmc_admin_token');
    if (token || sessionStorage.getItem('mmc_admin_auth') === 'true') {
      fetchLogs(daysFilter);
    }
  }, [daysFilter]);

  async function fetchLogs(days: number) {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/logs?days=${days}`);
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      setAuthenticated(true);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const res = await apiFetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || 'Authentication failed.');
      return;
    }
    if (data.token) {
      sessionStorage.setItem('mmc_admin_token', data.token);
    }
    sessionStorage.setItem('mmc_admin_auth', 'true');
    setPassword('');
    setAuthenticated(true);
    await fetchLogs(daysFilter);
  }

  const metrics = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const todaySessions = new Set<string>();
    const sevenDaySessions = new Set<string>();
    const thirtyDaySessions = new Set<string>();

    const pageCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = { Mobile: 0, Tablet: 0, Desktop: 0 };
    const regionCounts: Record<string, number> = {};
    const checkedDates: Record<string, number> = {};
    const addedItems: Record<string, number> = {};
    const funnel = {
      page_view: new Set<string>(),
      date_checked: new Set<string>(),
      item_added: new Set<string>(),
      booking_form_started: new Set<string>(),
      booking_submitted: new Set<string>(),
    };
    const errors: VisitorLogEvent[] = [];

    for (const ev of logs) {
      const t = new Date(ev.timestampUtc).getTime();
      const age = now - t;
      const sid = ev.anonSessionId || 'anon';

      if (age <= oneDayMs) todaySessions.add(sid);
      if (age <= 7 * oneDayMs) sevenDaySessions.add(sid);
      if (age <= 30 * oneDayMs) thirtyDaySessions.add(sid);

      pageCounts[ev.pagePath || '/'] = (pageCounts[ev.pagePath || '/'] || 0) + 1;
      const src = ev.utmSource || ev.referrer || 'Direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      deviceCounts[ev.deviceType || 'Mobile'] =
        (deviceCounts[ev.deviceType || 'Mobile'] || 0) + 1;
      regionCounts[ev.regionHint || 'Asia/Manila'] =
        (regionCounts[ev.regionHint || 'Asia/Manila'] || 0) + 1;

      if (ev.eventName in funnel) {
        funnel[ev.eventName as keyof typeof funnel].add(sid);
      }
      if (ev.eventName === 'date_checked' && ev.metaValue) {
        checkedDates[ev.metaValue] = (checkedDates[ev.metaValue] || 0) + 1;
      }
      if (ev.eventName === 'item_added' && ev.metaValue) {
        addedItems[ev.metaValue] = (addedItems[ev.metaValue] || 0) + 1;
      }
      if (ev.eventName === 'client_error') {
        errors.push(ev);
      }
    }

    const topSort = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    return {
      visitorsToday: todaySessions.size,
      visitors7d: sevenDaySessions.size,
      visitors30d: thirtyDaySessions.size,
      topPages: topSort(pageCounts),
      topSources: topSort(sourceCounts),
      deviceCounts,
      topRegions: topSort(regionCounts),
      topCheckedDates: topSort(checkedDates),
      topAddedItems: topSort(addedItems),
      funnel: {
        visits: funnel.page_view.size,
        dateChecked: funnel.date_checked.size,
        itemAdded: funnel.item_added.size,
        formStarted: funnel.booking_form_started.size,
        submitted: funnel.booking_submitted.size,
      },
      errors: errors.slice(0, 15),
    };
  }, [logs]);

  function handleExportCsv() {
    const headers = [
      'timestampUtc',
      'timestampManila',
      'eventName',
      'anonSessionId',
      'pagePath',
      'referrer',
      'deviceType',
      'browserFamily',
      'osFamily',
      'screenSize',
      'regionHint',
      'metaKey',
      'metaValue',
    ];
    const rows = logs.map((ev) =>
      headers
        .map((h) => {
          const val = String((ev as any)[h] || '').replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mmc-visitor-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteBySession(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteSessionInput.trim()) return;
    await apiFetch(`/api/logs?anonSessionId=${encodeURIComponent(deleteSessionInput.trim())}`, {
      method: 'DELETE',
    });
    setDeleteSessionInput('');
    await fetchLogs(daysFilter);
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl border border-stone-200 shadow-lg p-6 sm:p-8 max-w-md w-full space-y-4"
        >
          <div className="flex items-center gap-2 text-[#7B2D26] font-extrabold text-lg">
            <Lock className="w-5 h-5" />
            <h1>Protected Visitor Logs (/admin/logs)</h1>
          </div>
          <p className="text-xs text-stone-600">
            Sign in with your administrator credentials to view privacy-safe visitor analytics and conversion funnels.
          </p>
          {authError && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold">
              {authError}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Admin Username</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-stone-300 px-3 py-2 text-base"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Admin Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-stone-300 px-3 py-2 text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl bg-[#7B2D26] hover:bg-[#5E201A] text-white font-bold text-sm transition"
          >
            Sign In to View Logs
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-stone-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#7B2D26]">
              <ShieldCheck className="w-4 h-4" />
              <span>RA 10173 Privacy-First Analytics (Zero PII • 90-Day Retention)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-0.5">
              Visitor Logs & Conversion Funnel Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[1, 7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysFilter(d)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  daysFilter === d
                    ? 'bg-[#7B2D26] text-white border-[#7B2D26]'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                {d === 1 ? 'Today (24h)' : `Last ${d}d`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fetchLogs(daysFilter)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold inline-flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <Link
              href={getAssetPath('/admin')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold inline-flex items-center"
            >
              ← Admin Home
            </Link>
          </div>
        </div>

        {/* Visitor Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-xs font-bold text-stone-500">Visitors Today (24h)</div>
            <div className="text-2xl font-extrabold text-[#7B2D26] mt-1">
              {metrics.visitorsToday}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-xs font-bold text-stone-500">Visitors (Last 7 Days)</div>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              {metrics.visitors7d}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-xs font-bold text-stone-500">Visitors (Last 30 Days)</div>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">
              {metrics.visitors30d}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-stone-200">
            <div className="text-xs font-bold text-stone-500">Total Events ({daysFilter}d)</div>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">{logs.length}</div>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3">
          <h2 className="font-extrabold text-base text-[#7B2D26] flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Booking Conversion Funnel (Unique Anonymous Sessions)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {[
              { label: '1. Page Visit', count: metrics.funnel.visits },
              { label: '2. Date Checked', count: metrics.funnel.dateChecked },
              { label: '3. Item Added', count: metrics.funnel.itemAdded },
              { label: '4. Form Started', count: metrics.funnel.formStarted },
              { label: '5. Submitted', count: metrics.funnel.submitted },
            ].map((step) => (
              <div
                key={step.label}
                className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200"
              >
                <div className="text-xs font-bold text-stone-600">{step.label}</div>
                <div className="text-xl font-extrabold text-[#7B2D26] mt-1">{step.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown Grids */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-2">
            <h2 className="font-extrabold text-sm text-[#7B2D26]">
              Most-Checked Event Dates & Most-Added Items
            </h2>
            <div className="text-xs font-bold text-stone-500 pt-1">Top Checked Dates:</div>
            <ul className="text-xs space-y-1">
              {metrics.topCheckedDates.length === 0 && (
                <li className="text-stone-400">No date checks logged yet</li>
              )}
              {metrics.topCheckedDates.map(([d, c]) => (
                <li key={d} className="flex justify-between">
                  <span className="font-semibold">{d}</span>
                  <span className="font-bold text-[#7B2D26]">{c}</span>
                </li>
              ))}
            </ul>
            <div className="text-xs font-bold text-stone-500 pt-2">Top Added Rental Items:</div>
            <ul className="text-xs space-y-1">
              {metrics.topAddedItems.length === 0 && (
                <li className="text-stone-400">No item adds logged yet</li>
              )}
              {metrics.topAddedItems.map(([item, c]) => (
                <li key={item} className="flex justify-between">
                  <span className="font-semibold truncate pr-2">{item}</span>
                  <span className="font-bold text-[#7B2D26]">{c}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-2">
            <h2 className="font-extrabold text-sm text-[#7B2D26] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>Device Split & Traffic Sources</span>
            </h2>
            <div className="text-xs space-y-1">
              {Object.entries(metrics.deviceCounts).map(([dev, c]) => (
                <div key={dev} className="flex justify-between">
                  <span>{dev}:</span>
                  <span className="font-bold">{c} events</span>
                </div>
              ))}
            </div>
            <div className="text-xs font-bold text-stone-500 pt-2">Traffic Sources:</div>
            <ul className="text-xs space-y-1">
              {metrics.topSources.map(([src, c]) => (
                <li key={src} className="flex justify-between">
                  <span className="truncate pr-2">{src}</span>
                  <span className="font-bold">{c}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-2">
            <h2 className="font-extrabold text-sm text-[#7B2D26] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Recent Client Errors & Data Deletion</span>
            </h2>
            <ul className="text-xs space-y-1 max-h-28 overflow-y-auto">
              {metrics.errors.length === 0 && (
                <li className="text-emerald-700 font-semibold">Zero client errors logged</li>
              )}
              {metrics.errors.map((err, i) => (
                <li key={i} className="text-red-700 truncate">
                  [{err.timestampManila}] {err.metaValue}
                </li>
              ))}
            </ul>
            <form onSubmit={handleDeleteBySession} className="pt-2 border-t border-stone-100 space-y-2">
              <label className="block text-[11px] font-bold text-stone-600">
                Delete Logs by Anonymous Session ID (RA 10173 Request):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="anon-..."
                  value={deleteSessionInput}
                  onChange={(e) => setDeleteSessionInput(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Purge
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

