/** Calculateur de temps de delay, reverb et LFO synchronisés au tempo. */
import { h, clear } from '../core/dom.js';
import { copyText } from '../core/ui.js';
import * as store from '../core/store.js';
import { phraseSeconds, fmtDuration } from '../core/music.js';
import { fmtNum } from '../core/text.js';

const KEY = 'delay.bpm';

const DIVISIONS = [
  { name: '1 mesure (4 temps)', beats: 4 },
  { name: '1/2 (blanche)',      beats: 2 },
  { name: '1/4 (noire)',        beats: 1 },
  { name: '1/8 (croche)',       beats: 0.5 },
  { name: '1/16 (double)',      beats: 0.25 },
  { name: '1/32',               beats: 0.125 },
  { name: '1/64',               beats: 0.0625 },
];

export default function mount(el) {
  let bpm = store.load(KEY, 124) || 124;

  const bpmInput = h('input', { type: 'number', value: bpm, min: 40, max: 300, step: 0.1, inputmode: 'decimal' });
  const tableHost = h('div');
  const extraHost = h('div');

  bpmInput.addEventListener('input', () => {
    bpm = Number(bpmInput.value) || 0;
    if (bpm > 0) store.save(KEY, bpm);
    render();
  });

  const last = store.load('analyse.dernier', null);

  el.appendChild(h('div.card', null,
    h('div.row', { style: { alignItems: 'flex-end' } },
      h('div.field', { style: { marginBottom: 0, flex: '1 1 180px' } },
        h('label', { text: 'Tempo (BPM)' }), bpmInput),
      last && last.bpm ? h('button.btn.btn-sm', {
        type: 'button', text: `Reprendre ${fmtNum(last.bpm, 1)} BPM`,
        title: last.file || '',
        on: { click: () => { bpm = Number(last.bpm); bpmInput.value = bpm.toFixed(1); store.save(KEY, bpm); render(); } },
      }) : null,
      h('a.btn.btn-sm.btn-ghost', { href: '#/tap', text: 'Tap tempo' })
    ),
    h('div.row', { style: { marginTop: '.7rem' } },
      ...[100, 120, 124, 128, 140, 150, 174].map((v) => h('button.btn.btn-sm', {
        type: 'button', text: String(v),
        on: { click: () => { bpm = v; bpmInput.value = v; store.save(KEY, v); render(); } },
      }))
    )
  ));

  el.appendChild(h('div.card', null,
    h('div.card-head', null,
      h('h2', { text: 'Delay & LFO' }),
      h('span.tiny.muted', { style: { marginLeft: 'auto' }, text: 'Touchez une valeur pour la copier' })
    ),
    tableHost
  ));

  el.appendChild(extraHost);
  render();

  function render() {
    clear(tableHost);
    clear(extraHost);
    if (!bpm || bpm <= 0) {
      tableHost.appendChild(h('div.empty', { text: 'Saisissez un tempo.' }));
      return;
    }

    const beatMs = 60000 / bpm;
    const rows = DIVISIONS.map((d) => {
      const straight = beatMs * d.beats;
      const dotted = straight * 1.5;
      const triplet = straight * (2 / 3);
      return h('tr', null,
        h('td', { text: d.name }),
        cell(straight), cell(dotted), cell(triplet),
        h('td.num.small.muted', { text: `${fmtNum(1000 / straight, 2)} Hz` })
      );
    });

    tableHost.appendChild(h('div.table-wrap', null,
      h('table', null,
        h('thead', null, h('tr', null,
          h('th', { text: 'Division' }),
          h('th.num', { text: 'Droite' }),
          h('th.num', { text: 'Pointée' }),
          h('th.num', { text: 'Triolet' }),
          h('th.num', { text: 'Fréquence LFO' })
        )),
        h('tbody', null, ...rows)
      )
    ));

    tableHost.appendChild(h('p.tiny.muted', { style: { marginTop: '.6rem' },
      text: 'Delay « pointé » (1/8 pointée = 375 ms à 120 BPM) : le classique du delay house et techno, il remplit sans brouiller le contretemps.' }));

    /* ------------------------- Reverb ------------------------- */

    const beat = beatMs;
    extraHost.appendChild(h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Reverb' })),
      h('div.grid.grid-4', null,
        stat('Pré-delay court', `${fmtNum(beat / 16, 0)} ms`, '1/64 — colle à la source'),
        stat('Pré-delay large', `${fmtNum(beat / 8, 0)} ms`, '1/32 — décolle la voix'),
        stat('Decay serré', `${fmtNum(beat / 1000, 2)} s`, '1 temps — reste lisible en club'),
        stat('Decay ample', `${fmtNum((beat * 2) / 1000, 2)} s`, '2 temps — nappes et breaks')
      ),
      h('p.tiny.muted', { style: { marginTop: '.7rem' },
        text: 'Un decay calé sur un multiple du temps s’éteint pile avant le coup suivant : la queue de reverb ne masque pas le kick.' })
    ));

    /* ------------------------- Structure ------------------------- */

    extraHost.appendChild(h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Structure et phrasés' })),
      h('div.grid.grid-4', null,
        ...[1, 4, 8, 16, 32].map((bars) => stat(
          `${bars} mesure${bars > 1 ? 's' : ''}`,
          fmtDuration(phraseSeconds(bars, bpm)),
          `${bars * 4} temps`
        ))
      ),
      h('p.tiny.muted', { style: { marginTop: '.7rem' },
        text: 'La plupart des morceaux club se construisent par blocs de 8, 16 ou 32 mesures : ces durées donnent la longueur réelle d’une intro ou d’un break.' })
    ));
  }
}

function cell(ms) {
  const td = h('td.num', {
    style: { cursor: 'pointer' },
    text: `${fmtNum(ms, 1)} ms`,
    title: 'Copier',
  });
  td.addEventListener('click', () => copyText(ms.toFixed(1)));
  return td;
}

function stat(k, v, hint) {
  return h('div.stat', null,
    h('div.k', { text: k }),
    h('div.v', { text: v }),
    hint ? h('div.tiny.muted', { text: hint }) : null
  );
}
