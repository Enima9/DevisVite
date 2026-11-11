'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Supabase renvoie les erreurs de lien dans l'adresse (#error_code=otp_expired…)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('compte-supprime')) {
      setNotice('Votre compte et toutes vos données ont été supprimés.');
    }
    const hash = window.location.hash;
    if (hash.includes('error')) {
      setError(
        hash.includes('otp_expired')
          ? 'Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous.'
          : 'La connexion a échoué. Demandez un nouveau lien ci-dessous.'
      );
    }
  }, []);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      // 429 : trop de demandes rapprochées (limite d'envoi d'emails de Supabase)
      const tooMany = error.status === 429 || error.code === 'over_email_send_rate_limit';
      setError(
        tooMany
          ? 'Un lien vient déjà d\u2019être envoyé. Regardez vos emails (et les spams), ou patientez une minute avant d\u2019en redemander un.'
          : 'Impossible d\u2019envoyer le lien. Vérifiez votre adresse email.'
      );
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <main id="contenu" className="on-dark relative isolate overflow-hidden bg-ink text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(48rem_26rem_at_85%_-8%,rgba(176,136,64,0.28),transparent_62%),radial-gradient(40rem_24rem_at_-10%_110%,rgba(27,58,140,0.55),transparent_60%)]"
      />
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-10 lg:py-20">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="Logo DevisVite : une enveloppe blanche qui s’envole sur fond bleu"
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl ring-1 ring-white/20"
            />
            <p className="font-serif text-2xl font-semibold tracking-tight">
              Devis<span className="text-brass-light">Vite</span>
            </p>
          </div>
          <h1 className="mt-8 max-w-[16ch] text-[2.6rem] leading-[1.05] sm:text-6xl">
            Dictez le chantier. Le devis est prêt.
          </h1>
          <p className="mt-5 max-w-[38ch] text-lg text-slate-300">
            Vous vérifiez, vous envoyez. On relance votre client à votre place.
          </p>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <div className="sheet relative mx-auto w-full max-w-sm text-ink">
            <h2 className="text-2xl">Connexion</h2>
            <p className="mb-5 mt-1 border-b border-slate-200 pb-4 text-slate-600">
              Pas de mot de passe : un lien de connexion arrive dans votre boîte mail.
            </p>

            {notice && (
              <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                {notice}
              </p>
            )}
            {sent ? (
              <div className="text-center">
                <p className="text-4xl">📬</p>
                <p className="mt-3 text-lg font-semibold">Regardez vos emails</p>
                <p className="mt-2 text-slate-600">
                  On vient d&apos;envoyer un lien de connexion à <strong>{email}</strong>. Cliquez dessus pour entrer.
                </p>
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">
                    Votre email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@monentreprise.fr"
                    className="input"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Envoi…' : 'Recevoir mon lien de connexion'}
                </button>
                <p className="text-center text-sm text-slate-600">
                  En continuant, vous acceptez les{' '}
                  <Link href="/cgu" className="font-medium text-brand underline underline-offset-2">conditions d&apos;utilisation</Link>{' '}
                  et reconnaissez avoir lu la{' '}
                  <Link href="/confidentialite" className="font-medium text-brand underline underline-offset-2">politique de confidentialité</Link>.
                  Seul votre email est collecté à cette étape.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Exemple décoratif : un devis accepté (données fictives) */}
        <div aria-hidden="true" className="lg:col-start-1 lg:row-start-2 lg:self-start">
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
        </div>
      </div>
    </main>
  );
}
