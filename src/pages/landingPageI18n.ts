export type SalesLang = 'fr' | 'en'

export interface SalesTranslations {
  // SEO
  seo_title: string
  seo_description: string

  // JSON-LD (structured data)
  ld_description: string
  ld_offers: string
  ld_features: string
  ld_faq1_q: string
  ld_faq1_a: string
  ld_faq2_q: string
  ld_faq2_a: string
  ld_faq3_q: string
  ld_faq3_a: string
  ld_faq4_q: string
  ld_faq4_a: string
  ld_faq5_q: string
  ld_faq5_a: string
  ld_faq6_q: string
  ld_faq6_a: string
  ld_faq7_q: string
  ld_faq7_a: string

  // Banner
  banner: string

  // Navbar
  nav_features: string
  nav_integrations: string
  nav_roles: string
  nav_comparison: string
  nav_pricing: string
  nav_faq: string
  nav_login: string
  nav_cta: string

  // Hero
  badge_env: string
  badge_system: string
  badge_rgpd: string
  hero_title_line1: string
  hero_title_line2: string
  hero_title_line3: string
  hero_subtitle: string
  hero_badge_focus: string
  hero_cta: string
  hero_login: string
  hero_whatsapp: string
  hero_no_card: string
  hero_social_proof: string
  hero_social_proof_count: string

  // Integrations
  integrations_title: string

  // Features
  features_title: string
  features_subtitle: string
  features_highlight: string
  feat1_title: string
  feat1_desc: string
  feat1_item1: string
  feat1_item2: string
  feat1_item3: string
  feat1_item4: string
  feat2_title: string
  feat2_desc: string
  feat2_badge: string
  feat3_title: string
  feat3_desc: string
  feat4_title: string
  feat4_desc: string
  feat4_bio: string
  feat4_bio_desc: string
  feat4_instant: string
  feat4_instant_desc: string
  feat4_tracking: string
  feat4_tracking_desc: string
  feat5_title: string
  feat5_desc: string
  feat5_tag1: string
  feat5_tag2: string
  feat5_tag3: string
  feat6_title: string
  feat6_desc: string
  feat7_title: string
  feat7_desc: string
  feat8_title: string
  feat8_desc: string
  feat8_a_title: string
  feat8_a_desc: string
  feat8_b_title: string
  feat8_b_desc: string
  feat8_c_title: string
  feat8_c_desc: string
  feat9_title: string
  feat9_desc: string
  feat10_title: string
  feat10_desc: string
  feat11_title: string
  feat11_desc: string
  feat12_title: string
  feat12_desc: string
  feat13_title: string
  feat13_desc: string
  feat13_a_title: string
  feat13_a_desc: string
  feat13_b_title: string
  feat13_b_desc: string
  feat13_c_title: string
  feat13_c_desc: string
  feat14_title: string
  feat14_desc: string
  feat15_title: string
  feat15_desc: string

  // Roadmap
  roadmap_badge: string
  roadmap_title: string
  roadmap_subtitle: string
  roadmap_q1_title: string
  roadmap_q1_desc: string
  roadmap_q2_title: string
  roadmap_q2_desc: string
  roadmap_q2b_title: string
  roadmap_q2b_desc: string
  roadmap_q3_title: string
  roadmap_q3_desc: string
  roadmap_q4_title: string
  roadmap_q4_desc: string

  // Testimonials
  testimonials_title: string
  testimonials_subtitle: string

  // Comparison
  comp_title: string
  comp_subtitle: string
  comp_old_title: string
  comp_old1: string
  comp_old1_badge: string
  comp_old2: string
  comp_old2_badge: string
  comp_old3: string
  comp_old3_badge: string
  comp_old4: string
  comp_old4_badge: string
  comp_old5: string
  comp_old5_badge: string
  comp_co2_old: string
  comp_co2_old_unit: string
  comp_co2_old_note: string
  comp_loss_label: string
  comp_loss_value: string
  comp_loss_unit: string
  comp_new_badge: string
  comp_new_title: string
  comp_roi_title: string
  comp_roi_desc: string
  comp_brain_title: string
  comp_brain_desc: string
  comp_pro_title: string
  comp_pro_desc: string
  comp_co2_new: string
  comp_co2_new_unit: string
  comp_co2_new_note: string
  comp_co2_tooltip: string
  comp_pack_label: string
  comp_pack_price_suffix: string
  comp_pack_tagline: string

  // Roles section
  roles_eyebrow: string
  roles_title: string
  roles_subtitle: string
  role_closer_name: string
  role_closer_tag: string
  role_closer_desc: string
  role_closer_b1: string
  role_closer_b2: string
  role_closer_b3: string
  role_closer_b4: string
  role_setter_name: string
  role_setter_tag: string
  role_setter_desc: string
  role_setter_b1: string
  role_setter_b2: string
  role_setter_b3: string
  role_setter_b4: string
  role_sc_name: string
  role_sc_tag: string
  role_sc_desc: string
  role_sc_b1: string
  role_sc_b2: string
  role_sc_b3: string
  role_sc_b4: string
  roles_footer: string

  // Pricing
  pricing_title: string
  pricing_subtitle: string
  pricing_trial: string
  pricing_monthly: string
  pricing_quarterly: string
  pricing_yearly: string
  pricing_launch_badge: string
  pricing_pack_name: string
  pricing_pack_desc: string
  pricing_billed_yearly: string
  pricing_billed_quarterly: string
  pricing_feat1_bold: string
  pricing_feat1_rest: string
  pricing_feat2_bold: string
  pricing_feat2_rest: string
  pricing_feat3: string
  pricing_feat4_bold: string
  pricing_feat4_rest: string
  pricing_feat5_bold: string
  pricing_feat5_rest: string
  pricing_feat6_bold: string
  pricing_feat6_rest: string
  pricing_feat7_bold: string
  pricing_feat7_rest: string
  pricing_feat8: string
  pricing_cta: string
  pricing_no_card: string
  pricing_climate: string
  pricing_close_comparison: string

  // FAQ
  faq_title: string
  faq_subtitle: string
  faq_what_q: string
  faq_what_a1: string
  faq_what_a2: string
  faq1_q: string
  faq1_a1: string
  faq1_a2: string
  faq2_q: string
  faq2_intro: string
  faq2_item1: string
  faq2_item2: string
  faq3_q: string
  faq3_a1: string
  faq3_a2: string
  faq5_q: string
  faq5_a1: string
  faq5_a2: string
  faq_relance_q: string
  faq_relance_a1: string
  faq_relance_a2: string
  faq_security_q: string
  faq_security_a: string

  // CTA Final
  cta_title_line1: string
  cta_title_line2: string
  cta_subtitle: string
  cta_btn: string
  cta_trial: string

  // Partners
  nav_partners: string
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

  // Founder
  founder_section_title: string
  founder_role: string
  founder_bio: string

  // Footer
  footer_legal: string
  footer_cgu: string
  footer_cgv: string
  footer_privacy: string

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
}

const fr: SalesTranslations = {
  // SEO
  seo_title: "CloseOS Sales, CRM tout-en-un pour closers",
  seo_description: "CRM conçu pour les closers : pipeline visuel, callroom intégrée, facturation auto et KPIs en temps réel. Essai gratuit 20 jours.",

  // JSON-LD
  ld_description: "Le CRM pour closer en France. Pipeline de vente, suivi calls closing, agenda, facturation automatique et KPIs de closing. Logiciel closer high ticket tout-en-un.",
  ld_offers: "Essai gratuit 10 jours sans carte bancaire",
  ld_features: "CRM closer, Pipeline closer, Suivi calls closing, Agenda & booking, Facturation automatique closer, KPI closing, Gestion prospects closing, Visioconférence",
  ld_faq1_q: "Est-ce que je peux connecter Calendly à CloseOS ?",
  ld_faq1_a: "Non, et c'est un choix assumé. Calendly impose un abonnement payant dès que vous voulez connecter votre agenda à un outil tiers : vous payez une formule Pro uniquement pour que Calendly accepte de parler à votre CRM. CloseOS intègre à la place Cal.com, la référence open source de la prise de rendez-vous, sans surcoût et sans palier. Vous obtenez le même résultat : des liens de réservation personnalisés, la synchronisation bidirectionnelle avec votre Google Calendar, la gestion des disponibilités, des fuseaux horaires et des tampons entre rendez-vous, ainsi que les rappels automatiques envoyés au prospect avant l'appel. CloseOS gère aussi le multi-booking, qui permet de proposer plusieurs créneaux en un seul envoi. Si vous tenez à conserver Calendly pour d'autres usages, il reste disponible parmi les intégrations natives de CloseOS.",
  ld_faq2_q: "Comment CloseOS s'engage pour l'environnement ?",
  ld_faq2_a: "CloseOS défend ce que nous appelons la Performance Responsable, et cela se traduit par deux engagements concrets. Le premier est la sobriété numérique : en remplaçant dix outils par un seul, CloseOS réduit mécaniquement le nombre de serveurs sollicités, de synchronisations permanentes entre applications et de données dupliquées d'un logiciel à l'autre. Une stack fragmentée consomme plus qu'un système unifié, à usage égal. Le second est financier : chaque mois, une partie des revenus de CloseOS est reversée au financement de l'élimination de CO2, et non à de la simple compensation. S'y ajoute un choix d'hébergement en Union européenne, qui limite les transferts de données longue distance tout en garantissant la conformité au RGPD. Ces engagements n'ont pas vocation à être un argument marketing isolé : ils orientent les décisions techniques du produit.",
  ld_faq3_q: "Pourquoi payer CloseOS plutôt qu'utiliser Excel ou Notion ?",
  ld_faq3_a: "Parce que le bricolage coûte des ventes, et le coût est rarement visible sur le moment. Excel et Notion sont des outils passifs : ils stockent l'information que vous y saisissez, mais ils n'agissent pas. Ils n'envoient pas de relance quand un prospect ne répond plus, ne génèrent pas de lien de visioconférence, ne synchronisent pas votre agenda, n'enregistrent pas vos appels, n'émettent pas vos factures et ne calculent pas votre taux de closing. Chacune de ces tâches finit par retomber sur vous, entre deux appels. CloseOS est un système actif : les relances s'enchaînent seules selon les délais que vous définissez, la facture part après la vente, et les KPIs se recalculent en temps réel. Le temps que vous ne passez plus à faire tenir votre outil est du temps rendu au closing.",
  ld_faq4_q: "Est-ce que iClosed est intégré à CloseOS ?",
  ld_faq4_a: "Oui, et en synchronisation bidirectionnelle complète, ce qui va plus loin qu'un simple import. Chaque prospect, chaque deal et chaque changement d'étape effectué d'un côté est reflété de l'autre en temps réel : vos leads et vos ventes iClosed remontent dans CloseOS, et toute mise à jour faite dans CloseOS — changement d'étape, tag, note, prise de rendez-vous — est repoussée vers iClosed automatiquement. Vous n'avez ni double saisie, ni désynchronisation, ni fichier à réconcilier en fin de mois. Concrètement, vous conservez votre configuration iClosed existante, vos liens de réservation et vos habitudes d'équipe, et vous ajoutez par-dessus le cockpit CloseOS : pipeline, facturation, KPIs et pilotage. C'est aussi le chemin de migration le plus sûr, puisque rien n'est coupé pendant la transition.",
  ld_faq5_q: "C'est quoi CloseOS Sales ?",
  ld_faq5_a: "CloseOS Sales est un CRM conçu pour les closers indépendants et freelances francophones qui vendent en high ticket. Là où un CRM généraliste part du principe qu'une équipe commerciale gère un cycle long, CloseOS Sales part du quotidien réel d'un closer : des appels, un pipeline à faire avancer, des relances à tenir et des commissions à suivre. Il réunit dans un seul outil le pipeline de vente visuel, la Call Room intégrée pour passer et enregistrer les appels, l'agenda et les liens de réservation, les relances automatiques, la facturation connectée à Stripe et les KPIs de closing calculés en temps réel. L'objectif est de remplacer les six à dix logiciels qu'un closer assemble habituellement — tableur, agenda, outil de booking, visio, facturation, tableau de suivi — par un seul environnement cohérent.",
  ld_faq6_q: "CloseOS gère-t-il mes relances et mon suivi de prospects ?",
  ld_faq6_a: "Oui, et c'est l'une des fonctions les plus utilisées de CloseOS Sales. Vous définissez vos délais de relance une seule fois — par exemple à trois jours, puis sept, puis quinze — et CloseOS enchaîne ensuite les relances automatiquement. Chaque jour, vous retrouvez la liste des prospects à relancer, sans avoir à la reconstituer de mémoire ou à fouiller vos conversations. Quand un prospect répond, le bouton « Répondu » met immédiatement les relances en pause et bascule le prospect en suivi de discussion, où vous le qualifiez comme qualifié, disqualifié ou en cours. La liste « À relancer & à suivre » réunit les deux vues et montre en un coup d'œil qui attend une relance et avec qui vous êtes en conversation active. Un digest quotidien récapitule les discussions en cours.",
  ld_faq7_q: "Mes données sont-elles sécurisées et conformes au RGPD ?",
  ld_faq7_a: "Oui. CloseOS est conforme au RGPD et vos données sont hébergées dans l'Union européenne, jamais transférées hors de cet espace pour le fonctionnement du service. Chaque compte est isolé des autres au niveau de la base de données, et l'accès est restreint par des règles de sécurité appliquées côté serveur : un utilisateur ne peut techniquement pas lire les données d'un autre compte, même en cas de tentative directe. Vous restez propriétaire de vos données. Vous pouvez les exporter à tout moment dans un format réutilisable, et demander leur suppression définitive, qui est alors traitée sans délai artificiel. La connexion est protégée par une double authentification par appareil : une nouvelle connexion déclenche l'envoi d'un code par email et une notification vous avertit de toute connexion depuis un appareil inconnu.",

  // Banner
  banner: "\u{1F680} La V1 de CloseOS est officiellement lancée ! Testez gratuitement pendant 10 jours.",

  // Navbar
  nav_features: "Fonctionnalités",
  nav_roles: "Rôles",
  nav_integrations: "Intégrations",
  nav_comparison: "Comparatif",
  nav_pricing: "Tarifs",
  nav_faq: "FAQ",
  nav_login: "Se connecter",
  nav_cta: "Commencer gratuitement",

  // Hero
  badge_env: "\u{1F331} Engagé pour l'environnement",
  badge_system: "Le Système d'Exploitation des Closers",
  badge_rgpd: "100% RGPD & Sécurisé",
  hero_title_line1: "Le CRM pour closer",
  hero_title_line2: "tout-en-un.",
  hero_title_line3: "Récupérez 10h par semaine.",
  hero_subtitle: "Pipeline closer, agenda & booking, facturation automatique, KPIs de closing, le logiciel closer high ticket conçu pour les closers freelance en France. Gérez vos prospects closing, suivez vos calls et concentrez-vous sur ce qui rapporte.",
  hero_badge_focus: "\u{1F517} Un seul outil. Zéro saisie manuelle. 100% dédié au closing.",
  hero_cta: "Commencer gratuitement",
  hero_login: "Se connecter",
  hero_whatsapp: "Rejoindre la communauté WhatsApp",
  hero_no_card: "\u{1F512} Aucune carte bancaire requise. 10 jours pour tester sans engagement.",
  hero_social_proof: "Produit validé par",
  hero_social_proof_count: "+270 closers",

  // Integrations
  integrations_title: "Synchronisation native avec vos outils préférés",

  // Features
  features_title: "Toutes vos fonctionnalités de closing.\nUn seul outil.",
  features_subtitle: "CRM, pipeline, agenda, facturation, KPIs. Arrêtez de jongler entre les onglets. CloseOS centralise tout votre flux de travail pour que vous puissiez vous concentrer sur l'essentiel :",
  features_highlight: "vendre et closer.",
  feat1_title: "Cockpit & KPIs en Temps Réel",
  feat1_desc: "Votre centre de commandement. Visualisez instantanément vos commissions, votre taux de conversion, et votre pipeline. Si votre performance baisse, vous le voyez tout de suite.",
  feat1_item1: "Cash encaissé",
  feat1_item2: "Taux de closing",
  feat1_item3: "Commissions prévisionnelles",
  feat1_item4: "Deals en cours",
  feat2_title: "Appels & Click-to-WhatsApp",
  feat2_desc: "Appelez vos prospects en un clic via Twilio (appels enregistrés). Lancez vos conversations WhatsApp instantanément sans enregistrer le numéro.",
  feat2_badge: "\u{1F680} Zéro friction au quotidien",
  feat3_title: "Pipeline & Offres",
  feat3_desc: "Vue Kanban fluide. Configurez vos offres (prix, commissions, formules) et laissez l'outil calculer vos gains à chaque deal déplacé.",
  feat4_title: "Votre Profil de Closer en Temps Réel",
  feat4_desc: "Générez un lien de partage unique en un clic. Configurez exactement ce que vous voulez exposer : KPIs seuls, Pipeline complet, ou les deux. Protégez-le par mot de passe si besoin.",
  feat4_bio: "\u{1F517} Lien Bio",
  feat4_bio_desc: "Mettez le lien dans votre bio LinkedIn ou Instagram. Les infopreneurs tombent dessus, voient vos stats, vous contactent.",
  feat4_instant: "\u{26A1} Réponse Instantanée",
  feat4_instant_desc: "\"Montre-moi tes performances.\" Vous envoyez le lien. Fini les captures d'écran, les tableaux Excel et les pavés WhatsApp.",
  feat4_tracking: "\u{1F441}\u{FE0F} Suivi Infopreneur",
  feat4_tracking_desc: "Votre infopreneur suit votre pipeline et vos KPIs sans avoir besoin d'un compte. Transparence totale, confiance maximale.",
  feat5_title: "Agenda & Booking & Rappel",
  feat5_desc: "Connectez votre Google Calendar. Vos rendez-vous et créneaux de booking remontent automatiquement dans votre Pipeline. Programmez des rappels sur vos appels directement depuis votre pipeline.",
  feat5_tag1: "Sync Bi-directionnelle",
  feat5_tag2: "Intégration native",
  feat5_tag3: "Rappels intégrés",
  feat6_title: "Facturation Auto & Paiement CB",
  feat6_desc: "Générez vos factures de commissions en un clic. Créez des liens de paiement CB sécurisés et envoyez automatiquement la facture à votre infopreneur.",
  feat7_title: "Sync CRM",
  feat7_desc: "Synchronisation native avec iClosed, HubSpot et Pipedrive. Oubliez la double saisie manuelle et automatisez 100% de votre suivi.",
  feat8_title: "Call Room, votre cockpit d'appel",
  feat8_desc: "Une salle d'appel dédiée qui garde tout sous les yeux pendant que vous closez, et enregistre l'appel pour le revoir.",
  feat8_a_title: "\u{1F4DD} Script en direct",
  feat8_a_desc: "Votre script de closing déroulé à côté de l'appel, pour ne jamais perdre le fil.",
  feat8_b_title: "\u{1F381} Offre & ressources",
  feat8_b_desc: "L'offre, ses formules et vos ressources accessibles en un clic pendant l'appel.",
  feat8_c_title: "\u{1F3A5} Enregistrement",
  feat8_c_desc: "Enregistrez l'écran et l'audio de l'appel, exportés en vidéo pour vous rejouer et progresser.",
  feat9_title: "Relances Automatiques",
  feat9_desc: "Ne perdez plus jamais un prospect. Badges de relance sur vos cartes, délais configurables, et un email digest quotidien qui liste vos relances à faire.",
  feat10_title: "Rapport de Performance Hebdo",
  feat10_desc: "Votre semaine en un coup d'œil : CA, deals gagnés, RDV réalisés, taux de closing, chacun comparé à la semaine précédente. En app et par email chaque lundi.",
  feat11_title: "Détection de Doublons",
  feat11_desc: "CloseOS repère les fiches en double (même email ou téléphone) et vous les fusionne proprement, en comparaison côte à côte. Votre base reste nette.",
  feat12_title: "Tâches par Prospect",
  feat12_desc: "Attachez des tâches à chaque prospect avec échéance, et retrouvez tout ce qui est à faire aujourd'hui sur votre dashboard. Rien ne passe à la trappe.",
  feat13_title: "Suivi de Discussion & Taux de Réponse",
  feat13_desc: "Un prospect vous répond enfin ? Cliquez sur \"Répondu\" : les relances se mettent en pause et il compte dans votre vrai taux de réponse. CloseOS garde le fil de la conversation à votre place.",
  feat13_a_title: "\u{2709}\u{FE0F} Répondu",
  feat13_a_desc: "Marque le prospect comme actif, met les relances en pause, et le fait compter dans votre taux de réponse.",
  feat13_b_title: "\u{1F504} Toujours en discussion ?",
  feat13_b_desc: "Un jour plus tard, CloseOS vous redemande : reprendre les relances, ou qualifier / disqualifier le prospect.",
  feat13_c_title: "\u{1F4CB} À relancer & à suivre",
  feat13_c_desc: "Une liste de travail dédiée : qui relancer aujourd'hui, et qui a répondu et attend votre suivi.",
  feat14_title: "Digest \"Toujours en discussion ?\"",
  feat14_desc: "Chaque jour à 17h, un email récap liste vos prospects qui ont répondu mais où la discussion traîne. Vous ne laissez plus jamais une conversation chaude s'éteindre toute seule.",
  feat15_title: "Rappels à Heure Précise",
  feat15_desc: "Programmez un rappel à la minute près sur n'importe quel prospect (\"rappeler demain à 14h30\"). L'échéance s'affiche sur la fiche et remonte dans votre liste du jour.",

  // Roadmap
  roadmap_badge: "Roadmap 2026",
  roadmap_title: "L'Évolution du Closing",
  roadmap_subtitle: "Notre vision pour faire de CloseOS le système d'exploitation incontournable des closers et infopreneurs.",
  roadmap_q1_title: "Lancement CloseOS Sales",
  roadmap_q1_desc: "CRM, Pipeline, KPIs...",
  roadmap_q2_title: "CloseOS Business",
  roadmap_q2_desc: "L'outil pour les Infopreneurs, agences, head of sales... Inclut le CRM Complet.",
  roadmap_q2b_title: "Rapport de performance",
  roadmap_q2b_desc: "Feedback sur appels",
  roadmap_q3_title: "App Mobile",
  roadmap_q3_desc: "iOS & Android",
  roadmap_q4_title: "Messagerie Interne",
  roadmap_q4_desc: "Chat équipe intégré",

  // Testimonials
  testimonials_title: "Ce qu'en disent nos utilisateurs",
  testimonials_subtitle: "Des closers et infopreneurs qui ont transformé leur quotidien",

  // Comparison
  comp_title: "Closer sans CloseOS vs avec CloseOS",
  comp_subtitle: "Pourquoi rester esclave de l'administratif quand un seul outil peut tout automatiser ?",
  comp_old_title: "Les \"Obligations\" Invisibles",
  comp_old1: "Jonglage entre CRMs (HubSpot...)",
  comp_old1_badge: "Charge mentale",
  comp_old2: "Reporting KPI sur Google Sheet",
  comp_old2_badge: "Saisie Manuelle",
  comp_old3: "Analyse d'appels",
  comp_old3_badge: "Données dispersées",
  comp_old4: "Facturation des commissions",
  comp_old4_badge: "Retards & Oublis",
  comp_old5: "Temps de gestion hebdo",
  comp_old5_badge: "~5h perdues",
  comp_co2_old: "~150 kg",
  comp_co2_old_unit: "de CO2 émis / an",
  comp_co2_old_note: "(Multitude d'interfaces chargées + Serveurs + RAM)",
  comp_loss_label: "PERTE ESTIMÉE",
  comp_loss_value: "10h",
  comp_loss_unit: "/semaine",
  comp_new_badge: "FOCUS CLOSING UNIQUEMENT",
  comp_new_title: "La Clarté CloseOS",
  comp_roi_title: "ROI Immédiat",
  comp_roi_desc: "1 seul deal de plus par mois rembourse largement l'outil pour l'année.",
  comp_brain_title: "Cerveau Libéré",
  comp_brain_desc: "Zéro saisie. CRM, KPIs et Factures se mettent à jour automatiquement après chaque appel.",
  comp_pro_title: "Image 100% Pro",
  comp_pro_desc: "KPIs propres, factures en 1 clic, cockpit de bord. Travaillez comme le top 1%.",
  comp_co2_new: "~50 kg",
  comp_co2_new_unit: "de CO2 émis / an",
  comp_co2_new_note: "Économisez ~100 kg de CO2 par an. CloseOS consomme drastiquement moins de ressources serveur et de batterie que 10 onglets ouverts en permanence",
  comp_co2_tooltip: "Passer à CloseOS économise ~100 kg de CO2 par an et par closer. C'est l'équivalent de 600 km en voiture évités, juste en fermant vos onglets.",
  comp_pack_label: "Pack Pro",
  comp_pack_price_suffix: "/mois",
  comp_pack_tagline: "Récupérez 1h de vie / jour",

  // Roles section
  roles_eyebrow: "Adapté à votre rôle",
  roles_title: "Un seul outil. Trois manières de l'utiliser.",
  roles_subtitle: "Closer, Setter ou les deux ? CloseOS adapte automatiquement votre pipeline, vos KPI et votre dashboard à votre métier.",
  role_closer_name: "Closer",
  role_closer_tag: "Vous fermez les deals",
  role_closer_desc: "Pipeline focalisé sur la conversion. Vos KPI mesurent ce qui compte : closing rate, CA, commissions.",
  role_closer_b1: "Pipeline 6 stages : Prospect → Qualifié → Follow-up → Gagné...",
  role_closer_b2: "KPI : CA, Taux de conversion, Commissions, Closing après R2...",
  role_closer_b3: "Dashboard : Cash généré, Commissions, Pipeline value...",
  role_closer_b4: "Recap des appels, scripts AI, suivi des objections...",
  role_setter_name: "Setter",
  role_setter_tag: "Vous prenez les RDV",
  role_setter_desc: "Pipeline étendu avec les statuts \"Pas de réponse\" et \"Non qualifié\". KPI taillés pour mesurer votre prospection.",
  role_setter_b1: "Pipeline 8 stages : + Pas de réponse, Non qualifié...",
  role_setter_b2: "KPI dédiés : Taux de réponse, Taux de booking...",
  role_setter_b3: "Dashboard : Contactés, Bookings, Conversions de RDV...",
  role_setter_b4: "Page KPI Setter avec historique de booking par offre...",
  role_sc_name: "Setter + Closer",
  role_sc_tag: "Vous faites les deux",
  role_sc_desc: "Le meilleur des deux mondes. Deux pages KPI distinctes, deux vues dans le dashboard, un seul pipeline complet.",
  role_sc_b1: "Pipeline 8 stages avec tous les statuts setter",
  role_sc_b2: "2 pages KPI : KPI Closer + KPI Setter",
  role_sc_b3: "Dashboard avec sections empilées Setter et Closer",
  role_sc_b4: "Suivi clair de vos commissions setter ET closer",
  roles_footer: "Modifiable à tout moment depuis vos paramètres, l'app s'adapte instantanément.",

  // Pricing
  pricing_title: "Tarifs CloseOS, l'outil tout-en-un des closers",
  pricing_subtitle: "Un seul plan. Tout inclus. Sans engagement.",
  pricing_trial: "Testez gratuitement 10 jours. Aucune carte bancaire requise.",
  pricing_monthly: "Mensuel",
  pricing_quarterly: "Trimestriel",
  pricing_yearly: "Annuel",
  pricing_launch_badge: "\u{1F525} -51% OFFRE DE LANCEMENT",
  pricing_pack_name: "PACK PRO",
  pricing_pack_desc: "L'outil tout-en-un des closers. Accès complet & illimité.",
  pricing_billed_yearly: "Facturé annuellement (216€/an)",
  pricing_billed_quarterly: "Facturé trimestriellement (60€/trim.)",
  pricing_feat1_bold: "CRM & Pipeline",
  pricing_feat1_rest: " illimité",
  pricing_feat2_bold: "Agenda & Booking",
  pricing_feat2_rest: " (Liens de rdv)",
  pricing_feat3: "Facturation & Envoi Automatique",
  pricing_feat4_bold: "KPI Avancés",
  pricing_feat4_rest: " (Evolution, Objectifs)",
  pricing_feat5_bold: "Call Room",
  pricing_feat5_rest: " (Scripts & Notes)",
  pricing_feat6_bold: "Automatisations",
  pricing_feat6_rest: " (Sync CRM, etc.)",
  pricing_feat7_bold: "Enregistrement",
  pricing_feat7_rest: " Vidéo/Audio",
  pricing_feat8: "Support Prioritaire",
  pricing_cta: "Commencer gratuitement",
  pricing_no_card: "Aucune CB requise. 10 jours gratuits.",
  pricing_climate: "Chaque mois, une partie de nos gains finance l'élimination du CO2.",
  pricing_close_comparison: "Fermer le comparatif",

  // FAQ
  faq_title: "Questions Fréquentes",
  faq_subtitle: "Tout ce que vous devez savoir avant de commencer.",
  faq_what_q: "Qu'est-ce que CloseOS Sales, concrètement ?",
  faq_what_a1: "C'est le logiciel tout-en-un du closer indépendant. Un seul outil qui réunit votre CRM et votre pipeline visuel, la Call Room (script, pitch, ressources et prise de notes pendant l'appel), les relances automatiques, l'agenda et le booking synchronisés, la facturation et vos KPIs de closing.",
  faq_what_a2: "L'idée : remplacer les 10 outils que vous bricolez aujourd'hui par un seul cockpit, pour passer moins de temps dans l'administratif et plus de temps à closer.",
  faq1_q: "Est-ce que je peux connecter Calendly ?",
  faq1_a1: "Non, et c'est un choix assumé. Calendly impose un abonnement payant pour permettre les intégrations, une pratique que nous trouvons injuste. Pour vous offrir la meilleure expérience sans surcoût, nous avons intégré Cal.com (la référence Open Source).",
  faq1_a2: "Résultat : vous profitez d'un système de booking ultra-performant, synchronisé à votre agenda, sans avoir à payer un abonnement \"Pro\" à Calendly juste pour qu'il accepte de parler à votre CRM.",
  faq2_q: "Comment CloseOS s'engage pour l'environnement ?",
  faq2_intro: "Nous prônons la \"Performance Responsable\". Concrètement :",
  faq2_item1: "Sobriété numérique : En remplaçant 10 outils par 1 seul, nous réduisons la consommation d'énergie serveur nécessaire à votre activité.",
  faq2_item2: "Action financière : Chaque mois, nous reversons une partie de nos gains pour financer des technologies de pointe d'élimination du CO2. Closer avec nous, c'est aussi contribuer.",
  faq3_q: "Pourquoi payer CloseOS alors que je peux le faire moi-même sur Excel/Notion ?",
  faq3_a1: "Parce que le \"bricolage\" vous coûte des ventes. Excel n'envoie pas de rappels automatiques, Notion ne génère pas vos liens de visio et ne synchronise pas vos appels.",
  faq3_a2: "CloseOS n'est pas un simple tableau de note, c'est un système actif qui élimine 80% de votre administratif. Le temps que vous ne passez plus à configurer vos outils est du temps réinvesti pour signer des contrats.",
  faq5_q: "Est-ce que iClosed est intégré ?",
  faq5_a1: "Oui, et désormais en synchronisation bidirectionnelle complète. Chaque prospect, deal ou changement de stage ajouté ou modifié d'un côté est instantanément reflété de l'autre, plus de double saisie, plus de désynchronisation.",
  faq5_a2: "Concrètement : vos leads et ventes iClosed remontent automatiquement dans CloseOS, et toute mise à jour faite dans CloseOS (stage, tag, note, RDV) est repoussée vers iClosed en temps réel. Vous gardez votre setup iClosed existant et vous gagnez le cockpit CloseOS par-dessus, sans friction.",
  faq_relance_q: "Est-ce que CloseOS gère mes relances et mon suivi de prospects ?",
  faq_relance_a1: "Oui, c'est même le cœur du réacteur. Vous définissez vos délais de relance une fois, et CloseOS enchaîne les relances tout seul : chaque jour, vous recevez la liste de vos prospects à relancer. Un bouton « Relance faite » fait passer à la suivante.",
  faq_relance_a2: "Quand un prospect répond, vous cliquez « Répondu » : les relances se mettent en pause et le prospect bascule en suivi de discussion (qualifié, disqualifié ou encore en cours). La liste « À relancer & à suivre » vous montre en un coup d'œil qui relancer et avec qui vous êtes en discussion, sans jamais rien laisser filer.",
  faq_security_q: "Mes données sont-elles sécurisées et conformes au RGPD ?",
  faq_security_a: "Oui. CloseOS est conforme au RGPD, vos données sont hébergées en Union Européenne, isolées et accessibles à vous seul. Vous restez propriétaire de vos données à tout moment et pouvez les exporter ou les supprimer quand vous le souhaitez.",

  // CTA Final
  cta_title_line1: "Arrêtez de payer pour 10 outils.",
  cta_title_line2: "Commencez à closer.",
  cta_subtitle: "Rejoignez l'élite des closers qui utilisent le système tout-en-un CloseOS.",
  cta_btn: "Commencer gratuitement",
  cta_trial: "10 jours d'essai gratuit. Pas de prélèvement immédiat.",

  // Partners
  nav_partners: "Partenariat",
  partners_badge: "Partenariat",
  partners_title: "Devenez partenaire CloseOS",
  partners_subtitle: "Deux façons de collaborer avec nous et de développer votre activité.",
  partners_integrate_title: "Partenaire",
  partners_integrate_desc: "Intégrez CloseOS directement dans vos offres d'accompagnement.",
  partners_integrate_items: [
    "Idéal pour les formateurs, coachs et agences",
    "Proposez CloseOS dans vos formations ou packs",
    "Offre personnalisée selon votre volume",
    "Support dédié pour vos clients",
  ],
  partners_integrate_cta: "Devenir partenaire",
  partners_ambassador_title: "Ambassadeur",
  partners_ambassador_desc: "Parlez de CloseOS à votre audience et gagnez des commissions.",
  partners_ambassador_items: [
    "Lien de parrainage personnalisé",
    "Commissions récurrentes sur chaque vente",
    "Kit de contenu fourni",
    "Dashboard de suivi en temps réel",
  ],
  partners_ambassador_cta: "Devenir ambassadeur",

  // Founder
  founder_section_title: "Le fondateur",
  founder_role: "Fondateur de CloseOS",
  founder_bio: "Avant de créer l'écosystème CloseOS, Thomas était closer et setter. C'est en étant sur le terrain qu'il a vu et subi la réalité du métier au quotidien : travailler avec minimum 2 écrans, jongler entre des dizaines d'outils qui ne communiquent même pas entre eux, et perdre 1h à 1h30 chaque jour juste pour tout mettre à jour. Un CRM d'un côté, un outil de booking de l'autre, la facturation sur un troisième, les KPIs sur un tableur, le tout sans aucune synchronisation. CloseOS est né de cette frustration : un seul outil qui remplace tous les autres, conçu par un closer pour les closers.",

  // Footer
  footer_legal: "Mentions Légales",
  footer_cgu: "CGU",
  footer_cgv: "CGV",
  footer_privacy: "Politique de Confidentialité",

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
}

const en: SalesTranslations = {
  // SEO
  seo_title: "CloseOS Sales, All-in-One CRM for Closers",
  seo_description: "CRM built for closers: visual pipeline, built-in call room, automated invoicing & real-time KPIs. 20-day free trial.",

  // JSON-LD
  ld_description: "The CRM for closers. Sales pipeline, call tracking, calendar, automated invoicing and closing KPIs. All-in-one high-ticket closer software.",
  ld_offers: "10-day free trial, no credit card required",
  ld_features: "Closer CRM, Sales pipeline, Call tracking, Calendar & booking, Automated invoicing, Closing KPIs, Prospect management, Video conferencing",
  ld_faq1_q: "Can I connect Calendly to CloseOS?",
  ld_faq1_a: "No, and that's a deliberate choice. Calendly requires a paid plan as soon as you want to connect your calendar to a third-party tool: you pay for a Pro subscription purely so Calendly agrees to talk to your CRM. CloseOS integrates Cal.com instead, the open-source standard for scheduling, at no extra cost and with no tiers. You get the same outcome: personalised booking links, two-way sync with your Google Calendar, availability management, time zones and buffers between meetings, plus automatic reminders sent to the prospect before the call. CloseOS also handles multi-booking, letting you offer several time slots in a single send. If you want to keep Calendly for other purposes, it remains available among the native CloseOS integrations.",
  ld_faq2_q: "How does CloseOS contribute to the environment?",
  ld_faq2_a: "CloseOS stands for what we call Responsible Performance, and it translates into two concrete commitments. The first is digital sobriety: by replacing ten tools with one, CloseOS mechanically reduces the number of servers involved, the constant syncing between applications and the data duplicated from one piece of software to the next. A fragmented stack consumes more than a unified system, for the same usage. The second is financial: every month, a share of CloseOS revenue funds CO2 removal rather than simple offsetting. On top of that, hosting in the European Union limits long-distance data transfers while guaranteeing GDPR compliance. These commitments are not meant to be an isolated marketing line: they shape the product's technical decisions.",
  ld_faq3_q: "Why pay for CloseOS instead of using Excel or Notion?",
  ld_faq3_a: "Because DIY setups cost you deals, and the cost is rarely visible at the time. Excel and Notion are passive tools: they store whatever you type into them, but they do not act. They do not send a follow-up when a prospect goes quiet, do not generate a video call link, do not sync your calendar, do not record your calls, do not issue your invoices and do not compute your closing rate. Every one of those tasks ends up back on you, between two calls. CloseOS is an active system: follow-ups run on the intervals you set, the invoice goes out after the sale, and KPIs recalculate in real time. The time you stop spending holding your tooling together is time handed back to closing.",
  ld_faq4_q: "Is iClosed integrated with CloseOS?",
  ld_faq4_a: "Yes, with full two-way sync, which goes further than a one-off import. Every prospect, deal and stage change made on one side is reflected on the other in real time: your iClosed leads and sales flow into CloseOS, and any update made in CloseOS — stage change, tag, note, booked meeting — is pushed back to iClosed automatically. There is no double entry, no drift and no file to reconcile at month end. In practice, you keep your existing iClosed setup, your booking links and your team's habits, and you add the CloseOS cockpit on top: pipeline, invoicing, KPIs and management. It is also the safest migration path, since nothing is switched off during the transition.",
  ld_faq5_q: "What is CloseOS Sales?",
  ld_faq5_a: "CloseOS Sales is a CRM built for independent and freelance closers selling high-ticket offers. Where a general-purpose CRM assumes a sales team working a long cycle, CloseOS Sales starts from a closer's actual day: calls, a pipeline to move forward, follow-ups to keep and commissions to track. It brings together in a single tool the visual sales pipeline, the built-in Call Room for placing and recording calls, the calendar and booking links, automatic follow-ups, invoicing connected to Stripe, and closing KPIs computed in real time. The goal is to replace the six to ten pieces of software a closer usually assembles — spreadsheet, calendar, booking tool, video call, invoicing, tracking sheet — with one coherent environment.",
  ld_faq6_q: "Does CloseOS handle my follow-ups and prospect tracking?",
  ld_faq6_a: "Yes, and it is one of the most used features in CloseOS Sales. You set your follow-up intervals once — say three days, then seven, then fifteen — and CloseOS chains the reminders automatically from there. Every day you get the list of prospects to follow up, without having to rebuild it from memory or dig through your conversations. When a prospect replies, the \"Replied\" button immediately pauses follow-ups and moves the prospect into discussion tracking, where you mark them qualified, disqualified or ongoing. The \"To follow up & track\" list combines both views and shows at a glance who is waiting on a follow-up and who you are actively talking to. A daily digest recaps ongoing discussions.",
  ld_faq7_q: "Is my data secure and GDPR-compliant?",
  ld_faq7_a: "Yes. CloseOS is GDPR-compliant and your data is hosted in the European Union, never transferred outside that area to operate the service. Each account is isolated from the others at the database level, and access is restricted by security rules enforced server-side: a user cannot technically read another account's data, even by direct attempt. You remain the owner of your data. You can export it at any time in a reusable format, and request permanent deletion, which is then processed without artificial delay. Sign-in is protected by per-device two-factor authentication: a new sign-in triggers an emailed code, and a notification warns you of any login from an unknown device.",

  // Banner
  banner: "\u{1F680} CloseOS V1 is officially live! Try it free for 10 days.",

  // Navbar
  nav_features: "Features",
  nav_roles: "Roles",
  nav_integrations: "Integrations",
  nav_comparison: "Compare",
  nav_pricing: "Pricing",
  nav_faq: "FAQ",
  nav_login: "Sign in",
  nav_cta: "Start for free",

  // Hero
  badge_env: "\u{1F331} Committed to the environment",
  badge_system: "The Operating System for Closers",
  badge_rgpd: "100% GDPR Compliant & Secure",
  hero_title_line1: "The all-in-one",
  hero_title_line2: "closer CRM.",
  hero_title_line3: "Get 10 hours back every week.",
  hero_subtitle: "Closer pipeline, calendar & booking, automated invoicing, closing KPIs, the high-ticket closer software built for freelance closers. Manage your prospects, track your calls and focus on what makes money.",
  hero_badge_focus: "\u{1F517} One tool. Zero manual entry. 100% dedicated to closing.",
  hero_cta: "Start for free",
  hero_login: "Sign in",
  hero_whatsapp: "Join the WhatsApp community",
  hero_no_card: "\u{1F512} No credit card required. 10 days to try with no commitment.",
  hero_social_proof: "Trusted by",
  hero_social_proof_count: "270+ closers",

  // Integrations
  integrations_title: "Native sync with your favorite tools",

  // Features
  features_title: "All your closing features.\nOne single tool.",
  features_subtitle: "CRM, pipeline, calendar, invoicing, KPIs. Stop juggling between tabs. CloseOS centralizes your entire workflow so you can focus on what matters:",
  features_highlight: "selling and closing.",
  feat1_title: "Cockpit & Real-Time KPIs",
  feat1_desc: "Your command center. Instantly see your commissions, conversion rate and pipeline. If your performance dips, you'll know right away.",
  feat1_item1: "Cash collected",
  feat1_item2: "Closing rate",
  feat1_item3: "Projected commissions",
  feat1_item4: "Deals in progress",
  feat2_title: "Calls & Click-to-WhatsApp",
  feat2_desc: "Call your prospects in one click via Twilio (calls recorded). Start WhatsApp conversations instantly without saving the number.",
  feat2_badge: "\u{1F680} Zero friction, every day",
  feat3_title: "Pipeline & Offers",
  feat3_desc: "Smooth Kanban view. Configure your offers (price, commissions, plans) and let the tool calculate your earnings with every deal moved.",
  feat4_title: "Your Real-Time Closer Profile",
  feat4_desc: "Generate a unique share link in one click. Choose exactly what to display: KPIs only, full Pipeline, or both. Password-protect it if needed.",
  feat4_bio: "\u{1F517} Bio Link",
  feat4_bio_desc: "Add the link to your LinkedIn or Instagram bio. Business owners find it, see your stats, and reach out.",
  feat4_instant: "\u{26A1} Instant Proof",
  feat4_instant_desc: "\"Show me your numbers.\" You send the link. No more screenshots, spreadsheets or WhatsApp essays.",
  feat4_tracking: "\u{1F441}\u{FE0F} Client Visibility",
  feat4_tracking_desc: "Your client follows your pipeline and KPIs without needing an account. Total transparency, maximum trust.",
  feat5_title: "Calendar & Booking & Reminders",
  feat5_desc: "Connect your Google Calendar. Appointments and booking slots automatically appear in your Pipeline. Schedule call reminders directly from your pipeline.",
  feat5_tag1: "Bi-directional Sync",
  feat5_tag2: "Native integration",
  feat5_tag3: "Built-in reminders",
  feat6_title: "Auto Invoicing & Card Payments",
  feat6_desc: "Generate commission invoices in one click. Create secure card payment links and automatically send the invoice to your client.",
  feat7_title: "CRM Sync",
  feat7_desc: "Native sync with iClosed, HubSpot and Pipedrive. Forget double data entry and automate 100% of your follow-up.",
  feat8_title: "Call Room, your call cockpit",
  feat8_desc: "A dedicated call room that keeps everything in front of you while you close, and records the call to review it.",
  feat8_a_title: "\u{1F4DD} Live script",
  feat8_a_desc: "Your closing script laid out next to the call, so you never lose the thread.",
  feat8_b_title: "\u{1F381} Offer & resources",
  feat8_b_desc: "The offer, its plans and your resources one click away during the call.",
  feat8_c_title: "\u{1F3A5} Recording",
  feat8_c_desc: "Record the screen and audio of the call, exported as video to replay and improve.",
  feat9_title: "Automatic Follow-ups",
  feat9_desc: "Never lose a prospect again. Follow-up badges on your cards, configurable delays, and a daily digest email listing the follow-ups to do.",
  feat10_title: "Weekly Performance Report",
  feat10_desc: "Your week at a glance: revenue, deals won, calls held, closing rate, each compared to the previous week. In-app and by email every Monday.",
  feat11_title: "Duplicate Detection",
  feat11_desc: "CloseOS spots duplicate records (same email or phone) and merges them cleanly, side by side. Your database stays spotless.",
  feat12_title: "Per-Prospect Tasks",
  feat12_desc: "Attach tasks to each prospect with a due date, and find everything due today on your dashboard. Nothing slips through.",
  feat13_title: "Conversation Tracking & Reply Rate",
  feat13_desc: "A prospect finally replies? Hit \"Replied\": follow-ups pause and they count toward your real reply rate. CloseOS keeps the thread going for you.",
  feat13_a_title: "\u{2709}\u{FE0F} Replied",
  feat13_a_desc: "Marks the prospect as active, pauses follow-ups, and makes them count toward your reply rate.",
  feat13_b_title: "\u{1F504} Still talking?",
  feat13_b_desc: "A day later, CloseOS asks again: resume follow-ups, or qualify / disqualify the prospect.",
  feat13_c_title: "\u{1F4CB} To follow up & track",
  feat13_c_desc: "A dedicated work list: who to follow up today, and who replied and is waiting on you.",
  feat14_title: "\"Still talking?\" Digest",
  feat14_desc: "Every day at 5pm, a recap email lists the prospects who replied but where the conversation is stalling. You never let a warm thread die on its own again.",
  feat15_title: "Reminders at an Exact Time",
  feat15_desc: "Schedule a to-the-minute reminder on any prospect (\"call back tomorrow at 2:30pm\"). The due time shows on the record and surfaces in your daily list.",

  // Roadmap
  roadmap_badge: "Roadmap 2026",
  roadmap_title: "The Evolution of Closing",
  roadmap_subtitle: "Our vision to make CloseOS the go-to operating system for closers, agencies and online business owners.",
  roadmap_q1_title: "CloseOS Sales Launch",
  roadmap_q1_desc: "CRM, Pipeline, KPIs...",
  roadmap_q2_title: "CloseOS Business",
  roadmap_q2_desc: "The tool for online business owners, agencies, head of sales... Includes the full CRM.",
  roadmap_q2b_title: "Performance Reports",
  roadmap_q2b_desc: "Call feedback",
  roadmap_q3_title: "Mobile App",
  roadmap_q3_desc: "iOS & Android",
  roadmap_q4_title: "Internal Messaging",
  roadmap_q4_desc: "Built-in team chat",

  // Testimonials
  testimonials_title: "What our users say",
  testimonials_subtitle: "Closers and infopreneurs who transformed their daily workflow",

  // Comparison
  comp_title: "Closing without CloseOS vs with CloseOS",
  comp_subtitle: "Why stay buried in admin when one tool can automate everything?",
  comp_old_title: "The Hidden \"Obligations\"",
  comp_old1: "Juggling between CRMs (HubSpot...)",
  comp_old1_badge: "Mental load",
  comp_old2: "KPI reporting on Google Sheets",
  comp_old2_badge: "Manual entry",
  comp_old3: "Call analysis",
  comp_old3_badge: "Scattered data",
  comp_old4: "Commission invoicing",
  comp_old4_badge: "Delays & Oversights",
  comp_old5: "Weekly admin time",
  comp_old5_badge: "~5h wasted",
  comp_co2_old: "~150 kg",
  comp_co2_old_unit: "CO2 emitted / year",
  comp_co2_old_note: "(Multiple loaded interfaces + Servers + RAM)",
  comp_loss_label: "ESTIMATED LOSS",
  comp_loss_value: "10h",
  comp_loss_unit: "/week",
  comp_new_badge: "FOCUS ON CLOSING ONLY",
  comp_new_title: "The CloseOS Clarity",
  comp_roi_title: "Instant ROI",
  comp_roi_desc: "One extra deal per month easily pays for the tool for the entire year.",
  comp_brain_title: "Brain Freed",
  comp_brain_desc: "Zero manual entry. CRM, KPIs and Invoices update automatically after every call.",
  comp_pro_title: "100% Pro Image",
  comp_pro_desc: "Clean KPIs, one-click invoices, command dashboard. Work like the top 1%.",
  comp_co2_new: "~50 kg",
  comp_co2_new_unit: "CO2 emitted / year",
  comp_co2_new_note: "Save ~100 kg of CO2 per year. CloseOS uses drastically fewer server resources and battery than 10 tabs open at all times",
  comp_co2_tooltip: "Switching to CloseOS saves ~100 kg of CO2 per year per closer. That's the equivalent of 600 km of driving avoided, just by closing your tabs.",
  comp_pack_label: "Pro Pack",
  comp_pack_price_suffix: "/mo",
  comp_pack_tagline: "Get 1 hour of your life back / day",

  // Roles section
  roles_eyebrow: "Tailored to your role",
  roles_title: "One tool. Three ways to use it.",
  roles_subtitle: "Closer, Setter, or both? CloseOS automatically adapts your pipeline, KPIs and dashboard to your job.",
  role_closer_name: "Closer",
  role_closer_tag: "You close the deals",
  role_closer_desc: "Pipeline focused on conversion. Your KPIs measure what matters: closing rate, revenue, commissions.",
  role_closer_b1: "6-stage pipeline: Prospect → Qualified → Follow-up → Won...",
  role_closer_b2: "KPIs: Revenue, Conversion rate, Commissions, R2 closing...",
  role_closer_b3: "Dashboard: Cash generated, Commissions, Pipeline value...",
  role_closer_b4: "Call summaries, AI scripts, objection tracking...",
  role_setter_name: "Setter",
  role_setter_tag: "You book the meetings",
  role_setter_desc: "Extended pipeline with \"No Answer\" and \"Unqualified\" stages. KPIs tailored to measure your outreach.",
  role_setter_b1: "8-stage pipeline: + No Answer, Unqualified...",
  role_setter_b2: "Dedicated KPIs: Response rate, Booking rate...",
  role_setter_b3: "Dashboard: Contacted, Bookings, Meeting conversion...",
  role_setter_b4: "Setter KPI page with booking history per offer...",
  role_sc_name: "Setter + Closer",
  role_sc_tag: "You do both",
  role_sc_desc: "Best of both worlds. Two distinct KPI pages, two dashboard views, one complete pipeline.",
  role_sc_b1: "8-stage pipeline with all setter statuses",
  role_sc_b2: "2 KPI pages: Closer KPI + Setter KPI",
  role_sc_b3: "Dashboard with stacked Setter and Closer sections",
  role_sc_b4: "Clear tracking of your setter AND closer commissions",
  roles_footer: "Editable anytime from your settings, the app adapts instantly.",

  // Pricing
  pricing_title: "CloseOS Pricing, the all-in-one closer tool",
  pricing_subtitle: "One plan. Everything included. No commitment.",
  pricing_trial: "Try free for 10 days. No credit card required.",
  pricing_monthly: "Monthly",
  pricing_quarterly: "Quarterly",
  pricing_yearly: "Yearly",
  pricing_launch_badge: "\u{1F525} -51% LAUNCH OFFER",
  pricing_pack_name: "PRO PACK",
  pricing_pack_desc: "The all-in-one closer tool. Full & unlimited access.",
  pricing_billed_yearly: "Billed annually (\u{20AC}216/year)",
  pricing_billed_quarterly: "Billed quarterly (\u{20AC}60/quarter)",
  pricing_feat1_bold: "CRM & Pipeline",
  pricing_feat1_rest: " unlimited",
  pricing_feat2_bold: "Calendar & Booking",
  pricing_feat2_rest: " (Meeting links)",
  pricing_feat3: "Invoicing & Automatic Sending",
  pricing_feat4_bold: "Advanced KPIs",
  pricing_feat4_rest: " (Trends, Goals)",
  pricing_feat5_bold: "Call Room",
  pricing_feat5_rest: " (Scripts & Notes)",
  pricing_feat6_bold: "Automations",
  pricing_feat6_rest: " (CRM Sync, etc.)",
  pricing_feat7_bold: "Recording",
  pricing_feat7_rest: " Video/Audio",
  pricing_feat8: "Priority Support",
  pricing_cta: "Start for free",
  pricing_no_card: "No credit card required. 10 free days.",
  pricing_climate: "Every month, a share of our earnings funds CO2 removal.",
  pricing_close_comparison: "Close comparison",

  // FAQ
  faq_title: "Frequently Asked Questions",
  faq_subtitle: "Everything you need to know before getting started.",
  faq_what_q: "What is CloseOS Sales, exactly?",
  faq_what_a1: "It's the all-in-one software for independent closers. A single tool that brings together your CRM and visual pipeline, the Call Room (script, pitch, resources and note-taking during the call), automatic follow-ups, synced calendar and booking, invoicing and your closing KPIs.",
  faq_what_a2: "The idea: replace the 10 tools you juggle today with one cockpit, so you spend less time on admin and more time closing.",
  faq1_q: "Can I connect Calendly?",
  faq1_a1: "No, and that's by design. Calendly requires a paid subscription to enable integrations, a practice we find unfair. To give you the best experience at no extra cost, we integrated Cal.com (the Open Source standard).",
  faq1_a2: "The result: you get a high-performance booking system, synced with your calendar, without having to pay for a Calendly \"Pro\" plan just so it talks to your CRM.",
  faq2_q: "How does CloseOS contribute to the environment?",
  faq2_intro: "We champion \"Responsible Performance\". Here's how:",
  faq2_item1: "Digital sobriety: By replacing 10 tools with one, we reduce the server energy consumption required for your business.",
  faq2_item2: "Financial action: Every month, we give back a share of our earnings to fund cutting-edge CO2 removal technologies. Closing with us means contributing too.",
  faq3_q: "Why pay for CloseOS when I can do it myself on Excel/Notion?",
  faq3_a1: "Because the DIY approach costs you deals. Excel doesn't send automatic reminders, Notion doesn't generate meeting links or sync your calls.",
  faq3_a2: "CloseOS isn't just a note-taking tool, it's an active system that eliminates 80% of your admin work. The time you stop spending on configuring tools is time reinvested in closing deals.",
  faq5_q: "Is iClosed integrated?",
  faq5_a1: "Yes, and now with full bidirectional sync. Every prospect, deal or stage change added or updated on one side is instantly reflected on the other. No more double entry, no more drift.",
  faq5_a2: "In practice: your iClosed leads and sales flow automatically into CloseOS, and any update made in CloseOS (stage, tag, note, appointment) is pushed back to iClosed in real time. Keep your existing iClosed setup and gain the CloseOS cockpit on top, without friction.",
  faq_relance_q: "Does CloseOS handle my follow-ups and prospect tracking?",
  faq_relance_a1: "Yes, it's the very core of the product. You set your follow-up intervals once, and CloseOS chains the reminders on its own: every day you get the list of prospects to follow up. A \"Follow-up done\" button moves you to the next one.",
  faq_relance_a2: "When a prospect replies, you click \"Replied\": follow-ups pause and the prospect moves into discussion tracking (qualified, disqualified or still ongoing). The \"To follow up & track\" list shows at a glance who to chase and who you're in conversation with, so nothing ever slips through.",
  faq_security_q: "Is my data secure and GDPR-compliant?",
  faq_security_a: "Yes. CloseOS is GDPR-compliant, your data is hosted in the European Union, isolated and accessible only to you. You remain the owner of your data at all times and can export or delete it whenever you want.",

  // CTA Final
  cta_title_line1: "Stop paying for 10 tools.",
  cta_title_line2: "Start closing.",
  cta_subtitle: "Join the elite closers who use CloseOS, the all-in-one closing system.",
  cta_btn: "Start for free",
  cta_trial: "10-day free trial. No upfront payment.",

  // Partners
  nav_partners: "Partners",
  partners_badge: "Partnership",
  partners_title: "Become a CloseOS partner",
  partners_subtitle: "Two ways to collaborate with us and grow your business.",
  partners_integrate_title: "Partner",
  partners_integrate_desc: "Integrate CloseOS directly into your coaching or training offers.",
  partners_integrate_items: [
    "Ideal for trainers, coaches and agencies",
    "Include CloseOS in your courses or bundles",
    "Custom offer based on your volume",
    "Dedicated support for your clients",
  ],
  partners_integrate_cta: "Become a partner",
  partners_ambassador_title: "Ambassador",
  partners_ambassador_desc: "Share CloseOS with your audience and earn commissions.",
  partners_ambassador_items: [
    "Personalized referral link",
    "Recurring commissions on every sale",
    "Content kit provided",
    "Real-time tracking dashboard",
  ],
  partners_ambassador_cta: "Become an ambassador",

  // Founder
  founder_section_title: "The founder",
  founder_role: "Founder of CloseOS",
  founder_bio: "Before creating the CloseOS ecosystem, Thomas was a closer and setter. It was from working in the field that he experienced the daily reality of the job firsthand: working with at least 2 screens, juggling dozens of tools that don't even talk to each other, and wasting 1 to 1.5 hours every day just to keep everything updated. A CRM on one side, a booking tool on another, invoicing on a third, KPIs in a spreadsheet, all with zero synchronization. CloseOS was born from that frustration: a single tool that replaces all the others, built by a closer for closers.",

  // Footer
  footer_legal: "Legal Notice",
  footer_cgu: "Terms of Use",
  footer_cgv: "Terms of Sale",
  footer_privacy: "Privacy Policy",

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
}

export const salesTranslations: Record<SalesLang, SalesTranslations> = { fr, en }

export function detectSalesLang(): SalesLang {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Europe/Paris') return 'fr'
  } catch {}
  const browserLang = navigator.language || ''
  if (browserLang.startsWith('fr')) return 'fr'
  return 'en'
}
