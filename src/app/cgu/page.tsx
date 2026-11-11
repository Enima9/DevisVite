import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, UL, Fill } from '@/components/legal';
import { EDITOR, SITE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation',
  description: `Conditions d’utilisation du service ${SITE.name} : accès, obligations, intelligence artificielle, données, responsabilité, tarifs et remboursement.`,
  alternates: { canonical: '/cgu' },
};

const link = 'font-medium text-brand underline';

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions générales d’utilisation"
      intro={`Ces conditions régissent l’utilisation de ${SITE.name}, un service en ligne qui aide les professionnels à préparer leurs devis. En créant un compte, vous les acceptez.`}
    >
      <Section id="objet" title="1. Objet et éditeur">
        <p>
          Le service {SITE.name} est édité par <Fill value={EDITOR.name} /> (<Fill value={EDITOR.legalForm} />, SIRET{' '}
          <Fill value={EDITOR.siret} />, <Fill value={EDITOR.address} />). Voir les{' '}
          <Link href="/mentions-legales" className={link}>mentions légales</Link>.
        </p>
      </Section>

      <Section id="acces" title="2. Accès au service">
        <UL>
          <li>Le service est réservé aux professionnels agissant pour leurs besoins professionnels.</li>
          <li>L’accès se fait par un lien de connexion envoyé par email. Le compte est personnel : ne partagez pas vos liens de connexion.</li>
          <li>Vous devez fournir des informations exactes et à jour, notamment celles qui figurent sur vos devis.</li>
          <li>Vous êtes responsable de l’accès à votre messagerie et des actions réalisées depuis votre compte.</li>
        </UL>
      </Section>

      <Section id="service" title="3. Description du service">
        <p>
          {SITE.name} permet de créer des devis (à la main ou avec l’aide d’une intelligence artificielle), de gérer un
          catalogue de prestations, de suivre l’état des devis et de les exporter en PDF. Le service évolue : des
          fonctionnalités peuvent être ajoutées, modifiées ou retirées.
        </p>
      </Section>

      <Section id="ia" title="4. Intelligence artificielle">
        <UL>
          <li>L’IA propose un <strong>brouillon</strong>. Quantités, prix, TVA et mentions peuvent être inexacts : les lignes dont le prix est estimé sont signalées.</li>
          <li><strong>Vous devez relire et valider chaque devis</strong> avant de le remettre à votre client. Vous restez seul responsable de son contenu et de son exactitude.</li>
          <li>Votre description du chantier et votre catalogue sont transmis à notre prestataire d’IA pour produire le brouillon. N’y écrivez pas de données personnelles inutiles (nom ou téléphone du client, par exemple).</li>
          <li>Des limites d’usage (nombre de générations par heure, budget mensuel) peuvent s’appliquer. Le service reste utilisable sans l’IA.</li>
        </UL>
      </Section>

      <Section id="obligations" title="5. Vos obligations">
        <UL>
          <li>Respecter la loi, notamment les règles applicables aux devis (mentions obligatoires, TVA, assurance décennale le cas échéant, information du consommateur). {SITE.name} fournit un modèle, mais ne constitue pas un conseil juridique, fiscal ou comptable.</li>
          <li>Ne pas porter atteinte au fonctionnement du service : pas de tentative d’accès aux données d’autrui, de surcharge, de contournement des limites ou d’usage automatisé abusif.</li>
          <li>Ne pas enregistrer de contenu illicite.</li>
        </UL>
      </Section>

      <Section id="donnees" title="6. Données personnelles">
        <p>
          Pour les données de votre compte, l’éditeur est responsable du traitement (voir la{' '}
          <Link href="/confidentialite" className={link}>politique de confidentialité</Link>).
        </p>
        <p>
          Pour les données personnelles de vos clients que vous saisissez, vous êtes responsable du traitement et l’éditeur agit
          comme sous-traitant au sens de l’article 28 du RGPD. À ce titre, l’éditeur :
        </p>
        <UL>
          <li>traite ces données uniquement pour fournir le service et selon vos instructions (vos actions dans l’application) ;</li>
          <li>assure la confidentialité et la sécurité des données et impose les mêmes obligations à ses sous-traitants (Supabase, Vercel, Anthropic) ;</li>
          <li>vous aide à répondre aux demandes d’exercice de droits (export et suppression disponibles dans les Réglages) ;</li>
          <li>vous informe sans délai excessif de toute violation de données le concernant ;</li>
          <li>supprime les données à la fermeture de votre compte.</li>
        </UL>
        <p>Il vous appartient d’informer vos clients du traitement de leurs données et de disposer d’une base légale pour les saisir.</p>
      </Section>

      <Section id="pi" title="7. Propriété intellectuelle">
        <p>
          L’éditeur conserve tous les droits sur le service, sa marque et son interface. Vous conservez tous les droits sur vos
          contenus (devis, catalogue, textes) et nous concédez uniquement le droit de les héberger et de les traiter pour vous
          fournir le service.
        </p>
      </Section>

      <Section id="disponibilite" title="8. Disponibilité et responsabilité">
        <UL>
          <li>L’éditeur met en œuvre les moyens raisonnables pour assurer un service accessible et sécurisé, sans garantir une disponibilité continue (maintenance, incident, dépendance à des prestataires).</li>
          <li>Pensez à exporter vos devis importants en PDF : le service n’est pas une solution d’archivage légal.</li>
          <li>Sauf faute lourde ou dolosive, la responsabilité de l’éditeur est limitée aux dommages directs et prévisibles, et exclut les pertes indirectes (perte de chiffre d’affaires, de clientèle, de chance) résultant de l’usage du service ou d’un devis comportant une erreur.</li>
        </UL>
      </Section>

      <Section id="tarifs" title="9. Abonnement, paiement et remboursement">
        <p>
          La création de compte, la préparation et l’enregistrement des devis sont accessibles sans paiement. Le{' '}
          <strong>téléchargement des devis en PDF est réservé aux entreprises abonnées</strong>. Le prix, la périodicité, la
          durée, les modalités de résiliation et de remboursement sont détaillés dans les{' '}
          <Link href="/cgv" className={link}>
            conditions générales de vente
          </Link>
          , présentées avant tout paiement.
        </p>
        <p>
          Le paiement est traité par Stripe : l’éditeur ne voit ni ne conserve votre numéro de carte. Aucun prélèvement n’est
          effectué sans votre accord exprès sur la page de paiement. Le service étant destiné à un usage professionnel, le
          droit de rétractation prévu pour les consommateurs ne s’applique pas, sauf disposition légale contraire.
        </p>
      </Section>

      <Section id="fin" title="10. Fin du compte">
        <UL>
          <li>Vous pouvez supprimer votre compte et toutes vos données à tout moment depuis Réglages → « Mes données ». La suppression est immédiate et irréversible : téléchargez vos données avant.</li>
          <li>L’éditeur peut suspendre ou fermer un compte en cas de manquement grave à ces conditions ou d’usage abusif, après information lorsque c’est possible.</li>
        </UL>
      </Section>

      <Section id="modification" title="11. Modification des conditions">
        <p>
          L’éditeur peut modifier ces conditions. Les changements importants vous sont notifiés dans l’application ; la version
          en vigueur est celle publiée sur cette page. Si vous n’êtes pas d’accord, vous pouvez supprimer votre compte.
        </p>
      </Section>

      <Section id="droit" title="12. Droit applicable et litiges">
        <p>
          Ces conditions sont soumises au droit français. En cas de difficulté, contactez d’abord l’éditeur à{' '}
          <Fill value={EDITOR.email} /> pour rechercher une solution amiable. À défaut, les tribunaux français compétents seront
          saisis. Le service s’adressant à des professionnels, le dispositif de médiation de la consommation ne s’applique pas.
        </p>
      </Section>
    </LegalPage>
  );
}
