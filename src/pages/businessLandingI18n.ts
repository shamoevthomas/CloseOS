import { createContext, useContext } from 'react'

export type Lang = 'fr' | 'en'

// ───────────────────────────────────────────────
// Role feature structure
// ───────────────────────────────────────────────
interface RoleFeatureTranslation {
  title: string
  items: string[]
}

interface RoleTranslation {
  label: string
  tagline: string
  description: string
  features: RoleFeatureTranslation[]
}

// ───────────────────────────────────────────────
// FAQ structure
// ───────────────────────────────────────────────
interface FAQTranslation {
  question: string
  answer: string
}

// ───────────────────────────────────────────────
// Full translation shape
// ───────────────────────────────────────────────
export interface Translations {
  // Nav
  nav_integrations: string
  nav_management: string
  nav_crm: string
  nav_roles: string
  nav_demo: string
  nav_pricing: string
  nav_partners: string
  nav_faq: string
  nav_waitlist: string

  // Hero badges
  hero_badge_rgpd: string
  hero_badge_closers: string
  hero_badge_closers_text: string
  hero_badge_eco: string

  // Hero
  hero_title: string
  hero_pain: string
  hero_subtitle: string
  hero_cta: string
  hero_social_proof: string
  hero_social_proof_count: string

  // Integrations strip
  integrations_header: string
  integrations_subheader: string

  // Dashboard / Management section
  management_badge: string
  management_title: string
  management_description: string

  // Macro Dashboard
  dashboard_title: string
  dashboard_description: string
  kpi_ca_reel: string
  kpi_ca_closer: string
  kpi_taux_closing: string
  kpi_taux_noshow: string
  kpi_vs_last_month: string

  // Team Management
  team_title: string
  team_description: string
  team_member_conv: string
  team_member_online: string

  // Shared Pipeline
  pipeline_title: string
  pipeline_description: string
  pipeline_rdv_fixe: string

  // Revenue & Stripe
  revenue_stripe_connect: string
  revenue_title: string
  revenue_description: string
  revenue_item_mrr: string
  revenue_item_matching: string
  revenue_item_charges: string
  revenue_item_new_client: string
  revenue_kpi_mrr: string
  revenue_kpi_ca_mois: string
  revenue_kpi_marge: string
  revenue_kpi_abonnements: string
  revenue_kpi_commissions: string
  revenue_kpi_churn: string
  revenue_kpi_mrr_change: string
  revenue_kpi_ca_mois_change: string
  revenue_kpi_marge_pct: string
  revenue_kpi_abonnements_sub: string
  revenue_kpi_commissions_sub: string
  revenue_kpi_churn_change: string

  // Onboarding
  onboarding_label: string
  onboarding_title: string
  onboarding_description: string
  onboarding_item_reporting: string
  onboarding_item_exports: string
  onboarding_box_scripts_title: string
  onboarding_box_scripts_desc: string
  onboarding_box_videos_title: string
  onboarding_box_videos_desc: string
  onboarding_box_progress_title: string
  onboarding_box_progress_desc: string
  onboarding_box_exports_title: string
  onboarding_box_exports_desc: string

  // CRM Section
  crm_badge: string
  crm_title: string
  crm_subtitle: string

  // CRM Features
  crm_feature_pipeline_title: string
  crm_feature_pipeline_desc: string
  crm_feature_relances_title: string
  crm_feature_relances_reminder: string
  crm_feature_tags_title: string
  crm_feature_tag_froid: string
  crm_feature_tag_rappel: string
  crm_feature_tag_urgent: string
  crm_feature_csv_title: string
  crm_feature_csv_desc: string

  // Qualification Section
  qualification_badge: string
  qualification_title: string
  qualification_subtitle: string
  qualification_check_1: string
  qualification_check_2: string
  qualification_check_3: string
  qualification_check_4: string
  qualification_check_5: string
  qualification_mock_name: string
  qualification_mock_role: string
  qualification_mock_q1: string
  qualification_mock_a1: string
  qualification_mock_q2: string
  qualification_mock_a2: string
  qualification_mock_q3: string
  qualification_mock_a3: string
  qualification_mock_q3_badge: string
  qualification_mock_score: string
  qualification_mock_eliminatory: string

  // CRM KPIs
  crm_kpi_pipeline_title: string
  crm_kpi_pipeline_value: string
  crm_kpi_pipeline_desc: string
  crm_kpi_performance_title: string
  crm_kpi_performance_value: string
  crm_kpi_performance_desc: string
  crm_kpi_velocity_title: string
  crm_kpi_velocity_value: string
  crm_kpi_velocity_desc: string
  crm_book_demo: string

  // Capture Section
  capture_badge: string
  capture_title: string
  capture_description: string
  capture_item_custom: string
  capture_item_embed: string
  capture_item_popup: string
  capture_item_video: string
  capture_item_precapture: string
  capture_item_payment: string
  capture_tab_page: string
  capture_tab_embed: string
  capture_tab_popup: string

  // Capture Page preview
  capture_page_title: string
  capture_page_subtitle: string
  capture_page_prenom: string
  capture_page_email: string
  capture_page_phone: string
  capture_page_continue: string
  capture_page_calendar_blur: string
  capture_calendar_days: string[]

  // Capture Embed preview
  capture_embed_title: string
  capture_embed_subtitle: string
  capture_embed_prenom: string
  capture_embed_email: string
  capture_embed_reserver: string

  // Capture Popup preview
  capture_popup_title: string
  capture_popup_subtitle: string
  capture_popup_email: string
  capture_popup_cta: string

  // Lead Profile
  lead_name: string
  lead_id: string
  lead_tag_hot: string
  lead_tag_ready: string
  lead_contact_info: string
  lead_source_label: string
  lead_source_value: string
  lead_interaction_history: string
  lead_interaction_msg: string
  lead_interaction_msg_sub: string
  lead_interaction_call: string
  lead_interaction_call_sub: string
  lead_notes_title: string
  lead_notes_content: string
  lead_offer_title: string
  lead_offer_name: string

  // Features by Role
  roles_badge: string
  roles_title: string
  roles_subtitle: string

  // Role data
  role_owner: RoleTranslation
  role_closer: RoleTranslation
  role_setter: RoleTranslation
  role_setter_closer: RoleTranslation

  // Shared access notes
  shared_access_label: string
  shared_access_setter_closer: string
  shared_access_default: string

  // Admin & Head of Sales notes
  admin_label: string
  admin_description: string
  hos_label: string
  hos_description: string

  // After roles CTA
  roles_cta: string

  // Demo section
  demo_label: string
  demo_title: string
  demo_description: string
  demo_check_adapted: string
  demo_check_questions: string
  demo_check_free: string

  // Partners section
  partners_badge: string
  partners_title: string
  partners_subtitle: string
  partners_integrate_title: string
  partners_integrate_desc: string
  partners_integrate_items: string[]
  partners_integrate_cta: string
  partners_ambassador_title: string
  partners_ambassador_desc: string
  partners_ambassador_items: string[]
  partners_ambassador_cta: string

  // FAQ section
  faq_badge: string
  faq_title: string
  faq_subtitle: string
  faqs: FAQTranslation[]

  // Final CTA
  final_cta_title: string
  final_cta_subtitle: string
  final_cta_button: string

  // Founder
  founder_section_title: string
  founder_role: string
  founder_bio: string

  // Footer
  footer_copyright: string
  footer_mentions: string
  footer_cgu: string
  footer_cgv: string
  footer_confidentialite: string
  footer_politique: string
  footer_contact: string

  // Contact modal
  contact_title: string
  contact_name: string
  contact_name_placeholder: string
  contact_email: string
  contact_email_placeholder: string
  contact_subscriber: string
  contact_category: string
  contact_category_placeholder: string
  contact_category_bug: string
  contact_category_feature: string
  contact_category_partnership: string
  contact_category_help: string
  contact_category_billing: string
  contact_category_other: string
  contact_subject: string
  contact_subject_placeholder: string
  contact_message: string
  contact_message_placeholder: string
  contact_attachment: string
  contact_send: string
  contact_sending: string
  contact_success: string
  contact_error: string

  // Scroll to top
  scroll_top_label: string

  // Waiting list modal
  modal_success_title: string
  modal_success_description: string
  modal_whatsapp: string
  modal_google_form: string
  modal_linkedin: string
  modal_title: string
  modal_description: string
  modal_description_date: string
  modal_description_locked: string
  modal_email_label: string
  modal_email_placeholder: string
  modal_submit: string
  modal_loading: string
  modal_footer: string
  modal_error_already_registered: string
  modal_error_generic: string

  // SEO
  seo_title: string
  seo_description: string
  seo_og_title: string
  seo_og_description: string
  seo_default_title: string
  seo_default_description: string
  seo_default_og_title: string
  seo_default_og_description: string

  // Structured data
  sd_description: string
  sd_offer_description: string
  sd_feature_list: string
  sd_faq_who_q: string
  sd_faq_who_a: string
  sd_faq_compat_q: string
  sd_faq_compat_a: string
  sd_faq_why_crm_q: string
  sd_faq_why_crm_a: string
  sd_faq_data_access_q: string
  sd_faq_data_access_a: string
  sd_faq_what_q: string
  sd_faq_what_a: string
  sd_faq_how_many_q: string
  sd_faq_how_many_a: string
  sd_faq_gdpr_q: string
  sd_faq_gdpr_a: string
}

// ───────────────────────────────────────────────
// French translations
// ───────────────────────────────────────────────
const fr: Translations = {
  // Nav
  nav_integrations: 'Intégrations',
  nav_management: 'Management',
  nav_crm: 'CRM',
  nav_roles: 'Rôles',
  nav_demo: 'Démo',
  nav_pricing: 'Tarifs',
  nav_partners: 'Partenariat',
  nav_faq: 'FAQ',
  nav_waitlist: "Liste d'attente",

  // Hero badges
  hero_badge_rgpd: 'RGPD',
  hero_badge_closers: '+150 closers',
  hero_badge_closers_text: 'Déjà {count} qui valident CloseOS Sales',
  hero_badge_eco: 'Eco-responsable',

  // Hero
  hero_title: 'Gérez votre équipe de closers et pilotez votre acquisition.',
  hero_pain: "70% des infopreneurs perdent du CA parce qu'ils ne savent pas quoi améliorer.",
  hero_subtitle: "CRM, équipe, campagnes, KPIs — tout ce dont un infopreneur a besoin pour structurer son acquisition et scaler.",
  hero_cta: "Rejoindre la liste d'attente — Tarifs early adopters le 4 avril",
  hero_social_proof: 'Validé par {count} francophones',
  hero_social_proof_count: '+12 infopreneurs',

  // Integrations strip
  integrations_header: 'Integrations natives',
  integrations_subheader: 'Synchronisez vos outils · 12+ natives · 7 000+ via Zapier',

  // Dashboard / Management section
  management_badge: 'Centre de Commandement Manager',
  management_title: 'Pilotez et gérez votre écosystème de vente avec une autorité absolue',
  management_description: "Centralisez tout votre management dans un OS puissant. Du tableau de bord stratégique macro à la gestion de chaque closer et l'automatisation de leur formation, vous ne gérez plus, vous pilotez la croissance.",

  // Macro Dashboard
  dashboard_title: 'Tableau de Bord Macro',
  dashboard_description: 'Suivez vos KPIs stratégiques en temps réel pour prendre les meilleures décisions.',
  kpi_ca_reel: 'CA Réel Stripe',
  kpi_ca_closer: 'CA par Closer',
  kpi_taux_closing: 'Taux de Closing',
  kpi_taux_noshow: 'Taux de No-show',
  kpi_vs_last_month: 'vs mois dernier',

  // Team Management
  team_title: "Gestion de l'Équipe complète",
  team_description: "Créez des équipes dédiées (Closers, Setters, mixtes), assignez des rôles précis (Closer, Setter, Setter-Closer, Head of Sales, Admin) et suivez en temps réel qui est connecté. Gérez les disponibilités, absences, primes et commissions de chaque membre. Invitez par lien avec onboarding automatique adapté au rôle.",
  team_member_conv: 'Conv.',
  team_member_online: 'Online',

  // Shared Pipeline
  pipeline_title: 'Pipeline Partagé',
  pipeline_description: 'Un kanban visuel clair avec code couleur et drag-and-drop pour un suivi impeccable.',
  pipeline_rdv_fixe: 'RDV Fixé',

  // Revenue & Stripe
  revenue_stripe_connect: 'Stripe Connect',
  revenue_title: "Chiffre d'affaires en temps réel",
  revenue_description: "Connectez votre Stripe et suivez vos revenus réels — pas des estimations. Chaque paiement récurrent incrémente automatiquement le CA du closer qui a closé le deal.",
  revenue_item_mrr: "MRR, abonnements actifs et churn en un coup d'œil",
  revenue_item_matching: 'Matching auto prospects ↔ clients Stripe',
  revenue_item_charges: 'Charges, commissions et marge nette calculés',
  revenue_item_new_client: 'Nouveau client Stripe = fiche prospect auto créée',
  revenue_kpi_mrr: 'MRR',
  revenue_kpi_ca_mois: 'CA du mois',
  revenue_kpi_marge: 'Marge nette',
  revenue_kpi_abonnements: 'Abonnements',
  revenue_kpi_commissions: 'Commissions',
  revenue_kpi_churn: 'Churn',
  revenue_kpi_mrr_change: '+12% vs mois dernier',
  revenue_kpi_ca_mois_change: '+8% vs mois dernier',
  revenue_kpi_marge_pct: '73% du CA',
  revenue_kpi_abonnements_sub: 'actifs ce mois',
  revenue_kpi_commissions_sub: '3 closers',
  revenue_kpi_churn_change: '-0.5% vs dernier',

  // Onboarding
  onboarding_label: 'Autonomie Totale',
  onboarding_title: 'Onboarding des closers simplifié',
  onboarding_description: "Arrêtez de perdre du temps à former chaque nouveau closer manuellement. Notre système automatisé les guide de A à Z avec vos scripts, ressources et KPIs de suivi de progression.",
  onboarding_item_reporting: 'Monday Morning Reporting (Auto)',
  onboarding_item_exports: 'Exports hebdomadaires par email',
  onboarding_box_scripts_title: 'Scripts & Playbooks',
  onboarding_box_scripts_desc: 'Centralisez vos meilleures méthodes.',
  onboarding_box_videos_title: 'Vidéos de Formation',
  onboarding_box_videos_desc: 'Onboarding 100% autonome.',
  onboarding_box_progress_title: 'Suivi Progression',
  onboarding_box_progress_desc: 'Vérifiez les acquis avant le 1er call.',
  onboarding_box_exports_title: 'Exports Auto',
  onboarding_box_exports_desc: 'Data exportable en CSV/PDF.',

  // CRM Section
  crm_badge: "L'outil tout-en-un",
  crm_title: "CloseOS devient votre Système d'acquisition",
  crm_subtitle: "Un CRM conçu exclusivement pour le closing haute performance — avec synchronisation native vers vos outils existants.",

  // CRM Features
  crm_feature_pipeline_title: 'Pipeline CRM indépendant',
  crm_feature_pipeline_desc: "Double vue stratégique : vue individuelle pour chaque closer vs vue globale temps réel pour l'infopreneur.",
  crm_feature_relances_title: 'Relances automatiques',
  crm_feature_relances_reminder: 'RAPPELER DANS 3 JOURS',
  crm_feature_tags_title: 'Tags illimités & Filtres',
  crm_feature_tag_froid: 'Froid',
  crm_feature_tag_rappel: 'Rappel',
  crm_feature_tag_urgent: 'Urgent',
  crm_feature_csv_title: 'Import / Export CSV',
  crm_feature_csv_desc: "Importez vos prospects depuis n'importe quel CRM via CSV, ou exportez votre base en un clic. Un prompt IA intégré reformate automatiquement vos fichiers.",

  // Qualification Section
  qualification_badge: 'Auto-Qualification',
  qualification_title: 'Filtrez vos prospects avant m\u00eame de d\u00e9crocher',
  qualification_subtitle: 'Configurez un questionnaire intelligent sur vos pages de capture. Chaque r\u00e9ponse est scor\u00e9e automatiquement et les mauvais profils sont \u00e9limin\u00e9s avant d\u2019arriver dans votre pipeline.',
  qualification_check_1: 'Questionnaire configurable : texte, choix multiple, nombre',
  qualification_check_2: 'Scoring automatique de chaque r\u00e9ponse (0 \u00e0 100%)',
  qualification_check_3: 'Disqualification auto si trop de r\u00e9ponses \u00e9liminatoires',
  qualification_check_4: 'Tags syst\u00e8me \u00abIncomplet\u00bb et \u00ab\u00c9limin\u00e9\u00bb automatiques',
  qualification_check_5: 'Score de qualification visible sur chaque fiche prospect',
  qualification_mock_name: 'Sophie Martin',
  qualification_mock_role: 'Fondatrice \u2022 AgenceFlow',
  qualification_mock_q1: 'Budget mensuel pr\u00e9vu ?',
  qualification_mock_a1: '5 000\u20AC',
  qualification_mock_q2: 'Taille de votre \u00e9quipe ?',
  qualification_mock_a2: '2 personnes',
  qualification_mock_q3: 'Exp\u00e9rience en closing ?',
  qualification_mock_a3: 'Aucune',
  qualification_mock_q3_badge: '\u00c9liminatoire',
  qualification_mock_score: 'Score global',
  qualification_mock_eliminatory: 'R\u00e9ponses \u00e9liminatoires',

  // CRM KPIs
  crm_kpi_pipeline_title: 'KPI CRM \u2022 Pipeline',
  crm_kpi_pipeline_value: '452,000\u20AC',
  crm_kpi_pipeline_desc: 'Valeur totale du pipeline en cours',
  crm_kpi_performance_title: 'KPI CRM \u2022 Performance',
  crm_kpi_performance_value: '4,850\u20AC',
  crm_kpi_performance_desc: 'Deal moyen encaissé',
  crm_kpi_velocity_title: 'KPI CRM \u2022 Vélocité',
  crm_kpi_velocity_value: '12 Jours',
  crm_kpi_velocity_desc: 'Cycle de vente moyen (Lead to Close)',
  crm_book_demo: 'Réserver une démo',

  // Capture Section
  capture_badge: 'Capture de Leads',
  capture_title: 'Captez vos prospects automatiquement',
  capture_description: "Créez des pages de capture, intégrez un formulaire en embed ou lancez un popup directement sur votre site. Chaque lead est automatiquement injecté dans votre CRM avec le bon setter/closer assigné.",
  capture_item_custom: '100% personnalisable : couleur de fond, police, titre, sous-titre et description',
  capture_item_embed: "Embed iframe intégrable sur n'importe quel site",
  capture_item_popup: 'Popup déclenchable au clic ou en automatique',
  capture_item_video: 'Ajoutez une vidéo de présentation avec un lien de redirection',
  capture_item_precapture: 'Précapture : dès qu\'un email ou numéro est saisi, le prospect est enregistré — même sans avoir terminé le formulaire',
  capture_item_payment: 'Rendez-vous payants via Stripe : idéal pour le consulting, audits, coaching…',
  capture_tab_page: 'Page',
  capture_tab_embed: 'Embed',
  capture_tab_popup: 'Popup',

  // Capture Page preview
  capture_page_title: 'Réservez votre appel stratégique',
  capture_page_subtitle: 'Remplissez vos informations pour accéder au calendrier',
  capture_page_prenom: 'Votre prénom',
  capture_page_email: 'votre@email.com',
  capture_page_phone: '+33 6 00 00 00 00',
  capture_page_continue: 'Continuer',
  capture_page_calendar_blur: "D'abord remplir les informations",
  capture_calendar_days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],

  // Capture Embed preview
  capture_embed_title: 'Rejoignez le Mastermind',
  capture_embed_subtitle: 'Réservez votre appel découverte',
  capture_embed_prenom: 'Prénom',
  capture_embed_email: 'Email',
  capture_embed_reserver: 'Réserver',

  // Capture Popup preview
  capture_popup_title: 'Dernières places !',
  capture_popup_subtitle: 'Inscrivez-vous avant la clôture',
  capture_popup_email: 'votre@email.com',
  capture_popup_cta: "Je m'inscris",

  // Lead Profile
  lead_name: 'Jean-Philippe Morel',
  lead_id: 'ID: #89234 \u2022 Ajouté hier',
  lead_tag_hot: 'Chaud \uD83D\uDD25',
  lead_tag_ready: 'Ready to Buy',
  lead_contact_info: 'Infos Contact',
  lead_source_label: 'Source:',
  lead_source_value: 'Ads Instagram',
  lead_interaction_history: "Historique d'Interaction",
  lead_interaction_msg: '"Je suis intéressé par le programme Mastermind..."',
  lead_interaction_msg_sub: 'WhatsApp - 10:45',
  lead_interaction_call: 'Discovery Call complété (12 min)',
  lead_interaction_call_sub: 'Hier - 16:30',
  lead_notes_title: 'Notes & Objections',
  lead_notes_content: "- Frein principal : Disponibilité immédiate.\n- OK sur le prix (7,500\u20AC).\n- Proposer l'accès direct aux modules si paiement aujourd'hui.",
  lead_offer_title: 'Offre Présentée',
  lead_offer_name: 'Accompagnement VIP',

  // Features by Role
  roles_badge: 'Fonctionnalités par Rôle',
  roles_title: 'Chaque rôle a ses outils. Chaque outil a sa place.',
  roles_subtitle: "Owner, Closer, Setter ou Setter-Closer — chacun accède exactement à ce dont il a besoin, rien de plus.",

  // Role: Owner
  role_owner: {
    label: 'Owner / Admin',
    tagline: 'Contrôle total',
    description: "Pilotez l'intégralité de votre écosystème de vente. CRM, équipes, KPIs, campagnes — tout depuis un seul tableau de bord.",
    features: [
      {
        title: 'CRM & Pipeline Global',
        items: [
          'Vue Kanban drag-drop + Tableau de TOUS les prospects',
          'Assignation setter/closer : manuelle, tournante ou hasard',
          "Stages personnalisables à l'infini + sync HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed, CSV",
          'Filtres avancés : période, membre, statut, offre',
        ],
      },
      {
        title: 'Campagnes de Capture',
        items: [
          '2 modes : avec RDV ou inscription seule',
          'Page de capture personnalisable + embed iframe/popup',
          'Assignation configurable + tracking UTM',
          'Précapture : lead enregistré dès le 1er champ saisi',
          'Paiement Stripe intégré + remboursement par palier',
          'Analytics : vues, leads, taux de conversion, CA',
        ],
      },
      {
        title: 'Appels & Cockpit',
        items: [
          'Cockpit plein écran : script, notes, offre, fiche prospect',
          'Enregistrement appel (écran + micro)',
          'Post-appel : toutes les issues setter ET closer',
          'Google Meet intégré',
        ],
      },
      {
        title: 'KPI & Rapports',
        items: [
          '3 onglets : Organisation, Par Offre, Par Membre',
          '8 KPI globaux sur période sélectionnable',
          "Feed d'activité du jour + Export PDF",
          'Graphiques : stages, CA par campagne, commissions',
        ],
      },
      {
        title: "Chiffre d'affaires & Stripe",
        items: [
          'Connexion Stripe Connect : liez votre compte et suivez vos revenus réels',
          'Matching automatique prospects \u2194 abonnements Stripe (webhook, auto-match, manuel)',
          'CA récurrent : chaque paiement Stripe incrémente le CA du closer qui a closé le deal',
          'MRR, abonnements actifs, churn et marge nette en temps réel',
          'Gestion des charges fixes/variables et commissions pour calculer votre marge',
        ],
      },
      {
        title: '\u00C9quipe & Organisation',
        items: [
          'Créez des équipes dédiées et groupez closers/setters par spécialité',
          'Statut online temps réel + historique connexion 7j de chaque membre',
          'Disponibilités, absences, primes et commissions individuelles par membre',
          '5 rôles avec permissions : Closer, Setter, Setter-Closer, Head of Sales, Admin',
          'Invitation par lien unique + onboarding automatique adapté au rôle assigné',
          'Objectifs individuels et collectifs avec suivi de progression en temps réel',
        ],
      },
      {
        title: 'Agenda & RDV',
        items: [
          "Booker un RDV pour n'importe quel membre",
          'Booking links partageables + Google Meet',
          'Agenda de chaque membre ou tous combinés',
          'Sync Google Calendar bidirectionnelle',
        ],
      },
    ],
  },

  // Role: Closer
  role_closer: {
    label: 'Closer',
    tagline: 'Fermer des deals',
    description: "Votre espace optimisé pour closer. Pipeline personnel, cockpit d'appel, KPIs de performance et gestion autonome de vos prospects.",
    features: [
      {
        title: 'Pipeline Personnel',
        items: [
          'Vos prospects assignés uniquement',
          '2 sections : Flux Actif + Flux Inactif',
          'Drag-drop entre colonnes',
          'Création de prospect \u2192 auto-assignation closer',
        ],
      },
      {
        title: "Cockpit d'Appel",
        items: [
          'Script affiché + notes en direct + fiche prospect',
          'Post-appel : Gagné, Follow Up, Perdu, No Show',
          "Raison d'objection si Gagné",
          'Enregistrement + Google Meet',
        ],
      },
      {
        title: 'KPI Closer',
        items: [
          '3 onglets : Personnel, Organisation, Par Offre',
          'CA, ventes, taux closing, commission, no-show',
          'Graphiques et pipeline summary',
          'Objectifs personnels configurables',
        ],
      },
      {
        title: 'Factures',
        items: [
          "Générer une facture \u2192 envoyée à l'Owner",
          'KPI : CA généré, commission 10%, payé, en attente',
          'Détail comptant vs échelonné',
          'Lien Stripe + téléchargement PDF',
        ],
      },
    ],
  },

  // Role: Setter
  role_setter: {
    label: 'Setter',
    tagline: 'Qualifier & Booker',
    description: 'Focalisé sur la qualification et le booking. Qualifiez vos prospects, assignez les closers et gérez votre flow de prise de RDV.',
    features: [
      {
        title: 'CRM & Pipeline Setter',
        items: [
          'Création prospect \u2192 auto-assignation setter',
          'Pipeline personnel avec Flux Actif/Inactif',
          'Recherche, filtrage et actions rapides',
        ],
      },
      {
        title: 'Qualification Post-Appel',
        items: [
          '4 issues : Qualifié, Book Later, Non-qualifié, Pas de réponse',
          'Qualifié \u2192 assigner un closer + sélectionner un créneau',
          'Grille 14 jours, intervalles 30min, conflits exclus',
        ],
      },
      {
        title: 'KPI Setter',
        items: [
          'Taux de réponse, taux de booking, conversion',
          'Commission, no-show, perdus',
          '3 onglets : Personnel, Organisation, Par Offre',
        ],
      },
    ],
  },

  // Role: Setter-Closer
  role_setter_closer: {
    label: 'Setter-Closer',
    tagline: 'Le combo ultime',
    description: "Combinez les droits Setter ET Closer. Auto-assignation complète, accès aux 8 issues post-appel et aux deux pages KPI.",
    features: [
      {
        title: 'Double Rôle',
        items: [
          'Création prospect \u2192 auto-assignation setter ET closer',
          '8 issues post-appel (4 setter + 4 closer)',
          'Scope "self" : auto-assignation closer systématique',
          'Scope "all" : peut set pour d\'autres closers',
        ],
      },
      {
        title: 'Double KPI',
        items: [
          'Accès KPI Setter ET KPI Closer',
          'Graphiques et pipeline summary des deux côtés',
          'Objectifs personnels configurables',
        ],
      },
    ],
  },

  // Shared access notes
  shared_access_label: '+ Accès partagé :',
  shared_access_setter_closer: 'Pipeline personnel, RDV, Agenda, Rappels, Objectifs (les deux KPI), Formules (lecture), Factures, Disponibilités, Organisation, Équipe, Dashboard.',
  shared_access_default: 'Pipeline personnel, RDV, Agenda, Rappels, Objectifs, Formules (lecture), Factures, Disponibilités, Organisation (lecture), Équipe, Dashboard.',

  // Admin & Head of Sales notes
  admin_label: 'Admin',
  admin_description: "Exactement les mêmes droits que l'Owner. Accès complet à tout.",
  hos_label: 'Head of Sales',
  hos_description: "Mêmes droits que l'Owner sauf : Campagnes (si autorisé) et pas d'accès aux Paramètres.",

  // After roles CTA
  roles_cta: "Rejoindre la liste d'attente",

  // Demo section
  demo_label: 'Démo personnalisée',
  demo_title: 'Réservez une démo avec notre équipe',
  demo_description: "15 minutes pour découvrir comment CloseOS peut s'adapter à votre business. On vous montre l'outil, on répond à vos questions.",
  demo_check_adapted: 'Démo adaptée à votre structure',
  demo_check_questions: 'Réponses à toutes vos questions',
  demo_check_free: '100% gratuit',

  // Partners section
  partners_badge: 'Partenariat',
  partners_title: 'Devenez partenaire CloseOS',
  partners_subtitle: 'Deux façons de collaborer avec nous et de faire grandir votre business.',
  partners_integrate_title: 'Intégrateur',
  partners_integrate_desc: 'Intégrez CloseOS directement dans vos offres d\'accompagnement.',
  partners_integrate_items: [
    'Idéal pour les formateurs, coachs et agences',
    'Proposez CloseOS dans vos formations ou packs',
    'Offre personnalisée selon votre volume',
    'Support dédié pour vos clients',
  ],
  partners_integrate_cta: 'Devenir intégrateur',
  partners_ambassador_title: 'Ambassadeur',
  partners_ambassador_desc: 'Recommandez CloseOS et touchez des commissions sur chaque vente.',
  partners_ambassador_items: [
    'Commissions récurrentes par virement',
    'Lien de parrainage personnalisé',
    'Dashboard de suivi en temps réel',
    'Aucun engagement ni minimum requis',
  ],
  partners_ambassador_cta: 'Devenir ambassadeur',

  // FAQ section
  faq_badge: 'FAQs',
  faq_title: 'Questions fréquentes',
  faq_subtitle: "Tout ce que vous devez savoir avant de rejoindre la liste d'attente.",
  faqs: [
    {
      question: 'A qui est destiné cet outil ?',
      answer: "Il est destiné à toute personne qui vend en ligne : infopreneurs, Head of Sales, mais aussi les solopreneurs et ceux qui lancent des Challenges. Quand on parle d'équipe, on ne parle pas forcément d'une grosse structure — même un closer seul ou un duo setter/closer peut tirer parti de l'outil.",
    },
    {
      question: 'CloseOS Business est-il compatible avec mes outils CRM actuels ?',
      answer: "Oui. En plus de notre propre CRM intégré, CloseOS Business se connecte nativement à 6 plateformes : HubSpot (synchronisation complète bidirectionnelle), Pipedrive (synchronisation complète bidirectionnelle), GoHighLevel GHL (synchronisation complète bidirectionnelle), Airtable (synchronisation complète bidirectionnelle), Systeme.io (import de contacts via webhook), iClosed (synchronisation unidirectionnelle via webhook), CSV (importez/exportez vos prospects depuis n'importe quel outil). Un prompt IA intégré permet de reformater automatiquement n'importe quel fichier CSV pour le rendre compatible avec CloseOS. Cela dit, nous recommandons d'utiliser le CRM intégré CloseOS Business : c'est lui qui offre les meilleures performances et la gestion la plus simple dans cet écosystème. Tout est conçu pour fonctionner ensemble, sans friction.",
    },
    {
      question: "Pourquoi utiliser le CRM CloseOS si j'ai déjà HubSpot ou Pipedrive ?",
      answer: "CloseOS ne remplace pas forcément votre CRM actuel — il s'y connecte. Vous pouvez garder HubSpot, Pipedrive, GoHighLevel ou Airtable comme source de vérité marketing, et utiliser CloseOS comme cockpit de closing optimisé pour votre équipe. La synchronisation bidirectionnelle signifie que chaque prospect ajouté ou mis à jour d'un côté est reflété de l'autre. Vos closers travaillent dans CloseOS (pipeline, appels, KPIs), et vos données marketing restent à jour dans votre stack existante. Pour les équipes qui veulent tout centraliser, le CRM natif CloseOS offre les meilleures performances : assignation automatique setter/closer, capture de leads, tracking de campagnes et analytics intégrés sans aucune config externe.",
    },
    {
      question: 'Mes données sont-elles sécurisées et conformes au RGPD ?',
      answer: "Oui. CloseOS Business est 100% conforme au RGPD. Toutes les données sont hébergées de manière sécurisée, isolées par organisation, et aucun tiers n'y a accès. Vous restez propriétaire de vos données à tout moment.",
    },
    {
      question: 'Mes closers ont-ils accès à toutes les données ?',
      answer: "Non. Vous définissez vous-même les niveaux d'accès. Chaque closer voit uniquement ses prospects, ses KPIs et son pipeline. Les données sensibles (CA global, marges, contacts stratégiques) restent visibles par vous seul.",
    },
    {
      question: 'Combien de closers puis-je ajouter ?',
      answer: "Autant que vous voulez. CloseOS Business n'impose aucune limite sur la taille de votre équipe.",
    },
    {
      question: 'Est-ce difficile à prendre en main pour mes closers ?',
      answer: "Non. L'onboarding est 100% autonome — vos closers sont guidés dès leur première connexion avec vos scripts, ressources et KPIs de progression. Vous n'avez rien à expliquer manuellement.",
    },
    {
      question: 'Est-ce que CloseOS Business sera parfaitement adapté à mon business ?',
      answer: "C'est justement l'objectif. CloseOS Business se construit avec les infopreneurs inscrits sur la liste d'attente. Vos retours, vos besoins et vos cas d'usage concrets façonnent directement l'outil. Vous ne découvrez pas un produit fini — vous participez à créer le meilleur outil de closing du marché.",
    },
  ],

  // Final CTA
  final_cta_title: 'Prêt à scaler votre écosystème de closing ?',
  final_cta_subtitle: 'Inscrivez-vous maintenant et débloquez un tarif early adopter imbattable, dévoilé le 4 avril.',
  final_cta_button: "Rejoindre la liste d'attente — Tarifs le 4 avril",

  // Founder
  founder_section_title: 'Le fondateur',
  founder_role: 'Fondateur de CloseOS',
  founder_bio: "Avant de créer l'écosystème CloseOS, Thomas était closer et setter. C'est en étant sur le terrain qu'il a vu et subi la réalité du métier au quotidien : travailler avec minimum 2 écrans, jongler entre des dizaines d'outils qui ne communiquent même pas entre eux, et perdre 1h à 1h30 chaque jour juste pour tout mettre à jour. Un CRM d'un côté, un outil de booking de l'autre, la facturation sur un troisième, les KPIs sur un tableur — le tout sans aucune synchronisation. CloseOS est né de cette frustration : un seul outil qui remplace tous les autres, conçu par un closer pour les closers.",

  // Footer
  footer_copyright: '\u00A9 2026 CloseOS',
  footer_mentions: 'Mentions légales',
  footer_cgu: 'CGU',
  footer_cgv: 'CGV',
  footer_confidentialite: 'Confidentialité',
  footer_politique: "Politique d'utilisation",
  footer_contact: 'support@closeos.fr',

  // Contact modal
  contact_title: 'Contactez-nous',
  contact_name: 'Nom & Prénom',
  contact_name_placeholder: 'Jean Dupont',
  contact_email: 'Votre email',
  contact_email_placeholder: 'jean@exemple.com',
  contact_subscriber: 'Je suis abonné à CloseOS',
  contact_category: 'Sujet',
  contact_category_placeholder: 'Sélectionnez un sujet',
  contact_category_bug: 'Bug',
  contact_category_feature: 'Idée de rajouts',
  contact_category_partnership: 'Partenariat / Collaboration',
  contact_category_help: 'Aide / Support',
  contact_category_billing: 'Facturation / Abonnement',
  contact_category_other: 'Autre',
  contact_subject: 'Objet',
  contact_subject_placeholder: "L'objet de votre message",
  contact_message: 'Message',
  contact_message_placeholder: 'Écrivez votre message ici...',
  contact_attachment: 'Ajouter une pièce jointe',
  contact_send: 'Envoyer',
  contact_sending: 'Envoi en cours...',
  contact_success: 'Votre message a bien été envoyé !',
  contact_error: "Une erreur est survenue. Veuillez réessayer.",

  // Scroll to top
  scroll_top_label: 'Retour en haut',

  // Waiting list modal
  modal_success_title: "C'est noté ! \uD83D\uDE80",
  modal_success_description: "Merci de votre intérêt. Regardez cette vidéo en attendant l'ouverture !",
  modal_whatsapp: 'Canal WhatsApp',
  modal_google_form: 'Vos besoins (Google Form)',
  modal_linkedin: 'Suivre sur LinkedIn',
  modal_title: "Rejoindre la liste d'attente",
  modal_description: "Inscrivez-vous et recevez le {date} un tarif early adopter concurrentiel et imbattable, réservé uniquement aux inscrits — {locked}.",
  modal_description_date: '4 avril',
  modal_description_locked: 'verrouillé à vie',
  modal_email_label: 'Votre Email Professionnel',
  modal_email_placeholder: 'votre@email.com',
  modal_submit: "M'inscrire maintenant",
  modal_loading: 'Inscription...',
  modal_footer: 'Accès prioritaire \u2022 Sans engagement',
  modal_error_already_registered: 'Vous êtes déjà inscrit avec ce mail',
  modal_error_generic: 'Une erreur est survenue. Veuillez rééssayer.',

  // SEO
  seo_title: 'CloseOS Business — Pilotez votre équipe de vente',
  seo_description: "Plateforme de management pour infopreneurs : gérez vos closers, setters, KPIs et campagnes d'acquisition. Essai gratuit 20 jours.",
  seo_og_title: 'CloseOS Business — Plateforme de management pour infopreneurs et Head of Sales',
  seo_og_description: "Gérez votre équipe de closers, pilotez vos campagnes d'acquisition et suivez les KPIs de votre équipe. Logiciel infopreneur closing francophone.",
  seo_default_title: 'CloseOS — Écosystème SaaS pour la vente digitale | CRM Closer & Management Infopreneur',
  seo_default_description: "CloseOS est l'écosystème SaaS francophone pour la vente digitale. Outil pour closer : CRM, pipeline, VoIP, KPIs, facturation automatique. Logiciel infopreneur : gestion équipe de closers, campagnes d'acquisition, analytics. Alternative iClosed.",
  seo_default_og_title: 'CloseOS — Écosystème SaaS pour la vente digitale francophone',
  seo_default_og_description: "Outil tout-en-un pour closers (CRM, pipeline, VoIP, KPIs) et infopreneurs (management d'équipe, campagnes, analytics). Alternative iClosed.",

  // Structured data
  sd_description: "Plateforme de management pour infopreneurs et Head of Sales. Gestion d'équipe de closers et setters, pilotage campagnes d'acquisition, CRM acquisition, tableau de bord infopreneur. Alternative à iClosed, 100% en français.",
  sd_offer_description: "Liste d'attente — tarifs early adopters",
  sd_feature_list: "Gérer équipe de closers, Pilotage équipe closing, Logiciel infopreneur closing, CRM acquisition infopreneur, Outil gestion setter closer, Piloter campagne acquisition closing, Tableau de bord infopreneur, KPIs d'équipe, Onboarding closers automatisé",
  sd_faq_who_q: 'A qui est destiné CloseOS Business ?',
  sd_faq_who_a: "CloseOS Business est destiné à toute personne qui vend en ligne : infopreneurs, Head of Sales, solopreneurs et ceux qui lancent des Challenges. Même un closer seul ou un duo setter/closer peut tirer parti de l'outil de management.",
  sd_faq_compat_q: 'CloseOS Business est-il compatible avec mes outils CRM actuels ?',
  sd_faq_compat_a: "Oui. CloseOS Business se connecte nativement à 6 plateformes : HubSpot (bidirectionnel), Pipedrive (bidirectionnel), GoHighLevel GHL (bidirectionnel), Airtable (bidirectionnel), Systeme.io (webhook) et iClosed (unidirectionnel via webhook). Vous pouvez aussi importer/exporter vos prospects en CSV depuis n'importe quel outil. Le CRM intégré CloseOS Business offre les meilleures performances pour l'écosystème.",
  sd_faq_why_crm_q: "Pourquoi utiliser le CRM CloseOS si j'ai déjà HubSpot ou Pipedrive ?",
  sd_faq_why_crm_a: "CloseOS ne remplace pas forcément votre CRM — il s'y connecte. Gardez HubSpot, Pipedrive, GoHighLevel ou Airtable comme source marketing, et utilisez CloseOS comme cockpit de closing optimisé. La synchronisation bidirectionnelle assure que chaque prospect est à jour des deux côtés. Le CRM natif CloseOS offre l'assignation automatique setter/closer, capture de leads, tracking campagnes et analytics intégrés.",
  sd_faq_data_access_q: 'Mes closers ont-ils accès à toutes les données ?',
  sd_faq_data_access_a: "Non. Vous définissez les niveaux d'accès. Chaque closer voit uniquement ses prospects, ses KPIs et son pipeline. Les données sensibles (CA global, marges, contacts stratégiques) restent visibles par vous seul.",
  sd_faq_what_q: "Qu'est-ce que CloseOS Business ?",
  sd_faq_what_a: "CloseOS Business est la plateforme de management pour infopreneurs et Head of Sales francophones. Elle permet de gérer une équipe de closers et setters, piloter les campagnes d'acquisition, suivre les KPIs d'équipe et automatiser l'onboarding des closers. C'est l'alternative française à iClosed, conçue pour le pilotage d'équipe closing.",
  sd_faq_how_many_q: 'Combien de closers puis-je ajouter dans CloseOS Business ?',
  sd_faq_how_many_a: "Autant que vous voulez. CloseOS Business n'impose aucune limite sur la taille de votre équipe de closers et setters.",
  sd_faq_gdpr_q: 'Les données sont-elles sécurisées et conformes au RGPD ?',
  sd_faq_gdpr_a: "Oui. CloseOS Business est 100% conforme au RGPD. Toutes les données sont hébergées de manière sécurisée, isolées par organisation, et aucun tiers n'y a accès. Vous restez propriétaire de vos données à tout moment.",
}

// ───────────────────────────────────────────────
// English translations
// ───────────────────────────────────────────────
const en: Translations = {
  // Nav
  nav_integrations: 'Integrations',
  nav_management: 'Management',
  nav_crm: 'CRM',
  nav_roles: 'Roles',
  nav_demo: 'Demo',
  nav_pricing: 'Pricing',
  nav_partners: 'Partners',
  nav_faq: 'FAQ',
  nav_waitlist: 'Waitlist',

  // Hero badges
  hero_badge_rgpd: 'GDPR',
  hero_badge_closers: '+150 closers',
  hero_badge_closers_text: 'Already {count} validating CloseOS Sales',
  hero_badge_eco: 'Eco-friendly',

  // Hero
  hero_title: 'Manage your sales team and drive your acquisition.',
  hero_pain: "70% of entrepreneurs lose revenue because they don't know what to improve.",
  hero_subtitle: 'CRM, team, campaigns, KPIs \u2014 everything an entrepreneur needs to structure acquisition and scale.',
  hero_cta: 'Join the waitlist \u2014 Early adopter pricing on April 4th',
  hero_social_proof: 'Validated by {count}',
  hero_social_proof_count: '+12 French-speaking entrepreneurs',

  // Integrations strip
  integrations_header: 'Native integrations',
  integrations_subheader: 'Sync your tools \u00B7 12+ native \u00B7 7,000+ via Zapier',

  // Dashboard / Management section
  management_badge: 'Manager Command Center',
  management_title: 'Drive and manage your sales ecosystem with absolute authority',
  management_description: 'Centralize all your management in a powerful OS. From the macro strategic dashboard to managing each closer and automating their training, you no longer manage \u2014 you drive growth.',

  // Macro Dashboard
  dashboard_title: 'Macro Dashboard',
  dashboard_description: 'Track your strategic KPIs in real time to make the best decisions.',
  kpi_ca_reel: 'Actual Stripe Revenue',
  kpi_ca_closer: 'Revenue per Closer',
  kpi_taux_closing: 'Closing Rate',
  kpi_taux_noshow: 'No-show Rate',
  kpi_vs_last_month: 'vs last month',

  // Team Management
  team_title: 'Complete Team Management',
  team_description: 'Create dedicated teams (Closers, Setters, mixed), assign precise roles (Closer, Setter, Setter-Closer, Head of Sales, Admin) and track in real time who is connected. Manage availability, absences, bonuses and commissions for each member. Invite by link with automatic role-based onboarding.',
  team_member_conv: 'Conv.',
  team_member_online: 'Online',

  // Shared Pipeline
  pipeline_title: 'Shared Pipeline',
  pipeline_description: 'A clear visual kanban with color coding and drag-and-drop for flawless tracking.',
  pipeline_rdv_fixe: 'Booked',

  // Revenue & Stripe
  revenue_stripe_connect: 'Stripe Connect',
  revenue_title: 'Real-time revenue',
  revenue_description: 'Connect your Stripe and track real revenue \u2014 not estimates. Each recurring payment automatically increments the closer\'s revenue who closed the deal.',
  revenue_item_mrr: 'MRR, active subscriptions and churn at a glance',
  revenue_item_matching: 'Auto matching prospects \u2194 Stripe customers',
  revenue_item_charges: 'Charges, commissions and net margin calculated',
  revenue_item_new_client: 'New Stripe customer = auto-created prospect record',
  revenue_kpi_mrr: 'MRR',
  revenue_kpi_ca_mois: 'Monthly Revenue',
  revenue_kpi_marge: 'Net Margin',
  revenue_kpi_abonnements: 'Subscriptions',
  revenue_kpi_commissions: 'Commissions',
  revenue_kpi_churn: 'Churn',
  revenue_kpi_mrr_change: '+12% vs last month',
  revenue_kpi_ca_mois_change: '+8% vs last month',
  revenue_kpi_marge_pct: '73% of revenue',
  revenue_kpi_abonnements_sub: 'active this month',
  revenue_kpi_commissions_sub: '3 closers',
  revenue_kpi_churn_change: '-0.5% vs last',

  // Onboarding
  onboarding_label: 'Full Autonomy',
  onboarding_title: 'Simplified closer onboarding',
  onboarding_description: 'Stop wasting time training each new closer manually. Our automated system guides them from A to Z with your scripts, resources and progression KPIs.',
  onboarding_item_reporting: 'Monday Morning Reporting (Auto)',
  onboarding_item_exports: 'Weekly exports by email',
  onboarding_box_scripts_title: 'Scripts & Playbooks',
  onboarding_box_scripts_desc: 'Centralize your best methods.',
  onboarding_box_videos_title: 'Training Videos',
  onboarding_box_videos_desc: '100% autonomous onboarding.',
  onboarding_box_progress_title: 'Progress Tracking',
  onboarding_box_progress_desc: 'Verify skills before the 1st call.',
  onboarding_box_exports_title: 'Auto Exports',
  onboarding_box_exports_desc: 'Data exportable as CSV/PDF.',

  // CRM Section
  crm_badge: 'The all-in-one tool',
  crm_title: 'CloseOS becomes your Acquisition System',
  crm_subtitle: 'A CRM built exclusively for high-performance closing \u2014 with native sync to your existing tools.',

  // CRM Features
  crm_feature_pipeline_title: 'Independent CRM Pipeline',
  crm_feature_pipeline_desc: 'Dual strategic view: individual view for each closer vs real-time global view for the entrepreneur.',
  crm_feature_relances_title: 'Automatic follow-ups',
  crm_feature_relances_reminder: 'REMIND IN 3 DAYS',
  crm_feature_tags_title: 'Unlimited Tags & Filters',
  crm_feature_tag_froid: 'Cold',
  crm_feature_tag_rappel: 'Callback',
  crm_feature_tag_urgent: 'Urgent',
  crm_feature_csv_title: 'Import / Export CSV',
  crm_feature_csv_desc: 'Import your prospects from any CRM via CSV, or export your database in one click. A built-in AI prompt automatically reformats your files.',

  // Qualification Section
  qualification_badge: 'Smart Qualification',
  qualification_title: 'Filter your prospects before you even pick up the phone',
  qualification_subtitle: 'Set up a smart questionnaire on your capture pages. Each answer is scored automatically and bad-fit leads are eliminated before reaching your pipeline.',
  qualification_check_1: 'Configurable questionnaire: text, multiple choice, number',
  qualification_check_2: 'Automatic scoring for each answer (0 to 100%)',
  qualification_check_3: 'Auto-disqualification when too many eliminatory answers',
  qualification_check_4: 'Automatic system tags \u00abIncomplete\u00bb and \u00abEliminated\u00bb',
  qualification_check_5: 'Qualification score visible on every prospect card',
  qualification_mock_name: 'Sophie Martin',
  qualification_mock_role: 'Founder \u2022 AgenceFlow',
  qualification_mock_q1: 'Planned monthly budget?',
  qualification_mock_a1: '\u20AC5,000',
  qualification_mock_q2: 'Team size?',
  qualification_mock_a2: '2 people',
  qualification_mock_q3: 'Closing experience?',
  qualification_mock_a3: 'None',
  qualification_mock_q3_badge: 'Eliminatory',
  qualification_mock_score: 'Overall score',
  qualification_mock_eliminatory: 'Eliminatory answers',

  // CRM KPIs
  crm_kpi_pipeline_title: 'CRM KPI \u2022 Pipeline',
  crm_kpi_pipeline_value: '\u20AC452,000',
  crm_kpi_pipeline_desc: 'Total value of current pipeline',
  crm_kpi_performance_title: 'CRM KPI \u2022 Performance',
  crm_kpi_performance_value: '\u20AC4,850',
  crm_kpi_performance_desc: 'Average deal collected',
  crm_kpi_velocity_title: 'CRM KPI \u2022 Velocity',
  crm_kpi_velocity_value: '12 Days',
  crm_kpi_velocity_desc: 'Average sales cycle (Lead to Close)',
  crm_book_demo: 'Book a demo',

  // Capture Section
  capture_badge: 'Lead Capture',
  capture_title: 'Capture your prospects automatically',
  capture_description: 'Create capture pages, embed a form or launch a popup directly on your site. Each lead is automatically injected into your CRM with the right setter/closer assigned.',
  capture_item_custom: '100% customizable: background color, font, title, subtitle and description',
  capture_item_embed: 'Embed iframe integrable on any site',
  capture_item_popup: 'Popup triggerable on click or automatically',
  capture_item_video: 'Add a presentation video with a redirect link',
  capture_item_precapture: 'Pre-capture: as soon as an email or phone number is entered, the prospect is saved — even if they don\'t complete the form',
  capture_item_payment: 'Paid appointments via Stripe: ideal for consultations, audits, coaching…',
  capture_tab_page: 'Page',
  capture_tab_embed: 'Embed',
  capture_tab_popup: 'Popup',

  // Capture Page preview
  capture_page_title: 'Book your strategy call',
  capture_page_subtitle: 'Fill in your information to access the calendar',
  capture_page_prenom: 'Your first name',
  capture_page_email: 'your@email.com',
  capture_page_phone: '+1 555 000 0000',
  capture_page_continue: 'Continue',
  capture_page_calendar_blur: 'Fill in your information first',
  capture_calendar_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],

  // Capture Embed preview
  capture_embed_title: 'Join the Mastermind',
  capture_embed_subtitle: 'Book your discovery call',
  capture_embed_prenom: 'First name',
  capture_embed_email: 'Email',
  capture_embed_reserver: 'Book',

  // Capture Popup preview
  capture_popup_title: 'Last spots!',
  capture_popup_subtitle: 'Sign up before it closes',
  capture_popup_email: 'your@email.com',
  capture_popup_cta: 'Sign me up',

  // Lead Profile
  lead_name: 'Jean-Philippe Morel',
  lead_id: 'ID: #89234 \u2022 Added yesterday',
  lead_tag_hot: 'Hot \uD83D\uDD25',
  lead_tag_ready: 'Ready to Buy',
  lead_contact_info: 'Contact Info',
  lead_source_label: 'Source:',
  lead_source_value: 'Instagram Ads',
  lead_interaction_history: 'Interaction History',
  lead_interaction_msg: '"I\'m interested in the Mastermind program..."',
  lead_interaction_msg_sub: 'WhatsApp - 10:45',
  lead_interaction_call: 'Discovery Call completed (12 min)',
  lead_interaction_call_sub: 'Yesterday - 16:30',
  lead_notes_title: 'Notes & Objections',
  lead_notes_content: '- Main blocker: Immediate availability.\n- OK on price (\u20AC7,500).\n- Offer direct access to modules if payment today.',
  lead_offer_title: 'Presented Offer',
  lead_offer_name: 'VIP Coaching',

  // Features by Role
  roles_badge: 'Features by Role',
  roles_title: 'Each role has its tools. Each tool has its place.',
  roles_subtitle: 'Owner, Closer, Setter or Setter-Closer \u2014 each accesses exactly what they need, nothing more.',

  // Role: Owner
  role_owner: {
    label: 'Owner / Admin',
    tagline: 'Full control',
    description: 'Drive your entire sales ecosystem. CRM, teams, KPIs, campaigns \u2014 all from a single dashboard.',
    features: [
      {
        title: 'CRM & Global Pipeline',
        items: [
          'Kanban drag-drop view + Table of ALL prospects',
          'Setter/closer assignment: manual, round-robin or random',
          'Infinitely customizable stages + sync HubSpot, Pipedrive, GoHighLevel, Airtable, Systeme.io, iClosed, CSV',
          'Advanced filters: period, member, status, offer',
        ],
      },
      {
        title: 'Capture Campaigns',
        items: [
          '2 modes: with appointment or registration only',
          'Customizable capture page + embed iframe/popup',
          'Configurable assignment + UTM tracking',
          'Pre-capture: lead saved from the 1st field entered',
          'Integrated Stripe payment + tiered refunds',
          'Analytics: views, leads, conversion rate, revenue',
        ],
      },
      {
        title: 'Calls & Cockpit',
        items: [
          'Full-screen cockpit: script, notes, offer, prospect card',
          'Call recording (screen + microphone)',
          'Post-call: all setter AND closer outcomes',
          'Integrated Google Meet',
        ],
      },
      {
        title: 'KPI & Reports',
        items: [
          '3 tabs: Organization, By Offer, By Member',
          '8 global KPIs over selectable period',
          'Daily activity feed + PDF Export',
          'Charts: stages, revenue per campaign, commissions',
        ],
      },
      {
        title: 'Revenue & Stripe',
        items: [
          'Stripe Connect: link your account and track your real revenue',
          'Automatic matching prospects \u2194 Stripe subscriptions (webhook, auto-match, manual)',
          'Recurring revenue: each Stripe payment increments the closer\'s revenue who closed the deal',
          'MRR, active subscriptions, churn and net margin in real time',
          'Fixed/variable charges and commissions management to calculate your margin',
        ],
      },
      {
        title: 'Team & Organization',
        items: [
          'Create dedicated teams and group closers/setters by specialty',
          'Real-time online status + 7-day connection history for each member',
          'Availability, absences, bonuses and individual commissions per member',
          '5 roles with permissions: Closer, Setter, Setter-Closer, Head of Sales, Admin',
          'Unique link invitation + automatic role-based onboarding',
          'Individual and collective goals with real-time progress tracking',
        ],
      },
      {
        title: 'Calendar & Appointments',
        items: [
          'Book an appointment for any member',
          'Shareable booking links + Google Meet',
          'Each member\'s calendar or all combined',
          'Bidirectional Google Calendar sync',
        ],
      },
    ],
  },

  // Role: Closer
  role_closer: {
    label: 'Closer',
    tagline: 'Close deals',
    description: 'Your optimized space for closing. Personal pipeline, call cockpit, performance KPIs and autonomous prospect management.',
    features: [
      {
        title: 'Personal Pipeline',
        items: [
          'Your assigned prospects only',
          '2 sections: Active Flow + Inactive Flow',
          'Drag-drop between columns',
          'Prospect creation \u2192 auto closer assignment',
        ],
      },
      {
        title: 'Call Cockpit',
        items: [
          'Displayed script + live notes + prospect card',
          'Post-call: Won, Follow Up, Lost, No Show',
          'Objection reason if Won',
          'Recording + Google Meet',
        ],
      },
      {
        title: 'Closer KPI',
        items: [
          '3 tabs: Personal, Organization, By Offer',
          'Revenue, sales, closing rate, commission, no-show',
          'Charts and pipeline summary',
          'Configurable personal goals',
        ],
      },
      {
        title: 'Invoices',
        items: [
          'Generate an invoice \u2192 sent to the Owner',
          'KPI: generated revenue, 10% commission, paid, pending',
          'Cash vs installment detail',
          'Stripe link + PDF download',
        ],
      },
    ],
  },

  // Role: Setter
  role_setter: {
    label: 'Setter',
    tagline: 'Qualify & Book',
    description: 'Focused on qualification and booking. Qualify your prospects, assign closers and manage your appointment booking flow.',
    features: [
      {
        title: 'CRM & Setter Pipeline',
        items: [
          'Prospect creation \u2192 auto setter assignment',
          'Personal pipeline with Active/Inactive Flow',
          'Search, filtering and quick actions',
        ],
      },
      {
        title: 'Post-Call Qualification',
        items: [
          '4 outcomes: Qualified, Book Later, Not Qualified, No Answer',
          'Qualified \u2192 assign a closer + select a time slot',
          '14-day grid, 30min intervals, conflicts excluded',
        ],
      },
      {
        title: 'Setter KPI',
        items: [
          'Response rate, booking rate, conversion',
          'Commission, no-show, lost',
          '3 tabs: Personal, Organization, By Offer',
        ],
      },
    ],
  },

  // Role: Setter-Closer
  role_setter_closer: {
    label: 'Setter-Closer',
    tagline: 'The ultimate combo',
    description: 'Combine Setter AND Closer rights. Full auto-assignment, access to all 8 post-call outcomes and both KPI pages.',
    features: [
      {
        title: 'Dual Role',
        items: [
          'Prospect creation \u2192 auto setter AND closer assignment',
          '8 post-call outcomes (4 setter + 4 closer)',
          'Scope "self": systematic closer auto-assignment',
          'Scope "all": can set for other closers',
        ],
      },
      {
        title: 'Dual KPI',
        items: [
          'Access to Setter KPI AND Closer KPI',
          'Charts and pipeline summary from both sides',
          'Configurable personal goals',
        ],
      },
    ],
  },

  // Shared access notes
  shared_access_label: '+ Shared access:',
  shared_access_setter_closer: 'Personal pipeline, Appointments, Calendar, Reminders, Goals (both KPIs), Formulas (read), Invoices, Availability, Organization, Team, Dashboard.',
  shared_access_default: 'Personal pipeline, Appointments, Calendar, Reminders, Goals, Formulas (read), Invoices, Availability, Organization (read), Team, Dashboard.',

  // Admin & Head of Sales notes
  admin_label: 'Admin',
  admin_description: 'Exactly the same rights as the Owner. Full access to everything.',
  hos_label: 'Head of Sales',
  hos_description: 'Same rights as the Owner except: Campaigns (if authorized) and no access to Settings.',

  // After roles CTA
  roles_cta: 'Join the waitlist',

  // Demo section
  demo_label: 'Personalized demo',
  demo_title: 'Book a demo with our team',
  demo_description: "15 minutes to discover how CloseOS can adapt to your business. We show you the tool, we answer your questions.",
  demo_check_adapted: 'Demo adapted to your structure',
  demo_check_questions: 'Answers to all your questions',
  demo_check_free: '100% free',

  // Partners section
  partners_badge: 'Partnership',
  partners_title: 'Become a CloseOS partner',
  partners_subtitle: 'Two ways to collaborate with us and grow your business.',
  partners_integrate_title: 'Integrator',
  partners_integrate_desc: 'Integrate CloseOS directly into your coaching or training offers.',
  partners_integrate_items: [
    'Ideal for trainers, coaches and agencies',
    'Include CloseOS in your courses or packages',
    'Custom offer based on your volume',
    'Dedicated support for your clients',
  ],
  partners_integrate_cta: 'Become an integrator',
  partners_ambassador_title: 'Ambassador',
  partners_ambassador_desc: 'Recommend CloseOS and earn commissions on every sale.',
  partners_ambassador_items: [
    'Recurring commissions paid by bank transfer',
    'Personalized referral link',
    'Real-time tracking dashboard',
    'No commitment or minimum required',
  ],
  partners_ambassador_cta: 'Become an ambassador',

  // FAQ section
  faq_badge: 'FAQs',
  faq_title: 'Frequently asked questions',
  faq_subtitle: 'Everything you need to know before joining the waitlist.',
  faqs: [
    {
      question: 'Who is this tool for?',
      answer: "It's designed for anyone selling online: entrepreneurs, Heads of Sales, as well as solopreneurs and those running Challenges. When we say 'team', we don't necessarily mean a large organization \u2014 even a solo closer or a setter/closer duo can benefit from the tool.",
    },
    {
      question: 'Is CloseOS Business compatible with my current CRM tools?',
      answer: 'Yes. In addition to our own built-in CRM, CloseOS Business natively connects to 6 platforms: HubSpot (full bidirectional sync), Pipedrive (full bidirectional sync), GoHighLevel GHL (full bidirectional sync), Airtable (full bidirectional sync), Systeme.io (contact import via webhook), iClosed (unidirectional sync via webhook), CSV (import/export your prospects from any tool). A built-in AI prompt automatically reformats any CSV file to make it CloseOS-compatible. That said, we recommend using the built-in CloseOS Business CRM: it offers the best performance and simplest management in this ecosystem. Everything is designed to work together, without friction.',
    },
    {
      question: 'Why use the CloseOS CRM if I already have HubSpot or Pipedrive?',
      answer: "CloseOS doesn't necessarily replace your current CRM \u2014 it connects to it. You can keep HubSpot, Pipedrive, GoHighLevel or Airtable as your marketing source of truth, and use CloseOS as an optimized closing cockpit for your team. Bidirectional sync means every prospect added or updated on one side is reflected on the other. Your closers work in CloseOS (pipeline, calls, KPIs), and your marketing data stays current in your existing stack. For teams who want to centralize everything, the native CloseOS CRM offers the best performance: automatic setter/closer assignment, lead capture, campaign tracking and built-in analytics with zero external config.",
    },
    {
      question: 'Is my data secure and GDPR-compliant?',
      answer: 'Yes. CloseOS Business is 100% GDPR-compliant. All data is securely hosted, isolated by organization, and no third party has access. You remain the owner of your data at all times.',
    },
    {
      question: 'Do my closers have access to all the data?',
      answer: "No. You define the access levels yourself. Each closer only sees their own prospects, their KPIs and their pipeline. Sensitive data (total revenue, margins, strategic contacts) remains visible only to you.",
    },
    {
      question: 'How many closers can I add?',
      answer: 'As many as you want. CloseOS Business imposes no limit on your team size.',
    },
    {
      question: 'Is it difficult for my closers to get started?',
      answer: "No. Onboarding is 100% autonomous \u2014 your closers are guided from their first login with your scripts, resources and progression KPIs. You don't have to explain anything manually.",
    },
    {
      question: 'Will CloseOS Business be perfectly adapted to my business?',
      answer: "That's precisely the goal. CloseOS Business is being built with the entrepreneurs signed up on the waitlist. Your feedback, needs and real use cases directly shape the tool. You're not discovering a finished product \u2014 you're participating in creating the best closing tool on the market.",
    },
  ],

  // Final CTA
  final_cta_title: 'Ready to scale your closing ecosystem?',
  final_cta_subtitle: 'Sign up now and unlock an unbeatable early adopter price, revealed on April 4th.',
  final_cta_button: 'Join the waitlist \u2014 Pricing on April 4th',

  // Founder
  founder_section_title: 'The founder',
  founder_role: 'Founder of CloseOS',
  founder_bio: "Before creating the CloseOS ecosystem, Thomas was a closer and setter. It was from working in the field that he experienced the daily reality of the job firsthand: working with at least 2 screens, juggling dozens of tools that don't even talk to each other, and wasting 1 to 1.5 hours every day just to keep everything updated. A CRM on one side, a booking tool on another, invoicing on a third, KPIs in a spreadsheet \u2014 all with zero synchronization. CloseOS was born from that frustration: a single tool that replaces all the others, built by a closer for closers.",

  // Footer
  footer_copyright: '\u00A9 2026 CloseOS',
  footer_mentions: 'Legal notices',
  footer_cgu: 'Terms of Service',
  footer_cgv: 'Terms of Sale',
  footer_confidentialite: 'Privacy',
  footer_politique: 'Usage Policy',
  footer_contact: 'support@closeos.fr',

  // Contact modal
  contact_title: 'Contact us',
  contact_name: 'Full name',
  contact_name_placeholder: 'John Doe',
  contact_email: 'Your email',
  contact_email_placeholder: 'john@example.com',
  contact_subscriber: 'I am a CloseOS subscriber',
  contact_category: 'Topic',
  contact_category_placeholder: 'Select a topic',
  contact_category_bug: 'Bug',
  contact_category_feature: 'Feature request',
  contact_category_partnership: 'Partnership / Collaboration',
  contact_category_help: 'Help / Support',
  contact_category_billing: 'Billing / Subscription',
  contact_category_other: 'Other',
  contact_subject: 'Subject',
  contact_subject_placeholder: 'Subject of your message',
  contact_message: 'Message',
  contact_message_placeholder: 'Write your message here...',
  contact_attachment: 'Add an attachment',
  contact_send: 'Send',
  contact_sending: 'Sending...',
  contact_success: 'Your message has been sent successfully!',
  contact_error: 'An error occurred. Please try again.',

  // Scroll to top
  scroll_top_label: 'Back to top',

  // Waiting list modal
  modal_success_title: 'Noted! \uD83D\uDE80',
  modal_success_description: 'Thanks for your interest. Watch this video while waiting for the launch!',
  modal_whatsapp: 'WhatsApp Channel',
  modal_google_form: 'Your needs (Google Form)',
  modal_linkedin: 'Follow on LinkedIn',
  modal_title: 'Join the waitlist',
  modal_description: 'Sign up and receive on {date} a competitive and unbeatable early adopter price, reserved exclusively for subscribers \u2014 {locked}.',
  modal_description_date: 'April 4th',
  modal_description_locked: 'locked for life',
  modal_email_label: 'Your Professional Email',
  modal_email_placeholder: 'your@email.com',
  modal_submit: 'Sign up now',
  modal_loading: 'Signing up...',
  modal_footer: 'Priority access \u2022 No commitment',
  modal_error_already_registered: 'You are already registered with this email',
  modal_error_generic: 'An error occurred. Please try again.',

  // SEO
  seo_title: 'CloseOS Business — Manage Your Sales Team',
  seo_description: 'Management platform for infopreneurs: manage closers, setters, KPIs and acquisition campaigns. 20-day free trial.',
  seo_og_title: 'CloseOS Business \u2014 Management Platform for Entrepreneurs and Heads of Sales',
  seo_og_description: 'Manage your sales team, drive your acquisition campaigns and track your team KPIs. French-speaking closing software.',
  seo_default_title: 'CloseOS \u2014 SaaS Ecosystem for Digital Sales | Closer CRM & Management',
  seo_default_description: 'CloseOS is the French-speaking SaaS ecosystem for digital sales. Closer tool: CRM, pipeline, VoIP, KPIs, automatic invoicing. Management: sales team, acquisition campaigns, analytics. iClosed alternative.',
  seo_default_og_title: 'CloseOS \u2014 SaaS Ecosystem for French-speaking Digital Sales',
  seo_default_og_description: 'All-in-one tool for closers (CRM, pipeline, VoIP, KPIs) and entrepreneurs (team management, campaigns, analytics). iClosed alternative.',

  // Structured data
  sd_description: 'Management platform for entrepreneurs and Heads of Sales. Sales team management, acquisition campaign management, CRM, dashboard. iClosed alternative, 100% in French.',
  sd_offer_description: 'Waitlist \u2014 early adopter pricing',
  sd_feature_list: 'Manage sales team, Team closing management, Closing software, Acquisition CRM, Setter closer management tool, Acquisition campaign management, Dashboard, Team KPIs, Automated closer onboarding',
  sd_faq_who_q: 'Who is CloseOS Business for?',
  sd_faq_who_a: 'CloseOS Business is designed for anyone selling online: entrepreneurs, Heads of Sales, solopreneurs and those running Challenges. Even a solo closer or a setter/closer duo can benefit from the management tool.',
  sd_faq_compat_q: 'Is CloseOS Business compatible with my current CRM tools?',
  sd_faq_compat_a: 'Yes. CloseOS Business natively connects to 6 platforms: HubSpot (bidirectional), Pipedrive (bidirectional), GoHighLevel GHL (bidirectional), Airtable (bidirectional), Systeme.io (webhook) and iClosed (unidirectional via webhook). You can also import/export your prospects as CSV from any tool. The built-in CloseOS Business CRM offers the best performance for the ecosystem.',
  sd_faq_why_crm_q: 'Why use the CloseOS CRM if I already have HubSpot or Pipedrive?',
  sd_faq_why_crm_a: "CloseOS doesn't necessarily replace your CRM \u2014 it connects to it. Keep HubSpot, Pipedrive, GoHighLevel or Airtable as your marketing source, and use CloseOS as an optimized closing cockpit. Bidirectional sync ensures every prospect is up to date on both sides. The native CloseOS CRM offers automatic setter/closer assignment, lead capture, campaign tracking and built-in analytics.",
  sd_faq_data_access_q: 'Do my closers have access to all data?',
  sd_faq_data_access_a: 'No. You define the access levels. Each closer only sees their own prospects, their KPIs and their pipeline. Sensitive data (total revenue, margins, strategic contacts) remains visible only to you.',
  sd_faq_what_q: 'What is CloseOS Business?',
  sd_faq_what_a: "CloseOS Business is the management platform for French-speaking entrepreneurs and Heads of Sales. It enables managing a team of closers and setters, driving acquisition campaigns, tracking team KPIs and automating closer onboarding. It's the French alternative to iClosed, designed for sales team management.",
  sd_faq_how_many_q: 'How many closers can I add to CloseOS Business?',
  sd_faq_how_many_a: 'As many as you want. CloseOS Business imposes no limit on your team of closers and setters.',
  sd_faq_gdpr_q: 'Is the data secure and GDPR-compliant?',
  sd_faq_gdpr_a: 'Yes. CloseOS Business is 100% GDPR-compliant. All data is securely hosted, isolated by organization, and no third party has access. You remain the owner of your data at all times.',
}

// ───────────────────────────────────────────────
// Translations object
// ───────────────────────────────────────────────
export const translations: Record<Lang, Translations> = { fr, en }

// ───────────────────────────────────────────────
// Language detection
// ───────────────────────────────────────────────
export function detectLang(): Lang {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    // If timezone is in France, default to French
    if (tz.startsWith('Europe/Paris')) return 'fr'
    // Check browser language
    const browserLang = navigator.language || (navigator as any).userLanguage || ''
    if (browserLang.startsWith('fr')) return 'fr'
    return 'en'
  } catch {
    return 'fr'
  }
}

// ───────────────────────────────────────────────
// React context & hook
// ───────────────────────────────────────────────
interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
}

export const LangContext = createContext<LangContextType>({
  lang: 'fr',
  setLang: () => {},
  t: translations.fr,
})

export const useLang = () => useContext(LangContext)
