import type { MetadataRoute } from 'next';
import { LEGAL_PAGES, SITE } from '@/lib/legal';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['/', '/login', ...LEGAL_PAGES.map((p) => p.href)];
  return pages.map((path) => ({
    url: path === '/' ? SITE.url : `${SITE.url}${path}`,
    changeFrequency: path === '/' || path === '/login' ? 'monthly' : 'yearly',
    priority: path === '/' ? 1 : path === '/login' ? 0.6 : 0.3,
  }));
}
