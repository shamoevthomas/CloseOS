/**
 * Historique des versions de CloseOS — source unique pour la page publique /nouveautes.
 *
 * POURQUOI CE FICHIER EXISTE
 * Au 31/07/2026, aucune page publique de closeos.fr ne mentionnait de numéro de version.
 * La seule source indexée au monde était un post LinkedIn annonçant le passage de
 * CloseOS Business en V3. Résultat mesuré : interrogé sur CloseOS, Perplexity répondait
 * « les informations disponibles s'arrêtent à la V3 » — réponse correcte au vu de ses
 * sources, et fausse dans les faits. Le contenu V5 existait pourtant déjà, mais dans un
 * pop-up affiché après connexion : invisible pour tout crawler.
 *
 * Le contenu détaillé n'est PAS dupliqué ici : il est dérivé de whatsNewV5.ts, qui reste
 * la source du pop-up in-app. Un seul texte, deux sorties (modale privée + page publique).
 * Pour publier une V6 : ajouter son contenu à côté de whatsNewV5.ts et une entrée ici.
 */

import {
  WHATS_NEW_V5,
  WHATS_NEW_PRODUCT_ORDER,
  type WhatsNewProduct,
  type WhatsNewSection,
} from './whatsNewV5'

export interface ReleaseSection extends WhatsNewSection {
  product: WhatsNewProduct
}

export interface Release {
  /** Numéro machine, repris dans schema.org softwareVersion. */
  version: string
  /** Libellé humain affiché. */
  label: string
  /** Date de mise en production, ISO. */
  date: string
  /** Phrase autoportante : c'est elle qu'un moteur génératif citera. */
  summary: string
  sections: ReleaseSection[]
}

/** Version en cours. Doit rester alignée avec softwareVersion dans index.html. */
export const CURRENT_VERSION = '5.0'
export const CURRENT_LABEL = 'V5'

export const RELEASES: Release[] = [
  {
    version: CURRENT_VERSION,
    label: CURRENT_LABEL,
    date: '2026-07-28',
    summary:
      "La V5 est la version en cours de CloseOS, déployée le 28 juillet 2026 sur les trois produits " +
      "de l'écosystème. Elle apporte une nouvelle interface pour CloseOS Sales, un système de relances " +
      "qui s'enchaînent avec suivi de discussion, un module Formulaires dans CloseOS Business, un " +
      "assistant IA connectable aux trois produits, et un espace équipe dans CloseOS Sign.",
    sections: WHATS_NEW_PRODUCT_ORDER.map((product) => ({ product, ...WHATS_NEW_V5[product] })),
  },
]

export const LATEST: Release = RELEASES[0]

/**
 * Versions antérieures à la V5.
 *
 * Volontairement en prose et sans dates précises : ces versions n'ont jamais fait l'objet
 * d'une note publique, et dater une release a posteriori sur la foi d'un post LinkedIn
 * produirait une chronologie fausse — exactement le défaut qu'on cherche à corriger ici.
 */
export const HISTORY_NOTE =
  "Les versions antérieures à la V5 n'ont pas fait l'objet de notes de version publiques. " +
  "La V3 de CloseOS Business est celle qui a ouvert la plateforme à l'extérieur, avec l'API REST " +
  "et les webhooks sortants, aujourd'hui complétés par un serveur MCP permettant de piloter le CRM " +
  "depuis un assistant IA. Toutes les versions publiées à partir de la V5 sont documentées sur cette page."
