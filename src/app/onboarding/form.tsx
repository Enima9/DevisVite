'use client';

import { useState } from 'react';
import { TRADES } from '@/lib/catalog-seeds';
import { saveCompany, updateCompany } from '@/app/actions/company';
import type { CompanyProfile } from '@/lib/quotes-server';

const VAT_OPTIONS = [20, 10, 5.5, 0];

type Props =
  | { mode?: 'create'; defaultEmail: string; initial?: undefined }
  | { mode: 'edit'; defaultEmail?: string; initial: CompanyProfile };

export default function OnboardingForm(props: Props) {
  const edit = props.mode === 'edit';
  const init = props.initial;
  const [trade, setTrade] = useState(init?.trade ?? '');
  const [vatExemption, setVatExemption] = useState(init?.vat_exemption ?? false);

  return (
    <form action={edit ? updateCompany : saveCompany} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-bold text-lg">Votre entreprise</h2>

        <div>
          <label htmlFor="name" className="label">Nom de l'entreprise *</label>
          <input id="name" name="name" required className="input" placeholder="Plomberie Dubois" defaultValue={init?.name ?? ''} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="legal_form" className="label">Forme juridique</label>
            <select id="legal_form" name="legal_form" className="input" defaultValue={init?.legal_form ?? ''}>
              <option value="">—</option>
              <option>Micro-entreprise</option>
              <option>EI</option>
              <option>EURL</option>
              <option>SARL</option>
              <option>SASU</option>
              <option>SAS</option>
            </select>
          </div>
          <div>
            <label htmlFor="siret" className="label">SIRET</label>
            <input id="siret" name="siret" className="input" inputMode="numeric" placeholder="14 chiffres" defaultValue={init?.siret ?? ''} />
          </div>
        </div>

        <div>
          <label htmlFor="address" className="label">Adresse</label>
          <input id="address" name="address" className="input" placeholder="12 rue des Lilas, 69003 Lyon" defaultValue={init?.address ?? ''} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone" className="label">Téléphone</label>
            <input id="phone" name="phone" className="input" type="tel" inputMode="tel" defaultValue={init?.phone ?? ''} />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" className="input" type="email" defaultValue={init ? (init.email ?? '') : (props.defaultEmail ?? '')} />
          </div>
        </div>

        <div>
          <label htmlFor="trade" className="label">Votre métier *{edit ? '' : ' (pré-remplit vos tarifs)'}</label>
          <select
            id="trade"
            name="trade"
            required
            className="input"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
          >
            <option value="" disabled>Choisir…</option>
            {TRADES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold text-lg">TVA et paiement</h2>

        <div>
          <label htmlFor="default_vat_rate" className="label">Taux de TVA par défaut</label>
          <select id="default_vat_rate" name="default_vat_rate" className="input" defaultValue={String(init ? Number(init.default_vat_rate) : 20)}>
            {VAT_OPTIONS.map((r) => (
              <option key={r} value={r}>{r} %</option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="vat_exemption"
            className="mt-1 h-5 w-5"
            checked={vatExemption}
            onChange={(e) => setVatExemption(e.target.checked)}
          />
          <span>
            Je suis micro-entrepreneur : « TVA non applicable, art. 293 B du CGI »
            sera affiché sur mes devis.
          </span>
        </label>

        <div>
          <label htmlFor="payment_terms" className="label">Conditions de paiement</label>
          <textarea
            id="payment_terms"
            name="payment_terms"
            className="input min-h-[80px]"
            defaultValue={init?.payment_terms ?? 'Paiement à 30 jours après réception de facture.'}
          />
        </div>

        <div>
          <label htmlFor="quote_validity_days" className="label">Validité des devis (jours)</label>
          <input
            id="quote_validity_days"
            name="quote_validity_days"
            type="number"
            min={1}
            max={365}
            defaultValue={init?.quote_validity_days ?? 30}
            className="input"
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold text-lg">Assurance décennale (optionnel)</h2>
        <div>
          <label htmlFor="insurance_provider" className="label">Assureur</label>
          <input id="insurance_provider" name="insurance_provider" className="input" placeholder="AXA, MAIF…" defaultValue={init?.insurance_provider ?? ''} />
        </div>
        <div>
          <label htmlFor="insurance_policy_number" className="label">N° de police</label>
          <input id="insurance_policy_number" name="insurance_policy_number" className="input" defaultValue={init?.insurance_policy_number ?? ''} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold text-lg">Apparence et coordonnées bancaires</h2>
        <div>
          <label htmlFor="primary_color" className="label">Couleur principale de vos devis</label>
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            defaultValue={init?.primary_color ?? '#1d4ed8'}
            className="h-14 w-full rounded-xl border-2 border-slate-300"
          />
        </div>
        <div>
          <label htmlFor="iban" className="label">IBAN (optionnel, pour vos factures)</label>
          <input id="iban" name="iban" className="input" placeholder="FR76…" defaultValue={init?.iban ?? ''} />
        </div>
      </section>

      <button type="submit" className="btn-primary">
        {edit ? 'Enregistrer les réglages' : 'Créer mon entreprise →'}
      </button>
      {!edit && (
        <p className="pb-8 text-center text-sm text-slate-500">
          Tout est modifiable plus tard dans les réglages.
        </p>
      )}
    </form>
  );
}
