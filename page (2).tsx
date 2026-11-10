'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="flex min-h-dvh flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-3xl font-bold text-brand">
          DevisVite
        </h1>
        <p className="mb-8 text-center text-slate-600">
          Dictez le chantier, vérifiez, envoyez.
          <br />
          On relance à votre place.
        </p>

        {sent ? (
          <div className="card text-center">
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
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Envoi…' : 'Recevoir mon lien de connexion'}
            </button>
            <p className="text-center text-sm text-slate-500">
              Pas de mot de passe à retenir. Un lien magique, c&apos;est tout.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
