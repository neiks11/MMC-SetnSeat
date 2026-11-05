'use client';

import React, { useState } from 'react';
import { MessageCircle, Phone, X, Send, Smartphone } from 'lucide-react';
import { BusinessSettings } from '@/lib/types';

interface FloatingChatButtonProps {
  settings: BusinessSettings;
}

/**
 * Floating Chat / Quick-Inquiry Button
 * - Positioned above the mobile sticky bottom bar (`bottom-24 md:bottom-6`)
 *   so it never overlaps page content or mobile CTAs.
 * - Uses a compact, thumb-friendly pill on mobile and desktop.
 */
export default function FloatingChatButton({ settings }: FloatingChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const cleanPhone = settings.phone.replace(/\D/g, '');
  const intlPhone = cleanPhone.startsWith('0')
    ? `63${cleanPhone.slice(1)}`
    : cleanPhone;

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end no-print pointer-events-none">
      {isOpen && (
        <div className="pointer-events-auto mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-[#7B2D26] px-4 py-3.5 text-white flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{settings.businessName}</p>
              <p className="text-xs text-amber-200">
                Fast local reply • Lemery & Taal, Batangas
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/15 text-white transition"
              aria-label="Close chat menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2.5 bg-[#FAF8F5]">
            <p className="text-xs text-gray-600 pb-1 leading-relaxed">
              Need help choosing chairs, tables, or checking delivery to your barangay? Message us directly:
            </p>

            {/* Facebook Messenger */}
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#006AFF] hover:bg-[#0055CC] text-white font-medium text-sm transition shadow-sm"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-bold leading-tight">Facebook Messenger</div>
                <div className="text-[11px] text-blue-100">{settings.messengerName}</div>
              </div>
            </a>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(
                'Hello MMC Set n Seat Rentals! I would like to inquire about renting tables and chairs.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#168A45] hover:bg-[#127038] text-white font-medium text-sm transition shadow-sm"
            >
              <Send className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-bold leading-tight">WhatsApp Chat</div>
                <div className="text-[11px] text-green-100">{settings.phone}</div>
              </div>
            </a>

            {/* Viber */}
            <a
              href={`viber://chat?number=%2B${intlPhone}`}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#7360F2] hover:bg-[#5E4BD8] text-white font-medium text-sm transition shadow-sm"
            >
              <Smartphone className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-bold leading-tight">Viber Message</div>
                <div className="text-[11px] text-purple-100">{settings.phone}</div>
              </div>
            </a>

            {/* Direct Call / SMS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs font-bold transition"
              >
                <Phone className="w-3.5 h-3.5" />
                Call {settings.phone}
              </a>
              <a
                href={`sms:${cleanPhone}?body=${encodeURIComponent(
                  'Hi MMC Set n Seat Rentals! Inquiry for event rental on: '
                )}`}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold transition"
              >
                Text / SMS
              </a>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#7B2D26] hover:bg-[#63221C] text-white px-4 py-3 shadow-lg border border-amber-300/40 transition-all hover:scale-105 active:scale-95"
        aria-label="Chat with MMC Set n Seat Rentals"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <>
            <MessageCircle className="w-5 h-5 text-amber-300" />
            <span className="font-bold text-xs sm:text-sm">Ask on Messenger / Call</span>
          </>
        )}
      </button>
    </div>
  );
}
