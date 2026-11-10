import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(2, 'Indiquez le nom de votre entreprise'),
  legal_form: z.string().optional(),
  siret: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{14}$/.test(v.replace(/\s/g, '')),
      'Le SIRET contient 14 chiffres'
    ),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Adresse email invalide').optional().or(z.literal('')),
  primary_color: z.string().default('#1d4ed8'),
  iban: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_policy_number: z.string().optional(),
  default_vat_rate: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  vat_exemption: z.boolean().default(false),
  payment_terms: z.string().default('Paiement à 30 jours après réception de facture.'),
  quote_validity_days: z.coerce.number().int().min(1).max(365).default(30),
  trade: z.string().min(1, 'Choisissez votre métier'),
});

export type CompanyInput = z.infer<typeof companySchema>;
