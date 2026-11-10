'use client';

import { useActionState, useState } from 'react';
import { acceptQuote, refuseQuote, type PublicActionState } from '@/app/actions/public-quote';

const initial: PublicActionState = {};

export default function AnswerForms({ token, clientName }: { token: string; clientName: string }) {
  const [mode, setMode] = useState<'accept' | 'refuse' | null>(null);
  const [acceptState, acceptAction, accepting] = useActionState(acceptQuote, initial);
  const [refuseState, refuseAction, refusing] = useActionState(refuseQuote, initial);

  return (
    <section aria-labelledby="reponse" className="sheet mt-6">
      <h2 id="reponse" className="text-xl font-bold">
        Votre réponse
      </h2>

      {mode === null && (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={() => setMode('accept')} className="btn-primary">
            Accepter ce devis
          </button>
          <button type="button" onClick={() => setMode('refuse')} className="btn-secondary">
            Refuser
          </button>
        </div>
      )}

      {mode === 'accept' && (
        <form action={acceptAction} className="mt-4 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="name" className="label">
              Votre nom complet (vaut signature)
            </label>
            <input id="name" name="name" required minLength={3} maxLength={120} defaultValue={clientName} autoComplete="name" className="input" />
          </div>
          <label className="flex items-start gap-3 text-base">
            <input type="checkbox" name="accord" required className="mt-1 h-6 w-6 shrink-0" />
            <span>
              <strong>Bon pour accord.</strong> J’ai lu ce devis, je l’accepte avec son prix et ses conditions.
            </span>
          </label>
          {acceptState.error && (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
              {acceptState.error}
            </p>
          )}
          <button type="submit" disabled={accepting} className="btn-primary">
            {accepting ? 'Enregistrement…' : 'Signer et accepter'}
          </button>
          <button type="button" onClick={() => setMode(null)} className="w-full py-2 text-sm font-semibold text-slate-600 underline">
            Retour
          </button>
        </form>
      )}

      {mode === 'refuse' && (
        <form action={refuseAction} className="mt-4 space-y-4">
          <input type="hidden" name="token" value={token} />
          <fieldset>
            <legend className="label">Pourquoi refusez-vous ce devis ?</legend>
            <div className="space-y-2">
              {[
                ['too_expensive', 'Le prix est trop élevé'],
                ['other_quote', 'J’ai choisi un autre devis'],
                ['postponed', 'Le projet est reporté'],
                ['other', 'Autre raison'],
              ].map(([v, l], i) => (
                <label key={v} className="flex min-h-[48px] items-center gap-3 border border-slate-400 bg-white px-3">
                  <input type="radio" name="reason" value={v} required defaultChecked={i === 0} className="h-5 w-5" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="comment" className="label">
              Un commentaire ? (facultatif)
            </label>
            <textarea id="comment" name="comment" rows={3} maxLength={500} className="input !min-h-0 py-3" />
          </div>
          {refuseState.error && (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
              {refuseState.error}
            </p>
          )}
          <button type="submit" disabled={refusing} className="btn-secondary">
            {refusing ? 'Enregistrement…' : 'Confirmer le refus'}
          </button>
          <button type="button" onClick={() => setMode(null)} className="w-full py-2 text-sm font-semibold text-slate-600 underline">
            Retour
          </button>
        </form>
      )}
    </section>
  );
}
