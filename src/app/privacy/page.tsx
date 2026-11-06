import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy (RA 10173) | MMC Set n Seat Rentals',
  description:
    'Data Privacy Notice and Privacy Policy of MMC Set n Seat Rentals in compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).',
};

export default function PrivacyPolicyPage() {
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
            Republic Act No. 10173 (Philippine Data Privacy Act of 2012)
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
            Privacy Policy & Data Privacy Notice
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Effective Date: November 6, 2026 | Policy Version: 2026-11-RA10173
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950">
          <strong>Legal Review Notice:</strong> This Privacy Policy is drafted specifically for{' '}
          <strong>MMC Set n Seat Rentals</strong> in alignment with the Philippine Data Privacy Act of 2012
          (RA 10173), its Implementing Rules and Regulations (IRR), National Privacy Commission (NPC)
          circulars, and baseline GDPR/CCPA principles. Placeholders in brackets (such as{' '}
          <code>[BUSINESS LEGAL NAME]</code> and <code>[DPO NAME]</code>) should be completed by the business
          owner and reviewed by a Philippine-licensed lawyer prior to formal commercial filing.
        </div>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            1. Identity of the Personal Information Controller (PIC)
          </h2>
          <p>
            <strong>[BUSINESS LEGAL NAME]</strong>, doing business under the trade name{' '}
            <strong>MMC Set n Seat Rentals</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;),
            located at <strong>[ADDRESS — e.g., Poblacion / Diversion Rd., Lemery, Batangas, Philippines 4209]</strong>,
            is the Personal Information Controller (PIC) responsible for collecting, processing, and protecting
            your personal data under Republic Act No. 10173.
          </p>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">2. Personal Data We Collect</h2>
          <p>When you check availability, submit a rental booking, upload payment proof, or post a verified review, we collect only the minimum personal data necessary:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Identity & Contact Data:</strong> Full name, Philippine mobile/landline number (e.g.,{' '}
              <code>09XX XXX XXXX</code>), and optional email address.
            </li>
            <li>
              <strong>Event & Delivery Location Data:</strong> Event type, event start and return dates, event
              time, municipality/town (e.g., Lemery, Taal, Agoncillo, Calaca), barangay, and specific venue
              delivery address or landmark.
            </li>
            <li>
              <strong>Transaction & Payment Verification Data:</strong> Rental items selected, subtotal,
              delivery/setup fees, payment method (GCash, Maya, Bank Transfer, or Cash), reference number, and
              optional screenshot of deposit proof. <em>We do not collect or store credit/debit card numbers or e-wallet PINs/MPINs.</em>
            </li>
            <li>
              <strong>Technical, Security & Consent Logs:</strong> IP address (hashed with a daily rotating
              salt and deleted after 30 days for abuse prevention; raw IP addresses are never stored in visitor
              logs), timestamp of privacy/terms consent, and cookie preferences.
            </li>
            <li>
              <strong>Opt-In Privacy-First Visitor Logs (Only After Cookie Banner Consent):</strong> If you
              click &ldquo;Accept All&rdquo; or enable Analytics in our Cookie Banner (and your browser does not send a
              Do Not Track or Global Privacy Control signal), our first-party logger records an in-memory-only
              anonymous session ID (no cookies), UTC &amp; Asia/Manila timestamp, page path, referrer domain,
              UTM tags, device type (Mobile/Tablet/Desktop), browser/OS family, screen dimensions, approximate
              region, and non-PII interaction counts (dates checked, items added to quote, FAQ opened, or
              runtime script errors). <strong>We never log your name, phone number, address, or form input
              contents in visitor logs.</strong> Visitor logs are automatically deleted after 90 days and are
              accessible only to authenticated administrators at <code>/admin/logs</code>.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            3. Purpose and Lawful Basis for Processing (RA 10173 Sec. 12 & GDPR Art. 6)
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Contractual Necessity (RA 10173 Sec. 12(b)):</strong> To reserve rental inventory,
              deliver and pick up chairs, tables, tents, and videoke units at your venue, verify your deposit,
              and communicate delivery updates via SMS, call, or Messenger.
            </li>
            <li>
              <strong>Explicit Consent (RA 10173 Sec. 12(a)):</strong> Recorded via an unchecked consent
              checkbox before booking submission and via our Cookie Consent Banner before loading optional
              analytics scripts.
            </li>
            <li>
              <strong>Legal Obligation (RA 10173 Sec. 12(c)):</strong> To issue official receipts/invoices and
              comply with Bureau of Internal Revenue (BIR) and municipal bookkeeping regulations.
            </li>
            <li>
              <strong>Legitimate Interests (RA 10173 Sec. 12(f)):</strong> To prevent double-booking, detect
              fraudulent/spam reviews, enforce rate limits, and protect equipment against loss or damage.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            4. Data Retention Schedule & Disposal
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Active & Completed Bookings:</strong> Retained for <strong>three (3) years</strong> from
              the date of event completion for customer repeat-booking convenience, damage/deposit
              reconciliation, and local tax/audit compliance, after which records are securely anonymized or
              purged.
            </li>
            <li>
              <strong>Payment Proof Screenshots:</strong> Retained for <strong>ninety (90) days</strong> after
              full payment settlement and reconciliation, then deleted.
            </li>
            <li>
              <strong>Security & Rate-Limit Logs:</strong> Retained for up to <strong>ninety (90) days</strong>.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            5. Data Sharing, Third-Party Processors & Cross-Border Transfers
          </h2>
          <p>
            <strong>We do NOT sell, rent, or trade your personal information to any third party</strong> (&ldquo;Do
            Not Sell or Share My Personal Information&rdquo; under CCPA/CPRA). We share data only with essential
            service providers acting under strict confidentiality and data processing terms:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Cloud Database & Hosting:</strong> Google Firebase (Realtime Database / Cloud Firestore)
              and GitHub Pages / Vercel (encrypted in transit via TLS 1.3 and at rest). Data may be processed
              on secure cloud servers outside the Philippines in accordance with RA 10173 Sec. 21 cross-border
              accountability principles.
            </li>
            <li>
              <strong>Payment Channels:</strong> GCash (G-Xchange, Inc.), Maya, or Philippine banking
              institutions when you initiate a deposit transfer.
            </li>
            <li>
              <strong>Maps & Analytics:</strong> Google Maps (embedded venue/depot map) and Google Analytics
              (loaded strictly after you opt in via the Cookie Banner).
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            6. Your Rights as a Data Subject (RA 10173 Sec. 16)
          </h2>
          <p>Under the Philippine Data Privacy Act of 2012, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Right to Be Informed</strong> about how your personal data is collected and used.</li>
            <li><strong>Right to Access</strong> a copy of the personal data we hold about your bookings.</li>
            <li><strong>Right to Object</strong> or withdraw consent to non-essential processing at any time.</li>
            <li><strong>Right to Rectification</strong> of inaccurate or outdated contact or venue details.</li>
            <li><strong>Right to Erasure or Blocking</strong> of personal data no longer required by law or active contract.</li>
            <li><strong>Right to Data Portability</strong> in a structured, commonly used electronic format.</li>
            <li><strong>Right to Damages and to File a Complaint</strong> before the <strong>National Privacy Commission (NPC)</strong> at <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="underline text-[#7B2D26]">https://privacy.gov.ph</a>.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">
            7. Security Measures & Personal Data Breach Notification
          </h2>
          <p>
            We implement organizational, physical, and technical security measures including HTTPS/TLS
            encryption, memory-hard password hashing (<code>scrypt</code>), HttpOnly session cookies, public
            lookup PII masking, rate limiting, and access-controlled database rules. In the event of a
            reportable personal data breach affecting your rights, we will notify the <strong>National Privacy
            Commission (NPC)</strong> and affected Data Subjects within <strong>seventy-two (72) hours</strong> in
            accordance with NPC Circular 16-03.
          </p>
        </section>

        <section className="space-y-2 text-sm sm:text-base leading-relaxed">
          <h2 className="text-lg font-extrabold text-[#7B2D26]">8. Children&rsquo;s Privacy</h2>
          <p>
            Our rental booking services are intended for adults aged eighteen (18) and above entering into
            event rental agreements. Even when equipment is rented for children&rsquo;s birthdays or school
            events, the booking must be submitted by a parent, guardian, or authorized adult representative.
          </p>
        </section>

        <section className="p-4 rounded-xl bg-stone-100 border border-stone-200 space-y-1 text-sm">
          <h2 className="text-base font-extrabold text-[#7B2D26]">
            9. Contact Our Data Protection Officer (DPO)
          </h2>
          <p>To exercise your Data Subject Rights or submit a privacy inquiry, contact:</p>
          <p><strong>Data Protection Officer:</strong> [DPO NAME / OWNER NAME]</p>
          <p><strong>Business Name:</strong> [BUSINESS LEGAL NAME] (MMC Set n Seat Rentals)</p>
          <p><strong>Address:</strong> [ADDRESS — Poblacion / Diversion Rd., Lemery, Batangas, Philippines]</p>
          <p><strong>Email:</strong> [EMAIL — setnseatrentals@gmail.com]</p>
          <p><strong>Phone / SMS:</strong> 0956 403 5020</p>
        </section>
      </div>
    </main>
  );
}
