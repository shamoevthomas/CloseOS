# CloseOS Sign — Direction Artistique (DA)

> **Règle d'or** : toute page, section, modal ou pop-up du module **CloseOS Sign**
> (`sign.closeos.fr`) DOIT respecter cette DA. Référence visuelle d'origine : la
> landing Yousign (`yousign.com/fr-fr`), reprise via aidesigner (mode `inspire`).
> Implémentation de référence : `src/pages/SignLanding.tsx`.

L'ADN : **technique, précis, juridique, premium, haut contraste**. Bordures fines,
UI géométrique flottante, bento-grids, beaucoup d'air. Fond sombre + accent lime.

⚠️ **Ne PAS confondre avec les autres écosystèmes** : CloseOS Business = brun/crème
(`#493627` / `#fbfaf9`, Manrope/Playfair). Sign a sa propre DA ci-dessous.

---

## 1. Palette (tokens)

| Rôle | Hex | Usage |
|------|-----|-------|
| **Primary (lime)** | `#CEFF8F` | Accent principal, CTA, icônes actives, bandeaux, badges |
| **Secondary (mint)** | `#A0E7EC` | États `hover` des CTA primaires |
| **BG** | `#191E1E` | Fond global de page |
| **Surface** | `#222828` | Cartes, panneaux, inputs au repos |
| **Surface alt** | `#1D2323` | Panneau alterné (ex. côté "Paiement") |
| **Border** | `#3A4242` | Toutes les bordures fines, séparateurs, lignes de structure |
| **Text light** | `#F3F4F6` | Texte principal sur fond sombre |
| **Text muted** | `#A1A9A9` | Texte secondaire, labels, descriptions |
| **Text dark** | `#191E1E` | Texte SUR fond lime (CTA, bandeaux) |

**Sur fond lime** (`#CEFF8F`) : texte et icônes en `#191E1E`.
**Sélection** : `bg-[#CEFF8F]` + `text-[#191E1E]`.

> Les couleurs ne sont PAS dans `tailwind.config.js` → on les écrit en **valeurs
> arbitraires** : `bg-[#191E1E]`, `text-[#CEFF8F]`, `border-[#3A4242]`, etc.

---

## 2. Typographie

- **Font** : `"SF Pro Display", "Helvetica Neue", Helvetica, Arial, Inter, sans-serif`
  (appliquée via la classe racine `.sign-landing`).
- **Serif** (rare, accent décoratif uniquement) : `Times New Roman, serif` en italique.
- **Titres** : `font-semibold`, `tracking-tight`, `leading-[1.05]`.
  - H1 : `text-[40px]` → `sm:text-[52px]`
  - H2 : `text-[36px]` → `sm:text-[48px]` (ou `text-4xl`)
  - H3 carte : `text-2xl` / `text-xl` `font-medium`
- **Corps** : `text-sm` à `text-lg`, en `text-[#A1A9A9]` (muted) le plus souvent.
- **Micro-labels** : `text-[10px] font-bold uppercase tracking-widest text-[#A1A9A9]`.

---

## 3. Formes & espacement

- **Rayons volontairement nets** : `rounded` (≈4px) par défaut. Pills/ronds : `rounded-full`.
  Jamais de gros `rounded-2xl/3xl` arrondis "soft".
- **Bordures fines** partout : `border border-[#3A4242]` (1px). C'est la signature visuelle.
- **Padding cartes** : `p-8` (grandes), `p-4`/`p-3` (compactes).
- **Conteneur** : `max-w-7xl mx-auto`, padding `px-6 md:px-12`.
- **Sections** : `py-24` (`py-32` pour les CTA forts), séparées par `border-b border-[#3A4242]`.

---

## 4. Composants de référence

### Boutons
- **Primaire** : `bg-[#CEFF8F] text-[#191E1E] font-bold rounded px-8 py-3 hover:bg-[#A0E7EC] transition-colors`
- **Secondaire** : `border border-[#3A4242] bg-transparent text-white font-medium rounded px-8 py-3 hover:border-[#A1A9A9]`

### Cartes
`rounded border border-[#3A4242] bg-[#222828] p-8` + classe `hover-lift`
(translateY -4px + bordure lime au survol).

### Badges / pills
`inline-block rounded border border-[#3A4242] bg-[#222828] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CEFF8F]`

### Inputs
`rounded border border-[#3A4242] bg-[#191E1E] px-4 py-3 text-sm text-white placeholder:text-[#A1A9A9]/50 focus:border-[#CEFF8F] focus:ring-1 focus:ring-[#CEFF8F] outline-none`

### Nav / header
Sticky, `bg-[#191E1E]/90 backdrop-blur-md border-b border-[#3A4242]`.

### Bandeau d'annonce (haut de page)
`bg-[#CEFF8F] text-[#191E1E]`, contenu `text-[10px] font-bold uppercase tracking-wider`,
avec tag inversé `bg-[#191E1E] text-[#CEFF8F]`.

### Bento-grid (densité data)
`grid grid-cols-1 md:grid-cols-6 gap-4`, cartes en `col-span-2/4` pour rythmer.

### Ticker légal
Bande pleine `bg-[#CEFF8F]`, items `uppercase tracking-widest font-bold` en `#191E1E`.

---

## 5. Effets signature (CSS scopé `.sign-landing`)

À recopier dans tout nouveau composant Sign (ou centraliser plus tard) :

- **`.bg-noise`** : overlay de bruit fractal `opacity 0.03` en `::before` (texture premium).
- **`.hover-lift`** : `translateY(-4px)` + bordure lime au hover (`transition .3s cubic-bezier(0.16,1,0.3,1)`).
- **`.wire-r` / `.wire-l` / `.wire-b`** : fils 1px `#3A4242` reliant les éléments de mockup.
- **`.glow-point`** : point lumineux lime 5px (`box-shadow: 0 0 10px #CEFF8F`).
- **Lueur lime** sur éléments clés : `shadow-[0_0_40px_rgba(206,255,143,0.15)]`.
- **Rotation lente déco** : `animate-[spin_20s_linear_infinite]`.

> Scoper le CSS custom sous `.sign-landing` (ou la classe racine du module) pour ne
> pas polluer le reste de l'app.

---

## 6. Icônes

- **Toujours `lucide-react`** (jamais Phosphor/autres). Trait fin, `strokeWidth` 2–2.5.
- Icônes actives en `text-[#CEFF8F]`, neutres en `text-[#A1A9A9]` ou `#F3F4F6`.

---

## 7. Ton & contenu

- **Langue** : français, toujours.
- **Message central, partout** : **Sign + Pay** — signer le contrat ET encaisser
  l'acompte dans le même geste. C'est LE différenciateur (≠ "énième outil de signature").
- **Valeur réelle** : le **faisceau de preuves** opposable
  (email vérifié + OTP SMS + horodatage serveur + IP + hash SHA-256 du document).
- Registre : crédible, juridique, orienté closer. Conformité **RGPD** mise en avant.
- Produit pas encore lancé → badges "Bientôt disponible" / "Beta Privée" + waitlist.

---

## 8. Pop-ups / modals (à venir)

Mêmes règles : fond `#222828` (surface) sur overlay sombre, bordure `#3A4242`,
`rounded`, titre `font-semibold`, CTA primaire lime, texte muted. Pas d'arrondis soft,
pas de couleurs hors palette. Garder l'air et la densité "technique".

---

## 9. Checklist avant de livrer une page/pop-up Sign

- [ ] Fond `#191E1E`, cartes `#222828`, bordures `#3A4242`
- [ ] Accent lime `#CEFF8F` (hover `#A0E7EC`), texte sur lime en `#191E1E`
- [ ] Rayons nets (`rounded` ≈4px), bordures 1px
- [ ] Icônes `lucide-react`
- [ ] Tout en français, message Sign + Pay + faisceau de preuves présent
- [ ] CSS custom scopé sous la classe racine du module
- [ ] Responsive (mockups cachés en mobile via `hidden md:block` si besoin)
