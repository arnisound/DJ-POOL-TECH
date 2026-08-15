/**
 * Micro-utilitaires DOM (aucune dépendance).
 */

/**
 * Crée un élément.
 * @param {string} tag - ex. "div.card", "button#go.btn.btn-primary"
 * @param {object|null} props - attributs, `class`, `style` (objet), `on` (écouteurs), `html`, `text`
 * @param {...(Node|string|Array|null|undefined|false)} children
 */
export function h(tag, props, ...children) {
  const m = /^([a-zA-Z0-9-]+)?(#[^.]+)?((?:\.[^.#]+)*)$/.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) el.id = m[2].slice(1);
  if (m[3]) el.className = m[3].slice(1).split('.').join(' ');

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') el.className = [el.className, v].filter(Boolean).join(' ');
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'object' && !k.startsWith('aria')) el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(parent, c);
    else parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const qs = (sel, root = document) => root.querySelector(sel);

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let fieldSeq = 0;

/**
 * Champ de formulaire générique : le libellé est réellement rattaché au
 * contrôle (`for`/`id`), et l'indication lui est liée par `aria-describedby`.
 * Sans cela, le libellé n'est ni cliquable ni annoncé par un lecteur d'écran.
 */
export function field(label, control, hint) {
  const target = typeof control.matches === 'function' && control.matches('input, select, textarea')
    ? control
    : control.querySelector && control.querySelector('input, select, textarea');

  if (target && !target.id) target.id = `champ-${++fieldSeq}`;

  let hintEl = null;
  if (hint) {
    hintEl = h('div.hint', { text: hint });
    if (target) {
      hintEl.id = `${target.id}-aide`;
      target.setAttribute('aria-describedby', hintEl.id);
    }
  }

  return h('div.field', null,
    label ? h('label', { text: label, for: target ? target.id : null }) : null,
    control,
    hintEl
  );
}

/** Case à cocher avec libellé cliquable. */
export function checkbox(label, checked, onChange) {
  const box = h('input', { type: 'checkbox', checked: !!checked });
  box.addEventListener('change', () => onChange(box.checked));
  return h('label.check', null, box, h('span', { text: label }));
}

/** Groupe de boutons segmentés. */
export function segmented(options, value, onChange) {
  const wrap = h('div.seg');
  options.forEach((o) => {
    const opt = typeof o === 'string' ? { value: o, label: o } : o;
    const b = h('button', { type: 'button', text: opt.label, class: opt.value === value ? 'active' : '' });
    b.addEventListener('click', () => {
      Array.from(wrap.children).forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
      onChange(opt.value);
    });
    wrap.appendChild(b);
  });
  return wrap;
}
