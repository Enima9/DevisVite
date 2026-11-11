import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, Table, UL } from '@/components/legal';
import { SITE } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Politique de cookies',
  description: `Cookies utilisés par ${SITE.name} : uniquement des cookies strictement nécessaires, sans traceur publicitaire ni statistique.`,
  alternates: { canonical: '/cookies' },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique de cookies"
      intro={`${SITE.name} n’utilise que des cookies strictement nécessaires à son fonctionnement. Aucun cookie publicitaire, de mesure d’audience ou de réseau social n’est déposé : c’est pourquoi le site ne vous affiche pas de bandeau de consentement.`}
    >
      <Section id="definition" title="Qu’est-ce qu’un cookie ?">
        <p>
          Un cookie est un petit fichier enregistré sur votre appareil lorsque vous visitez un site. Il permet, par exemple,
          de vous reconnaître d’une page à l’autre une fois connecté.
        </p>
      </Section>

      <Section id="liste" title="Cookies déposés par le site">
        <Table
          caption="Liste des cookies"
          head={['Nom', 'Finalité', 'Durée', 'Type']}
          rows={[
            [
              <code key="a">sb-…-auth-token</code>,
              'Maintient votre session de connexion (identifie votre compte de manière sécurisée).',
              'Jusqu’à votre déconnexion, 400 jours au maximum',
              'Strictement nécessaire, émis par le site',
            ],
            [
              <code key="b">sb-…-auth-token-code-verifier</code>,
              'Sécurise la connexion par lien magique (vérifie que la demande de connexion vient bien de votre navigateur).',
              'Quelques minutes ; supprimé une fois la connexion terminée',
              'Strictement nécessaire, émis par le site',
            ],
          ]}
        />
        <p>
          Le stockage local du navigateur (localStorage, sessionStorage) n’est pas utilisé. Aucune requête n’est envoyée à des
          services tiers de suivi, de publicité ou de statistiques.
        </p>
      </Section>

      <Section id="consentement" title="Pourquoi aucun bandeau de consentement ?">
        <p>
          Les cookies strictement nécessaires à la fourniture d’un service que vous avez demandé (ici, vous connecter à votre
          compte) sont exemptés de consentement : article 82 de la loi « Informatique et Libertés » et lignes directrices de la
          CNIL sur les cookies et traceurs. Un bandeau n’est obligatoire que pour les cookies non essentiels (publicité,
          mesure d’audience non exemptée, réseaux sociaux…).
        </p>
        <p>
          Si nous ajoutons un jour de tels traceurs, nous demanderons d’abord votre consentement et mettrons cette page à jour.
        </p>
      </Section>

      <Section id="gerer" title="Gérer ou supprimer les cookies">
        <p>Vous pouvez à tout moment supprimer les cookies depuis les réglages de votre navigateur. Conséquences :</p>
        <UL>
          <li>vous serez déconnecté et devrez demander un nouveau lien de connexion ;</li>
          <li>bloquer ces cookies empêche l’accès à l’espace connecté.</li>
        </UL>
      </Section>

      <Section id="plus" title="En savoir plus">
        <p>
          Voir la <Link href="/confidentialite" className="font-medium text-brand underline">politique de confidentialité</Link>{' '}
          pour le détail des données personnelles traitées et de vos droits.
        </p>
      </Section>
    </LegalPage>
  );
}
