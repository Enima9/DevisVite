import fs from 'node:fs';
import path from 'node:path';
import { Font } from '@react-pdf/renderer';

let state: boolean | null = null;

/**
 * Enregistre DejaVu Sans (polices INTÉGRÉES au PDF, nécessaire pour le PDF/A-3 des factures).
 * Retourne le nom de la famille à utiliser ; si les fichiers sont introuvables on retombe sur Helvetica
 * (le PDF reste valide, mais sans polices intégrées).
 */
export function registerInvoiceFonts(): 'DejaVu' | 'Helvetica' {
  if (state === null) {
    const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
    const regular = path.join(dir, 'DejaVuSans.ttf');
    const bold = path.join(dir, 'DejaVuSans-Bold.ttf');
    if (fs.existsSync(regular) && fs.existsSync(bold)) {
      Font.register({
        family: 'DejaVu',
        fonts: [
          { src: regular, fontWeight: 400 },
          { src: bold, fontWeight: 700 },
        ],
      });
      Font.registerHyphenationCallback((word) => [word]); // pas de coupure de mots automatique
      state = true;
    } else {
      state = false;
    }
  }
  return state ? 'DejaVu' : 'Helvetica';
}
