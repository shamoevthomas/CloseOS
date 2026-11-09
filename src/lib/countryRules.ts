// Règles de facturation par pays, partagées par CloseOS Sales, CloseOS Business et la génération automatique des
// factures (api/cron). Un seul endroit décide : quel numéro d'entreprise demander, quel nom de taxe et quel taux,
// et quelle mention légale imprimer quand la facture ne porte pas de taxe.
//
// Rétrocompatibilité : les anciennes données stockent le pays en toutes lettres ("France", "Belgique"…).
// normalizeCountry() accepte un code (FR, BE, CA-QC…) ou un nom, et renvoie toujours un code connu.

export type CountryCode =
  | 'FR' | 'BE' | 'CH' | 'LU' | 'MC' | 'CA-QC' | 'CA' | 'MA' | 'TN' | 'DZ' | 'SN' | 'CI' | 'GB' | 'US' | 'AE' | 'GE' | 'OTHER'

type L = { fr: string; en: string }

export interface CountryRule {
  code: CountryCode
  name: L
  flag: string
  inEU: boolean
  /** Numéro d'identification de l'entreprise (SIRET, BCE, IDE, NEQ…). null = aucun numéro attendu. */
  companyId: { label: L; placeholder: string } | null
  /** Taxe sur la valeur ajoutée (TVA, TPS/TVQ, VAT…). null = pas de taxe de ce type sur les services. */
  tax: { label: L; rate: number; numberLabel: L; numberPlaceholder: string } | null
  /** Mention quand l'émetteur ne facture pas de taxe sur une vente dans son propre pays (franchise, petit fournisseur…). */
  exemptMention: L | null
  /** Indemnité forfaitaire de recouvrement de 40 € (France) à afficher sur les factures entre professionnels. */
  frenchLatePenalty: boolean
}

const R = (r: CountryRule) => r

export const COUNTRY_RULES: Record<CountryCode, CountryRule> = {
  FR: R({
    code: 'FR', name: { fr: 'France', en: 'France' }, flag: '🇫🇷', inEU: true,
    companyId: { label: { fr: 'SIRET', en: 'SIRET' }, placeholder: '123 456 789 00012' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.2, numberLabel: { fr: 'N° de TVA', en: 'VAT number' }, numberPlaceholder: 'FR12345678901' },
    exemptMention: { fr: 'TVA non applicable, art. 293 B du CGI', en: 'VAT not applicable, art. 293 B of the French General Tax Code' },
    frenchLatePenalty: true,
  }),
  BE: R({
    code: 'BE', name: { fr: 'Belgique', en: 'Belgium' }, flag: '🇧🇪', inEU: true,
    companyId: { label: { fr: "N° d'entreprise (BCE)", en: 'Company number (BCE/KBO)' }, placeholder: '0123.456.789' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.21, numberLabel: { fr: 'N° de TVA', en: 'VAT number' }, numberPlaceholder: 'BE0123456789' },
    exemptMention: { fr: 'Régime particulier de la franchise de taxe', en: 'Special VAT exemption scheme for small businesses' },
    frenchLatePenalty: false,
  }),
  CH: R({
    code: 'CH', name: { fr: 'Suisse', en: 'Switzerland' }, flag: '🇨🇭', inEU: false,
    companyId: { label: { fr: 'IDE', en: 'UID (IDE)' }, placeholder: 'CHE-123.456.789' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.081, numberLabel: { fr: 'N° de TVA', en: 'VAT number' }, numberPlaceholder: 'CHE-123.456.789 TVA' },
    exemptMention: { fr: 'Non assujetti à la TVA', en: 'Not registered for VAT' },
    frenchLatePenalty: false,
  }),
  LU: R({
    code: 'LU', name: { fr: 'Luxembourg', en: 'Luxembourg' }, flag: '🇱🇺', inEU: true,
    companyId: { label: { fr: 'N° RCS ou d’autorisation', en: 'RCS or business permit no.' }, placeholder: 'A12345' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.17, numberLabel: { fr: 'N° de TVA', en: 'VAT number' }, numberPlaceholder: 'LU12345678' },
    exemptMention: { fr: 'Régime de franchise de TVA', en: 'VAT exemption scheme for small businesses' },
    frenchLatePenalty: false,
  }),
  MC: R({
    code: 'MC', name: { fr: 'Monaco', en: 'Monaco' }, flag: '🇲🇨', inEU: false,
    companyId: { label: { fr: 'N° RCI', en: 'RCI number' }, placeholder: '12 P 03456' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.2, numberLabel: { fr: 'N° de TVA', en: 'VAT number' }, numberPlaceholder: 'FR12345678901' },
    exemptMention: { fr: 'Franchise en base de TVA', en: 'VAT exemption for small businesses' },
    frenchLatePenalty: false,
  }),
  'CA-QC': R({
    code: 'CA-QC', name: { fr: 'Québec (Canada)', en: 'Quebec (Canada)' }, flag: '🇨🇦', inEU: false,
    companyId: { label: { fr: 'NEQ', en: 'NEQ' }, placeholder: '2212345678' },
    tax: { label: { fr: 'TPS + TVQ', en: 'GST + QST' }, rate: 0.14975, numberLabel: { fr: 'N° de TPS / TVQ', en: 'GST / QST numbers' }, numberPlaceholder: '123456789 RT0001 · 1234567890 TQ0001' },
    exemptMention: { fr: 'Petit fournisseur, non inscrit aux fichiers de la TPS et de la TVQ', en: 'Small supplier, not registered for GST/QST' },
    frenchLatePenalty: false,
  }),
  CA: R({
    code: 'CA', name: { fr: 'Canada (hors Québec)', en: 'Canada (outside Quebec)' }, flag: '🇨🇦', inEU: false,
    companyId: { label: { fr: "Numéro d'entreprise (NE)", en: 'Business Number (BN)' }, placeholder: '123456789' },
    tax: { label: { fr: 'TPS / TVH', en: 'GST / HST' }, rate: 0.05, numberLabel: { fr: 'N° de TPS / TVH', en: 'GST / HST number' }, numberPlaceholder: '123456789 RT0001' },
    exemptMention: { fr: 'Petit fournisseur, non inscrit à la TPS / TVH', en: 'Small supplier, not registered for GST/HST' },
    frenchLatePenalty: false,
  }),
  MA: R({
    code: 'MA', name: { fr: 'Maroc', en: 'Morocco' }, flag: '🇲🇦', inEU: false,
    companyId: { label: { fr: 'ICE', en: 'ICE' }, placeholder: '001234567000089' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.2, numberLabel: { fr: 'Identifiant fiscal (IF)', en: 'Tax ID (IF)' }, numberPlaceholder: '12345678' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  TN: R({
    code: 'TN', name: { fr: 'Tunisie', en: 'Tunisia' }, flag: '🇹🇳', inEU: false,
    companyId: { label: { fr: 'Matricule fiscal', en: 'Tax ID (matricule fiscal)' }, placeholder: '1234567/A/M/000' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.19, numberLabel: { fr: 'Matricule fiscal', en: 'Tax ID' }, numberPlaceholder: '1234567/A/M/000' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  DZ: R({
    code: 'DZ', name: { fr: 'Algérie', en: 'Algeria' }, flag: '🇩🇿', inEU: false,
    companyId: { label: { fr: 'NIF', en: 'Tax ID (NIF)' }, placeholder: '000123456789012' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.19, numberLabel: { fr: 'NIF', en: 'Tax ID (NIF)' }, numberPlaceholder: '000123456789012' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  SN: R({
    code: 'SN', name: { fr: 'Sénégal', en: 'Senegal' }, flag: '🇸🇳', inEU: false,
    companyId: { label: { fr: 'NINEA', en: 'NINEA' }, placeholder: '0012345 2G3' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.18, numberLabel: { fr: 'NINEA', en: 'NINEA' }, numberPlaceholder: '0012345 2G3' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  CI: R({
    code: 'CI', name: { fr: "Côte d'Ivoire", en: "Côte d'Ivoire" }, flag: '🇨🇮', inEU: false,
    companyId: { label: { fr: 'N° de compte contribuable (NCC)', en: 'Taxpayer number (NCC)' }, placeholder: '1234567A' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.18, numberLabel: { fr: 'NCC', en: 'NCC' }, numberPlaceholder: '1234567A' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  GB: R({
    code: 'GB', name: { fr: 'Royaume-Uni', en: 'United Kingdom' }, flag: '🇬🇧', inEU: false,
    companyId: { label: { fr: 'Company number / UTR', en: 'Company number / UTR' }, placeholder: '12345678' },
    tax: { label: { fr: 'VAT', en: 'VAT' }, rate: 0.2, numberLabel: { fr: 'N° de VAT', en: 'VAT number' }, numberPlaceholder: 'GB123456789' },
    exemptMention: { fr: 'Not VAT registered', en: 'Not VAT registered' },
    frenchLatePenalty: false,
  }),
  US: R({
    code: 'US', name: { fr: 'États-Unis', en: 'United States' }, flag: '🇺🇸', inEU: false,
    companyId: { label: { fr: 'EIN', en: 'EIN' }, placeholder: '12-3456789' },
    tax: null,
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  AE: R({
    code: 'AE', name: { fr: 'Émirats arabes unis', en: 'United Arab Emirates' }, flag: '🇦🇪', inEU: false,
    companyId: { label: { fr: 'N° de licence commerciale', en: 'Trade licence no.' }, placeholder: '123456' },
    tax: { label: { fr: 'VAT', en: 'VAT' }, rate: 0.05, numberLabel: { fr: 'TRN', en: 'TRN' }, numberPlaceholder: '100123456700003' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  GE: R({
    code: 'GE', name: { fr: 'Géorgie', en: 'Georgia' }, flag: '🇬🇪', inEU: false,
    companyId: { label: { fr: "Code d'identification", en: 'Identification code' }, placeholder: '123456789' },
    tax: { label: { fr: 'TVA', en: 'VAT' }, rate: 0.18, numberLabel: { fr: 'N° de TVA', en: 'VAT number' }, numberPlaceholder: '123456789' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
  OTHER: R({
    code: 'OTHER', name: { fr: 'Autre pays', en: 'Other country' }, flag: '🌍', inEU: false,
    companyId: { label: { fr: "N° d'identification de l'entreprise", en: 'Business identification no.' }, placeholder: '' },
    tax: { label: { fr: 'Taxe', en: 'Tax' }, rate: 0, numberLabel: { fr: 'N° fiscal', en: 'Tax number' }, numberPlaceholder: '' },
    exemptMention: null,
    frenchLatePenalty: false,
  }),
}

export const COUNTRY_ORDER: CountryCode[] = ['FR', 'BE', 'CH', 'LU', 'MC', 'CA-QC', 'CA', 'MA', 'TN', 'DZ', 'SN', 'CI', 'GB', 'US', 'AE', 'GE', 'OTHER']

export function countryOptions(lang: 'fr' | 'en' = 'fr') {
  return COUNTRY_ORDER.map((c) => ({ value: c, label: `${COUNTRY_RULES[c].flag} ${COUNTRY_RULES[c].name[lang]}` }))
}

const ALIASES: Record<string, CountryCode> = {
  france: 'FR',
  belgique: 'BE', belgium: 'BE',
  suisse: 'CH', switzerland: 'CH',
  luxembourg: 'LU',
  monaco: 'MC',
  'quebec': 'CA-QC', 'québec': 'CA-QC', 'ca-qc': 'CA-QC', 'quebec (canada)': 'CA-QC', 'québec (canada)': 'CA-QC',
  canada: 'CA', 'canada (hors québec)': 'CA',
  maroc: 'MA', morocco: 'MA',
  tunisie: 'TN', tunisia: 'TN',
  algérie: 'DZ', algerie: 'DZ', algeria: 'DZ',
  sénégal: 'SN', senegal: 'SN',
  "côte d'ivoire": 'CI', "cote d'ivoire": 'CI', 'ivory coast': 'CI',
  'royaume-uni': 'GB', 'united kingdom': 'GB', angleterre: 'GB',
  'états-unis': 'US', 'etats-unis': 'US', 'united states': 'US', usa: 'US',
  'émirats arabes unis': 'AE', 'emirats arabes unis': 'AE', uae: 'AE', dubai: 'AE', dubaï: 'AE',
  géorgie: 'GE', georgie: 'GE', georgia: 'GE',
  other: 'OTHER', autre: 'OTHER', 'autre pays': 'OTHER',
}

/** Code pays à partir d'un code ou d'un nom. Vide → France (comportement historique). Inconnu → OTHER. */
export function normalizeCountry(value?: string | null): CountryCode {
  if (!value || !value.trim()) return 'FR'
  const v = value.trim()
  if ((COUNTRY_ORDER as string[]).includes(v)) return v as CountryCode
  return ALIASES[v.toLowerCase()] || 'OTHER'
}

export function getCountryRule(value?: string | null): CountryRule {
  return COUNTRY_RULES[normalizeCountry(value)]
}

/** Nom lisible d'un pays stocké (code ou ancien nom). Un pays inconnu garde son texte d'origine. */
export function countryLabel(value?: string | null, lang: 'fr' | 'en' = 'fr'): string {
  const code = normalizeCountry(value)
  if (code === 'OTHER' && value && !ALIASES[value.trim().toLowerCase()]) return value
  return COUNTRY_RULES[code].name[lang]
}

/**
 * Mention de taxe à imprimer sur une facture qui ne porte PAS de taxe.
 * - client d'un autre pays de l'UE, émetteur dans l'UE → autoliquidation
 * - client dans un autre pays → prestation hors du champ de la taxe de l'émetteur (lieu du preneur)
 * - client dans le même pays → mention de franchise / petit fournisseur du pays de l'émetteur
 */
export function taxExemptionMention(issuerCountry?: string | null, clientCountry?: string | null, lang: 'fr' | 'en' = 'fr'): string | null {
  const issuer = getCountryRule(issuerCountry)
  const client = getCountryRule(clientCountry)
  const sameCountry = issuer.code === client.code || (issuer.code.startsWith('CA') && client.code.startsWith('CA'))
  if (!sameCountry && clientCountry) {
    if (issuer.inEU && client.inEU) {
      return lang === 'fr'
        ? 'Autoliquidation : TVA due par le preneur (art. 196 de la directive 2006/112/CE)'
        : 'Reverse charge: VAT payable by the customer (art. 196 of Directive 2006/112/EC)'
    }
    if (issuer.tax) {
      if (issuer.code === 'FR') {
        return lang === 'fr' ? 'TVA non applicable, art. 259-1 du CGI (prestation hors UE)' : 'VAT not applicable, art. 259-1 of the French Tax Code (service outside the EU)'
      }
      if (issuer.code === 'BE') {
        return lang === 'fr' ? 'Opération non soumise à la TVA belge (art. 21, § 2 du Code TVA)' : 'Not subject to Belgian VAT (art. 21, § 2 of the VAT Code)'
      }
      if (issuer.code === 'CA-QC' || issuer.code === 'CA') {
        return lang === 'fr' ? 'Fourniture détaxée : service rendu à un non-résident' : 'Zero-rated supply: service to a non-resident'
      }
      return lang === 'fr'
        ? `Prestation non soumise à la ${issuer.tax.label.fr} ${issuer.code === 'CH' ? 'suisse' : 'de l’émetteur'} : lieu de la prestation chez le preneur`
        : `Not subject to ${issuer.tax.label.en} in the issuer’s country: place of supply is the customer’s country`
    }
    return null
  }
  return issuer.exemptMention ? issuer.exemptMention[lang] : null
}
