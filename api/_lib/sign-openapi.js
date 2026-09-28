// CloseOS Sign — description OpenAPI 3.1 de l'API REST v1 (servie par api/sign-v1.js).

const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema) => ({ content: { 'application/json': { schema } } })
const errors = (...codes) => Object.fromEntries(codes.map((c) => [String(c), { $ref: `#/components/responses/E${c}` }]))
const idParam = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'string', format: 'uuid' } })
const ACCOUNT = { $ref: '#/components/parameters/Account' }
const IDEM = { $ref: '#/components/parameters/IdempotencyKey' }
const CID = idParam('id', 'Identifiant du contrat')
const SID = idParam('sid', 'Identifiant du signataire (signers[].id)')

export function openapi(appUrl) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'CloseOS Sign API',
      version: '1.0.0',
      description: [
        "Signature électronique pour les plateformes partenaires. Une plateforme crée ses comptes artisans, puis, pour chacun, envoie des PDF à signer, suit les signatures et récupère le PDF signé et le certificat de preuve.",
        '',
        "Authentification : `Authorization: Bearer <clé plateforme>`. Les routes /contracts agissent pour un artisan : en-tête `X-Sign-Account: <id du compte>`.",
        "Idempotence : tout POST accepte `Idempotency-Key` ; une requête rejouée avec la même clé renvoie la réponse d'origine (en-tête `Idempotent-Replayed: true`).",
        "Positions des champs : fractions de la page (0 = bord gauche/haut, 1 = bord droit/bas), quelle que soit la taille réelle du PDF.",
        'Taille maximale : 4,5 Mo par requête (PDF en base64 ≈ 3,3 Mo) ; au-delà, passer pdf_url (15 Mo max, https public, sans redirection).',
      ].join('\n'),
    },
    servers: [{ url: `${appUrl}/api/sign/v1` }],
    security: [{ platformKey: [] }],
    paths: {
      '/accounts': {
        post: {
          summary: 'Créer un compte artisan',
          description: "Idempotent sur external_ref : renvoie 200 et le compte existant si la référence est déjà connue. Le compte n'a ni mot de passe ni abonnement ; `email` est l'adresse réelle de l'artisan (copie du certificat).",
          operationId: 'createAccount',
          parameters: [IDEM],
          requestBody: { required: true, ...json(ref('AccountInput')) },
          responses: { 201: { description: 'Créé', ...json(ref('Account')) }, 200: { description: 'Déjà existant', ...json(ref('Account')) }, ...errors(400, 401, 403) },
        },
      },
      '/accounts/{id}': {
        get: { summary: 'Lire un compte artisan', operationId: 'getAccount', parameters: [idParam('id', 'Identifiant du compte')], responses: { 200: { description: 'Compte', ...json(ref('Account')) }, ...errors(401, 403, 404) } },
      },
      '/contracts': {
        post: {
          summary: 'Créer un contrat (brouillon) à partir d\'un PDF',
          description: 'Le PDF est rangé dans un stockage privé ; ses dimensions réelles servent au placement des champs. `signers` et `fields` peuvent être fournis ici ou via les routes dédiées.',
          operationId: 'createContract',
          parameters: [ACCOUNT, IDEM],
          requestBody: { required: true, ...json(ref('ContractInput')) },
          responses: { 201: { description: 'Créé', ...json(ref('Contract')) }, ...errors(400, 401, 403, 404, 413, 422) },
        },
      },
      '/contracts/{id}': {
        get: { summary: 'État du contrat et de chaque signataire', operationId: 'getContract', parameters: [CID, ACCOUNT], responses: { 200: { description: 'Contrat', ...json(ref('Contract')) }, ...errors(401, 403, 404) } },
      },
      '/contracts/{id}/fields': {
        post: {
          summary: 'Poser des champs sur le PDF',
          operationId: 'placeFields',
          parameters: [CID, ACCOUNT, IDEM],
          requestBody: { required: true, ...json({ type: 'object', required: ['fields'], properties: { mode: { type: 'string', enum: ['append', 'replace'], default: 'append' }, fields: { type: 'array', maxItems: 200, items: ref('FieldInput') } } }) },
          responses: { 200: { description: 'Contrat', ...json(ref('Contract')) }, ...errors(400, 401, 403, 404, 409) },
        },
      },
      '/contracts/{id}/signers': {
        post: {
          summary: 'Définir les signataires',
          description: 'Remplace la liste des signataires du brouillon. Avec verification_method=email, un code est envoyé à l\'email du signataire avant la signature.',
          operationId: 'setSigners',
          parameters: [CID, ACCOUNT, IDEM],
          requestBody: { required: true, ...json(ref('SignersInput')) },
          responses: { 200: { description: 'Contrat', ...json(ref('Contract')) }, ...errors(400, 401, 403, 404, 409) },
        },
      },
      '/contracts/{id}/send': {
        post: {
          summary: 'Envoyer le contrat à signer',
          description: "Exige un email et au moins un champ signature par signataire. Envoie l'invitation par email (sauf notify=false) ; en ordre séquentiel, seul le premier signataire est invité, les suivants le sont automatiquement à leur tour. Les liens expirent après expires_in_days (30 par défaut).",
          operationId: 'sendContract',
          parameters: [CID, ACCOUNT, IDEM],
          requestBody: { required: false, ...json({ type: 'object', properties: { notify: { type: 'boolean', default: true }, expires_in_days: { type: ['integer', 'null'], minimum: 1, maximum: 365, default: 30, description: 'null = sans expiration' } } }) },
          responses: {
            200: { description: 'Envoyé', ...json({ allOf: [ref('Contract'), { type: 'object', properties: { notifications: { type: 'array', items: { type: 'object', properties: { signer_id: { type: 'string' }, notified: { type: 'boolean' }, error: { type: 'string' } } } } } }] }) },
            ...errors(400, 401, 403, 404, 409, 422),
          },
        },
      },
      '/contracts/{id}/signers/{sid}/unlock': {
        post: { summary: 'Débloquer un signataire (trop de codes erronés)', description: 'Remet ses essais à zéro ; son lien actuel redevient utilisable.', operationId: 'unlockSigner', parameters: [CID, SID, ACCOUNT, IDEM], responses: { 200: { description: 'Débloqué', ...json({ type: 'object', properties: { contract_id: { type: 'string' }, signer_id: { type: 'string' }, signer_index: { type: 'integer' }, unlocked: { type: 'boolean' } } }) }, ...errors(401, 403, 404, 409) } },
      },
      '/contracts/{id}/signers/{sid}/renew-link': {
        post: {
          summary: 'Nouveau lien de signature',
          description: "L'ancien lien cesse de fonctionner. Débloque aussi le signataire. Le nouveau lien repart pour 30 jours (ou expires_in_days).",
          operationId: 'renewSignerLink',
          parameters: [CID, SID, ACCOUNT, IDEM],
          requestBody: { required: false, ...json({ type: 'object', properties: { notify: { type: 'boolean', default: true }, expires_in_days: { type: 'integer', minimum: 1, maximum: 365 } } }) },
          responses: { 200: { description: 'Nouveau lien', ...json({ type: 'object', properties: { contract_id: { type: 'string' }, signer_id: { type: 'string' }, signer_index: { type: 'integer' }, url: { type: 'string' }, notified: { type: 'boolean' }, notify_error: { type: 'string' }, link_expires_at: { type: 'string', format: 'date-time' } } }) }, ...errors(400, 401, 403, 404, 409, 422) },
        },
      },
      '/contracts/{id}/document': {
        get: {
          summary: 'Télécharger le PDF (signé ou original)',
          description: 'Renvoie un lien temporaire (5 min). Sans `type` : le PDF signé si toutes les signatures sont réunies, sinon l\'original. `redirect=true` répond 302 vers le fichier.',
          operationId: 'getDocument',
          parameters: [CID, ACCOUNT, { name: 'type', in: 'query', schema: { type: 'string', enum: ['signed', 'original'] } }, { name: 'redirect', in: 'query', schema: { type: 'boolean' } }],
          responses: { 200: { description: 'Lien', ...json(ref('Download')) }, 302: { description: 'Redirection vers le fichier' }, ...errors(400, 401, 403, 404, 409) },
        },
      },
      '/contracts/{id}/certificate': {
        get: {
          summary: 'Télécharger le certificat de preuve',
          description: 'PDF signé suivi des pages de certificat (identités, vérifications, horodatages, empreintes). Disponible après la dernière signature.',
          operationId: 'getCertificate',
          parameters: [CID, ACCOUNT, { name: 'redirect', in: 'query', schema: { type: 'boolean' } }],
          responses: { 200: { description: 'Lien', ...json(ref('Download')) }, 302: { description: 'Redirection vers le fichier' }, ...errors(401, 403, 404, 409) },
        },
      },
      '/contracts/{id}/events': {
        get: { summary: 'Journal de preuve', operationId: 'listEvents', parameters: [CID, ACCOUNT], responses: { 200: { description: 'Événements', ...json({ type: 'object', properties: { data: { type: 'array', items: ref('Event') } } }) }, ...errors(401, 403, 404) } },
      },
    },
    components: {
      securitySchemes: { platformKey: { type: 'http', scheme: 'bearer', description: 'Clé API de la plateforme (affichée une seule fois à sa création).' } },
      parameters: {
        Account: { name: 'X-Sign-Account', in: 'header', required: true, description: 'Identifiant du compte artisan pour lequel la plateforme agit.', schema: { type: 'string', format: 'uuid' } },
        IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 200 } },
      },
      responses: Object.fromEntries([400, 401, 403, 404, 405, 409, 413, 422].map((c) => [`E${c}`, { description: 'Erreur', ...json(ref('Error')) }])),
      schemas: {
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string', examples: ['not_found', 'contract_not_draft', 'signature_field_missing'] }, message: { type: 'string' }, details: {} } } } },
        AccountInput: {
          type: 'object', required: ['external_ref'],
          properties: {
            external_ref: { type: 'string', maxLength: 200, description: "Identifiant de l'artisan dans la plateforme (unique)." },
            name: { type: 'string' }, company: { type: 'string', description: "Nom affiché dans l'invitation (« X vous invite à signer »)." },
            email: { type: 'string', format: 'email', description: "Email réel de l'artisan : copie du certificat." },
            phone: { type: 'string' }, siret: { type: 'string' }, address: { type: 'string' }, city: { type: 'string' },
          },
        },
        Account: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, external_ref: { type: 'string' }, name: { type: ['string', 'null'] }, company: { type: ['string', 'null'] }, email: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] }, siret: { type: ['string', 'null'] }, address: { type: ['string', 'null'] }, city: { type: ['string', 'null'] }, created_at: { type: 'string', format: 'date-time' } } },
        SignerInput: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string', description: 'Requis pour la vérification par SMS.' } } },
        SignersInput: {
          type: 'object', required: ['signers'],
          properties: {
            signers: { type: 'array', minItems: 1, maxItems: 10, items: ref('SignerInput'), description: 'Dans l\'ordre : le premier est le signataire n°1.' },
            verification_method: { type: 'string', enum: ['none', 'email', 'sms', 'email_sms'], description: 'email : code envoyé à l\'email du signataire avant la signature.' },
            signing_order: { type: 'string', enum: ['parallel', 'sequential'] },
          },
        },
        FieldInput: {
          type: 'object', required: ['type', 'x_pct', 'y_pct'],
          properties: {
            type: { type: 'string', enum: ['signature', 'initials', 'name', 'date', 'time', 'email', 'tel', 'address', 'city', 'siret', 'siren', 'tva', 'company_id', 'ape', 'checkbox', 'text'] },
            page: { type: 'integer', minimum: 1, default: 1 },
            x_pct: { type: 'number', minimum: 0, maximum: 1 }, y_pct: { type: 'number', minimum: 0, maximum: 1 },
            w_pct: { type: 'number', minimum: 0, maximum: 1, description: 'Largeur en fraction de la page (taille par défaut selon le type sinon).' },
            h_pct: { type: 'number', minimum: 0, maximum: 1 },
            signer_index: { type: 'integer', minimum: 1, default: 1 },
            required: { type: 'boolean', default: true },
            label: { type: 'string' },
          },
        },
        ContractInput: {
          type: 'object', required: ['title'],
          properties: {
            title: { type: 'string', maxLength: 200 },
            pdf_base64: { type: 'string', description: 'PDF en base64 (data URL acceptée).' },
            pdf_url: { type: 'string', format: 'uri', description: 'URL https publique du PDF (alternative à pdf_base64).' },
            signers: { type: 'array', items: ref('SignerInput') },
            verification_method: { type: 'string', enum: ['none', 'email', 'sms', 'email_sms'] },
            signing_order: { type: 'string', enum: ['parallel', 'sequential'] },
            fields: { type: 'array', items: ref('FieldInput') },
          },
        },
        Signer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }, index: { type: 'integer' }, name: { type: ['string', 'null'] }, email: { type: ['string', 'null'] },
            status: { type: 'string', enum: ['pending', 'sent', 'opened', 'signed', 'declined'] },
            sent_at: { type: ['string', 'null'], format: 'date-time' }, viewed_at: { type: ['string', 'null'], format: 'date-time' }, signed_at: { type: ['string', 'null'], format: 'date-time' },
            verification_locked: { type: 'boolean', description: 'Bloqué après trop de codes erronés : voir /unlock.' },
            verification_lock_reason: { type: ['string', 'null'] },
            link_expires_at: { type: ['string', 'null'], format: 'date-time' }, link_expired: { type: 'boolean' },
            sign_url: { type: ['string', 'null'], description: 'Lien de signature (une fois le signataire invité).' },
          },
        },
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }, title: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'sent', 'viewed', 'signed', 'paid', 'declined', 'expired', 'cancelled'] },
            completed: { type: 'boolean' }, source_type: { type: 'string' }, page_count: { type: 'integer' },
            pages: { type: 'array', items: { type: 'object', properties: { page: { type: 'integer' }, width_pt: { type: 'number' }, height_pt: { type: 'number' }, width_px: { type: 'integer' }, height_px: { type: 'integer' } } } },
            signing_order: { type: 'string' }, verification_method: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }, sent_at: { type: ['string', 'null'], format: 'date-time' }, viewed_at: { type: ['string', 'null'], format: 'date-time' }, signed_at: { type: ['string', 'null'], format: 'date-time' },
            document_hash: { type: ['string', 'null'], description: 'SHA-256 du PDF original.' },
            documents: { type: 'object', properties: { original: { type: 'boolean' }, signed: { type: 'boolean' }, certificate: { type: 'boolean' } } },
            signers: { type: 'array', items: ref('Signer') },
            fields: { type: 'array', items: { type: 'object' } },
          },
        },
        Download: { type: 'object', properties: { contract_id: { type: 'string' }, type: { type: 'string', enum: ['signed', 'original'] }, url: { type: 'string' }, expires_in: { type: 'integer' }, sha256: { type: ['string', 'null'] }, certificate_id: { type: 'string' }, certified_at: { type: 'string' } } },
        Event: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string', examples: ['sent', 'opened', 'otp_sent', 'otp_verified', 'signed', 'completed', 'sealed', 'unlocked', 'link_renewed'] }, created_at: { type: 'string', format: 'date-time' }, email: { type: ['string', 'null'] }, signer_index: { type: ['integer', 'null'] }, ip: { type: ['string', 'null'] }, user_agent: { type: ['string', 'null'] }, metadata: { type: 'object' } } },
      },
    },
  }
}
