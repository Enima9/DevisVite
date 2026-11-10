import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DevisVite — Vos devis en moins de 2 minutes',
  description:
    'Dictez ou décrivez le chantier, vérifiez, envoyez. On relance à votre place.',
  manifest: '/manifest.webmanifest',
  applicationName: 'DevisVite',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4ed8',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
