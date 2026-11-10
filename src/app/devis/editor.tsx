'use client';

import { useActionState, useMemo, useState } from 'react';
import { computeQuoteTotals, UNIT_LABELS, VAT_RATES, formatEuro, parseEuroInput, type Unit, type VatRate } from '@/lib/money';
import type { CatalogRow, ClientRow } from '@/lib/quotes-server';
import type { EditorLineAi } from '@/lib/ai/schema';
import { useDictation } from '@/lib/use-dictation';
import { saveQuote, type SaveQuoteState } from '@/app/actions/quotes';

const UNITS = Object.entries(UNIT_LABELS) as [Unit, string][];

export interface EditorLine extends EditorLineAi {
  key: string;
}

interface Props {
  catalogue: CatalogRow[];
  clients: ClientRow[];
  defaultVatRate: number;
  validityDays: number;
}

let keyCounter = 0;
const newKey = () => `l${++keyCounter}-${Date.now()}`;

const blankLine = (defaultVatRate: number): EditorLine => ({
  key: newKey(),
  label: '',
  unit: 'u',
  quantity: '1',
  unit_price_ht: '',
  vat_rate: String(defaultVatRate),
  discount: '0',
  estimated: false,
  source: 'manual',
});

export default function QuoteEditor({ catalogue, clients, defaultVatRate, validityDays }: Props) {
  const defaultValidUntil = () => {
    const d = new Date();
    d.setDate(d.getDate() + validityDays);
    return d.toISOString().slice(0, 10);
  };

  const [saveState, formAction, saving] = useActionState<SaveQuoteState | null, FormData>(saveQuote, null);
  const [lines, setLines] = useState<EditorLine[]>([blankLine(defaultVatRate)]);
  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [title, setTitle] = useState('');
  const [executionDelay, setExecutionDelay] = useState('');
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [globalDiscount, setGlobalDiscount] = useState('0');
  const [deposit, setDeposit] = useState('0');
  const [introText, setIntroText] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // --- IA : description dictée ou écrite ---
  const [description, setDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRemarks, setAiRemarks] = useState('');
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);

  const dictation = useDictation((text) =>
    setDescription((d) => (d ? `${d.trimEnd()} ${text.trim()}` : text.trim()))
  );

  async function generateWithAi() {
    setAiLoading(true);
    setAiError(null);
    setAiQuestions([]);
    setAiRemarks('');
    try {
      const res = await fetch('/api/ai/generate-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      let data: {
        error?: string;
        title?: string;
        lines?: EditorLineAi[];
        remarks?: string;
        clarifying_questions?: string[];
      } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null; // réponse non JSON : erreur serveur, délai dépassé…
      }
      if (!res.ok || !data) {
        setAiError(
          data?.error ??
            (res.status === 401
              ? 'Votre session a expiré. Reconnectez-vous puis réessayez.'
              : `Le serveur a rencontré une erreur (code ${res.status}). Réessayez dans un instant.`)
        );
        return;
      }
      if (data.title && !title) setTitle(data.title);

      const aiLines: EditorLineAi[] = data.lines ?? [];
      if (aiLines.length > 0) {
        setLines(
          aiLines.map((l) => ({
            ...l,
            key: newKey(),
          }))
        );
      }
      if (data.remarks) setAiRemarks(data.remarks);
      if (data.clarifying_questions && data.clarifying_questions.length > 0) {
        setAiQuestions(data.clarifying_questions);
      }
    } catch {
      setAiError('Connexion impossible. Vérifiez votre réseau et réessayez.');
    } finally {
      setAiLoading(false);
    }
  }

  const totals = useMemo(
    () =>
      computeQuoteTotals(
        lines.map((l) => ({
          label: l.label || 'Ligne',
          unit: l.unit,
          quantity: parseEuroInput(l.quantity),
          unit_price_ht: parseEuroInput(l.unit_price_ht),
          vat_rate: Number(l.vat_rate) as VatRate,
          discount: parseEuroInput(l.discount),
        })),
        parseEuroInput(globalDiscount),
        parseEuroInput(deposit)
      ),
    [lines, globalDiscount, deposit]
  );

  function updateLine(key: string, patch: Partial<EditorLine>, resetEstimate = false) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (resetEstimate) {
          // L'artisan a corrigé à la main : le prix n'est plus "estimé"
          next.estimated = false;
          next.source = 'manual';
        }
        return next;
      })
    );
  }
  function addLine() {
    setLines((ls) => [...ls, blankLine(defaultVatRate)]);
  }
  function removeLine(key: string) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }
  function moveLine(index: number, dir: -1 | 1) {
    setLines((ls) => {
      const target = index + dir;
      if (target < 0 || target >= ls.length) return ls;
      const copy = [...ls];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }
  function addFromCatalog(item: CatalogRow) {
    setLines((ls) => {
      const emptyIdx = ls.findIndex((l) => !l.label && !l.unit_price_ht);
      const newLine: EditorLine = {
        key: newKey(),
        label: item.label,
        unit: item.unit,
        quantity: '1',
        unit_price_ht: String(Number(item.unit_price_ht)),
        vat_rate: String(Number(item.vat_rate)),
        discount: '0',
        estimated: false,
        source: 'catalog',
      };
      if (emptyIdx !== -1) {
        const copy = [...ls];
        copy[emptyIdx] = { ...newLine, key: copy[emptyIdx].key };
        return copy;
      }
      return [...ls, newLine];
    });
  }

  function submit() {
    const payload = {
      client_id: clientId || undefined,
      new_client:
        clientId || !newClientName
          ? undefined
          : { name: newClientName, email: newClientEmail, phone: newClientPhone, site_address: newClientAddress },
      title,
      execution_delay: executionDelay,
      valid_until: validUntil,
      global_discount: parseEuroInput(globalDiscount),
      deposit_amount: parseEuroInput(deposit),
      intro_text: introText,
      // Les lignes entièrement vides (ex. la ligne de départ) sont ignorées
      lines: lines
        .filter((l) => l.label.trim() || l.unit_price_ht.trim())
        .map((l) => ({
        label: l.label,
        unit: l.unit,
        quantity: parseEuroInput(l.quantity),
        unit_price_ht: parseEuroInput(l.unit_price_ht),
        vat_rate: Number(l.vat_rate),
        discount: parseEuroInput(l.discount),
        estimated: l.estimated,
        source: l.source,
      })),
      save_as_template: saveAsTemplate,
      template_name: templateName || title,
    };
    const hidden = document.getElementById('hidden-payload') as HTMLInputElement;
    hidden.value = JSON.stringify(payload);
    (document.getElementById('quote-form') as HTMLFormElement).requestSubmit();
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const hasEstimated = lines.some((l) => l.estimated);

  return (
    <form id="quote-form" action={formAction} className="space-y-6 pb-32">
      <input type="hidden" name="payload" id="hidden-payload" value="{}" />

      {/* 1. Décrire ou dicter le chantier → IA */}
      <section className="card space-y-4">
        <h2 className="font-bold text-lg">1. Décrivez ou dictez le chantier</h2>
        <textarea
          className="input min-h-[110px] text-lg"
          placeholder="Ex. : remplacement d'un chauffe-eau 200 litres, avec main-d'œuvre et déplacement…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={dictation.toggle}
            disabled={!dictation.supported || aiLoading}
            className={`btn-secondary !w-auto flex-1 ${
              dictation.listening ? '!border-red-400 !bg-red-50 !text-red-700 animate-pulse' : ''
            }`}
          >
            {dictation.listening ? '🎙️ J\u2019écoute… (appuyez pour arrêter)' : '🎤 Dicter'}
          </button>
          <button
            type="button"
            onClick={generateWithAi}
            disabled={aiLoading || description.trim().length < 5}
            className="btn-primary !w-auto flex-1"
          >
            {aiLoading ? 'Génération…' : '⚡ Générer le devis'}
          </button>
        </div>
        {!dictation.supported && (
          <p className="text-sm text-slate-500">
            La dictée vocale n&apos;est pas disponible sur ce navigateur. Tapez votre
            description, ça marche aussi (navigateurs recommandés : Chrome, Edge, Samsung Internet).
          </p>
        )}
        {dictation.error && <p className="text-sm text-red-600">{dictation.error}</p>}
        {aiError && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{aiError}</p>
        )}
        {aiQuestions.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              Pour faire un devis précis, répondez à ces questions :
            </p>
            <ul className="mt-2 list-inside list-decimal space-y-1 text-amber-900">
              {aiQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-amber-800">
              Complétez votre description ci-dessus avec les réponses, puis régénérez.
            </p>
          </div>
        )}
        {aiRemarks && (
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            💡 {aiRemarks}
          </p>
        )}
        {hasEstimated && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            ⚠️ Certaines lignes portent un <strong>prix estimé par l&apos;IA</strong> (marquées
            ci-dessous). Vérifiez-les : vos prix du catalogue sont toujours prioritaires.
          </p>
        )}
      </section>

      {/* 2. Client */}
      <section className="card space-y-4">
        <h2 className="font-bold text-lg">2. Le client</h2>
        {clients.length > 0 && (
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— Nouveau client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {!clientId && (
          <div className="space-y-3">
            <input className="input" placeholder="Nom du client *" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            <input className="input" type="email" inputMode="email" placeholder="Email (pour l'envoi)" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            <input className="input" type="tel" inputMode="tel" placeholder="Téléphone" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
            <input className="input" placeholder="Adresse du chantier" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} />
          </div>
        )}
        {selectedClient?.site_address && (
          <p className="text-sm text-slate-500">Chantier : {selectedClient.site_address}</p>
        )}
      </section>

      {/* 3. Lignes */}
      <section className="space-y-4">
        <h2 className="font-bold text-lg px-1">3. Les prestations</h2>
        {catalogue.length > 0 && (
          <div className="px-1">
            <label className="label">Ajouter depuis mon catalogue</label>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const item = catalogue.find((c) => c.id === e.target.value);
                if (item) addFromCatalog(item);
              }}
            >
              <option value="">Choisir une prestation…</option>
              {catalogue.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} — {Number(item.unit_price_ht).toLocaleString('fr-FR')} € HT
                </option>
              ))}
            </select>
          </div>
        )}

        {lines.map((l, i) => (
          <div key={l.key} className="card space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">{i + 1}</span>
              <input
                className="input flex-1"
                placeholder="Désignation (ex. Remplacement chauffe-eau)"
                value={l.label}
                onChange={(e) => updateLine(l.key, { label: e.target.value })}
              />
            </div>
            {l.estimated && (
              <p className="ml-9 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800">
                ⚠️ Prix estimé, à vérifier
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Quantité</label>
                <input className="input" inputMode="decimal" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
              </div>
              <div>
                <label className="label">Unité</label>
                <select className="input" value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value as Unit })}>
                  {UNITS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">P.U. HT €</label>
                <input
                  className={`input ${l.estimated ? '!border-amber-400' : ''}`}
                  inputMode="decimal"
                  value={l.unit_price_ht}
                  onChange={(e) => updateLine(l.key, { unit_price_ht: e.target.value }, true)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">TVA</label>
                <select className="input" value={l.vat_rate} onChange={(e) => updateLine(l.key, { vat_rate: e.target.value })}>
                  {VAT_RATES.map((r) => (
                    <option key={r} value={r}>{r.toLocaleString('fr-FR')} %</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Remise ligne %</label>
                <input className="input" inputMode="decimal" value={l.discount} onChange={(e) => updateLine(l.key, { discount: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-bold">{formatEuro(totals.lines[i].line_ht_cents)} HT</p>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => moveLine(i, -1)} className="rounded-lg border border-slate-300 px-3 py-1.5">↑</button>
                <button type="button" onClick={() => moveLine(i, 1)} className="rounded-lg border border-slate-300 px-3 py-1.5">↓</button>
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(l.key)} className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600">✕</button>
                )}
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addLine} className="btn-secondary">➕ Ajouter une ligne</button>
      </section>

      {/* 4. Options */}
      <section className="card space-y-4">
        <h2 className="font-bold text-lg">4. Options</h2>
        <div>
          <label className="label">Intitulé du devis (optionnel)</label>
          <input className="input" placeholder="Ex. Remplacement chauffe-eau" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Remise globale €</label>
            <input className="input" inputMode="decimal" value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} />
          </div>
          <div>
            <label className="label">Acompte €</label>
            <input className="input" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valable jusqu&apos;au</label>
            <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div>
            <label className="label">Délai d&apos;exécution</label>
            <input className="input" placeholder="Ex. 2 semaines" value={executionDelay} onChange={(e) => setExecutionDelay(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Message d&apos;introduction (optionnel)</label>
          <textarea className="input min-h-[70px]" placeholder="Bonjour Monsieur Dupuis, voici comme convenu…" value={introText} onChange={(e) => setIntroText(e.target.value)} />
        </div>
      </section>

      {/* Totaux live */}
      <section className="card bg-slate-900 !text-white">
        <div className="flex justify-between py-1">
          <span>Total HT</span>
          <span className="font-bold">{formatEuro(totals.total_ht_cents)}</span>
        </div>
        {totals.vat_buckets.map((b) => (
          <div key={b.rate} className="flex justify-between py-1 text-sm text-slate-300">
            <span>TVA {b.rate.toLocaleString('fr-FR')} %</span>
            <span>{formatEuro(b.vat_cents)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-700 pt-2 text-lg font-bold">
          <span>Total TTC</span>
          <span>{formatEuro(totals.total_ttc_cents)}</span>
        </div>
        {totals.deposit_cents > 0 && (
          <div className="flex justify-between pt-1 text-sm text-slate-300">
            <span>Reste après acompte</span>
            <span>{formatEuro(totals.net_ttc_cents)}</span>
          </div>
        )}
      </section>

      {/* Modèle */}
      <section className="card space-y-3">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
          Enregistrer comme modèle réutilisable
        </label>
        {saveAsTemplate && (
          <input className="input" placeholder="Nom du modèle (ex. Remplacement chauffe-eau)" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        )}
      </section>

      {/* Barre de validation */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {saveState?.error && (
          <p className="mx-auto mb-3 max-w-md rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveState.error}</p>
        )}
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Total TTC</p>
            <p className="font-bold leading-tight">{formatEuro(totals.total_ttc_cents)}</p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={saving || lines.every((l) => !l.label.trim()) || (!clientId && !newClientName.trim())}
            className="btn-primary !w-auto flex-1"
          >
            {saving ? 'Enregistrement…' : 'Créer le devis ✓'}
          </button>
        </div>
      </div>
    </form>
  );
}
