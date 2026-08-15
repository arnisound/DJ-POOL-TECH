/**
 * Constructeur de formulaires déclaratif.
 * Un schéma = un tableau de champs ; chaque modification est remontée
 * immédiatement à l'appelant (qui se charge de la persistance).
 */
import { h, field as fieldWrap } from './dom.js';
import { readDataURL, toastErr } from './ui.js';

/**
 * @typedef {object} FieldDef
 * @property {string} name        clé dans l'objet de données
 * @property {string} label
 * @property {string} [type]      text | tel | email | url | number | date | time | textarea | select | checkbox | image | section | note
 * @property {string} [placeholder]
 * @property {string} [hint]
 * @property {Array}  [options]   pour `select`
 * @property {number} [rows]      pour `textarea`
 * @property {string} [width]     'full' pour occuper toute la largeur
 */

/**
 * @param {FieldDef[]} schema
 * @param {object} data
 * @param {(name:string, value:any, data:object)=>void} onChange
 * @returns {HTMLElement}
 */
export function buildForm(schema, data, onChange) {
  const root = h('div');
  let grid = null;

  const flush = (name, value) => {
    data[name] = value;
    onChange(name, value, data);
  };

  const ensureGrid = () => {
    if (!grid) { grid = h('div.grid.grid-2'); root.appendChild(grid); }
    return grid;
  };

  for (const def of schema) {
    if (def.type === 'section') {
      grid = null;
      root.appendChild(h('h3', { text: def.label, style: { marginTop: root.children.length ? '1.3rem' : '0' } }));
      if (def.hint) root.appendChild(h('p.tiny.muted', { text: def.hint }));
      continue;
    }
    if (def.type === 'note') {
      grid = null;
      root.appendChild(h('p.small.muted', { text: def.label }));
      continue;
    }

    const control = buildControl(def, data, flush);
    const wrapped = def.type === 'checkbox'
      ? h('div.field', null, control, def.hint ? h('div.hint', { text: def.hint }) : null)
      : fieldWrap(def.label, control, def.hint);

    if (def.width === 'full') {
      grid = null;
      root.appendChild(wrapped);
    } else {
      ensureGrid().appendChild(wrapped);
    }
  }

  return root;
}

function buildControl(def, data, flush) {
  const value = data[def.name];

  switch (def.type) {
    case 'textarea': {
      const ta = h('textarea', { placeholder: def.placeholder || '', rows: def.rows || 4 });
      ta.value = value ?? '';
      ta.addEventListener('input', () => flush(def.name, ta.value));
      return ta;
    }

    case 'select': {
      const sel = h('select');
      for (const o of def.options || []) {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        sel.appendChild(h('option', { value: opt.value, text: opt.label }));
      }
      sel.value = value ?? (def.options?.[0]?.value ?? def.options?.[0] ?? '');
      sel.addEventListener('change', () => flush(def.name, sel.value));
      return sel;
    }

    case 'checkbox': {
      const box = h('input', { type: 'checkbox', checked: !!value });
      box.addEventListener('change', () => flush(def.name, box.checked));
      return h('label.check', null, box, h('span', { text: def.label }));
    }

    case 'image':
      return imageControl(def, value, flush);

    default: {
      const inp = h('input', {
        type: def.type || 'text',
        placeholder: def.placeholder || '',
        inputmode: def.type === 'number' ? 'decimal' : undefined,
        min: def.min, max: def.max, step: def.step,
      });
      inp.value = value ?? '';
      inp.addEventListener('input', () => flush(def.name, def.type === 'number' ? Number(inp.value) : inp.value));
      return inp;
    }
  }
}

function imageControl(def, value, flush) {
  const preview = h('img', {
    alt: '',
    style: {
      maxHeight: '64px', maxWidth: '160px', objectFit: 'contain',
      borderRadius: '8px', background: 'var(--surface-3)', padding: '6px',
      display: value ? 'block' : 'none',
    },
  });
  if (value) preview.src = value;

  const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp' });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 900 * 1024) {
      toastErr('Image trop lourde (900 Ko maximum) — réduisez-la avant de l’ajouter.');
      input.value = '';
      return;
    }
    const url = await readDataURL(file);
    preview.src = url;
    preview.style.display = 'block';
    flush(def.name, url);
  });

  const clearBtn = h('button.btn.btn-sm.btn-ghost', {
    type: 'button', text: 'Retirer',
    on: {
      click: () => {
        preview.removeAttribute('src');
        preview.style.display = 'none';
        input.value = '';
        flush(def.name, '');
      },
    },
  });

  return h('div.row', null, preview, h('div', { style: { flex: '1 1 180px' } }, input), clearBtn);
}
