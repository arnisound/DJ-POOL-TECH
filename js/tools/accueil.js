/** Accueil : accès aux outils + reprise du travail en cours. */
import { h } from '../core/dom.js';
import { svg } from '../core/icons.js';
import * as store from '../core/store.js';
import { TOOLS, GROUPS } from './index.js';
import { fmtDuration } from '../core/music.js';

export default function mount(el) {
  const profile = store.load('profil', null);
  const setlists = store.load('setlists', []);
  const lastAnalysis = store.load('analyse.dernier', null);

  if (profile?.artistName || setlists.length || lastAnalysis) {
    el.appendChild(resumeCard(profile, setlists, lastAnalysis));
  }

  for (const group of GROUPS) {
    const tools = TOOLS.filter((t) => t.group === group.id && t.id !== 'accueil');
    if (!tools.length) continue;

    el.appendChild(h('h2', { text: group.label || 'Outils', style: { marginTop: '1.4rem' } }));
    const grid = h('div.tool-grid');
    for (const t of tools) {
      grid.appendChild(h('a.tool-tile', { href: `#/${t.id}` },
        h('span', { html: svg(t.icon) }).firstChild,
        h('strong', { text: t.title }),
        h('span', { text: t.desc })
      ));
    }
    el.appendChild(grid);
  }

  el.appendChild(h('div.card', { style: { marginTop: '1.4rem' } },
    h('div.card-head', null, h('h2', { text: 'Comment ça marche' })),
    h('div.grid.grid-3', null,
      infoBlock('Rien ne quitte votre appareil', "Les morceaux sont décodés et analysés dans le navigateur. Aucun fichier n'est téléversé, aucun compte n'est requis."),
      infoBlock('Utilisable hors ligne', "Ajoutez l'application à votre écran d'accueil : elle reste disponible en cabine, même sans réseau."),
      infoBlock('Export PDF natif', "Les documents s'impriment au format A4 via la fonction d'impression du navigateur — choisissez « Enregistrer en PDF ».")
    )
  ));
}

function infoBlock(title, text) {
  return h('div', null,
    h('h3', { text: title, style: { fontSize: '.95rem' } }),
    h('p.muted.small', { text })
  );
}

function resumeCard(profile, setlists, lastAnalysis) {
  const card = h('div.card');
  card.appendChild(h('div.card-head', null,
    h('h2', { text: profile?.artistName ? `Bon retour, ${profile.artistName}` : 'Reprendre' })
  ));

  const row = h('div.grid.grid-3');

  if (lastAnalysis?.file) {
    row.appendChild(h('a.stat', { href: '#/analyse', style: { display: 'block', color: 'inherit' } },
      h('div.k', { text: 'Dernier morceau analysé' }),
      h('div.v', { text: `${Math.round(lastAnalysis.bpm || 0)} BPM · ${lastAnalysis.camelot || '—'}` }),
      h('div.tiny.muted', { text: lastAnalysis.file })
    ));
  }

  if (setlists.length) {
    const last = setlists[0];
    const total = (last.tracks || []).reduce((s, t) => s + (t.duration || 0), 0);
    row.appendChild(h('a.stat', { href: '#/setlist', style: { display: 'block', color: 'inherit' } },
      h('div.k', { text: 'Dernière setlist' }),
      h('div.v', { text: `${(last.tracks || []).length} titres` }),
      h('div.tiny.muted', { text: `${last.name || 'Sans titre'} · ${fmtDuration(total)}` })
    ));
  }

  if (profile?.artistName) {
    row.appendChild(h('a.stat', { href: '#/fiche-technique', style: { display: 'block', color: 'inherit' } },
      h('div.k', { text: 'Documents' }),
      h('div.v', { text: 'Fiche & rider' }),
      h('div.tiny.muted', { text: 'Profil renseigné, prêt à imprimer' })
    ));
  }

  card.appendChild(row);
  return card;
}
