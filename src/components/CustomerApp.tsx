'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  Truck,
  ShieldCheck,
  Clock,
  Plus,
  Minus,
  Trash2,
  Search,
  Star,
  HelpCircle,
  FileText,
  ArrowRight,
  Printer,
  Upload,
  Facebook,
  AlertCircle,
  Users,
  Layers,
  ChevronRight,
  Lock,
  MessageCircle,
  Menu,
  X,
} from 'lucide-react';
import {
  BusinessSettings,
  InventoryItem,
  Booking,
  EventType,
  GalleryItem,
  ReviewItem,
  BookingStatus,
} from '@/lib/types';
import { ItemAvailability, apiFetch, getAssetPath } from '@/lib/client-api';
import FloatingChatButton from './FloatingChatButton';
import PrintableDocumentModal from './PrintableDocumentModal';

type CustomerTab =
  | 'home'
  | 'catalog'
  | 'packages'
  | 'book'
  | 'track'
  | 'gallery'
  | 'terms'
  | 'contact';

const EVENT_TYPES: EventType[] = [
  'Wedding',
  'Birthday',
  'Debut',
  'Fiesta',
  'Funeral / Wake',
  'Corporate Event',
  'School Function',
  'Baptism / Christening',
  'Other Gathering',
];

const STATUS_STEPS: BookingStatus[] = [
  'Pending',
  'Confirmed',
  'Out for Delivery',
  'In Use',
  'Returned',
  'Completed',
];

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CustomerApp() {
  const [activeTab, setActiveTab] = useState<CustomerTab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Server state
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [availability, setAvailability] = useState<Record<string, ItemAvailability>>({});
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected rental dates for live stock check
  const [eventDate, setEventDate] = useState<string>(getTodayStr());
  const [returnDate, setReturnDate] = useState<string>(getTodayStr());
  const [checkingStock, setCheckingStock] = useState(false);

  // Catalog filter
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart: itemId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({
    'pkg-50-pax': 1,
  });

  // Booking form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [eventType, setEventType] = useState<EventType>('Birthday');
  const [eventTime, setEventTime] = useState('08:00 AM');
  const [municipality, setMunicipality] = useState('Lemery (Proper / Poblacion)');
  const [barangay, setBarangay] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'Delivery' | 'Customer Pickup'>('Delivery');
  const [includeSetup, setIncludeSetup] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GCash' | 'Maya' | 'Bank Transfer'>('GCash');
  const [discountCode, setDiscountCode] = useState('');
  const [notes, setNotes] = useState('');
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');
  const [humanCheckAnswer, setHumanCheckAnswer] = useState('');
  const [paymentReferenceNo, setPaymentReferenceNo] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState<string>('');

  // Submission & Confirmation state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);

  // Track booking state
  const [trackRefInput, setTrackRefInput] = useState('MMC-2026-1001');
  const [trackedBooking, setTrackedBooking] = useState<Booking | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [lateProofRef, setLateProofRef] = useState('');
  const [lateProofImg, setLateProofImg] = useState('');
  const [lateProofAmount, setLateProofAmount] = useState('');

  // Print Modal
  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [printDocType, setPrintDocType] = useState<'RECEIPT' | 'INVOICE' | 'DELIVERY_SLIP'>('INVOICE');

  // Initial load
  useEffect(() => {
    fetchState(eventDate, returnDate);
  }, []);

  // Refresh live availability whenever dates change
  useEffect(() => {
    if (!loading) {
      fetchAvailabilityOnly(eventDate, returnDate);
    }
  }, [eventDate, returnDate]);

  async function fetchState(start: string, end: string) {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/state?startDate=${start}&endDate=${end}`);
      const data = await res.json();
      setSettings(data.settings);
      setInventory(data.inventory || []);
      setAvailability(data.availability || {});
      setGallery(data.gallery || []);
      setReviews(data.reviews || []);
      if (data.settings?.deliveryZones?.length > 0) {
        setMunicipality(data.settings.deliveryZones[0].municipality);
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailabilityOnly(start: string, end: string) {
    try {
      setCheckingStock(true);
      const effEnd = end >= start ? end : start;
      const res = await apiFetch(`/api/availability?startDate=${start}&endDate=${effEnd}`);
      const data = await res.json();
      if (data.availability) {
        setAvailability(data.availability);
      }
    } catch (e) {
      console.error('Failed to check stock:', e);
    } finally {
      setCheckingStock(false);
    }
  }

  // Rental days calculation
  const rentalDays = useMemo(() => {
    if (!eventDate || !returnDate || returnDate < eventDate) return 1;
    const s = new Date(eventDate + 'T00:00:00');
    const e = new Date(returnDate + 'T00:00:00');
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }, [eventDate, returnDate]);

  // Cart manipulation with live stock cap
  function updateCartQty(itemId: string, deltaOrExact: number, isExact = false) {
    const avail = availability[itemId]?.remainingStock ?? 999;
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = isExact ? deltaOrExact : current + deltaOrExact;
      const clamped = Math.max(0, Math.min(next, avail));
      const updated = { ...prev };
      if (clamped <= 0) {
        delete updated[itemId];
      } else {
        updated[itemId] = clamped;
      }
      return updated;
    });
  }

  // Cart items & Auto-Computed Quote
  const cartItemsDetailed = useMemo(() => {
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = inventory.find((i) => i.id === itemId);
        if (!item || quantity <= 0) return null;
        const maxStock = availability[itemId]?.remainingStock ?? item.totalStock;
        return {
          item,
          quantity,
          maxStock,
          lineTotal: item.pricePerDay * quantity * rentalDays,
        };
      })
      .filter(Boolean) as {
        item: InventoryItem;
        quantity: number;
        maxStock: number;
        lineTotal: number;
      }[];
  }, [cart, inventory, availability, rentalDays]);

  const totalCartUnits = useMemo(
    () => cartItemsDetailed.reduce((sum, x) => sum + x.quantity, 0),
    [cartItemsDetailed]
  );

  const quote = useMemo(() => {
    const subtotal = cartItemsDetailed.reduce((sum, x) => sum + x.lineTotal, 0);
    if (!settings) {
      return {
        subtotal,
        deliveryFee: 0,
        setupFee: 0,
        discountAmount: 0,
        appliedPromo: null,
        total: subtotal,
        depositRequired: Math.round(subtotal * 0.3),
      };
    }

    let deliveryFee = 0;
    if (fulfillmentType === 'Delivery' && subtotal > 0) {
      if (settings.freeDeliveryMinOrder > 0 && subtotal >= settings.freeDeliveryMinOrder) {
        deliveryFee = 0;
      } else {
        const zone = settings.deliveryZones.find((z) => z.municipality === municipality);
        deliveryFee = zone ? zone.fee : settings.defaultDeliveryFee;
      }
    }

    const setupFee = includeSetup && subtotal > 0 ? settings.defaultSetupFee : 0;

    let discountAmount = 0;
    let appliedPromo = null;
    if (discountCode.trim()) {
      const found = settings.promoCodes.find(
        (p) => p.active && p.code.toUpperCase() === discountCode.trim().toUpperCase()
      );
      if (found) {
        discountAmount = Math.round(subtotal * (found.discountPercent / 100));
        appliedPromo = found;
      }
    }

    const total = Math.max(0, subtotal + deliveryFee + setupFee - discountAmount);
    const depositRequired = Math.round(total * (settings.depositPercent / 100));

    return {
      subtotal,
      deliveryFee,
      setupFee,
      discountAmount,
      appliedPromo,
      total,
      depositRequired,
    };
  }, [cartItemsDetailed, settings, fulfillmentType, municipality, includeSetup, discountCode]);

  // Handle photo proof upload (converts to compact data URL)
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  // Submit Booking
  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (cartItemsDetailed.length === 0) {
      setFormError('Your booking list is empty. Please add chairs, tables, or a package first.');
      return;
    }

    if (humanCheckAnswer.trim() !== '7') {
      setFormError('Please answer the anti-spam check correctly (4 + 3 = 7).');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          eventType,
          eventDate,
          returnDate: returnDate >= eventDate ? returnDate : eventDate,
          eventTime,
          municipality,
          barangay,
          venueAddress,
          fulfillmentType,
          includeSetup,
          paymentMethod,
          discountCode,
          notes,
          websiteHoneypot,
          paymentReferenceNo,
          proofImageUrl,
          items: cartItemsDetailed.map((c) => ({
            itemId: c.item.id,
            quantity: c.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Could not complete booking. Please check item availability.');
        fetchAvailabilityOnly(eventDate, returnDate);
        return;
      }

      setConfirmedBooking(data.booking);
      setSmsPreview(data.notificationSimulated?.customerSms || null);
      setCart({});
      fetchAvailabilityOnly(eventDate, returnDate);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError('Network error while submitting booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Lookup booking by reference number
  async function handleTrackBooking(e?: React.FormEvent, customRef?: string) {
    if (e) e.preventDefault();
    const refToFind = (customRef || trackRefInput).trim();
    if (!refToFind) return;
    setTrackError(null);
    try {
      const res = await apiFetch(`/api/state?ref=${encodeURIComponent(refToFind)}`);
      const data = await res.json();
      if (!data.booking) {
        setTrackedBooking(null);
        setTrackError(`No booking found with reference "${refToFind}". Try MMC-2026-1001 or MMC-2026-1004.`);
      } else {
        setTrackedBooking(data.booking);
        setLateProofAmount(String(data.booking.depositRequired));
      }
    } catch {
      setTrackError('Error looking up booking.');
    }
  }

  async function handleUploadDepositOnTrackedBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!trackedBooking) return;
    try {
      setUploadingProof(true);
      const res = await apiFetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: trackedBooking.id,
          action: 'add_payment',
          amount: Number(lateProofAmount) || trackedBooking.depositRequired,
          type: 'Deposit',
          method: trackedBooking.paymentMethod || 'GCash',
          referenceNo: lateProofRef || 'Customer Portal Upload',
          proofImageUrl: lateProofImg,
          verifiedByAdmin: false,
        }),
      });
      const data = await res.json();
      if (data.booking) {
        setTrackedBooking(data.booking);
        setLateProofRef('');
        setLateProofImg('');
        alert('Payment proof submitted! Our team will verify and confirm your booking shortly.');
      }
    } finally {
      setUploadingProof(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="text-center space-y-3">
          <img
            src={getAssetPath('/logo.jpg')}
            alt="MMC Set n Seat Rentals Logo"
            className="w-20 h-20 rounded-full object-cover mx-auto shadow-lg border-2 border-emerald-700 animate-pulse"
          />
          <p className="text-sm font-bold text-emerald-900">
            Loading MMC Set n Seat Rentals...
          </p>
        </div>
      </div>
    );
  }

  const packagesList = inventory.filter((i) => i.active && i.category === 'Packages');
  const filteredCatalog = inventory.filter((item) => {
    if (!item.active) return false;
    if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
    if (
      searchQuery.trim() &&
      !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-warm-50 text-charcoal-900 pb-20 md:pb-0">
      {/* Top Announcement Bar */}
      <div className="bg-charcoal-900 text-warm-100 border-b border-amber-500/20 text-xs py-2.5 no-print">
        <div className="layout-container flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              Serving <strong>Lemery & Taal, Batangas</strong> (Free delivery on orders ₱
              {settings.freeDeliveryMinOrder.toLocaleString()}+)
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href={`tel:${settings.phone.replace(/\s+/g, '')}`} className="hover:text-white flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-semibold">{settings.phone}</span>
            </a>
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 hover:text-white"
            >
              <Facebook className="w-3.5 h-3.5 text-amber-300" />
              <span>{settings.messengerName}</span>
            </a>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Sticky Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-sm no-print">
        <div className="layout-container h-20 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <button
            onClick={() => {
              setConfirmedBooking(null);
              setActiveTab('home');
            }}
            className="flex items-center gap-3 text-left group"
          >
            <img
              src={getAssetPath('/logo.jpg')}
              alt="MMC Set n Seat Rentals Logo"
              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-700 shadow-md group-hover:scale-105 transition"
            />
            <div>
              <span className="block font-black text-base sm:text-lg text-emerald-800 leading-none tracking-tight">
                MMC Set n Seat Rentals
              </span>
              <span className="block text-[11px] font-bold text-charcoal-800 mt-0.5">
                Chairs • Tables • Tents • Videoke
              </span>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {[
              { id: 'home', label: 'Home' },
              { id: 'catalog', label: 'Chairs & Tables' },
              { id: 'packages', label: 'Party Packages' },
              { id: 'gallery', label: 'Gallery & Reviews' },
              { id: 'terms', label: 'FAQ & Terms' },
              { id: 'contact', label: 'Contact & Map' },
              { id: 'track', label: 'Track Booking' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setConfirmedBooking(null);
                  setActiveTab(tab.id as CustomerTab);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-gray-600 hover:text-emerald-800 hover:bg-gray-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Prominent Book Now CTA + Cart Badge */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setConfirmedBooking(null);
                setActiveTab('book');
              }}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Book Now</span>
              {totalCartUnits > 0 && (
                <span className="bg-amber-400 text-charcoal-900 font-black text-xs px-2 py-0.5 rounded-full">
                  {cartItemsDetailed.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 space-y-1">
            {[
              { id: 'home', label: 'Home' },
              { id: 'catalog', label: 'Catalog (Chairs, Tables & Tents)' },
              { id: 'packages', label: 'Packages (20, 50, 100, 150 Pax)' },
              { id: 'book', label: 'Book Now & Auto-Quote' },
              { id: 'track', label: 'Track Existing Booking' },
              { id: 'gallery', label: 'Past Events Gallery & Reviews' },
              { id: 'terms', label: 'Rental Terms & FAQ' },
              { id: 'contact', label: 'Contact & Lemery/Taal Map' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setConfirmedBooking(null);
                  setActiveTab(tab.id as CustomerTab);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold ${activeTab === tab.id
                  ? 'bg-emerald-700 text-white'
                  : 'text-gray-700 hover:bg-emerald-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 px-3">
              <span>Admin or Staff?</span>
              <Link href="/admin" className="text-emerald-700 font-bold underline">
                Go to Admin Dashboard →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* ================= HOME TAB ================= */}
        {activeTab === 'home' && (
          <div>
            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-charcoal-900 via-emerald-950 to-emerald-900 text-white overflow-hidden">
              <div
                className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-luminosity"
                style={{
                  backgroundImage:
                    'url("https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=80")',
                }}
              />
              <div className="relative layout-container section-spacing grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center gap-4">
                    <img
                      src={getAssetPath('/logo.jpg')}
                      alt="Set N Seat Rentals Official Logo"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-amber-300/80 shadow-2xl shrink-0"
                    />
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-amber-300/40 rounded-full px-3.5 py-1 text-xs font-semibold text-amber-200">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Lemery & Taal, Batangas</span>
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-amber-100/90">
                        Chairs • Tables • Tents • Videoke
                      </div>
                    </div>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
                    Complete <span className="text-amber-300">Sets & Seats</span> for Every Batangas Celebration.
                  </h1>

                  <p className="text-warm-100/90 text-sm sm:text-base max-w-2xl leading-relaxed">
                    Whether you&apos;re hosting a heritage wedding in <strong>Taal</strong>, a barangay fiesta or birthday in <strong>Lemery</strong>, a debut, school function, or a family wake—<strong>MMC Set n Seat Rentals</strong> delivers spotless, sturdy chairs, dressed banquet tables, and weatherproof canopy tents right on time.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <button
                      onClick={() => setActiveTab('book')}
                      className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-black px-6 py-3.5 rounded-xl text-sm sm:text-base shadow-xl transition transform hover:-translate-y-0.5"
                    >
                      <span>Book Now & Get Instant Quote</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTab('packages')}
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold px-6 py-3.5 rounded-xl text-sm sm:text-base transition"
                    >
                      <span>View 20–150 Pax Packages</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/15 text-xs sm:text-sm">
                    <div className="space-y-0.5">
                      <div className="font-black text-amber-300 text-lg sm:text-xl">100% Clean</div>
                      <div className="text-warm-200">Sanitized chairs & pressed linens</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-black text-amber-300 text-lg sm:text-xl">Live Stock</div>
                      <div className="text-warm-200">Real-time date availability</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-black text-amber-300 text-lg sm:text-xl">On-Time</div>
                      <div className="text-warm-200">Lemery & Taal doorstep delivery</div>
                    </div>
                  </div>
                </div>

                {/* Quick Live Availability & Quote Widget Card */}
                <div className="lg:col-span-5 bg-white text-charcoal-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-emerald-100 space-y-5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="space-y-0.5">
                      <h2 className="font-extrabold text-lg text-emerald-950">
                        Check Live Date Availability
                      </h2>
                      <p className="text-xs text-gray-500">
                        Select your event date to view real-time remaining stock
                      </p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full shrink-0">
                      Instant Quote
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Event Start Date
                      </label>
                      <input
                        type="date"
                        min={getTodayStr()}
                        value={eventDate}
                        onChange={(e) => {
                          setEventDate(e.target.value);
                          if (returnDate < e.target.value) setReturnDate(e.target.value);
                        }}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Return / Pickup Date
                      </label>
                      <input
                        type="date"
                        min={eventDate}
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Live Stock Snapshot for Selected Date */}
                  <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                      <span>Available Stock for {eventDate}:</span>
                      {checkingStock && <span className="text-emerald-600 animate-pulse">Updating...</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      {inventory.slice(0, 4).map((item) => {
                        const rem = availability[item.id]?.remainingStock ?? item.totalStock;
                        return (
                          <div
                            key={item.id}
                            className="bg-white rounded-lg px-3 py-2 border border-emerald-100 flex items-center justify-between gap-2"
                          >
                            <span className="truncate font-medium text-gray-700">
                              {item.name.split('(')[0]}
                            </span>
                            <span
                              className={`font-black shrink-0 ${rem > 0 ? 'text-emerald-700' : 'text-red-600'
                                }`}
                            >
                              {rem} left
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={() => setActiveTab('catalog')}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-4 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2"
                    >
                      <span>Browse Available Chairs, Tables & Packages</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActiveTab('book')}
                      className="w-full bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-extrabold py-3 px-4 rounded-xl text-xs transition"
                    >
                      Proceed Directly to Booking Form ({totalCartUnits} items selected)
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Occasions We Serve Banner */}
            <section className="bg-white border-b border-gray-200 py-8">
              <div className="layout-container space-y-4">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Sets & Seats Tailored For Every Event in Lemery & Taal
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                  {EVENT_TYPES.map((ev) => (
                    <button
                      key={ev}
                      onClick={() => {
                        setEventType(ev);
                        setActiveTab('packages');
                      }}
                      className="px-4 py-2 rounded-full bg-warm-100 hover:bg-emerald-100 text-charcoal-800 hover:text-emerald-900 text-xs font-semibold transition border border-warm-200"
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Featured Packages Section */}
            <section className="layout-container section-spacing">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-10 gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                    All-In Guest Bundles
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-charcoal-900">
                    Popular Party & Event Packages
                  </h2>
                  <p className="text-sm text-gray-600">
                    Save more with ready-made table and chair bundles for 20, 50, 100, or 150 guests.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="text-sm font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 shrink-0"
                >
                  <span>View Individual Chairs, Tables & Tents</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {packagesList.map((pkg) => {
                  const avail = availability[pkg.id]?.remainingStock ?? pkg.totalStock;
                  const inCart = cart[pkg.id] || 0;
                  return (
                    <div
                      key={pkg.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition flex flex-col overflow-hidden"
                    >
                      <div className="relative h-48 bg-gray-100">
                        <img
                          src={pkg.imageUrl}
                          alt={pkg.name}
                          className="w-full h-full object-cover"
                        />
                        {pkg.guestCapacity && (
                          <span className="absolute top-3.5 left-3.5 bg-emerald-900/90 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            Good for {pkg.guestCapacity} Pax
                          </span>
                        )}
                        <span
                          className={`absolute bottom-3.5 right-3.5 text-xs font-bold px-3 py-1 rounded-full shadow ${avail > 0
                            ? 'bg-white/95 text-emerald-800'
                            : 'bg-red-600 text-white'
                            }`}
                        >
                          {avail > 0 ? `${avail} sets available` : 'Fully Booked on Date'}
                        </span>
                      </div>

                      <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                        <div className="space-y-3">
                          <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                            {pkg.name}
                          </h3>
                          <p className="text-xs text-gray-600 leading-relaxed">{pkg.description}</p>
                          {pkg.includedItems && pkg.includedItems.length > 0 && (
                            <ul className="text-xs text-emerald-900 bg-emerald-50/70 rounded-xl p-3 space-y-1.5">
                              {pkg.includedItems.map((inc, idx) => (
                                <li key={idx} className="flex items-center gap-2 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>
                                    <strong>{inc.quantity}×</strong> {inc.label}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3.5">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <span className="text-2xl font-black text-emerald-800">
                                ₱{pkg.pricePerDay.toLocaleString()}
                              </span>
                              <span className="text-xs text-gray-500 ml-1">/ day</span>
                            </div>
                            {inCart > 0 && (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                                {inCart} in booking
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              disabled={avail <= 0}
                              onClick={() => updateCartQty(pkg.id, 1)}
                              className="py-2.5 px-3 rounded-xl border border-emerald-700 text-emerald-800 hover:bg-emerald-50 font-bold text-xs transition disabled:opacity-40"
                            >
                              + Add to List
                            </button>
                            <button
                              disabled={avail <= 0}
                              onClick={() => {
                                if (!cart[pkg.id]) updateCartQty(pkg.id, 1);
                                setActiveTab('book');
                              }}
                              className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow disabled:opacity-40"
                            >
                              Book Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Why Choose MMC Set n Seat Rentals */}
            <section className="bg-gradient-to-b from-charcoal-900 to-emerald-950 text-white section-spacing border-t border-amber-500/20">
              <div className="layout-container">
                <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                    Dependable Local Service
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black">
                    Why Batangas Families & Event Organizers Choose Us
                  </h2>
                  <p className="text-warm-200 text-sm">
                    Hassle-free reservations, transparent pricing, and dependable crew service across Lemery and Taal.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-3 backdrop-blur-sm">
                    <div className="w-11 h-11 rounded-xl bg-amber-400 text-charcoal-900 flex items-center justify-center shadow">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg text-amber-100">Clean, Heavy-Duty Inventory</h3>
                    <p className="text-xs sm:text-sm text-warm-100/85 leading-relaxed">
                      Every monobloc chair, Tiffany chair cushion, and floor-length tablecloth is washed, sanitized, and inspected before loading onto our delivery truck.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-3 backdrop-blur-sm">
                    <div className="w-11 h-11 rounded-xl bg-amber-400 text-charcoal-900 flex items-center justify-center shadow">
                      <Truck className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg text-amber-100">Fast Delivery in Lemery & Taal</h3>
                    <p className="text-xs sm:text-sm text-warm-100/85 leading-relaxed">
                      Whether it&apos;s Poblacion Taal, Sambal Lemery, or an outer barangay covered court, our local crew knows every route and arrives ahead of your event schedule.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-3 backdrop-blur-sm">
                    <div className="w-11 h-11 rounded-xl bg-amber-400 text-charcoal-900 flex items-center justify-center shadow">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg text-amber-100">Flexible Payment & Easy Booking</h3>
                    <p className="text-xs sm:text-sm text-warm-100/85 leading-relaxed">
                      Reserve your date online with just a {settings.depositPercent}% deposit via GCash, Maya, Bank Transfer, or Cash at our depot. Zero double-bookings guaranteed!
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= CATALOG TAB ================= */}
        {activeTab === 'catalog' && (
          <div className="tab-container">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  Live Inventory & Pricing
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                  Rental Catalog — Chairs, Tables, Packages & Add-ons
                </h1>
                <p className="text-sm text-gray-600">
                  Stock numbers update automatically for your selected rental dates.
                </p>
              </div>

              {/* Date Picker Bar */}
              <div className="bg-white px-4 py-3.5 rounded-2xl border border-emerald-200 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-gray-700">Event Date:</span>
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={eventDate}
                    onChange={(e) => {
                      setEventDate(e.target.value);
                      if (returnDate < e.target.value) setReturnDate(e.target.value);
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Return:</span>
                  <input
                    type="date"
                    min={eventDate}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Category Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {['All', 'Chairs', 'Tables', 'Packages', 'Add-ons'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${selectedCategory === cat
                      ? 'bg-emerald-700 text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search chairs, tables, tents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredCatalog.map((item) => {
                const avail = availability[item.id]?.remainingStock ?? item.totalStock;
                const qtyInCart = cart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition flex flex-col"
                  >
                    <div className="relative h-56 bg-gray-100">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3.5 left-3.5 bg-charcoal-900/85 text-white text-[11px] font-bold px-3 py-1 rounded-lg">
                        {item.category}
                      </span>
                      <span
                        className={`absolute bottom-3.5 right-3.5 text-xs font-extrabold px-3 py-1 rounded-full shadow ${avail > 0
                          ? 'bg-emerald-900 text-white'
                          : 'bg-red-600 text-white'
                          }`}
                      >
                        {avail > 0 ? `${avail} available on ${eventDate}` : 'Booked Out on Date'}
                      </span>
                    </div>

                    <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                      <div className="space-y-2">
                        <h3 className="font-extrabold text-base text-gray-900">{item.name}</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-gray-100 space-y-4">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-2xl font-black text-emerald-800">
                              ₱{item.pricePerDay.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">{item.unitLabel}</span>
                          </div>
                          <span className="text-[11px] text-gray-400">
                            Total Stock: {item.totalStock}
                          </span>
                        </div>

                        {qtyInCart > 0 ? (
                          <div className="flex items-center justify-between gap-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => updateCartQty(item.id, -1)}
                                className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 font-bold"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={avail}
                                value={qtyInCart}
                                onChange={(e) =>
                                  updateCartQty(item.id, parseInt(e.target.value, 10) || 0, true)
                                }
                                className="w-16 text-center font-extrabold text-sm bg-white border border-gray-300 rounded-lg py-1"
                              />
                              <button
                                disabled={qtyInCart >= avail}
                                onClick={() => updateCartQty(item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100 font-bold disabled:opacity-40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => setActiveTab('book')}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition"
                            >
                              Checkout →
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={avail <= 0}
                            onClick={() => updateCartQty(item.id, item.category === 'Chairs' ? 10 : 1)}
                            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white font-bold text-xs sm:text-sm transition shadow flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            <span>
                              {avail > 0
                                ? `Add to Booking ${item.category === 'Chairs' ? '(+10)' : '(+1)'}`
                                : 'Unavailable for Selected Date'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= PACKAGES TAB ================= */}
        {activeTab === 'packages' && (
          <div className="tab-container">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                Bundles by Guest Count
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-gray-900">
                Complete Table & Chair Packages (20 to 150+ Pax)
              </h1>
              <p className="text-sm text-gray-600">
                Pick the bundle that matches your guest list. Need extra chairs, tables, or canopy tents? You can customize quantities on the next step!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {packagesList.map((pkg) => {
                const avail = availability[pkg.id]?.remainingStock ?? pkg.totalStock;
                return (
                  <div
                    key={pkg.id}
                    className="bg-white rounded-2xl border-2 border-emerald-100 hover:border-emerald-600 transition shadow-sm overflow-hidden flex flex-col sm:flex-row"
                  >
                    <div className="sm:w-2/5 relative h-56 sm:h-auto bg-gray-100">
                      <img
                        src={pkg.imageUrl}
                        alt={pkg.name}
                        className="w-full h-full object-cover"
                      />
                      {pkg.guestCapacity && (
                        <div className="absolute top-3.5 left-3.5 bg-emerald-900 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow">
                          {pkg.guestCapacity} PAX BUNDLE
                        </div>
                      )}
                    </div>

                    <div className="sm:w-3/5 p-6 sm:p-7 flex flex-col justify-between gap-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-700 uppercase">
                            {pkg.sku}
                          </span>
                          <span className="text-xs font-semibold text-gray-500">
                            {avail} sets available on {eventDate}
                          </span>
                        </div>
                        <h2 className="text-lg font-black text-gray-900 leading-snug">{pkg.name}</h2>
                        <p className="text-xs text-gray-600 leading-relaxed">{pkg.description}</p>

                        {pkg.includedItems && (
                          <div className="pt-2 space-y-1.5">
                            <div className="text-[11px] font-bold uppercase text-gray-400">
                              Package Inclusions:
                            </div>
                            {pkg.includedItems.map((inc, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-xs font-semibold text-gray-800"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  {inc.quantity} × {inc.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-2xl font-black text-emerald-800">
                            ₱{pkg.pricePerDay.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-gray-500">per day rental</div>
                        </div>

                        <button
                          disabled={avail <= 0}
                          onClick={() => {
                            updateCartQty(pkg.id, 1, true);
                            setActiveTab('book');
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl shadow transition flex items-center gap-1.5"
                        >
                          <span>Select & Book</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= BOOKING FORM & CONFIRMATION TAB ================= */}
        {activeTab === 'book' && (
          <div className="tab-container">
            {confirmedBooking ? (
              /* BOOKING CONFIRMATION VIEW */
              <div className="max-w-3xl mx-auto bg-white rounded-3xl border-2 border-emerald-600 shadow-xl overflow-hidden">
                <div className="bg-emerald-800 text-white p-6 sm:p-8 text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2 shadow-lg">
                    <CheckCircle2 className="w-8 h-8 text-amber-300" />
                  </div>
                  <span className="text-xs uppercase tracking-widest font-bold text-emerald-200">
                    Booking Request Received
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black">
                    Thank You, {confirmedBooking.customerName}!
                  </h1>
                  <p className="text-sm text-emerald-100">
                    Your booking reference number is:
                  </p>
                  <div className="inline-block bg-white text-emerald-950 font-black text-xl sm:text-2xl px-6 py-2.5 rounded-2xl shadow-md tracking-wider mt-2">
                    {confirmedBooking.referenceNumber}
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Status Flow Progress Bar */}
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-500 mb-3">
                      Live Booking Status Flow
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {STATUS_STEPS.map((step, index) => {
                        const isCurrent = step === confirmedBooking.status;
                        const isPassed = index === 0;
                        return (
                          <div
                            key={step}
                            className={`p-2 rounded-xl border text-center text-[11px] font-bold ${isCurrent
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow'
                              : isPassed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200'
                              }`}
                          >
                            <div>{index + 1}. {step}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SMS / Email Confirmation Preview */}
                  {smsPreview && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-1.5">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-emerald-700" />
                        <span>Automated SMS & Email Confirmation Dispatched:</span>
                      </div>
                      <p className="text-emerald-800 font-mono bg-white p-3 rounded-xl border border-emerald-100">
                        {smsPreview}
                      </p>
                    </div>
                  )}

                  {/* Reservation Deposit Instructions */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2 text-xs sm:text-sm">
                    <div className="font-extrabold text-amber-950 text-base">
                      Next Step: Settle Your {settings.depositPercent}% Reservation Deposit (₱
                      {confirmedBooking.depositRequired.toLocaleString()})
                    </div>
                    <p className="text-amber-900">
                      To lock in your items for <strong>{confirmedBooking.eventDate}</strong> and move your status from <strong>Pending</strong> to <strong>Confirmed</strong>, please send the deposit via your chosen payment method:
                    </p>
                    <div className="bg-white rounded-xl p-3 border border-amber-200 space-y-1 text-xs">
                      <div>
                        <strong>GCash / Maya:</strong> {settings.gcashNumber} ({settings.gcashAccountName})
                      </div>
                      <div>
                        <strong>Bank Transfer:</strong> {settings.bankDetails}
                      </div>
                      <div>
                        <strong>Cash:</strong> Visit our Lemery office or coordinate via phone ({settings.phone})
                      </div>
                    </div>
                  </div>

                  {/* Summary Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setPrintBooking(confirmedBooking);
                          setPrintDocType('INVOICE');
                        }}
                        className="flex items-center gap-2 bg-charcoal-900 hover:bg-gray-800 text-white font-bold text-xs px-4 py-3 rounded-xl transition"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Official Quote / Invoice</span>
                      </button>

                      <a
                        href={settings.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-3 rounded-xl transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Send Ref #{confirmedBooking.referenceNumber} on Messenger</span>
                      </a>
                    </div>

                    <button
                      onClick={() => {
                        setTrackRefInput(confirmedBooking.referenceNumber);
                        setTrackedBooking(confirmedBooking);
                        setConfirmedBooking(null);
                        setActiveTab('track');
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Go to Booking Tracker →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* INTERACTIVE BOOKING FORM & AUTO-QUOTE */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <form
                  onSubmit={handleBookingSubmit}
                  className="lg:col-span-7 bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6"
                >
                  <div className="border-b border-gray-100 pb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                      Online Reservation & Instant Quote
                    </span>
                    <h1 className="text-2xl font-black text-gray-900 mt-1">
                      Complete Your Event Booking
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Server-side live stock check prevents double-booking for your chosen dates.
                    </p>
                  </div>

                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-semibold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Step 1: Event Schedule */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs flex items-center justify-center">
                        1
                      </span>
                      <span>Event Date & Time</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Event Start Date *
                        </label>
                        <input
                          type="date"
                          required
                          min={getTodayStr()}
                          value={eventDate}
                          onChange={(e) => {
                            setEventDate(e.target.value);
                            if (returnDate < e.target.value) setReturnDate(e.target.value);
                          }}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Return / Pickup Date *
                        </label>
                        <input
                          type="date"
                          required
                          min={eventDate}
                          value={returnDate}
                          onChange={(e) => setReturnDate(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Delivery / Event Time *
                        </label>
                        <select
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium bg-white"
                        >
                          {[
                            '06:00 AM',
                            '07:00 AM',
                            '08:00 AM',
                            '09:00 AM',
                            '10:00 AM',
                            '01:00 PM',
                            '02:00 PM',
                            '04:00 PM',
                            '05:00 PM',
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Items & Quantities */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs flex items-center justify-center">
                          2
                        </span>
                        <span>Selected Chairs, Tables & Packages</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('catalog')}
                        className="text-xs font-bold text-emerald-700 hover:underline"
                      >
                        + Add More Items from Catalog
                      </button>
                    </div>

                    {cartItemsDetailed.length === 0 ? (
                      <div className="bg-warm-100 border border-warm-200 rounded-2xl p-6 text-center space-y-3">
                        <p className="text-xs text-gray-600">
                          No rental items selected yet. Choose from our quick-add buttons below or browse the full catalog:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {inventory.slice(0, 5).map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() =>
                                updateCartQty(item.id, item.category === 'Chairs' ? 20 : 1)
                              }
                              className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 text-xs font-bold text-emerald-900"
                            >
                              + {item.name.split('(')[0]} (₱{item.pricePerDay})
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cartItemsDetailed.map(({ item, quantity, maxStock, lineTotal }) => (
                          <div
                            key={item.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200"
                          >
                            <div className="flex-1">
                              <div className="font-bold text-xs sm:text-sm text-gray-900">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                ₱{item.pricePerDay.toLocaleString()}/day × {rentalDays}d •{' '}
                                <span className="text-emerald-700 font-semibold">
                                  {maxStock} max available on {eventDate}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, -1)}
                                  className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={maxStock}
                                  value={quantity}
                                  onChange={(e) =>
                                    updateCartQty(
                                      item.id,
                                      parseInt(e.target.value, 10) || 0,
                                      true
                                    )
                                  }
                                  className="w-14 text-center font-bold text-xs py-1 rounded-lg border border-gray-300 bg-white"
                                />
                                <button
                                  type="button"
                                  disabled={quantity >= maxStock}
                                  onClick={() => updateCartQty(item.id, 1)}
                                  className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center disabled:opacity-40"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="w-20 text-right font-extrabold text-xs sm:text-sm text-emerald-900">
                                ₱{lineTotal.toLocaleString()}
                              </div>

                              <button
                                type="button"
                                onClick={() => updateCartQty(item.id, 0, true)}
                                className="text-gray-400 hover:text-red-600 p-1"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Quick Add Dropdown */}
                        <div className="pt-2">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const inv = inventory.find((i) => i.id === e.target.value);
                                updateCartQty(
                                  e.target.value,
                                  inv?.category === 'Chairs' ? 10 : 1
                                );
                                e.target.value = '';
                              }
                            }}
                            className="w-full rounded-xl border border-dashed border-emerald-400 bg-emerald-50/40 px-3 py-2 text-xs font-bold text-emerald-900"
                          >
                            <option value="">+ Quick-add another item or add-on (tablecloths, tents, chairs)...</option>
                            {inventory
                              .filter((i) => i.active)
                              .map((i) => {
                                const rem = availability[i.id]?.remainingStock ?? i.totalStock;
                                return (
                                  <option key={i.id} value={i.id} disabled={rem <= 0}>
                                    {i.name} — ₱{i.pricePerDay}/day ({rem} avail)
                                  </option>
                                );
                              })}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Customer & Event Details */}
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs flex items-center justify-center">
                        3
                      </span>
                      <span>Customer & Event Venue Details</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Full Name / Contact Person *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Juan Dela Cruz"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Mobile Number (for SMS Confirmation) *
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g., 0917 123 4567"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Email Address (for Quote & Receipt)
                        </label>
                        <input
                          type="email"
                          placeholder="you@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Event Type *
                        </label>
                        <select
                          value={eventType}
                          onChange={(e) => setEventType(e.target.value as EventType)}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm bg-white"
                        >
                          {EVENT_TYPES.map((ev) => (
                            <option key={ev} value={ev}>
                              {ev}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Fulfillment & Service Area */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('Delivery')}
                        className={`p-3 rounded-xl border text-left transition ${fulfillmentType === 'Delivery'
                          ? 'border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-600/20'
                          : 'border-gray-200 bg-white'
                          }`}
                      >
                        <div className="font-bold text-xs sm:text-sm text-gray-900">
                          🚚 Truck Delivery & Pickup
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Delivered to your venue in Lemery, Taal, or nearby town
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFulfillmentType('Customer Pickup');
                          setIncludeSetup(false);
                        }}
                        className={`p-3 rounded-xl border text-left transition ${fulfillmentType === 'Customer Pickup'
                          ? 'border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-600/20'
                          : 'border-gray-200 bg-white'
                          }`}
                      >
                        <div className="font-bold text-xs sm:text-sm text-gray-900">
                          🏪 Customer Pickup at Depot (₱0 Fee)
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Pick up & return at our Lemery depot
                        </div>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Municipality / Delivery Zone *
                        </label>
                        <select
                          value={municipality}
                          onChange={(e) => setMunicipality(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm bg-white"
                        >
                          {settings.deliveryZones.map((z) => (
                            <option key={z.municipality} value={z.municipality}>
                              {z.municipality} (₱{z.fee} delivery)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Barangay *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Brgy. Sambal Ilaya / Zone 3"
                          value={barangay}
                          onChange={(e) => setBarangay(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Complete Venue Address & Landmark *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="House No., Street, Subdivision / Covered Court / Event Hall & nearest landmark"
                        value={venueAddress}
                        onChange={(e) => setVenueAddress(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-warm-100 border border-warm-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSetup}
                        onChange={(e) => setIncludeSetup(e.target.checked)}
                        className="mt-1 rounded text-emerald-700 focus:ring-emerald-600"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-gray-900">
                          Include Full On-Site Setup & Takedown (+₱{settings.defaultSetupFee})
                        </span>
                        <p className="text-gray-600 mt-0.5">
                          Our crew will position all tables, dress the linens/runners, and arrange all chairs according to your floor plan.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Step 4: Payment Method & Proof */}
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs flex items-center justify-center">
                        4
                      </span>
                      <span>Payment Method & Optional Deposit Upload</span>
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['GCash', 'Maya', 'Bank Transfer', 'Cash'] as const).map((method) => (
                        <button
                          type="button"
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition ${paymentMethod === method
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>

                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-1">
                      <div className="font-bold text-emerald-950">
                        Account Details for {paymentMethod}:
                      </div>
                      {paymentMethod === 'GCash' || paymentMethod === 'Maya' ? (
                        <p className="text-emerald-900">
                          Send <strong>₱{quote.depositRequired.toLocaleString()}</strong> ({settings.depositPercent}% reservation deposit) to{' '}
                          <strong>{settings.gcashNumber}</strong> ({settings.gcashAccountName}).
                        </p>
                      ) : paymentMethod === 'Bank Transfer' ? (
                        <p className="text-emerald-900">{settings.bankDetails}</p>
                      ) : (
                        <p className="text-emerald-900">
                          Pay the {settings.depositPercent}% deposit in cash at our Lemery office or coordinate with our dispatcher at {settings.phone}.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Payment Reference No. (Optional if paying later)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., GCash Ref #90123456"
                          value={paymentReferenceNo}
                          onChange={(e) => setPaymentReferenceNo(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Upload Proof of Payment Screenshot (Optional)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, setProofImageUrl)}
                          className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Special Notes / Ribbon Motif Color / Delivery Instructions
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g., Emerald green & gold motif ribbons, deliver before 7:30 AM..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs"
                      />
                    </div>

                    {/* Honeypot (Hidden) & Anti-Spam Check */}
                    <input
                      type="text"
                      name="websiteHoneypot"
                      value={websiteHoneypot}
                      onChange={(e) => setWebsiteHoneypot(e.target.value)}
                      className="hidden"
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <label className="text-xs font-bold text-gray-700">
                        Spam Check: What is 4 + 3? *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Answer"
                        value={humanCheckAnswer}
                        onChange={(e) => setHumanCheckAnswer(e.target.value)}
                        className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || cartItemsDetailed.length === 0}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl text-base shadow-xl transition"
                  >
                    {submitting
                      ? 'Verifying Stock & Creating Booking...'
                      : `Confirm Booking Request • Total ₱${quote.total.toLocaleString()}`}
                  </button>
                </form>

                {/* Live Auto-Computed Quote Sticky Sidebar */}
                <div className="lg:col-span-5 lg:sticky lg:top-24 bg-white rounded-3xl border-2 border-emerald-700 shadow-xl overflow-hidden">
                  <div className="bg-emerald-900 text-white px-6 py-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Auto-Computed Rental Quote
                    </div>
                    <div className="text-lg font-extrabold mt-0.5">
                      {eventDate} {returnDate > eventDate ? `to ${returnDate}` : ''} ({rentalDays}{' '}
                      {rentalDays > 1 ? 'Days' : 'Day'})
                    </div>
                  </div>

                  <div className="p-6 space-y-4 text-xs sm:text-sm">
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {cartItemsDetailed.map(({ item, quantity, lineTotal }) => (
                        <div key={item.id} className="flex justify-between items-start">
                          <div className="text-gray-700">
                            <span className="font-bold text-gray-900">{quantity}×</span> {item.name}
                            <div className="text-[11px] text-gray-400">
                              ₱{item.pricePerDay}/day × {rentalDays}d
                            </div>
                          </div>
                          <span className="font-bold text-gray-900">
                            ₱{lineTotal.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Promo Code Input */}
                    <div className="pt-3 border-t border-gray-100">
                      <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                        Promo / Discount Code (Try: BATANGAS5 or FIESTA10)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter promo code"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          className="flex-1 rounded-xl border border-gray-300 px-3 py-1.5 text-xs uppercase font-bold"
                        />
                      </div>
                      {quote.appliedPromo && (
                        <p className="text-[11px] text-emerald-700 font-bold mt-1">
                          ✓ Applied {quote.appliedPromo.code}: {quote.appliedPromo.description}
                        </p>
                      )}
                    </div>

                    {/* Formula Breakdown */}
                    <div className="space-y-2 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-gray-600">
                        <span>Items × {rentalDays} Day(s):</span>
                        <span className="font-semibold">₱{quote.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>
                          Delivery & Pickup ({fulfillmentType === 'Delivery' ? municipality.split(' ')[0] : 'Pickup'}):
                        </span>
                        <span className="font-semibold">
                          {quote.deliveryFee === 0 && fulfillmentType === 'Delivery' && quote.subtotal > 0
                            ? 'FREE'
                            : `₱${quote.deliveryFee.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Setup & Takedown Fee:</span>
                        <span className="font-semibold">₱{quote.setupFee.toLocaleString()}</span>
                      </div>
                      {quote.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-semibold">
                          <span>Discount ({quote.appliedPromo?.code}):</span>
                          <span>-₱{quote.discountAmount.toLocaleString()}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-lg font-black text-gray-900 pt-3 border-t-2 border-gray-200">
                        <span>Total Rental Quote:</span>
                        <span className="text-emerald-800">₱{quote.total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Deposit Callout Box */}
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-1">
                      <div className="flex justify-between items-center font-black text-amber-950 text-sm">
                        <span>Required Deposit ({settings.depositPercent}%):</span>
                        <span className="text-base">₱{quote.depositRequired.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-amber-800">
                        <span>Balance on Delivery / Pickup:</span>
                        <span className="font-bold">
                          ₱{Math.max(0, quote.total - quote.depositRequired).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TRACK BOOKING TAB ================= */}
        {activeTab === 'track' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
            <div className="card-panel space-y-5">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black text-gray-900">
                  Track Your Booking & Upload Payment Proof
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  Enter your reference number (sample references: <strong>MMC-2026-1001</strong>,{' '}
                  <strong>MMC-2026-1003</strong>, or <strong>MMC-2026-1004</strong>) to check your delivery status, print your receipt, or upload a deposit screenshot.
                </p>
              </div>

              <form onSubmit={(e) => handleTrackBooking(e)} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Enter Booking Ref (e.g., MMC-2026-1001)"
                  value={trackRefInput}
                  onChange={(e) => setTrackRefInput(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold uppercase"
                />
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-xl text-sm shadow transition"
                >
                  Search Booking
                </button>
              </form>

              <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500">
                <span>Try sample bookings:</span>
                {['MMC-2026-1001', 'MMC-2026-1002', 'MMC-2026-1003', 'MMC-2026-1004'].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => {
                      setTrackRefInput(sample);
                      handleTrackBooking(undefined, sample);
                    }}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {trackError && (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
                  {trackError}
                </div>
              )}
            </div>

            {trackedBooking && (
              <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 uppercase">
                      {trackedBooking.eventType} • {trackedBooking.eventDate} ({trackedBooking.eventTime})
                    </span>
                    <h2 className="text-xl font-black text-gray-900">
                      {trackedBooking.referenceNumber} — {trackedBooking.customerName}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Venue: {trackedBooking.barangay}, {trackedBooking.venueAddress},{' '}
                      {trackedBooking.municipality}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPrintBooking(trackedBooking);
                        setPrintDocType('RECEIPT');
                      }}
                      className="flex items-center gap-1.5 bg-charcoal-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Receipt / Invoice</span>
                    </button>
                  </div>
                </div>

                {/* Visual Booking Status Pipeline */}
                <div>
                  <div className="text-xs font-bold uppercase text-gray-500 mb-2">
                    Booking Status Flow: <span className="text-emerald-700">{trackedBooking.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {STATUS_STEPS.map((st, idx) => {
                      const currentIdx = STATUS_STEPS.indexOf(trackedBooking.status);
                      const isDone = idx <= currentIdx;
                      return (
                        <div
                          key={st}
                          className={`p-2.5 rounded-xl border text-center text-xs font-bold ${st === trackedBooking.status
                            ? 'bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-600/30'
                            : isDone
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}
                        >
                          {idx + 1}. {st}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-warm-50 p-4 rounded-2xl border border-warm-200 text-xs">
                  <div>
                    <div className="text-gray-500">Total Amount</div>
                    <div className="text-base font-black text-gray-900">
                      ₱{trackedBooking.totalAmount.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Required Deposit</div>
                    <div className="text-base font-black text-emerald-800">
                      ₱{trackedBooking.depositRequired.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Amount Paid</div>
                    <div className="text-base font-black text-emerald-700">
                      ₱{trackedBooking.amountPaid.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Remaining Balance</div>
                    <div className="text-base font-black text-amber-800">
                      ₱{trackedBooking.balanceDue.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Upload Proof of Payment Form */}
                {trackedBooking.balanceDue > 0 && (
                  <form
                    onSubmit={handleUploadDepositOnTrackedBooking}
                    className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3"
                  >
                    <div className="font-bold text-xs sm:text-sm text-emerald-950 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-emerald-700" />
                      <span>Submit GCash / Bank Deposit Proof for Verification</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="number"
                        required
                        placeholder="Amount Paid (PHP)"
                        value={lateProofAmount}
                        onChange={(e) => setLateProofAmount(e.target.value)}
                        className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold bg-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="GCash / Bank Reference No."
                        value={lateProofRef}
                        onChange={(e) => setLateProofRef(e.target.value)}
                        className="rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setLateProofImg)}
                        className="text-xs text-gray-600 bg-white rounded-xl border border-gray-300 p-1.5"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={uploadingProof}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
                    >
                      {uploadingProof ? 'Submitting...' : 'Submit Payment Proof'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= GALLERY & REVIEWS TAB ================= */}
        {activeTab === 'gallery' && (
          <div className="tab-container">
            <div>
              <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  Real Events in Lemery & Taal
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                  Event Setup Gallery
                </h1>
                <p className="text-sm text-gray-600">
                  See how our chairs, dressed banquet tables, and canopy tents transform venues across Batangas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {gallery.map((g) => (
                  <div
                    key={g.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
                  >
                    <div className="relative h-56 bg-gray-100">
                      <img src={g.imageUrl} alt={g.title} className="w-full h-full object-cover" />
                      <span className="absolute top-3.5 left-3.5 bg-emerald-900/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {g.eventType} • {g.guestCount} Pax
                      </span>
                    </div>
                    <div className="p-6 space-y-2 flex-1">
                      <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> {g.location} ({g.date})
                      </div>
                      <h3 className="font-bold text-base text-gray-900">{g.title}</h3>
                      <p className="text-xs text-gray-600 leading-relaxed">{g.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Customer Reviews */}
            <div className="bg-gradient-to-br from-charcoal-900 via-emerald-950 to-charcoal-800 text-white rounded-2xl p-6 sm:p-10 space-y-8 border border-amber-400/20 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                    Verified Local Feedback
                  </span>
                  <h2 className="text-2xl font-black">Customer Reviews from Lemery & Taal</h2>
                  <p className="text-xs sm:text-sm text-warm-200">
                    Rated 5.0 ★ by local families, barangay councils, and wedding coordinators
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('book')}
                  className="bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-black text-xs sm:text-sm px-5 py-3 rounded-xl self-start shadow"
                >
                  Book Your Event Today →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-300">
                        {Array.from({ length: rev.rating }).map((_, idx) => (
                          <Star key={idx} className="w-4 h-4 fill-amber-300" />
                        ))}
                      </div>
                      <span className="text-[11px] text-warm-300">{rev.date}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-warm-50 italic leading-relaxed">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                    <div className="pt-1 text-xs font-bold text-amber-300">
                      {rev.customerName} — <span className="text-warm-200 font-normal">{rev.eventType} ({rev.location})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= FAQ & RENTAL TERMS TAB ================= */}
        {activeTab === 'terms' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8 sm:space-y-10">
            <div className="text-center space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                Policies & Helpful Info
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                Rental Terms, Damage Fees & Frequently Asked Questions
              </h1>
            </div>

            {/* Rental Terms & Conditions */}
            <div className="card-panel space-y-6">
              <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <span>Official Rental Terms & Policies</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                <div className="p-5 rounded-2xl bg-warm-50 border border-warm-200 space-y-2">
                  <h3 className="font-extrabold text-emerald-900">
                    1. Reservation Deposit ({settings.depositPercent}%) & Balance
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    A <strong>{settings.depositPercent}% reservation deposit</strong> is required to lock your items for your event date. The remaining {100 - settings.depositPercent}% balance is payable upon delivery/setup or before customer pickup.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-warm-50 border border-warm-200 space-y-2">
                  <h3 className="font-extrabold text-emerald-900">
                    2. Cancellation & Rescheduling Policy
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Free rescheduling up to 72 hours before your event date (subject to stock availability on the new date). Cancellations made at least 5 days prior receive a 50% deposit refund or 100% credit voucher valid for 6 months.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-warm-50 border border-warm-200 space-y-2">
                  <h3 className="font-extrabold text-emerald-900">
                    3. Late Return Policy
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Standard rentals cover a full day/event cycle. Unscheduled extensions or failure to make items accessible for pickup on the agreed return date incurs an additional daily rental charge ({settings.lateReturnFeePerDayPercent}% to 100% of daily rate).
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-warm-50 border border-warm-200 space-y-2">
                  <h3 className="font-extrabold text-emerald-900">
                    4. Care, Damage & Loss Liability
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Items are counted jointly with the customer upon delivery and upon pickup. Cracked chairs, broken table legs, cigarette/candle burns on linens, or missing items are charged at standard repair or replacement cost below.
                  </p>
                </div>
              </div>

              {/* Replacement Fee Schedule Table */}
              <div className="pt-2 space-y-3">
                <h3 className="text-xs font-bold uppercase text-gray-500">
                  Standard Damage / Loss Replacement Schedule
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">Item Name</th>
                        <th className="py-3 px-4">Rental Rate / Day</th>
                        <th className="py-3 px-4">Lost / Severely Damaged Replacement Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventory
                        .filter((i) => i.category !== 'Packages')
                        .map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                            <td className="py-3 px-4">₱{item.pricePerDay.toLocaleString()}</td>
                            <td className="py-3 px-4 font-bold text-gray-800">
                              ₱{item.replacementFee.toLocaleString()} / unit
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="card-panel space-y-5">
              <h2 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-700" />
                <span>Frequently Asked Questions (FAQ)</span>
              </h2>

              <div className="space-y-4 text-xs sm:text-sm">
                {[
                  {
                    q: 'Which areas in Batangas do you deliver to?',
                    a: 'Our primary service areas are all barangays of Lemery and Taal, Batangas. We also deliver to nearby municipalities including Agoncillo, San Nicolas, Calaca, Sta. Teresita, and San Luis.',
                  },
                  {
                    q: 'How early do you deliver the tables and chairs?',
                    a: 'We deliver at least 2 to 4 hours before your event start time (or the afternoon before for early morning events, subject to schedule) so you have plenty of time to decorate and prepare.',
                  },
                  {
                    q: 'Can I book urgent chairs and tents for a funeral/wake?',
                    a: 'Yes. For wakes (lamay) in Lemery and Taal, call us directly at 0956 403 5020 for priority same-day dispatch and multi-day discounted rates.',
                  },
                  {
                    q: 'Do your round tables come with tablecloths and runners?',
                    a: 'You can rent bare round tables or dressed round tables with floor-length tablecloths. Our 50, 100, and 150 pax packages already include clean tablecloths!',
                  },
                ].map((faq, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                    <div className="font-bold text-gray-900">{faq.q}</div>
                    <div className="text-gray-600 leading-relaxed">{faq.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= CONTACT & MAP TAB ================= */}
        {activeTab === 'contact' && (
          <div className="tab-container">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 card-panel space-y-6">
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                    Get In Touch
                  </span>
                  <h1 className="text-2xl font-black text-gray-900">
                    Contact {settings.businessName}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Reach out via phone, SMS, Facebook Messenger, or email for bookings and custom event quotes in Lemery and Taal, Batangas.
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                    <Phone className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase">Call / Text / Viber / GCash</div>
                      <a
                        href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                        className="font-black text-base text-emerald-950 hover:underline"
                      >
                        {settings.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                    <Mail className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase">Email Address</div>
                      <a
                        href={`mailto:${settings.email}`}
                        className="font-bold text-emerald-950 hover:underline break-all"
                      >
                        {settings.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                    <Facebook className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase">
                        Facebook Page & Messenger
                      </div>
                      <a
                        href={settings.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {settings.messengerName} (Click to Open Facebook Page)
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-warm-100 border border-warm-200">
                    <MapPin className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase">Service Coverage</div>
                      <div className="font-bold text-gray-900">{settings.serviceArea}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{settings.baseAddress}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('book')}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 px-4 rounded-xl text-sm shadow-md transition"
                >
                  Book Chairs & Tables Online Now →
                </button>
              </div>

              {/* Embedded Map of Lemery & Taal Batangas */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col min-h-[440px]">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h2 className="font-bold text-sm text-gray-900">
                      Service Area Map — Lemery & Taal, Batangas
                    </h2>
                    <p className="text-xs text-gray-500">
                      Fast truck dispatch across Lemery, Taal Heritage Town, and neighboring Batangas barangays
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full shrink-0">
                    Batangas, PH
                  </span>
                </div>
                <iframe
                  title="MMC Set n Seat Rentals Service Area Map - Lemery and Taal Batangas"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=120.8650%2C13.8450%2C120.9650%2C13.9250&amp;layer=mapnik&amp;marker=13.8844%2C120.9136"
                  className="w-full flex-1 border-0 min-h-[380px]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-charcoal-900 text-gray-400 py-12 sm:py-16 border-t border-gray-800 no-print">
        <div className="layout-container grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-10 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={getAssetPath('/logo.jpg')}
                alt="MMC Set n Seat Rentals"
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400"
              />
              <div>
                <div className="font-black text-white text-base">{settings.businessName}</div>
                <div className="text-[11px] text-amber-400 font-bold">
                  Chairs • Tables • Tents • Videoke
                </div>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed">{settings.tagline}</p>
            <p className="text-amber-300 font-semibold">
              Payment Methods: Cash, GCash, Maya & Bank Transfer
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-white uppercase">Quick Links</div>
            <button onClick={() => setActiveTab('catalog')} className="block hover:text-white">
              Chairs & Tables Catalog
            </button>
            <button onClick={() => setActiveTab('packages')} className="block hover:text-white">
              Party Packages (20–150 Pax)
            </button>
            <button onClick={() => setActiveTab('book')} className="block hover:text-white">
              Online Booking & Quote Calculator
            </button>
            <button onClick={() => setActiveTab('track')} className="block hover:text-white">
              Track Booking by Reference #
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-white uppercase">Contact & Service Area</div>
            <div>📍 {settings.serviceArea}</div>
            <div>📞 {settings.phone}</div>
            <div>✉️ {settings.email}</div>
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-emerald-400 hover:underline"
            >
              Facebook: {settings.messengerName}
            </a>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white uppercase">Owner & Staff Access</div>
            <p>Manage bookings, edit inventory prices & stock, upload item photos, and print receipts:</p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Open Admin Dashboard</span>
            </Link>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Bar with Obvious "Book Now" Button */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xl no-print">
        <div>
          <div className="text-[11px] text-gray-500 font-medium">
            {cartItemsDetailed.length > 0
              ? `${cartItemsDetailed.length} item type(s) • ${rentalDays}d`
              : 'Serving Lemery & Taal'}
          </div>
          <div className="text-sm font-black text-emerald-900">
            {quote.total > 0 ? `Quote: ₱${quote.total.toLocaleString()}` : 'Check Live Stock'}
          </div>
        </div>

        <button
          onClick={() => {
            setConfirmedBooking(null);
            setActiveTab('book');
          }}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-5 py-3 rounded-xl shadow-lg flex items-center gap-1.5"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Book Now</span>
        </button>
      </div>

      {/* Floating Messenger / Viber / WhatsApp Chat Button */}
      <FloatingChatButton settings={settings} />

      {/* Printable Receipt / Invoice Modal */}
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

