import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAN, VAT_FRANCHISE, VAT_NOTICE, planPriceLabel } from '@/lib/billing-config';

export const metadata: Metadata = {
  title: { absolute: 'DevisVite — Logiciel de devis pour artisans, prêt en 2 minutes' },
  description:
    'Logiciel de devis pour artisans du bâtiment : dictez le chantier, DevisVite rédige le devis. Vous vérifiez, vous l’envoyez, le client signe en ligne. Création des devis gratuite.',
  alternates: { canonical: '/' },
};

const STEPS = [
  {
    title: 'Dictez le chantier',
    text: 'Décrivez les travaux à voix haute ou en quelques mots. L’IA propose les lignes, les quantités et les prix.',
  },
  {
    title: 'Vérifiez, ajustez',
    text: 'Vous gardez la main : prix de votre catalogue, TVA par ligne, remise, acompte. Les totaux se calculent seuls.',
  },
  {
    title: 'Envoyez, on relance',
    text: 'Le client reçoit un lien, accepte et signe en ligne. Sans réponse, DevisVite le relance à votre place.',
  },
];

export default function Home() {
  // Page statique (rapide, bien indexée). Un artisan connecté est renvoyé vers /dashboard
  // par le middleware, avant d'arriver ici.
  const price = planPriceLabel();

  return (
    <main id="contenu">
      {/* En-tête + promesse */}
      <section className="on-dark relative isolate overflow-hidden bg-ink text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(48rem_26rem_at_85%_-8%,rgba(176,136,64,0.28),transparent_62%),radial-gradient(40rem_24rem_at_-10%_110%,rgba(27,58,140,0.55),transparent_60%)]"
        />
        <div className="mx-auto max-w-5xl px-5">
          <header className="flex items-center justify-between py-5">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-lg ring-1 ring-white/20" />
              <span className="font-serif text-2xl font-semibold tracking-tight">
                Devis<span className="text-brass-light">Vite</span>
              </span>
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/25 px-4 py-2.5 font-semibold text-white transition hover:bg-white/10"
            >
              Se connecter
            </Link>
          </header>

          <div className="grid gap-12 pb-16 pt-8 lg:grid-cols-2 lg:items-center lg:pb-24 lg:pt-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brass-light">
                Logiciel de devis pour artisans
              </p>
              <h1 className="mt-4 max-w-[16ch] text-[2.6rem] leading-[1.05] sm:text-6xl">
                Dictez le chantier. Le devis est prêt.
              </h1>
              <p className="mt-5 max-w-[40ch] text-lg text-slate-300">
                Vous vérifiez, vous envoyez. Votre client signe en ligne, et on le relance à votre place.
              </p>
              <div className="mt-8 max-w-sm">
                <Link href="/login" className="btn-primary">
                  Créer mon premier devis gratuitement
                </Link>
                <p className="mt-3 text-sm text-slate-300">
                  Sans carte bancaire. Un email suffit, pas de mot de passe.
                </p>
              </div>
            </div>

            {/* Devis d'exemple (données fictives) */}
            <figure aria-label="Exemple de devis réalisé avec DevisVite (données fictives)" className="lg:justify-self-end">
              <div className="relative max-w-sm rotate-[-1.5deg] rounded-2xl border-t-[3px] border-t-brass bg-white p-5 text-ink shadow-[0_24px_48px_-20px_rgba(0,0,0,0.6)]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-600">Devis DEV-2026-0012</p>
                  <p className="text-sm text-slate-600">Exemple</p>
                </div>
                <p className="mt-2 font-serif text-xl font-semibold">Remplacement du chauffe-eau</p>
                <p className="text-sm text-slate-600">M. et Mme Roche, Marseille 6e</p>
                <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>Chauffe-eau 200 L, fourniture et pose</span>
                    <span className="font-semibold">1 090,00 €</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Évacuation de l’ancien cumulus</span>
                    <span className="font-semibold">80,00 €</span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-ink pt-3">
                  <span className="font-semibold">Total HT</span>
                  <span className="font-serif text-2xl font-semibold">1 170,00 €</span>
                </div>
                <span className="stamp stamp-press absolute -bottom-4 right-4 bg-white">Accepté</span>
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section aria-labelledby="etapes" className="mx-auto max-w-5xl px-5 py-16 lg:py-20">
        <h2 id="etapes" className="text-3xl sm:text-4xl">
          Un devis propre, sans soirée au bureau
        </h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="sheet">
              <p className="font-serif text-3xl font-semibold text-brass-dark" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-2 text-xl">{s.title}</h3>
              <p className="mt-2 text-slate-700">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Gratuit / payant + prix */}
      <section aria-labelledby="tarif" className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 id="tarif" className="text-3xl sm:text-4xl">
              Créez vos devis gratuitement.
              <br />
              Payez quand ils partent.
            </h2>
            <p className="mt-5 max-w-[46ch] text-lg text-slate-700">
              Créer, dicter et préparer vos devis ne coûte rien, sans limite de durée. L’abonnement sert à télécharger le
              PDF et à envoyer le devis à vos clients.
            </p>
            <dl className="mt-8 space-y-4">
              <div>
                <dt className="font-semibold">Gratuit</dt>
                <dd className="text-slate-700">Création des devis, génération par l’IA, catalogue de prix, modèles.</dd>
              </div>
              <div>
                <dt className="font-semibold">Avec l’abonnement</dt>
                <dd className="text-slate-700">
                  PDF des devis et des factures, envoi au client avec signature en ligne, relances.
                </dd>
              </div>
            </dl>
          </div>

          {price && (
            <div className="sheet lg:self-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">Abonnement</p>
              <p className="mt-2 font-serif text-5xl font-semibold">{price}</p>
              {VAT_FRANCHISE && <p className="mt-1 text-sm text-slate-600">{VAT_NOTICE}</p>}
              <ul className="mt-5 space-y-2">
                {PLAN.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/login" className="btn-primary mt-6">
                Essayer gratuitement
              </Link>
              <p className="mt-3 text-center text-sm text-slate-600">
                Vous ne payez qu’au moment de télécharger ou d’envoyer un devis.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Dernier appel */}
      <section className="mx-auto max-w-5xl px-5 py-16 text-center lg:py-20">
        <h2 className="text-3xl sm:text-4xl">Votre prochain devis, ce soir en deux minutes.</h2>
        <div className="mx-auto mt-8 max-w-sm">
          <Link href="/login" className="btn-primary">
            Commencer gratuitement
          </Link>
        </div>
      </section>
    </main>
  );
}
