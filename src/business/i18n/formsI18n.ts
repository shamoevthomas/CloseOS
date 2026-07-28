// Traductions de la feature « Formulaires » (Business).
// Module dédié, sur le modèle de landingPageI18n / captureFormI18n, pour ne pas
// alourdir translations.ts.

export interface FormsTranslations {
  // Liste
  title: string
  subtitle: string
  new_form: string
  empty_title: string
  empty_desc: string
  create_first: string
  responses: string
  response_one: string
  response_many: string
  active: string
  inactive: string
  edit: string
  duplicate: string
  delete: string
  delete_confirm: string
  open_responses: string
  copy_link: string
  link_copied: string
  preview: string
  untitled: string
  new_form_name: string

  // Erreurs de chargement
  load_error_title: string
  load_error_desc: string
  api_missing_title: string
  api_missing_desc: string
  retry: string

  // Éditeur
  back: string
  saving: string
  saved: string
  save_error: string
  tab_content: string
  tab_settings: string
  tab_crm: string
  tab_share: string
  form_name: string
  form_description: string

  // Réglages
  settings_submit_label: string
  settings_thankyou: string
  settings_thankyou_title: string
  settings_thankyou_text: string
  settings_redirect: string
  settings_redirect_hint: string
  settings_display: string
  settings_progress: string
  settings_progress_hint: string
  settings_one_at_a_time: string
  settings_one_at_a_time_hint: string
  settings_accent: string

  // CRM
  crm_enable: string
  crm_enable_hint: string
  crm_mapping: string
  crm_mapping_hint: string
  crm_field_name: string
  crm_field_email: string
  crm_field_phone: string
  crm_none: string
  crm_source: string
  crm_source_hint: string
  crm_stage: string
  crm_campaign: string
  crm_campaign_none: string
  crm_no_fields: string

  // Notifications
  notify_title: string
  notify_enable: string
  notify_enable_hint: string
  notify_email: string
  notify_email_hint: string

  // Partage
  share_link: string
  share_link_hint: string
  share_embed: string
  share_embed_hint: string
  share_popup: string
  share_inactive_warning: string
  copy: string
  copied: string
}

export const formsFr: FormsTranslations = {
  title: 'Formulaires',
  subtitle: 'Créez des formulaires sur mesure et collectez les réponses, avec ou sans création de prospect.',
  new_form: 'Nouveau formulaire',
  empty_title: 'Aucun formulaire',
  empty_desc: 'Créez votre premier formulaire : sondage, candidature, brief client, feedback…',
  create_first: 'Créer un formulaire',
  responses: 'Réponses',
  response_one: 'réponse',
  response_many: 'réponses',
  active: 'Actif',
  inactive: 'Inactif',
  edit: 'Modifier',
  duplicate: 'Dupliquer',
  delete: 'Supprimer',
  delete_confirm: 'Supprimer ce formulaire et toutes ses réponses ? Cette action est définitive.',
  open_responses: 'Voir les réponses',
  copy_link: 'Copier le lien',
  link_copied: 'Lien copié',
  preview: 'Aperçu',
  untitled: 'Sans titre',
  new_form_name: 'Formulaire sans titre',

  load_error_title: 'Chargement impossible',
  load_error_desc: 'Les formulaires n\'ont pas pu être récupérés. Réessayez dans un instant.',
  api_missing_title: 'API des formulaires indisponible',
  api_missing_desc: 'La route /api/business-forms ne répond pas encore. En développement, /api est proxifié vers la production : cette page ne fonctionnera qu\'une fois le déploiement effectué.',
  retry: 'Réessayer',

  back: 'Retour',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  save_error: 'Échec de l\'enregistrement',
  tab_content: 'Contenu',
  tab_settings: 'Réglages',
  tab_crm: 'CRM',
  tab_share: 'Partage',
  form_name: 'Nom du formulaire',
  form_description: 'Description (affichée sous le titre)',

  settings_submit_label: 'Libellé du bouton d\'envoi',
  settings_thankyou: 'Après l\'envoi',
  settings_thankyou_title: 'Titre de la page de remerciement',
  settings_thankyou_text: 'Message de remerciement',
  settings_redirect: 'Rediriger vers une URL',
  settings_redirect_hint: 'Si renseignée, remplace la page de remerciement.',
  settings_display: 'Affichage',
  settings_progress: 'Barre de progression',
  settings_progress_hint: 'Visible uniquement sur les formulaires à plusieurs étapes.',
  settings_one_at_a_time: 'Une question à la fois',
  settings_one_at_a_time_hint: 'Chaque question occupe son propre écran.',
  settings_accent: 'Couleur d\'accent',

  crm_enable: 'Créer un prospect à chaque réponse',
  crm_enable_hint: 'La réponse alimente votre CRM. Désactivé, elle reste une simple collecte.',
  crm_mapping: 'Correspondance des champs',
  crm_mapping_hint: 'Indiquez quelle question alimente quelle information du prospect.',
  crm_field_name: 'Nom du contact',
  crm_field_email: 'Email',
  crm_field_phone: 'Téléphone',
  crm_none: 'Aucun',
  crm_source: 'Source',
  crm_source_hint: 'Par défaut, le nom du formulaire.',
  crm_stage: 'Étape d\'entrée dans le pipeline',
  crm_campaign: 'Rattacher à une campagne',
  crm_campaign_none: 'Aucune campagne',
  crm_no_fields: 'Ajoutez d\'abord des champs à votre formulaire pour pouvoir les associer.',

  notify_title: 'Notifications',
  notify_enable: 'Recevoir un email à chaque réponse',
  notify_enable_hint: 'Un récapitulatif des réponses vous est envoyé.',
  notify_email: 'Adresse de réception',
  notify_email_hint: 'Laissez vide pour utiliser l\'email de votre compte.',

  share_link: 'Lien public',
  share_link_hint: 'Partagez ce lien pour collecter des réponses.',
  share_embed: 'Intégration (iframe)',
  share_embed_hint: 'Collez ce code sur votre site pour afficher le formulaire.',
  share_popup: 'Ouverture en popup',
  share_inactive_warning: 'Ce formulaire est inactif : le lien affiche un message d\'indisponibilité.',
  copy: 'Copier',
  copied: 'Copié',
}

export const formsEn: FormsTranslations = {
  title: 'Forms',
  subtitle: 'Build custom forms and collect responses, with or without creating a prospect.',
  new_form: 'New form',
  empty_title: 'No forms yet',
  empty_desc: 'Create your first form: survey, application, client brief, feedback…',
  create_first: 'Create a form',
  responses: 'Responses',
  response_one: 'response',
  response_many: 'responses',
  active: 'Active',
  inactive: 'Inactive',
  edit: 'Edit',
  duplicate: 'Duplicate',
  delete: 'Delete',
  delete_confirm: 'Delete this form and all its responses? This cannot be undone.',
  open_responses: 'View responses',
  copy_link: 'Copy link',
  link_copied: 'Link copied',
  preview: 'Preview',
  untitled: 'Untitled',
  new_form_name: 'Untitled form',

  load_error_title: 'Could not load',
  load_error_desc: 'Forms could not be retrieved. Please try again in a moment.',
  api_missing_title: 'Forms API unavailable',
  api_missing_desc: 'The /api/business-forms route is not responding yet. In development, /api is proxied to production: this page will only work once deployed.',
  retry: 'Retry',

  back: 'Back',
  saving: 'Saving…',
  saved: 'Saved',
  save_error: 'Could not save',
  tab_content: 'Content',
  tab_settings: 'Settings',
  tab_crm: 'CRM',
  tab_share: 'Share',
  form_name: 'Form name',
  form_description: 'Description (shown below the title)',

  settings_submit_label: 'Submit button label',
  settings_thankyou: 'After submission',
  settings_thankyou_title: 'Thank-you page title',
  settings_thankyou_text: 'Thank-you message',
  settings_redirect: 'Redirect to a URL',
  settings_redirect_hint: 'When set, replaces the thank-you page.',
  settings_display: 'Display',
  settings_progress: 'Progress bar',
  settings_progress_hint: 'Only shown on multi-step forms.',
  settings_one_at_a_time: 'One question at a time',
  settings_one_at_a_time_hint: 'Each question gets its own screen.',
  settings_accent: 'Accent colour',

  crm_enable: 'Create a prospect for each response',
  crm_enable_hint: 'Responses feed your CRM. When off, they stay a plain collection.',
  crm_mapping: 'Field mapping',
  crm_mapping_hint: 'Tell us which question fills which prospect field.',
  crm_field_name: 'Contact name',
  crm_field_email: 'Email',
  crm_field_phone: 'Phone',
  crm_none: 'None',
  crm_source: 'Source',
  crm_source_hint: 'Defaults to the form name.',
  crm_stage: 'Pipeline entry stage',
  crm_campaign: 'Attach to a campaign',
  crm_campaign_none: 'No campaign',
  crm_no_fields: 'Add fields to your form first so they can be mapped.',

  notify_title: 'Notifications',
  notify_enable: 'Email me on every response',
  notify_enable_hint: 'You receive a summary of the answers.',
  notify_email: 'Recipient address',
  notify_email_hint: 'Leave empty to use your account email.',

  share_link: 'Public link',
  share_link_hint: 'Share this link to collect responses.',
  share_embed: 'Embed (iframe)',
  share_embed_hint: 'Paste this code on your site to display the form.',
  share_popup: 'Open as popup',
  share_inactive_warning: 'This form is inactive: the link shows an unavailable message.',
  copy: 'Copy',
  copied: 'Copied',
}

export function getFormsTranslations(lang: string): FormsTranslations {
  return lang === 'en' ? formsEn : formsFr
}
