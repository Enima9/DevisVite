import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, UL, Fill } from '@/components/legal';
import { EDITOR, SITE } from '@/lib/legal';
import { PLAN, VAT_FRANCHISE, VAT_NOTICE, planPriceLabel } from '@/lib/billing-config';

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description: `Conditions de vente de l’abonnement ${SITE.name} : prix, paiement, durée, résiliation et remboursement.`,
  alternates: { canonical: '/cgv' },
};

const link = 'font-medium text-brand underline';

export default function CgvPage() {
  const price = planPriceLabel();
  return (
    <LegalPage
      title="Conditions générales de vente"
      intro={`Ces conditions s’appliquent à l’abonnement payant au service ${SITE.name}, vendu à des professionnels.`}
    >
      <Section id="vendeur" title="1. Vendeur">
        <p>
          <Fill value={EDITOR.name} /> ({<Fill value={EDITOR.legalForm} />}), SIRET <Fill value={EDITOR.siret} />, {' '}
          <Fill value={EDITOR.address} />. Contact : <Fill value={EDITOR.email} />. Voir les{' '}
          <Link href="/mentions-legales" className={link}>
            mentions légales
          </Link>
          .
        </p>
      </Section>

      <Section id="offre" title="2. L’offre">
        <p>
          L’abonnement donne accès au <strong>téléchargement des devis en PDF</strong> sans limite, ainsi qu’aux
          fonctionnalités décrites sur la page « Mon abonnement ». Les autres fonctions (création et enregistrement des devis)
          restent accessibles sans abonnement.
        </p>
        <UL>
          {PLAN.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </UL>
      </Section>

      <Section id="prix" title="3. Prix et paiement">
        <p>
          Prix : <strong>{price ?? 'communiqué avant la souscription'}</strong>
          {VAT_FRANCHISE ? <> ({VAT_NOTICE})</> : null}. Le prix exact et la périodicité sont affichés avant la
          validation du paiement. Le paiement s’effectue par carte bancaire via Stripe,
          prestataire de paiement sécurisé ; l’éditeur n’a pas accès à votre numéro de carte.
        </p>
        <p>Une facture est émise pour chaque paiement et accessible depuis le portail de gestion de l’abonnement.</p>
      </Section>

      <Section id="duree" title="4. Durée, renouvellement et résiliation">
        <UL>
          <li>L’abonnement est souscrit pour une période {PLAN.interval === 'month' ? 'd’un mois' : 'd’un an'}, renouvelée automatiquement par tacite reconduction.</li>
          <li>Vous pouvez résilier à tout moment, en un clic, depuis « Mon abonnement » → « Gérer mon abonnement ». La résiliation prend effet à la fin de la période déjà payée ; l’accès au téléchargement est conservé jusqu’à cette date.</li>
          <li>En cas d’échec de paiement, l’accès au téléchargement est suspendu jusqu’à régularisation.</li>
        </UL>
      </Section>

      <Section id="remboursement" title="5. Remboursement et rétractation">
        <p>
          Le service est destiné à un usage professionnel : le droit de rétractation des consommateurs ne s’applique pas, sauf
          disposition légale contraire. Toute période commencée est due et n’est pas remboursée au prorata en cas de
          résiliation. En cas de double paiement, de prélèvement erroné ou de défaillance durable du service de notre fait,
          écrivez-nous : nous procéderons au remboursement correspondant.
        </p>
      </Section>

      <Section id="evolution" title="6. Modification des prix et du service">
        <p>
          Tout changement de prix vous est notifié au moins 30 jours à l’avance et ne s’applique qu’au renouvellement suivant ;
          vous pouvez résilier avant son entrée en vigueur.
        </p>
      </Section>

      <Section id="droit" title="7. Droit applicable et litiges">
        <p>
          Ces conditions sont régies par le droit français. En cas de litige, une solution amiable sera recherchée avant toute
          action ; à défaut, les tribunaux compétents seront ceux déterminés selon les règles de droit commun.
        </p>
      </Section>
    </LegalPage>
  );
}
