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
