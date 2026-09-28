// CloseOS Sign — règles d'accès partagées par les Edge Functions (sans API Deno : testées par Vitest).

/** Origines autorisées pour les retours d'onboarding Stripe (plus de redirection vers un domaine tiers). */
export const SIGN_ORIGINS = ["https://sign.closeos.fr", "https://close-os.vercel.app", "http://localhost:5173"];
export const DEFAULT_ORIGIN = "https://sign.closeos.fr";

export function safeOrigin(origin: unknown): string {
  const o = String(origin || "").replace(/\/$/, "");
  return SIGN_ORIGINS.includes(o) ? o : DEFAULT_ORIGIN;
}

/** Jeton porteur de l'en-tête Authorization, ou null. */
export function bearerToken(headers: Headers): string | null {
  const m = (headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/**
 * Décide qui peut agir sur un contrat dans sign-certificate :
 * - le signataire, par son token (résolu en contractId en amont) ;
 * - le propriétaire connecté, pour un contractId (régénération depuis l'éditeur) ;
 * - personne d'autre : un simple contractId ne suffit plus.
 */
export function certificateAccess(input: {
  tokenContractId: string | null;
  requestedContractId: string | null;
  sessionUserId: string | null;
  ownerOfRequested: string | null;
}): { contractId: string } | { error: "unauthorized" | "contract" } {
  if (input.tokenContractId) return { contractId: input.tokenContractId };
  if (!input.requestedContractId) return { error: "contract" };
  if (!input.sessionUserId) return { error: "unauthorized" };
  if (input.ownerOfRequested !== input.sessionUserId) return { error: "unauthorized" };
  return { contractId: input.requestedContractId };
}

/** En-têtes pour appeler le relais email CloseOS depuis une Edge Function. */
export function internalEmailHeaders(secret: string | null): Record<string, string> {
  return { "Content-Type": "application/json", ...(secret ? { "x-closeos-internal": secret } : {}) };
}

/**
 * Lien de signature expiré : date d'expiration passée et signataire pas encore signé
 * (un signataire qui a signé garde l'accès à son document). Sans date : jamais expiré.
 */
export function linkExpired(signer: { link_expires_at?: string | null; status?: string | null } | null | undefined, now = Date.now()): boolean {
  if (!signer || !signer.link_expires_at || signer.status === "signed") return false;
  const t = Date.parse(signer.link_expires_at);
  return Number.isFinite(t) && t <= now;
}

/** Scellement serveur (Vercel, api/sign-internal.ts) : PDF signé et certificat à la dernière signature. */
export const SERVER_SEAL_URL = "https://close-os.vercel.app/api/sign-internal?action=seal";

/**
 * Demande au serveur de sceller et certifier un contrat entièrement signé. Ne lève jamais :
 * renvoie l'issue (`certified`, `already`, `skipped`…) ou `failed` ; la page signataire garde
 * alors son chemin de secours.
 */
export async function requestServerSeal(
  contractId: string,
  headers: Record<string, string>,
  info: { ip?: string | null; ua?: string | null } = {},
  deps: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ status: string; certificateId?: string | null }> {
  if (!headers["x-closeos-internal"]) return { status: "failed" };
  try {
    const r = await (deps.fetch ?? fetch)(SERVER_SEAL_URL, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, ip: info.ip ?? null, ua: info.ua ?? null }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 50000),
    });
    const j = await r.json().catch(() => null);
    return r.ok && j?.ok ? { status: String(j.status), certificateId: j.certificateId ?? null } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

/** Certifié par le serveur (maintenant ou avant) : la page signataire n'a rien à produire. */
export const serverCertified = (status: string) => status === "certified" || status === "already";
