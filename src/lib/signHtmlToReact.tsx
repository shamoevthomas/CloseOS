import React, { createContext, useContext } from 'react';
import { isInlineFillable, chipFid, chipSignerIndex, formatInline } from './signInline';

/**
 * Convertit le content_html d'un contrat en ARBRE REACT (pas de dangerouslySetInnerHTML).
 * Les chips `.sign-field` deviennent de vrais composants React :
 *  - éditable (rôle = inlineRole) → <input> CONTRÔLÉ (focus/curseur natifs, jamais de désélection)
 *  - sinon → <span> affichant la valeur ou le placeholder.
 * Les valeurs passent par un Context → on parse la structure UNE fois (mémo sur le html),
 * sans re-parser à chaque frappe.
 */

type InlineCtxValue = {
  inlineValues?: Record<string, string>;
  inlineRole?: 'owner' | 'signer' | null;
  inlineSignerIndex?: number | null; // si défini (page signataire), seuls les chips de ce signataire sont éditables
  onInlineChange?: (fid: string, value: string) => void;
  openDatePicker?: (fid: string, current: string) => void;
};

const InlineCtx = createContext<InlineCtxValue>({});

export function InlineProvider({ value, children }: { value: InlineCtxValue; children: React.ReactNode }) {
  return <InlineCtx.Provider value={value}>{children}</InlineCtx.Provider>;
}

function InlineField({ fid, type, role, signerIndex, label }: { fid: string; type: string; role: string; signerIndex: number; label: string }) {
  const { inlineValues, inlineRole, inlineSignerIndex, onInlineChange, openDatePicker } = useContext(InlineCtx);
  const editable =
    !!inlineRole && role === inlineRole && (inlineRole !== 'signer' || inlineSignerIndex == null || signerIndex === inlineSignerIndex);
  const v = inlineValues?.[fid] ?? '';
  // data-signer (couleur) uniquement pour les champs de signataire ; le propriétaire garde data-role="owner".
  const signerAttr = role === 'signer' ? { 'data-signer': signerIndex } : {};
  if (editable) {
    // Date : bouton qui ouvre le calendrier modal (au lieu d'un input texte)
    if (type === 'date') {
      return (
        <button
          type="button"
          className="sf-inline-input sf-inline-date"
          data-field={type}
          data-role={role}
          {...signerAttr}
          data-fid={fid}
          onClick={() => openDatePicker?.(fid, v)}
        >
          {v ? formatInline('date', v) : label}
        </button>
      );
    }
    return (
      <input
        className="sf-inline-input"
        data-field={type}
        data-role={role}
        {...signerAttr}
        data-fid={fid}
        value={v}
        placeholder={label}
        onChange={(e) => onInlineChange?.(fid, e.target.value)}
      />
    );
  }
  return (
    <span className={`sign-field${v ? ' sf-filled' : ''}`} data-field={type} data-role={role} {...signerAttr} data-fid={fid} data-ph={label}>
      {v ? formatInline(type, v) : ''}
    </span>
  );
}

function styleToObject(style: string): React.CSSProperties {
  const obj: Record<string, string> = {};
  style.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const key = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!key) return;
    const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    obj[camel] = val;
  });
  return obj as React.CSSProperties;
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'wbr']);

function elementToReact(el: Element, key: string, counter: { n: number }): React.ReactNode {
  // Chip de champ
  if (el.classList.contains('sign-field')) {
    const type = el.getAttribute('data-field') || 'text';
    const idx = counter.n;
    counter.n++; // chaque .sign-field compte pour l'index (cohérence des fid)
    if (isInlineFillable(type)) {
      return (
        <InlineField
          key={key}
          fid={chipFid(idx)}
          type={type}
          role={el.getAttribute('data-role') || 'signer'}
          signerIndex={chipSignerIndex(el)}
          label={el.textContent?.trim() || type}
        />
      );
    }
    // non remplissable (signature inline) : rendu tel quel
  }

  const tag = el.tagName.toLowerCase();
  const props: Record<string, unknown> = { key };
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    if (name === 'class') props.className = attr.value;
    else if (name === 'style') props.style = styleToObject(attr.value);
    else if (name === 'contenteditable') continue;
    else props[name] = attr.value;
  }

  if (VOID.has(tag)) return React.createElement(tag, props);

  const children = childrenToReact(el, counter);
  return React.createElement(tag, props, ...children);
}

function childrenToReact(parent: Node, counter: { n: number }): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      // texte
      if (node.textContent) out.push(node.textContent);
    } else if (node.nodeType === 1) {
      out.push(elementToReact(node as Element, `n${i}`, counter));
    }
    i++;
  });
  return out;
}

/** Parse le html en nœuds React (structure stable ; les valeurs viennent du Context). */
export function htmlToReact(html: string): React.ReactNode[] {
  if (typeof window === 'undefined' || !html) return [];
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const root = doc.getElementById('r');
  if (!root) return [];
  return childrenToReact(root, { n: 0 });
}

/** Nombre de feuilles A4 d'après les sauts de page bakés (.pg-break). */
export function countPages(html: string): number {
  if (!html) return 1;
  return (html.match(/class="pg-break"/g) ?? []).length + 1;
}
