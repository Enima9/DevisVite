import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/legal';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/mentions-legales', '/confidentialite', '/cgu', '/cgv', '/cookies'],
        // Espace connecté : données privées, rien à indexer
        disallow: [
          '/dashboard', '/devis', '/factures', '/catalogue', '/abonnement', '/reglages', '/onboarding',
          '/api/', '/auth/', '/q/',
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
