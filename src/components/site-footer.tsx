import Link from 'next/link';
import { LEGAL_PAGES, SITE } from '@/lib/legal';

export default function SiteFooter() {
  return (
    <footer className="on-dark border-t border-brass/60 bg-ink px-5 pb-24 pt-7 text-sm text-slate-300">
      <div className="mx-auto max-w-2xl">
        <p className="font-serif text-xl font-semibold text-white">
          Devis<span className="text-brass-light">Vite</span>
        </p>
        <nav aria-label="Informations légales" className="mt-3">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="font-medium text-slate-200 underline decoration-brass/70 underline-offset-4 hover:text-white">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-4 text-slate-400">© {new Date().getFullYear()} {SITE.name}</p>
      </div>
    </footer>
  );
}
