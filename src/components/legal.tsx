import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_UPDATED_LABEL, TODO } from '@/lib/legal';

/** Affiche une information de l'éditeur ; surlignée tant qu'elle n'est pas renseignée. */
export function Fill({ value }: { value: string }) {
  if (value === TODO) {
    return <mark className="rounded bg-yellow-200 px-1 font-semibold text-slate-900">{value}</mark>;
  }
  return <>{value}</>;
}

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main id="contenu" className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/login" className="text-sm font-medium text-brand underline">
        ← Retour à l’accueil
      </Link>
      <article className="mt-4">
        <h1 className="text-3xl font-bold leading-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">Dernière mise à jour : {LEGAL_UPDATED_LABEL}</p>
        {intro && <p className="mt-4 text-lg text-slate-700">{intro}</p>}
        <div className="mt-6 space-y-8">{children}</div>
      </article>
    </main>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-xl font-bold">
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6">{children}</ul>;
}

export function Table({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="bg-slate-100">
            {head.map((h) => (
              <th key={h} scope="col" className="border border-slate-300 p-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="align-top">
              {cells.map((c, j) => (
                <td key={j} className="border border-slate-300 p-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
