import type { Metadata, Viewport } from 'next';
import './globals.css';
import SiteFooter from '@/components/site-footer';
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
  themeColor: '#1d4ed8',
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
    <html lang="fr">
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-3 focus:font-semibold focus:text-white"
        >
          Aller au contenu principal
        </a>
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
