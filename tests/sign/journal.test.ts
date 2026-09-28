import { describe, expect, it } from 'vitest';
import { buildJournal, deviceLabel, journalLabel } from '../../src/lib/signJournal';

const row = (event_type: string, metadata: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  created_at: '2026-09-21T18:00:00Z', event_type, email: null, ip_address: null, user_agent: null, metadata, ...extra,
});

describe('journalLabel', () => {
  it.each([
    ['created', 'Contrat créé'], ['sent', 'Envoyé au signataire'], ['opened', 'Document ouvert'],
    ['signed', 'Signature'], ['paid', 'Paiement effectué'], ['sealed', 'Document scellé'],
    ['unlocked', 'Déblocage par le propriétaire'], ['link_renewed', 'Nouveau lien généré par le propriétaire'],
  ])('%s → %s', (type, label) => expect(journalLabel(row(type), 'fr').label).toBe(label));

  it('précise le canal du code', () => {
    expect(journalLabel(row('otp_sent', { channel: 'sms' }), 'fr').label).toBe('Code de vérification envoyé (SMS)');
    expect(journalLabel(row('otp_verified', { channel: 'email' }), 'fr').label).toBe('Code de vérification validé (email)');
  });

  it('distingue échec de vérification et verrouillage', () => {
    expect(journalLabel(row('security', { kind: 'verification_failed', step: 2, attempt: 3 }), 'fr'))
      .toEqual({ label: 'Échec de vérification (code erroné, essai 3)', tone: 'warning' });
    expect(journalLabel(row('security', { kind: 'verification_failed', step: 1, attempt: 1 }), 'fr').label)
      .toBe('Échec de vérification (coordonnée non autorisée, essai 1)');
    expect(journalLabel(row('security', { kind: 'verification_locked', step: 2 }), 'fr'))
      .toEqual({ label: 'Verrouillage après 3 échecs (étape 2)', tone: 'danger' });
  });

  it('signale une action faite par le connecteur IA', () => {
    expect(journalLabel(row('unlocked', { via: 'mcp' }), 'fr').label).toBe('Déblocage par le propriétaire — via le connecteur IA');
  });
});

describe('buildJournal', () => {
  it('trie par date et résout le signataire par son index', () => {
    const lines = buildJournal(
      [
        row('opened', { signer_index: 2 }, { created_at: '2026-09-21T10:00:00Z', ip_address: '1.2.3.4' }),
        row('created', {}, { created_at: '2026-09-20T10:00:00Z' }),
        row('sent', { signer_index: 3 }, { created_at: '2026-09-20T11:00:00Z', email: 'x@test.fr' }),
      ],
      [{ signerIndex: 2, name: 'Paul Martin', email: 'paul@test.fr' }],
      'fr',
    );
    expect(lines.map((l) => [l.label, l.signer, l.ip])).toEqual([
      ['Contrat créé', '—', '—'],
      ['Envoyé au signataire', 'x@test.fr', '—'],
      ['Document ouvert', 'Paul Martin', '1.2.3.4'],
    ]);
  });
});

describe('deviceLabel', () => {
  it('lit navigateur et système', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1')).toBe('Safari · iOS');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/128.0 Safari/537.36')).toBe('Chrome · Windows');
    expect(deviceLabel(null)).toBe('—');
  });
});
