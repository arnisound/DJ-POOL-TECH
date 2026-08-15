/** Timer de set : compte à rebours lisible en cabine, avec alertes. */
import { h, checkbox } from '../core/dom.js';
import { keepAwake, toast } from '../core/ui.js';
import * as store from '../core/store.js';
import { fmtDuration } from '../core/music.js';

const KEY = 'timer.options';
const PRESETS = [30, 45, 60, 75, 90, 120];

export default function mount(el) {
  const opts = store.load(KEY, { minutes: 60, beep: true, alerts: [10, 5, 1] });

  let totalMs = opts.minutes * 60000;
  let remaining = totalMs;
  let running = false;
  let endAt = 0;
  let rafId = 0;
  let wakeLock = null;
  const fired = new Set();

  /* ------------------------------ Affichage ------------------------------ */

  const display = h('div.value', { text: fmtDuration(remaining / 1000), style: { fontSize: 'clamp(3.4rem, 20vw, 7rem)' } });
  const bar = h('div.progress', { style: { marginTop: '1rem' } }, h('i'));
  const endLabel = h('div.tiny.muted.center', { text: '' });
  const clockLabel = h('div.tiny.muted.center', { text: '' });

  const startBtn = h('button.btn.btn-primary.btn-lg', { type: 'button', text: 'Démarrer' });
  const resetBtn = h('button.btn.btn-lg', { type: 'button', text: 'Réinitialiser' });
  const fullBtn = h('button.btn.btn-lg.btn-ghost', { type: 'button', text: 'Plein écran' });

  const panel = h('div.card', null,
    h('div.readout', null, display, h('div.unit', { text: 'temps restant' })),
    bar,
    h('div', { style: { marginTop: '.6rem' } }, endLabel, clockLabel),
    h('div.row', { style: { marginTop: '1rem', justifyContent: 'center' } }, startBtn, resetBtn, fullBtn)
  );
  el.appendChild(panel);

  /* ------------------------------ Réglages ------------------------------ */

  const minutesInput = h('input', { type: 'number', value: opts.minutes, min: 1, max: 600, step: 1, inputmode: 'numeric' });
  minutesInput.addEventListener('change', () => {
    opts.minutes = Math.max(1, Number(minutesInput.value) || 60);
    minutesInput.value = opts.minutes;
    store.save(KEY, opts);
    reset();
  });

  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Durée du set' })),
    h('div.row', null,
      ...PRESETS.map((m) => h('button.btn.btn-sm', {
        type: 'button', text: `${m} min`,
        on: {
          click: () => {
            opts.minutes = m;
            minutesInput.value = m;
            store.save(KEY, opts);
            reset();
          },
        },
      }))
    ),
    h('div.grid.grid-2', { style: { marginTop: '.9rem' } },
      h('div.field', null, h('label', { text: 'Durée personnalisée (minutes)' }), minutesInput),
      h('div.field', null,
        h('label', { text: 'Alertes' }),
        checkbox('Bip sonore aux alertes', opts.beep, (v) => { opts.beep = v; store.save(KEY, opts); }),
        h('div.hint', { text: `Alertes visuelles et sonores à ${opts.alerts.join(', ')} minutes de la fin, puis à la fin du set.` })
      )
    )
  ));

  el.appendChild(h('div.card', null,
    h('p.small.muted', { text: 'Le compte à rebours continue même si l’écran s’assombrit, et l’application demande à garder l’écran allumé tant que le timer tourne. En mode plein écran, seul le chronomètre reste affiché : parfait posé sur la table à côté des platines.' })
  ));

  /* ------------------------------ Logique ------------------------------ */

  function tick() {
    if (running) {
      remaining = Math.max(0, endAt - Date.now());
      if (remaining === 0) {
        running = false;
        startBtn.textContent = 'Démarrer';
        alertAt(0);
      }
    }
    paint();
    rafId = requestAnimationFrame(tick);
  }

  function paint() {
    const secs = remaining / 1000;
    display.textContent = fmtDuration(secs);

    const ratio = totalMs ? 1 - remaining / totalMs : 0;
    bar.firstChild.style.width = `${Math.min(100, ratio * 100)}%`;

    const mins = secs / 60;
    let color = 'var(--text)';
    if (secs <= 0) color = 'var(--danger)';
    else if (mins <= 1) color = 'var(--danger)';
    else if (mins <= 5) color = 'var(--warn)';
    display.style.color = color;

    if (running) {
      const end = new Date(Date.now() + remaining);
      endLabel.textContent = `Fin prévue à ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (remaining === 0) {
      endLabel.textContent = 'Set terminé';
    } else {
      endLabel.textContent = `Durée programmée : ${opts.minutes} min`;
    }
    clockLabel.textContent = new Date().toLocaleTimeString('fr-FR');

    // Alertes
    for (const m of opts.alerts) {
      if (running && remaining <= m * 60000 && !fired.has(m)) {
        fired.add(m);
        alertAt(m);
      }
    }
  }

  function alertAt(minutes) {
    if (opts.beep) beep(minutes === 0 ? 3 : 1);
    toast(minutes === 0 ? 'Set terminé' : `Plus que ${minutes} minute${minutes > 1 ? 's' : ''}`, minutes <= 1 ? 'err' : '');
    if (navigator.vibrate) navigator.vibrate(minutes === 0 ? [200, 100, 200, 100, 200] : [120]);
  }

  let audioCtx = null;
  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* audio indisponible */ }
  }

  function beep(times = 1) {
    try {
      unlockAudio();
      if (!audioCtx) return;
      for (let i = 0; i < times; i++) {
        const at = audioCtx.currentTime + i * 0.28;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(at);
        osc.stop(at + 0.25);
      }
    } catch { /* audio indisponible : les alertes visuelles suffisent */ }
  }

  function start() {
    if (running) {
      running = false;
      startBtn.textContent = 'Reprendre';
      if (wakeLock && wakeLock.release) { wakeLock.release().catch(() => {}); wakeLock = null; }
      return;
    }
    if (remaining <= 0) reset();
    endAt = Date.now() + remaining;
    running = true;
    startBtn.textContent = 'Pause';
    unlockAudio();   // l'interaction utilisateur autorise l'audio pour les alertes
    keepAwake().then((l) => { wakeLock = l; });
  }

  function reset() {
    totalMs = opts.minutes * 60000;
    remaining = totalMs;
    running = false;
    fired.clear();
    startBtn.textContent = 'Démarrer';
    paint();
  }

  startBtn.addEventListener('click', start);
  resetBtn.addEventListener('click', reset);
  fullBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (panel.requestFullscreen) panel.requestFullscreen().catch(() => {});
  });

  const onVisibility = () => { if (!document.hidden) paint(); };
  document.addEventListener('visibilitychange', onVisibility);

  reset();
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    document.removeEventListener('visibilitychange', onVisibility);
    if (audioCtx && audioCtx.close) audioCtx.close();
    if (wakeLock && wakeLock.release) wakeLock.release().catch(() => {});
  };
}
