/** Roue Camelot interactive : compatibilité harmonique entre clefs. */
import { h, clear, segmented } from '../core/dom.js';
import * as store from '../core/store.js';
import {
  parseCamelot, toOpenKey, keyLabel, neighbours,
  NOTES_SHARP, NOTES_FR,
} from '../core/music.js';

const SEL_KEY = 'camelot.selection';
const SVG_NS = 'http://www.w3.org/2000/svg';

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

export default function mount(el) {
  const state = store.load(SEL_KEY, { code: '8A', notation: 'camelot' });
  if (!parseCamelot(state.code)) state.code = '8A';

  const wheelHost = h('div.wheel-wrap');
  const infoHost = h('div');

  el.appendChild(h('div.card', null,
    h('div.card-head', null,
      h('h2', { text: 'Choisissez une clef' }),
      h('span.spacer', { style: { marginLeft: 'auto' } }),
      segmented(
        [{ value: 'camelot', label: 'Camelot' }, { value: 'openkey', label: 'Open Key' }, { value: 'standard', label: 'Clefs' }],
        state.notation,
        (v) => { state.notation = v; persist(); draw(); }
      )
    ),
    wheelHost,
    h('p.tiny.muted.center', { text: 'Anneau extérieur : modes majeurs (B / d). Anneau intérieur : modes mineurs (A / m).' })
  ));

  el.appendChild(infoHost);

  draw();
  renderInfo();

  const onTheme = () => draw();
  document.addEventListener('djpt:theme', onTheme);

  function persist() { store.save(SEL_KEY, state); }

  function select(code) {
    if (!parseCamelot(code)) return;
    state.code = code;
    persist();
    draw();
    renderInfo();
  }

  /* ------------------------------ Roue ------------------------------ */

  function draw() {
    clear(wheelHost);
    const light = isLightTheme();
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 400 400');
    svg.setAttribute('class', 'wheel');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Roue Camelot');

    const rel = neighbours(state.code);
    const roles = new Map([
      [rel.perfect, 'perfect'], [rel.up, 'up'], [rel.down, 'down'],
      [rel.relative, 'relative'], [rel.boost, 'boost'], [rel.diagonal, 'diagonal'],
    ]);

    for (const letter of ['B', 'A']) {
      const outer = letter === 'B' ? 192 : 138;
      const inner = letter === 'B' ? 142 : 86;
      for (let num = 1; num <= 12; num++) {
        const code = num + letter;
        const role = roles.get(code) || null;
        const a0 = (num - 1) * 30 - 15;
        const a1 = a0 + 30;

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', annularSector(200, 200, inner, outer, a0 + 1, a1 - 1));
        path.setAttribute('class', 'seg-arc');
        path.setAttribute('fill', segmentFill(num, letter, role, light));
        path.setAttribute('stroke', role
          ? (light ? 'rgba(20,24,40,.5)' : 'rgba(255,255,255,.55)')
          : (light ? 'rgba(20,24,40,.12)' : 'rgba(0,0,0,.18)'));
        path.setAttribute('stroke-width', role === 'perfect' ? '2.5' : role ? '1.4' : '.6');
        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        const k = parseCamelot(code);
        path.setAttribute('aria-label', `${code} — ${keyLabel(k.pc, k.mode, 'fr')}`);
        path.addEventListener('click', () => select(code));
        path.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(code); } });
        svg.appendChild(path);

        const mid = (a0 + a1) / 2;
        const r = (inner + outer) / 2;
        const p = polar(200, 200, r, mid);
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', p.x);
        text.setAttribute('y', p.y + 4.5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', letter === 'B' ? '13' : '12');
        text.setAttribute('fill', labelFill(role, light));
        text.textContent = wheelLabel(code, state.notation);
        svg.appendChild(text);
      }
    }

    // Pastille centrale : la clef sélectionnée.
    const k = parseCamelot(state.code);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', 200); circle.setAttribute('cy', 200); circle.setAttribute('r', 80);
    circle.setAttribute('fill', 'rgba(10,12,20,.92)');
    circle.setAttribute('stroke', 'rgba(255,255,255,.15)');
    svg.appendChild(circle);

    svg.appendChild(centerText(state.code, 194, 28, '#fff'));
    svg.appendChild(centerText(keyLabel(k.pc, k.mode, 'standard'), 220, 15, 'rgba(255,255,255,.75)'));
    svg.appendChild(centerText(keyLabel(k.pc, k.mode, 'fr'), 240, 11, 'rgba(255,255,255,.5)'));

    wheelHost.appendChild(svg);
  }

  function centerText(str, y, size, fill) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', 200); t.setAttribute('y', y);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', size);
    t.setAttribute('fill', fill);
    t.textContent = str;
    return t;
  }

  /* ------------------------------ Panneau d'infos ------------------------------ */

  function renderInfo() {
    clear(infoHost);
    const k = parseCamelot(state.code);
    const rel = neighbours(state.code);

    const chip = (code, title, desc, tone) => h('button.btn', {
      type: 'button',
      style: { flexDirection: 'column', alignItems: 'flex-start', gap: '.15rem', textAlign: 'left', minHeight: '64px', flex: '1 1 150px' },
      on: { click: () => select(code) },
    },
      h('span.row.tight', null,
        h('span.badge', { class: tone, text: code }),
        h('span.small', { text: keyLabel(parseCamelot(code).pc, parseCamelot(code).mode, 'standard') })
      ),
      h('span.tiny.muted', { text: title }),
      h('span.tiny.muted', { text: desc, style: { fontWeight: '400' } })
    );

    infoHost.appendChild(h('div.card', null,
      h('div.card-head', null,
        h('h2', { text: `Enchaînements depuis ${state.code}` }),
        h('span.spacer', { style: { marginLeft: 'auto' } }),
        h('span.badge.badge-accent', { text: `Open Key ${toOpenKey(k.pc, k.mode)}` })
      ),
      h('h3.small', { text: 'Valeurs sûres', style: { color: 'var(--ok)' } }),
      h('div.row', null,
        chip(rel.perfect, 'Même clef', 'Fusion totale, aucun risque', 'badge-ok'),
        chip(rel.up, '+1 · quinte', 'Monte l’énergie d’un cran', 'badge-ok'),
        chip(rel.down, '−1 · quarte', 'Adoucit, prépare une descente', 'badge-ok'),
        chip(rel.relative, k.letter === 'A' ? 'Relatif majeur' : 'Relatif mineur', 'Change l’humeur, garde la tonique', 'badge-ok')
      ),
      h('h3.small', { text: 'À utiliser au bon moment', style: { color: 'var(--warn)', marginTop: '1rem' } }),
      h('div.row', null,
        chip(rel.boost, '+7 · boost', 'Montée d’un ton, effet « lift »', 'badge-warn'),
        chip(rel.diagonal, 'Diagonale', 'Changement de couleur plus marqué', 'badge-warn')
      ),
      h('p.tiny.muted', { style: { marginTop: '.9rem' }, text: 'Ces règles sont des repères, pas des lois : un morceau très percussif ou avec peu de contenu mélodique passe partout. Faites toujours confiance à votre oreille et au casque.' })
    ));

    const steps = k.mode === 'min' ? MINOR_STEPS : MAJOR_STEPS;
    const notes = steps.map((s) => (k.pc + s) % 12);

    infoHost.appendChild(h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Notes de la gamme' })),
      h('div.row', null, ...notes.map((pc, i) => h('div.stat', { style: { flex: '1 1 80px', textAlign: 'center' } },
        h('div.k', { text: `${i + 1}${i === 0 ? 're' : 'e'}` }),
        h('div.v', { text: NOTES_SHARP[pc] }),
        h('div.tiny.muted', { text: NOTES_FR[pc] })
      ))),
      h('p.tiny.muted', { style: { marginTop: '.7rem' }, text: 'Pratique pour repérer une ligne de basse ou vérifier qu’un acapella tombe juste.' })
    ));

    infoHost.appendChild(h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Correspondance des notations' })),
      h('div.table-wrap', null,
        h('table', null,
          h('thead', null, h('tr', null,
            h('th', { text: 'Camelot' }), h('th', { text: 'Open Key' }),
            h('th', { text: 'Clef' }), h('th', { text: 'En français' })
          )),
          h('tbody', null, ...allRows(state.code, select))
        )
      )
    ));
  }

  return () => document.removeEventListener('djpt:theme', onTheme);
}

function allRows(current, select) {
  const rows = [];
  for (let num = 1; num <= 12; num++) {
    for (const letter of ['A', 'B']) {
      const code = num + letter;
      const k = parseCamelot(code);
      const tr = h('tr', {
        style: { cursor: 'pointer', background: code === current ? 'var(--accent-soft)' : '' },
        on: { click: () => select(code) },
      },
        h('td', null, h('span.badge', { class: code === current ? 'badge-accent' : '', text: code })),
        h('td.mono', { text: toOpenKey(k.pc, k.mode) }),
        h('td', { text: keyLabel(k.pc, k.mode, 'standard') }),
        h('td.small.muted', { text: keyLabel(k.pc, k.mode, 'fr') })
      );
      rows.push(tr);
    }
  }
  return rows;
}

function wheelLabel(code, notation) {
  const k = parseCamelot(code);
  if (notation === 'openkey') return toOpenKey(k.pc, k.mode);
  if (notation === 'standard') return keyLabel(k.pc, k.mode, 'standard');
  return code;
}

/** Le thème clair demande des segments clairs : sinon la roue devient un pâté noir. */
function isLightTheme() {
  return document.documentElement.dataset.theme === 'light';
}

function segmentFill(num, letter, role, light) {
  const hue = ((num - 1) * 30 + 195) % 360;
  const sat = letter === 'B' ? 62 : 48;
  if (role === 'perfect') return `hsl(${hue} ${sat + 20}% ${light ? 58 : 62}%)`;
  if (role === 'up' || role === 'down' || role === 'relative') return `hsl(${hue} ${sat + 8}% ${light ? 66 : 52}%)`;
  if (role === 'boost' || role === 'diagonal') return `hsl(${hue} ${sat - 6}% ${light ? 78 : 42}%)`;
  return light
    ? `hsl(${hue} 26% ${letter === 'B' ? 91 : 85}%)`
    : `hsl(${hue} ${Math.round(sat * 0.42)}% ${letter === 'B' ? 26 : 21}%)`;
}

function labelFill(role, light) {
  if (role) return '#0d0f16';
  return light ? 'rgba(30,36,54,.78)' : 'rgba(255,255,255,.72)';
}

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Secteur d'anneau entre deux angles (degrés, 0 = haut, sens horaire). */
function annularSector(cx, cy, rInner, rOuter, a0, a1) {
  const p1 = polar(cx, cy, rOuter, a0);
  const p2 = polar(cx, cy, rOuter, a1);
  const p3 = polar(cx, cy, rInner, a1);
  const p4 = polar(cx, cy, rInner, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}
