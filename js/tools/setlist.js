/** Setlist : construction du set, contrôle des enchaînements, export. */
import { h, clear } from '../core/dom.js';
import { svg } from '../core/icons.js';
import { modal, confirmDialog, promptDialog, toastOk, toastErr, download, printDocument, pickFile } from '../core/ui.js';
import { parsePlaylist, readPlaylistFile, summarize } from '../core/playlist-import.js';
import * as sl from '../core/setlists.js';
import * as store from '../core/store.js';
import { escapeHtml, toCsv, slugify, BOM, fmtNum } from '../core/text.js';
import {
  allKeys, keyLabel, parseCamelot, keyCompatibility, tempoDelta,
  fmtDuration, parseDuration,
} from '../core/music.js';

const CUR_KEY = 'setlist.courante';

export default function mount(el) {
  let sets = sl.all();
  if (!sets.length) sets = [sl.create('Mon premier set')];
  let currentId = store.load(CUR_KEY, null);
  if (!sets.find((s) => s.id === currentId)) currentId = sets[0].id;

  const host = h('div');
  el.appendChild(host);
  render();

  function current() { return sl.get(currentId) || sl.all()[0]; }

  function refresh() {
    sets = sl.all();
    store.save(CUR_KEY, currentId);
    render();
  }

  function render() {
    clear(host);
    const set = current();
    if (!set) { host.appendChild(h('div.empty', { text: 'Aucune setlist.' })); return; }

    host.appendChild(headerCard(set));
    host.appendChild(tracksCard(set));
    host.appendChild(statsCard(set));
  }

  /* ------------------------------ En-tête ------------------------------ */

  function headerCard(set) {
    const selector = h('select');
    for (const s of sets) {
      selector.appendChild(h('option', { value: s.id, text: `${s.name} (${(s.tracks || []).length})`, selected: s.id === currentId }));
    }
    selector.value = currentId;
    selector.addEventListener('change', () => { currentId = selector.value; refresh(); });

    const nameInput = h('input', { type: 'text', value: set.name, placeholder: 'Nom du set' });
    nameInput.addEventListener('change', () => { sl.update(set.id, { name: nameInput.value }); refresh(); });

    const venueInput = h('input', { type: 'text', value: set.venue || '', placeholder: 'Club, soirée, événement' });
    venueInput.addEventListener('change', () => sl.update(set.id, { venue: venueInput.value }));

    const dateInput = h('input', { type: 'date', value: set.date || '' });
    dateInput.addEventListener('change', () => sl.update(set.id, { date: dateInput.value }));

    return h('div.card', null,
      h('div.row', { style: { marginBottom: '.8rem' } },
        h('div', { style: { flex: '1 1 220px' } }, selector),
        h('button.btn.btn-sm', {
          type: 'button', text: '＋ Nouveau set',
          on: {
            click: async () => {
              const name = await promptDialog('Nom du set', { title: 'Nouvelle setlist', value: 'Set du ' + new Date().toLocaleDateString('fr-FR') });
              if (name === undefined) return;
              const created = sl.create(name || 'Sans titre');
              currentId = created.id;
              refresh();
            },
          },
        }),
        h('button.btn.btn-sm', {
          type: 'button', text: '⤓ Importer',
          title: 'Importer une playlist Rekordbox, Serato, Engine DJ, Traktor ou M3U',
          on: { click: () => importPlaylist(set) },
        }),
        h('button.btn.btn-sm.btn-danger', {
          type: 'button', text: 'Supprimer',
          on: {
            click: async () => {
              if (!(await confirmDialog(`Supprimer « ${set.name} » et ses ${(set.tracks || []).length} titres ?`, { title: 'Supprimer la setlist', okLabel: 'Supprimer', danger: true }))) return;
              sl.remove(set.id);
              const rest = sl.all();
              currentId = rest.length ? rest[0].id : sl.create('Nouveau set').id;
              refresh();
            },
          },
        })
      ),
      h('div.grid.grid-3', null,
        h('div.field', null, h('label', { text: 'Nom' }), nameInput),
        h('div.field', null, h('label', { text: 'Lieu / soirée' }), venueInput),
        h('div.field', null, h('label', { text: 'Date' }), dateInput)
      )
    );
  }

  /* ------------------------------ Titres ------------------------------ */

  function tracksCard(set) {
    const card = h('div.card');
    const tracks = set.tracks || [];

    card.appendChild(h('div.card-head', null,
      h('h2', { text: `${tracks.length} titre${tracks.length > 1 ? 's' : ''}` }),
      h('span.spacer', { style: { marginLeft: 'auto' } }),
      h('button.btn.btn-primary.btn-sm', {
        type: 'button', text: '＋ Ajouter un titre',
        on: { click: () => editTrack(set, null) },
      })
    ));

    if (!tracks.length) {
      card.appendChild(h('div.empty', null,
        h('p', { text: 'Aucun titre pour l’instant.' }),
        h('p.tiny', { text: 'Ajoutez-les à la main, ou analysez vos morceaux depuis l’outil « Analyse BPM & clef » : le tempo et la clef seront remplis automatiquement.' })
      ));
    }

    tracks.forEach((t, i) => {
      card.appendChild(trackRow(set, t, i));
      if (i < tracks.length - 1) card.appendChild(transitionRow(t, tracks[i + 1]));
    });

    if (tracks.length) {
      card.appendChild(h('div.row', { style: { marginTop: '1rem' } },
        h('button.btn.btn-sm', { type: 'button', text: 'Imprimer / PDF', on: { click: () => printSetlist(set) } }),
        h('button.btn.btn-sm', { type: 'button', text: 'Export CSV', on: { click: () => exportCsv(set) } }),
        h('button.btn.btn-sm.btn-ghost', { type: 'button', text: 'Trier par tempo', on: { click: () => { sl.update(set.id, { tracks: [...tracks].sort((a, b) => (a.bpm || 0) - (b.bpm || 0)) }); refresh(); } } })
      ));
    }

    return card;
  }

  function trackRow(set, t, i) {
    const move = (dir) => {
      const tracks = [...(set.tracks || [])];
      const j = i + dir;
      if (j < 0 || j >= tracks.length) return;
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      sl.update(set.id, { tracks });
      refresh();
    };

    return h('div.list-item', null,
      h('span.mono.muted', { text: String(i + 1).padStart(2, '0'), style: { minWidth: '24px' } }),
      h('div.grow', null,
        h('div.ttl', { text: t.title || 'Sans titre' }),
        h('div.tiny.muted', { text: [t.artist, t.notes].filter(Boolean).join(' · ') || '—' })
      ),
      h('div.row.tight', { style: { flex: 'none' } },
        t.bpm ? h('span.badge', { text: fmtNum(t.bpm, 1) }) : null,
        t.key ? h('span.badge.badge-accent', { text: t.key }) : null,
        t.duration ? h('span.badge', { text: fmtDuration(t.duration) }) : null,
        h('span.badge', { text: '⚡'.repeat(Math.max(1, Math.min(5, t.energy || 3))) })
      ),
      h('div.row.tight', { style: { flex: 'none' } },
        iconBtn('up', 'Monter', () => move(-1)),
        iconBtn('down', 'Descendre', () => move(1)),
        iconBtn('doc', 'Modifier', () => editTrack(set, t)),
        iconBtn('trash', 'Supprimer', async () => {
          if (!(await confirmDialog(`Retirer « ${t.title || 'ce titre'} » du set ?`, { title: 'Supprimer', okLabel: 'Retirer', danger: true }))) return;
          sl.update(set.id, { tracks: (set.tracks || []).filter((x) => x.id !== t.id) });
          refresh();
        })
      )
    );
  }

  function transitionRow(a, b) {
    const parts = [];
    let tone = 'badge';

    if (a.key && b.key && parseCamelot(a.key) && parseCamelot(b.key)) {
      const c = keyCompatibility(a.key, b.key);
      tone = c.score >= 85 ? 'badge-ok' : c.score >= 60 ? 'badge-warn' : 'badge-bad';
      parts.push(`${a.key} → ${b.key} : ${c.label}`);
    }

    if (a.bpm && b.bpm) {
      const d = tempoDelta(a.bpm, b.bpm);
      const dir = b.bpm >= a.bpm ? '+' : '−';
      parts.push(`${dir}${fmtNum(Math.abs(b.bpm - a.bpm), 1)} BPM (${fmtNum(d, 1)} %)`);
      if (d > 6 && tone !== 'badge-bad') tone = 'badge-warn';
    }

    if (!parts.length) return h('div', { style: { height: '.4rem' } });

    return h('div.row', { style: { padding: '.2rem 0 .2rem 2.2rem' } },
      h('span.badge', { class: tone, text: parts.join('  ·  ') })
    );
  }

  function editTrack(set, track) {
    const isNew = !track;
    const t = track ? { ...track } : sl.emptyTrack();

    modal((close) => {
      const title = h('input', { type: 'text', value: t.title, placeholder: 'Titre du morceau' });
      const artist = h('input', { type: 'text', value: t.artist, placeholder: 'Artiste' });
      const bpm = h('input', { type: 'number', value: t.bpm ?? '', step: 0.1, min: 40, max: 300, placeholder: '128', inputmode: 'decimal' });
      const duration = h('input', { type: 'text', value: t.duration ? fmtDuration(t.duration) : '', placeholder: '6:20' });
      const notes = h('input', { type: 'text', value: t.notes, placeholder: 'Intro longue, acapella, à jouer après le break…' });

      const key = h('select');
      key.appendChild(h('option', { value: '', text: '— clef inconnue —' }));
      for (const k of allKeys()) {
        key.appendChild(h('option', { value: k.code, text: `${k.code} — ${keyLabel(k.pc, k.mode, 'standard')}`, selected: k.code === t.key }));
      }
      key.value = t.key || '';

      const energy = h('input', { type: 'range', min: 1, max: 5, step: 1, value: t.energy || 3 });
      const energyOut = h('span.mono', { text: '⚡'.repeat(t.energy || 3) });
      energy.addEventListener('input', () => { energyOut.textContent = '⚡'.repeat(Number(energy.value)); });

      const form = h('form', {
        on: {
          submit: (e) => {
            e.preventDefault();
            const next = {
              ...t,
              title: title.value.trim(),
              artist: artist.value.trim(),
              bpm: bpm.value ? Number(bpm.value) : null,
              key: key.value,
              duration: parseDuration(duration.value),
              energy: Number(energy.value),
              notes: notes.value.trim(),
            };
            const tracks = [...(set.tracks || [])];
            if (isNew) tracks.push(next);
            else {
              const i = tracks.findIndex((x) => x.id === t.id);
              if (i >= 0) tracks[i] = next;
            }
            sl.update(set.id, { tracks });
            close();
            refresh();
          },
        },
      },
        h('h2', { text: isNew ? 'Ajouter un titre' : 'Modifier le titre' }),
        h('div.field', null, h('label', { text: 'Titre' }), title),
        h('div.field', null, h('label', { text: 'Artiste' }), artist),
        h('div.grid.grid-2', null,
          h('div.field', null, h('label', { text: 'Tempo (BPM)' }), bpm),
          h('div.field', null, h('label', { text: 'Durée' }), duration)
        ),
        h('div.field', null, h('label', { text: 'Clef (Camelot)' }), key),
        h('div.field', null, h('label', { text: 'Énergie' }), energy, h('div.hint', null, energyOut)),
        h('div.field', null, h('label', { text: 'Note' }), notes),
        h('div.row.end', { style: { marginTop: '1rem' } },
          h('button.btn.btn-ghost', { type: 'button', text: 'Annuler', on: { click: () => close() } }),
          h('button.btn.btn-primary', { type: 'submit', text: isNew ? 'Ajouter' : 'Enregistrer' })
        )
      );
      return form;
    });
  }

  /* ------------------------------ Import ------------------------------ */

  async function importPlaylist(set) {
    const file = await pickFile('.xml,.nml,.csv,.txt,.tsv,.m3u,.m3u8,.json,text/*,application/xml');
    if (!file) return;

    let result;
    try {
      result = parsePlaylist(await readPlaylistFile(file), file.name);
    } catch (err) {
      toastErr(`Lecture impossible : ${err.message || err}`);
      return;
    }

    if (!result.tracks.length) {
      modal((close) => h('div', null,
        h('h2', { text: 'Aucun titre trouvé' }),
        h('p.small.muted', { text: `Le fichier « ${file.name} » a été reconnu comme : ${result.source}. Aucun morceau n’a pu en être extrait.` }),
        ...(result.warnings || []).map((w) => h('p.tiny.muted', { text: `• ${w}` })),
        h('p.tiny.muted', { text: 'Depuis Rekordbox : Fichier → Exporter la collection au format xml. Depuis Serato : panneau History → Export → csv. Depuis Traktor : clic droit sur la playlist → Export playlist (.nml). Depuis Engine DJ : clic droit sur la playlist → Export.' }),
        h('div.row.end', { style: { marginTop: '1rem' } },
          h('button.btn.btn-primary', { type: 'button', text: 'Fermer', on: { click: () => close() } }))
      ));
      return;
    }

    const stats = summarize(result);

    modal((close) => {
      const preview = result.tracks.slice(0, 8).map((t, i) => h('tr', null,
        h('td.num', { text: String(i + 1) }),
        h('td', null,
          h('div.small', { text: t.title || '—' }),
          h('div.tiny.muted', { text: t.artist || '' })
        ),
        h('td.num', { text: t.bpm ? fmtNum(t.bpm, 1) : '—' }),
        h('td', null, t.key ? h('span.badge.badge-accent', { text: t.key }) : h('span.tiny.muted', { text: '—' })),
        h('td.num', { text: t.duration ? fmtDuration(t.duration) : '—' })
      ));

      const apply = (mode) => {
        const incoming = result.tracks.map((t) => sl.emptyTrack({
          title: t.title,
          artist: t.artist,
          bpm: t.bpm,
          key: t.key,
          duration: t.duration,
          notes: t.comment || '',
        }));

        if (mode === 'new') {
          const created = sl.create(result.name || 'Playlist importée');
          sl.update(created.id, { tracks: incoming });
          currentId = created.id;
        } else {
          sl.update(set.id, { tracks: [...(set.tracks || []), ...incoming] });
        }
        close();
        refresh();
        toastOk(`${incoming.length} titre(s) importé(s)`);
      };

      return h('div', null,
        h('h2', { text: 'Aperçu de l’import' }),
        h('div.row.tight', { style: { marginBottom: '.8rem' } },
          h('span.badge.badge-accent', { text: result.source }),
          h('span.badge', { text: `${stats.count} titres` }),
          h('span.badge', { class: stats.withBpm === stats.count ? 'badge-ok' : 'badge-warn', text: `${stats.withBpm} avec tempo` }),
          h('span.badge', { class: stats.withKey === stats.count ? 'badge-ok' : 'badge-warn', text: `${stats.withKey} avec clef` }),
          stats.totalDuration ? h('span.badge', { text: fmtDuration(stats.totalDuration) }) : null
        ),
        h('p.small.muted', { text: `Playlist détectée : « ${result.name} »` }),
        h('div.table-wrap', { style: { maxHeight: '260px', overflowY: 'auto' } },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th.num', { text: '#' }), h('th', { text: 'Titre' }),
              h('th.num', { text: 'BPM' }), h('th', { text: 'Clef' }), h('th.num', { text: 'Durée' })
            )),
            h('tbody', null, ...preview)
          )
        ),
        result.tracks.length > 8
          ? h('p.tiny.muted', { text: `… et ${result.tracks.length - 8} autre(s).` })
          : null,
        ...(result.warnings || []).map((w) => h('p.tiny', { text: `⚠ ${w}`, style: { color: 'var(--warn)' } })),
        h('div.row.end', { style: { marginTop: '1rem' } },
          h('button.btn.btn-ghost', { type: 'button', text: 'Annuler', on: { click: () => close() } }),
          h('button.btn', { type: 'button', text: 'Ajouter au set courant', on: { click: () => apply('append') } }),
          h('button.btn.btn-primary', { type: 'button', text: 'Créer une setlist', on: { click: () => apply('new') } })
        )
      );
    });
  }

  /* ------------------------------ Statistiques ------------------------------ */

  function statsCard(set) {
    const tracks = set.tracks || [];
    if (!tracks.length) return h('div');

    const total = sl.totalDuration(set);
    const withBpm = tracks.filter((t) => t.bpm);
    const avg = withBpm.length ? withBpm.reduce((s, t) => s + Number(t.bpm), 0) / withBpm.length : 0;
    const minBpm = withBpm.length ? Math.min(...withBpm.map((t) => Number(t.bpm))) : 0;
    const maxBpm = withBpm.length ? Math.max(...withBpm.map((t) => Number(t.bpm))) : 0;

    const risky = tracks.reduce((n, t, i) => {
      if (i === 0) return n;
      const prev = tracks[i - 1];
      if (!prev.key || !t.key) return n;
      return keyCompatibility(prev.key, t.key).score < 60 ? n + 1 : n;
    }, 0);

    const bars = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '3px', height: '70px', marginTop: '.4rem' } },
      ...tracks.map((t) => h('div', {
        title: `${t.title || 'Sans titre'} — énergie ${t.energy || 3}/5`,
        style: {
          flex: '1', minWidth: '4px',
          height: `${((t.energy || 3) / 5) * 100}%`,
          borderRadius: '3px 3px 0 0',
          background: 'linear-gradient(180deg, var(--accent-2), var(--accent))',
          opacity: String(0.45 + ((t.energy || 3) / 5) * 0.55),
        },
      }))
    );

    return h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Vue d’ensemble' })),
      h('div.grid.grid-4', null,
        stat('Durée totale', fmtDuration(total)),
        stat('Tempo moyen', avg ? `${fmtNum(avg, 1)} BPM` : '—'),
        stat('Amplitude', withBpm.length ? `${fmtNum(minBpm, 0)} → ${fmtNum(maxBpm, 0)}` : '—'),
        stat('Enchaînements à risque', String(risky))
      ),
      h('div', { style: { marginTop: '1rem' } },
        h('div.label', { text: 'Courbe d’énergie' }),
        bars,
        h('p.tiny.muted', { style: { marginTop: '.4rem' }, text: 'Un set qui monte régulièrement, avec une ou deux respirations, tient mieux la piste qu’une succession de sommets.' })
      )
    );
  }
}

/* ------------------------------ Sorties ------------------------------ */

function exportCsv(set) {
  const head = ['#', 'Titre', 'Artiste', 'BPM', 'Clef', 'Durée', 'Énergie', 'Note'];
  const rows = (set.tracks || []).map((t, i) => [
    i + 1, t.title, t.artist, t.bpm ?? '', t.key ?? '', fmtDuration(t.duration), t.energy ?? '', t.notes ?? '',
  ]);
  download(`setlist-${slugify(set.name, 'set')}.csv`, BOM + toCsv([head, ...rows]), 'text/csv;charset=utf-8');
  toastOk('CSV exporté');
}

function printSetlist(set) {
  const tracks = set.tracks || [];
  const rows = tracks.map((t, i) => {
    let transition = '';
    if (i > 0) {
      const prev = tracks[i - 1];
      const bits = [];
      if (prev.key && t.key && parseCamelot(prev.key) && parseCamelot(t.key)) bits.push(keyCompatibility(prev.key, t.key).label);
      if (prev.bpm && t.bpm) bits.push(`${t.bpm >= prev.bpm ? '+' : '−'}${Math.abs(t.bpm - prev.bpm).toFixed(1)} BPM`);
      transition = bits.join(' · ');
    }
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(t.title || '')}</strong>${t.artist ? `<br><span style="color:#666">${escapeHtml(t.artist)}</span>` : ''}</td>
      <td>${t.bpm ? Number(t.bpm).toFixed(1) : ''}</td>
      <td>${escapeHtml(t.key || '')}</td>
      <td>${t.duration ? fmtDuration(t.duration) : ''}</td>
      <td>${'⚡'.repeat(Math.max(1, Math.min(5, t.energy || 3)))}</td>
      <td style="font-size:8pt;color:#555">${escapeHtml(transition)}${t.notes ? `<br>${escapeHtml(t.notes)}` : ''}</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="doc-header">
      <div class="doc-title">
        <div class="doc-sub">Setlist</div>
        <h1>${escapeHtml(set.name || 'Set')}</h1>
        <div>${[set.venue, set.date ? new Date(set.date).toLocaleDateString('fr-FR') : ''].filter(Boolean).map(escapeHtml).join(' — ')}</div>
      </div>
    </div>
    <div class="doc-section">
      <table>
        <thead><tr><th>#</th><th>Titre</th><th>BPM</th><th>Clef</th><th>Durée</th><th>Énergie</th><th>Enchaînement / note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="doc-foot">
      ${tracks.length} titres — durée totale ${fmtDuration(sl.totalDuration(set))} — généré avec DJ Pool Tech
    </div>`;
  printDocument(html, `Setlist - ${set.name || 'set'}`);
}

/* ------------------------------ Utilitaires ------------------------------ */

function iconBtn(name, label, onClick) {
  const b = h('button.icon-btn', { type: 'button', title: label, 'aria-label': label, style: { width: '34px', height: '34px', padding: '7px' } });
  b.innerHTML = svg(name);
  b.addEventListener('click', onClick);
  return b;
}

function stat(k, v) {
  return h('div.stat', null, h('div.k', { text: k }), h('div.v', { text: v }));
}

