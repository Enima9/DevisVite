import type { MetadataRoute } from 'next';
import { LEGAL_PAGES, SITE } from '@/lib/legal';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['/login', ...LEGAL_PAGES.map((p) => p.href)];
  return pages.map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: path === '/login' ? 'monthly' : 'yearly',
    priority: path === '/login' ? 1 : 0.5,
  }));
}
