// Le MCP passe par la même couche de service que l'API REST : mêmes règles, sans email.
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from './fake-supabase';
import { fakeReq, fakeRes } from './helpers';

const KEY = 'sk_' + 'c'.repeat(48);
let handler: (req: any, res: any) => Promise<unknown>;
let fake: FakeSupabase;
let owner: any;
let pdf: Buffer;

beforeAll(async () => {
  vi.stubEnv('SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sb.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  handler = (await import('../../api/mcp.js')).default;
  const d = await PDFDocument.create();
  d.addPage([595.28, 841.89]);
  pdf = Buffer.from(await d.save());
});
beforeEach(() => {
  fake = new FakeSupabase().install();
  owner = fake.seed('sign_users', { email: 'owner@test.fr', mcp_key_hash: createHash('sha256').update(KEY).digest('hex') });
});
afterEach(() => { vi.unstubAllGlobals(); });

async function tool(name: string, args: Record<string, unknown>) {
  const res = fakeRes();
  await handler(fakeReq({ headers: { authorization: `Bearer ${KEY}` }, body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } }), res);
  const r = res.body.result;
  if (r.isError) throw new Error(r.content[0].text);
  return JSON.parse(r.content[0].text);
}

describe('api/mcp.js sur la couche de service', () => {
  it('importe en base64 dans la ligne (éditeur inchangé), pose les champs, envoie comme l\'app sans email', async () => {
    const imp = await tool('sign_import_contract', { title: 'Devis', pdf_base64: pdf.toString('base64'), contact_name: 'Marie', contact_email: 'marie@x.fr' });
    expect(imp.pages).toEqual([{ page: 1, width_px: 794, height_px: 1122 }]);
    const row = fake.table('sign_contracts')[0];
    expect(row.pdf_data).toMatch(/^data:application\/pdf;base64,/);
    expect(row.pdf_path).toBeUndefined();
    expect(fake.storage.size).toBe(0);

    const placed = await tool('sign_place_fields', { contract_id: imp.contract_id, fields: [{ type: 'signature', x_pct: 0.5, y_pct: 0.5 }] });
    expect(placed.fields_added).toBe(1);

    const sent = await tool('sign_send_contract', { contract_id: imp.contract_id });
    expect(sent.status).toBe('sent');
    expect(sent.signer_links[0].url).toMatch(/\/sign\/s\/[0-9a-f]{32}$/);
    expect(fake.table('sign_contract_signers')[0].status).toBe('sent');
    expect(fake.table('sign_contracts')[0].document_hash).toBe(createHash('sha256').update(row.pdf_data).digest('hex'));
    expect(fake.table('sign_signature_events')[0]).toMatchObject({ event_type: 'sent', metadata: { via: 'mcp', signer_index: 1 } });
    expect(fake.table('sign_contract_signers')[0].link_expires_at).toBeNull();
    expect(fake.emails).toHaveLength(0);

    // Second appel : renvoie les liens sans rien réécrire
    const again = await tool('sign_send_contract', { contract_id: imp.contract_id });
    expect(again.note).toMatch(/déjà envoyé/);
    expect(fake.table('sign_signature_events')).toHaveLength(1);

    const st = await tool('sign_get_status', { contract_id: imp.contract_id });
    expect(st).toMatchObject({ status: 'sent', fully_signed: false, field_count: 1 });
    expect(st.signers[0]).toMatchObject({ index: 1, email: 'marie@x.fr', status: 'sent', verification_locked: false });
  });

  it("n'envoie jamais un contrat déjà signé à nouveau (l'ancien outil le repassait en 'sent')", async () => {
    const c = fake.seed('sign_contracts', { user_id: owner.id, title: 'Signé', status: 'signed' });
    fake.seed('sign_contract_signers', { contract_id: c.id, signer_index: 1, status: 'signed', access_token: 't'.repeat(32) });
    const out = await tool('sign_send_contract', { contract_id: c.id });
    expect(out.status).toBe('signed');
    expect(fake.table('sign_contracts')[0].status).toBe('signed');
  });

  it('accepte une expiration optionnelle', async () => {
    const imp = await tool('sign_import_contract', { title: 'Devis', pdf_base64: pdf.toString('base64'), contact_email: 'm@x.fr' });
    await tool('sign_send_contract', { contract_id: imp.contract_id, expires_in_days: 5 });
    const exp = Date.parse(fake.table('sign_contract_signers')[0].link_expires_at) - Date.now();
    expect(exp).toBeGreaterThan(4.9 * 86400000);
  });
});
