/** Analyseur de morceau : tempo, grille de temps et tonalité. */
import { h, clear } from '../core/dom.js';
import { svg } from '../core/icons.js';
import { toast, toastErr, copyText, download } from '../core/ui.js';
import * as store from '../core/store.js';
import * as setlists from '../core/setlists.js';
import { toCsv, BOM, fmtNum } from '../core/text.js';
import { analyzeFile } from '../audio/analyzer.js';
import { ACCEPTED_AUDIO } from '../audio/decode.js';
import { KEY_PROFILES } from '../audio/analyze.js';
import { toCamelot, toOpenKey, keyLabel, NOTES_SHARP, fmtDuration } from '../core/music.js';

const OPTS_KEY = 'analyse.options';

export default function mount(el) {
  const opts = store.load(OPTS_KEY, { profile: 'shaath', minBpm: 65, maxBpm: 200 });
  let results = [];   // analyses de la session, la plus récente en tête
  let busy = false;

  /* ----------------------------- Dépôt de fichiers ----------------------------- */

  const fileInput = h('input', { type: 'file', accept: ACCEPTED_AUDIO, multiple: true, style: { display: 'none' } });
  const drop = h('div.dropzone', { tabindex: '0', role: 'button' },
    h('span', { html: svg('upload') }).firstChild,
    h('strong', { text: 'Déposez un ou plusieurs morceaux' }),
    h('span.small', { text: 'MP3, WAV, AIFF, FLAC, M4A… — les fichiers restent sur votre appareil' })
  );

  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    handleFiles(Array.from(e.dataTransfer.files || []));
  });
  fileInput.addEventListener('change', () => {
    handleFiles(Array.from(fileInput.files || []));
    fileInput.value = '';
  });

  const progressLabel = h('div.small.muted', { text: '' });
  const progressBar = h('div.progress', null, h('i'));
  const progressWrap = h('div.stack', { style: { marginTop: '.8rem', display: 'none' } }, progressBar, progressLabel);

  const optionsBox = h('details.acc', null,
    h('summary', { text: 'Réglages d’analyse' }),
    h('div.acc-body', null,
      h('div.grid.grid-3', null,
        h('div.field', null,
          h('label', { text: 'Profil tonal' }),
          profileSelect(opts, () => persist())
        ),
        h('div.field', null,
          h('label', { text: 'Tempo minimum' }),
          numberInput(opts.minBpm, (v) => { opts.minBpm = v; persist(); }, 40, 200)
        ),
        h('div.field', null,
          h('label', { text: 'Tempo maximum' }),
          numberInput(opts.maxBpm, (v) => { opts.maxBpm = v; persist(); }, 80, 300)
        )
      ),
      h('p.tiny.muted', { text: "Le profil « électro » convient à la house, la techno et la plupart des musiques club. Réduisez la plage de tempo si vos morceaux sont systématiquement détectés au double ou à la moitié." })
    )
  );

  el.appendChild(h('div.card', null, drop, progressWrap, h('div', { style: { marginTop: '.8rem' } }, optionsBox), fileInput));

  const resultsHost = h('div');
  el.appendChild(resultsHost);
  renderResults();

  // La forme d'onde est peinte dans un canvas : il faut la refaire au changement de thème.
  const onTheme = () => renderResults();
  document.addEventListener('djpt:theme', onTheme);

  function persist() { store.save(OPTS_KEY, opts); }

  /* ----------------------------- Analyse ----------------------------- */

  async function handleFiles(files) {
    const audio = files.filter((f) => /^audio\//.test(f.type) || /\.(mp3|wav|aif{1,2}|flac|m4a|aac|ogg|opus|wma)$/i.test(f.name));
    if (!audio.length) { toastErr('Aucun fichier audio reconnu'); return; }
    if (busy) { toastErr('Analyse déjà en cours'); return; }

    busy = true;
    drop.style.opacity = '.55';
    progressWrap.style.display = '';

    for (let i = 0; i < audio.length; i++) {
      const file = audio[i];
      const prefix = audio.length > 1 ? `(${i + 1}/${audio.length}) ` : '';
      try {
        const res = await analyzeFile(file, {
          profile: opts.profile,
          minBpm: Number(opts.minBpm) || 65,
          maxBpm: Number(opts.maxBpm) || 200,
          onProgress: (p, label) => {
            progressBar.firstChild.style.width = `${Math.round(p * 100)}%`;
            progressLabel.textContent = `${prefix}${file.name} — ${label}`;
          },
        });
        results = [decorate(res), ...results];
        rememberLast(results[0]);
        renderResults();
      } catch (err) {
        console.error(err);
        toastErr(`${file.name} : ${err.message || 'analyse impossible'}`);
      }
    }

    progressWrap.style.display = 'none';
    progressBar.firstChild.style.width = '0';
    drop.style.opacity = '';
    busy = false;
  }

  function decorate(res) {
    const k = res.key;
    return {
      ...res,
      camelot: k ? toCamelot(k.pc, k.mode) : '',
      openKey: k ? toOpenKey(k.pc, k.mode) : '',
      keyStd: k ? keyLabel(k.pc, k.mode, 'standard') : '',
      keyFr: k ? keyLabel(k.pc, k.mode, 'fr') : '',
      bpm: res.tempo ? res.tempo.bpm : null,
      displayBpm: res.tempo ? res.tempo.bpm : null,
    };
  }

  function rememberLast(r) {
    store.save('analyse.dernier', {
      file: r.file.name,
      bpm: r.displayBpm,
      camelot: r.camelot,
      at: Date.now(),
    });
  }

  /* ----------------------------- Rendu ----------------------------- */

  function renderResults() {
    clear(resultsHost);
    if (!results.length) {
      resultsHost.appendChild(h('div.card', null,
        h('div.empty', { text: 'Aucune analyse pour l’instant. Déposez un morceau pour commencer.' })
      ));
      return;
    }

    resultsHost.appendChild(detailCard(results[0]));

    if (results.length > 1) {
      resultsHost.appendChild(historyCard(results.slice(1)));
    }

    resultsHost.appendChild(h('div.row', { style: { marginTop: '.9rem' } },
      h('button.btn.btn-sm', {
        type: 'button', text: 'Exporter la session en CSV',
        on: { click: () => exportCsv(results) },
      }),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button', text: 'Vider la liste',
        on: { click: () => { results = []; renderResults(); } },
      })
    ));
  }

  function detailCard(r) {
    const card = h('div.card');

    card.appendChild(h('div.card-head', null,
      h('h2', { text: r.file.name, style: { overflow: 'hidden', textOverflow: 'ellipsis' } }),
      h('span.spacer'),
      h('span.badge', { text: fmtDuration(r.duration) })
    ));

    const bpmValue = h('div.value', { text: r.displayBpm ? fmtNum(r.displayBpm, 1) : '—' });
    const keyValue = h('div.value', { text: r.camelot || '—', style: { fontSize: 'clamp(2.4rem, 11vw, 4rem)' } });

    const bpmBlock = h('div', null,
      h('div.readout', null, bpmValue, h('div.unit', { text: 'BPM' })),
      r.tempo ? confidenceBar(r.tempo.confidence) : null,
      r.tempo ? h('div.row.tight.center', { style: { justifyContent: 'center', marginTop: '.6rem' } },
        ...r.tempo.candidates
          .filter((c) => c.relation !== 'détecté')
          .map((c) => h('button.btn.btn-sm', {
            type: 'button',
            text: `${fmtNum(c.bpm, 1)} · ${c.relation}`,
            title: `Fiabilité relative : ${Math.round(c.score * 100)} %`,
            on: {
              click: () => {
                r.displayBpm = c.bpm;
                rememberLast(r);
                renderResults();
              },
            },
          }))
      ) : null,
      r.tempo ? h('p.tiny.muted.center', {
        text: `Premier temps à ${fmtNum(r.tempo.firstBeat, 3)} s de l’extrait analysé · un temps = ${fmtNum(60000 / r.displayBpm, 1)} ms`,
      }) : null
    );

    const keyBlock = h('div', null,
      h('div.readout', null, keyValue,
        h('div.unit', { text: r.key ? `${r.keyStd} · ${r.keyFr}` : 'Clef' })),
      r.key ? confidenceBar(r.key.confidence) : null,
      r.key ? h('div.row.tight', { style: { justifyContent: 'center', marginTop: '.6rem' } },
        h('span.badge.badge-accent', { text: `Open Key ${r.openKey}` }),
        Math.abs(r.key.tuningCents) > 8
          ? h('span.badge.badge-warn', { text: `Diapason ${r.key.tuningCents > 0 ? '+' : ''}${r.key.tuningCents.toFixed(0)} cents` })
          : null
      ) : null,
      r.key ? h('details.acc', { style: { marginTop: '.7rem' } },
        h('summary', { text: 'Autres clefs probables' }),
        h('div.acc-body', null,
          h('div.stack', null, ...r.key.ranking.slice(1, 4).map((c) => h('div.row', null,
            h('span.badge', { text: toCamelot(c.pc, c.mode) }),
            h('span.small', { text: keyLabel(c.pc, c.mode, 'fr') }),
            h('span.spacer', { style: { marginLeft: 'auto' } }),
            h('span.tiny.mono.muted', { text: `${(c.score * 100).toFixed(0)} %` })
          )))
        )
      ) : null
    );

    card.appendChild(h('div.grid.grid-2', null, bpmBlock, keyBlock));

    if (r.waveform) card.appendChild(waveformCanvas(r));
    if (r.key) card.appendChild(chromaChart(r.key.chroma));

    card.appendChild(h('div.row', { style: { marginTop: '.9rem' } },
      h('button.btn.btn-primary.btn-sm', {
        type: 'button', text: 'Ajouter à la setlist',
        on: {
          click: () => {
            const name = r.file.name.replace(/\.[^.]+$/, '');
            const parts = name.split(/\s+-\s+/);
            setlists.addTrack({
              artist: parts.length > 1 ? parts[0].trim() : '',
              title: (parts.length > 1 ? parts.slice(1).join(' - ') : name).trim(),
              bpm: r.displayBpm ? Number(r.displayBpm.toFixed(1)) : null,
              key: r.camelot,
              duration: Math.round(r.duration),
            });
            toast('Ajouté à la setlist courante', 'ok');
          },
        },
      }),
      h('button.btn.btn-sm', {
        type: 'button', text: 'Copier le résultat',
        on: {
          click: () => copyText(
            `${r.file.name} — ${r.displayBpm ? r.displayBpm.toFixed(1) : '?'} BPM — ${r.camelot} (${r.keyStd})`
          ),
        },
      })
    ));

    if (r.analyzedDuration && r.analyzedDuration < r.duration - 1) {
      card.appendChild(h('p.tiny.muted', {
        style: { marginTop: '.6rem' },
        text: `Analyse effectuée sur ${Math.round(r.analyzedDuration)} s prélevées au centre du morceau (${fmtDuration(r.duration)} au total).`,
      }));
    }

    return card;
  }

  function historyCard(list) {
    const rows = list.map((r) => h('tr', null,
      h('td', null, h('div.ttl', { text: r.file.name })),
      h('td.num', { text: r.displayBpm ? fmtNum(r.displayBpm, 1) : '—' }),
      h('td', null, h('span.badge.badge-accent', { text: r.camelot || '—' })),
      h('td', { text: r.keyStd || '—' }),
      h('td.num', { text: fmtDuration(r.duration) })
    ));

    return h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Analyses précédentes' })),
      h('div.table-wrap', null,
        h('table', null,
          h('thead', null, h('tr', null,
            h('th', { text: 'Fichier' }), h('th.num', { text: 'BPM' }),
            h('th', { text: 'Camelot' }), h('th', { text: 'Clef' }), h('th.num', { text: 'Durée' })
          )),
          h('tbody', null, ...rows)
        )
      )
    );
  }

  return () => document.removeEventListener('djpt:theme', onTheme);
}

/* ----------------------------- Sous-composants ----------------------------- */

function profileSelect(opts, onChange) {
  const sel = h('select');
  for (const [id, p] of Object.entries(KEY_PROFILES)) {
    sel.appendChild(h('option', { value: id, text: p.label, selected: opts.profile === id }));
  }
  sel.value = opts.profile;
  sel.addEventListener('change', () => { opts.profile = sel.value; onChange(); });
  return sel;
}

function numberInput(value, onChange, min, max) {
  const inp = h('input', { type: 'number', value, min, max, step: 1, inputmode: 'numeric' });
  inp.addEventListener('change', () => onChange(Number(inp.value)));
  return inp;
}

function confidenceBar(confidence) {
  const pct = Math.round((confidence || 0) * 100);
  const level = pct >= 70 ? 'badge-ok' : pct >= 45 ? 'badge-warn' : 'badge-bad';
  const label = pct >= 70 ? 'fiable' : pct >= 45 ? 'à vérifier' : 'peu fiable';
  return h('div.row', { style: { justifyContent: 'center' } },
    h('span.badge', { class: level, text: `confiance ${pct} % · ${label}` })
  );
}

function chromaChart(chroma) {
  const max = Math.max(...chroma) || 1;
  const bars = chroma.map((v, i) => {
    const height = Math.max(2, Math.round((v / max) * 88));
    return h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } },
      h('div', {
        style: {
          width: '100%', height: `${height}px`, borderRadius: '4px 4px 0 0',
          background: v / max > 0.75 ? 'var(--accent)' : 'var(--surface-3)',
        },
      }),
      h('span.tiny.mono.muted', { text: NOTES_SHARP[i] })
    );
  });

  return h('details.acc', { style: { marginTop: '.9rem' } },
    h('summary', { text: 'Profil harmonique (chromagramme)' }),
    h('div.acc-body', null,
      h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px' } }, ...bars),
      h('p.tiny.muted', { style: { marginTop: '.5rem' }, text: 'Répartition de l’énergie par note. Les barres les plus hautes forment l’accord central du morceau.' })
    )
  );
}

function waveformCanvas(r) {
  const canvas = h('canvas.waveform', { width: 960, height: 180 });
  const draw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const hgt = canvas.height;
    const css = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, w, hgt);

    const peaks = r.waveform;
    const barW = w / peaks.length;
    ctx.fillStyle = css.getPropertyValue('--accent-2').trim() || '#21d4c4';
    for (let i = 0; i < peaks.length; i++) {
      const bh = Math.max(1, peaks[i] * (hgt * 0.86));
      ctx.fillRect(i * barW, (hgt - bh) / 2, Math.max(1, barW - 0.6), bh);
    }

    // Grille de temps : trait fort tous les 4 temps (début de mesure).
    if (r.tempo && r.analyzedDuration) {
      const light = document.documentElement.dataset.theme === 'light';
      const strong = light ? 'rgba(19,23,38,.72)' : 'rgba(255,255,255,.75)';
      const weak = light ? 'rgba(19,23,38,.26)' : 'rgba(255,255,255,.22)';
      const span = r.analyzedDuration;
      r.tempo.beats.forEach((t, i) => {
        const x = (t / span) * w;
        if (x < 0 || x > w) return;
        const downbeat = i % 4 === 0;
        ctx.fillStyle = downbeat ? strong : weak;
        ctx.fillRect(x, downbeat ? 0 : hgt * 0.3, downbeat ? 1.5 : 1, downbeat ? hgt : hgt * 0.4);
      });
    }
  };
  requestAnimationFrame(draw);

  return h('div', { style: { marginTop: '.9rem' } },
    canvas,
    h('p.tiny.muted', { style: { marginTop: '.35rem' }, text: 'Forme d’onde de l’extrait analysé et grille de temps détectée (traits clairs : premiers temps de mesure).' })
  );
}

function exportCsv(results) {
  const head = ['Fichier', 'BPM', 'Camelot', 'Open Key', 'Clef', 'Clef (FR)', 'Durée (s)', 'Confiance tempo', 'Confiance clef'];
  const rows = results.map((r) => [
    r.file.name,
    r.displayBpm ? r.displayBpm.toFixed(1) : '',
    r.camelot, r.openKey, r.keyStd, r.keyFr,
    Math.round(r.duration),
    r.tempo ? Math.round(r.tempo.confidence * 100) : '',
    r.key ? Math.round(r.key.confidence * 100) : '',
  ]);
  download(
    `analyse-dj-pool-tech-${new Date().toISOString().slice(0, 10)}.csv`,
    BOM + toCsv([head, ...rows]),
    'text/csv;charset=utf-8'
  );
}
