'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Phone, X, Send, Smartphone } from 'lucide-react';
import { BusinessSettings } from '@/lib/types';

interface FloatingChatButtonProps {
  settings: BusinessSettings;
  hasStickyBar?: boolean;
}

/**
 * MOBILE FIX #4: FLOATING CHAT BUTTON
 * - Shrunk to an icon-only 56x56px (`w-14 h-14`) circular button on mobile (`sm:w-auto sm:px-4`)
 * - Uses safe-area inset (`env(safe-area-inset-bottom)`)
 * - Dynamically shifts up (`bottom-24`) when the mobile sticky bottom bar is visible (`hasStickyBar = true`)
 *   so it never overlaps the sticky bar, form fields, or CTAs.
 * - Includes large 48px+ "Message us on Messenger" and "Call" actions when tapped.
 */
export default function FloatingChatButton({
  settings,
  hasStickyBar = false,
}: FloatingChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const cleanPhone = settings.phone.replace(/\D/g, '');
  const intlPhone = cleanPhone.startsWith('0')
    ? `63${cleanPhone.slice(1)}`
    : cleanPhone;

  // Close chat popup on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className={`fixed right-4 z-40 flex flex-col items-end no-print pointer-events-none transition-all duration-200 ${
        hasStickyBar ? 'bottom-24 md:bottom-6' : 'bottom-4 md:bottom-6'
      }`}
    >
      {isOpen && (
        <div
          role="dialog"
          aria-label="Quick Contact Options"
          className="pointer-events-auto mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="bg-[#7B2D26] px-4 py-3.5 text-white flex items-center justify-between">
            <div>
              <p className="font-bold text-base leading-tight">{settings.businessName}</p>
              <p className="text-sm text-amber-200">
                Fast reply • Lemery & Taal
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center hover:bg-white/15 text-white transition"
              aria-label="Close chat menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-2.5 bg-[#FAF8F5]">
            <p className="text-sm text-gray-700 leading-snug">
              Have questions about availability or delivery to your barangay?
            </p>

            {/* Primary Option 1: Message us on Messenger (min 48px tall) */}
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full min-h-[48px] p-3 rounded-xl bg-[#006AFF] hover:bg-[#0055CC] active:scale-[0.99] text-white font-bold text-sm transition shadow-sm"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              <div className="text-left">
                <div className="font-bold leading-tight">Message us on Messenger</div>
                <div className="text-xs text-blue-100 font-normal">{settings.messengerName}</div>
              </div>
            </a>

            {/* Primary Option 2: Direct Call (min 48px tall) */}
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center gap-3 w-full min-h-[48px] p-3 rounded-xl bg-[#7B2D26] hover:bg-[#5E201A] active:scale-[0.99] text-white font-bold text-sm transition shadow-sm"
            >
              <Phone className="w-5 h-5 shrink-0 text-amber-300" />
              <div className="text-left">
                <div className="font-bold leading-tight">Call {settings.phone}</div>
                <div className="text-xs text-amber-200 font-normal">Tap to call our Lemery desk</div>
              </div>
            </a>

            {/* Secondary Options: WhatsApp & Viber (min 44px tall) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(
                  'Hello MMC Set n Seat Rentals! I would like to inquire about renting tables and chairs.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-[#168A45] hover:bg-[#127038] text-white text-sm font-bold transition"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`viber://chat?number=%2B${intlPhone}`}
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-[#7360F2] hover:bg-[#5E4BD8] text-white text-sm font-bold transition"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Viber</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Icon-only 56x56px circular button on mobile; pill on desktop */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat options' : 'Message us on Messenger or Call'}
        aria-expanded={isOpen}
        className="pointer-events-auto w-14 h-14 sm:w-auto sm:h-12 sm:px-4 rounded-full bg-[#7B2D26] hover:bg-[#5E201A] active:scale-95 text-white shadow-xl border-2 border-amber-300/60 flex items-center justify-center gap-2 transition"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-amber-300 shrink-0" />
            <span className="hidden sm:inline font-bold text-sm">Chat / Call</span>
          </>
        )}
      </button>
    </div>
  );
}
