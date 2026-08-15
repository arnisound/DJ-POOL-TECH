/** Calculateur pitch / tempo / transposition. */
import { h, clear, segmented } from '../core/dom.js';
import * as store from '../core/store.js';
import {
  pitchPercent, bpmAtPitch, semitonesFromPercent, percentFromSemitones,
  transposeCamelot, parseCamelot, keyLabel, allKeys, fmtDuration, parseDuration, keyCompatibility,
} from '../core/music.js';
import { fmtNum, fmtSigned } from '../core/text.js';

const KEY = 'pitch.state';
const RANGES = [6, 10, 16, 50];

export default function mount(el) {
  const s = store.load(KEY, {
    fromBpm: 124, toBpm: 128, fromKey: '8A', range: 8, pitch: 0, duration: 330,
  });

  const persist = () => store.save(KEY, s);

  /* -------------------- 1. Caler deux morceaux -------------------- */

  const matchOut = h('div');

  const fromBpm = num(s.fromBpm, (v) => { s.fromBpm = v; persist(); renderMatch(); });
  const toBpm = num(s.toBpm, (v) => { s.toBpm = v; persist(); renderMatch(); });
  const fromKey = keySelect(s.fromKey, (v) => { s.fromKey = v; persist(); renderMatch(); });

  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Caler un morceau sur un autre' })),
    h('div.grid.grid-3', null,
      h('div.field', null, h('label', { text: 'Tempo du morceau à caler' }), fromBpm),
      h('div.field', null, h('label', { text: 'Tempo cible' }), toBpm),
      h('div.field', null, h('label', { text: 'Clef du morceau à caler' }), fromKey)
    ),
    h('div.row', { style: { marginBottom: '.8rem' } },
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button', text: 'Inverser les deux tempos',
        on: {
          click: () => {
            const t = s.fromBpm; s.fromBpm = s.toBpm; s.toBpm = t;
            fromBpm.value = s.fromBpm; toBpm.value = s.toBpm;
            persist(); renderMatch();
          },
        },
      })
    ),
    matchOut
  ));

  /* -------------------- 2. Effet du pitch -------------------- */

  const pitchOut = h('div');
  const pitchRange = h('input', { type: 'range', min: -s.range, max: s.range, step: 0.1, value: s.pitch });
  const pitchNum = h('input', { type: 'number', step: 0.1, value: s.pitch, style: { maxWidth: '120px' } });

  pitchRange.addEventListener('input', () => { s.pitch = Number(pitchRange.value); pitchNum.value = s.pitch.toFixed(1); persist(); renderPitch(); });
  pitchNum.addEventListener('change', () => {
    s.pitch = clamp(Number(pitchNum.value) || 0, -s.range, s.range);
    pitchNum.value = s.pitch.toFixed(1);
    pitchRange.value = s.pitch;
    persist(); renderPitch();
  });

  const durationInput = h('input', { type: 'text', value: fmtDuration(s.duration), placeholder: '5:30' });
  durationInput.addEventListener('change', () => {
    s.duration = parseDuration(durationInput.value);
    durationInput.value = fmtDuration(s.duration);
    persist(); renderPitch();
  });

  el.appendChild(h('div.card', null,
    h('div.card-head', null,
      h('h2', { text: 'Effet du pitch' }),
      h('span.spacer', { style: { marginLeft: 'auto' } }),
      segmented(
        RANGES.map((r) => ({ value: r, label: `±${r} %` })),
        s.range,
        (v) => {
          s.range = v;
          s.pitch = clamp(s.pitch, -v, v);
          pitchRange.min = -v; pitchRange.max = v; pitchRange.value = s.pitch;
          pitchNum.value = s.pitch.toFixed(1);
          persist(); renderPitch();
        }
      )
    ),
    h('div.row', { style: { alignItems: 'flex-end' } },
      h('div', { style: { flex: '1 1 220px' } }, h('label.label', { text: 'Pitch appliqué (%)' }), pitchRange),
      h('div.field', { style: { marginBottom: 0 } }, h('label', { text: 'Valeur' }), pitchNum),
      h('div.field', { style: { marginBottom: 0, maxWidth: '140px' } }, h('label', { text: 'Durée du morceau' }), durationInput)
    ),
    h('div.row', { style: { marginTop: '.6rem' } },
      ...[-4, -2, 0, 2, 4].map((p) => h('button.btn.btn-sm', {
        type: 'button', text: p > 0 ? `+${p} %` : `${p} %`,
        on: {
          click: () => {
            s.pitch = clamp(p, -s.range, s.range);
            pitchRange.value = s.pitch; pitchNum.value = s.pitch.toFixed(1);
            persist(); renderPitch();
          },
        },
      }))
    ),
    pitchOut
  ));

  /* -------------------- 3. Plage atteignable -------------------- */

  const reachOut = h('div');
  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Plage atteignable selon la platine' })),
    reachOut,
    h('p.tiny.muted', { style: { marginTop: '.7rem' }, text: 'Avec le master tempo (key lock) activé, la clef ne bouge pas — mais au-delà de ±6 %, l’algorithme laisse souvent entendre des artefacts sur les voix.' })
  ));

  renderMatch();
  renderPitch();
  renderReach();

  /* ------------------------------ Rendus ------------------------------ */

  function renderMatch() {
    clear(matchOut);
    const from = Number(s.fromBpm) || 0;
    const to = Number(s.toBpm) || 0;
    if (!from || !to) { matchOut.appendChild(h('div.empty', { text: 'Saisissez les deux tempos.' })); return; }

    const pct = pitchPercent(from, to);
    const semis = semitonesFromPercent(pct);
    const newKey = transposeCamelot(s.fromKey, Math.round(semis));
    const exact = Math.abs(semis - Math.round(semis)) < 0.12;

    const abs = Math.abs(pct);
    const tone = abs <= 3 ? 'badge-ok' : abs <= 6 ? 'badge-warn' : 'badge-bad';
    const verdict = abs <= 3 ? 'Écart confortable, le mix passera tout seul.'
      : abs <= 6 ? 'Écart notable : le groove change un peu, restez vigilant sur les voix.'
      : abs <= 10 ? 'Écart important : privilégiez un passage instrumental ou un morceau relais.'
      : 'Écart trop grand pour un mix classique — passez par un titre intermédiaire.';

    matchOut.appendChild(h('div.grid.grid-4', null,
      stat('Pitch à appliquer', `${fmtSigned(pct, 2)} %`),
      stat('Écart de tempo', `${fmtNum(Math.abs(to - from), 1)} BPM`),
      stat('Transposition', `${fmtSigned(semis, 2)} demi-ton${Math.abs(semis) >= 2 ? 's' : ''}`),
      stat('Clef sans master tempo', newKey || '—')
    ));

    matchOut.appendChild(h('div.row', { style: { marginTop: '.8rem' } },
      h('span.badge', { class: tone, text: `${verdict}` })
    ));

    if (newKey && s.fromKey) {
      const compat = keyCompatibility(s.fromKey, newKey);
      matchOut.appendChild(h('p.small.muted', { style: { marginTop: '.6rem' },
        text: exact
          ? `À ce pitch, ${s.fromKey} devient ${newKey}. Pensez à mettre à jour votre repère harmonique.`
          : `À ce pitch, ${s.fromKey} tombe entre deux clefs (${newKey} au plus proche, ${(semis - Math.round(semis) >= 0 ? '+' : '')}${((semis - Math.round(semis)) * 100).toFixed(0)} cents). Sans master tempo, le résultat sonnera légèrement désaccordé face à un morceau accordé au diapason.`,
      }));
      if (exact && compat) {
        matchOut.appendChild(h('span.badge.badge-accent', { text: `Vs clef d’origine : ${compat.label}` }));
      }
    }
  }

  function renderPitch() {
    clear(pitchOut);
    const from = Number(s.fromBpm) || 0;
    const bpm = bpmAtPitch(from, s.pitch);
    const semis = semitonesFromPercent(s.pitch);
    const newKey = transposeCamelot(s.fromKey, Math.round(semis));
    const dur = s.duration ? s.duration / (1 + s.pitch / 100) : 0;

    pitchOut.appendChild(h('div.grid.grid-4', { style: { marginTop: '.9rem' } },
      stat('Tempo obtenu', `${fmtNum(bpm, 1)} BPM`),
      stat('Transposition', `${fmtSigned(semis, 2)} demi-ton${Math.abs(semis) >= 2 ? 's' : ''}`),
      stat('Clef obtenue', Math.abs(semis) < 0.5 ? `${s.fromKey} (inchangée)` : (newKey || '—')),
      stat('Nouvelle durée', fmtDuration(dur))
    ));

    const cents = Math.round(semis * 100);
    pitchOut.appendChild(h('p.tiny.muted', { style: { marginTop: '.6rem' },
      text: `Soit ${cents >= 0 ? '+' : '−'}${Math.abs(cents)} cents. Repère utile : +6 % ≈ +1 demi-ton, −6 % ≈ −1 demi-ton.` }));
  }

  function renderReach() {
    clear(reachOut);
    const from = Number(s.fromBpm) || 0;
    const rows = RANGES.map((r) => h('tr', null,
      h('td', { text: `±${r} %` }),
      h('td.num', { text: fmtNum(bpmAtPitch(from, -r), 1) }),
      h('td.num', { text: fmtNum(bpmAtPitch(from, r), 1) }),
      h('td.num', { text: fmtNum(2 * r * from / 100, 1) }),
      h('td.small.muted', { text: `${fmtNum(percentFromSemitones(-1), 1)} % = −1 demi-ton` })
    ));
    reachOut.appendChild(h('div.table-wrap', null,
      h('table', null,
        h('thead', null, h('tr', null,
          h('th', { text: 'Plage' }), h('th.num', { text: 'BPM min' }), h('th.num', { text: 'BPM max' }),
          h('th.num', { text: 'Amplitude' }), h('th', { text: 'Repère' })
        )),
        h('tbody', null, ...rows)
      )
    ));
  }
}

/* ------------------------------ Utilitaires ------------------------------ */

function num(value, onChange) {
  const inp = h('input', { type: 'number', value, step: 0.1, min: 20, max: 300, inputmode: 'decimal' });
  inp.addEventListener('input', () => onChange(Number(inp.value)));
  return inp;
}

function keySelect(value, onChange) {
  const sel = h('select');
  for (const k of allKeys()) {
    sel.appendChild(h('option', {
      value: k.code,
      text: `${k.code} — ${keyLabel(k.pc, k.mode, 'standard')} (${keyLabel(k.pc, k.mode, 'fr')})`,
      selected: k.code === value,
    }));
  }
  sel.value = parseCamelot(value) ? value : '8A';
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function stat(k, v) {
  return h('div.stat', null, h('div.k', { text: k }), h('div.v', { text: v }));
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
