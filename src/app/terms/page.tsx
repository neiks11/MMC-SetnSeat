import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Rental Terms & Conditions | MMC Set n Seat Rentals',
  description:
    'Terms and Conditions for renting chairs, tables, tents, and videoke equipment from MMC Set n Seat Rentals in Lemery & Taal, Batangas.',
};

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F5] text-stone-900 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-10 space-y-6">
        <div className="border-b border-stone-200 pb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#7B2D26] hover:underline mb-3"
          >
            ← Back to MMC Set n Seat Rentals
          </Link>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-[#7B2D26]">
            Equipment Rental Agreement & Review Guidelines
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
            Terms and Conditions of Rental
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Effective Date: November 6, 2026 | Terms Version: 2026-11
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950">
          <strong>Legal Review Notice:</strong> These Terms and Conditions govern event equipment rentals from{' '}
          <strong>[BUSINESS LEGAL NAME] (MMC Set n Seat Rentals)</strong> in Lemery, Taal, and nearby Batangas
          municipalities. Bracketed placeholders should be finalized with a Philippine lawyer before publishing.
        </div>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            1. Booking Confirmation & 30% Reservation Deposit
          </h2>
          <p>
            Submitting an online booking request places a temporary pending hold on the requested inventory. A
            booking is officially <strong>Confirmed</strong> once the required <strong>thirty percent (30%)
            downpayment/deposit</strong> is received and verified by our team via GCash, Maya, Bank Transfer
            (BDO/BPI), or in-person cash payment at our Lemery depot. The remaining <strong>seventy percent
            (70%) balance</strong> is due upon delivery/setup at the venue or upon customer pickup.
          </p>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            2. Cancellation, Rescheduling & Refund Policy
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Free Rescheduling:</strong> Customers may reschedule their event date once free of
              charge if requested at least <strong>seventy-two (72) hours (3 days)</strong> prior to the
              scheduled delivery date, subject to stock availability on the new date.
            </li>
            <li>
              <strong>Cancellations 7+ Days Before Event:</strong> Eligible for a full refund of the deposit
              (less any actual payment gateway transfer fees) or 100% credit toward a future booking within 6
              months.
            </li>
            <li>
              <strong>Cancellations Within 72 Hours of Event:</strong> The 30% reservation deposit is
              non-refundable as inventory and delivery crew slots were blocked from other customers, but may
              be applied as a 50% credit toward a rescheduled date within 60 days at management&rsquo;s
              discretion.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            3. Delivery, Venue Access, Setup & Pickup
          </h2>
          <p>
            Delivery fees are calculated transparently based on your municipality/barangay zone (free delivery
            applies to qualifying orders meeting the published minimum subtotal). The customer must ensure
            clear truck/drop-off access within 30 meters of the setup area. Standard rental rates cover a{' '}
            <strong>24-hour / per-day rental period</strong> unless multi-day rental is booked.
          </p>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            4. Late Return Fees, Damage & Loss Liability
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Care of Equipment:</strong> All chairs, tables, seat covers, satin ribbons, tents,
              chafing dishes, and videoke units remain the property of <strong>MMC Set n Seat Rentals</strong>.
            </li>
            <li>
              <strong>Damaged, Stained, Burned, or Missing Items:</strong> The customer is responsible for
              items from the moment of delivery/pickup until retrieval by our crew. Permanent stains, cigarette
              burns, torn linens, broken frames, water-damaged videoke electronics, or missing items will be
              charged at the item&rsquo;s published <strong>Replacement / Repair Fee</strong> listed in our catalog
              and on your Delivery Checklist Slip.
            </li>
            <li>
              <strong>Unscheduled Late Extensions:</strong> Unapproved delays preventing scheduled pickup
              incur a late fee of <strong>50% of the daily rental rate per additional day</strong>.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            5. Severe Weather, Typhoons & Tent Safety (Force Majeure)
          </h2>
          <p>
            Canopy and pagoda tents provide shade and light-to-moderate rain shelter but are{' '}
            <strong>temporary structures not engineered for typhoon-force winds, PAGASA Tropical Cyclone Wind
            Signals, severe squalls, or volcanic ashfall</strong>. In the event of severe weather warnings in
            Batangas, we reserve the right to decline tent installation or dismantle tents early for guest
            safety. Customers must evacuate temporary tents immediately during high winds or lightning.
          </p>
        </section>

        <section id="review-guidelines" className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            6. Published Customer Review Guidelines & Moderation Policy
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Verified Bookings Only:</strong> Only customers with a <code>Completed</code> or{' '}
              <code>Returned</code> booking reference number may post a review (limited to one review per
              booking).
            </li>
            <li>
              <strong>Honest Negative Reviews Are Protected:</strong> We never suppress, edit, or delete a
              review simply because it expresses a low star rating or honest criticism of our service.
            </li>
            <li>
              <strong>Grounds for Moderation / Removal:</strong> Reviews are held in our moderation queue or
              removed only if they contain: (a) spam links, URLs, or third-party promotional codes; (b)
              profanity, hate speech, threats, or personal doxxing; (c) duplicate copy-pasted text; or (d)
              fraudulent submissions unrelated to an actual rental experience.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            7. Limitation of Liability, Governing Law & Dispute Resolution
          </h2>
          <p>
            To the maximum extent permitted under Philippine law, our total liability for any claim arising
            from a rental booking shall not exceed the total rental amount paid by the customer for that
            booking. These Terms are governed by the laws of the <strong>Republic of the Philippines</strong>
            (including Republic Act No. 7394, the Consumer Act of the Philippines). Any dispute not resolved
            through good-faith negotiation shall be brought exclusively before the proper courts of{' '}
            <strong>Lemery or Taal, Batangas, Philippines</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
