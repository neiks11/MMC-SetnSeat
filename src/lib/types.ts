export type InventoryCategory = 'Chairs' | 'Tables' | 'Packages' | 'Add-ons';

export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Out for Delivery'
  | 'In Use'
  | 'Returned'
  | 'Completed'
  | 'Cancelled';

export type PaymentStatus = 'Unpaid' | 'Deposit Paid' | 'Fully Paid' | 'Refunded';

export type EventType =
  | 'Wedding'
  | 'Birthday'
  | 'Debut'
  | 'Funeral / Wake'
  | 'Fiesta'
  | 'Corporate Event'
  | 'School Function'
  | 'Baptism / Christening'
  | 'Other Gathering';

export interface PackageComponent {
  itemId: string;
  label: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  description: string;
  pricePerDay: number;
  totalStock: number;
  imageUrl: string;
  featured: boolean;
  active: boolean;
  guestCapacity?: number;
  includedItems?: PackageComponent[];
  replacementFee: number;
  unitLabel: string; // e.g., "per chair / day", "per table / day", "per package / day"
}

export interface BookingItemLine {
  id: string;
  itemId: string;
  itemName: string;
  category: InventoryCategory;
  quantity: number;
  pricePerDay: number;
  lineTotal: number; // quantity * pricePerDay * rentalDays
}

export interface PaymentLog {
  id: string;
  bookingId: string;
  amount: number;
  type: 'Deposit' | 'Balance' | 'Full Payment' | 'Damage Fee';
  method: 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer';
  referenceNo?: string;
  proofImageUrl?: string;
  verifiedByAdmin: boolean;
  createdAt: string;
}

export interface DamageLog {
  id: string;
  bookingId: string;
  referenceNumber: string;
  customerName: string;
  itemName: string;
  issueType: 'Damaged' | 'Missing / Lost' | 'Stained / Torn' | 'Late Return';
  quantity: number;
  feeCharged: number;
  resolved: boolean;
  notes?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  referenceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  eventType: EventType;
  eventDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  rentalDays: number;
  eventTime: string; // e.g., "09:00 AM"
  municipality: string; // Lemery, Taal, etc.
  barangay: string;
  venueAddress: string;
  fulfillmentType: 'Delivery' | 'Customer Pickup';
  includeSetup: boolean;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer';
  subtotal: number;
  deliveryFee: number;
  setupFee: number;
  discountAmount: number;
  discountCode?: string;
  damageFeeTotal: number;
  totalAmount: number;
  depositRequired: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  adminNotes?: string;
  consentTimestamp?: string;
  privacyPolicyVersion?: string;
  termsVersion?: string;
  createdAt: string;
  updatedAt: string;
  items: BookingItemLine[];
  payments: PaymentLog[];
  damageLogs: DamageLog[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  municipality: string;
  address: string;
  totalBookings: number;
  totalSpent: number;
  lastEventDate: string;
  notes?: string;
  createdAt: string;
}

export interface DeliveryZoneRate {
  municipality: string;
  fee: number;
  etaNote: string;
}

export interface BusinessSettings {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  facebookUrl: string;
  messengerName: string;
  serviceArea: string;
  baseAddress: string;
  depositPercent: number;
  defaultDeliveryFee: number;
  defaultSetupFee: number;
  setupFeePerSeat: number;
  freeDeliveryMinOrder: number;
  lateReturnFeePerDayPercent: number;
  gcashNumber: string;
  gcashAccountName: string;
  mayaNumber: string;
  bankDetails: string;
  deliveryZones: DeliveryZoneRate[];
  promoCodes: { code: string; discountPercent: number; description: string; active: boolean }[];
  adminUsername: string;
  adminPassword: string;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
}

export interface NotificationAlert {
  id: string;
  type: 'NEW_BOOKING' | 'PAYMENT_UPLOADED' | 'STATUS_CHANGE' | 'DAMAGE_LOGGED';
  title: string;
  message: string;
  referenceNumber?: string;
  read: boolean;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  eventType: EventType;
  location: string;
  guestCount: number;
  imageUrl: string;
  description: string;
  date: string;
}

export type ReviewModerationStatus = 'approved' | 'pending' | 'rejected';

export interface ReviewItem {
  id: string;
  bookingReference?: string;
  verifiedBooking?: boolean;
  customerName: string;
  eventType: EventType;
  location: string;
  rating: number;
  comment: string;
  date: string;
  status?: ReviewModerationStatus;
  flags?: string[];
  moderationReason?: string;
  ownerResponse?: string;
  ownerResponseDate?: string;
  reportCount?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: 'admin' | 'staff' | 'customer' | 'anonymous';
  action: string;
  targetId?: string;
  ip?: string;
  details: string;
}

export interface DatabaseSchema {
  settings: BusinessSettings;
  inventory: InventoryItem[];
  bookings: Booking[];
  customers: Customer[];
  damageLogs: DamageLog[];
  notifications: NotificationAlert[];
  gallery: GalleryItem[];
  reviews: ReviewItem[];
  auditLogs?: AuditLogEntry[];
}
