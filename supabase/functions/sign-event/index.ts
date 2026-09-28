// CloseOS Sign — journalisation d'événements côté signataire AVEC capture d'IP serveur.
// Le client ne connaît pas son IP publique : on passe par cette fonction pour l'enregistrer.
// POST { token, type:'opened'|'downloaded', email?, visitor? }. verify_jwt=false (autorisé par le token).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clientIp = (req: Request): string | null => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

const ALLOWED = new Set(["opened", "downloaded"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json();
    const { token, type } = body;
    if (!token || !ALLOWED.has(type)) return json({ ok: false, error: "params" }, 400);

    // Résout le signataire par token (fallback legacy sur le contrat)
    const { data: signer } = await supabase.from("sign_contract_signers").select("contract_id,signer_index,email").eq("access_token", token).maybeSingle();
    let contractId = signer?.contract_id ?? null;
    const signerIndex = signer?.signer_index ?? 1;
    if (!contractId) {
      const { data: c } = await supabase.from("sign_contracts").select("id").eq("access_token", token).maybeSingle();
      contractId = c?.id ?? null;
    }
    if (!contractId) return json({ ok: false, error: "contract" });

    // 'opened' : marque aussi le signataire 'opened' (sans écraser un statut plus avancé)
    if (type === "opened" && signer && (signer as any).contract_id) {
      await supabase.from("sign_contract_signers").update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("access_token", token).in("status", ["pending", "sent"]);
    }

    await supabase.from("sign_signature_events").insert({
      contract_id: contractId,
      event_type: type,
      email: String(body.email || signer?.email || "").trim() || null,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
      metadata: { signer_index: signerIndex, visitor: body.visitor ?? null },
    });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
