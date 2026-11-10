'use client';

import { useState } from 'react';

export default function ShareQuote({ link, clientName, reference }: { link: string; clientName: string; reference: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Bonjour ${clientName}, voici votre devis ${reference} : ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Copie impossible : le champ reste sélectionnable manuellement
    }
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `Devis ${reference}`, text: message, url: link });
      else await copy();
    } catch {
      // Partage annulé
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor="lien-devis" className="label">
        Lien du devis pour votre client
      </label>
      <input id="lien-devis" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={copy} className="btn-secondary !text-base">
          {copied ? 'Lien copié ✓' : 'Copier le lien'}
        </button>
        <button type="button" onClick={share} className="btn-secondary !text-base">
          Partager…
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary !text-base"
      >
        Envoyer par WhatsApp
      </a>
      <p role="status" className="sr-only">
        {copied ? 'Lien copié dans le presse-papiers' : ''}
      </p>
    </div>
  );
}
