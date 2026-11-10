/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  // pdfkit (utilisé par @react-pdf/renderer) charge ses polices standard (Helvetica…) par un
  // require dynamique que le traçage de fichiers de Vercel ne détecte pas : sans cette ligne,
  // la route PDF plante en production avec « Cannot find module …/standard-fonts/Helvetica.cjs ».
  outputFileTracingIncludes: {
    '/api/quotes/[id]/pdf': ['./node_modules/pdfkit/js/**/*'],
  },
};

export default nextConfig;
