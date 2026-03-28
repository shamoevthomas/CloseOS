export type EcoLang = 'fr' | 'en'

export interface EcoTranslations {
  // SEO
  seo_title: string
  seo_description: string

  // JSON-LD
  ld_org_description: string
  ld_sales_description: string
  ld_sales_offers: string
  ld_sales_features: string
  ld_business_description: string
  ld_business_offers: string
  ld_business_features: string

  // Header
  badge: string
  title_line1: string
  title_line2: string
  subtitle: string

  // Card Sales
  sales_tag: string
  sales_description: string
  sales_feat1: string
  sales_feat2: string
  sales_feat3: string
  sales_feat4: string
  sales_cta: string

  // Card Business
  business_new: string
  business_tag: string
  business_description: string
  business_feat1: string
  business_feat2: string
  business_feat3: string
  business_feat4: string
  business_cta: string

  // Definition section
  def_title: string
  def_intro: string
  def_intro_bold: string
  def_sales_title: string
  def_sales_text: string
  def_business_title: string
  def_business_text: string

  // Footer
  footer_legal: string
  footer_cgu: string
  footer_cgv: string
  footer_privacy: string
  footer_business_policy: string
}

const fr: EcoTranslations = {
  seo_title: "CloseOS — L'écosystème SaaS pour la vente digitale",
  seo_description: "CRM pour closers et plateforme de management pour infopreneurs. Pipeline, callroom, KPIs, facturation auto. Essai gratuit 20 jours.",

  ld_org_description: "Écosystème SaaS français pour la vente digitale. Outils pour closers indépendants et infopreneurs francophones.",
  ld_sales_description: "CRM pour closer, pipeline de vente, VoIP intégré, agenda, facturation automatique et KPIs de closing. Le logiciel tout-en-un des closers high ticket francophones.",
  ld_sales_offers: "Essai gratuit 10 jours, sans carte bancaire",
  ld_sales_features: "CRM closer, Pipeline visuel, VoIP intégré, Agenda & booking, Facturation automatique, KPIs de closing, Suivi calls closing",
  ld_business_description: "Plateforme de management pour infopreneurs et Head of Sales. Gestion d'équipe de closers et setters, pilotage campagnes d'acquisition, tableau de bord analytics. Alternative iClosed.",
  ld_business_offers: "Liste d'attente — tarifs early adopters",
  ld_business_features: "Gestion équipe closers, Pilotage campagnes acquisition, CRM acquisition infopreneur, Tableau de bord infopreneur, KPIs d'équipe, Onboarding closers",

  badge: "Écosystème SaaS vente digitale francophone",
  title_line1: "Le logiciel pour closers",
  title_line2: "et infopreneurs",
  subtitle: "CRM closer, pipeline de vente, VoIP et KPIs de closing pour closers freelance. Management d'équipe de closers, campagnes d'acquisition et tableau de bord analytics pour infopreneurs. L'alternative francophone à iClosed.",

  sales_tag: "Outil pour Closers & Setters",
  sales_description: "Le logiciel tout-en-un pour closers high ticket et setters freelance. Gérez vos prospects closing, suivez vos calls et automatisez votre facturation.",
  sales_feat1: "CRM closer & pipeline visuel",
  sales_feat2: "VoIP intégré & suivi calls closing",
  sales_feat3: "Facturation auto & KPIs closing",
  sales_feat4: "Agenda & booking intégré",
  sales_cta: "Accéder",

  business_new: "Nouveau",
  business_tag: "Logiciel Infopreneur & Head of Sales",
  business_description: "Gérez votre équipe de closers et setters, pilotez vos campagnes d'acquisition et suivez la performance avec un tableau de bord infopreneur complet. L'alternative à iClosed.",
  business_feat1: "Gestion équipe closers & setters",
  business_feat2: "Pilotage campagnes acquisition",
  business_feat3: "CRM acquisition & intégrations",
  business_feat4: "Tableau de bord & KPIs d'équipe",
  business_cta: "Accéder",

  def_title: "Qu'est-ce que CloseOS ?",
  def_intro: "CloseOS est un <strong>écosystème SaaS français pour la vente digitale</strong>. Il regroupe deux outils complémentaires conçus pour les professionnels du closing francophone.",
  def_intro_bold: "écosystème SaaS français pour la vente digitale",
  def_sales_title: "CloseOS Sales — L'outil pour closer",
  def_sales_text: "Le CRM pour closer en France. Pipeline de vente visuel, VoIP intégré, suivi calls closing, agenda & booking, facturation automatique et KPIs de closing. L'application closer freelance tout-en-un pour gérer ses prospects et closer du high ticket. Essai gratuit 10 jours.",
  def_business_title: "CloseOS Business — Le logiciel infopreneur",
  def_business_text: "La plateforme pour gérer une équipe de closers et setters. Pilotage équipe closing, CRM acquisition infopreneur, campagnes d'acquisition, tableau de bord infopreneur et KPIs d'équipe. L'alternative française à iClosed pour les infopreneurs et Head of Sales.",

  footer_legal: "Mentions Légales",
  footer_cgu: "CGU",
  footer_cgv: "CGV",
  footer_privacy: "Politique de Confidentialite",
  footer_business_policy: "Politique d'Utilisation Business",
}

const en: EcoTranslations = {
  seo_title: "CloseOS — The SaaS Ecosystem for Digital Sales",
  seo_description: "CRM for closers and management platform for infopreneurs. Pipeline, call room, KPIs, automated invoicing. 20-day free trial.",

  ld_org_description: "SaaS ecosystem for digital sales. Tools for independent closers and online business owners.",
  ld_sales_description: "CRM for closers, sales pipeline, built-in VoIP, calendar, automated invoicing and closing KPIs. The all-in-one software for high-ticket closers.",
  ld_sales_offers: "10-day free trial, no credit card required",
  ld_sales_features: "Closer CRM, Visual pipeline, Built-in VoIP, Calendar & booking, Automated invoicing, Closing KPIs, Call tracking",
  ld_business_description: "Management platform for online business owners and Head of Sales. Closer & setter team management, acquisition campaigns, analytics dashboard.",
  ld_business_offers: "Waitlist — early adopter pricing",
  ld_business_features: "Closer team management, Acquisition campaigns, Acquisition CRM, Analytics dashboard, Team KPIs, Closer onboarding",

  badge: "SaaS ecosystem for digital sales",
  title_line1: "The software for closers",
  title_line2: "and business owners",
  subtitle: "Closer CRM, sales pipeline, VoIP and closing KPIs for freelance closers. Team management, acquisition campaigns and analytics dashboard for business owners. The modern alternative to iClosed.",

  sales_tag: "Tool for Closers & Setters",
  sales_description: "The all-in-one software for high-ticket closers and freelance setters. Manage your closing prospects, track your calls and automate your invoicing.",
  sales_feat1: "Closer CRM & visual pipeline",
  sales_feat2: "Built-in VoIP & call tracking",
  sales_feat3: "Automated invoicing & closing KPIs",
  sales_feat4: "Built-in calendar & booking",
  sales_cta: "Get started",

  business_new: "New",
  business_tag: "For Business Owners & Head of Sales",
  business_description: "Manage your closer and setter team, run your acquisition campaigns and track performance with a comprehensive analytics dashboard.",
  business_feat1: "Closer & setter team management",
  business_feat2: "Acquisition campaign management",
  business_feat3: "Acquisition CRM & integrations",
  business_feat4: "Dashboard & team KPIs",
  business_cta: "Get started",

  def_title: "What is CloseOS?",
  def_intro: "CloseOS is a <strong>SaaS ecosystem for digital sales</strong>. It combines two complementary tools designed for sales professionals.",
  def_intro_bold: "SaaS ecosystem for digital sales",
  def_sales_title: "CloseOS Sales — The closer tool",
  def_sales_text: "The CRM for closers. Visual sales pipeline, built-in VoIP, call tracking, calendar & booking, automated invoicing and closing KPIs. The all-in-one freelance closer app to manage prospects and close high-ticket deals. 10-day free trial.",
  def_business_title: "CloseOS Business — Team management software",
  def_business_text: "The platform to manage a team of closers and setters. Closing team management, acquisition CRM, acquisition campaigns, analytics dashboard and team KPIs. The modern alternative to iClosed for business owners and Head of Sales.",

  footer_legal: "Legal Notice",
  footer_cgu: "Terms of Use",
  footer_cgv: "Terms of Sale",
  footer_privacy: "Privacy Policy",
  footer_business_policy: "Business Usage Policy",
}

export const ecoTranslations: Record<EcoLang, EcoTranslations> = { fr, en }

export function detectEcoLang(): EcoLang {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Europe/Paris') return 'fr'
  } catch {}
  const browserLang = navigator.language || ''
  if (browserLang.startsWith('fr')) return 'fr'
  return 'en'
}
