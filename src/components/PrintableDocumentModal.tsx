'use client';

import React from 'react';
import { Printer, X, CheckCircle2, MapPin, Phone, Mail } from 'lucide-react';
import { Booking, BusinessSettings } from '@/lib/types';

interface PrintableDocumentModalProps {
  booking: Booking;
  settings: BusinessSettings;
  docType: 'RECEIPT' | 'INVOICE' | 'DELIVERY_SLIP';
  onClose: () => void;
  onChangeDocType: (type: 'RECEIPT' | 'INVOICE' | 'DELIVERY_SLIP') => void;
}

export default function PrintableDocumentModal({
  booking,
  settings,
  docType,
  onClose,
  onChangeDocType,
}: PrintableDocumentModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const titleMap = {
    RECEIPT: 'OFFICIAL RENTAL RECEIPT',
    INVOICE: 'BOOKING QUOTE & BILLING INVOICE',
    DELIVERY_SLIP: 'DRIVER DELIVERY & PICKUP CHECKLIST SLIP',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8">
        {/* Top Controls (Hidden on Print) */}
        <div className="bg-charcoal-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangeDocType('INVOICE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'INVOICE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Billing Invoice
            </button>
            <button
              onClick={() => onChangeDocType('RECEIPT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'RECEIPT'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Official Receipt
            </button>
            <button
              onClick={() => onChangeDocType('DELIVERY_SLIP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                docType === 'DELIVERY_SLIP'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Delivery & Pickup Slip
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div id="printable-document" className="p-8 text-gray-900 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-emerald-800 pb-5 gap-4">
            <div className="flex items-start gap-4">
              <img
                src="/logo.jpg"
                alt="MMC Set n Seat Rentals Logo"
                className="w-16 h-16 rounded-full object-cover border-2 border-emerald-800 shrink-0"
              />
              <div>
                <div className="inline-flex items-center gap-2 bg-amber-100 text-charcoal-900 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold mb-1">
                  CHAIRS • TABLES • TENTS • VIDEOKE
                </div>
                <h1 className="text-2xl font-extrabold text-emerald-950 tracking-tight">
                  {settings.businessName}
                </h1>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  {settings.baseAddress} • Serving {settings.serviceArea}
                </p>
                <p className="text-xs text-gray-600 flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-700" /> {settings.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-emerald-700" /> {settings.email}
                  </span>
                </p>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {titleMap[docType]}
              </div>
              <div className="text-lg font-black text-gray-900 mt-0.5">
                Ref: {booking.referenceNumber}
              </div>
              <div className="text-xs text-gray-500">
                Issued: {new Date().toLocaleDateString('en-PH', { dateStyle: 'medium' })}
              </div>
              <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
                Status: {booking.status} ({booking.paymentStatus})
              </div>
            </div>
          </div>

          {/* Customer & Event Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-gray-500 uppercase">Customer Details</div>
              <div className="text-sm font-bold text-gray-900">{booking.customerName}</div>
              <div>Phone: {booking.customerPhone}</div>
              {booking.customerEmail && <div>Email: {booking.customerEmail}</div>}
              <div>
                Venue: {booking.barangay ? `Brgy. ${booking.barangay}, ` : ''}
                {booking.venueAddress}, {booking.municipality}
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-bold text-gray-500 uppercase">Event & Schedule</div>
              <div className="text-sm font-bold text-gray-900">{booking.eventType}</div>
              <div>
                Event Date: <span className="font-semibold">{booking.eventDate}</span> at{' '}
                <span className="font-semibold">{booking.eventTime}</span>
              </div>
              <div>
                Return / Pickup Date: <span className="font-semibold">{booking.returnDate}</span> (
                {booking.rentalDays} {booking.rentalDays > 1 ? 'days' : 'day'})
              </div>
              <div>
                Fulfillment: <span className="font-semibold">{booking.fulfillmentType}</span>{' '}
                {booking.includeSetup ? '+ On-Site Setup Included' : '(Drop-off / Self-setup)'}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-gray-300 text-gray-600 uppercase">
                  <th className="py-2.5 px-2">Item / Package Description</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  {docType !== 'DELIVERY_SLIP' ? (
                    <>
                      <th className="py-2.5 px-2 text-right">Rate/Day</th>
                      <th className="py-2.5 px-2 text-center">Days</th>
                      <th className="py-2.5 px-2 text-right">Line Total</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-2 text-center">Delivered Qty</th>
                      <th className="py-2.5 px-2 text-center">Returned Qty</th>
                      <th className="py-2.5 px-2 text-center">Condition / Remarks</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {booking.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-2 font-medium text-gray-900">
                      {item.itemName}
                      <span className="ml-1.5 text-[10px] text-gray-500">({item.category})</span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold">{item.quantity}</td>
                    {docType !== 'DELIVERY_SLIP' ? (
                      <>
                        <td className="py-2.5 px-2 text-right">₱{item.pricePerDay.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-center">{booking.rentalDays}</td>
                        <td className="py-2.5 px-2 text-right font-bold">
                          ₱{item.lineTotal.toLocaleString()}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-2 text-center">[ ____ ]</td>
                        <td className="py-2.5 px-2 text-center">[ ____ ]</td>
                        <td className="py-2.5 px-2 text-center text-gray-400">__________________</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals or Delivery Checklist */}
          {docType !== 'DELIVERY_SLIP' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 border-t border-gray-200">
              <div className="text-xs space-y-2 text-gray-600">
                <div className="font-bold text-gray-800 uppercase">Payment Channels</div>
                <div>
                  <span className="font-semibold">GCash / Maya:</span> {settings.gcashNumber} (
                  {settings.gcashAccountName})
                </div>
                <div>
                  <span className="font-semibold">Bank Transfer:</span> {settings.bankDetails}
                </div>
                {booking.payments.length > 0 && (
                  <div className="pt-2">
                    <div className="font-bold text-gray-800 uppercase mb-1">Recorded Payments</div>
                    {booking.payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {p.createdAt}: ₱{p.amount.toLocaleString()} via {p.method} ({p.type})
                        {p.referenceNo ? ` — Ref: ${p.referenceNo}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs space-y-1.5 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items Subtotal ({booking.rentalDays}d):</span>
                  <span className="font-semibold">₱{booking.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery & Pickup Fee:</span>
                  <span className="font-semibold">₱{booking.deliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Setup & Takedown Fee:</span>
                  <span className="font-semibold">₱{booking.setupFee.toLocaleString()}</span>
                </div>
                {booking.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount ({booking.discountCode || 'Promo'}):</span>
                    <span>-₱{booking.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {booking.damageFeeTotal > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Damage / Loss Fees:</span>
                    <span>+₱{booking.damageFeeTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-gray-300 pt-2 mt-1 text-gray-900">
                  <span>TOTAL AMOUNT:</span>
                  <span>₱{booking.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Required Deposit ({settings.depositPercent}%):</span>
                  <span>₱{booking.depositRequired.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Amount Paid to Date:</span>
                  <span className="font-bold">₱{booking.amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-amber-800 bg-amber-50 p-2 rounded-lg mt-1">
                  <span>Remaining Balance Due:</span>
                  <span>₱{booking.balanceDue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-3 border-t border-gray-200 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900">
                <span className="font-bold">Customer & Driver Instructions:</span>{' '}
                {booking.notes || 'Count all chairs, tables, and linens upon delivery and upon pickup.'}
                {booking.balanceDue > 0 && (
                  <div className="mt-1 font-bold text-red-700">
                    COLLECT BALANCE ON DELIVERY: ₱{booking.balanceDue.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-8 pt-6">
                <div className="border-t border-gray-400 pt-2 text-center">
                  <div className="font-bold">Delivered By (MMC Crew Signature & Time)</div>
                </div>
                <div className="border-t border-gray-400 pt-2 text-center">
                  <div className="font-bold">Received in Good Condition By (Customer Signature)</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 pt-8">
                <div className="border-t border-gray-400 pt-2 text-center">
                  <div className="font-bold">Picked Up & Counted By (MMC Crew Signature)</div>
                </div>
                <div className="border-t border-gray-400 pt-2 text-center">
                  <div className="font-bold">Return Acknowledged By (Customer Signature)</div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-[11px] text-gray-500 border-t border-gray-200 pt-3 text-center">
            Thank you for choosing <strong>{settings.businessName}</strong>! Customer is responsible for any damaged, burned, torn, or missing rental items during the rental period.
          </div>
        </div>
      </div>
    </div>
  );
}

