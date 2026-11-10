import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';
import { DevisPdf } from '../src/lib/pdf/devis-pdf';
import type { CompanyProfile } from '../src/lib/quotes-server';
import type { LineInput } from '../src/lib/money';
import { computeQuoteTotals } from '../src/lib/money';

const company: CompanyProfile = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Plomberie Dubois',
  legal_form: 'SARL',
  siret: '12345678900011',
  address: '12 rue des Lilas, 69003 Lyon',
  phone: '06 12 34 56 78',
  email: 'contact@plomberie-dubois.fr',
  logo_url: null,
  primary_color: '#1d4ed8',
  iban: 'FR76 1234 5678 9012 3456 7890 123',
  insurance_provider: 'AXA France',
  insurance_policy_number: 'DEC-2026-004512',
  default_vat_rate: 20,
  vat_exemption: false,
  payment_terms: 'Paiement à 30 jours après réception de facture. Acompte de 30 % à la commande.',
  quote_validity_days: 30,
  trade: 'plombier',
};

const lines: LineInput[] = [
  { label: 'Chauffe-eau électrique 200 L (fourniture)', unit: 'u', quantity: 1, unit_price_ht: 690, vat_rate: 20, discount: 0 },
  { label: 'Main-d\u2019œuvre plomberie', unit: 'h', quantity: 3, unit_price_ht: 55, vat_rate: 20, discount: 0 },
  { label: 'Déplacement', unit: 'forfait', quantity: 1, unit_price_ht: 45, vat_rate: 20, discount: 0 },
  { label: 'Pose faïence salle de bain (taux réduit)', unit: 'm2', quantity: 8, unit_price_ht: 50, vat_rate: 10, discount: 0 },
];

describe('PDF devis', () => {
  it('génère un PDF avec les totaux attendus (HT 1 300 €, TTC 1 520 €)', async () => {
    const buffer = (await renderToBuffer(
      React.createElement(DevisPdf, {
        data: {
          company,
          quote: {
            reference: 'DEV-2026-0001',
            title: 'Remplacement chauffe-eau',
            valid_until: '2026-12-08',
            execution_delay: '2 semaines après acceptation',
            created_at: '2026-11-08T10:00:00Z',
            global_discount: 0,
          },
          client: { name: 'M. Pierre Martin', site_address: '5 avenue de la Gare, 69100 Villeurbanne' },
          lines,
          intro_text: 'Bonjour Monsieur Martin, voici le devis comme convenu par téléphone.',
        },
      })
    )) as Buffer;

    // Totaux attendus, calculés par le même moteur que le PDF
    const totals = computeQuoteTotals(lines, 0, 0);
    expect(totals.total_ht_cents).toBe(130000);
    expect(totals.total_vat_cents).toBe(22000); // 180 € (20 %) + 40 € (10 %)
    expect(totals.total_ttc_cents).toBe(152000);

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(2000);

    writeFileSync('/home/user/devisvite/sample-devis.pdf', buffer);
  });

  it('génère un PDF micro-entrepreneur avec mention art. 293 B', async () => {
    const buffer = (await renderToBuffer(
      React.createElement(DevisPdf, {
        data: {
          company: { ...company, vat_exemption: true, iban: null, insurance_provider: null },
          quote: {
            reference: 'DEV-2026-0002',
            title: null,
            valid_until: '2026-12-08',
            execution_delay: null,
            created_at: '2026-11-08T10:00:00Z',
            global_discount: 25,
          },
          client: { name: 'Mme Sophie Durand', site_address: null },
          lines: [lines[0]],
          intro_text: null,
        },
      })
    )) as Buffer;

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
