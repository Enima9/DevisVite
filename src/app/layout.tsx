import type { Metadata, Viewport } from 'next';
import { Newsreader, Instrument_Sans } from 'next/font/google';
import './globals.css';

const serif = Newsreader({ subsets: ['latin'], variable: '--font-serif', display: 'swap', weight: ['500', '600'] });
const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
import SiteFooter from '@/components/site-footer';
import AppMenu from '@/components/app-menu';
import { SITE } from '@/lib/legal';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'DevisVite — Vos devis en moins de 2 minutes',
    template: '%s — DevisVite',
  },
  description: SITE.description,
  manifest: '/manifest.webmanifest',
  applicationName: 'DevisVite',
  openGraph: {
    type: 'website',
    siteName: 'DevisVite',
    locale: 'fr_FR',
    title: 'DevisVite — Vos devis en moins de 2 minutes',
    description: SITE.description,
  },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0E1A2F',
};

// Données structurées (schema.org) : permettent aux moteurs et aux agents IA de comprendre le site.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'fr-FR',
  audience: { '@type': 'BusinessAudience', audienceType: 'Artisans et entreprises du bâtiment' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-3 focus:font-semibold focus:text-white"
        >
          Aller au contenu principal
        </a>
        <AppMenu />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
