import { describe, expect, it } from 'vitest';
import {
  assertPdf, corsOrigin, extractMcpKey, fetchPdfSafely, hashMcpKey, isPrivateAddress,
} from '../../api/_lib/sign-security.js';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Page >> endobj\n%%EOF');
const publicDns = async () => [{ address: '93.184.216.34' }];
const okFetch = (body: Buffer = PDF, extra: ResponseInit = {}) =>
  async () => new Response(body, { status: 200, ...extra });

describe('clé MCP', () => {
  it('hashe en SHA-256 hexadécimal', () => {
    // Valeur de référence : printf 'sk_test' | shasum -a 256
    expect(hashMcpKey('sk_test')).toBe('12b2820cf1639904311da5771de1e5bb65c77073fdc7c555df395942df42896b');
    expect(hashMcpKey('a')).not.toBe(hashMcpKey('b'));
  });

  it("préfère l'en-tête Bearer à l'URL", () => {
    expect(extractMcpKey({ headers: { authorization: 'Bearer sk_header' }, query: { key: 'sk_url' } }))
      .toEqual({ key: 'sk_header', fromUrl: false });
  });

  it("accepte encore la clé dans l'URL (connecteurs Claude)", () => {
    expect(extractMcpKey({ headers: {}, query: { key: 'sk_url' } })).toEqual({ key: 'sk_url', fromUrl: true });
  });
});

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'pas-une-ip',
  ])('refuse %s', (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::6810:85e5'])('accepte %s', (ip) =>
    expect(isPrivateAddress(ip)).toBe(false));
});

describe('fetchPdfSafely', () => {
  it('télécharge un PDF public en https', async () => {
    const bytes = await fetchPdfSafely('https://exemple.fr/devis.pdf', { lookup: publicDns, fetch: okFetch() });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it.each([
    ['http://exemple.fr/a.pdf', /https/],
    ['https://user:pass@exemple.fr/a.pdf', /identifiants/],
    ['https://exemple.fr:8443/a.pdf', /port 443/],
    ['https://localhost/a.pdf', /hôte non autorisé/],
    ['https://169.254.169.254/latest/meta-data', /adresse réseau/],
    ['https://[::1]/a.pdf', /adresse réseau/],
    ['file:///etc/passwd', /https/],
  ])('refuse %s', async (url, err) => {
    await expect(fetchPdfSafely(url, { lookup: publicDns, fetch: okFetch() })).rejects.toThrow(err);
  });

  it('refuse un nom de domaine qui résout vers une IP privée', async () => {
    const lookup = async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }];
    await expect(fetchPdfSafely('https://piege.exemple.fr/a.pdf', { lookup, fetch: okFetch() })).rejects.toThrow(/adresse réseau/);
  });

  it('ne suit pas les redirections', async () => {
    const fetch = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } });
    await expect(fetchPdfSafely('https://exemple.fr/a.pdf', { lookup: publicDns, fetch })).rejects.toThrow(/redirections/);
  });

  it('refuse un fichier trop gros (taille annoncée ou réelle)', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(2048)]);
    await expect(fetchPdfSafely('https://exemple.fr/a.pdf', { lookup: publicDns, fetch: okFetch(big), maxBytes: 1024 }))
      .rejects.toThrow(/trop volumineux/);
    const lying = okFetch(PDF, { headers: { 'content-length': '999999999' } });
    await expect(fetchPdfSafely('https://exemple.fr/a.pdf', { lookup: publicDns, fetch: lying })).rejects.toThrow(/trop volumineux/);
  });

  it("refuse ce qui n'est pas un PDF", async () => {
    await expect(fetchPdfSafely('https://exemple.fr/a.pdf', { lookup: publicDns, fetch: okFetch(Buffer.from('<html>')) }))
      .rejects.toThrow(/pas un PDF/);
  });
});

describe('divers', () => {
  it('assertPdf', () => {
    expect(() => assertPdf(PDF)).not.toThrow();
    expect(() => assertPdf(Buffer.from('MZ'))).toThrow();
  });

  it('corsOrigin ne renvoie que les origines Sign', () => {
    expect(corsOrigin('https://sign.closeos.fr')).toBe('https://sign.closeos.fr');
    expect(corsOrigin('https://evil.example')).toBeNull();
    expect(corsOrigin(undefined)).toBeNull();
  });
});
