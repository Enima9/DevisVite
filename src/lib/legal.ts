/**
 * Informations légales de l'éditeur — SEUL endroit à modifier.
 *
 * Remplacez chaque « [À COMPLÉTER] » par vos informations réelles : elles alimentent
 * automatiquement les mentions légales, la politique de confidentialité et les CGU.
 * Tant qu'une valeur reste « [À COMPLÉTER] », elle s'affiche surlignée sur les pages publiques.
 */
export const TODO = '[À COMPLÉTER]';

export const EDITOR = {
  /** Raison sociale (société) ou nom et prénom (entrepreneur individuel) */
  name: 'Mohamed-Amine Ketami',
  /** Forme juridique : Micro-entreprise, EI, SAS, SARL… */
  legalForm: 'Entrepreneur individuel',
  /** Adresse postale complète du siège */
  address: TODO,
  /** SIRET (14 chiffres) */
  siret: '498 695 121 00042',
  /** Email de contact — utilisé aussi pour les demandes RGPD */
  email: TODO,
  /** Directeur de la publication (souvent le représentant légal) */
  publicationDirector: 'Mohamed-Amine Ketami',
} as const;

export const SITE = {
  name: 'DevisVite',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://devisvite-phase3.vercel.app',
  description:
    'DevisVite aide les artisans à créer leurs devis en quelques minutes : dictez ou décrivez le chantier, vérifiez, exportez en PDF.',
} as const;

/** Version des textes juridiques — enregistrée avec l'acceptation de l'utilisateur. */
export const LEGAL_VERSION = '2026-11-10';
export const LEGAL_UPDATED_LABEL = '10 novembre 2026';

export const LEGAL_PAGES = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Politique de confidentialité' },
  { href: '/cgu', label: 'Conditions d’utilisation' },
  { href: '/cgv', label: 'Conditions de vente' },
  { href: '/cookies', label: 'Cookies' },
] as const;
