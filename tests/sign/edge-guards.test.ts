import { describe, expect, it } from 'vitest';
import {
  bearerToken, certificateAccess, internalEmailHeaders, safeOrigin,
} from '../../supabase/functions/_shared/sign-guards';

describe('sign-pay : origine du retour Stripe', () => {
  it('garde les origines Sign', () => {
    expect(safeOrigin('https://sign.closeos.fr')).toBe('https://sign.closeos.fr');
    expect(safeOrigin('https://sign.closeos.fr/')).toBe('https://sign.closeos.fr');
  });
  it('remplace toute autre origine (plus de redirection ouverte)', () => {
    expect(safeOrigin('https://evil.example')).toBe('https://sign.closeos.fr');
    expect(safeOrigin(undefined)).toBe('https://sign.closeos.fr');
  });
});

describe('bearerToken', () => {
  it('lit le jeton porteur', () => {
    expect(bearerToken(new Headers({ authorization: 'Bearer abc.def' }))).toBe('abc.def');
    expect(bearerToken(new Headers())).toBeNull();
    expect(bearerToken(new Headers({ authorization: 'Basic x' }))).toBeNull();
  });
});

describe('sign-certificate : qui peut agir sur un contrat', () => {
  const base = { tokenContractId: null, requestedContractId: null, sessionUserId: null, ownerOfRequested: null };

  it('accepte le signataire par son token', () => {
    expect(certificateAccess({ ...base, tokenContractId: 'c1' })).toEqual({ contractId: 'c1' });
  });

  it('refuse un contractId seul, sans session (faille corrigée)', () => {
    expect(certificateAccess({ ...base, requestedContractId: 'c1', ownerOfRequested: 'u1' })).toEqual({ error: 'unauthorized' });
  });

  it("refuse un contractId avec la session d'un autre compte", () => {
    expect(certificateAccess({ ...base, requestedContractId: 'c1', sessionUserId: 'u2', ownerOfRequested: 'u1' }))
      .toEqual({ error: 'unauthorized' });
  });

  it('accepte le propriétaire connecté (régénération depuis l\'éditeur)', () => {
    expect(certificateAccess({ ...base, requestedContractId: 'c1', sessionUserId: 'u1', ownerOfRequested: 'u1' }))
      .toEqual({ contractId: 'c1' });
  });

  it('refuse un contrat inexistant même avec une session', () => {
    expect(certificateAccess({ ...base, requestedContractId: 'c404', sessionUserId: 'u1', ownerOfRequested: null }))
      .toEqual({ error: 'unauthorized' });
  });

  it('signale une requête sans token ni contrat', () => {
    expect(certificateAccess(base)).toEqual({ error: 'contract' });
  });
});

describe('internalEmailHeaders', () => {
  it("n'ajoute le secret que s'il existe", () => {
    expect(internalEmailHeaders('s'.repeat(40))['x-closeos-internal']).toBe('s'.repeat(40));
    expect(internalEmailHeaders(null)).not.toHaveProperty('x-closeos-internal');
  });
});
