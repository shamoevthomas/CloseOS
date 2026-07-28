// Contenu partagé du pop-up "Quoi de neuf — V5", affiché une seule fois à la
// prochaine connexion sur chacun des 3 produits CloseOS (Sales, Business, Sign).
// Fichier volontairement séparé de la logique d'affichage : Sales, Business et
// Sign ont chacun leur propre composant de modale (DA différente), mais lisent
// tous ce même contenu — un seul endroit à modifier pour changer le texte.
//
// Pur — aucun React, aucune dépendance produit. Import relatif depuis les 3 apps
// (src/lib/, src/business/, ou pages Sign).

export type WhatsNewProduct = 'sales' | 'business' | 'sign'

/** Icônes disponibles — chaque modale mappe ce nom vers son propre import lucide-react. */
export type WhatsNewIconName =
  | 'sparkles' | 'mail' | 'calendar' | 'check-square' | 'bar-chart'
  | 'copy' | 'clock' | 'phone' | 'file-text' | 'bot' | 'users'
  | 'globe' | 'bell' | 'video' | 'link'

export interface WhatsNewItem {
  icon: WhatsNewIconName
  title: string
  description: string
}

export interface WhatsNewSection {
  tabLabel: string
  heading: string
  subheading: string
  items: WhatsNewItem[]
}

/** Ordre d'affichage par défaut des onglets (le produit courant passe toujours en premier). */
export const WHATS_NEW_PRODUCT_ORDER: WhatsNewProduct[] = ['sales', 'business', 'sign']

export const WHATS_NEW_V5: Record<WhatsNewProduct, WhatsNewSection> = {
  sales: {
    tabLabel: 'CloseOS Sales',
    heading: 'CloseOS Sales fait peau neuve',
    subheading: 'Une nouvelle interface, plus claire, et plusieurs outils pour ne plus rien laisser filer.',
    items: [
      {
        icon: 'video',
        title: 'Bouton « Répondu » + suivi de discussion',
        description: 'Marquez un prospect comme ayant répondu (ça compte dans votre taux de réponse) : les relances se mettent en pause. Un jour après, CloseOS vous demande où en est la discussion — qualifié, disqualifié, ou on relance.',
      },
      {
        icon: 'clock',
        title: 'Relances qui s\'enchaînent',
        description: 'Chaque relance se planifie désormais X jours après la précédente (et non plus depuis l\'entrée en « Contacté »), avec la date de la prochaine relance affichée sur la fiche.',
      },
      {
        icon: 'bell',
        title: 'Liste « À relancer & à suivre »',
        description: 'Un bouton sur le pipeline liste d\'un coup qui relancer et qui a répondu. Et un email récapitulatif de vos discussions en cours vous arrive chaque jour à 17h.',
      },
      {
        icon: 'sparkles',
        title: 'Nouvelle interface',
        description: "Un design entièrement repensé, plus lumineux, avec un mode sombre disponible partout dans l'app.",
      },
      {
        icon: 'mail',
        title: 'Étape « Contacté » + relances automatiques',
        description: 'Un prospect contacté déclenche ses propres rappels de relance, avec des tags pour ne rien oublier.',
      },
      {
        icon: 'calendar',
        title: 'Agenda anti-conflit',
        description: 'Votre agenda s\'affiche en direct à chaque prise de rendez-vous, avec une alerte si un créneau chevauche un autre événement.',
      },
      {
        icon: 'check-square',
        title: 'Tâches par prospect',
        description: 'Ajoutez des tâches avec échéance sur chaque fiche, et retrouvez-les toutes sur votre tableau de bord.',
      },
      {
        icon: 'bar-chart',
        title: 'Rapport de performance',
        description: 'CA gagné, taux de closing, RDV réalisés : un rapport hebdomadaire, dans l\'app et par email.',
      },
      {
        icon: 'copy',
        title: 'Détection des doublons',
        description: 'CloseOS repère les fiches en double (même email ou téléphone) et vous propose de les fusionner en un clic.',
      },
      {
        icon: 'clock',
        title: 'Rappels à l\'heure précise',
        description: 'Programmez un rappel à une heure exacte : un email vous arrive automatiquement 5 minutes avant.',
      },
      {
        icon: 'phone',
        title: 'Numéro international',
        description: 'Le champ téléphone reconnaît l\'indicatif international et met en forme le numéro automatiquement.',
      },
      {
        icon: 'file-text',
        title: 'Emails harmonisés avec la nouvelle interface',
        description: 'Bienvenue, rappels d\'essai, parrainage… tous vos emails CloseOS reprennent désormais la même charte que l\'application.',
      },
    ],
  },

  business: {
    tabLabel: 'CloseOS Business',
    heading: 'Du nouveau dans CloseOS Business',
    subheading: 'Un nouveau module, un assistant IA, et plusieurs correctifs qui comptent.',
    items: [
      {
        icon: 'video',
        title: 'Bouton « Répondu » + suivi de discussion',
        description: 'Marquez un prospect comme ayant répondu (ça compte dans le taux de réponse) : les relances se mettent en pause. Un jour après, CloseOS demande où en est la discussion — qualifié, disqualifié, ou on relance.',
      },
      {
        icon: 'clock',
        title: 'Relances qui s\'enchaînent',
        description: 'Chaque relance se planifie désormais X jours après la précédente (et non plus depuis l\'entrée en « Contacté »), avec la date de la prochaine relance affichée sur la fiche.',
      },
      {
        icon: 'bell',
        title: 'Liste « À relancer & à suivre »',
        description: 'Un bouton sur le pipeline liste qui relancer et qui a répondu ; les managers peuvent voir la liste de chaque setter. Un digest de suivi part chaque jour à 17h au commercial assigné.',
      },
      {
        icon: 'file-text',
        title: 'Formulaires',
        description: 'Créez vos propres formulaires (candidature, sondage, brief client…) avec un éditeur façon Notion — tapez « / » pour insérer un champ, y compris une vidéo à visionnage obligatoire.',
      },
      {
        icon: 'bell',
        title: 'Relances « No Show »',
        description: 'Un prospect absent à son rendez-vous reçoit désormais automatiquement jusqu\'à 7 emails de relance, avec un lien de réservation relié à votre CRM.',
      },
      {
        icon: 'bot',
        title: 'Assistant IA',
        description: 'Connectez Claude à votre compte CloseOS pour piloter prospects, campagnes et rendez-vous directement depuis votre assistant (Paramètres → Assistant IA).',
      },
      {
        icon: 'copy',
        title: 'Détection des doublons',
        description: 'Comme sur Sales : repérage et fusion des fiches en double, sur le Pipeline et le CRM.',
      },
      {
        icon: 'users',
        title: 'Filtres d\'équipe corrigés',
        description: 'Les prospects assignés à un setter s\'affichent désormais correctement dans tous les filtres et compteurs.',
      },
      {
        icon: 'globe',
        title: 'Réservation sans erreur de fuseau',
        description: 'Un prospect à l\'étranger voit maintenant les bons créneaux, sans conflit ni décalage horaire.',
      },
      {
        icon: 'clock',
        title: 'Page Rappels améliorée',
        description: 'Bouton « urgences » fonctionnel, libellés et colonnes enfin complets.',
      },
      {
        icon: 'check-square',
        title: 'Extras achetables depuis les Paramètres',
        description: 'Setup, intégration ou combo : ajoutez un extra à tout moment depuis l\'onglet Profil, sans repasser par un nouvel abonnement.',
      },
      {
        icon: 'sparkles',
        title: 'Connexion Google en un clic',
        description: 'Associez votre compte Google depuis Sécurité & Connexion pour vous connecter plus vite, en plus de votre email et mot de passe.',
      },
    ],
  },

  sign: {
    tabLabel: 'CloseOS Sign',
    heading: 'CloseOS Sign s\'ouvre à votre équipe',
    subheading: 'Vos collaborateurs peuvent désormais signer en votre nom, chacun avec son propre espace.',
    items: [
      {
        icon: 'users',
        title: 'Espace équipe',
        description: 'Invitez vos collaborateurs : chacun génère ses propres contrats depuis les modèles que vous lui assignez, avec son propre tableau de bord.',
      },
      {
        icon: 'link',
        title: 'Invitation en un lien',
        description: 'Un lien d\'invitation suffit pour rejoindre votre équipe Sign — ou directement depuis CloseOS Business si vous utilisez déjà les deux.',
      },
      {
        icon: 'bot',
        title: 'Assistant IA multi-comptes',
        description: 'Chaque propriétaire peut désormais connecter son propre assistant IA à son compte Sign, depuis les Paramètres.',
      },
      {
        icon: 'sparkles',
        title: 'Connexion Google en un clic',
        description: 'Associez votre compte Google depuis votre Profil pour vous connecter plus vite, en plus de votre email et mot de passe.',
      },
    ],
  },
}
