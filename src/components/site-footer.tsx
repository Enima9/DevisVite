import Link from 'next/link';
import { LEGAL_PAGES, SITE } from '@/lib/legal';

export default function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-slate-200 bg-white px-5 pb-24 pt-6 text-sm text-slate-600">
      <div className="mx-auto max-w-2xl">
        <nav aria-label="Informations légales">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="font-medium text-brand underline">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-3">© {new Date().getFullYear()} {SITE.name}</p>
      </div>
    </footer>
  );
}
