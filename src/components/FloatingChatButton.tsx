'use client';

import React, { useState } from 'react';
import { MessageCircle, Phone, X, Send, Smartphone } from 'lucide-react';
import { BusinessSettings } from '@/lib/types';

interface FloatingChatButtonProps {
  settings: BusinessSettings;
}

export default function FloatingChatButton({ settings }: FloatingChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const cleanPhone = settings.phone.replace(/\D/g, '');
  const intlPhone = cleanPhone.startsWith('0')
    ? `63${cleanPhone.slice(1)}`
    : cleanPhone;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col items-end no-print">
      {isOpen && (
        <div className="mb-3 w-80 rounded-2xl bg-white shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-emerald-800 px-4 py-3.5 text-white flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{settings.businessName}</p>
              <p className="text-xs text-emerald-200">
                Fast reply • Lemery & Taal, Batangas
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 hover:bg-emerald-700 text-emerald-100"
              aria-label="Close chat menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-2 bg-warm-50">
            <p className="text-xs text-gray-600 px-1 pb-1">
              Have questions about chair & table availability or delivery to your barangay? Message us directly:
            </p>

            {/* Facebook Messenger */}
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Facebook Messenger</div>
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
              className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm"
            >
              <Send className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">WhatsApp Chat</div>
                <div className="text-[11px] text-emerald-100">{settings.phone}</div>
              </div>
            </a>

            {/* Viber */}
            <a
              href={`viber://chat?number=%2B${intlPhone}`}
              className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition shadow-sm"
            >
              <Smartphone className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Viber Message</div>
                <div className="text-[11px] text-purple-100">{settings.phone}</div>
              </div>
            </a>

            {/* Direct Call / SMS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`tel:${cleanPhone}`}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold transition"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Now
              </a>
              <a
                href={`sms:${cleanPhone}?body=${encodeURIComponent(
                  'Hi MMC Set n Seat Rentals! Inquiry for event rental on: '
                )}`}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-semibold transition"
              >
                Text / SMS
              </a>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-3.5 shadow-xl ring-4 ring-emerald-600/20 transition-all hover:scale-105 active:scale-95"
        aria-label="Chat with MMC Set n Seat Rentals"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6" />
            <span className="font-bold text-sm pr-1">Chat / Inquire</span>
          </>
        )}
      </button>
    </div>
  );
}

