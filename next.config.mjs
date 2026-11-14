/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 * - frame-ancestors / X-Frame-Options : interdit d'afficher le site dans une iframe (clickjacking,
 *   notamment sur la page publique d'acceptation du devis /q/…).
 * - Referrer-Policy : les liens sortants ne transmettent que le domaine, jamais le chemin
 *   (le jeton du devis public reste privé).
 * - Permissions-Policy : micro autorisé pour la dictée, rien d'autre.
 */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  // pdfkit (utilisé par @react-pdf/renderer) charge ses polices standard (Helvetica…) par un
  // require dynamique que le traçage de fichiers de Vercel ne détecte pas : sans cette ligne,
  // la route PDF plante en production avec « Cannot find module …/standard-fonts/Helvetica.cjs ».
  outputFileTracingIncludes: {
    '/api/quotes/[id]/pdf': ['./node_modules/pdfkit/js/**/*'],
    // Factures : mêmes polices standard de pdfkit + polices DejaVu intégrées au PDF (PDF/A-3).
    '/api/invoices/[id]/pdf': ['./node_modules/pdfkit/js/**/*', './src/assets/fonts/**/*'],
  },
};

export default nextConfig;
