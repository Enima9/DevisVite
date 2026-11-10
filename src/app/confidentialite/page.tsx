import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, Table, UL, Fill } from '@/components/legal';
import { EDITOR, SITE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: `Données personnelles traitées par ${SITE.name}, finalités, durées de conservation, sous-traitants et exercice de vos droits (RGPD).`,
  alternates: { canonical: '/confidentialite' },
};

const link = 'font-medium text-brand underline';

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro={`Nous ne collectons que les données nécessaires pour vous permettre de créer vos devis. Cette page explique lesquelles, pourquoi, combien de temps nous les gardons et comment exercer vos droits, conformément au Règlement général sur la protection des données (RGPD) et à la loi « Informatique et Libertés ».`}
    >
      <Section id="responsable" title="1. Qui est responsable de vos données ?">
        <p>
          Le responsable du traitement des données de votre compte est <strong><Fill value={EDITOR.name} /></strong>, {' '}
          <Fill value={EDITOR.address} /> (SIRET <Fill value={EDITOR.siret} />), éditeur de {SITE.name}. Contact :{' '}
          <Fill value={EDITOR.email} />.
        </p>
        <p>
          <strong>Les données de vos propres clients</strong> (nom, email, téléphone, adresse de chantier) que vous saisissez pour
          établir vos devis sont placées sous votre responsabilité : vous êtes responsable du traitement et {SITE.name} agit
          comme sous-traitant, uniquement sur vos instructions (voir les{' '}
          <Link href="/cgu" className={link}>conditions d’utilisation</Link>, article « Données personnelles »).
        </p>
      </Section>

      <Section id="donnees" title="2. Données traitées, finalités et bases légales">
        <Table
          caption="Données traitées par DevisVite"
          head={['Données', 'Pourquoi', 'Base légale']}
          rows={[
            [
              'Adresse email',
              'Créer votre compte et vous connecter par lien magique (aucun mot de passe).',
              'Exécution du contrat (art. 6.1.b RGPD)',
            ],
            [
              'Profil de votre entreprise : nom, forme juridique, SIRET, adresse, téléphone, email professionnel, métier, taux de TVA, conditions de paiement, assurance décennale (assureur, n° de police), couleur, IBAN (facultatif)',
              'Faire figurer les mentions obligatoires sur vos devis PDF. L’IBAN, facultatif, n’est affiché sur le devis que si vous le renseignez.',
              'Exécution du contrat ; obligation légale pour les mentions des devis',
            ],
            [
              'Vos clients : nom, email, téléphone, adresse du chantier',
              'Établir et retrouver vos devis.',
              'Exécution du contrat (vous en êtes responsable)',
            ],
            [
              'Devis : lignes, prix, textes, statut, historique des changements de statut',
              'Créer, modifier, exporter et suivre vos devis.',
              'Exécution du contrat',
            ],
            [
              'Catalogue de prestations et modèles de devis',
              'Pré-remplir vos devis avec vos tarifs.',
              'Exécution du contrat',
            ],
            [
              'Texte de description du chantier (écrit ou dicté) et libellés/prix de votre catalogue, envoyés au service d’IA',
              'Générer un brouillon de devis que vous vérifiez. Ne sont envoyés ni votre email ni les coordonnées de vos clients, sauf si vous les écrivez vous-même dans la description.',
              'Exécution du contrat (fonction demandée par vous)',
            ],
            [
              'Compteur de dépense IA du mois et limites d’usage',
              'Maîtriser les coûts et éviter les abus.',
              'Intérêt légitime (art. 6.1.f)',
            ],
            [
              'Date et version des conditions acceptées',
              'Conserver la preuve de votre acceptation.',
              'Intérêt légitime (preuve)',
            ],
            [
              'Données techniques (adresse IP, navigateur) dans les journaux de nos hébergeurs',
              'Sécurité, détection d’abus, résolution des pannes.',
              'Intérêt légitime (sécurité du service)',
            ],
          ]}
        />
        <p>
          <strong>Dictée vocale.</strong> Le bouton « Dicter » utilise la reconnaissance vocale de votre navigateur (Google pour
          Chrome, Microsoft pour Edge, Apple pour Safari). Votre voix est traitée par ce service selon sa propre politique ;
          {' '}{SITE.name} ne reçoit ni n’enregistre jamais l’audio, seulement le texte obtenu. Vous pouvez aussi taper votre
          description.
        </p>
      </Section>

      <Section id="non" title="3. Ce que nous ne faisons pas">
        <UL>
          <li>Aucune publicité, aucune revente ni cession de vos données.</li>
          <li>Aucun outil de mesure d’audience ni traceur tiers (voir la <Link href="/cookies" className={link}>politique de cookies</Link>).</li>
          <li>Aucun profilage, aucune décision automatisée produisant des effets juridiques : l’IA propose un brouillon, c’est toujours vous qui validez.</li>
          <li>Aucune utilisation de vos données pour entraîner des modèles d’IA de notre part.</li>
        </UL>
      </Section>

      <Section id="destinataires" title="4. Qui reçoit vos données ?">
        <p>Seules les personnes habilitées de l’éditeur et les sous-traitants techniques suivants y ont accès :</p>
        <Table
          caption="Sous-traitants"
          head={['Prestataire', 'Rôle', 'Localisation']}
          rows={[
            ['Supabase', 'Base de données, authentification, envoi de l’email de connexion', 'Données hébergées chez AWS, Irlande (UE)'],
            ['Vercel', 'Hébergement et exécution de l’application', 'Exécution en France (Paris) ; société établie aux États-Unis'],
            ['Stripe', 'Paiement de l’abonnement, facturation (Stripe reçoit vos données de paiement ; l’éditeur n’en conserve que l’état de l’abonnement)', 'Union européenne / États-Unis (Stripe Payments Europe, Irlande)'],
            ['Anthropic', 'Génération des brouillons de devis par IA (description du chantier et catalogue)', 'États-Unis'],
          ]}
        />
        <p>
          Les autorités peuvent obtenir communication de données lorsque la loi l’exige. Vos devis ne sont jamais transmis à
          un tiers sans action de votre part.
        </p>
      </Section>

      <Section id="transferts" title="5. Transferts hors de l’Union européenne">
        <p>
          Certains prestataires (Vercel, Anthropic, Stripe, Supabase) sont des sociétés américaines. Ces transferts sont encadrés par
          les garanties prévues au chapitre V du RGPD : clauses contractuelles types de la Commission européenne et/ou
          certification au cadre de protection des données UE–États-Unis (Data Privacy Framework), selon le prestataire.
          Les données de votre compte sont stockées dans l’Union européenne.
        </p>
      </Section>

      <Section id="duree" title="6. Combien de temps conservons-nous vos données ?">
        <Table
          caption="Durées de conservation"
          head={['Données', 'Durée']}
          rows={[
            ['Compte, profil, clients, devis, catalogue, modèles', 'Tant que votre compte existe. Elles sont effacées immédiatement lorsque vous supprimez votre compte (Réglages → « Mes données »).'],
            ['Sauvegardes techniques de l’hébergeur', 'Écrasées selon leur cycle de rotation, au plus quelques semaines après la suppression.'],
            ['Journaux techniques (IP, erreurs)', 'Courte durée, fixée par nos hébergeurs (de l’ordre de quelques heures à quelques jours).'],
            ['Preuve d’acceptation des conditions', 'Durée du compte.'],
            ['État de l’abonnement (statut, date de renouvellement)', 'Durée du compte. Les factures sont conservées par Stripe et l’éditeur 10 ans (obligation comptable).'],
          ]}
        />
        <p>
          Vous restez libre de conserver ailleurs vos devis : exportez-les en PDF ou téléchargez toutes vos données avant de
          supprimer votre compte. Attention : conserver vos devis et factures selon vos propres obligations comptables et
          commerciales reste de votre responsabilité.
        </p>
      </Section>

      <Section id="droits" title="7. Vos droits">
        <p>Vous disposez des droits d’accès, de rectification, d’effacement, de limitation, d’opposition, de portabilité, ainsi que du droit de retirer votre consentement et de définir des directives sur le sort de vos données après votre décès.</p>
        <UL>
          <li><strong>Accès et portabilité :</strong> Réglages → « Mes données » → « Télécharger mes données » (fichier JSON).</li>
          <li><strong>Rectification :</strong> modifiez votre profil dans <Link href="/reglages" className={link}>Réglages</Link>.</li>
          <li><strong>Effacement :</strong> Réglages → « Mes données » → « Supprimer mon compte et toutes mes données » (immédiat, irréversible).</li>
          <li><strong>Autres demandes :</strong> écrivez à <Fill value={EDITOR.email} />. Nous répondons dans un délai d’un mois.</li>
        </UL>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL :
          {' '}<a href="https://www.cnil.fr/fr/plaintes" className={link}>www.cnil.fr/fr/plaintes</a> — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
        </p>
      </Section>

      <Section id="securite" title="8. Sécurité">
        <UL>
          <li>Connexion chiffrée (HTTPS) et authentification par lien magique à usage unique, sans mot de passe à voler.</li>
          <li>Isolation stricte des données : chaque compte ne peut lire et modifier que ses propres données (règles de sécurité au niveau de la base de données).</li>
          <li>Accès limité aux personnes qui en ont besoin, sous-traitants soumis à des obligations de sécurité et de confidentialité.</li>
        </UL>
        <p>En cas de violation de données susceptible d’engendrer un risque pour vous, nous vous en informons et prévenons la CNIL dans les délais légaux.</p>
      </Section>

      <Section id="public" title="9. Public concerné">
        <p>{SITE.name} s’adresse aux professionnels (artisans, entreprises du bâtiment). Le service n’est pas destiné aux mineurs.</p>
      </Section>

      <Section id="evolutions" title="10. Évolution de cette politique">
        <p>Nous pouvons mettre à jour cette politique ; la date de dernière mise à jour figure en haut de page. En cas de changement important, vous en serez informé dans l’application.</p>
      </Section>
    </LegalPage>
  );
}
