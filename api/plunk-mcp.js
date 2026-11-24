// Serveur MCP (Streamable HTTP, sans état) pour piloter Plunk (newsletter auto-hébergée
// sur plunk.closeos.fr, envoi via Amazon SES) depuis une conversation Claude.ai.
//
// URL du connecteur : https://www.closeos.fr/api/plunk-mcp/<PLUNK_MCP_TOKEN>
// Plusieurs « espaces » = plusieurs projets Plunk (contacts et stats séparés) :
//   closeos    (news.closeos.fr)    PLUNK_SECRET_KEY
//   halyn      (news.halynapp.com)  PLUNK_SECRET_KEY_HALYN
//   closerslab (news.closerslab.fr) PLUNK_SECRET_KEY_CLOSERSLAB
// Autres variables (Dokploy > CloseOS Web > Environment) :
//   PLUNK_MCP_TOKEN   jeton long et aléatoire qui protège l'URL du connecteur
//   PLUNK_API_URL     (facultatif) défaut https://plunk-api.closeos.fr
//   PLUNK_FROM_EMAIL[_HALYN|_CLOSERSLAB], PLUNK_FROM_NAME[_…], PLUNK_REPLY_TO[_…] (facultatifs)
//
// Sécurité : rien ne part sans deux étapes. plunk_preparer_campagne crée un BROUILLON
// (objet, texte d'aperçu, contenu, destinataires) ; plunk_envoyer_campagne n'envoie
// que si confirmation === "ENVOYER", après validation explicite de l'utilisateur.

import crypto from 'node:crypto'

export const config = { maxDuration: 60 }

const API = (process.env.PLUNK_API_URL || 'https://plunk-api.closeos.fr').replace(/\/+$/, '')
const env = process.env
const SPACES = {
  closeos: {
    label: 'CloseOS', keyVar: 'PLUNK_SECRET_KEY', domain: 'news.closeos.fr',
    from: env.PLUNK_FROM_EMAIL || 'newsletter@news.closeos.fr',
    fromName: env.PLUNK_FROM_NAME || 'Thomas Shamoev',
    replyTo: env.PLUNK_REPLY_TO || 'support@closeos.fr',
  },
  halyn: {
    label: 'Halyn', keyVar: 'PLUNK_SECRET_KEY_HALYN', domain: 'news.halynapp.com',
    from: env.PLUNK_FROM_EMAIL_HALYN || 'newsletter@news.halynapp.com',
    fromName: env.PLUNK_FROM_NAME_HALYN || 'Halyn',
    replyTo: env.PLUNK_REPLY_TO_HALYN || null,
  },
  closerslab: {
    label: 'ClosersLab', keyVar: 'PLUNK_SECRET_KEY_CLOSERSLAB', domain: 'news.closerslab.fr',
    from: env.PLUNK_FROM_EMAIL_CLOSERSLAB || 'newsletter@news.closerslab.fr',
    fromName: env.PLUNK_FROM_NAME_CLOSERSLAB || 'ClosersLab',
    replyTo: env.PLUNK_REPLY_TO_CLOSERSLAB || null,
  },
}
const SPACE_IDS = Object.keys(SPACES)

function spaceOf(a) {
  const raw = String((a && a.espace) || 'closeos').toLowerCase().replace(/[^a-z]/g, '')
  const id = raw === 'halynapp' ? 'halyn' : raw === 'closers' ? 'closerslab' : raw
  const sp = SPACES[id]
  if (!sp) throw new Error(`Espace inconnu : ${a.espace}. Valeurs possibles : ${SPACE_IDS.join(', ')}`)
  return { id, ...sp }
}

// ───────── Accès à l'API Plunk ─────────

async function plunk(method, path, body, sp = spaceOf({})) {
  const key = env[sp.keyVar]
  if (!key) throw new Error(`Espace ${sp.label} non configuré : ${sp.keyVar} manquante sur le serveur`)
  const r = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text.slice(0, 500) } }
  if (!r.ok) {
    const msg = (data && (data.message || data.error || (data.error && data.error.message))) || text.slice(0, 300)
    throw new Error(`Plunk ${method} ${path} → ${r.status} : ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
  }
  return data
}
const unwrap = (d) => (d && typeof d === 'object' && 'data' in d && d.success !== undefined ? d.data : d)

// ───────── Mise en forme du contenu ─────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function textToHtml(text) {
  return String(text)
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1b1c1b;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

// Le texte d'aperçu (pré-en-tête) n'est pas un champ de Plunk : on l'insère en tête du
// corps dans un bloc invisible, comme le font les clients email (Gmail, Apple Mail…).
function buildBody({ contenu, format, texte_apercu }) {
  const isHtml = format === 'html' || (format !== 'texte' && /<\s*(p|div|table|br|h1|h2|a|img|span)\b/i.test(contenu))
  let html = isHtml ? String(contenu) : textToHtml(contenu)
  if (texte_apercu) {
    const pad = '&#847;&zwnj;&nbsp;'.repeat(60)
    const pre = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(texte_apercu)}${pad}</div>`
    html = /<body[^>]*>/i.test(html) ? html.replace(/<body([^>]*)>/i, `<body$1>${pre}`) : pre + '\n' + html
  }
  return html
}

const parseEmails = (v) =>
  [...new Set((Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map((e) => String(e).trim().toLowerCase()).filter(Boolean))]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function countSubscribed(api) {
  try {
    const d = await api('GET', '/contacts?status=subscribed&limit=1')
    return d.total ?? d.count ?? d.totalCount ?? null
  } catch { return null }
}

async function segmentSize(api, id) {
  try {
    const s = unwrap(await api('GET', `/segments/${id}`))
    return s.memberCount ?? s.contactCount ?? s.count ?? (s._count && (s._count.memberships ?? s._count.contacts)) ?? null
  } catch { return null }
}

function summarizeCampaign(c) {
  if (!c) return c
  return {
    id: c.id, nom: c.name, statut: c.status, objet: c.subject,
    expediteur: c.fromName ? `${c.fromName} <${c.from}>` : c.from, repondre_a: c.replyTo,
    audience: c.audienceType, segment_id: c.segmentId || undefined,
    destinataires_estimes: c.totalRecipients ?? undefined,
    programme_pour: c.scheduledFor || undefined, envoye_le: c.sentAt || undefined,
    cree_le: c.createdAt,
    lien: c.id ? `https://plunk.closeos.fr/campaigns/${c.id}` : undefined,
  }
}

// ───────── Outils ─────────

const impl = {
  async plunk_lister_espaces() {
    return SPACE_IDS.map((id) => ({
      espace: id, nom: SPACES[id].label, domaine_envoi: SPACES[id].domain,
      expediteur_par_defaut: `${SPACES[id].fromName} <${SPACES[id].from}>`,
      repondre_a_par_defaut: SPACES[id].replyTo || null,
      configure: !!env[SPACES[id].keyVar],
    }))
  },

  async plunk_preparer_campagne({ api, sp }, a) {
    for (const f of ['objet', 'contenu', 'destinataires']) if (!a[f]) throw new Error(`Champ obligatoire manquant : ${f}`)
    const objet = String(a.objet).trim()
    const from = String(a.expediteur_email || sp.from).trim()
    if (!from.toLowerCase().endsWith('@' + sp.domain)) {
      throw new Error(`Espace ${sp.label} : l'expéditeur doit être une adresse @${sp.domain} (domaine vérifié de cet espace). Reçu : ${from}`)
    }
    const body = buildBody({ contenu: a.contenu, format: a.format, texte_apercu: a.texte_apercu })

    let audienceType = 'ALL'
    let segmentId
    let destinatairesInfo
    const dest = a.destinataires
    if (typeof dest === 'string' && /^(tous|all|tout le monde|toute la liste)$/i.test(dest.trim())) {
      audienceType = 'ALL'
      destinatairesInfo = { type: 'tous les contacts abonnés', nombre: await countSubscribed(api) }
    } else if ((typeof dest === 'object' && !Array.isArray(dest) && dest.segment_id) || (typeof dest === 'string' && /^segment:/i.test(dest))) {
      segmentId = typeof dest === 'string' ? dest.replace(/^segment:/i, '').trim() : String(dest.segment_id)
      audienceType = 'SEGMENT'
      destinatairesInfo = { type: 'segment', segment_id: segmentId, nombre: await segmentSize(api, segmentId) }
    } else {
      const emails = parseEmails(Array.isArray(dest) ? dest : typeof dest === 'object' ? dest.emails : dest)
      const bad = emails.filter((e) => !EMAIL_RE.test(e))
      if (bad.length) throw new Error(`Adresses invalides : ${bad.slice(0, 10).join(', ')}`)
      if (!emails.length) throw new Error('Aucune adresse email reconnue dans "destinataires"')
      if (emails.length > 500) throw new Error('Maximum 500 adresses par liste directe : crée un segment dans Plunk pour plus.')
      const seg = unwrap(await api('POST', '/segments', {
        name: `Liste MCP – ${objet.slice(0, 60)} – ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`.slice(0, 100),
        description: 'Liste créée depuis Claude (connecteur MCP Plunk)',
        type: 'STATIC',
      }))
      segmentId = seg.id
      const add = await api('POST', `/segments/${segmentId}/members`, { emails, createMissing: !!a.creer_contacts_manquants, subscribed: true })
      audienceType = 'SEGMENT'
      destinatairesInfo = { type: 'liste d’adresses', segment_id: segmentId, adresses_fournies: emails.length, resultat_ajout: add, nombre: await segmentSize(api, segmentId) }
    }

    const campaign = unwrap(await api('POST', '/campaigns', {
      name: String(a.nom || objet).slice(0, 200),
      description: a.texte_apercu ? `Aperçu : ${a.texte_apercu}` : undefined,
      subject: objet,
      body,
      from,
      fromName: a.expediteur_nom || sp.fromName,
      replyTo: a.repondre_a || sp.replyTo || undefined,
      type: 'MARKETING',
      audienceType,
      segmentId,
    }))

    return {
      statut: 'BROUILLON créé — rien n’a été envoyé',
      espace: sp.label,
      avertissement: (a.repondre_a || sp.replyTo) ? undefined : `Aucune adresse de réponse : les réponses iront vers ${from}, qui ne reçoit pas d'emails. Précise repondre_a pour recevoir les réponses.`,
      campagne: summarizeCampaign(campaign),
      texte_apercu: a.texte_apercu || null,
      destinataires: destinatairesInfo,
      etape_suivante: 'Montre ce récapitulatif à l’utilisateur. Propose un test (plunk_envoyer_test). N’appelle plunk_envoyer_campagne qu’après son accord explicite.',
    }
  },

  async plunk_modifier_campagne({ api, sp }, a) {
    if (!a.campagne_id) throw new Error('campagne_id obligatoire')
    const current = unwrap(await api('GET', `/campaigns/${a.campagne_id}`))
    if (current.status !== 'DRAFT') throw new Error(`Seul un brouillon peut être modifié (statut actuel : ${current.status})`)
    const patch = {}
    if (a.objet) patch.subject = String(a.objet)
    if (a.nom) patch.name = String(a.nom)
    if (a.contenu) patch.body = buildBody({ contenu: a.contenu, format: a.format, texte_apercu: a.texte_apercu })
    else if (a.texte_apercu) patch.body = buildBody({ contenu: current.body.replace(/^<div style="display:none;[^>]*>[\s\S]*?<\/div>\n?/, ''), format: 'html', texte_apercu: a.texte_apercu })
    if (a.texte_apercu) patch.description = `Aperçu : ${a.texte_apercu}`
    if (a.expediteur_nom) patch.fromName = a.expediteur_nom
    if (a.repondre_a) patch.replyTo = a.repondre_a
    const c = unwrap(await api('PUT', `/campaigns/${a.campagne_id}`, patch))
    return { statut: 'Brouillon mis à jour — rien n’a été envoyé', campagne: summarizeCampaign(c) }
  },

  async plunk_envoyer_test({ api, sp }, a) {
    if (!a.campagne_id || !a.email) throw new Error('campagne_id et email obligatoires')
    const r = await api('POST', `/campaigns/${a.campagne_id}/test`, { email: String(a.email).trim() })
    return { ok: true, message: r.message || `Test envoyé à ${a.email}` }
  },

  async plunk_envoyer_campagne({ api, sp }, a) {
    if (!a.campagne_id) throw new Error('campagne_id obligatoire')
    if (a.confirmation !== 'ENVOYER') {
      throw new Error('Envoi refusé : confirmation doit valoir exactement "ENVOYER", uniquement après accord explicite de l’utilisateur dans la conversation.')
    }
    const c = unwrap(await api('GET', `/campaigns/${a.campagne_id}`))
    if (c.status !== 'DRAFT') throw new Error(`Campagne non envoyable (statut : ${c.status})`)
    const r = await api('POST', `/campaigns/${a.campagne_id}/send`, a.programmer_pour ? { scheduledFor: a.programmer_pour } : {})
    return { ok: true, message: r.message, campagne: summarizeCampaign(unwrap(r)) }
  },

  async plunk_annuler_campagne({ api, sp }, a) {
    if (!a.campagne_id) throw new Error('campagne_id obligatoire')
    const r = await api('POST', `/campaigns/${a.campagne_id}/cancel`, {})
    return { ok: true, message: r.message, campagne: summarizeCampaign(unwrap(r)) }
  },

  async plunk_supprimer_brouillon({ api, sp }, a) {
    if (!a.campagne_id) throw new Error('campagne_id obligatoire')
    if (a.confirm !== true) throw new Error('Ajoute confirm: true pour supprimer')
    const r = await api('DELETE', `/campaigns/${a.campagne_id}`)
    return { ok: true, message: r.message }
  },

  async plunk_lister_campagnes({ api, sp }, a) {
    const q = new URLSearchParams({ pageSize: String(Math.min(Number(a.nombre) || 10, 50)) })
    if (a.statut) q.set('status', String(a.statut).toUpperCase())
    if (a.recherche) q.set('search', String(a.recherche))
    const d = await api('GET', `/campaigns?${q}`)
    const list = d.data || d.campaigns || d.items || (Array.isArray(d) ? d : [])
    return { total: d.total ?? list.length, campagnes: list.map(summarizeCampaign) }
  },

  async plunk_voir_campagne({ api, sp }, a) {
    if (!a.campagne_id) throw new Error('campagne_id obligatoire')
    const c = unwrap(await api('GET', `/campaigns/${a.campagne_id}`))
    let stats = null
    if (c.status !== 'DRAFT') { try { stats = unwrap(await api('GET', `/campaigns/${a.campagne_id}/stats`)) } catch { /* pas de stats */ } }
    return { espace: sp.label, campagne: summarizeCampaign(c), stats, note_stats: stats ? 'Plunk recalcule ces totaux environ toutes les minutes : une ouverture ou un clic très récent peut apparaître avec ~1 min de retard.' : undefined, contenu_html: a.avec_contenu ? c.body : undefined }
  },

  async plunk_lister_segments({ api }) {
    const d = await api('GET', '/segments')
    const list = Array.isArray(d) ? d : d.data || d.segments || []
    return list.map((s) => ({
      id: s.id, nom: s.name, type: s.type, description: s.description || undefined,
      membres: s.memberCount ?? (s._count && (s._count.memberships ?? s._count.contacts)) ?? undefined,
    }))
  },

  async plunk_chercher_contacts({ api, sp }, a) {
    const q = new URLSearchParams({ limit: String(Math.min(Number(a.nombre) || 20, 100)) })
    if (a.recherche) q.set('search', String(a.recherche))
    if (a.statut) q.set('status', String(a.statut))
    const d = await api('GET', `/contacts?${q}`)
    const list = d.contacts || d.data || d.items || []
    return {
      total: d.total ?? undefined,
      contacts: list.map((c) => ({ id: c.id, email: c.email, abonne: c.subscribed, donnees: c.data || undefined, cree_le: c.createdAt })),
      total_abonnes: a.recherche ? undefined : await countSubscribed(api),
    }
  },

  async plunk_ajouter_contacts({ api, sp }, a) {
    const emails = parseEmails(a.emails)
    const bad = emails.filter((e) => !EMAIL_RE.test(e))
    if (bad.length) throw new Error(`Adresses invalides : ${bad.slice(0, 10).join(', ')}`)
    if (!emails.length) throw new Error('Aucune adresse fournie')
    if (emails.length > 200) throw new Error('200 adresses maximum par appel : pour plus, importe un CSV dans Plunk.')
    const done = []
    for (const email of emails) {
      try {
        const r = unwrap(await api('POST', '/contacts', { email, subscribed: a.abonne !== false, data: a.donnees || undefined }))
        done.push({ email, ok: true, id: r.id })
      } catch (e) { done.push({ email, ok: false, erreur: e.message }) }
    }
    let segment
    if (a.segment_id) segment = await api('POST', `/segments/${a.segment_id}/members`, { emails, createMissing: true, subscribed: a.abonne !== false })
    return { ajoutes: done.filter((d) => d.ok).length, erreurs: done.filter((d) => !d.ok), segment }
  },

  async plunk_desabonner_contact({ api, sp }, a) {
    const emails = parseEmails(a.emails)
    if (!emails.length) throw new Error('Aucune adresse fournie')
    const found = await api('POST', '/contacts/lookup', { emails })
    const list = found.contacts || found.data || (Array.isArray(found) ? found : [])
    const out = []
    for (const c of list) {
      try { await api('PATCH', `/contacts/${c.id}`, { subscribed: false }); out.push({ email: c.email, ok: true }) }
      catch (e) { out.push({ email: c.email, ok: false, erreur: e.message }) }
    }
    return { desabonnes: out, introuvables: emails.filter((e) => !list.some((c) => String(c.email).toLowerCase() === e)) }
  },

  async plunk_envoyer_email_unique({ api, sp }, a) {
    if (!a.a || !a.objet || !a.contenu) throw new Error('a, objet et contenu obligatoires')
    if (a.confirmation !== 'ENVOYER') throw new Error('Envoi refusé : confirmation doit valoir "ENVOYER" après accord explicite de l’utilisateur.')
    const fromU = String(a.expediteur_email || sp.from)
    if (!fromU.toLowerCase().endsWith('@' + sp.domain)) throw new Error(`Espace ${sp.label} : expéditeur obligatoirement @${sp.domain}`)
    const to = parseEmails(a.a)
    if (to.length > 5) throw new Error('5 destinataires maximum : pour plus, utilise plunk_preparer_campagne.')
    const r = await api('POST', '/v1/send', {
      to,
      subject: String(a.objet),
      body: buildBody({ contenu: a.contenu, format: a.format, texte_apercu: a.texte_apercu }),
      from: { email: fromU, name: a.expediteur_nom || sp.fromName },
      reply: a.repondre_a || sp.replyTo || undefined,
      subscribed: false,
    })
    return { ok: true, reponse: unwrap(r) }
  },
}

// ───────── Description des outils ─────────

const str = (description) => ({ type: 'string', description })
const bool = (description) => ({ type: 'boolean', description })
const ESPACE = { type: 'string', enum: ['closeos', 'halyn', 'closerslab'], description: 'Espace Plunk (marque) : closeos (défaut), halyn ou closerslab. Chaque espace a ses propres contacts, segments, campagnes et domaine d’envoi.' }
const obj = (properties, required = []) => ({ type: 'object', properties: { espace: ESPACE, ...properties }, required, additionalProperties: false })

const TOOLS = [
  {
    name: 'plunk_lister_espaces',
    description: 'Liste les espaces Plunk disponibles (CloseOS, Halyn, ClosersLab) avec leur domaine d’envoi et s’ils sont configurés. À appeler quand l’utilisateur ne précise pas pour quelle marque il veut envoyer.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'plunk_preparer_campagne',
    description:
      'Prépare une newsletter dans Plunk sous forme de BROUILLON (rien n’est envoyé) : objet, texte d’aperçu (pré-en-tête visible dans la boîte de réception), contenu et destinataires. ' +
      'Destinataires : "tous" (tous les contacts abonnés), "segment:<id>" ou {segment_id}, ou une liste d’adresses (crée une liste statique, 500 max). ' +
      'Le contenu peut être du texte (paragraphes séparés par une ligne vide) ou du HTML. Plunk ajoute lui-même le lien de désinscription. ' +
      'Montre ensuite le récapitulatif à l’utilisateur et propose un email de test.',
    inputSchema: obj({
      objet: str('Objet de l’email'),
      texte_apercu: str('Texte d’aperçu / pré-en-tête (≈ 40 à 110 caractères) affiché après l’objet dans la boîte de réception'),
      contenu: str('Corps de l’email : texte simple ou HTML'),
      format: str('"texte" ou "html" (détecté automatiquement si absent)'),
      destinataires: { description: '"tous", "segment:<id>", {segment_id: "<id>"}, ou liste d’emails (tableau ou texte séparé par virgules)', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }, { type: 'object' }] },
      nom: str('Nom interne de la campagne (défaut : l’objet)'),
      expediteur_email: str('Adresse d’expédition, obligatoirement sur le domaine de l’espace : @news.closeos.fr (closeos), @news.halynapp.com (halyn), @news.closerslab.fr (closerslab). Défaut : newsletter@<domaine>'),
      expediteur_nom: str('Nom d’expéditeur (défaut selon l’espace : Thomas Shamoev / Halyn / ClosersLab)'),
      repondre_a: str('Adresse qui reçoit les réponses (défaut CloseOS : support@closeos.fr ; Halyn et ClosersLab : à préciser)'),
      creer_contacts_manquants: bool('Si liste d’adresses : créer les contacts absents de Plunk (à n’utiliser que pour des personnes qui ont accepté de recevoir tes emails)'),
    }, ['objet', 'contenu', 'destinataires']),
  },
  {
    name: 'plunk_modifier_campagne',
    description: 'Modifie un brouillon de campagne (objet, texte d’aperçu, contenu, nom, expéditeur, réponse). Rien n’est envoyé.',
    inputSchema: obj({
      campagne_id: str('Id de la campagne'), objet: str('Nouvel objet'), texte_apercu: str('Nouveau texte d’aperçu'),
      contenu: str('Nouveau contenu (texte ou HTML)'), format: str('"texte" ou "html"'), nom: str('Nouveau nom interne'),
      expediteur_nom: str('Nouveau nom d’expéditeur'), repondre_a: str('Nouvelle adresse de réponse'),
    }, ['campagne_id']),
  },
  {
    name: 'plunk_envoyer_test',
    description: 'Envoie la campagne en TEST à une seule adresse, pour vérifier le rendu avant l’envoi réel.',
    inputSchema: obj({ campagne_id: str('Id de la campagne'), email: str('Adresse qui reçoit le test') }, ['campagne_id', 'email']),
  },
  {
    name: 'plunk_envoyer_campagne',
    description:
      'ENVOIE RÉELLEMENT la campagne à tous ses destinataires (ou la programme). Irréversible. ' +
      'À n’appeler QU’APRÈS avoir montré objet, aperçu, expéditeur et nombre de destinataires à l’utilisateur ET obtenu son accord explicite dans la conversation. ' +
      'Passe alors confirmation: "ENVOYER".',
    inputSchema: obj({
      campagne_id: str('Id de la campagne (brouillon)'),
      confirmation: str('Doit valoir exactement "ENVOYER" (accord explicite de l’utilisateur)'),
      programmer_pour: str('Facultatif : date ISO 8601 pour programmer l’envoi (ex. 2026-11-25T09:00:00+01:00)'),
    }, ['campagne_id', 'confirmation']),
  },
  {
    name: 'plunk_annuler_campagne',
    description: 'Annule une campagne programmée ou en cours d’envoi (si rien n’est parti, elle redevient un brouillon).',
    inputSchema: obj({ campagne_id: str('Id de la campagne') }, ['campagne_id']),
  },
  {
    name: 'plunk_supprimer_brouillon',
    description: 'Supprime un brouillon de campagne.',
    inputSchema: obj({ campagne_id: str('Id de la campagne'), confirm: bool('Doit valoir true') }, ['campagne_id', 'confirm']),
  },
  {
    name: 'plunk_lister_campagnes',
    description: 'Liste les campagnes (brouillons, programmées, envoyées…).',
    inputSchema: obj({ statut: str('DRAFT | SCHEDULED | SENDING | SENT | CANCELLED'), recherche: str('Texte à chercher'), nombre: { type: 'number', description: 'Nombre max (défaut 10)' } }),
  },
  {
    name: 'plunk_voir_campagne',
    description: 'Détail d’une campagne et, si elle est partie, ses statistiques (envois, ouvertures, clics, rejets, désinscriptions).',
    inputSchema: obj({ campagne_id: str('Id de la campagne'), avec_contenu: bool('Inclure le HTML du corps') }, ['campagne_id']),
  },
  {
    name: 'plunk_lister_segments',
    description: 'Liste les segments (groupes de contacts) disponibles pour cibler une campagne.',
    inputSchema: obj({}),
  },
  {
    name: 'plunk_chercher_contacts',
    description: 'Cherche des contacts dans Plunk (par email) et donne le nombre total d’abonnés.',
    inputSchema: obj({ recherche: str('Texte ou email à chercher'), statut: str('subscribed | unsubscribed | snoozed'), nombre: { type: 'number', description: 'Nombre max (défaut 20)' } }),
  },
  {
    name: 'plunk_ajouter_contacts',
    description: 'Ajoute des contacts (200 max par appel), éventuellement dans un segment. Uniquement des personnes qui ont accepté de recevoir tes emails.',
    inputSchema: obj({
      emails: { description: 'Liste d’emails', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
      abonne: bool('Abonné à la newsletter (défaut true)'),
      donnees: { type: 'object', description: 'Données facultatives (ex. {"prenom":"Léa"})' },
      segment_id: str('Facultatif : ajouter aussi ces contacts à ce segment'),
    }, ['emails']),
  },
  {
    name: 'plunk_desabonner_contact',
    description: 'Désabonne une ou plusieurs adresses de la newsletter.',
    inputSchema: obj({ emails: { description: 'Email(s)', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] } }, ['emails']),
  },
  {
    name: 'plunk_envoyer_email_unique',
    description:
      'Envoie immédiatement un email individuel (5 destinataires max) via Plunk/SES. Irréversible : seulement après accord explicite de l’utilisateur, avec confirmation: "ENVOYER". Pour une newsletter, utiliser plunk_preparer_campagne.',
    inputSchema: obj({
      a: { description: 'Destinataire(s)', anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
      objet: str('Objet'), texte_apercu: str('Texte d’aperçu'), contenu: str('Corps (texte ou HTML)'), format: str('"texte" ou "html"'),
      expediteur_email: str('Adresse @news.closeos.fr'), expediteur_nom: str('Nom d’expéditeur'), repondre_a: str('Adresse de réponse'),
      confirmation: str('Doit valoir "ENVOYER"'),
    }, ['a', 'objet', 'contenu', 'confirmation']),
  },
]

// ───────── JSON-RPC ─────────

async function handleMessage(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || !msg.method) return undefined
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } })
  if (msg.id === undefined || msg.id === null) return undefined // notification
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'closeos-plunk', version: '1.0.0' },
        instructions:
          'Newsletters Plunk de Thomas, une par marque (espace) : closeos, halyn, closerslab. Si la marque n’est pas claire, demande-la. Toujours : 1) préparer un brouillon, 2) montrer objet, texte d’aperçu, expéditeur et nombre de destinataires, 3) proposer un test, 4) n’envoyer qu’après un « oui, envoie » explicite.',
      })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const name = msg.params && msg.params.name
      const args = (msg.params && msg.params.arguments) || {}
      const fn = impl[name]
      if (!fn) return fail(-32602, `Outil inconnu : ${name}`)
      try {
        const sp = spaceOf(args)
        const out = await fn({ ...ctx, sp, api: (m, p, bd) => plunk(m, p, bd, sp) }, args)
        return reply({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] })
      } catch (e) {
        return reply({ content: [{ type: 'text', text: 'Erreur : ' + (e.message || String(e)) }], isError: true })
      }
    }
    default:
      return fail(-32601, `Méthode inconnue : ${msg.method}`)
  }
}

function tokenOk(given) {
  const expected = process.env.PLUNK_MCP_TOKEN || ''
  if (expected.length < 24 || !given) return false
  const a = crypto.createHash('sha256').update(String(given)).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

// ───────── Handler HTTP ─────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, mcp-session-id, mcp-protocol-version')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const token = String((req.query && req.query.key) || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')).trim()
  if (!tokenOk(token)) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') return res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'SSE non supporté (stateless)' } })
  if (req.method !== 'POST') return res.status(405).end()

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  if (!body) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON invalide' } })

  try {
    const batch = Array.isArray(body)
    const messages = batch ? body : [body]
    const out = []
    for (const m of messages) { const r = await handleMessage(m, {}); if (r !== undefined) out.push(r) }
    if (out.length === 0) return res.status(202).end()
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(batch ? out : out[0])
  } catch (e) {
    return res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: e.message || 'Erreur interne' } })
  }
}
