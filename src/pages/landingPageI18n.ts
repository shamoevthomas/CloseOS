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

  // Banner
  banner: string

  // Navbar
  nav_features: string
  nav_integrations: string
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
  pricing_voip_option: string
  pricing_voip_soon: string
  pricing_close_comparison: string

  // FAQ
  faq_title: string
  faq_subtitle: string
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
  seo_title: "CloseOS Sales — CRM tout-en-un pour closers",
  seo_description: "CRM conçu pour les closers : pipeline visuel, callroom intégrée, facturation auto et KPIs en temps réel. Essai gratuit 20 jours.",

  // JSON-LD
  ld_description: "Le CRM pour closer en France. Pipeline de vente, VoIP intégré, suivi calls closing, agenda, facturation automatique et KPIs de closing. Logiciel closer high ticket tout-en-un.",
  ld_offers: "Essai gratuit 10 jours sans carte bancaire",
  ld_features: "CRM closer, Pipeline closer, VoIP intégré, Suivi calls closing, Agenda & booking, Facturation automatique closer, KPI closing, Gestion prospects closing, Visioconférence",
  ld_faq1_q: "Est-ce que je peux connecter Calendly à CloseOS ?",
  ld_faq1_a: "Non, et c'est un choix assumé. Calendly impose un abonnement payant pour les intégrations. CloseOS intègre Cal.com (référence Open Source) : un système de booking ultra-performant, synchronisé à votre agenda, sans surcoût.",
  ld_faq2_q: "Comment CloseOS s'engage pour l'environnement ?",
  ld_faq2_a: "CloseOS prône la Performance Responsable. Sobriété numérique : en remplaçant 10 outils par 1 seul, nous réduisons la consommation d'énergie serveur. Action financière : 1,5% de chaque abonnement est reversé via Stripe Climate pour financer l'élimination du CO2.",
  ld_faq3_q: "Pourquoi payer CloseOS plutôt qu'utiliser Excel ou Notion ?",
  ld_faq3_a: "Parce que le bricolage coûte des ventes. Excel n'envoie pas de rappels automatiques, Notion ne génère pas vos liens de visio ni ne synchronise vos appels. CloseOS est un système actif qui élimine 80% de l'administratif. Le temps gagné est réinvesti pour signer des contrats.",
  ld_faq4_q: "Est-ce que iClosed est intégré à CloseOS ?",
  ld_faq4_a: "Oui, en synchronisation bidirectionnelle complète. Tout prospect, deal ou changement de stage modifié d'un côté est reflété en temps réel de l'autre. Vos leads et ventes iClosed remontent dans CloseOS, et vos mises à jour CloseOS (stage, tag, note, RDV) sont repoussées vers iClosed automatiquement.",
  ld_faq5_q: "C'est quoi CloseOS Sales ?",
  ld_faq5_a: "CloseOS Sales est le logiciel tout-en-un pour closers high ticket et freelance en France. Il regroupe CRM closer, pipeline de vente visuel, VoIP intégré, suivi calls closing, agenda & booking, facturation automatique et KPIs de closing. C'est l'outil qui remplace 10 logiciels différents pour les closers indépendants.",

  // Banner
  banner: "\u{1F680} La V1 de CloseOS est officiellement lancée ! Testez gratuitement pendant 10 jours.",

  // Navbar
  nav_features: "Fonctionnalités",
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
  hero_subtitle: "Pipeline closer, VoIP intégré, agenda & booking, facturation automatique, KPIs de closing — le logiciel closer high ticket conçu pour les closers freelance en France. Gérez vos prospects closing, suivez vos calls et concentrez-vous sur ce qui rapporte.",
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
  features_subtitle: "CRM, pipeline, VoIP, agenda, facturation, KPIs — arrêtez de jongler entre les onglets. CloseOS centralise tout votre flux de travail pour que vous puissiez vous concentrer sur l'essentiel :",
  features_highlight: "vendre et closer.",
  feat1_title: "Cockpit & KPIs en Temps Réel",
  feat1_desc: "Votre centre de commandement. Visualisez instantanément vos commissions, votre taux de conversion, et votre pipeline. Si votre performance baisse, vous le voyez tout de suite.",
  feat1_item1: "Cash encaissé",
  feat1_item2: "Taux de closing",
  feat1_item3: "Commissions prévisionnelles",
  feat1_item4: "Deals en cours",
  feat2_title: "Téléphonie VoIP & Click-to-WhatsApp",
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

  // Roadmap
  roadmap_badge: "Roadmap 2026",
  roadmap_title: "L'Évolution du Closing",
  roadmap_subtitle: "Notre vision pour faire de CloseOS le système d'exploitation incontournable des closers et infopreneurs.",
  roadmap_q1_title: "Lancement CloseOS Sales",
  roadmap_q1_desc: "CRM, Pipeline, VoIP, KPIs...",
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
  comp_old3: "Analyse d'appels / VoIP",
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

  // Pricing
  pricing_title: "Tarifs CloseOS — l'outil tout-en-un des closers",
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
  pricing_climate: "1,5% de votre abonnement finance l'élimination du CO2 via Stripe Climate.",
  pricing_voip_option: "Option VoIP",
  pricing_voip_soon: "Arrive prochainement",
  pricing_close_comparison: "Fermer le comparatif",

  // FAQ
  faq_title: "Questions Fréquentes",
  faq_subtitle: "Tout ce que vous devez savoir avant de commencer.",
  faq1_q: "Est-ce que je peux connecter Calendly ?",
  faq1_a1: "Non, et c'est un choix assumé. Calendly impose un abonnement payant pour permettre les intégrations, une pratique que nous trouvons injuste. Pour vous offrir la meilleure expérience sans surcoût, nous avons intégré Cal.com (la référence Open Source).",
  faq1_a2: "Résultat : vous profitez d'un système de booking ultra-performant, synchronisé à votre agenda, sans avoir à payer un abonnement \"Pro\" à Calendly juste pour qu'il accepte de parler à votre CRM.",
  faq2_q: "Comment CloseOS s'engage pour l'environnement ?",
  faq2_intro: "Nous prônons la \"Performance Responsable\". Concrètement :",
  faq2_item1: "Sobriété numérique : En remplaçant 10 outils par 1 seul, nous réduisons la consommation d'énergie serveur nécessaire à votre activité.",
  faq2_item2: "Action financière : Nous reversons automatiquement 1,5% de votre abonnement via Stripe Climate pour financer des technologies de pointe d'élimination du CO2. Closer avec nous, c'est aussi contribuer.",
  faq3_q: "Pourquoi payer CloseOS alors que je peux le faire moi-même sur Excel/Notion ?",
  faq3_a1: "Parce que le \"bricolage\" vous coûte des ventes. Excel n'envoie pas de rappels automatiques, Notion ne génère pas vos liens de visio et ne synchronise pas vos appels.",
  faq3_a2: "CloseOS n'est pas un simple tableau de note, c'est un système actif qui élimine 80% de votre administratif. Le temps que vous ne passez plus à configurer vos outils est du temps réinvesti pour signer des contrats.",
  faq5_q: "Est-ce que iClosed est intégré ?",
  faq5_a1: "Oui, et désormais en synchronisation bidirectionnelle complète. Chaque prospect, deal ou changement de stage ajouté ou modifié d'un côté est instantanément reflété de l'autre — plus de double saisie, plus de désynchronisation.",
  faq5_a2: "Concrètement : vos leads et ventes iClosed remontent automatiquement dans CloseOS, et toute mise à jour faite dans CloseOS (stage, tag, note, RDV) est repoussée vers iClosed en temps réel. Vous gardez votre setup iClosed existant et vous gagnez le cockpit CloseOS par-dessus, sans friction.",

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
  founder_bio: "Avant de créer l'écosystème CloseOS, Thomas était closer et setter. C'est en étant sur le terrain qu'il a vu et subi la réalité du métier au quotidien : travailler avec minimum 2 écrans, jongler entre des dizaines d'outils qui ne communiquent même pas entre eux, et perdre 1h à 1h30 chaque jour juste pour tout mettre à jour. Un CRM d'un côté, un outil de booking de l'autre, la facturation sur un troisième, les KPIs sur un tableur — le tout sans aucune synchronisation. CloseOS est né de cette frustration : un seul outil qui remplace tous les autres, conçu par un closer pour les closers.",

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
  seo_title: "CloseOS Sales — All-in-One CRM for Closers",
  seo_description: "CRM built for closers: visual pipeline, built-in call room, automated invoicing & real-time KPIs. 20-day free trial.",

  // JSON-LD
  ld_description: "The CRM for closers. Sales pipeline, built-in VoIP, call tracking, calendar, automated invoicing and closing KPIs. All-in-one high-ticket closer software.",
  ld_offers: "10-day free trial, no credit card required",
  ld_features: "Closer CRM, Sales pipeline, Built-in VoIP, Call tracking, Calendar & booking, Automated invoicing, Closing KPIs, Prospect management, Video conferencing",
  ld_faq1_q: "Can I connect Calendly to CloseOS?",
  ld_faq1_a: "No, and that's by design. Calendly requires a paid subscription for integrations. CloseOS includes Cal.com (the Open Source standard): a high-performance booking system, synced to your calendar, at no extra cost.",
  ld_faq2_q: "How does CloseOS contribute to the environment?",
  ld_faq2_a: "CloseOS champions Responsible Performance. Digital sobriety: by replacing 10 tools with 1, we reduce server energy consumption. Financial action: 1.5% of every subscription is allocated via Stripe Climate to fund CO2 removal.",
  ld_faq3_q: "Why pay for CloseOS instead of using Excel or Notion?",
  ld_faq3_a: "Because DIY tools cost you deals. Excel doesn't send automatic reminders, Notion doesn't generate meeting links or sync your calls. CloseOS is an active system that eliminates 80% of admin work. The time saved is reinvested in closing contracts.",
  ld_faq4_q: "Is iClosed integrated with CloseOS?",
  ld_faq4_a: "Yes, with full bidirectional sync. Every prospect, deal or stage change updated on one side is reflected on the other in real time. Your iClosed leads and sales flow into CloseOS, and your CloseOS updates (stage, tag, note, appointment) are pushed back to iClosed automatically.",
  ld_faq5_q: "What is CloseOS Sales?",
  ld_faq5_a: "CloseOS Sales is the all-in-one software for high-ticket and freelance closers. It combines closer CRM, visual sales pipeline, built-in VoIP, call tracking, calendar & booking, automated invoicing and closing KPIs. It's the tool that replaces 10 different pieces of software for independent closers.",

  // Banner
  banner: "\u{1F680} CloseOS V1 is officially live! Try it free for 10 days.",

  // Navbar
  nav_features: "Features",
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
  hero_subtitle: "Closer pipeline, built-in VoIP, calendar & booking, automated invoicing, closing KPIs — the high-ticket closer software built for freelance closers. Manage your prospects, track your calls and focus on what makes money.",
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
  features_subtitle: "CRM, pipeline, VoIP, calendar, invoicing, KPIs — stop juggling between tabs. CloseOS centralizes your entire workflow so you can focus on what matters:",
  features_highlight: "selling and closing.",
  feat1_title: "Cockpit & Real-Time KPIs",
  feat1_desc: "Your command center. Instantly see your commissions, conversion rate and pipeline. If your performance dips, you'll know right away.",
  feat1_item1: "Cash collected",
  feat1_item2: "Closing rate",
  feat1_item3: "Projected commissions",
  feat1_item4: "Deals in progress",
  feat2_title: "VoIP Calling & Click-to-WhatsApp",
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

  // Roadmap
  roadmap_badge: "Roadmap 2026",
  roadmap_title: "The Evolution of Closing",
  roadmap_subtitle: "Our vision to make CloseOS the go-to operating system for closers, agencies and online business owners.",
  roadmap_q1_title: "CloseOS Sales Launch",
  roadmap_q1_desc: "CRM, Pipeline, VoIP, KPIs...",
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
  comp_old3: "Call analysis / VoIP",
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

  // Pricing
  pricing_title: "CloseOS Pricing — the all-in-one closer tool",
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
  pricing_climate: "1.5% of your subscription funds CO2 removal via Stripe Climate.",
  pricing_voip_option: "VoIP Option",
  pricing_voip_soon: "Coming soon",
  pricing_close_comparison: "Close comparison",

  // FAQ
  faq_title: "Frequently Asked Questions",
  faq_subtitle: "Everything you need to know before getting started.",
  faq1_q: "Can I connect Calendly?",
  faq1_a1: "No, and that's by design. Calendly requires a paid subscription to enable integrations, a practice we find unfair. To give you the best experience at no extra cost, we integrated Cal.com (the Open Source standard).",
  faq1_a2: "The result: you get a high-performance booking system, synced with your calendar, without having to pay for a Calendly \"Pro\" plan just so it talks to your CRM.",
  faq2_q: "How does CloseOS contribute to the environment?",
  faq2_intro: "We champion \"Responsible Performance\". Here's how:",
  faq2_item1: "Digital sobriety: By replacing 10 tools with one, we reduce the server energy consumption required for your business.",
  faq2_item2: "Financial action: We automatically allocate 1.5% of your subscription via Stripe Climate to fund cutting-edge CO2 removal technologies. Closing with us means contributing too.",
  faq3_q: "Why pay for CloseOS when I can do it myself on Excel/Notion?",
  faq3_a1: "Because the DIY approach costs you deals. Excel doesn't send automatic reminders, Notion doesn't generate meeting links or sync your calls.",
  faq3_a2: "CloseOS isn't just a note-taking tool, it's an active system that eliminates 80% of your admin work. The time you stop spending on configuring tools is time reinvested in closing deals.",
  faq5_q: "Is iClosed integrated?",
  faq5_a1: "Yes — and now with full bidirectional sync. Every prospect, deal or stage change added or updated on one side is instantly reflected on the other. No more double entry, no more drift.",
  faq5_a2: "In practice: your iClosed leads and sales flow automatically into CloseOS, and any update made in CloseOS (stage, tag, note, appointment) is pushed back to iClosed in real time. Keep your existing iClosed setup and gain the CloseOS cockpit on top, without friction.",

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
  founder_bio: "Before creating the CloseOS ecosystem, Thomas was a closer and setter. It was from working in the field that he experienced the daily reality of the job firsthand: working with at least 2 screens, juggling dozens of tools that don't even talk to each other, and wasting 1 to 1.5 hours every day just to keep everything updated. A CRM on one side, a booking tool on another, invoicing on a third, KPIs in a spreadsheet — all with zero synchronization. CloseOS was born from that frustration: a single tool that replaces all the others, built by a closer for closers.",

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
