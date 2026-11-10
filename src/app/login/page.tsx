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
      setError('Impossible d\u2019envoyer le lien. Vérifiez votre adresse email.');
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <main id="contenu" className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center px-5 py-8">
      <div className="sheet relative w-full max-w-sm">
        <span className="stamp absolute -top-4 right-4 bg-white" aria-hidden="true">
          Devis
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.svg"
          alt="Logo DevisVite : une enveloppe blanche qui s’envole sur fond bleu"
          width={48}
          height={48}
          className="mb-3 h-12 w-12"
        />
        <h1 className="text-4xl font-bold text-ink">DevisVite</h1>
        <p className="mb-6 mt-2 border-b border-slate-300 pb-5 text-slate-700">
          Dictez le chantier, vérifiez, envoyez.
          <br />
          On relance à votre place.
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
              On vient d&apos;envoyer un lien de connexion à{' '}
              <strong>{email}</strong>. Cliquez dessus pour entrer.
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
              Pas de mot de passe à retenir. Un lien magique, c&apos;est tout.
            </p>
            <p className="text-center text-sm text-slate-600">
              En continuant, vous acceptez les{' '}
              <Link href="/cgu" className="font-medium text-brand underline">conditions d&apos;utilisation</Link>{' '}
              et reconnaissez avoir lu la{' '}
              <Link href="/confidentialite" className="font-medium text-brand underline">politique de confidentialité</Link>.
              Seul votre email est collecté à cette étape.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
