import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ArrowLeft, Globe, Sparkles, Zap, Key, Webhook, ShieldCheck, AlertCircle, BookOpen, Code2, Terminal, ChevronRight } from 'lucide-react'

type Lang = 'fr' | 'en'

// ─────────────────────────────────────────────────────────────────────────────
// i18n strings local to this page (keep self-contained, not in global i18n)
// ─────────────────────────────────────────────────────────────────────────────

const I18N: Record<Lang, Record<string, string>> = {
  fr: {
    backToLanding: 'Retour à la landing',
    productName: 'API CloseOS Business',
    badge: 'Documentation officielle',
    tagline: 'Construisez sur CloseOS — REST + Webhooks signés HMAC.',
    searchPlaceholder: 'Rechercher dans la doc',

    // sections
    nav_intro: 'Introduction',
    nav_auth: 'Authentification',
    nav_quickstart: 'Quick Start',
    nav_endpoint: 'Endpoint REST',
    nav_fields: 'Champs supportés',
    nav_idempotency: 'Idempotence',
    nav_webhooks: 'Webhooks sortants',
    nav_events: 'Liste des évènements',
    nav_signature: 'Vérifier la signature',
    nav_errors: 'Codes d’erreur',
    nav_ratelimit: 'Rate limits',
    nav_changelog: 'Changelog',

    // intro
    intro_h1: 'Bienvenue sur l’API CloseOS Business',
    intro_p1: "L'API CloseOS Business vous donne un accès programmatique à vos prospects, rendez-vous et deals. Elle est REST, renvoie du JSON, et s'authentifie via une clé API Bearer. Les changements en temps réel sont délivrés par webhooks signés HMAC-SHA256.",
    intro_baseurl_label: 'URL de base',
    intro_format_label: 'Format',
    intro_auth_label: 'Authentification',
    intro_format_value: 'JSON sur HTTPS',
    intro_auth_value: 'Bearer token',

    // auth
    auth_h1: 'Authentification',
    auth_p1: "Toute requête entrante doit inclure votre clé API dans l'en-tête Authorization. Vous pouvez générer une clé depuis le modal d'intégration CRM, onglet \"CloseOS CRM\".",
    auth_step1: 'Connectez-vous à votre espace CloseOS Business.',
    auth_step2: 'Ouvrez le modal CRM (page CRM → bandeau "Intégration CRM").',
    auth_step3: 'Onglet "CloseOS CRM" → "Générer une clé API".',
    auth_step4: 'Copiez la clé. Elle commence par cos_ et n\'est pas re-affichée — stockez-la en lieu sûr.',
    auth_warning: '⚠️ Ne committez jamais la clé dans un repo public. Stockez-la dans une variable d\'environnement côté serveur.',

    // quick start
    qs_h1: 'Quick Start',
    qs_p1: 'Trois étapes pour pousser votre premier prospect.',
    qs_step1: 'Définissez votre clé API en variable d\'environnement.',
    qs_step2: 'Effectuez votre premier POST avec cURL ou votre langage préféré.',
    qs_step3: 'Vous recevez 201 Created avec l\'objet prospect en réponse.',

    // endpoint
    ep_h1: 'Endpoint REST — Créer/MAJ un prospect',
    ep_intro: 'Un seul endpoint sert à créer ou mettre à jour un prospect. Si vous fournissez external_id, l\'appel devient idempotent : un second POST avec le même external_id met à jour la ligne existante au lieu de la dupliquer.',
    ep_method: 'Méthode',
    ep_path: 'Chemin',
    ep_url: 'URL complète',
    ep_response: 'Réponses',
    ep_response_201: '201 Created — nouveau prospect créé',
    ep_response_200: '200 OK — prospect existant mis à jour (idempotence)',
    ep_response_400: '400 Bad Request — champs requis manquants ou JSON invalide',
    ep_response_401: '401 Unauthorized — clé API absente ou invalide',
    ep_response_403: '403 Forbidden — clé API désactivée',
    ep_response_500: '500 Internal Server Error — erreur côté serveur',

    // fields
    f_h1: 'Champs supportés',
    f_p1: 'Tous les champs natifs de CloseOS Business sont reconnus. Tout champ inconnu est conservé dans metadata.',

    // idempotence
    idem_h1: 'Idempotence',
    idem_p1: 'Pour les intégrations critiques, fournissez un external_id stable (ID de votre système externe, hash d\'un email, etc.). CloseOS recherche d\'abord par (user_id, external_id) puis par email, et fait un UPDATE au lieu d\'un INSERT si le prospect existe déjà.',
    idem_p2: 'Les webhooks sortants émis dépendent du résultat :',
    idem_b_created: 'INSERT → prospect.created',
    idem_b_updated: 'UPDATE sans changement de stage → prospect.updated',
    idem_b_stage: 'UPDATE avec stage différent → prospect.stage_changed (avec previous_stage et new_stage)',
    idem_b_won: 'Si new_stage = "won" → deal.won en plus',
    idem_b_lost: 'Si new_stage = "lost" → deal.lost en plus',

    // webhooks
    wh_h1: 'Webhooks sortants',
    wh_p1: 'Configurez un endpoint qui recevra un POST signé à chaque évènement lifecycle. Pour ajouter un webhook : Modal CRM → onglet "CloseOS CRM" → section "Webhooks sortants" → URL + sélection des évènements → Ajouter.',
    wh_payload_h: 'Format du payload',
    wh_payload_p: "Tous les payloads suivent la même enveloppe. Le champ data contient la ligne business_prospects complète, plus previous_stage et new_stage pour les changements de stage.",
    wh_headers_h: 'En-têtes HTTP',

    // events
    ev_h1: 'Liste des évènements',
    ev_p1: '10 évènements lifecycle sont disponibles. Vous pouvez vous abonner à un sous-ensemble par webhook.',

    // signature
    sig_h1: 'Vérifier la signature HMAC',
    sig_p1: "Chaque webhook contient un en-tête X-CloseOS-Signature qui est un HMAC-SHA256 hex de l'enveloppe complète, signé avec le secret de la subscription. Vérifiez-le pour authentifier l'origine.",
    sig_warn: '⚠️ Le body à hasher est l\'enveloppe complète stringifiée { event, product, user_id, timestamp, data } telle que reçue sur la socket — pas seulement le champ data. Utilisez le raw body si possible (req.rawBody) pour éviter les divergences d\'espaces ou d\'ordre de clés.',

    // errors
    err_h1: 'Codes d\'erreur',
    err_p1: 'L\'API renvoie des codes HTTP standards. Le body JSON contient un champ error avec un message lisible.',

    // rate limits
    rl_h1: 'Rate limits',
    rl_p1: "Aucune limite de débit n'est appliquée aujourd'hui sur l'API CloseOS Business — vous pouvez l'utiliser sans plafond fonctionnel. Par robustesse côté infrastructure, l'API peut renvoyer un code 503 lors d'un pic de charge serveur ; implémentez un retry avec backoff exponentiel pour ces cas. Si vous avez besoin d'un SLA dédié, contactez-nous.",

    // changelog
    cl_h1: 'Changelog',
    cl_v1_date: '2026-04-26 — v1.0',
    cl_v1_item1: 'Lancement public de l\'API CloseOS Business.',
    cl_v1_item2: 'Endpoint POST /api/zapier-webhook?type=business avec idempotence par external_id.',
    cl_v1_item3: '10 évènements webhook sortants (prospect / appointment / deal / campaign).',
    cl_v1_item4: 'Signatures HMAC-SHA256 sur tous les webhooks.',

    // common labels
    lbl_required: 'Requis',
    lbl_optional: 'Optionnel',
    lbl_field: 'Champ',
    lbl_type: 'Type',
    lbl_description: 'Description',
    lbl_event: 'Évènement',
    lbl_when: 'Déclenché quand',
    lbl_code: 'Code',
    lbl_meaning: 'Signification',
  },
  en: {
    backToLanding: 'Back to landing',
    productName: 'CloseOS Business API',
    badge: 'Official documentation',
    tagline: 'Build on CloseOS — REST + HMAC-signed webhooks.',
    searchPlaceholder: 'Search the docs',

    nav_intro: 'Introduction',
    nav_auth: 'Authentication',
    nav_quickstart: 'Quick Start',
    nav_endpoint: 'REST Endpoint',
    nav_fields: 'Supported fields',
    nav_idempotency: 'Idempotency',
    nav_webhooks: 'Outbound webhooks',
    nav_events: 'Event catalog',
    nav_signature: 'Verify signature',
    nav_errors: 'Error codes',
    nav_ratelimit: 'Rate limits',
    nav_changelog: 'Changelog',

    intro_h1: 'Welcome to the CloseOS Business API',
    intro_p1: "The CloseOS Business API gives you programmatic access to your prospects, appointments and deals. It is REST-based, returns JSON, and authenticates via a Bearer API key. Real-time changes are delivered via HMAC-SHA256 signed webhooks.",
    intro_baseurl_label: 'Base URL',
    intro_format_label: 'Format',
    intro_auth_label: 'Authentication',
    intro_format_value: 'JSON over HTTPS',
    intro_auth_value: 'Bearer token',

    auth_h1: 'Authentication',
    auth_p1: 'Every inbound request must include your API key in the Authorization header. You can generate a key from the CRM integration modal, "CloseOS CRM" tab.',
    auth_step1: 'Sign in to your CloseOS Business workspace.',
    auth_step2: 'Open the CRM modal (CRM page → "CRM Integration" banner).',
    auth_step3: '"CloseOS CRM" tab → "Generate API key".',
    auth_step4: 'Copy the key. It starts with cos_ and is not re-displayed — store it securely.',
    auth_warning: '⚠️ Never commit the key to a public repo. Store it in a server-side environment variable.',

    qs_h1: 'Quick Start',
    qs_p1: 'Three steps to push your first prospect.',
    qs_step1: 'Set your API key as an environment variable.',
    qs_step2: 'Make your first POST request with cURL or your favorite language.',
    qs_step3: 'You receive 201 Created with the prospect object in the response.',

    ep_h1: 'REST Endpoint — Create/Update a prospect',
    ep_intro: 'A single endpoint is used to create or update a prospect. If you provide external_id, the call becomes idempotent: a second POST with the same external_id updates the existing row instead of duplicating it.',
    ep_method: 'Method',
    ep_path: 'Path',
    ep_url: 'Full URL',
    ep_response: 'Responses',
    ep_response_201: '201 Created — new prospect created',
    ep_response_200: '200 OK — existing prospect updated (idempotency)',
    ep_response_400: '400 Bad Request — required fields missing or invalid JSON',
    ep_response_401: '401 Unauthorized — API key missing or invalid',
    ep_response_403: '403 Forbidden — API key disabled',
    ep_response_500: '500 Internal Server Error — server-side error',

    f_h1: 'Supported fields',
    f_p1: 'All native CloseOS Business fields are recognized. Any unknown field is preserved in metadata.',

    idem_h1: 'Idempotency',
    idem_p1: 'For critical integrations, provide a stable external_id (ID from your external system, hash of an email, etc.). CloseOS first looks up by (user_id, external_id) then by email, and performs an UPDATE instead of an INSERT if the prospect already exists.',
    idem_p2: 'Outbound webhooks emitted depend on the result:',
    idem_b_created: 'INSERT → prospect.created',
    idem_b_updated: 'UPDATE without stage change → prospect.updated',
    idem_b_stage: 'UPDATE with stage change → prospect.stage_changed (with previous_stage and new_stage)',
    idem_b_won: 'If new_stage = "won" → deal.won is also fired',
    idem_b_lost: 'If new_stage = "lost" → deal.lost is also fired',

    wh_h1: 'Outbound webhooks',
    wh_p1: 'Set up an endpoint that will receive a signed POST for every lifecycle event. To add a webhook: CRM modal → "CloseOS CRM" tab → "Outbound webhooks" section → URL + event selection → Add.',
    wh_payload_h: 'Payload format',
    wh_payload_p: 'All payloads share the same envelope. The data field contains the full business_prospects row, plus previous_stage and new_stage for stage changes.',
    wh_headers_h: 'HTTP headers',

    ev_h1: 'Event catalog',
    ev_p1: '10 lifecycle events are available. You can subscribe to a subset per webhook.',

    sig_h1: 'Verify the HMAC signature',
    sig_p1: "Every webhook carries an X-CloseOS-Signature header which is an HMAC-SHA256 hex of the full envelope, signed with the subscription's secret. Verify it to authenticate the origin.",
    sig_warn: '⚠️ The body to hash is the full stringified envelope { event, product, user_id, timestamp, data } as received on the socket — not just the data field. Use the raw body when possible (req.rawBody) to avoid whitespace/key-order discrepancies.',

    err_h1: 'Error codes',
    err_p1: 'The API returns standard HTTP codes. The JSON body contains an error field with a human-readable message.',

    rl_h1: 'Rate limits',
    rl_p1: 'No rate limit is enforced today on the CloseOS Business API — you can use it without a functional cap. For infrastructure robustness, the API may return a 503 during server load spikes; implement an exponential-backoff retry for those cases. If you need a dedicated SLA, contact us.',

    cl_h1: 'Changelog',
    cl_v1_date: '2026-04-26 — v1.0',
    cl_v1_item1: 'Public launch of the CloseOS Business API.',
    cl_v1_item2: 'Endpoint POST /api/zapier-webhook?type=business with idempotency via external_id.',
    cl_v1_item3: '10 outbound webhook events (prospect / appointment / deal / campaign).',
    cl_v1_item4: 'HMAC-SHA256 signatures on all webhooks.',

    lbl_required: 'Required',
    lbl_optional: 'Optional',
    lbl_field: 'Field',
    lbl_type: 'Type',
    lbl_description: 'Description',
    lbl_event: 'Event',
    lbl_when: 'Triggered when',
    lbl_code: 'Code',
    lbl_meaning: 'Meaning',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Section catalog (id used as anchor + nav)
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'introduction',  group: 'getting_started', icon: BookOpen,    labelKey: 'nav_intro' },
  { id: 'authentication', group: 'getting_started', icon: Key,         labelKey: 'nav_auth' },
  { id: 'quickstart',    group: 'getting_started', icon: Zap,         labelKey: 'nav_quickstart' },
  { id: 'endpoint',      group: 'reference',       icon: Terminal,    labelKey: 'nav_endpoint' },
  { id: 'fields',        group: 'reference',       icon: Code2,       labelKey: 'nav_fields' },
  { id: 'idempotency',   group: 'reference',       icon: Sparkles,    labelKey: 'nav_idempotency' },
  { id: 'webhooks',      group: 'webhooks',        icon: Webhook,     labelKey: 'nav_webhooks' },
  { id: 'events',        group: 'webhooks',        icon: ChevronRight, labelKey: 'nav_events' },
  { id: 'signature',     group: 'webhooks',        icon: ShieldCheck, labelKey: 'nav_signature' },
  { id: 'errors',        group: 'misc',            icon: AlertCircle, labelKey: 'nav_errors' },
  { id: 'ratelimit',     group: 'misc',            icon: Zap,         labelKey: 'nav_ratelimit' },
  { id: 'changelog',     group: 'misc',            icon: BookOpen,    labelKey: 'nav_changelog' },
] as const

const GROUPS_FR: Record<string, string> = {
  getting_started: 'Démarrer',
  reference: 'Référence API',
  webhooks: 'Webhooks',
  misc: 'Annexes',
}
const GROUPS_EN: Record<string, string> = {
  getting_started: 'Getting started',
  reference: 'API Reference',
  webhooks: 'Webhooks',
  misc: 'Reference',
}

// ─────────────────────────────────────────────────────────────────────────────
// CodeBlock with copy + tabs (cURL / Node / Python)
// ─────────────────────────────────────────────────────────────────────────────

interface CodeBlockProps {
  label?: string
  language?: string
  children: string
}

const CodeBlock = ({ label, language, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/40 my-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          {(language || label) && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">{language || label}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-[11px] font-bold text-stone-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
        >
          {copied ? <><Check className="size-3" /> Copié</> : <><Copy className="size-3" /> Copier</>}
        </button>
      </div>
      <pre className="p-5 text-[12px] leading-relaxed font-mono text-stone-300 overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  )
}

interface MultiCodeBlockProps {
  examples: Array<{ language: string; code: string }>
}

const MultiCodeBlock = ({ examples }: MultiCodeBlockProps) => {
  const [activeIdx, setActiveIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const active = examples[activeIdx]
  const handleCopy = () => {
    navigator.clipboard.writeText(active.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/40 my-4">
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#161b22] border-b border-white/5">
        <div className="flex items-center gap-1">
          {examples.map((ex, i) => (
            <button
              key={ex.language}
              onClick={() => setActiveIdx(i)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors ${
                i === activeIdx ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              {ex.language}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="text-[11px] font-bold text-stone-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
        >
          {copied ? <><Check className="size-3" /> Copié</> : <><Copy className="size-3" /> Copier</>}
        </button>
      </div>
      <pre className="p-5 text-[12px] leading-relaxed font-mono text-stone-300 overflow-x-auto whitespace-pre">{active.code}</pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Code samples
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_START_BASH = `export CLOSEOS_API_KEY="cos_..."

curl -X POST "https://app.closeos.fr/api/zapier-webhook?type=business" \\
  -H "Authorization: Bearer $CLOSEOS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@exemple.com",
    "phone": "+33612345678",
    "stage": "qualified",
    "external_id": "crm-12345"
  }'`

const QUICK_START_NODE = `import fetch from 'node-fetch'

const res = await fetch('https://app.closeos.fr/api/zapier-webhook?type=business', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.CLOSEOS_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@exemple.com',
    phone: '+33612345678',
    stage: 'qualified',
    external_id: 'crm-12345',
  }),
})
const data = await res.json()
console.log(data.prospect.id)`

const QUICK_START_PY = `import os
import requests

res = requests.post(
    "https://app.closeos.fr/api/zapier-webhook?type=business",
    headers={
        "Authorization": f"Bearer {os.environ['CLOSEOS_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "firstName": "Jean",
        "lastName": "Dupont",
        "email": "jean@exemple.com",
        "phone": "+33612345678",
        "stage": "qualified",
        "external_id": "crm-12345",
    },
)
print(res.json()["prospect"]["id"])`

const FULL_PAYLOAD_EXAMPLE = `{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@exemple.com",
  "phone": "+33612345678",
  "company": "Acme",
  "stage": "qualified",
  "status": "hot",
  "value": 4900,
  "offer_id": 12,
  "formula_id": "starter",
  "external_id": "crm-12345",
  "campaign_id": 7,
  "assigned_to": "uuid-of-team-member",
  "loss_reason": null,
  "payment_type": "once",
  "installments": null,
  "probability": 80,
  "last_contact": "2026-04-26T10:00:00.000Z",
  "answers": [
    { "question": "Quel est votre budget ?", "answer": "5-10k€" },
    { "question": "Délai souhaité ?",        "answer": "Sous 1 mois" }
  ],
  "metadata": {
    "utm_source": "linkedin",
    "utm_campaign": "spring-2026",
    "any_custom_field": "any value"
  },
  "call_notes": [
    { "date": "2026-04-26", "note": "Premier appel ok" }
  ],
  "notes": "Lead très chaud, à recontacter rapidement."
}`

const WEBHOOK_PAYLOAD_EXAMPLE = `{
  "event": "prospect.stage_changed",
  "product": "business",
  "user_id": "uuid-of-business-owner",
  "timestamp": "2026-04-26T12:00:00.000Z",
  "data": {
    "id": 4321,
    "contact": "Jean Dupont",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@exemple.com",
    "phone": "+33612345678",
    "stage": "won",
    "previous_stage": "qualified",
    "new_stage": "won",
    "value": 4900,
    "external_id": "crm-12345",
    "lead_answers": [...],
    "metadata": {...},
    "created_at": "2026-04-26T10:00:00.000Z"
  }
}`

const WEBHOOK_HEADERS_EXAMPLE = `POST /votre-endpoint HTTP/1.1
Host: votre-app.com
Content-Type: application/json
X-CloseOS-Event: prospect.stage_changed
X-CloseOS-Product: business
X-CloseOS-Signature: 7f3a9b2e1c4d8a... (hex HMAC-SHA256)`

const SIG_NODE = `import crypto from 'crypto'
import express from 'express'

const app = express()
// Important: capture the raw body BEFORE JSON parsing
app.use(express.json({
  verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8') }
}))

app.post('/webhook', (req, res) => {
  const sig = req.headers['x-closeos-signature']
  const expected = crypto.createHmac('sha256', process.env.CLOSEOS_SECRET!)
    .update((req as any).rawBody)
    .digest('hex')
  if (sig !== expected) return res.status(401).send('Invalid signature')

  const { event, data } = req.body
  // ... handle event
  res.status(200).send('ok')
})`

const SIG_PY = `import os, hmac, hashlib
from flask import Flask, request, abort

app = Flask(__name__)

@app.post("/webhook")
def webhook():
    sig = request.headers.get("X-CloseOS-Signature", "")
    expected = hmac.new(
        os.environ["CLOSEOS_SECRET"].encode(),
        request.get_data(),  # raw body
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        abort(401)
    payload = request.get_json()
    # ... handle payload["event"]
    return "ok"`

// ─────────────────────────────────────────────────────────────────────────────
// Static catalogs (events + fields + errors)
// ─────────────────────────────────────────────────────────────────────────────

const EVENTS = [
  { id: 'prospect.created',       fr_when: 'Un nouveau prospect arrive (manuel, API, capture, sync).',                en_when: 'A new prospect is created (manual, API, capture form, sync).' },
  { id: 'prospect.updated',       fr_when: 'Un champ du prospect change (autre que le stage).',                       en_when: 'A prospect field changes (other than the stage).' },
  { id: 'prospect.stage_changed', fr_when: 'Le stage change. Payload inclut previous_stage + new_stage.',             en_when: 'The stage changes. Payload includes previous_stage + new_stage.' },
  { id: 'prospect.deleted',       fr_when: 'Le prospect est supprimé.',                                               en_when: 'The prospect is deleted.' },
  { id: 'campaign.lead_captured', fr_when: 'Lead capturé via un formulaire de campagne.',                             en_when: 'Lead captured via a campaign form.' },
  { id: 'appointment.booked',     fr_when: 'Un RDV est réservé pour ce prospect (Calendly, capture, manuel).',        en_when: 'An appointment is booked for this prospect (Calendly, capture, manual).' },
  { id: 'appointment.cancelled',  fr_when: 'Un RDV est annulé.',                                                      en_when: 'An appointment is cancelled.' },
  { id: 'appointment.completed',  fr_when: 'Un RDV est marqué comme terminé.',                                        en_when: 'An appointment is marked completed.' },
  { id: 'deal.won',               fr_when: 'Stage devient "won" OU souscription Stripe active.',                       en_when: 'Stage becomes "won" OR Stripe subscription becomes active.' },
  { id: 'deal.lost',              fr_when: 'Stage devient "lost" OU souscription Stripe annulée.',                    en_when: 'Stage becomes "lost" OR Stripe subscription cancelled.' },
]

const FIELDS = [
  { name: 'firstName',     type: 'string',                  required: 'one_of', fr_desc: 'Prénom du prospect.',                                                                       en_desc: 'Prospect first name.' },
  { name: 'lastName',      type: 'string',                  required: 'one_of', fr_desc: 'Nom du prospect.',                                                                          en_desc: 'Prospect last name.' },
  { name: 'email',         type: 'string',                  required: 'one_of', fr_desc: 'Email — utilisé comme clé secondaire d\'idempotence si external_id absent.',                en_desc: 'Email — used as secondary idempotency key if external_id is absent.' },
  { name: 'phone',         type: 'string',                  required: 'one_of', fr_desc: 'Téléphone E.164.',                                                                          en_desc: 'Phone in E.164 format.' },
  { name: 'company',       type: 'string',                  required: 'optional', fr_desc: 'Nom de l\'entreprise.',                                                                   en_desc: 'Company name.' },
  { name: 'stage',         type: 'string',                  required: 'optional', fr_desc: 'Stage du pipeline. Valeurs : prospect, qualified, won, followup, noshow, lost.',          en_desc: 'Pipeline stage. Values: prospect, qualified, won, followup, noshow, lost.' },
  { name: 'status',        type: 'string',                  required: 'optional', fr_desc: 'Sous-statut libre (hot, cold, etc.).',                                                    en_desc: 'Free-form sub-status (hot, cold, etc.).' },
  { name: 'value',         type: 'number',                  required: 'optional', fr_desc: 'Valeur monétaire du deal.',                                                               en_desc: 'Deal monetary value.' },
  { name: 'offer_id',      type: 'integer',                 required: 'optional', fr_desc: 'ID d\'une offre CloseOS Business existante.',                                              en_desc: 'ID of an existing CloseOS Business offer.' },
  { name: 'formula_id',    type: 'string',                  required: 'optional', fr_desc: 'Identifiant de la formule choisie.',                                                      en_desc: 'Chosen formula identifier.' },
  { name: 'campaign_id',   type: 'uuid',                    required: 'optional', fr_desc: 'ID de la campagne d\'acquisition associée.',                                              en_desc: 'Acquisition campaign ID.' },
  { name: 'assigned_to',   type: 'uuid',                    required: 'optional', fr_desc: 'ID du closer assigné.',                                                                   en_desc: 'Assigned closer ID.' },
  { name: 'loss_reason',   type: 'string',                  required: 'optional', fr_desc: 'Raison de perte si stage = lost.',                                                        en_desc: 'Loss reason when stage = lost.' },
  { name: 'payment_type',  type: 'string',                  required: 'optional', fr_desc: 'Type de paiement (once, installments, cash, comptant).',                                  en_desc: 'Payment type (once, installments, cash).' },
  { name: 'installments',  type: 'integer',                 required: 'optional', fr_desc: 'Nombre d\'échéances.',                                                                    en_desc: 'Number of installments.' },
  { name: 'probability',   type: 'number',                  required: 'optional', fr_desc: 'Probabilité de closing (0-100).',                                                         en_desc: 'Closing probability (0-100).' },
  { name: 'last_contact',  type: 'ISO 8601',                required: 'optional', fr_desc: 'Date du dernier contact.',                                                                en_desc: 'Last contact date.' },
  { name: 'notes',         type: 'string',                  required: 'optional', fr_desc: 'Notes en texte libre.',                                                                   en_desc: 'Free-text notes.' },
  { name: 'call_notes',    type: 'array<{date,note}>',      required: 'optional', fr_desc: 'Notes d\'appel structurées.',                                                              en_desc: 'Structured call notes.' },
  { name: 'answers',       type: 'array<{question,answer}>', required: 'optional', fr_desc: 'Réponses à un questionnaire externe (alias: lead_answers).',                              en_desc: 'External questionnaire answers (alias: lead_answers).' },
  { name: 'metadata',      type: 'object',                  required: 'optional', fr_desc: 'Champs custom arbitraires. Tout champ non listé ici est aussi conservé dans metadata.',   en_desc: 'Arbitrary custom fields. Any field not listed here is also preserved in metadata.' },
  { name: 'external_id',   type: 'string',                  required: 'optional', fr_desc: 'ID stable côté votre système. Active l\'idempotence sur les POST suivants.',              en_desc: 'Stable ID from your system. Enables idempotency on subsequent POSTs.' },
]

const ERRORS = [
  { code: 200, fr: 'OK — prospect mis à jour (idempotence).',                en: 'OK — prospect updated (idempotency).' },
  { code: 201, fr: 'Created — nouveau prospect créé.',                       en: 'Created — new prospect created.' },
  { code: 400, fr: 'Bad Request — champs requis manquants ou JSON invalide.', en: 'Bad Request — required fields missing or invalid JSON.' },
  { code: 401, fr: 'Unauthorized — clé API absente ou invalide.',            en: 'Unauthorized — API key missing or invalid.' },
  { code: 403, fr: 'Forbidden — clé API désactivée.',                        en: 'Forbidden — API key disabled.' },
  { code: 405, fr: 'Method Not Allowed — utilisez POST.',                    en: 'Method Not Allowed — use POST.' },
  { code: 500, fr: 'Internal Server Error — erreur côté serveur.',           en: 'Internal Server Error — server-side error.' },
  { code: 503, fr: 'Service Unavailable — surcharge temporaire, retry exponentiel.', en: 'Service Unavailable — temporary overload, exponential retry.' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function BusinessDocsAPI() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('closeos-business-lang')
      if (stored === 'fr' || stored === 'en') return stored
    }
    return typeof navigator !== 'undefined' && navigator.language?.startsWith('fr') ? 'fr' : 'en'
  })

  const t = I18N[lang]
  const groupLabels = lang === 'fr' ? GROUPS_FR : GROUPS_EN

  const persistLang = useCallback((l: Lang) => {
    setLang(l)
    try { localStorage.setItem('closeos-business-lang', l) } catch {}
  }, [])

  // Active section tracking
  const [activeId, setActiveId] = useState<string>('introduction')

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const visible = new Set<string>()
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (!el) return
      const obs = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(s.id)
          else visible.delete(s.id)
        }
        // pick first SECTION that's visible
        for (const sec of SECTIONS) {
          if (visible.has(sec.id)) { setActiveId(sec.id); return }
        }
      }, { rootMargin: '-20% 0px -70% 0px' })
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  const groupedNav = useMemo(() => {
    const groups: Record<string, typeof SECTIONS[number][]> = {}
    for (const s of SECTIONS) {
      if (!groups[s.group]) groups[s.group] = []
      groups[s.group].push(s)
    }
    return groups
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between gap-4">
          <Link to="/business" className="flex items-center gap-3 group">
            <ArrowLeft className="size-4 text-stone-400 group-hover:text-white transition-colors" />
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-lg tracking-tight">CloseOS</span>
              <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-stone-500">Business · Docs</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
              <button
                onClick={() => persistLang('fr')}
                className={`text-[11px] font-bold px-3 py-1 rounded-full transition-colors ${lang === 'fr' ? 'bg-white text-black' : 'text-stone-400 hover:text-white'}`}
              >FR</button>
              <button
                onClick={() => persistLang('en')}
                className={`text-[11px] font-bold px-3 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-white text-black' : 'text-stone-400 hover:text-white'}`}
              >EN</button>
            </div>
            <Link
              to="/business"
              className="hidden sm:flex items-center gap-1.5 text-[12px] font-semibold text-stone-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors"
            >
              <Globe className="size-3.5" /> {t.backToLanding}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-10 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 sticky top-16 self-start py-12 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="space-y-6 text-sm">
            {Object.entries(groupedNav).map(([group, items]) => (
              <div key={group}>
                <h4 className="text-[10px] uppercase font-bold tracking-[0.18em] text-stone-500 mb-2 px-3">{groupLabels[group]}</h4>
                <ul className="space-y-0.5">
                  {items.map(s => {
                    const Icon = s.icon
                    const isActive = activeId === s.id
                    return (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                            isActive
                              ? 'bg-white/10 text-white font-semibold'
                              : 'text-stone-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon className="size-3.5 shrink-0" />
                          <span>{(t as any)[s.labelKey]}</span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 py-12 pb-32 space-y-24 max-w-3xl">
          {/* Hero */}
          <section className="border-b border-white/5 pb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles className="size-3 text-[#d511fd]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] bg-gradient-to-r from-[#ff2f2f] via-[#ef7b16] to-[#d511fd] text-transparent bg-clip-text">{t.badge}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ letterSpacing: '-0.03em' }}>{t.productName}</h1>
            <p className="text-stone-400 text-lg leading-relaxed">{t.tagline}</p>
          </section>

          {/* Introduction */}
          <Section id="introduction" title={t.intro_h1}>
            <p className="text-stone-300 leading-relaxed">{t.intro_p1}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <InfoCard label={t.intro_baseurl_label} value="https://app.closeos.fr" />
              <InfoCard label={t.intro_format_label} value={t.intro_format_value} />
              <InfoCard label={t.intro_auth_label} value={t.intro_auth_value} />
            </div>
          </Section>

          {/* Authentication */}
          <Section id="authentication" title={t.auth_h1}>
            <p className="text-stone-300 leading-relaxed">{t.auth_p1}</p>
            <ol className="list-decimal list-inside space-y-2 text-stone-300 mt-6 ml-2">
              <li>{t.auth_step1}</li>
              <li>{t.auth_step2}</li>
              <li>{t.auth_step3}</li>
              <li>{t.auth_step4}</li>
            </ol>
            <Callout tone="warn" className="mt-6">{t.auth_warning}</Callout>
            <CodeBlock language="HTTP" >{`Authorization: Bearer cos_a1b2c3d4...`}</CodeBlock>
          </Section>

          {/* Quick Start */}
          <Section id="quickstart" title={t.qs_h1}>
            <p className="text-stone-300 leading-relaxed">{t.qs_p1}</p>
            <ol className="list-decimal list-inside space-y-2 text-stone-300 mt-4 ml-2">
              <li>{t.qs_step1}</li>
              <li>{t.qs_step2}</li>
              <li>{t.qs_step3}</li>
            </ol>
            <MultiCodeBlock examples={[
              { language: 'cURL', code: QUICK_START_BASH },
              { language: 'Node.js', code: QUICK_START_NODE },
              { language: 'Python', code: QUICK_START_PY },
            ]} />
          </Section>

          {/* Endpoint */}
          <Section id="endpoint" title={t.ep_h1}>
            <p className="text-stone-300 leading-relaxed">{t.ep_intro}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <InfoCard label={t.ep_method} value="POST" highlight />
              <InfoCard label={t.ep_path} value="/api/zapier-webhook?type=business" />
              <InfoCard label={t.ep_url} value="app.closeos.fr/api/..." />
            </div>

            <h3 className="text-base font-bold mt-10 mb-3">{t.ep_response}</h3>
            <div className="space-y-2">
              <ResponseRow code={201} text={t.ep_response_201} />
              <ResponseRow code={200} text={t.ep_response_200} />
              <ResponseRow code={400} text={t.ep_response_400} />
              <ResponseRow code={401} text={t.ep_response_401} />
              <ResponseRow code={403} text={t.ep_response_403} />
              <ResponseRow code={500} text={t.ep_response_500} />
            </div>

            <h3 className="text-base font-bold mt-10 mb-3">Body — {lang === 'fr' ? 'exemple complet' : 'full example'}</h3>
            <CodeBlock language="JSON">{FULL_PAYLOAD_EXAMPLE}</CodeBlock>
          </Section>

          {/* Fields */}
          <Section id="fields" title={t.f_h1}>
            <p className="text-stone-300 leading-relaxed">{t.f_p1}</p>
            <p className="text-stone-400 text-sm mt-4 italic">{lang === 'fr' ? 'Au moins un parmi : firstName, lastName, email, phone est requis.' : 'At least one of: firstName, lastName, email, phone is required.'}</p>
            <div className="overflow-x-auto rounded-2xl border border-white/10 mt-6">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_field}</th>
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_type}</th>
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_description}</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map(f => (
                    <tr key={f.name} className="border-t border-white/5">
                      <td className="px-4 py-3 align-top">
                        <code className="text-[12px] font-mono text-[#d511fd] bg-white/5 rounded px-1.5 py-0.5">{f.name}</code>
                        {f.required === 'one_of' && <span className="ml-2 text-[9px] uppercase font-bold text-amber-400 tracking-wider">one-of</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-stone-400 font-mono text-[12px]">{f.type}</td>
                      <td className="px-4 py-3 align-top text-stone-300">{lang === 'fr' ? f.fr_desc : f.en_desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Idempotency */}
          <Section id="idempotency" title={t.idem_h1}>
            <p className="text-stone-300 leading-relaxed">{t.idem_p1}</p>
            <p className="text-stone-300 leading-relaxed mt-4">{t.idem_p2}</p>
            <ul className="list-disc list-inside space-y-1.5 text-stone-300 mt-4 ml-2">
              <li><code className="text-[12px] font-mono text-[#d511fd]">{t.idem_b_created}</code></li>
              <li><code className="text-[12px] font-mono text-[#d511fd]">{t.idem_b_updated}</code></li>
              <li><code className="text-[12px] font-mono text-[#d511fd]">{t.idem_b_stage}</code></li>
              <li><code className="text-[12px] font-mono text-[#d511fd]">{t.idem_b_won}</code></li>
              <li><code className="text-[12px] font-mono text-[#d511fd]">{t.idem_b_lost}</code></li>
            </ul>
          </Section>

          {/* Webhooks */}
          <Section id="webhooks" title={t.wh_h1}>
            <p className="text-stone-300 leading-relaxed">{t.wh_p1}</p>

            <h3 className="text-base font-bold mt-10 mb-3">{t.wh_payload_h}</h3>
            <p className="text-stone-300 leading-relaxed">{t.wh_payload_p}</p>
            <CodeBlock language="JSON">{WEBHOOK_PAYLOAD_EXAMPLE}</CodeBlock>

            <h3 className="text-base font-bold mt-10 mb-3">{t.wh_headers_h}</h3>
            <CodeBlock language="HTTP">{WEBHOOK_HEADERS_EXAMPLE}</CodeBlock>
          </Section>

          {/* Events */}
          <Section id="events" title={t.ev_h1}>
            <p className="text-stone-300 leading-relaxed">{t.ev_p1}</p>
            <div className="overflow-x-auto rounded-2xl border border-white/10 mt-6">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_event}</th>
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_when}</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map(ev => (
                    <tr key={ev.id} className="border-t border-white/5">
                      <td className="px-4 py-3 align-top">
                        <code className="text-[12px] font-mono text-[#d511fd] bg-white/5 rounded px-1.5 py-0.5 whitespace-nowrap">{ev.id}</code>
                      </td>
                      <td className="px-4 py-3 align-top text-stone-300">{lang === 'fr' ? ev.fr_when : ev.en_when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Signature */}
          <Section id="signature" title={t.sig_h1}>
            <p className="text-stone-300 leading-relaxed">{t.sig_p1}</p>
            <Callout tone="warn" className="mt-6">{t.sig_warn}</Callout>
            <MultiCodeBlock examples={[
              { language: 'Node.js', code: SIG_NODE },
              { language: 'Python', code: SIG_PY },
            ]} />
          </Section>

          {/* Errors */}
          <Section id="errors" title={t.err_h1}>
            <p className="text-stone-300 leading-relaxed">{t.err_p1}</p>
            <div className="overflow-x-auto rounded-2xl border border-white/10 mt-6">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_code}</th>
                    <th className="px-4 py-3 font-bold text-stone-300">{t.lbl_meaning}</th>
                  </tr>
                </thead>
                <tbody>
                  {ERRORS.map(e => (
                    <tr key={e.code} className="border-t border-white/5">
                      <td className="px-4 py-3 align-top">
                        <code className={`text-[12px] font-mono px-1.5 py-0.5 rounded ${
                          e.code < 300 ? 'bg-emerald-500/10 text-emerald-300' :
                          e.code < 500 ? 'bg-amber-500/10 text-amber-300' :
                          'bg-red-500/10 text-red-300'
                        }`}>{e.code}</code>
                      </td>
                      <td className="px-4 py-3 align-top text-stone-300">{lang === 'fr' ? e.fr : e.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Rate limits */}
          <Section id="ratelimit" title={t.rl_h1}>
            <p className="text-stone-300 leading-relaxed">{t.rl_p1}</p>
          </Section>

          {/* Changelog */}
          <Section id="changelog" title={t.cl_h1}>
            <div className="rounded-2xl border border-white/10 p-6 bg-white/[0.02]">
              <h3 className="font-bold text-base mb-3">{t.cl_v1_date}</h3>
              <ul className="list-disc list-inside space-y-1.5 text-stone-300 ml-2 text-sm">
                <li>{t.cl_v1_item1}</li>
                <li>{t.cl_v1_item2}</li>
                <li>{t.cl_v1_item3}</li>
                <li>{t.cl_v1_item4}</li>
              </ul>
            </div>
          </Section>
        </main>
      </div>

      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between text-stone-500 text-xs">
          <span>© 2026 CloseOS</span>
          <Link to="/business" className="hover:text-white transition-colors">{t.backToLanding} →</Link>
        </div>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-3xl font-bold tracking-tight mb-6 group flex items-center gap-3" style={{ letterSpacing: '-0.02em' }}>
      <a href={`#${id}`} className="text-stone-600 group-hover:text-stone-300 transition-colors text-2xl">#</a>
      <span>{title}</span>
    </h2>
    <div className="space-y-2">{children}</div>
  </section>
)

const InfoCard = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-xl border border-white/10 p-4 ${highlight ? 'bg-gradient-to-br from-[#d511fd]/10 to-[#8a43e1]/5' : 'bg-white/[0.02]'}`}>
    <p className="text-[10px] uppercase font-bold tracking-[0.18em] text-stone-500 mb-1.5">{label}</p>
    <p className="font-mono text-sm break-all">{value}</p>
  </div>
)

const ResponseRow = ({ code, text }: { code: number; text: string }) => {
  const codeColor =
    code < 300 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
    code < 500 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
    'bg-red-500/10 text-red-300 border-red-500/20'
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`shrink-0 text-[12px] font-mono font-bold px-2.5 py-1 rounded border ${codeColor}`}>{code}</span>
      <span className="text-stone-300 text-sm">{text}</span>
    </div>
  )
}

const Callout = ({ tone, children, className = '' }: { tone: 'warn' | 'info'; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border px-4 py-3 text-sm ${
    tone === 'warn'
      ? 'bg-amber-500/5 border-amber-500/20 text-amber-200'
      : 'bg-blue-500/5 border-blue-500/20 text-blue-200'
  } ${className}`}>
    {children}
  </div>
)
