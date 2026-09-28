import { describe, expect, it } from 'vitest';
import { replaceRoot, signDocShell } from '../../api/_lib/sign-doc-shell';

const LANDING = `<!doctype html><html><head><title>CloseOS Sign</title></head><body>
<div id="root"><div class="min-h-screen"><section><div><h1>Signez vos contrats</h1></div></section><div class="x"></div></div></div>
<div id="portal"></div><script type="module" src="/assets/index.js"></script></body></html>`;

describe('shell de la page de signature (/sign/s/:token)', () => {
  it('remplace toute la landing pré-rendue, divs imbriqués compris', () => {
    const out = signDocShell(LANDING, 'fr');
    expect(out).not.toContain('Signez vos contrats');
    expect(out).toContain('Chargement de votre document…');
    expect(out).toContain('background:#191E1E');
    // Ce qui suit #root est intact
    expect(out).toContain('<div id="portal"></div><script type="module" src="/assets/index.js"></script>');
    expect(out).toMatch(/<style>@keyframes signDocSpin[^<]*<\/style><\/head>/);
  });

  it('en anglais selon la langue', () => {
    expect(signDocShell(LANDING, 'en')).toContain('Loading your document…');
  });

  it('laisse le HTML intact sans #root', () => {
    expect(replaceRoot('<html><body>x</body></html>', 'y')).toBe('<html><body>x</body></html>');
  });
});
