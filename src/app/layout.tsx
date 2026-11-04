import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MMC Set n Seat Rentals | Chairs • Tables • Tents • Videoke in Lemery & Taal, Batangas',
  description:
    'Rent clean, heavy-duty Monobloc chairs, Tiffany/Chiavari chairs, banquet round tables, rectangular tables, tents, videoke, and event packages in Lemery & Taal, Batangas. Instant online quote & live availability!',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
  },
  keywords: [
    'table and chair rental Lemery Batangas',
    'chair rental Taal Batangas',
    'MMC Set n Seat Rentals',
    'Tiffany chair rental Batangas',
    'monobloc chair rental Lemery',
    'wedding party rentals Batangas',
    'tent rental Lemery Taal',
  ],
  openGraph: {
    title: 'MMC Set n Seat Rentals — Sets & Seats for Every Batangas Celebration',
    description:
      'Serving Lemery, Taal, and nearby Batangas towns. Tables, chairs, tents, and party packages for weddings, birthdays, debuts, fiestas, and wakes.',
    type: 'website',
    locale: 'en_PH',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'MMC Set n Seat Rentals',
    description:
      'Table and chair rentals (sets and seats) for weddings, birthdays, debuts, funerals/wakes, fiestas, corporate events, and school functions in Lemery and Taal, Batangas.',
    telephone: '+63-956-403-5020',
    email: 'setnseatrentals@gmail.com',
    url: 'https://www.facebook.com/profile.php?id=61585212946153',
    sameAs: ['https://www.facebook.com/profile.php?id=61585212946153'],
    areaServed: [
      { '@type': 'City', name: 'Lemery, Batangas' },
      { '@type': 'City', name: 'Taal, Batangas' },
      { '@type': 'AdministrativeArea', name: 'Batangas' },
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lemery',
      addressRegion: 'Batangas',
      addressCountry: 'PH',
    },
    paymentAccepted: 'Cash, Bank Transfer, GCash, Maya',
    priceRange: '₱15 - ₱13,500',
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body className={`${inter.className} bg-warm-50 text-charcoal-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}

