/**
 * Catalogues de départ par métier.
 * Pré-remplissent le catalogue de l'artisan à l'onboarding — modifiables ensuite.
 * Prix indicatifs France 2026, HT, à ajuster par l'artisan.
 */

export const TRADES = [
  { value: 'plombier', label: 'Plombier / Chauffagiste' },
  { value: 'electricien', label: 'Électricien' },
  { value: 'peintre', label: 'Peintre' },
  { value: 'couvreur', label: 'Couvreur' },
  { value: 'menuisier', label: 'Menuisier' },
  { value: 'macon', label: 'Maçon' },
  { value: 'carreleur', label: 'Carreleur' },
  { value: 'autre', label: 'Autre métier du bâtiment' },
] as const;

export type TradeValue = (typeof TRADES)[number]['value'];

export interface SeedItem {
  label: string;
  unit: 'u' | 'h' | 'm2' | 'ml' | 'forfait';
  unit_price_ht: number;
  vat_rate: 0 | 5.5 | 10 | 20;
  category: string;
  is_labor?: boolean;
  is_travel?: boolean;
}

export const CATALOG_SEEDS: Record<TradeValue, SeedItem[]> = {
  plombier: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 45, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Main-d\u2019œuvre plomberie', unit: 'h', unit_price_ht: 55, vat_rate: 20, category: 'Main-d\u2019œuvre', is_labor: true },
    { label: 'Remplacement chauffe-eau électrique 200 L (fourniture + pose)', unit: 'u', unit_price_ht: 890, vat_rate: 20, category: 'Chauffe-eau' },
    { label: 'Remplacement chauffe-eau 150 L', unit: 'u', unit_price_ht: 740, vat_rate: 20, category: 'Chauffe-eau' },
    { label: 'Dégorgement de canalisation', unit: 'forfait', unit_price_ht: 120, vat_rate: 20, category: 'Dépannage' },
    { label: 'Remplacement robinet mitigeur', unit: 'u', unit_price_ht: 140, vat_rate: 20, category: 'Robinetterie' },
    { label: 'Pose d\u2019un évier', unit: 'u', unit_price_ht: 210, vat_rate: 20, category: 'Cuisine' },
    { label: 'Réfection complète d\u2019une salle de bain', unit: 'forfait', unit_price_ht: 4800, vat_rate: 20, category: 'Salle de bain' },
  ],
  electricien: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 45, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Main-d\u2019œuvre électricité', unit: 'h', unit_price_ht: 55, vat_rate: 20, category: 'Main-d\u2019œuvre', is_labor: true },
    { label: 'Point lumineux (fourniture + pose)', unit: 'u', unit_price_ht: 95, vat_rate: 20, category: 'Installation' },
    { label: 'Prise de courant 16A', unit: 'u', unit_price_ht: 75, vat_rate: 20, category: 'Installation' },
    { label: 'Tableau électrique complet (mise aux normes)', unit: 'forfait', unit_price_ht: 950, vat_rate: 20, category: 'Tableau' },
    { label: 'Diagnostic électrique obligatoire', unit: 'forfait', unit_price_ht: 130, vat_rate: 20, category: 'Diagnostic' },
  ],
  peintre: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 35, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Peinture murale (préparation + 2 couches)', unit: 'm2', unit_price_ht: 22, vat_rate: 10, category: 'Peinture' },
    { label: 'Peinture plafond', unit: 'm2', unit_price_ht: 26, vat_rate: 10, category: 'Peinture' },
    { label: 'Pose de papier peint', unit: 'm2', unit_price_ht: 30, vat_rate: 10, category: 'Revêtement' },
    { label: 'Ragréage de mur', unit: 'm2', unit_price_ht: 18, vat_rate: 10, category: 'Préparation' },
  ],
  couvreur: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 50, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Main-d\u2019œuvre couverture', unit: 'h', unit_price_ht: 60, vat_rate: 20, category: 'Main-d\u2019œuvre', is_labor: true },
    { label: 'Remplacement de tuiles', unit: 'u', unit_price_ht: 18, vat_rate: 20, category: 'Tuiles' },
    { label: 'Nettoyage + démoussage de toiture', unit: 'm2', unit_price_ht: 14, vat_rate: 20, category: 'Entretien' },
    { label: 'Réfection de gouttière (PVC)', unit: 'ml', unit_price_ht: 65, vat_rate: 20, category: 'Gouttière' },
  ],
  menuisier: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 45, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Main-d\u2019œuvre menuiserie', unit: 'h', unit_price_ht: 58, vat_rate: 20, category: 'Main-d\u2019œuvre', is_labor: true },
    { label: 'Pose de porte intérieure', unit: 'u', unit_price_ht: 260, vat_rate: 20, category: 'Portes' },
    { label: 'Pose de cuisine (hors fourniture)', unit: 'forfait', unit_price_ht: 1200, vat_rate: 20, category: 'Cuisine' },
    { label: 'Placard sur mesure', unit: 'ml', unit_price_ht: 480, vat_rate: 20, category: 'Sur mesure' },
  ],
  macon: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 50, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Main-d\u2019œuvre maçonnerie', unit: 'h', unit_price_ht: 58, vat_rate: 20, category: 'Main-d\u2019œuvre', is_labor: true },
    { label: 'Ouverture de mur porteur (avec linteau)', unit: 'forfait', unit_price_ht: 2200, vat_rate: 20, category: 'Gros œuvre' },
    { label: 'Dallage béton', unit: 'm2', unit_price_ht: 70, vat_rate: 20, category: 'Gros œuvre' },
    { label: 'Rejointoiement de façade', unit: 'm2', unit_price_ht: 45, vat_rate: 20, category: 'Façade' },
  ],
  carreleur: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 40, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Pose de carrelage au sol', unit: 'm2', unit_price_ht: 45, vat_rate: 10, category: 'Sol' },
    { label: 'Pose de faïence murale', unit: 'm2', unit_price_ht: 50, vat_rate: 10, category: 'Mur' },
    { label: 'Pose de carrelage en diagonale', unit: 'm2', unit_price_ht: 60, vat_rate: 10, category: 'Sol' },
  ],
  autre: [
    { label: 'Déplacement', unit: 'forfait', unit_price_ht: 40, vat_rate: 20, category: 'Déplacement', is_travel: true },
    { label: 'Main-d\u2019œuvre', unit: 'h', unit_price_ht: 50, vat_rate: 20, category: 'Main-d\u2019œuvre', is_labor: true },
  ],
};
