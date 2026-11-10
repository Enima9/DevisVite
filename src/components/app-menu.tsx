'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/devis/nouveau', label: 'Nouveau devis' },
  { href: '/devis', label: 'Mes devis' },
  { href: '/catalogue', label: 'Mon catalogue' },
  { href: '/abonnement', label: 'Mon abonnement' },
  { href: '/reglages', label: 'Mon compte' },
];

/** Pages de l'espace connecté : le menu n'apparaît que là (pas sur la connexion ni les pages légales). */
const PRIVATE = ['/dashboard', '/devis', '/catalogue', '/abonnement', '/reglages'];

function isActive(pathname: string, href: string) {
  if (href === '/devis') return pathname === '/devis' || (pathname.startsWith('/devis/') && pathname !== '/devis/nouveau');
  return pathname === href;
}

export default function AppMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Ferme le menu à chaque changement de page
  useEffect(() => setOpen(false), [pathname]);

  // Échap ferme le menu et redonne le focus au bouton
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('a')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const visible = PRIVATE.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!visible) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-2">
        <Link href="/dashboard" className="font-serif text-xl font-bold text-ink">
          DevisVite
        </Link>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setOpen((o) => !o)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-ink bg-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B2430" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <>
          {/* Zone cliquable pour fermer en touchant à côté */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[65px] z-40 bg-ink/30"
          />
          <div
            id="menu-principal"
            ref={panelRef}
            className="absolute right-3 top-full z-50 w-72 max-w-[calc(100vw-1.5rem)] border border-slate-300 border-t-[4px] border-t-brand bg-white py-2 shadow-[0_14px_28px_-12px_rgba(27,36,48,0.45)]"
          >
            <nav aria-label="Menu principal">
              <ul>
                {ITEMS.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-[52px] items-center px-5 text-lg ${
                          active ? 'border-l-4 border-brand bg-slate-100 pl-4 font-bold text-brand' : 'font-medium text-ink hover:bg-slate-100'
                        }`}
                      >
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <form action="/auth/signout" method="post" className="mt-1 border-t border-slate-300">
              <button type="submit" className="flex min-h-[52px] w-full items-center px-5 text-lg font-medium text-stamp hover:bg-slate-100">
                Se déconnecter
              </button>
            </form>
          </div>
        </>
      )}
    </header>
  );
}
