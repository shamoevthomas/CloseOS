// Capture Form i18n — auto-detects language from URL param, parent page, or browser
export type CaptureFormLang = 'fr' | 'en'

export interface CaptureFormTranslations {
  // Months
  months: string[]
  // Day initials (Mon-Sun)
  days: string[]
  // Not found
  not_found_title: string
  not_found_text: string
  // Success
  success_title: string
  success_inscription: string
  success_rdv: string
  success_confirmed: string
  success_redirect: string
  success_email: string
  // Fallback titles
  fallback_title: string
  // Powered by
  powered_by: string
  powered_by_footer: string
  // Info section
  modify: string
  step1_title: string
  label_firstname: string
  label_lastname: string
  label_email: string
  label_phone: string
  placeholder_firstname: string
  placeholder_lastname: string
  email_invalid: string
  search_country: string
  select_placeholder: string
  continue_btn: string
  // Inscription mode
  inscribe_btn: string
  consent_text: string
  // Calendar
  step2_title: string
  change_date: string
  available_slots: string
  no_slots: string
  select_date: string
  loading_slots: string
  // Submit
  confirm_rdv: string
  // Errors
  error_generic: string
  error_network: string
  // Lock overlay
  fill_info: string
  // Date format locale
  date_locale: string
  // "at" for time
  at_time: string
  // Questionnaire
  questionnaire_title: string
  questionnaire_skip: string
  questionnaire_complete: string
  // Disqualification
  disqualified_title: string
  disqualified_text: string
}

const fr: CaptureFormTranslations = {
  months: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  days: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  not_found_title: 'Campagne introuvable',
  not_found_text: "Ce lien de capture n'est plus actif ou n'existe pas.",
  success_title: 'Merci !',
  success_inscription: 'Votre inscription a bien été enregistrée.',
  success_rdv: 'Votre demande a bien été envoyée.',
  success_confirmed: 'Rendez-vous confirmé',
  success_redirect: 'Vous allez être redirigé...',
  success_email: 'Vous recevrez une confirmation par email.',
  fallback_title: 'Prenez rendez-vous',
  powered_by: 'Propulsé par',
  powered_by_footer: 'Propulsé par CloseOS Business',
  modify: 'Modifier',
  step1_title: 'Informations personnelles',
  label_firstname: 'Prénom',
  label_lastname: 'Nom',
  label_email: 'Email',
  label_phone: 'Téléphone',
  placeholder_firstname: 'Jean',
  placeholder_lastname: 'Dupont',
  email_invalid: 'Veuillez entrer une adresse email valide',
  search_country: 'Rechercher un pays...',
  select_placeholder: 'Sélectionner...',
  continue_btn: 'Continuer',
  inscribe_btn: "S'inscrire",
  consent_text: "En continuant, vous acceptez d'être recontacté(e) et que vos informations soient enregistrées dans notre base de données.",
  step2_title: 'Choisissez un créneau',
  change_date: 'Changer de date',
  available_slots: 'Créneaux disponibles',
  no_slots: 'Aucun créneau disponible ce jour. Essayez une autre date.',
  select_date: 'Sélectionnez une date pour voir les créneaux.',
  loading_slots: 'Chargement des disponibilités...',
  confirm_rdv: 'Confirmer le rendez-vous',
  error_generic: 'Une erreur est survenue',
  error_network: 'Erreur réseau',
  fill_info: 'Remplissez vos informations pour continuer',
  date_locale: 'fr-FR',
  at_time: 'à',
  questionnaire_title: 'Quelques questions',
  questionnaire_skip: 'Passer et choisir un créneau',
  questionnaire_complete: 'Questionnaire complété',
  disqualified_title: 'Merci pour vos réponses',
  disqualified_text: 'Malheureusement, votre profil ne correspond pas à nos critères actuels. Nous vous souhaitons bonne chance dans vos démarches.',
}

const en: CaptureFormTranslations = {
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  not_found_title: 'Campaign not found',
  not_found_text: 'This capture link is no longer active or does not exist.',
  success_title: 'Thank you!',
  success_inscription: 'Your registration has been submitted.',
  success_rdv: 'Your request has been sent.',
  success_confirmed: 'Appointment confirmed',
  success_redirect: 'You will be redirected shortly...',
  success_email: 'You will receive a confirmation by email.',
  fallback_title: 'Book an appointment',
  powered_by: 'Powered by',
  powered_by_footer: 'Powered by CloseOS Business',
  modify: 'Edit',
  step1_title: 'Personal information',
  label_firstname: 'First name',
  label_lastname: 'Last name',
  label_email: 'Email',
  label_phone: 'Phone',
  placeholder_firstname: 'John',
  placeholder_lastname: 'Smith',
  email_invalid: 'Please enter a valid email address',
  search_country: 'Search a country...',
  select_placeholder: 'Select...',
  continue_btn: 'Continue',
  inscribe_btn: 'Sign up',
  consent_text: 'By continuing, you agree to be contacted and that your information will be stored in our database.',
  step2_title: 'Choose a time slot',
  change_date: 'Change date',
  available_slots: 'Available slots',
  no_slots: 'No slots available for this day. Try another date.',
  select_date: 'Select a date to see available slots.',
  loading_slots: 'Loading availability...',
  confirm_rdv: 'Confirm appointment',
  error_generic: 'An error occurred',
  error_network: 'Network error',
  fill_info: 'Fill in your information to continue',
  date_locale: 'en-US',
  at_time: 'at',
  questionnaire_title: 'A few questions',
  questionnaire_skip: 'Skip and choose a time slot',
  questionnaire_complete: 'Questionnaire completed',
  disqualified_title: 'Thank you for your answers',
  disqualified_text: 'Unfortunately, your profile does not match our current criteria. We wish you the best of luck.',
}

export const captureTranslations: Record<CaptureFormLang, CaptureFormTranslations> = { fr, en }

/**
 * Detect language for the capture form:
 * 1. URL param `lang=fr|en`
 * 2. Parent page <html lang="..."> (via postMessage or document)
 * 3. Browser language / timezone
 * 4. Default: non-French → English
 */
export function detectCaptureLang(searchParams: URLSearchParams): CaptureFormLang {
  // 1. Explicit URL param
  const paramLang = searchParams.get('lang')
  if (paramLang === 'fr') return 'fr'
  if (paramLang) return 'en' // any non-fr value → english

  // 2. Check if embedded — try to read parent document lang (same-origin only)
  try {
    if (window.parent !== window) {
      const parentLang = window.parent.document.documentElement.lang
      if (parentLang) {
        return parentLang.startsWith('fr') ? 'fr' : 'en'
      }
    }
  } catch {
    // Cross-origin — can't access parent, fall through
  }

  // 3. Check current page html lang (set by host site)
  const htmlLang = document.documentElement.lang
  if (htmlLang) {
    return htmlLang.startsWith('fr') ? 'fr' : 'en'
  }

  // 4. Browser timezone + language
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz === 'Europe/Paris') return 'fr'
  } catch {}
  const browserLang = navigator.language || ''
  if (browserLang.startsWith('fr')) return 'fr'

  return 'en'
}
