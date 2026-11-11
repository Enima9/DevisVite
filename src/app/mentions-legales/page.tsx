import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, Fill } from '@/components/legal';
import { EDITOR, SITE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: `Mentions légales du site ${SITE.name} : éditeur, directeur de la publication et hébergeur.`,
  alternates: { canonical: '/mentions-legales' },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" intro="Informations prévues par l’article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN).">
      <Section id="editeur" title="Éditeur du site">
        <p>
          Le site {SITE.name} ({SITE.url}) est édité par :
        </p>
        <dl className="space-y-1">
          <div><dt className="inline font-semibold">Nom / raison sociale : </dt><dd className="inline"><Fill value={EDITOR.name} /></dd></div>
          <div><dt className="inline font-semibold">Forme juridique : </dt><dd className="inline"><Fill value={EDITOR.legalForm} /></dd></div>
          <div><dt className="inline font-semibold">Adresse : </dt><dd className="inline"><Fill value={EDITOR.address} /></dd></div>
          <div><dt className="inline font-semibold">SIRET : </dt><dd className="inline"><Fill value={EDITOR.siret} /></dd></div>
          <div><dt className="inline font-semibold">Email : </dt><dd className="inline"><Fill value={EDITOR.email} /></dd></div>
        </dl>
      </Section>

      <Section id="direction" title="Directeur de la publication">
        <p><Fill value={EDITOR.publicationDirector} /></p>
      </Section>

      <Section id="hebergement" title="Hébergement">
        <p>
          Le site est hébergé par <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
          (vercel.com). Les fonctions applicatives sont exécutées dans la région de Paris (France).
        </p>
        <p>
          La base de données et l’authentification sont fournies par <strong>Supabase</strong> et hébergées sur
          l’infrastructure d’Amazon Web Services, région Irlande (Union européenne).
        </p>
      </Section>

      <Section id="propriete" title="Propriété intellectuelle">
        <p>
          La marque {SITE.name}, le logo, l’interface et les textes du site sont la propriété de l’éditeur et protégés par
          le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite. Les devis, catalogues et
          contenus que vous saisissez restent votre propriété.
        </p>
      </Section>

      <Section id="donnees" title="Données personnelles et cookies">
        <p>
          Le traitement de vos données est décrit dans la <Link href="/confidentialite" className="font-medium text-brand underline">politique de confidentialité</Link> et
          l’utilisation des cookies dans la <Link href="/cookies" className="font-medium text-brand underline">politique de cookies</Link>.
        </p>
      </Section>

      <Section id="responsabilite" title="Responsabilité">
        <p>
          L’éditeur s’efforce d’assurer l’exactitude des informations publiées mais ne peut garantir qu’elles soient
          exhaustives ou à jour. Les modalités d’utilisation du service sont précisées dans les{' '}
          <Link href="/cgu" className="font-medium text-brand underline">conditions générales d’utilisation</Link>.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Pour toute question ou réclamation : <Fill value={EDITOR.email} />.
        </p>
      </Section>
    </LegalPage>
  );
}
