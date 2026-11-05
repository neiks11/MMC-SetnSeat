'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown,
  MessageCircle,
  Menu,
  X,
  ZoomIn,
  Navigation,
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

/**
 * MOBILE FIX #3: Unambiguous date helpers
 * - Defaults Event Start Date to Today (`getTodayStr()`)
 * - Defaults Return / Pickup Date to Tomorrow (`getNextDayStr()`)
 * - Formats all displayed dates in one unambiguous format ("Nov 5, 2026")
 */
function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getNextDayStr(baseDateStr?: string): string {
  const d = baseDateStr ? new Date(baseDateStr + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * MOBILE FIX #3: Correct grammar helper ("1 item" vs "2 items")
 */
function formatItemCount(count: number, noun = 'item'): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/**
 * MOBILE FIX #7: WebP Image Optimizer for budget Android phones over mobile data
 * Appends `fm=webp` and target width/quality to Unsplash image URLs.
 */
function toWebpUrl(url: string, width = 640, quality = 72): string {
  if (!url) return url;
  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0];
    return `${base}?auto=format&fit=crop&fm=webp&w=${width}&q=${quality}`;
  }
  return url;
}

/**
 * MOBILE FIX #3: Stock status colors
 * - Green: plenty (>40% remaining)
 * - Amber: low (15%–40% remaining)
 * - Red: almost gone (<15% remaining) or Booked out (0 left)
 */
function getStockBadgeStyle(remaining: number, total: number): {
  badgeClass: string;
  dotClass: string;
  label: string;
} {
  if (remaining <= 0) {
    return {
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      dotClass: 'bg-red-600',
      label: 'Booked out',
    };
  }
  const ratio = total > 0 ? remaining / total : 1;
  if (ratio <= 0.15 || remaining <= 5) {
    return {
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      dotClass: 'bg-red-500',
      label: `Almost gone (${remaining} left)`,
    };
  }
  if (ratio <= 0.4) {
    return {
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500',
      label: `Low stock (${remaining} left)`,
    };
  }
  return {
    badgeClass: 'bg-green-50 text-green-800 border-green-200',
    dotClass: 'bg-green-600',
    label: `${remaining} available`,
  };
}

export default function CustomerApp() {
  const [activeTab, setActiveTab] = useState<CustomerTab>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroReadMore, setHeroReadMore] = useState(false);

  // Gallery Lightbox & FAQ Accordion states (MOBILE FIX #5)
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Server state
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [availability, setAvailability] = useState<Record<string, ItemAvailability>>({});
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // MOBILE FIX #3: Default start date to Today and auto-set return date to Tomorrow
  const [eventDate, setEventDate] = useState<string>(() => getTodayStr());
  const [returnDate, setReturnDate] = useState<string>(() => getNextDayStr(getTodayStr()));
  const [checkingStock, setCheckingStock] = useState(false);

  // Catalog filter
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // MOBILE FIX #3: Start cart empty ({}) so badge & item count start at 0
  const [cart, setCart] = useState<Record<string, number>>({});

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

  /**
   * MOBILE FIX #1: Lock body scroll while slide-in navigation drawer or lightbox is open,
   * and close on Escape key press.
   */
  useEffect(() => {
    if (mobileMenuOpen || lightboxItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setLightboxItem(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen, lightboxItem]);

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

  // Validated date change handlers: ensures returnDate >= eventDate, and auto-advances returnDate to next day when start date moves ahead
  function handleStartDateChange(newStart: string) {
    setEventDate(newStart);
    if (!returnDate || returnDate <= newStart) {
      setReturnDate(getNextDayStr(newStart));
    }
  }

  function handleReturnDateChange(newReturn: string) {
    if (newReturn < eventDate) {
      setReturnDate(eventDate);
    } else {
      setReturnDate(newReturn);
    }
  }

  // Rental days calculation (Start Today -> Return Tomorrow = 1 rental day)
  const rentalDays = useMemo(() => {
    if (!eventDate || !returnDate || returnDate <= eventDate) return 1;
    const s = new Date(eventDate + 'T00:00:00');
    const e = new Date(returnDate + 'T00:00:00');
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
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

  // Handle photo proof upload
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
    } catch {
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
        setTrackError(
          `No booking found with reference "${refToFind}". Try MMC-2026-1001 or MMC-2026-1004.`
        );
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
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] px-4">
        <div className="text-center space-y-3">
          <img
            src={getAssetPath('/logo.jpg')}
            alt="MMC Set n Seat Rentals Logo"
            width={80}
            height={80}
            className="w-20 h-20 rounded-full object-cover mx-auto shadow-lg border-2 border-[#7B2D26]"
          />
          <p className="text-base font-bold text-[#7B2D26]">
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

  // Core quick-quote items for the Hero Availability Widget
  const preferredQuickIds = [
    'item-monobloc-bare',
    'item-monobloc-dressed',
    'item-tiffany-chair',
    'item-round-table-clothed',
    'item-rect-table',
  ];
  const pickedQuick = preferredQuickIds
    .map((id) => inventory.find((i) => i.id === id && i.active))
    .filter(Boolean) as InventoryItem[];
  const heroQuickItems =
    pickedQuick.length > 0 ? pickedQuick : inventory.filter((i) => i.active).slice(0, 5);

  const currentZone =
    settings.deliveryZones.find((z) => z.municipality === municipality) ||
    settings.deliveryZones[0];

  const showMobileStickyBar = totalCartUnits > 0 && activeTab !== 'book';
  const cleanPhone = settings.phone.replace(/\s+/g, '');

  const faqList = [
    {
      q: 'Which areas in Batangas do you deliver to?',
      a: 'Our primary service areas are all barangays of Lemery and Taal, Batangas. We also deliver to nearby towns including Agoncillo, San Nicolas, Calaca, Sta. Teresita, and San Luis.',
    },
    {
      q: 'How early do you deliver the tables and chairs?',
      a: 'We deliver at least 2 to 4 hours before your event start time (or the afternoon before for early morning events, subject to schedule) so you have plenty of time to decorate and prepare.',
    },
    {
      q: 'How much is the reservation deposit and how can I pay?',
      a: `Only a ${settings.depositPercent}% deposit is required to lock your items for your date via GCash (${settings.gcashNumber}), Maya, BDO/BPI Bank Transfer, or Cash at our Lemery depot. The remaining ${100 - settings.depositPercent}% balance is paid upon delivery.`,
    },
    {
      q: 'Can I book urgent chairs and tents for a funeral / wake?',
      a: `Yes. For wakes (lamay) in Lemery and Taal, call us directly at ${settings.phone} for priority same-day truck dispatch and multi-day package rates.`,
    },
    {
      q: 'Do your round tables come with tablecloths and motif ribbons?',
      a: 'You can rent bare 5ft round tables (₱140/day) or dressed 5ft round tables with pressed floor-length tablecloths (₱200/day). Our 20, 50, 100, and 150 pax packages already include clean tablecloths!',
    },
  ];

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#FAF8F5] text-charcoal-900 ${
        showMobileStickyBar ? 'pb-28 md:pb-0' : 'pb-16 md:pb-0'
      }`}
    >
      {/* =====================================================================
          MOBILE FIX #1: COMPACT STICKY HEADER (MAX 64PX = h-16 max-h-16)
          - Left: Logo (40x40px) + Short Business Name ("MMC Set n Seat")
          - Right: ONE visible "Book Now" button (cart badge hidden when 0)
            + Hamburger button (44x44px min tap target) opening full-height drawer.
      ===================================================================== */}
      <header className="sticky top-0 z-40 h-16 max-h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm no-print">
        <div className="layout-container h-full flex items-center justify-between gap-2">
          {/* Logo + Short Business Name */}
          <button
            type="button"
            onClick={() => {
              setConfirmedBooking(null);
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 text-left min-h-[44px] pr-1 shrink-0"
          >
            <img
              src={getAssetPath('/logo.jpg')}
              alt="MMC Set n Seat Rentals Logo"
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#7B2D26] shrink-0"
            />
            <div className="leading-tight">
              <span className="block font-heading font-extrabold text-sm sm:text-base text-[#7B2D26] tracking-tight">
                MMC Set n Seat
              </span>
              <span className="block text-xs text-gray-600 font-medium">
                Lemery & Taal Rentals
              </span>
            </div>
          </button>

          {/* Desktop-only Inline Nav (1024px+ lg breakpoint) */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Primary Navigation">
            {[
              { id: 'home', label: 'Home' },
              { id: 'catalog', label: 'Rentals' },
              { id: 'packages', label: 'Packages' },
              { id: 'gallery', label: 'Gallery' },
              { id: 'terms', label: 'FAQ' },
              { id: 'contact', label: 'Contact' },
              { id: 'track', label: 'Track Booking' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setConfirmedBooking(null);
                  setActiveTab(tab.id as CustomerTab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3 py-2 min-h-[44px] rounded-xl text-sm font-bold whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-[#7B2D26]/10 text-[#7B2D26]'
                    : 'text-gray-700 hover:text-[#7B2D26] hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Action Area: ONE "Book Now" Button + Hamburger Drawer Trigger */}
          <div className="flex items-center gap-2">
            <a
              href={`tel:${cleanPhone}`}
              className="hidden xl:inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 hover:border-[#7B2D26]"
            >
              <Phone className="w-4 h-4 text-[#7B2D26]" />
              <span>{settings.phone}</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setConfirmedBooking(null);
                setActiveTab('book');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center justify-center gap-1.5 bg-[#7B2D26] hover:bg-[#5E201A] active:scale-95 text-white font-heading font-bold text-sm px-3.5 sm:px-4 min-h-[44px] rounded-xl shadow-sm transition"
            >
              <ShoppingBag className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Book Now</span>
              {/* Hidden when count is 0 */}
              {totalCartUnits > 0 && (
                <span className="bg-amber-400 text-charcoal-900 font-extrabold text-xs px-2 py-0.5 rounded-full">
                  {totalCartUnits}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="lg:hidden min-w-[44px] min-h-[44px] rounded-xl border border-gray-200 flex items-center justify-center text-gray-800 hover:bg-gray-100 active:bg-gray-200"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MOBILE FIX #1: FULL-HEIGHT SLIDE-IN DRAWER MENU
          - Closes on link tap, backdrop overlay tap, or Escape key
          - Locks body scroll while open
          - Large single-line links (min 48px tall)
          - Tap-to-call and Messenger links at the bottom
      ===================================================================== */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Site Navigation Drawer"
          className="fixed inset-0 z-50 lg:hidden flex justify-end no-print"
        >
          {/* Backdrop Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Slide-In Drawer Panel */}
          <div className="relative z-10 w-80 max-w-[85vw] bg-white h-full flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              {/* Drawer Header */}
              <div className="h-16 px-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={getAssetPath('/logo.jpg')}
                    alt="MMC Set n Seat Logo"
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover border border-[#7B2D26]"
                  />
                  <span className="font-heading font-extrabold text-base text-[#7B2D26]">
                    MMC Set n Seat
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-gray-700 hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Navigation Links (min 48px height, single-line labels) */}
              <nav className="p-4 space-y-2" aria-label="Mobile Navigation">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'catalog', label: 'Rentals' },
                  { id: 'packages', label: 'Packages' },
                  { id: 'gallery', label: 'Gallery' },
                  { id: 'terms', label: 'FAQ' },
                  { id: 'contact', label: 'Contact' },
                  { id: 'track', label: 'Track Booking' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setConfirmedBooking(null);
                      setActiveTab(item.id as CustomerTab);
                      setMobileMenuOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-full min-h-[48px] px-4 rounded-xl text-left font-heading font-bold text-base flex items-center justify-between transition ${
                      activeTab === item.id
                        ? 'bg-[#7B2D26] text-white shadow-sm'
                        : 'text-gray-800 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronRight
                      className={`w-5 h-5 ${
                        activeTab === item.id ? 'text-amber-300' : 'text-gray-400'
                      }`}
                    />
                  </button>
                ))}
              </nav>
            </div>

            {/* Bottom Quick-Contact Actions inside Drawer (Tap-to-Call & Messenger) */}
            <div className="p-4 border-t border-gray-200 bg-[#FAF8F5] space-y-2.5">
              <div className="text-sm font-bold text-gray-700">
                Direct Booking Support (Lemery & Taal)
              </div>
              <a
                href={`tel:${cleanPhone}`}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#7B2D26] hover:bg-[#5E201A] text-white font-bold text-base flex items-center justify-center gap-2 shadow-sm"
              >
                <Phone className="w-5 h-5 text-amber-300" />
                <span>Call {settings.phone}</span>
              </a>
              <a
                href={settings.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#006AFF] hover:bg-[#0055CC] text-white font-bold text-base flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Message on Messenger</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {/* ================= HOME TAB ================= */}
        {activeTab === 'home' && (
          <div>
            {/* ===============================================================
                MOBILE FIX #2: HERO SECTION + SINGLE-COLUMN STACKED FLOW
                - Responsive WebP <picture> background (<150KB on mobile)
                - Dark maroon gradient overlay meeting WCAG AA contrast (>4.5:1)
                - Headline 28–32px on mobile (`text-[28px] sm:text-[32px] lg:text-5xl`)
                - Short subtext (16px minimum, max 2–3 lines) + "Read more" toggle
                - ONE full-width primary CTA ("Check Availability & Get Quote", min-h 48px)
                  + ONE secondary text link ("View Packages", min-h 48px)
                - Compact 3-column icon grid below CTAs (100% Clean, Live Stock, On-Time)
                - Availability Widget stacked directly below
            =============================================================== */}
            <section className="relative bg-[#4A1813] text-white overflow-hidden">
              {/* Responsive WebP Hero Image (lightweight 640w WebP for mobile data) */}
              <picture>
                <source
                  media="(max-width: 640px)"
                  srcSet="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=640&q=68"
                  type="image/webp"
                />
                <source
                  media="(max-width: 1024px)"
                  srcSet="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=1024&q=72"
                  type="image/webp"
                />
                <img
                  src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=1280&q=75"
                  alt="Dressed banquet tables, gold Tiffany chairs, and canopy tent setup in Batangas"
                  width={1280}
                  height={853}
                  fetchPriority="high"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              </picture>

              {/* High-contrast gradient overlay (no heavy blur filters) */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#3A110D]/92 via-[#4A1813]/90 to-[#3A110D]/95 lg:bg-gradient-to-r lg:from-[#3A110D]/95 lg:via-[#4A1813]/88 lg:to-[#3A110D]/70"
                aria-hidden="true"
              />

              <div className="relative layout-container py-8 sm:py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
                {/* Hero Text & CTAs Column */}
                <div className="lg:col-span-6 xl:col-span-7 space-y-5">
                  {/* Location & Category Badge */}
                  <div className="inline-flex items-center gap-2 bg-black/40 border border-amber-300/40 rounded-full px-3.5 py-1.5 text-sm font-bold text-amber-200">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>Lemery & Taal, Batangas • Chairs • Tables • Tents • Videoke</span>
                  </div>

                  {/* Single H1 Headline: 28px on mobile, 32px on sm, 48px on lg */}
                  <h1 className="font-heading text-[28px] sm:text-[32px] lg:text-5xl font-extrabold tracking-tight leading-[1.2] text-white">
                    Complete <span className="text-amber-300">Sets & Seats</span> for Every Batangas Celebration.
                  </h1>

                  {/* Subtext: 16px min (`text-base`), max 2–3 lines, with collapsible "Read more" */}
                  <div className="space-y-2 max-w-xl">
                    <p className="text-white text-base sm:text-lg leading-relaxed">
                      Spotless chairs, dressed banquet tables, canopy tents, and videoke delivered on time for weddings, fiestas, birthdays, debuts, and wakes.
                    </p>
                    {heroReadMore && (
                      <p className="text-amber-100 text-sm sm:text-base leading-relaxed">
                        We serve all barangays of Lemery and Taal, plus Agoncillo, San Nicolas, and Calaca. Reserve online with a {settings.depositPercent}% deposit via GCash, Bank Transfer, or Cash.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setHeroReadMore(!heroReadMore)}
                      aria-expanded={heroReadMore}
                      className="text-sm font-bold text-amber-300 underline underline-offset-4 min-h-[44px] inline-flex items-center"
                    >
                      {heroReadMore ? 'Show less' : 'Read more about our Lemery & Taal service'}
                    </button>
                  </div>

                  {/* Social Proof Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-amber-100 bg-black/30 border border-white/15 rounded-2xl px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                      <span className="font-bold text-white">4.9★</span>
                      <span>(500+ Events Served)</span>
                    </div>
                    <span className="text-white/30">•</span>
                    <span>Serving Lemery, Taal & Nearby Towns</span>
                  </div>

                  {/* CTAs: ONE Full-Width Primary Button + ONE Secondary Text Link (min-h 48px) */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                    <a
                      href="#availability-quote-widget"
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById('availability-quote-widget');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-charcoal-900 font-heading font-extrabold text-base shadow-lg flex items-center justify-center gap-2 transition"
                    >
                      <span>Check Availability & Get Quote</span>
                      <ArrowRight className="w-5 h-5 shrink-0" />
                    </a>

                    <button
                      type="button"
                      onClick={() => setActiveTab('packages')}
                      className="w-full sm:w-auto min-h-[48px] px-4 py-2.5 rounded-xl text-amber-200 hover:text-white font-heading font-bold text-base underline underline-offset-4 flex items-center justify-center gap-1.5 transition"
                    >
                      <span>View Packages</span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>

                  {/* Compact 3-Column Icon Grid Below CTAs (100% Clean, Live Stock, On-Time) */}
                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-black/30 border border-white/15 rounded-xl p-3 text-center">
                      <ShieldCheck className="w-5 h-5 text-amber-300 mx-auto mb-1" />
                      <div className="font-heading font-bold text-sm text-white">100% Clean</div>
                      <div className="text-xs text-white/80">Sanitized sets</div>
                    </div>
                    <div className="bg-black/30 border border-white/15 rounded-xl p-3 text-center">
                      <Layers className="w-5 h-5 text-amber-300 mx-auto mb-1" />
                      <div className="font-heading font-bold text-sm text-white">Live Stock</div>
                      <div className="text-xs text-white/80">Real-time count</div>
                    </div>
                    <div className="bg-black/30 border border-white/15 rounded-xl p-3 text-center">
                      <Truck className="w-5 h-5 text-amber-300 mx-auto mb-1" />
                      <div className="font-heading font-bold text-sm text-white">On-Time</div>
                      <div className="text-xs text-white/80">Lemery & Taal</div>
                    </div>
                  </div>
                </div>

                {/* ===========================================================
                    MOBILE FIX #3: AVAILABILITY WIDGET (FULL-WIDTH CARD)
                    - Stacked Start Date & Return Date inputs vertically on mobile
                    - Inputs min-h-[48px] & font-size 16px (no iOS zoom)
                    - Single unambiguous date format ("Nov 5, 2026")
                    - Single-column stock list with FULL item names (no truncation),
                      Green/Amber/Red stock badge, and 44x44px +/- steppers
                    - Two full-width stacked bottom buttons ("Proceed to Booking Form"
                      disabled until >= 1 item is selected, using "1 item" / "2 items")
                =========================================================== */}
                <div
                  id="availability-quote-widget"
                  className="lg:col-span-6 xl:col-span-5 w-full bg-white text-charcoal-900 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 space-y-5"
                >
                  {/* Widget Header */}
                  <div className="flex items-start justify-between border-b border-gray-100 pb-3 gap-2">
                    <div>
                      <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#7B2D26]">
                        Live Availability & Instant Quote
                      </h2>
                      <p className="text-sm text-gray-600 mt-0.5">
                        Pick your dates and tap + to calculate your total
                      </p>
                    </div>
                    <span className="bg-amber-100 text-charcoal-900 border border-amber-300 text-xs font-extrabold px-2.5 py-1 rounded-full shrink-0">
                      Instant Quote
                    </span>
                  </div>

                  {/* Vertically Stacked Date Inputs on Mobile (min-h-[48px], 16px text) */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="hero-start-date"
                            className="text-sm font-bold text-gray-800"
                          >
                            Event Start Date
                          </label>
                          <span className="text-sm font-extrabold text-[#7B2D26]">
                            {formatHumanDate(eventDate)}
                          </span>
                        </div>
                        <input
                          id="hero-start-date"
                          type="date"
                          min={getTodayStr()}
                          value={eventDate}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-[#7B2D26]"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="hero-return-date"
                            className="text-sm font-bold text-gray-800"
                          >
                            Return Date
                          </label>
                          <span className="text-sm font-extrabold text-[#7B2D26]">
                            {formatHumanDate(returnDate)} ({rentalDays}d)
                          </span>
                        </div>
                        <input
                          id="hero-return-date"
                          type="date"
                          min={eventDate}
                          value={returnDate}
                          onChange={(e) => handleReturnDateChange(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-[#7B2D26]"
                        />
                      </div>
                    </div>

                    {/* Delivery Barangay / Town Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="hero-municipality"
                          className="text-sm font-bold text-gray-800"
                        >
                          Delivery Town / Barangay
                        </label>
                        <span className="text-sm font-bold text-[#7B2D26]">
                          {quote.subtotal >= settings.freeDeliveryMinOrder &&
                          settings.freeDeliveryMinOrder > 0
                            ? 'FREE Delivery'
                            : `₱${currentZone?.fee ?? settings.defaultDeliveryFee} truck fee`}
                        </span>
                      </div>
                      <select
                        id="hero-municipality"
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
                        className="w-full min-h-[48px] rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-base font-semibold text-gray-900 focus:ring-2 focus:ring-[#7B2D26]"
                      >
                        {settings.deliveryZones.map((z) => (
                          <option key={z.municipality} value={z.municipality}>
                            {z.municipality} — ₱{z.fee} ({z.etaNote})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Single-Column Stock List (Full Names, Stock Status Colors, 44x44px Steppers) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-gray-800">
                        Available for <strong className="text-[#7B2D26]">{formatHumanDate(eventDate)}</strong>:
                      </span>
                      {checkingStock && (
                        <span className="text-sm font-semibold text-[#7B2D26] animate-pulse">
                          Updating...
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {heroQuickItems.map((item) => {
                        const rem = availability[item.id]?.remainingStock ?? item.totalStock;
                        const qty = cart[item.id] || 0;
                        const stockBadge = getStockBadgeStyle(rem, item.totalStock);
                        const stepSize = item.category === 'Chairs' && qty === 0 ? 10 : 1;

                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl p-3 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              qty > 0
                                ? 'bg-amber-50/70 border-amber-400 shadow-xs'
                                : 'bg-[#FAF8F5] border-gray-200'
                            }`}
                          >
                            {/* Full Item Name (Never Truncated) + Price + Stock Status Badge */}
                            <div className="space-y-1 flex-1">
                              <div className="font-heading font-bold text-base text-gray-900 leading-snug">
                                {item.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-extrabold text-[#7B2D26]">
                                  ₱{item.pricePerDay}{' '}
                                  <span className="font-normal text-gray-600">
                                    {item.category === 'Chairs'
                                      ? 'per chair'
                                      : item.category === 'Tables'
                                        ? 'per table'
                                        : 'per day'}
                                  </span>
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${stockBadge.badgeClass}`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${stockBadge.dotClass}`}
                                  />
                                  {stockBadge.label}
                                </span>
                              </div>
                            </div>

                            {/* 44x44px Quantity Steppers with 8px (gap-2) Spacing */}
                            <div className="flex items-center justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={qty <= 0}
                                onClick={() => updateCartQty(item.id, -1)}
                                aria-label={`Decrease quantity of ${item.name}`}
                                className="min-w-[44px] min-h-[44px] rounded-xl border border-gray-300 bg-white hover:bg-gray-100 active:scale-95 disabled:opacity-35 flex items-center justify-center font-bold text-gray-900"
                              >
                                <Minus className="w-4 h-4" />
                              </button>

                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={rem}
                                value={qty}
                                onChange={(e) =>
                                  updateCartQty(
                                    item.id,
                                    parseInt(e.target.value, 10) || 0,
                                    true
                                  )
                                }
                                aria-label={`Quantity of ${item.name}`}
                                className="w-14 min-h-[44px] text-center font-extrabold text-base rounded-xl border border-gray-300 bg-white"
                              />

                              <button
                                type="button"
                                disabled={qty >= rem}
                                onClick={() => updateCartQty(item.id, stepSize)}
                                aria-label={`Increase quantity of ${item.name}`}
                                className="min-w-[44px] min-h-[44px] rounded-xl border border-[#7B2D26] bg-[#7B2D26] hover:bg-[#5E201A] active:scale-95 text-white disabled:opacity-35 flex items-center justify-center font-bold"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Estimated Total Summary */}
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 space-y-1.5 text-sm">
                    {totalCartUnits > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-gray-700">
                          <span>
                            {formatItemCount(totalCartUnits)} × {rentalDays}{' '}
                            {rentalDays === 1 ? 'day' : 'days'}
                          </span>
                          <span className="font-bold text-gray-900">
                            ₱{quote.subtotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-700">
                          <span>
                            Delivery ({municipality.split('(')[0].trim()}) + Setup
                          </span>
                          <span className="font-bold text-gray-900">
                            ₱{(quote.deliveryFee + quote.setupFee).toLocaleString()}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-gray-200 flex items-baseline justify-between">
                          <div>
                            <span className="font-bold text-base text-gray-900">
                              Estimated Total:
                            </span>
                            <span className="block text-xs text-gray-600">
                              {settings.depositPercent}% deposit to reserve: ₱
                              {quote.depositRequired.toLocaleString()}
                            </span>
                          </div>
                          <span className="font-heading font-extrabold text-xl text-[#7B2D26]">
                            ₱{quote.total.toLocaleString()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-gray-700 py-1">
                        <span>Tap + above to calculate your instant quote</span>
                        <span className="font-bold text-[#7B2D26]">0 items</span>
                      </div>
                    )}
                  </div>

                  {/* Two Full-Width Stacked Bottom Buttons (min-h-[48px]) */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      disabled={totalCartUnits === 0}
                      onClick={() => {
                        setActiveTab('book');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-full min-h-[48px] py-3.5 px-4 rounded-xl font-heading font-extrabold text-base transition flex items-center justify-center gap-2 ${
                        totalCartUnits > 0
                          ? 'bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-charcoal-900 shadow-md cursor-pointer'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <span>
                        {totalCartUnits > 0
                          ? `Proceed to Booking Form (${formatItemCount(totalCartUnits)})`
                          : 'Proceed to Booking Form (Select 1+ item above)'}
                      </span>
                      {totalCartUnits > 0 && <ArrowRight className="w-5 h-5 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('catalog');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full min-h-[48px] py-3 px-4 rounded-xl border-2 border-[#7B2D26] text-[#7B2D26] hover:bg-[#7B2D26]/5 active:scale-[0.99] font-heading font-bold text-base transition flex items-center justify-center gap-2"
                    >
                      <span>Browse All Chairs, Tables, Tents & Packages</span>
                      <ChevronRight className="w-5 h-5 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ===============================================================
                HOW IT WORKS (4-STEP PROCESS)
            =============================================================== */}
            <section className="bg-white border-b border-gray-200 section-spacing">
              <div className="layout-container">
                <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
                  <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                    Easy 4-Step Booking
                  </span>
                  <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-gray-900">
                    How It Works
                  </h2>
                  <p className="text-base text-gray-600">
                    Reserve tables, chairs, tents, and videoke from your phone in minutes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[
                    {
                      step: '1',
                      title: 'Choose Date',
                      desc: `Select your event date (${formatHumanDate(eventDate)}) and return date to check real-time stock.`,
                      icon: Calendar,
                    },
                    {
                      step: '2',
                      title: 'Select Items',
                      desc: 'Pick White or Dressed Monobloc chairs, Tiffany chairs, tables, tents, videoke, or guest bundles.',
                      icon: Layers,
                    },
                    {
                      step: '3',
                      title: `Confirm & Pay ${settings.depositPercent}% Deposit`,
                      desc: `Lock your booking via GCash (${settings.gcashNumber}), Bank Transfer, or Cash.`,
                      icon: ShieldCheck,
                    },
                    {
                      step: '4',
                      title: 'We Deliver & Pick Up',
                      desc: 'Our Lemery/Taal crew delivers sanitized items on schedule and picks them up after your event.',
                      icon: Truck,
                    },
                  ].map((item) => {
                    const StepIcon = item.icon;
                    return (
                      <div
                        key={item.step}
                        className="bg-[#FAF8F5] rounded-2xl border border-gray-200 p-5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#7B2D26] text-amber-300 font-heading font-extrabold text-base">
                            {item.step}
                          </span>
                          <StepIcon className="w-5 h-5 text-[#7B2D26]" />
                        </div>
                        <h3 className="font-heading font-bold text-lg text-gray-900">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-700 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ===============================================================
                MOBILE FIX #5: PACKAGES SECTION (HORIZONTAL SWIPE CAROUSEL ON PHONES,
                2 COLUMNS ON TABLETS, 4 COLUMNS ON DESKTOP)
            =============================================================== */}
            <section className="layout-container section-spacing">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-3">
                <div className="space-y-1">
                  <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                    All-In Guest Bundles
                  </span>
                  <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-charcoal-900">
                    Popular Party & Event Packages
                  </h2>
                  <p className="text-base text-gray-600">
                    Swipe or tap a bundle for 20, 50, 100, or 150 guests — available for{' '}
                    <strong>{formatHumanDate(eventDate)}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('catalog');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-h-[44px] text-base font-bold text-[#7B2D26] hover:underline inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <span>View Individual Rentals</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Horizontal swipe carousel with snap scrolling on mobile; 2-col grid on md tablet; 4-col on lg */}
              <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-4 -mx-4 px-4 md:mx-0 md:px-0">
                {packagesList.map((pkg) => {
                  const avail = availability[pkg.id]?.remainingStock ?? pkg.totalStock;
                  const inCart = cart[pkg.id] || 0;
                  const stockStyle = getStockBadgeStyle(avail, pkg.totalStock);
                  return (
                    <div
                      key={pkg.id}
                      className="snap-start shrink-0 w-[85vw] max-w-[330px] md:w-auto md:max-w-none bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden"
                    >
                      <div className="relative h-48 bg-gray-100">
                        <img
                          src={toWebpUrl(pkg.imageUrl, 600, 72)}
                          alt={pkg.name}
                          width={600}
                          height={400}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        {pkg.guestCapacity && (
                          <span className="absolute top-3 left-3 bg-[#7B2D26] text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow">
                            <Users className="w-3.5 h-3.5 text-amber-300" />
                            {pkg.guestCapacity} Pax Bundle
                          </span>
                        )}
                        <span
                          className={`absolute bottom-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow border ${stockStyle.badgeClass}`}
                        >
                          {avail > 0 ? `${avail} sets left` : 'Booked Out'}
                        </span>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-2.5">
                          <h3 className="font-heading font-bold text-lg text-gray-900 leading-snug">
                            {pkg.name}
                          </h3>
                          <p className="text-sm text-gray-600 leading-relaxed">{pkg.description}</p>
                          {pkg.includedItems && pkg.includedItems.length > 0 && (
                            <ul className="text-sm text-gray-800 bg-[#FAF8F5] border border-gray-200 rounded-xl p-3 space-y-1.5">
                              {pkg.includedItems.map((inc, idx) => (
                                <li key={idx} className="flex items-center gap-2 font-medium">
                                  <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                                  <span>
                                    <strong>{inc.quantity}×</strong> {inc.label}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="pt-3 border-t border-gray-100 space-y-3">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <span className="font-heading text-2xl font-extrabold text-[#7B2D26]">
                                ₱{pkg.pricePerDay.toLocaleString()}
                              </span>
                              <span className="text-sm text-gray-500 ml-1">/ day</span>
                            </div>
                            {inCart > 0 && (
                              <span className="text-xs font-bold text-[#7B2D26] bg-[#7B2D26]/10 px-2.5 py-1 rounded-md">
                                {inCart} in cart
                              </span>
                            )}
                          </div>

                          {/* One clear "Add" button (min-h 48px) */}
                          <button
                            type="button"
                            disabled={avail <= 0}
                            onClick={() => updateCartQty(pkg.id, 1)}
                            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-charcoal-900 font-heading font-extrabold text-base transition shadow-xs disabled:opacity-40 flex items-center justify-center gap-2"
                          >
                            <Plus className="w-5 h-5" />
                            <span>
                              {inCart > 0 ? `Add Another Set (${inCart} added)` : 'Add Package to Quote'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===============================================================
                CUSTOMER REVIEWS STRIP WITH REAL PHOTOS & NAMES
            =============================================================== */}
            <section className="bg-white border-t border-b border-gray-200 section-spacing">
              <div className="layout-container">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
                  <div className="space-y-1">
                    <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                      Verified Local Feedback
                    </span>
                    <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-gray-900">
                      Customer Reviews in Lemery & Taal
                    </h2>
                    <p className="text-base text-gray-600">
                      Rated 4.9★ across 500+ weddings, birthdays, debuts, fiestas, and wakes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('gallery');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="min-h-[44px] text-base font-bold text-[#7B2D26] hover:underline inline-flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>See Event Photos & Reviews</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {
                      name: 'Maria Theresa Mendoza',
                      location: 'Poblacion, Taal, Batangas',
                      event: 'Wedding Reception (150 Pax)',
                      avatar:
                        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&fm=webp&w=160&q=75',
                      eventPhoto:
                        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=600&q=70',
                      quote:
                        'Sobrang linis ng mga Tiffany chairs at plantsado lahat ng white tablecloths! Dumating ang truck nila sa Taal 2 hours bago magsimula ang reception.',
                    },
                    {
                      name: 'Engr. Ronaldo Atienza',
                      location: 'Brgy. Sambal Ilaya, Lemery',
                      event: 'Barangay Fiesta & Birthday (100 Pax)',
                      avatar:
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&fm=webp&w=160&q=75',
                      eventPhoto:
                        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&fm=webp&w=600&q=70',
                      quote:
                        'Nag-book kami ng 100 monobloc chairs, round tables, tent, at videoke. Napakadali mag-reserve online sa phone via GCash at maayos kausap ang crew.',
                    },
                    {
                      name: 'Clarisse Joy Ilagan',
                      location: 'Diversion Rd., Lemery, Batangas',
                      event: '18th Debut Party (80 Pax)',
                      avatar:
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&fm=webp&w=160&q=75',
                      eventPhoto:
                        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&fm=webp&w=600&q=70',
                      quote:
                        'Ang ganda ng maroon and gold motif ribbons sa dressed monobloc at round tables! Sulit na sulit ang presyo at mababait ang nag-setup.',
                    },
                  ].map((rev, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FAF8F5] rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="h-40 bg-gray-200 relative">
                          <img
                            src={rev.eventPhoto}
                            alt={rev.event}
                            width={600}
                            height={360}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2.5 left-3 bg-black/80 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                            {rev.event}
                          </span>
                        </div>
                        <div className="p-5 space-y-2.5">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, s) => (
                              <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <p className="text-base text-gray-800 leading-relaxed italic">
                            &ldquo;{rev.quote}&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-3 border-t border-gray-200/70 flex items-center gap-3">
                        <img
                          src={rev.avatar}
                          alt={rev.name}
                          width={44}
                          height={44}
                          loading="lazy"
                          className="w-11 h-11 rounded-full object-cover border border-[#7B2D26]/30 shrink-0"
                        />
                        <div>
                          <div className="font-heading font-bold text-base text-gray-900">
                            {rev.name}
                          </div>
                          <div className="text-sm text-gray-600">{rev.location}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ===============================================================
                PAYMENT OPTIONS, DEPOSIT POLICY & DELIVERY COVERAGE
            =============================================================== */}
            <section className="layout-container section-spacing">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-panel space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-[#7B2D26]/10 text-[#7B2D26] flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-extrabold text-lg text-gray-900">
                    GCash, Bank & Cash Payments
                  </h3>
                  <p className="text-base text-gray-600">
                    Pay your deposit or balance securely via:
                  </p>
                  <ul className="text-sm space-y-2 text-gray-800">
                    <li className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                      <span>GCash / Maya: {settings.gcashNumber}</span>
                    </li>
                    <li className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                      <span>BDO / BPI Bank Transfer</span>
                    </li>
                    <li className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                      <span>Cash at Lemery Depot or Upon Delivery</span>
                    </li>
                  </ul>
                </div>

                <div className="card-panel space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-[#7B2D26]/10 text-[#7B2D26] flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-extrabold text-lg text-gray-900">
                    {settings.depositPercent}% Reservation Deposit Policy
                  </h3>
                  <p className="text-base text-gray-600">
                    Reserve your event date with a <strong>{settings.depositPercent}% deposit</strong>. Pay the remaining <strong>{100 - settings.depositPercent}% balance</strong> upon delivery.
                  </p>
                  <ul className="text-sm space-y-2 text-gray-800">
                    <li className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                      <span>Free rescheduling (72+ hrs notice)</span>
                    </li>
                    <li className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                      <span>Instant reference # & official invoice</span>
                    </li>
                  </ul>
                </div>

                <div className="card-panel space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-[#7B2D26]/10 text-[#7B2D26] flex items-center justify-center">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-extrabold text-lg text-gray-900">
                    Lemery & Taal Delivery Rates
                  </h3>
                  <p className="text-base text-gray-600">
                    <strong>Free delivery</strong> on orders ₱
                    {settings.freeDeliveryMinOrder.toLocaleString()}+:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {settings.deliveryZones.slice(0, 4).map((z) => (
                      <div
                        key={z.municipality}
                        className="bg-[#FAF8F5] border border-gray-200 rounded-xl px-3 py-2 flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-800">
                          {z.municipality.split('(')[0].trim()}
                        </span>
                        <span className="font-extrabold text-[#7B2D26]">₱{z.fee}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= RENTALS / CATALOG TAB (MOBILE FIX #5) ================= */}
        {activeTab === 'catalog' && (
          <div className="tab-container">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                  Live Inventory & Daily Rates
                </span>
                <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-gray-900">
                  Chairs, Tables, Tents & Videoke
                </h1>
                <p className="text-base text-gray-600">
                  Showing real-time remaining stock for <strong>{formatHumanDate(eventDate)}</strong>.
                </p>
              </div>

              {/* Stacked Date Pickers on Mobile */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Start ({formatHumanDate(eventDate)})
                  </label>
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={eventDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3 py-2 text-base font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Return ({formatHumanDate(returnDate)})
                  </label>
                  <input
                    type="date"
                    min={eventDate}
                    value={returnDate}
                    onChange={(e) => handleReturnDateChange(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3 py-2 text-base font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Category Filters & Search (min 44px tap targets) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {['All', 'Chairs', 'Tables', 'Packages', 'Add-ons'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition ${
                      selectedCategory === cat
                        ? 'bg-[#7B2D26] text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Search chairs, tables, tents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-base"
                />
              </div>
            </div>

            {/* Product Cards: 1 Column on Phones, 2 on Tablets, 3 on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCatalog.map((item) => {
                const avail = availability[item.id]?.remainingStock ?? item.totalStock;
                const qtyInCart = cart[item.id] || 0;
                const stockBadge = getStockBadgeStyle(avail, item.totalStock);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col"
                  >
                    <div className="relative h-52 bg-gray-100">
                      <img
                        src={toWebpUrl(item.imageUrl, 600, 72)}
                        alt={item.name}
                        width={600}
                        height={400}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3 left-3 bg-charcoal-900/85 text-white text-xs font-bold px-3 py-1 rounded-lg">
                        {item.category}
                      </span>
                      <span
                        className={`absolute bottom-3 right-3 text-xs font-bold px-3 py-1 rounded-full shadow border ${stockBadge.badgeClass}`}
                      >
                        {stockBadge.label}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <h2 className="font-heading font-bold text-lg text-gray-900 leading-snug">
                          {item.name}
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-gray-100 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="font-heading text-2xl font-extrabold text-[#7B2D26]">
                              ₱{item.pricePerDay.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-600 ml-1">{item.unitLabel}</span>
                          </div>
                        </div>

                        {qtyInCart > 0 ? (
                          <div className="flex items-center justify-between gap-2 bg-amber-50 p-2 rounded-xl border border-amber-300">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.id, -1)}
                                aria-label={`Decrease ${item.name}`}
                                className="min-w-[44px] min-h-[44px] rounded-xl bg-white border border-gray-300 flex items-center justify-center font-bold"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={avail}
                                value={qtyInCart}
                                onChange={(e) =>
                                  updateCartQty(item.id, parseInt(e.target.value, 10) || 0, true)
                                }
                                className="w-16 min-h-[44px] text-center font-extrabold text-base bg-white border border-gray-300 rounded-xl"
                              />
                              <button
                                type="button"
                                disabled={qtyInCart >= avail}
                                onClick={() => updateCartQty(item.id, 1)}
                                aria-label={`Increase ${item.name}`}
                                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#7B2D26] text-white flex items-center justify-center font-bold disabled:opacity-40"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('book');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="min-h-[44px] bg-[#7B2D26] text-white text-sm font-bold px-3.5 rounded-xl"
                            >
                              Book →
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={avail <= 0}
                            onClick={() =>
                              updateCartQty(item.id, item.category === 'Chairs' ? 10 : 1)
                            }
                            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-gray-200 text-charcoal-900 font-heading font-extrabold text-base transition flex items-center justify-center gap-2"
                          >
                            <Plus className="w-5 h-5" />
                            <span>
                              {avail > 0
                                ? `Add ${item.category === 'Chairs' ? '10 Chairs' : 'to Booking'}`
                                : 'Unavailable on Date'}
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

        {/* ================= PACKAGES TAB (SINGLE COL MOBILE / 2 COL TABLET) ================= */}
        {activeTab === 'packages' && (
          <div className="tab-container">
            <div className="text-center max-w-3xl mx-auto space-y-2">
              <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                All-In Event Sets
              </span>
              <h1 className="font-heading text-2xl sm:text-4xl font-extrabold text-gray-900">
                Complete Table & Chair Packages (20 to 150 Pax)
              </h1>
              <p className="text-base text-gray-600">
                Available for <strong>{formatHumanDate(eventDate)}</strong>. Add a bundle and customize extra items on the next step.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {packagesList.map((pkg) => {
                const avail = availability[pkg.id]?.remainingStock ?? pkg.totalStock;
                const stockBadge = getStockBadgeStyle(avail, pkg.totalStock);
                return (
                  <div
                    key={pkg.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col"
                  >
                    <div className="relative h-56 bg-gray-100">
                      <img
                        src={toWebpUrl(pkg.imageUrl, 700, 72)}
                        alt={pkg.name}
                        width={700}
                        height={440}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {pkg.guestCapacity && (
                        <div className="absolute top-3.5 left-3.5 bg-[#7B2D26] text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow">
                          GOOD FOR {pkg.guestCapacity} PAX
                        </div>
                      )}
                      <span
                        className={`absolute bottom-3.5 right-3.5 text-xs font-bold px-3 py-1 rounded-full border shadow ${stockBadge.badgeClass}`}
                      >
                        {avail} sets available on {formatHumanDate(eventDate)}
                      </span>
                    </div>

                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-5">
                      <div className="space-y-3">
                        <h2 className="font-heading text-xl font-extrabold text-gray-900 leading-snug">
                          {pkg.name}
                        </h2>
                        <p className="text-base text-gray-600 leading-relaxed">{pkg.description}</p>

                        {pkg.includedItems && (
                          <div className="bg-[#FAF8F5] rounded-xl p-3.5 border border-gray-200 space-y-1.5">
                            <div className="text-xs font-bold uppercase text-gray-500">
                              Package Inclusions:
                            </div>
                            {pkg.includedItems.map((inc, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                              >
                                <CheckCircle2 className="w-4 h-4 text-[#7B2D26] shrink-0" />
                                <span>
                                  {inc.quantity} × {inc.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-100 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div className="font-heading text-2xl font-extrabold text-[#7B2D26]">
                            ₱{pkg.pricePerDay.toLocaleString()}
                            <span className="text-sm font-normal text-gray-500 ml-1">/ day</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={avail <= 0}
                          onClick={() => {
                            updateCartQty(pkg.id, 1, true);
                            setActiveTab('book');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-full min-h-[48px] bg-amber-400 hover:bg-amber-300 disabled:bg-gray-200 text-charcoal-900 font-heading font-extrabold text-base px-5 py-3 rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                        >
                          <span>Add & Book Package</span>
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= BOOKING FORM & CONFIRMATION TAB (MOBILE FIX #6) ================= */}
        {activeTab === 'book' && (
          <div className="tab-container">
            {confirmedBooking ? (
              <div className="max-w-3xl mx-auto bg-white rounded-2xl border-2 border-[#7B2D26] shadow-xl overflow-hidden">
                <div className="bg-[#7B2D26] text-white p-6 sm:p-8 text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-8 h-8 text-amber-300" />
                  </div>
                  <span className="text-sm uppercase tracking-widest font-bold text-amber-200">
                    Booking Request Received
                  </span>
                  <h1 className="font-heading text-2xl sm:text-3xl font-extrabold">
                    Thank You, {confirmedBooking.customerName}!
                  </h1>
                  <p className="text-base text-white/90">Your booking reference number is:</p>
                  <div className="inline-block bg-white text-[#7B2D26] font-heading font-extrabold text-xl sm:text-2xl px-6 py-2.5 rounded-xl shadow-md tracking-wider mt-2">
                    {confirmedBooking.referenceNumber}
                  </div>
                </div>

                <div className="p-5 sm:p-8 space-y-6">
                  {smsPreview && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm space-y-1.5">
                      <div className="font-bold text-green-900 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-green-700" />
                        <span>SMS & Email Confirmation Sent:</span>
                      </div>
                      <p className="text-green-900 bg-white p-3 rounded-xl border border-green-100">
                        {smsPreview}
                      </p>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2 text-sm sm:text-base">
                    <div className="font-heading font-extrabold text-charcoal-900 text-lg">
                      Next Step: {settings.depositPercent}% Reservation Deposit (₱
                      {confirmedBooking.depositRequired.toLocaleString()})
                    </div>
                    <p className="text-gray-800">
                      To lock in your items for{' '}
                      <strong>{formatHumanDate(confirmedBooking.eventDate)}</strong>, send your deposit via:
                    </p>
                    <div className="bg-white rounded-xl p-3.5 border border-amber-200 space-y-1.5 text-sm">
                      <div>
                        <strong>GCash / Maya:</strong> {settings.gcashNumber} (
                        {settings.gcashAccountName})
                      </div>
                      <div>
                        <strong>Bank Transfer:</strong> {settings.bankDetails}
                      </div>
                      <div>
                        <strong>Cash:</strong> Lemery depot or call {settings.phone}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintBooking(confirmedBooking);
                        setPrintDocType('INVOICE');
                      }}
                      className="min-h-[48px] flex items-center justify-center gap-2 bg-charcoal-900 text-white font-bold text-base px-5 py-3 rounded-xl"
                    >
                      <Printer className="w-5 h-5" />
                      <span>Print Official Quote / Invoice</span>
                    </button>

                    <a
                      href={settings.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[48px] flex items-center justify-center gap-2 bg-[#006AFF] text-white font-bold text-base px-5 py-3 rounded-xl"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>Send Ref # on Messenger</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <form
                  onSubmit={handleBookingSubmit}
                  className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-8 space-y-6"
                >
                  <div className="border-b border-gray-100 pb-4">
                    <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                      Online Reservation
                    </span>
                    <h1 className="font-heading text-2xl font-extrabold text-gray-900 mt-1">
                      Complete Your Event Booking
                    </h1>
                  </div>

                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Step 1: Event Schedule */}
                  <div className="space-y-4">
                    <h2 className="font-heading text-base font-extrabold text-[#7B2D26]">
                      1. Event Date & Delivery Time
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Start Date ({formatHumanDate(eventDate)}) *
                        </label>
                        <input
                          type="date"
                          required
                          min={getTodayStr()}
                          value={eventDate}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Return Date ({formatHumanDate(returnDate)}) *
                        </label>
                        <input
                          type="date"
                          required
                          min={eventDate}
                          value={returnDate}
                          onChange={(e) => handleReturnDateChange(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Delivery Time *
                        </label>
                        <select
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base font-medium bg-white"
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
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-base font-extrabold text-[#7B2D26]">
                        2. Selected Rental Items ({formatItemCount(totalCartUnits)})
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('catalog')}
                        className="min-h-[44px] text-sm font-bold text-[#7B2D26] underline"
                      >
                        + Browse Catalog
                      </button>
                    </div>

                    {cartItemsDetailed.length === 0 ? (
                      <div className="bg-[#FAF8F5] border border-gray-200 rounded-2xl p-5 text-center space-y-3">
                        <p className="text-base text-gray-700">
                          No items selected yet. Tap a quick-add button below:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {heroQuickItems.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() =>
                                updateCartQty(item.id, item.category === 'Chairs' ? 20 : 1)
                              }
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-gray-300 text-sm font-bold text-gray-900"
                            >
                              + {item.name} (₱{item.pricePerDay})
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {cartItemsDetailed.map(({ item, quantity, maxStock, lineTotal }) => (
                          <div
                            key={item.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-gray-200"
                          >
                            <div className="flex-1">
                              <div className="font-bold text-base text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-600">
                                ₱{item.pricePerDay.toLocaleString()}/day × {rentalDays}d ({maxStock} max)
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, -1)}
                                  aria-label={`Decrease ${item.name}`}
                                  className="min-w-[44px] min-h-[44px] rounded-xl bg-white border border-gray-300 flex items-center justify-center"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  type="number"
                                  inputMode="numeric"
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
                                  className="w-16 min-h-[44px] text-center font-bold text-base rounded-xl border border-gray-300 bg-white"
                                />
                                <button
                                  type="button"
                                  disabled={quantity >= maxStock}
                                  onClick={() => updateCartQty(item.id, 1)}
                                  aria-label={`Increase ${item.name}`}
                                  className="min-w-[44px] min-h-[44px] rounded-xl bg-white border border-gray-300 flex items-center justify-center disabled:opacity-40"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="min-w-[72px] text-right font-extrabold text-base text-[#7B2D26]">
                                ₱{lineTotal.toLocaleString()}
                              </div>

                              <button
                                type="button"
                                onClick={() => updateCartQty(item.id, 0, true)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-red-600"
                                aria-label={`Remove ${item.name}`}
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step 3: Customer & Venue Details with Proper Mobile Keyboard Attributes */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h2 className="font-heading text-base font-extrabold text-[#7B2D26]">
                      3. Customer & Event Venue Details
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          autoComplete="name"
                          required
                          placeholder="e.g., Juan Dela Cruz"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Mobile Number (SMS Confirmation) *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          placeholder="e.g., 0956 403 5020"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Email Address (Optional)
                        </label>
                        <input
                          type="email"
                          name="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Event Type *
                        </label>
                        <select
                          value={eventType}
                          onChange={(e) => setEventType(e.target.value as EventType)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base bg-white"
                        >
                          {EVENT_TYPES.map((ev) => (
                            <option key={ev} value={ev}>
                              {ev}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Municipality / Delivery Zone *
                        </label>
                        <select
                          value={municipality}
                          onChange={(e) => setMunicipality(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base bg-white"
                        >
                          {settings.deliveryZones.map((z) => (
                            <option key={z.municipality} value={z.municipality}>
                              {z.municipality} (₱{z.fee} delivery)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                          Barangay *
                        </label>
                        <input
                          type="text"
                          autoComplete="address-level3"
                          required
                          placeholder="e.g., Brgy. Sambal Ilaya"
                          value={barangay}
                          onChange={(e) => setBarangay(e.target.value)}
                          className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Complete Venue Address & Landmark *
                      </label>
                      <input
                        type="text"
                        autoComplete="street-address"
                        required
                        placeholder="Street, Covered Court / Residence & nearest landmark"
                        value={venueAddress}
                        onChange={(e) => setVenueAddress(e.target.value)}
                        className="w-full min-h-[48px] rounded-xl border border-gray-300 px-3.5 py-2.5 text-base"
                      />
                    </div>
                  </div>

                  {/* Step 4: Payment & Spam Check */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h2 className="font-heading text-base font-extrabold text-[#7B2D26]">
                      4. Payment Method
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['GCash', 'Maya', 'Bank Transfer', 'Cash'] as const).map((method) => (
                        <button
                          type="button"
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`min-h-[48px] py-2.5 px-3 rounded-xl border text-sm font-bold transition ${
                            paymentMethod === method
                              ? 'bg-[#7B2D26] text-white border-[#7B2D26]'
                              : 'bg-white text-gray-800 border-gray-200'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        Notes / Motif Color / Delivery Instructions
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g., Maroon & gold ribbons, deliver before 7:30 AM..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-base"
                      />
                    </div>

                    <input
                      type="text"
                      name="websiteHoneypot"
                      value={websiteHoneypot}
                      onChange={(e) => setWebsiteHoneypot(e.target.value)}
                      className="hidden"
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    <div className="flex items-center justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-200 gap-3">
                      <label
                        htmlFor="human-spam-check"
                        className="text-sm font-bold text-gray-800"
                      >
                        Quick Check: What is 4 + 3? *
                      </label>
                      <input
                        id="human-spam-check"
                        type="number"
                        inputMode="numeric"
                        required
                        placeholder="7"
                        value={humanCheckAnswer}
                        onChange={(e) => setHumanCheckAnswer(e.target.value)}
                        className="w-24 min-h-[48px] rounded-xl border border-gray-300 px-3 py-2 text-base font-bold text-center bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || cartItemsDetailed.length === 0}
                    className="w-full min-h-[52px] bg-amber-400 hover:bg-amber-300 disabled:bg-gray-200 text-charcoal-900 font-heading font-extrabold py-4 rounded-xl text-base shadow-md transition"
                  >
                    {submitting
                      ? 'Submitting Booking...'
                      : `Confirm Booking • Total ₱${quote.total.toLocaleString()}`}
                  </button>
                </form>

                {/* Auto-Computed Quote Summary Sidebar */}
                <div className="lg:col-span-5 lg:sticky lg:top-20 bg-white rounded-2xl border-2 border-[#7B2D26] shadow-md overflow-hidden">
                  <div className="bg-[#7B2D26] text-white px-5 py-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Auto-Computed Rental Quote
                    </div>
                    <div className="text-base font-extrabold mt-0.5">
                      {formatHumanDate(eventDate)} → {formatHumanDate(returnDate)} ({rentalDays}{' '}
                      {rentalDays === 1 ? 'Day' : 'Days'})
                    </div>
                  </div>

                  <div className="p-5 space-y-4 text-sm">
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-gray-700">
                        <span>Items Subtotal ({formatItemCount(totalCartUnits)}):</span>
                        <span className="font-bold">₱{quote.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>Delivery & Pickup:</span>
                        <span className="font-bold">₱{quote.deliveryFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>Setup & Takedown:</span>
                        <span className="font-bold">₱{quote.setupFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-extrabold text-gray-900 pt-3 border-t border-gray-200">
                        <span>Total Rental Quote:</span>
                        <span className="text-[#7B2D26]">₱{quote.total.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-1">
                      <div className="flex justify-between items-center font-extrabold text-charcoal-900 text-base">
                        <span>Required Deposit ({settings.depositPercent}%):</span>
                        <span>₱{quote.depositRequired.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Balance on Delivery:</span>
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
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
            <div className="card-panel space-y-5">
              <div className="space-y-1">
                <h1 className="font-heading text-2xl font-extrabold text-gray-900">
                  Track Your Booking
                </h1>
                <p className="text-base text-gray-600">
                  Enter your reference number (e.g., <strong>MMC-2026-1001</strong>) to check delivery status or upload deposit proof.
                </p>
              </div>

              <form
                onSubmit={(e) => handleTrackBooking(e)}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  placeholder="Enter Booking Ref (e.g., MMC-2026-1001)"
                  value={trackRefInput}
                  onChange={(e) => setTrackRefInput(e.target.value)}
                  className="flex-1 min-h-[48px] rounded-xl border border-gray-300 px-4 py-3 text-base font-bold uppercase"
                />
                <button
                  type="submit"
                  className="min-h-[48px] bg-[#7B2D26] hover:bg-[#5E201A] text-white font-bold px-6 py-3 rounded-xl text-base shadow-xs transition"
                >
                  Search Booking
                </button>
              </form>

              {trackError && (
                <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">
                  {trackError}
                </div>
              )}
            </div>

            {trackedBooking && (
              <div className="card-panel space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-sm font-bold text-[#7B2D26]">
                      {trackedBooking.eventType} • {formatHumanDate(trackedBooking.eventDate)}
                    </span>
                    <h2 className="font-heading text-xl font-extrabold text-gray-900">
                      {trackedBooking.referenceNumber} — {trackedBooking.customerName}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintBooking(trackedBooking);
                      setPrintDocType('RECEIPT');
                    }}
                    className="min-h-[44px] flex items-center gap-2 bg-charcoal-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Receipt / Invoice</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-4 rounded-xl border border-gray-200 text-sm">
                  <div>
                    <div className="text-gray-600">Total</div>
                    <div className="text-base font-extrabold text-gray-900">
                      ₱{trackedBooking.totalAmount.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Deposit</div>
                    <div className="text-base font-extrabold text-[#7B2D26]">
                      ₱{trackedBooking.depositRequired.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Paid</div>
                    <div className="text-base font-extrabold text-green-700">
                      ₱{trackedBooking.amountPaid.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Balance</div>
                    <div className="text-base font-extrabold text-amber-800">
                      ₱{trackedBooking.balanceDue.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= GALLERY TAB (MOBILE FIX #5: 2-COL GRID + TAP-TO-ZOOM LIGHTBOX) ================= */}
        {activeTab === 'gallery' && (
          <div className="tab-container">
            <div className="text-center max-w-2xl mx-auto space-y-1.5">
              <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                Real Setups in Lemery & Taal
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-gray-900">
                Event Setup Gallery (Tap Any Photo to Zoom)
              </h1>
              <p className="text-base text-gray-600">
                Actual wedding, debut, birthday, and fiesta setups across Batangas.
              </p>
            </div>

            {/* 2-Column Grid on Mobile (`grid-cols-2 md:grid-cols-3`) with Tap-to-Zoom Lightbox */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              {gallery.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setLightboxItem(g)}
                  className="group text-left bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                >
                  <div className="relative h-36 sm:h-52 w-full bg-gray-100">
                    <img
                      src={toWebpUrl(g.imageUrl, 500, 72)}
                      alt={g.title}
                      width={500}
                      height={360}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <span className="absolute bottom-2 right-2 bg-black/75 text-white p-1.5 rounded-lg">
                      <ZoomIn className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="p-3 sm:p-4 space-y-1">
                    <div className="text-xs font-bold text-[#7B2D26]">
                      {g.eventType} • {g.guestCount} Pax
                    </div>
                    <h2 className="font-heading font-bold text-sm sm:text-base text-gray-900 line-clamp-2">
                      {g.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600">{g.location}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Tap-to-Zoom Lightbox Modal */}
            {lightboxItem && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={lightboxItem.title}
                onClick={() => setLightboxItem(null)}
                className="fixed inset-0 z-50 bg-black/85 p-4 flex items-center justify-center"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl"
                >
                  <div className="relative bg-black">
                    <img
                      src={toWebpUrl(lightboxItem.imageUrl, 1200, 80)}
                      alt={lightboxItem.title}
                      width={1200}
                      height={800}
                      className="w-full max-h-[65vh] object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxItem(null)}
                      aria-label="Close photo zoom"
                      className="absolute top-3 right-3 min-w-[44px] min-h-[44px] rounded-full bg-black/75 text-white flex items-center justify-center"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="p-5 space-y-1.5">
                    <div className="text-sm font-bold text-[#7B2D26]">
                      {lightboxItem.eventType} • {lightboxItem.guestCount} Pax •{' '}
                      {lightboxItem.location}
                    </div>
                    <h3 className="font-heading font-bold text-lg text-gray-900">
                      {lightboxItem.title}
                    </h3>
                    <p className="text-base text-gray-700">{lightboxItem.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= FAQ & RENTAL TERMS TAB (MOBILE FIX #5: ACCORDION) ================= */}
        {activeTab === 'terms' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
            <div className="text-center space-y-2">
              <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                Answers & Rental Policies
              </span>
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-gray-900">
                Frequently Asked Questions & Rental Terms
              </h1>
            </div>

            {/* FAQ Accordion with Large Tap Targets (min 52px tall) */}
            <div className="card-panel space-y-3">
              <h2 className="font-heading text-lg font-extrabold text-[#7B2D26] flex items-center gap-2 pb-1">
                <HelpCircle className="w-5 h-5" />
                <span>Tap a Question to View Answer</span>
              </h2>

              <div className="space-y-2.5">
                {faqList.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-gray-200 bg-[#FAF8F5] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full min-h-[52px] px-4 py-3.5 text-left font-heading font-bold text-base text-gray-900 flex items-center justify-between gap-3"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={`w-5 h-5 text-[#7B2D26] shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-base text-gray-700 leading-relaxed border-t border-gray-200/60 bg-white">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rental Terms Summary */}
            <div className="card-panel space-y-4">
              <h2 className="font-heading text-lg font-extrabold text-[#7B2D26]">
                Official Rental Terms
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-gray-200 space-y-1">
                  <h3 className="font-bold text-gray-900">
                    1. {settings.depositPercent}% Reservation Deposit
                  </h3>
                  <p className="text-sm text-gray-700">
                    A {settings.depositPercent}% deposit locks your items for your event date. Balance is due upon delivery.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-gray-200 space-y-1">
                  <h3 className="font-bold text-gray-900">2. Rescheduling & Cancellation</h3>
                  <p className="text-sm text-gray-700">
                    Free date rescheduling up to 72 hours before your event (subject to stock availability).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= CONTACT & MAP TAB (MOBILE FIX #5: STACKED, 260-300PX MAP, GET DIRECTIONS & CALL NOW) ================= */}
        {activeTab === 'contact' && (
          <div className="tab-container">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 card-panel space-y-5">
                <div className="space-y-1">
                  <span className="text-sm font-extrabold uppercase tracking-wider text-[#7B2D26]">
                    Lemery & Taal, Batangas
                  </span>
                  <h1 className="font-heading text-2xl font-extrabold text-gray-900">
                    Contact {settings.businessName}
                  </h1>
                  <p className="text-base text-gray-600">
                    Call, text, or message us on Facebook for bookings and barangay delivery quotes.
                  </p>
                </div>

                {/* Prominent "Call Now" and "Get Directions" Buttons (min 48px height) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={`tel:${cleanPhone}`}
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-[#7B2D26] hover:bg-[#5E201A] text-white font-heading font-bold text-base flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Phone className="w-5 h-5 text-amber-300" />
                    <span>Call Now</span>
                  </a>
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=13.8844,120.9136"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-charcoal-900 font-heading font-extrabold text-base flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Navigation className="w-5 h-5" />
                    <span>Get Directions</span>
                  </a>
                </div>

                <div className="space-y-3 text-base">
                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-gray-200">
                    <div className="text-xs font-bold uppercase text-gray-500">
                      Phone / GCash / Viber
                    </div>
                    <a
                      href={`tel:${cleanPhone}`}
                      className="font-extrabold text-lg text-[#7B2D26] underline"
                    >
                      {settings.phone}
                    </a>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-gray-200">
                    <div className="text-xs font-bold uppercase text-gray-500">
                      Facebook Messenger
                    </div>
                    <a
                      href={settings.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-blue-700 underline"
                    >
                      {settings.messengerName}
                    </a>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-gray-200">
                    <div className="text-xs font-bold uppercase text-gray-500">Depot & Coverage</div>
                    <div className="font-bold text-gray-900">{settings.baseAddress}</div>
                    <div className="text-sm text-gray-600">{settings.serviceArea}</div>
                  </div>
                </div>
              </div>

              {/* Map Stacked Below on Mobile (260–300px height on mobile) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-heading font-bold text-base text-gray-900">
                      Service Area Map — Lemery & Taal, Batangas
                    </h2>
                    <p className="text-sm text-gray-600">
                      Fast truck delivery across all barangays of Lemery and Taal
                    </p>
                  </div>
                </div>
                <iframe
                  title="MMC Set n Seat Rentals Service Area Map - Lemery and Taal Batangas"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=120.8650%2C13.8450%2C120.9650%2C13.9250&amp;layer=mapnik&amp;marker=13.8844%2C120.9136"
                  className="w-full h-[270px] sm:h-[320px] lg:flex-1 border-0"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          MOBILE FIX #5: STACKED, CENTERED MOBILE FOOTER WITH LARGE TAPPABLE LINKS
      ===================================================================== */}
      <footer className="bg-charcoal-900 text-gray-300 py-10 sm:py-14 border-t border-gray-800 no-print">
        <div className="layout-container grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left text-sm">
          <div className="space-y-3 flex flex-col items-center md:items-start">
            <div className="flex items-center gap-3">
              <img
                src={getAssetPath('/logo.jpg')}
                alt="MMC Set n Seat Rentals"
                width={48}
                height={48}
                loading="lazy"
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400"
              />
              <div className="text-left">
                <div className="font-heading font-extrabold text-white text-base">
                  {settings.businessName}
                </div>
                <div className="text-xs text-amber-400 font-bold">
                  Chairs • Tables • Tents • Videoke
                </div>
              </div>
            </div>
            <p className="text-gray-400 max-w-sm leading-relaxed">{settings.tagline}</p>
            <p className="text-amber-300 font-semibold">
              GCash • Maya • Bank Transfer • Cash
            </p>
          </div>

          <div className="space-y-1 flex flex-col items-center md:items-start">
            <div className="font-heading font-bold text-white uppercase text-sm mb-1">
              Quick Navigation
            </div>
            {[
              { id: 'catalog', label: 'Chairs, Tables & Tents' },
              { id: 'packages', label: 'Party Packages (20–150 Pax)' },
              { id: 'gallery', label: 'Event Setup Gallery' },
              { id: 'terms', label: 'FAQ & Rental Terms' },
              { id: 'track', label: 'Track Booking by Reference #' },
            ].map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  setActiveTab(link.id as CustomerTab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="min-h-[44px] inline-flex items-center text-gray-300 hover:text-white font-medium"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 flex flex-col items-center md:items-start">
            <div className="font-heading font-bold text-white uppercase text-sm">
              Contact & Dispatch Hours
            </div>
            <div>📍 {settings.serviceArea}</div>
            <a
              href={`tel:${cleanPhone}`}
              className="min-h-[44px] inline-flex items-center font-bold text-amber-300 hover:underline"
            >
              📞 {settings.phone}
            </a>
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center text-amber-300 hover:underline"
            >
              💬 Messenger: {settings.messengerName}
            </a>
            <div className="text-gray-400">Open Daily: 7:00 AM – 8:00 PM</div>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MOBILE FIX #3: STICKY BOTTOM BAR ON MOBILE (APPEARS ONCE ITEMS ARE ADDED)
          - Shows "X item(s) selected — Estimated total ₱___" with a "Continue" button
      ===================================================================== */}
      {showMobileStickyBar && (
        <div
          style={{
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          }}
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t-2 border-[#7B2D26] px-4 pt-3 flex items-center justify-between gap-3 shadow-2xl no-print"
        >
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-600">
              {formatItemCount(totalCartUnits)} selected ({formatHumanDate(eventDate)})
            </div>
            <div className="text-base font-heading font-extrabold text-[#7B2D26] truncate">
              Estimated total ₱{quote.total.toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmedBooking(null);
              setActiveTab('book');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="shrink-0 min-h-[44px] bg-amber-400 hover:bg-amber-300 active:scale-95 text-charcoal-900 font-heading font-extrabold text-sm px-5 py-2.5 rounded-xl shadow flex items-center gap-1.5"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MOBILE FIX #4: Floating Chat Button (shifts up automatically when sticky bar is visible) */}
      <FloatingChatButton settings={settings} hasStickyBar={showMobileStickyBar} />

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
