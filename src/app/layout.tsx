import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// PERFORMANCE #7: Limit to 2 font weights (400, 700) with font-display: swap
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-heading',
  display: 'swap',
});

const SITE_URL = 'https://neiks11.github.io/MMC-SetnSeat/';
const OG_IMAGE_URL = 'https://neiks11.github.io/MMC-SetnSeat/og-share.png';

// TASK 7: CSP via <meta http-equiv="Content-Security-Policy"> for GitHub Pages static hosting
// (Note: frame-ancestors is omitted in <meta> because browsers only honor it in HTTP headers)
const META_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://neiks11.github.io https://images.unsplash.com https://*.googleusercontent.com https://www.googletagmanager.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com",
  "frame-src 'self' https://www.openstreetmap.org https://www.google.com https://maps.google.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

// ACCESSIBILITY #8: Proper viewport meta without disabling pinch-zoom
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7B2D26',
};

// TASK 1 & TASK 3: Social Sharing (OG + Twitter large card, canonical, favicons) & SEO title/description (no meta keywords)
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Chair, Table & Tent Rental in Lemery & Taal, Batangas | MMC Set n Seat',
  description:
    'Rent sanitized chairs, tables, tents & videoke in Lemery, Taal & nearby Batangas towns. Check live availability & book online with instant quotes!',
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: '/MMC-SetnSeat/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/MMC-SetnSeat/logo.jpg', sizes: '192x192', type: 'image/jpeg' },
    ],
    apple: [
      { url: '/MMC-SetnSeat/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Chair, Table & Tent Rental in Lemery & Taal, Batangas | MMC Set n Seat',
    description:
      'Rent sanitized chairs, tables, tents & videoke in Lemery, Taal & nearby Batangas towns. Check live availability & book online with instant quotes!',
    url: SITE_URL,
    siteName: 'MMC Set n Seat Rentals',
    type: 'website',
    locale: 'en_PH',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'MMC Set n Seat Rentals — Chair, Table, Tent & Videoke Rental in Lemery & Taal, Batangas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chair, Table & Tent Rental in Lemery & Taal, Batangas | MMC Set n Seat',
    description:
      'Rent sanitized chairs, tables, tents & videoke in Lemery, Taal & nearby Batangas towns. Check live availability & book online with instant quotes!',
    images: [OG_IMAGE_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TASK 3: LocalBusiness JSON-LD with explicit placeholders noted for owner verification
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'MMC Set n Seat Rentals',
    legalName: '[BUSINESS LEGAL NAME — e.g., MMC Set n Seat Rentals]',
    image: OG_IMAGE_URL,
    logo: 'https://neiks11.github.io/MMC-SetnSeat/logo.jpg',
    url: SITE_URL,
    description:
      'Sanitized Monobloc chairs, Gold Tiffany chairs, round & rectangular banquet tables, canopy tents, and videoke rentals in Lemery and Taal, Batangas.',
    telephone: '+63-956-403-5020',
    email: 'setnseatrentals@gmail.com',
    priceRange: '₱15 - ₱13,500',
    openingHours: 'Mo-Su 07:00-20:00',
    paymentAccepted: 'Cash, GCash, Maya, Bank Transfer',
    currenciesAccepted: 'PHP',
    sameAs: ['https://www.facebook.com/profile.php?id=61585212946153'],
    areaServed: [
      { '@type': 'City', name: 'Lemery, Batangas' },
      { '@type': 'City', name: 'Taal, Batangas' },
      { '@type': 'City', name: 'Agoncillo, Batangas' },
      { '@type': 'City', name: 'Calaca, Batangas' },
      { '@type': 'City', name: 'San Nicolas, Batangas' },
      { '@type': 'AdministrativeArea', name: 'Batangas' },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Poblacion / Diversion Rd. [EXACT STREET/BLDG PLACEHOLDER]',
      addressLocality: 'Lemery',
      addressRegion: 'Batangas',
      postalCode: '4209',
      addressCountry: 'PH',
    },
  };

  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={META_CSP} />
        <link rel="canonical" href={SITE_URL} />
        {/* PERFORMANCE #7: Preload only the mobile WebP hero image */}
        <link
          rel="preload"
          as="image"
          href="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=640&q=68"
          imageSrcSet="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=640&q=68 640w, https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&fm=webp&w=1280&q=75 1280w"
          imageSizes="100vw"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body className={`${inter.className} bg-[#FAF8F5] text-charcoal-900 text-base leading-normal antialiased`}>
        {/* TASK 2: <noscript> fallback with full contact details and message when JavaScript is disabled */}
        <noscript>
          <div className="bg-[#7B2D26] text-white p-4 border-b-4 border-amber-400">
            <div className="max-w-5xl mx-auto space-y-2 text-sm sm:text-base">
              <p className="font-bold text-amber-300">
                JavaScript is disabled in your browser. Interactive stock checking and the online booking cart require JavaScript, but you can view our rental rates below or book directly by phone or Messenger:
              </p>
              <p>
                <strong>MMC Set n Seat Rentals</strong> — Serving Lemery, Taal, Agoncillo, Calaca &amp; nearby Batangas towns (Chairs from ₱15/day, Tables from ₱120/day, Canopy Tents from ₱800/day, Videoke &amp; Full Event Packages).
              </p>
              <p className="flex flex-wrap gap-4 pt-1 font-bold">
                <a href="tel:09564035020" className="underline text-amber-300">
                  Call / Text / GCash: 0956 403 5020
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61585212946153"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-amber-300"
                >
                  Message Us on Facebook: MMC Setnseat Rentals
                </a>
              </p>
            </div>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
