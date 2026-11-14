import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(2, 'Indiquez le nom de votre entreprise').max(120, 'Nom trop long (120 caractères maximum)'),
  legal_form: z.string().max(60).optional(),
  siret: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{14}$/.test(v.replace(/\s/g, '')),
      'Le SIRET contient 14 chiffres'
    ),
  address: z.string().max(500, 'Adresse trop longue (500 caractères maximum)').optional(),
  phone: z.string().max(30, 'Numéro de téléphone trop long').optional(),
  email: z.string().max(254).email('Adresse email invalide').optional().or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide').default('#1d4ed8'),
  iban: z.string().max(42, 'IBAN trop long').optional(),
  insurance_provider: z.string().max(120).optional(),
  insurance_policy_number: z.string().max(60).optional(),
  default_vat_rate: z.union([z.literal(0), z.literal(5.5), z.literal(10), z.literal(20)]),
  vat_exemption: z.boolean().default(false),
  vat_number: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^[A-Za-z]{2}[A-Za-z0-9]{2,13}$/.test(v.replace(/[\s.]/g, '')),
      'Numéro de TVA invalide (exemple : FR12345678901)'
    )
    .transform((v) => (v ? v.replace(/[\s.]/g, '').toUpperCase() : undefined)),
  vat_on_debits: z.boolean().default(false),
  payment_terms: z.string().max(1000, 'Conditions de paiement trop longues (1000 caractères maximum)').default('Paiement à 30 jours après réception de facture.'),
  quote_validity_days: z.coerce.number().int().min(1).max(365).default(30),
  trade: z.string().min(1, 'Choisissez votre métier').max(60),
});

export type CompanyInput = z.infer<typeof companySchema>;
