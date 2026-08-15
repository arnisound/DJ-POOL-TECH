/** Tap tempo : mesure manuelle du tempo + métronome de contrôle. */
import { h, segmented } from '../core/dom.js';
import { copyText, keepAwake } from '../core/ui.js';
import * as store from '../core/store.js';
import { fmtNum } from '../core/text.js';

const OPTS_KEY = 'tap.options';

export default function mount(el) {
  const opts = store.load(OPTS_KEY, { window: 8, division: 1, autoReset: 3 });

  let taps = [];          // horodatages en ms
  let bpm = null;
  let stability = 0;
  let resetTimer = 0;
  let wakeLock = null;

  /* ------------------------------ Affichage ------------------------------ */

  const bpmValue = h('div.value', { text: '—' });
  const tapCount = h('div.tiny.muted', { text: 'En attente du premier tap' });
  const stabilityBadge = h('span.badge', { text: 'régularité —' });

  const pad = h('button.tap-pad', { type: 'button' },
    h('span', { text: 'TAPER ICI' }),
    h('span.tiny.muted', { text: 'ou appuyez sur la barre d’espace' })
  );

  const dots = h('div.beat-dots', null, ...[0, 1, 2, 3].map(() => h('i')));

  /* ------------------------------ Métronome ------------------------------ */

  let audioCtx = null;
  let schedulerId = 0;
  let rafId = 0;
  let nextNoteTime = 0;
  let beatIndex = 0;
  const pending = [];

  const metroBtn = h('button.btn', { type: 'button', text: 'Démarrer le métronome' });
  const volume = h('input', { type: 'range', min: 0, max: 100, value: 60 });

  function ensureCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function click(at, accent) {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = (Number(volume.value) / 100) * (accent ? 0.5 : 0.3);
    osc.frequency.value = accent ? 1600 : 900;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.08);
  }

  function startMetronome() {
    if (!bpm) return;
    const ctx = ensureCtx();
    stopMetronome(false);
    nextNoteTime = ctx.currentTime + 0.08;
    beatIndex = 0;
    metroBtn.textContent = 'Arrêter le métronome';
    metroBtn.classList.add('btn-primary');

    schedulerId = setInterval(() => {
      if (!bpm) return;
      const period = 60 / bpm;
      while (nextNoteTime < audioCtx.currentTime + 0.15) {
        const accent = beatIndex % 4 === 0;
        click(nextNoteTime, accent);
        pending.push({ time: nextNoteTime, index: beatIndex % 4 });
        nextNoteTime += period;
        beatIndex++;
      }
    }, 25);

    const tick = () => {
      while (pending.length && pending[0].time <= audioCtx.currentTime) {
        const { index } = pending.shift();
        Array.from(dots.children).forEach((d, i) => d.classList.toggle('on', i === index));
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopMetronome(resetLabel = true) {
    clearInterval(schedulerId);
    cancelAnimationFrame(rafId);
    schedulerId = 0;
    rafId = 0;
    pending.length = 0;
    Array.from(dots.children).forEach((d) => d.classList.remove('on'));
    if (resetLabel) {
      metroBtn.textContent = 'Démarrer le métronome';
      metroBtn.classList.remove('btn-primary');
    }
  }

  metroBtn.addEventListener('click', () => {
    if (schedulerId) stopMetronome();
    else startMetronome();
  });

  /* ------------------------------ Logique de tap ------------------------------ */

  function tap() {
    const now = performance.now();
    clearTimeout(resetTimer);

    // Un écart trop long signifie qu'on recommence une nouvelle mesure.
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now);
    if (taps.length > opts.window + 1) taps = taps.slice(-(opts.window + 1));

    compute();
    flash();

    if (opts.autoReset > 0) {
      resetTimer = setTimeout(() => {
        tapCount.textContent = `${taps.length} taps — mesure figée, tapez pour recommencer`;
        taps = [];
      }, opts.autoReset * 1000);
    }
  }

  function compute() {
    if (taps.length < 2) {
      bpm = null;
      bpmValue.textContent = '—';
      tapCount.textContent = 'Continuez à taper…';
      stabilityBadge.textContent = 'régularité —';
      stabilityBadge.className = 'badge';
      return;
    }

    const intervals = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);

    // Médiane puis rejet des intervalles aberrants (tap raté, hésitation).
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const kept = intervals.filter((v) => Math.abs(v - median) <= median * 0.3);
    const usable = kept.length ? kept : intervals;

    const mean = usable.reduce((a, b) => a + b, 0) / usable.length;
    bpm = (60000 / mean) * opts.division;

    const sd = Math.sqrt(usable.reduce((a, b) => a + (b - mean) ** 2, 0) / usable.length);
    stability = Math.max(0, 1 - sd / mean / 0.06);   // 6 % d'écart = régularité nulle

    bpmValue.textContent = fmtNum(bpm, 1);
    tapCount.textContent = `${taps.length} taps · intervalle moyen ${fmtNum(mean, 1)} ms`;

    const pct = Math.round(stability * 100);
    stabilityBadge.textContent = `régularité ${pct} %`;
    stabilityBadge.className = 'badge ' + (pct >= 75 ? 'badge-ok' : pct >= 45 ? 'badge-warn' : 'badge-bad');
  }

  function flash() {
    pad.classList.add('hit');
    setTimeout(() => pad.classList.remove('hit'), 90);
  }

  function reset() {
    taps = [];
    bpm = null;
    clearTimeout(resetTimer);
    stopMetronome();
    compute();
    tapCount.textContent = 'Remis à zéro';
  }

  function nudge(delta) {
    if (!bpm) return;
    bpm = Math.max(20, bpm + delta);
    bpmValue.textContent = fmtNum(bpm, 1);
    taps = [];   // la valeur devient manuelle
    tapCount.textContent = 'Valeur ajustée manuellement';
  }

  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });

  const onKey = (e) => {
    if (e.code === 'Space' && !e.repeat) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      tap();
    }
  };
  document.addEventListener('keydown', onKey);

  keepAwake().then((lock) => { wakeLock = lock; });

  /* ------------------------------ Assemblage ------------------------------ */

  el.appendChild(h('div.card', null,
    h('div.readout', null, bpmValue, h('div.unit', { text: 'BPM' })),
    h('div.row', { style: { justifyContent: 'center' } }, stabilityBadge),
    h('p.tiny.muted.center', { style: { marginTop: '.4rem' } }, tapCount),
    h('div', { style: { marginTop: '.9rem' } }, pad),
    h('div.row', { style: { marginTop: '.8rem', justifyContent: 'center' } },
      h('button.btn.btn-sm', { type: 'button', text: '−1', on: { click: () => nudge(-1) } }),
      h('button.btn.btn-sm', { type: 'button', text: '−0,1', on: { click: () => nudge(-0.1) } }),
      h('button.btn.btn-sm', { type: 'button', text: '+0,1', on: { click: () => nudge(0.1) } }),
      h('button.btn.btn-sm', { type: 'button', text: '+1', on: { click: () => nudge(1) } }),
      h('button.btn.btn-sm.btn-ghost', { type: 'button', text: 'Réinitialiser', on: { click: reset } })
    )
  ));

  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Métronome' })),
    h('div', { style: { marginBottom: '.8rem' } }, dots),
    h('div.row', null,
      metroBtn,
      h('div', { style: { flex: '1', minWidth: '160px' } },
        h('label.label', { text: 'Volume' }),
        volume
      )
    ),
    h('p.tiny.muted', { style: { marginTop: '.6rem' }, text: 'Le premier temps de chaque mesure est accentué. Utile pour vérifier votre tempo ou caler un morceau à l’oreille.' })
  ));

  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Réglages' })),
    h('div.grid.grid-3', null,
      h('div.field', null,
        h('label', { text: 'Je tape…' }),
        segmented(
          [{ value: 1, label: 'chaque temps' }, { value: 2, label: '1 temps sur 2' }, { value: 0.5, label: '2 par temps' }],
          opts.division,
          (v) => { opts.division = v; store.save(OPTS_KEY, opts); compute(); }
        ),
        h('div.hint', { text: 'Pour les morceaux lents, taper un temps sur deux est plus confortable.' })
      ),
      h('div.field', null,
        h('label', { text: 'Taps pris en compte' }),
        rangeField(opts.window, 4, 24, (v) => { opts.window = v; store.save(OPTS_KEY, opts); compute(); }),
        h('div.hint', { text: 'Plus la fenêtre est large, plus la valeur est stable — et lente à réagir.' })
      ),
      h('div.field', null,
        h('label', { text: 'Remise à zéro auto (s)' }),
        rangeField(opts.autoReset, 0, 10, (v) => { opts.autoReset = v; store.save(OPTS_KEY, opts); }),
        h('div.hint', { text: '0 pour désactiver.' })
      )
    ),
    h('div.row', { style: { marginTop: '.4rem' } },
      h('button.btn.btn-sm', {
        type: 'button', text: 'Copier le tempo',
        on: { click: () => bpm && copyText(bpm.toFixed(1)) },
      }),
      h('a.btn.btn-sm.btn-ghost', { href: '#/pitch', text: 'Ouvrir le calculateur de pitch' })
    )
  ));

  return () => {
    document.removeEventListener('keydown', onKey);
    clearTimeout(resetTimer);
    stopMetronome();
    if (audioCtx && audioCtx.close) audioCtx.close();
    if (wakeLock && wakeLock.release) wakeLock.release().catch(() => {});
  };
}

function rangeField(value, min, max, onChange) {
  const out = h('span.mono', { text: String(value) });
  const range = h('input', { type: 'range', min, max, step: 1, value });
  range.addEventListener('input', () => {
    out.textContent = range.value;
    onChange(Number(range.value));
  });
  return h('div', null, range, h('div.tiny.muted', null, out));
}
