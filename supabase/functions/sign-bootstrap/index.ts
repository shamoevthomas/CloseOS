// CloseOS Sign — bootstrap NEUTRALISÉ (le compte propriétaire a été créé ; one-shot terminé).
// Désactivé pour ne pas laisser un créateur de comptes accessible. À supprimer du projet.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: "gone" }), { status: 410, headers: { "Content-Type": "application/json" } }));
