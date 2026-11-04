'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Package,
  ClipboardList,
  Users,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Edit3,
  Trash2,
  Printer,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  Download,
  Upload,
  Search,
  Bell,
  ExternalLink,
  Save,
  Lock,
  Clock,
  DollarSign,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  BusinessSettings,
  InventoryItem,
  InventoryCategory,
  Booking,
  BookingStatus,
  PaymentStatus,
  Customer,
  DamageLog,
  NotificationAlert,
} from '@/lib/types';
import { ItemAvailability } from '@/lib/db';
import PrintableDocumentModal from './PrintableDocumentModal';

type AdminTab =
  | 'dashboard'
  | 'bookings'
  | 'inventory'
  | 'calendar'
  | 'customers'
  | 'payments'
  | 'damages'
  | 'reports'
  | 'settings';

const ALL_STATUSES: BookingStatus[] = [
  'Pending',
  'Confirmed',
  'Out for Delivery',
  'In Use',
  'Returned',
  'Completed',
  'Cancelled',
];

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminDashboard() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Data state
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [damageLogs, setDamageLogs] = useState<DamageLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Bookings filter & reschedule modal
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [bookingSearch, setBookingSearch] = useState('');
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [newEventDate, setNewEventDate] = useState('');
  const [newReturnDate, setNewReturnDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');

  // Inventory Editor state
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [isNewItemModal, setIsNewItemModal] = useState(false);
  const [quickEdits, setQuickEdits] = useState<
    Record<string, { pricePerDay: number; totalStock: number }>
  >({});

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState<string>(getTodayStr().slice(0, 7)); // YYYY-MM
  const [selectedCalDate, setSelectedCalDate] = useState<string>(getTodayStr());
  const [calendarData, setCalendarData] = useState<any>({});
  const [selectedDateAvail, setSelectedDateAvail] = useState<Record<string, ItemAvailability>>({});

  // Payment modal / form state
  const [payBookingId, setPayBookingId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payType, setPayType] = useState<'Deposit' | 'Balance' | 'Full Payment' | 'Damage Fee'>('Deposit');
  const [payMethod, setPayMethod] = useState<'Cash' | 'GCash' | 'Maya' | 'Bank Transfer'>('GCash');
  const [payRef, setPayRef] = useState<string>('');
  const [payProofImg, setPayProofImg] = useState<string>('');

  // Damage modal / form state
  const [dmgBookingId, setDmgBookingId] = useState<string>('');
  const [dmgItemName, setDmgItemName] = useState<string>('');
  const [dmgIssueType, setDmgIssueType] = useState<
    'Damaged' | 'Missing / Lost' | 'Stained / Torn' | 'Late Return'
  >('Damaged');
  const [dmgQty, setDmgQty] = useState<number>(1);
  const [dmgFee, setDmgFee] = useState<number>(450);
  const [dmgNotes, setDmgNotes] = useState<string>('');

  // Print Modal
  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [printDocType, setPrintDocType] = useState<'RECEIPT' | 'INVOICE' | 'DELIVERY_SLIP'>('RECEIPT');

  // Firebase Cloud Firestore Connection State
  const [firebaseStatus, setFirebaseStatus] = useState<{
    connected: boolean;
    projectId: string | null;
  }>({ connected: false, projectId: null });
  const [fbApiKey, setFbApiKey] = useState('');
  const [fbProjectId, setFbProjectId] = useState('');
  const [fbAuthDomain, setFbAuthDomain] = useState('');
  const [fbAppId, setFbAppId] = useState('');
  const [savingFirebase, setSavingFirebase] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('mmc_admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    loadAllData();
  }, []);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'calendar') {
      loadCalendarMonth(calendarMonth, selectedCalDate);
    }
  }, [isAuthenticated, activeTab, calendarMonth, selectedCalDate]);

  async function loadAllData() {
    try {
      setLoading(true);
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.firebaseStatus) {
        setFirebaseStatus(data.firebaseStatus);
        if (data.firebaseStatus.projectId && !fbProjectId) {
          setFbProjectId(data.firebaseStatus.projectId);
        }
      }
      setSettings(data.settings);
      setInventory(data.inventory || []);
      setBookings(data.bookings || []);
      setCustomers(data.customers || []);
      setDamageLogs(data.damageLogs || []);
      setNotifications(data.notifications || []);

      const qe: Record<string, { pricePerDay: number; totalStock: number }> = {};
      for (const item of data.inventory || []) {
        qe[item.id] = { pricePerDay: item.pricePerDay, totalStock: item.totalStock };
      }
      setQuickEdits(qe);

      if (data.bookings?.length > 0 && !payBookingId) {
        setPayBookingId(data.bookings[0].id);
        setDmgBookingId(data.bookings[0].id);
      }
      if (data.inventory?.length > 0 && !dmgItemName) {
        setDmgItemName(data.inventory[0].name);
      }
    } catch (e) {
      console.error('Error loading admin state:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarMonth(month: string, inspectDate: string) {
    try {
      const res = await fetch(
        `/api/availability?month=${month}&startDate=${inspectDate}&endDate=${inspectDate}`
      );
      const data = await res.json();
      if (data.calendarDays) setCalendarData(data.calendarDays);
      if (data.availability) setSelectedDateAvail(data.availability);
    } catch (e) {
      console.error('Error loading calendar:', e);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error || 'Login failed');
      return;
    }
    sessionStorage.setItem('mmc_admin_auth', 'true');
    setIsAuthenticated(true);
  }

  function handleLogout() {
    sessionStorage.removeItem('mmc_admin_auth');
    setIsAuthenticated(false);
  }

  // Booking status & payment updates
  async function updateBookingStatus(bookingId: string, status: BookingStatus) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, action: 'update_status', status }),
    });
    if (res.ok) {
      showToast(`Booking status updated to "${status}"`);
      loadAllData();
    }
  }

  async function updateBookingPaymentStatus(bookingId: string, paymentStatus: PaymentStatus) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, action: 'update_payment_status', paymentStatus }),
    });
    if (res.ok) {
      showToast(`Payment status marked as "${paymentStatus}"`);
      loadAllData();
    }
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleBooking) return;
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: rescheduleBooking.id,
        action: 'reschedule',
        newEventDate,
        newReturnDate,
        newEventTime,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Could not reschedule');
      return;
    }
    showToast(`Rescheduled ${rescheduleBooking.referenceNumber} to ${newEventDate}`);
    setRescheduleBooking(null);
    loadAllData();
  }

  // Inventory CRUD
  async function handleQuickSaveInventory(itemId: string) {
    const edits = quickEdits[itemId];
    if (!edits) return;
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: itemId,
        pricePerDay: Number(edits.pricePerDay),
        totalStock: Number(edits.totalStock),
      }),
    });
    if (res.ok) {
      showToast('Saved updated price & stock!');
      loadAllData();
    }
  }

  async function handleSaveFullItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    const method = isNewItemModal ? 'POST' : 'PUT';
    const res = await fetch('/api/inventory', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingItem),
    });
    if (res.ok) {
      showToast(isNewItemModal ? 'Added new inventory item!' : 'Updated inventory item!');
      setEditingItem(null);
      setIsNewItemModal(false);
      loadAllData();
    }
  }

  async function handleDeleteItem(id: string, name: string) {
    if (!confirm(`Delete "${name}" from inventory?`)) return;
    const res = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast(`Deleted "${name}"`);
      loadAllData();
    }
  }

  // Handle photo file upload for inventory or payment proof (resizes/converts to data URL)
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, onResult: (url: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  // Record payment
  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payBookingId || !payAmount) return;
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: payBookingId,
        action: 'add_payment',
        amount: Number(payAmount),
        type: payType,
        method: payMethod,
        referenceNo: payRef,
        proofImageUrl: payProofImg || undefined,
        verifiedByAdmin: true,
      }),
    });
    if (res.ok) {
      showToast('Payment recorded & booking balance updated!');
      setPayAmount('');
      setPayRef('');
      setPayProofImg('');
      loadAllData();
    }
  }

  async function handleVerifyPayment(bookingId: string, paymentId: string) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        action: 'verify_payment',
        paymentId,
      }),
    });
    if (res.ok) {
      showToast('Payment verified and booking confirmed!');
      loadAllData();
    }
  }

  // Record damage / missing item
  async function handleAddDamage(e: React.FormEvent) {
    e.preventDefault();
    if (!dmgBookingId) return;
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: dmgBookingId,
        action: 'add_damage',
        itemName: dmgItemName,
        issueType: dmgIssueType,
        quantity: dmgQty,
        feeCharged: dmgFee,
        notes: dmgNotes,
        resolved: false,
      }),
    });
    if (res.ok) {
      showToast('Damage / missing item logged & fee added to balance.');
      setDmgNotes('');
      loadAllData();
    }
  }

  async function handleToggleDamageResolved(bookingId: string, damageId: string) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        action: 'toggle_damage_resolved',
        damageId,
      }),
    });
    if (res.ok) {
      showToast('Updated damage resolution status.');
      loadAllData();
    }
  }

  // Save Business Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (res.ok) {
      showToast('Business settings & pricing rules saved!');
      loadAllData();
    }
  }

  async function handleConnectFirebase(e: React.FormEvent) {
    e.preventDefault();
    if (!fbApiKey.trim() || !fbProjectId.trim()) {
      alert('Please enter your Firebase API Key and Project ID.');
      return;
    }
    try {
      setSavingFirebase(true);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_firebase_config',
          firebaseConfig: {
            apiKey: fbApiKey.trim(),
            projectId: fbProjectId.trim(),
            authDomain: fbAuthDomain.trim() || `${fbProjectId.trim()}.firebaseapp.com`,
            appId: fbAppId.trim(),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          data.syncedToFirebase
            ? `Connected & synced to Firebase project "${data.projectId}"!`
            : `Saved Firebase config for "${data.projectId}"!`
        );
        loadAllData();
      } else {
        alert(data.error || 'Could not save Firebase config.');
      }
    } finally {
      setSavingFirebase(false);
    }
  }

  // Export CSV helper
  function exportBookingsCsv() {
    const headers = [
      'Reference',
      'Customer',
      'Phone',
      'Event Type',
      'Event Date',
      'Return Date',
      'Municipality',
      'Status',
      'Payment Status',
      'Total Amount',
      'Amount Paid',
      'Balance Due',
    ];
    const rows = bookings.map((b) => [
      b.referenceNumber,
      `"${b.customerName.replace(/"/g, '""')}"`,
      b.customerPhone,
      b.eventType,
      b.eventDate,
      b.returnDate,
      `"${b.municipality}"`,
      b.status,
      b.paymentStatus,
      b.totalAmount,
      b.amountPaid,
      b.balanceDue,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MMC-Bookings-Report-${getTodayStr()}.csv`;
    a.click();
  }

  function exportInventoryCsv() {
    const headers = ['SKU', 'Item Name', 'Category', 'Price Per Day', 'Total Stock', 'Replacement Fee'];
    const rows = inventory.map((i) => [
      i.sku,
      `"${i.name.replace(/"/g, '""')}"`,
      i.category,
      i.pricePerDay,
      i.totalStock,
      i.replacementFee,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MMC-Inventory-${getTodayStr()}.csv`;
    a.click();
  }

  // Computed dashboard metrics
  const todayStr = getTodayStr();
  const todaysDeliveries = useMemo(
    () =>
      bookings.filter(
        (b) => b.eventDate === todayStr && b.status !== 'Cancelled'
      ),
    [bookings, todayStr]
  );

  const todaysPickups = useMemo(
    () =>
      bookings.filter(
        (b) => b.returnDate === todayStr && b.status !== 'Cancelled'
      ),
    [bookings, todayStr]
  );

  const revenueStats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'Cancelled');
    const totalBookedRevenue = active.reduce((s, b) => s + b.totalAmount, 0);
    const totalCollected = active.reduce((s, b) => s + b.amountPaid, 0);
    const totalReceivables = active.reduce((s, b) => s + b.balanceDue, 0);
    const pendingCount = bookings.filter((b) => b.status === 'Pending').length;
    return { totalBookedRevenue, totalCollected, totalReceivables, pendingCount };
  }, [bookings]);

  const mostRentedItems = useMemo(() => {
    const map: Record<string, { name: string; category: string; qtyBooked: number; revenue: number }> = {};
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue;
      for (const line of b.items) {
        if (!map[line.itemId]) {
          map[line.itemId] = {
            name: line.itemName,
            category: line.category,
            qtyBooked: 0,
            revenue: 0,
          };
        }
        map[line.itemId].qtyBooked += line.quantity;
        map[line.itemId].revenue += line.lineTotal;
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-charcoal-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <img
              src="/logo.jpg"
              alt="MMC Set n Seat Rentals Logo"
              className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-emerald-700 shadow-xl"
            />
            <h1 className="text-2xl font-black text-gray-900">Admin Portal Login</h1>
            <p className="text-xs text-gray-500">
              MMC Set n Seat Rentals • Chairs • Tables • Tents • Videoke
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Admin Username</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
              <div className="font-bold">Default Owner Login (Pre-filled):</div>
              <div>
                Username: <code className="font-bold">admin</code> • Password:{' '}
                <code className="font-bold">password123</code>
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                (You can change your password anytime in the Settings tab)
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 rounded-xl text-sm shadow-lg transition"
            >
              Sign In to Admin Dashboard
            </button>
          </form>

          <div className="text-center pt-2 border-t border-gray-100">
            <Link href="/" className="text-xs font-bold text-emerald-700 hover:underline">
              ← Return to Customer Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm font-bold text-emerald-900">Loading Admin Dashboard...</div>
      </div>
    );
  }

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'All' && b.status !== statusFilter) return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      return (
        b.referenceNumber.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.municipality.toLowerCase().includes(q) ||
        b.eventType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row text-charcoal-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-600 flex items-center gap-2 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="lg:w-64 bg-charcoal-900 text-white flex flex-col justify-between shrink-0 no-print">
        <div>
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="MMC Set n Seat Rentals"
                className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shrink-0"
              />
              <div>
                <div className="font-extrabold text-sm leading-tight">MMC Set n Seat</div>
                <div className="text-[11px] text-amber-400 font-semibold">Owner Control Panel</div>
              </div>
            </div>
            <Link
              href="/"
              className="text-xs bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg text-gray-200 flex items-center gap-1"
              title="View Live Customer Site"
            >
              <span>Site</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Overview & Today', icon: LayoutDashboard },
              {
                id: 'inventory',
                label: 'Edit Inventory & Prices',
                icon: Package,
                badge: inventory.length,
              },
              {
                id: 'bookings',
                label: 'Bookings & Status',
                icon: ClipboardList,
                badge: revenueStats.pendingCount || undefined,
              },
              { id: 'calendar', label: 'Calendar & Stock/Day', icon: CalendarIcon },
              { id: 'payments', label: 'Payments & Proofs', icon: CreditCard },
              { id: 'damages', label: 'Damage / Missing Log', icon: AlertTriangle },
              { id: 'customers', label: 'Customer Directory', icon: Users },
              { id: 'reports', label: 'Reports & CSV/PDF', icon: BarChart3 },
              { id: 'settings', label: 'App & Pricing Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as AdminTab)}
                  className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-amber-400 text-charcoal-900' : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-gray-800 space-y-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100 text-xs font-bold transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Live Customer Website</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-red-300 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-xl font-black text-gray-900 capitalize">
              {activeTab === 'inventory'
                ? 'Inventory Manager — Edit Items, Prices, Stock & Photos'
                : activeTab === 'settings'
                ? 'Business & App Settings — Deposit %, Fees & Accounts'
                : `${activeTab} Management`}
            </h1>
            <p className="text-xs text-gray-500">
              {settings.businessName} • Today is {todayStr}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                firebaseStatus.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
              title="Click to configure Firebase Cloud Firestore"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  firebaseStatus.connected ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span>
                {firebaseStatus.connected
                  ? `Firebase: ${firebaseStatus.projectId}`
                  : 'Firebase: Local Cache Mode (Click to Connect)'}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className="bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Quick Edit Inventory</span>
            </button>
            <button
              onClick={loadAllData}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-6 sm:p-8 space-y-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          {/* ================= 1. OVERVIEW DASHBOARD ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Quick Welcome Banner for Owner */}
              <div className="bg-gradient-to-r from-charcoal-900 via-emerald-950 to-emerald-800 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow border border-amber-400/20">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase text-amber-300">
                    Welcome, Owner! Everything is Editable Here
                  </div>
                  <h2 className="text-lg sm:text-xl font-black">
                    Want to replace sample prices, stock quantities, or upload your real photos?
                  </h2>
                  <p className="text-xs sm:text-sm text-warm-100/90 max-w-2xl leading-relaxed">
                    Click &ldquo;Edit Inventory & Prices&rdquo; to update chairs, tables, and packages in seconds, or &ldquo;App & Pricing Settings&rdquo; to adjust your deposit % and delivery fees.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-black text-xs px-5 py-3 rounded-xl shadow"
                  >
                    Edit Inventory & Prices →
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="bg-white/15 hover:bg-white/25 text-white font-bold text-xs px-5 py-3 rounded-xl"
                  >
                    Edit App Settings
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-1.5">
                  <div className="text-xs font-bold text-gray-500 uppercase">Total Booked Revenue</div>
                  <div className="text-2xl font-black text-gray-900">
                    ₱{revenueStats.totalBookedRevenue.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold">
                    Across {bookings.filter((b) => b.status !== 'Cancelled').length} active bookings
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-1.5">
                  <div className="text-xs font-bold text-gray-500 uppercase">Cash / GCash Collected</div>
                  <div className="text-2xl font-black text-emerald-700">
                    ₱{revenueStats.totalCollected.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-500">Verified deposits & full payments</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-1.5">
                  <div className="text-xs font-bold text-gray-500 uppercase">Collectible Balances</div>
                  <div className="text-2xl font-black text-amber-700">
                    ₱{revenueStats.totalReceivables.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-500">Due on delivery / pickup</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-1.5">
                  <div className="text-xs font-bold text-gray-500 uppercase">Today&apos;s Dispatch</div>
                  <div className="text-2xl font-black text-emerald-900">
                    {todaysDeliveries.length} Deliveries / {todaysPickups.length} Pickups
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold">
                    Scheduled for {todayStr}
                  </div>
                </div>
              </div>

              {/* Today's Deliveries & Pickups */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-700" />
                      <span>Today&apos;s Deliveries ({todaysDeliveries.length})</span>
                    </h3>
                    <span className="text-xs text-gray-400">{todayStr}</span>
                  </div>

                  {todaysDeliveries.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4">No deliveries scheduled for today.</p>
                  ) : (
                    <div className="space-y-3">
                      {todaysDeliveries.map((b) => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-emerald-950">
                              {b.eventTime} • {b.customerName} ({b.referenceNumber})
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                              {b.status}
                            </span>
                          </div>
                          <div className="text-gray-600">
                            📍 {b.barangay}, {b.venueAddress}, {b.municipality}
                          </div>
                          <div className="font-semibold text-gray-800">
                            Items: {b.items.map((i) => `${i.quantity}× ${i.itemName}`).join(', ')}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="font-bold text-amber-800">
                              Balance to Collect: ₱{b.balanceDue.toLocaleString()}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setPrintBooking(b);
                                  setPrintDocType('DELIVERY_SLIP');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white border border-gray-300 font-bold text-gray-700 hover:bg-gray-50"
                              >
                                Print Slip
                              </button>
                              <button
                                onClick={() => updateBookingStatus(b.id, 'In Use')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800"
                              >
                                Mark Delivered / In Use
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today's Pickups / Returns */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-wider text-amber-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span>Today&apos;s Pickups & Returns ({todaysPickups.length})</span>
                    </h3>
                    <span className="text-xs text-gray-400">{todayStr}</span>
                  </div>

                  {todaysPickups.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4">No pickups scheduled for today.</p>
                  ) : (
                    <div className="space-y-3">
                      {todaysPickups.map((b) => (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-gray-900">
                              {b.customerName} ({b.referenceNumber})
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold">
                              {b.status}
                            </span>
                          </div>
                          <div className="text-gray-600">
                            📍 {b.barangay}, {b.venueAddress}, {b.municipality}
                          </div>
                          <div className="font-semibold text-gray-800">
                            Count on Pickup: {b.items.map((i) => `${i.quantity}× ${i.itemName}`).join(', ')}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => updateBookingStatus(b.id, 'Returned')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800"
                            >
                              Mark Returned
                            </button>
                            <button
                              onClick={() => updateBookingStatus(b.id, 'Completed')}
                              className="px-2.5 py-1 rounded-lg bg-charcoal-900 text-white font-bold hover:bg-gray-800"
                            >
                              Complete Booking
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Notifications & Upcoming Bookings */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-wider text-gray-800 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-700" />
                      <span>Owner Notifications ({unreadNotifications} new)</span>
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 rounded-xl border text-xs ${
                          n.read
                            ? 'bg-gray-50 border-gray-200 text-gray-600'
                            : 'bg-emerald-50/70 border-emerald-200 text-gray-900'
                        }`}
                      >
                        <div className="font-bold">{n.title}</div>
                        <div className="text-gray-600 mt-0.5">{n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm uppercase tracking-wider text-gray-800">
                      Recent & Upcoming Bookings
                    </h3>
                    <button
                      onClick={() => setActiveTab('bookings')}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Manage All Bookings →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-gray-200 text-gray-500 uppercase">
                        <tr>
                          <th className="py-2">Ref #</th>
                          <th className="py-2">Customer</th>
                          <th className="py-2">Date</th>
                          <th className="py-2">Status</th>
                          <th className="py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bookings.slice(0, 6).map((b) => (
                          <tr key={b.id}>
                            <td className="py-2.5 font-bold text-emerald-900">{b.referenceNumber}</td>
                            <td className="py-2.5">
                              <div className="font-semibold text-gray-900">{b.customerName}</div>
                              <div className="text-[11px] text-gray-500">{b.eventType}</div>
                            </td>
                            <td className="py-2.5 font-medium">{b.eventDate}</td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold">
                              ₱{b.totalAmount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 2. INVENTORY EDITOR TAB ================= */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-gray-900">
                    Inventory Items, Bundles & Add-ons ({inventory.length})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Tip: You can type a new Price or Stock directly in the table below and click <strong>Save</strong>, or click <strong>Edit Full / Photo</strong> to upload a new photo or change descriptions.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsNewItemModal(true);
                    setEditingItem({
                      sku: `MMC-${Math.floor(100 + Math.random() * 900)}`,
                      name: '',
                      category: 'Chairs',
                      description: '',
                      pricePerDay: 20,
                      totalStock: 100,
                      replacementFee: 500,
                      unitLabel: 'per chair / day',
                      imageUrl:
                        'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80',
                      featured: true,
                      active: true,
                    });
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow flex items-center gap-1.5 self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Chair, Table, Package or Add-on</span>
                </button>
              </div>

              {/* Inventory Table with Inline Price & Stock Editing */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase">
                      <tr>
                        <th className="py-3 px-4">Photo & Item Name</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Price / Day (₱)</th>
                        <th className="py-3 px-3">Total Stock</th>
                        <th className="py-3 px-3">Quick Save</th>
                        <th className="py-3 px-4 text-right">Full Edit / Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {inventory.map((item) => {
                        const qe = quickEdits[item.id] || {
                          pricePerDay: item.pricePerDay,
                          totalStock: item.totalStock,
                        };
                        const isChanged =
                          Number(qe.pricePerDay) !== item.pricePerDay ||
                          Number(qe.totalStock) !== item.totalStock;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/80">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                                />
                                <div>
                                  <div className="font-extrabold text-sm text-gray-900">
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    SKU: {item.sku} • Replacement Fee: ₱{item.replacementFee}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 font-bold">
                                {item.category}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-gray-500">₱</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={qe.pricePerDay}
                                  onChange={(e) =>
                                    setQuickEdits((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...qe,
                                        pricePerDay: Number(e.target.value),
                                      },
                                    }))
                                  }
                                  className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 font-extrabold text-gray-900 focus:ring-2 focus:ring-emerald-600"
                                />
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <input
                                type="number"
                                min={0}
                                value={qe.totalStock}
                                onChange={(e) =>
                                  setQuickEdits((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...qe,
                                      totalStock: Number(e.target.value),
                                    },
                                  }))
                                }
                                className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 font-extrabold text-gray-900 focus:ring-2 focus:ring-emerald-600"
                              />
                            </td>

                            <td className="py-3 px-3">
                              <button
                                onClick={() => handleQuickSaveInventory(item.id)}
                                disabled={!isChanged}
                                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                                  isChanged
                                    ? 'bg-emerald-700 text-white shadow hover:bg-emerald-800'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save</span>
                              </button>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setIsNewItemModal(false);
                                    setEditingItem({ ...item });
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-bold text-gray-700 flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit Full / Photo</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id, item.name)}
                                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                  title="Delete Item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add / Edit Item Modal */}
              {editingItem && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                  <form
                    onSubmit={handleSaveFullItem}
                    className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-4 my-8"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <h3 className="text-lg font-black text-gray-900">
                        {isNewItemModal ? 'Add New Inventory Item / Package' : `Edit: ${editingItem.name}`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="text-gray-400 hover:text-gray-700 text-sm font-bold"
                      >
                        ✕ Close
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-gray-700 mb-1">Item / Bundle Name *</label>
                        <input
                          type="text"
                          required
                          value={editingItem.name || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Category *</label>
                        <select
                          value={editingItem.category || 'Chairs'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              category: e.target.value as InventoryCategory,
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="Chairs">Chairs</option>
                          <option value="Tables">Tables</option>
                          <option value="Packages">Packages</option>
                          <option value="Add-ons">Add-ons</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">SKU Code</label>
                        <input
                          type="text"
                          value={editingItem.sku || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Price Per Day (₱) *</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={editingItem.pricePerDay ?? 0}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, pricePerDay: Number(e.target.value) })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Total Stock Quantity *</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={editingItem.totalStock ?? 0}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, totalStock: Number(e.target.value) })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">
                          Damage / Loss Replacement Fee (₱)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingItem.replacementFee ?? 500}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              replacementFee: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">
                          Guest Capacity (For Packages/Tables)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g., 50"
                          value={editingItem.guestCapacity || ''}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              guestCapacity: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-gray-700 mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={editingItem.description || ''}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, description: e.target.value })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                        />
                      </div>

                      {/* Photo Upload OR Image URL */}
                      <div className="sm:col-span-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2">
                        <label className="block font-bold text-gray-800">
                          Item Photo (Upload from Phone/PC or Paste Image Link)
                        </label>
                        <div className="flex items-center gap-3">
                          {editingItem.imageUrl && (
                            <img
                              src={editingItem.imageUrl}
                              alt="Preview"
                              className="w-16 h-16 rounded-xl object-cover border border-gray-300 shrink-0"
                            />
                          )}
                          <div className="flex-1 space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleImageUpload(e, (dataUrl) =>
                                  setEditingItem({ ...editingItem, imageUrl: dataUrl })
                                )
                              }
                              className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:text-white file:font-bold"
                            />
                            <input
                              type="text"
                              placeholder="Or paste image URL (https://...)"
                              value={editingItem.imageUrl || ''}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, imageUrl: e.target.value })
                              }
                              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow"
                      >
                        Save Inventory Item
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ================= 3. BOOKINGS MANAGEMENT TAB ================= */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {['All', ...ALL_STATUSES].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        statusFilter === st
                          ? 'bg-emerald-700 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ref, customer, town..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-xs"
                  />
                </div>
              </div>

              {/* Bookings Cards List */}
              <div className="space-y-4">
                {filteredBookings.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-emerald-950">
                            {b.referenceNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
                            {b.status}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              b.paymentStatus === 'Fully Paid'
                                ? 'bg-emerald-700 text-white'
                                : b.paymentStatus === 'Deposit Paid'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {b.paymentStatus}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-gray-900 mt-1">
                          {b.customerName} • <span className="text-gray-600">{b.customerPhone}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {b.eventType} • Event: <strong>{b.eventDate}</strong> ({b.eventTime}) to{' '}
                          <strong>{b.returnDate}</strong> • 📍 {b.barangay}, {b.venueAddress},{' '}
                          {b.municipality}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-gray-900">
                          Total: ₱{b.totalAmount.toLocaleString()}
                        </div>
                        <div className="text-xs text-emerald-700 font-bold">
                          Paid: ₱{b.amountPaid.toLocaleString()} • Balance: ₱
                          {b.balanceDue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Booked Items Pill List */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {b.items.map((line) => (
                        <span
                          key={line.id}
                          className="px-3 py-1 rounded-lg bg-gray-100 text-gray-800 font-semibold"
                        >
                          {line.quantity}× {line.itemName} (₱{line.lineTotal.toLocaleString()})
                        </span>
                      ))}
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-500">Status Flow:</span>
                        <select
                          value={b.status}
                          onChange={(e) =>
                            updateBookingStatus(b.id, e.target.value as BookingStatus)
                          }
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 font-bold bg-white text-gray-900"
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>

                        <span className="font-bold text-gray-500 ml-2">Payment:</span>
                        <select
                          value={b.paymentStatus}
                          onChange={(e) =>
                            updateBookingPaymentStatus(b.id, e.target.value as PaymentStatus)
                          }
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 font-bold bg-white text-gray-900"
                        >
                          <option value="Unpaid">Unpaid</option>
                          <option value="Deposit Paid">Deposit Paid</option>
                          <option value="Fully Paid">Fully Paid</option>
                          <option value="Refunded">Refunded</option>
                        </select>

                        <button
                          onClick={() => {
                            setRescheduleBooking(b);
                            setNewEventDate(b.eventDate);
                            setNewReturnDate(b.returnDate);
                            setNewEventTime(b.eventTime);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold text-gray-700"
                        >
                          Reschedule
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setPrintBooking(b);
                            setPrintDocType('RECEIPT');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                        <button
                          onClick={() => {
                            setPrintBooking(b);
                            setPrintDocType('INVOICE');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 font-bold flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Invoice</span>
                        </button>
                        <button
                          onClick={() => {
                            setPrintBooking(b);
                            setPrintDocType('DELIVERY_SLIP');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-charcoal-900 text-white hover:bg-gray-800 font-bold flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Delivery Slip</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reschedule Modal */}
              {rescheduleBooking && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                  <form
                    onSubmit={handleRescheduleSubmit}
                    className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
                  >
                    <h3 className="font-black text-base text-gray-900">
                      Reschedule Booking {rescheduleBooking.referenceNumber}
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold mb-1">New Event Start Date</label>
                        <input
                          type="date"
                          required
                          value={newEventDate}
                          onChange={(e) => {
                            setNewEventDate(e.target.value);
                            if (newReturnDate < e.target.value) setNewReturnDate(e.target.value);
                          }}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">New Return Date</label>
                        <input
                          type="date"
                          required
                          min={newEventDate}
                          value={newReturnDate}
                          onChange={(e) => setNewReturnDate(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Event / Delivery Time</label>
                        <input
                          type="text"
                          value={newEventTime}
                          onChange={(e) => setNewEventTime(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setRescheduleBooking(null)}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold"
                      >
                        Verify Stock & Reschedule
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ================= 4. CALENDAR & STOCK PER DAY TAB ================= */}
          {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-base text-gray-900">
                    Monthly Booking & Stock Calendar
                  </h2>
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(e.target.value)}
                    className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-7 gap-2 text-xs">
                  {Object.values(calendarData).map((dayObj: any) => {
                    const isSelected = dayObj.date === selectedCalDate;
                    const hasBookings = dayObj.bookingsCount > 0;
                    return (
                      <button
                        key={dayObj.date}
                        onClick={() => setSelectedCalDate(dayObj.date)}
                        className={`p-2 rounded-xl border text-left transition min-h-[76px] flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600/30'
                            : hasBookings
                            ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-gray-900">
                            {dayObj.date.slice(-2)}
                          </span>
                          {hasBookings && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold">
                              {dayObj.bookingsCount}
                            </span>
                          )}
                        </div>
                        {hasBookings ? (
                          <div className="text-[10px] text-gray-600 leading-tight">
                            <div>{dayObj.chairsBooked} chairs</div>
                            <div>{dayObj.tablesBooked} tables</div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-700 font-medium">100% Free</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Stock & Events Inspector */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-700">
                    Daily Stock & Events Inspector
                  </span>
                  <h3 className="text-lg font-black text-gray-900">Date: {selectedCalDate}</h3>
                </div>

                {/* Bookings on Selected Date */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">
                    Scheduled Bookings on {selectedCalDate}
                  </div>
                  {(calendarData[selectedCalDate]?.bookings || []).length === 0 ? (
                    <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">
                      No bookings on this date. All inventory is 100% available.
                    </p>
                  ) : (
                    (calendarData[selectedCalDate]?.bookings || []).map((b: any) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex justify-between"
                      >
                        <div>
                          <div className="font-bold text-gray-900">
                            {b.referenceNumber} — {b.customerName}
                          </div>
                          <div className="text-gray-600">
                            {b.eventType} • {b.municipality}
                          </div>
                        </div>
                        <span className="font-bold text-emerald-800">{b.status}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Remaining Stock per Item on Selected Date */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="text-xs font-bold text-gray-500 uppercase">
                    Remaining Stock on {selectedCalDate}
                  </div>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {inventory.map((item) => {
                      const av = selectedDateAvail[item.id];
                      const rem = av ? av.remainingStock : item.totalStock;
                      const booked = av ? av.bookedQty : 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 border border-gray-200"
                        >
                          <span className="font-medium text-gray-800 truncate pr-2">
                            {item.name}
                          </span>
                          <div className="shrink-0 flex items-center gap-2">
                            {booked > 0 && (
                              <span className="text-amber-700 font-semibold">
                                {booked} booked
                              </span>
                            )}
                            <span className="font-black text-emerald-800">
                              {rem} / {item.totalStock} avail
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 5. PAYMENT TRACKING TAB ================= */}
          {activeTab === 'payments' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Record New Payment Form */}
              <form
                onSubmit={handleAddPayment}
                className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 self-start"
              >
                <h2 className="font-black text-base text-gray-900">
                  Record Deposit / Balance Payment
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Select Booking *</label>
                    <select
                      value={payBookingId}
                      onChange={(e) => setPayBookingId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                    >
                      {bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.referenceNumber} — {b.customerName} (Bal: ₱{b.balanceDue.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Amount Paid (₱) *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="e.g., 1000"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Payment Type</label>
                      <select
                        value={payType}
                        onChange={(e) => setPayType(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      >
                        <option value="Deposit">Deposit</option>
                        <option value="Balance">Balance</option>
                        <option value="Full Payment">Full Payment</option>
                        <option value="Damage Fee">Damage Fee</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                      >
                        <option value="GCash">GCash</option>
                        <option value="Maya">Maya</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Reference / OR No.</label>
                      <input
                        type="text"
                        placeholder="GCash / Bank Ref #"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Attach Proof of Payment Image (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setPayProofImg)}
                      className="w-full text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl text-xs shadow"
                >
                  Save Payment & Update Booking Balance
                </button>
              </form>

              {/* Payment Ledger */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <h2 className="font-black text-base text-gray-900">
                  Payment Ledger & Customer Uploaded Proofs
                </h2>

                <div className="space-y-3">
                  {bookings.flatMap((b) =>
                    b.payments.map((p) => ({ booking: b, payment: p }))
                  ).length === 0 ? (
                    <p className="text-xs text-gray-500">No payments logged yet.</p>
                  ) : (
                    bookings
                      .flatMap((b) => b.payments.map((p) => ({ booking: b, payment: p })))
                      .map(({ booking, payment }) => (
                        <div
                          key={payment.id}
                          className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-gray-900">
                              {booking.referenceNumber} — {booking.customerName}
                            </div>
                            <div className="text-gray-600">
                              ₱{payment.amount.toLocaleString()} via <strong>{payment.method}</strong> (
                              {payment.type}) • Ref: {payment.referenceNo || 'N/A'}
                            </div>
                            <div className="text-[11px] text-gray-400">Date: {payment.createdAt}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            {payment.proofImageUrl && (
                              <a
                                href={payment.proofImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold"
                              >
                                View Proof Image
                              </a>
                            )}
                            {payment.verifiedByAdmin ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                ✓ Verified
                              </span>
                            ) : (
                              <button
                                onClick={() => handleVerifyPayment(booking.id, payment.id)}
                                className="px-3 py-1.5 rounded-lg bg-amber-400 text-charcoal-900 font-black shadow"
                              >
                                Verify & Confirm Deposit
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= 6. DAMAGE / MISSING-ITEM LOG TAB ================= */}
          {activeTab === 'damages' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddDamage}
                className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 self-start"
              >
                <h2 className="font-black text-base text-gray-900">
                  Log Damaged, Stained, or Missing Item
                </h2>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Booking Reference *</label>
                    <select
                      value={dmgBookingId}
                      onChange={(e) => setDmgBookingId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white font-semibold"
                    >
                      {bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.referenceNumber} — {b.customerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Affected Item *</label>
                    <select
                      value={dmgItemName}
                      onChange={(e) => {
                        setDmgItemName(e.target.value);
                        const found = inventory.find((i) => i.name === e.target.value);
                        if (found) setDmgFee(found.replacementFee * dmgQty);
                      }}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white"
                    >
                      {inventory.map((i) => (
                        <option key={i.id} value={i.name}>
                          {i.name} (Std Replacement: ₱{i.replacementFee})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Issue Type</label>
                      <select
                        value={dmgIssueType}
                        onChange={(e) => setDmgIssueType(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-300 px-2 py-2 bg-white"
                      >
                        <option value="Damaged">Damaged</option>
                        <option value="Missing / Lost">Missing / Lost</option>
                        <option value="Stained / Torn">Stained / Torn</option>
                        <option value="Late Return">Late Return</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={dmgQty}
                        onChange={(e) => setDmgQty(Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Fee Charged (₱)</label>
                      <input
                        type="number"
                        min={0}
                        value={dmgFee}
                        onChange={(e) => setDmgFee(Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Inspection Notes</label>
                    <input
                      type="text"
                      placeholder="e.g., 2 monobloc chairs cracked during pickup count"
                      value={dmgNotes}
                      onChange={(e) => setDmgNotes(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl text-xs shadow"
                >
                  Log Incident & Add Fee to Booking Balance
                </button>
              </form>

              <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                <h2 className="font-black text-base text-gray-900">
                  Damage & Missing-Item Incident Log ({damageLogs.length})
                </h2>
                <div className="space-y-3">
                  {damageLogs.map((d) => (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-gray-900">
                          {d.referenceNumber} — {d.customerName}
                        </div>
                        <div className="text-red-700 font-semibold">
                          {d.quantity}× {d.itemName} ({d.issueType}) — Fee Charged: ₱
                          {d.feeCharged.toLocaleString()}
                        </div>
                        {d.notes && <div className="text-gray-600">Note: {d.notes}</div>}
                      </div>

                      <button
                        onClick={() => handleToggleDamageResolved(d.bookingId, d.id)}
                        className={`px-3 py-1.5 rounded-lg font-bold ${
                          d.resolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-400 text-charcoal-900'
                        }`}
                      >
                        {d.resolved ? '✓ Fee Settled' : 'Mark as Paid / Resolved'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= 7. CUSTOMERS DIRECTORY TAB ================= */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h2 className="font-black text-base text-gray-900">
                Customer Directory & Rental History ({customers.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customers.map((c) => {
                  const custBookings = bookings.filter(
                    (b) => b.customerId === c.id || b.customerPhone === c.phone
                  );
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-gray-200 bg-gray-50 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-black text-sm text-gray-900">{c.name}</div>
                          <div className="text-gray-600">
                            📞 {c.phone} {c.email ? `• ✉️ ${c.email}` : ''}
                          </div>
                          <div className="text-gray-500">📍 {c.address}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-emerald-800 text-sm">
                            ₱{c.totalSpent.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {custBookings.length} booking(s)
                          </div>
                        </div>
                      </div>

                      {custBookings.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 space-y-1">
                          <div className="font-bold text-gray-500 uppercase text-[10px]">
                            Rental History:
                          </div>
                          {custBookings.map((cb) => (
                            <div key={cb.id} className="flex justify-between text-[11px]">
                              <span>
                                <strong>{cb.referenceNumber}</strong> ({cb.eventType} on{' '}
                                {cb.eventDate})
                              </span>
                              <span className="font-bold text-emerald-800">
                                ₱{cb.totalAmount.toLocaleString()} ({cb.status})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= 8. REPORTS & CSV/PDF EXPORT TAB ================= */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-black text-base text-gray-900">
                    Financial Reports, Most-Rented Items & Exports
                  </h2>
                  <p className="text-xs text-gray-500">
                    Download spreadsheets or print a clean PDF summary for your bookkeeping.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportBookingsCsv}
                    className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Bookings CSV</span>
                  </button>
                  <button
                    onClick={exportInventoryCsv}
                    className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-xl"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Inventory CSV</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-charcoal-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Report PDF</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-black text-sm uppercase text-gray-700">
                    Most-Rented Items & Packages Leaderboard
                  </h3>
                  <div className="space-y-2.5">
                    {mostRentedItems.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                      >
                        <div>
                          <span className="font-black text-emerald-800 mr-2">#{idx + 1}</span>
                          <span className="font-bold text-gray-900">{m.name}</span>
                          <span className="ml-2 text-gray-500">({m.qtyBooked} units rented)</span>
                        </div>
                        <span className="font-black text-gray-900">
                          ₱{m.revenue.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-black text-sm uppercase text-gray-700">
                    Revenue Summary by Event Type
                  </h3>
                  <div className="space-y-2.5">
                    {Array.from(new Set(bookings.map((b) => b.eventType))).map((ev) => {
                      const evBookings = bookings.filter(
                        (b) => b.eventType === ev && b.status !== 'Cancelled'
                      );
                      const sum = evBookings.reduce((s, b) => s + b.totalAmount, 0);
                      return (
                        <div
                          key={ev}
                          className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                        >
                          <span className="font-bold text-gray-900">
                            {ev} ({evBookings.length} bookings)
                          </span>
                          <span className="font-black text-emerald-800">
                            ₱{sum.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 9. BUSINESS & APP SETTINGS TAB ================= */}
          {activeTab === 'settings' && (
            <div className="space-y-8 max-w-4xl">
              {/* Firebase Cloud Firestore Connection Panel */}
              <form
                onSubmit={handleConnectFirebase}
                className="bg-white rounded-2xl border-2 border-amber-300 p-6 sm:p-8 shadow-sm space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                      <span>🔥 Firebase Cloud Firestore Database</span>
                    </div>
                    <h2 className="font-black text-base sm:text-lg text-gray-900">
                      {firebaseStatus.connected
                        ? `Connected to Firebase Project: ${firebaseStatus.projectId}`
                        : 'Connect Your Firebase Firestore Project'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Paste your Firebase Web App credentials below (or in <code>.env.local</code>) to sync all inventory, bookings, customers, and settings directly with Google Firebase Cloud Firestore.
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      firebaseStatus.connected
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {firebaseStatus.connected ? '✓ Firestore Active' : 'Local Cache Fallback Active'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Firebase Project ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., mmc-set-n-seat-rentals"
                      value={fbProjectId}
                      onChange={(e) => setFbProjectId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Firebase Web API Key *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="AIzaSy..."
                      value={fbApiKey}
                      onChange={(e) => setFbApiKey(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Auth Domain (Optional — auto-filled from Project ID)
                    </label>
                    <input
                      type="text"
                      placeholder="your-project-id.firebaseapp.com"
                      value={fbAuthDomain}
                      onChange={(e) => setFbAuthDomain(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Firebase App ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="1:1234567890:web:abcdef..."
                      value={fbAppId}
                      onChange={(e) => setFbAppId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingFirebase}
                    className="bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-black text-xs px-5 py-3 rounded-xl shadow transition"
                  >
                    {savingFirebase
                      ? 'Connecting & Seeding Firestore...'
                      : 'Connect & Sync Data to Firebase Firestore'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleSaveSettings}
                className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6"
              >
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-base text-gray-900">
                    Business Details, Reservation Deposit % & Payment Accounts
                  </h2>
                  <p className="text-xs text-gray-500">
                    Any changes here update the live Customer Website & Quote Calculator immediately.
                  </p>
                </div>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save All Changes</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={settings.businessName}
                    onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Contact Phone Number</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Facebook Page URL</label>
                  <input
                    type="text"
                    value={settings.facebookUrl}
                    onChange={(e) => setSettings({ ...settings, facebookUrl: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </div>

                {/* Pricing & Deposit Rules */}
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">
                    Required Reservation Deposit (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.depositPercent}
                    onChange={(e) =>
                      setSettings({ ...settings, depositPercent: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border-2 border-emerald-500 px-3 py-2 font-black text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">
                    Default On-Site Setup Fee (₱)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settings.defaultSetupFee}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultSetupFee: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Free Delivery Minimum Order (₱)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settings.freeDeliveryMinOrder}
                    onChange={(e) =>
                      setSettings({ ...settings, freeDeliveryMinOrder: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    GCash / Maya Account Number
                  </label>
                  <input
                    type="text"
                    value={settings.gcashNumber}
                    onChange={(e) => setSettings({ ...settings, gcashNumber: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">
                    Bank Transfer Details (Displayed on Checkout & Invoices)
                  </label>
                  <input
                    type="text"
                    value={settings.bankDetails}
                    onChange={(e) => setSettings({ ...settings, bankDetails: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </div>

                {/* Admin Credentials */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Admin Username</label>
                  <input
                    type="text"
                    value={settings.adminUsername}
                    onChange={(e) => setSettings({ ...settings, adminUsername: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    New Admin Password (leave *** to keep current)
                  </label>
                  <input
                    type="text"
                    value={settings.adminPassword}
                    onChange={(e) => setSettings({ ...settings, adminPassword: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-6 py-3 rounded-xl shadow"
                >
                  Save Business & Pricing Settings
                </button>
              </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Printable Document Modal */}
      {printBooking && (
        <PrintableDocumentModal
          booking={printBooking}
          settings={settings}
          docType={printDocType}
          onClose={() => setPrintBooking(null)}
          onChangeDocType={setPrintDocType}
        />
      )}
    </div>
  );
}

