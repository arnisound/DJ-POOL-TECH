/** Checklist matériel : listes types par prestation, personnalisables. */
import { h, clear } from '../core/dom.js';
import { confirmDialog, promptDialog, printDocument, toastOk } from '../core/ui.js';
import { escapeHtml } from '../core/text.js';
import * as store from '../core/store.js';

const KEY = 'checklist.state';

const PRESETS = {
  club: {
    label: 'Set en club',
    sections: {
      'Indispensables': ['Clé USB principale (bibliothèque à jour)', 'Clé USB de secours', 'Casque', 'Câble casque de rechange', 'Adaptateur jack 6,35 / 3,5 mm'],
      'Confort': ['Bouchons d’oreille filtrants', 'Bouteille d’eau', 'Chiffon microfibre', 'Lampe frontale ou petite lampe USB'],
      'Administratif': ['Fiche technique imprimée', 'Contrat / bon de commande', 'Coordonnées du contact sur place'],
    },
  },
  mobile: {
    label: 'Prestation mobile / mariage',
    sections: {
      'Son': ['Enceintes façade + pieds', 'Caisson de basse', 'Table de mixage', 'Câbles XLR (×6 + secours)', 'Multiprises et rallonges (25 m)', 'Micro sans fil + piles neuves', 'Micro filaire de secours'],
      'DJ': ['Contrôleur ou lecteurs', 'Ordinateur + chargeur', 'Clé USB de secours', 'Casque', 'Carte son externe', 'Adaptateurs (USB-C, jack, RCA/XLR)'],
      'Lumière': ['Barres LED / PAR', 'Pied de levage', 'Machine à fumée + liquide', 'Télécommande DMX'],
      'Logistique': ['Gaffer noir', 'Serre-câbles', 'Passage de câbles / tapis', 'Multimètre ou testeur de prise', 'Trousse à outils', 'Housses de transport'],
      'Administratif': ['Contrat signé', 'Attestation d’assurance', 'Déclaration SACEM', 'Playlist et déroulé de soirée', 'Liste des morceaux interdits'],
    },
  },
  festival: {
    label: 'Festival / plein air',
    sections: {
      'Indispensables': ['Clés USB (×2) formatées et testées', 'Casque + câble de secours', 'Adaptateurs', 'Rekordbox / bibliothèque exportée et vérifiée'],
      'Terrain': ['Vêtements de pluie', 'Crème solaire', 'Bouchons d’oreille', 'Batterie externe', 'Lampe frontale'],
      'Coordination': ['Heure de passage confirmée', 'Contact régisseur enregistré', 'Fiche technique envoyée et validée', 'Pass / accréditation'],
    },
  },
  radio: {
    label: 'Radio / live stream',
    sections: {
      'Technique': ['Carte son', 'Câbles RCA / XLR', 'Adaptateur casque', 'Ordinateur + chargeur', 'Connexion filaire (câble Ethernet)'],
      'Contenu': ['Tracklist prête', 'Titres libres de droits vérifiés', 'Jingles / intro', 'Enregistrement du set activé'],
    },
  },
};

export default function mount(el) {
  const state = store.load(KEY, { preset: 'club', checked: {}, custom: {} });
  if (!PRESETS[state.preset]) state.preset = 'club';

  const host = h('div');

  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Type de prestation' })),
    h('div.row', null,
      ...Object.entries(PRESETS).map(([id, p]) => h('button.btn.btn-sm', {
        type: 'button',
        text: p.label,
        class: state.preset === id ? 'btn-primary' : '',
        on: { click: () => { state.preset = id; persist(); render(); } },
      }))
    )
  ));

  el.appendChild(host);
  render();

  function persist() { store.save(KEY, state); }

  function sections() {
    const base = PRESETS[state.preset].sections;
    const custom = state.custom[state.preset] || {};
    const merged = {};
    for (const [name, items] of Object.entries(base)) merged[name] = [...items];
    for (const [name, items] of Object.entries(custom)) merged[name] = [...(merged[name] || []), ...items];
    return merged;
  }

  function keyFor(section, item) { return `${state.preset}|${section}|${item}`; }

  function render() {
    clear(host);
    const secs = sections();
    const all = Object.entries(secs).flatMap(([s, items]) => items.map((i) => keyFor(s, i)));
    const done = all.filter((k) => state.checked[k]).length;

    const card = h('div.card');
    card.appendChild(h('div.card-head', null,
      h('h2', { text: PRESETS[state.preset].label }),
      h('span.spacer', { style: { marginLeft: 'auto' } }),
      h('span.badge', { class: done === all.length ? 'badge-ok' : '', text: `${done} / ${all.length}` })
    ));
    const bar = h('div.progress', null, h('i', { style: { width: `${all.length ? (done / all.length) * 100 : 0}%` } }));
    card.appendChild(bar);

    for (const [name, items] of Object.entries(secs)) {
      card.appendChild(h('h3', { text: name, style: { marginTop: '1rem' } }));
      for (const item of items) {
        const k = keyFor(name, item);
        const box = h('input', { type: 'checkbox', checked: !!state.checked[k] });
        box.addEventListener('change', () => {
          state.checked[k] = box.checked;
          persist();
          render();
        });
        const isCustom = (state.custom[state.preset]?.[name] || []).includes(item);
        card.appendChild(h('div.row', { style: { gap: '.4rem' } },
          h('label.check', { style: { flex: '1' } }, box,
            h('span', { text: item, style: { textDecoration: state.checked[k] ? 'line-through' : '', opacity: state.checked[k] ? '.55' : '1' } })),
          isCustom ? h('button.btn.btn-sm.btn-ghost', {
            type: 'button', text: '✕', title: 'Supprimer cette ligne',
            on: {
              click: () => {
                state.custom[state.preset][name] = state.custom[state.preset][name].filter((x) => x !== item);
                delete state.checked[k];
                persist();
                render();
              },
            },
          }) : null
        ));
      }
    }

    // Ajout d'une ligne personnalisée
    const newItem = h('input', { type: 'text', placeholder: 'Ajouter un élément…' });
    const sectionSel = h('select');
    for (const name of Object.keys(secs)) sectionSel.appendChild(h('option', { value: name, text: name }));
    sectionSel.appendChild(h('option', { value: '__new__', text: '＋ Nouvelle catégorie' }));

    const addForm = h('form', {
      style: { marginTop: '1.2rem' },
      on: {
        submit: async (e) => {
          e.preventDefault();
          const label = newItem.value.trim();
          if (!label) return;
          let section = sectionSel.value;
          if (section === '__new__') {
            section = await promptDialog('Nom de la catégorie', { title: 'Nouvelle catégorie', value: 'Divers' });
            if (!section) return;
          }
          state.custom[state.preset] = state.custom[state.preset] || {};
          state.custom[state.preset][section] = [...(state.custom[state.preset][section] || []), label];
          newItem.value = '';
          persist();
          render();
        },
      },
    },
      h('div.row', null,
        h('div', { style: { flex: '2 1 200px' } }, newItem),
        h('div', { style: { flex: '1 1 150px' } }, sectionSel),
        h('button.btn.btn-primary.btn-sm', { type: 'submit', text: 'Ajouter' })
      )
    );
    card.appendChild(addForm);

    card.appendChild(h('div.row', { style: { marginTop: '1rem' } },
      h('button.btn.btn-sm', { type: 'button', text: 'Imprimer / PDF', on: { click: () => printChecklist(PRESETS[state.preset].label, secs, state, keyFor) } }),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button', text: 'Tout décocher',
        on: {
          click: async () => {
            if (!(await confirmDialog('Décocher tous les éléments de cette liste ?', { title: 'Réinitialiser' }))) return;
            for (const k of all) delete state.checked[k];
            persist();
            render();
            toastOk('Liste réinitialisée');
          },
        },
      })
    ));

    host.appendChild(card);
  }
}

function printChecklist(title, sections, state, keyFor) {
  const body = Object.entries(sections).map(([name, items]) => `
    <div class="doc-section">
      <h2>${escapeHtml(name)}</h2>
      <ul>${items.map((i) => `<li>${state.checked[keyFor(name, i)] ? '☑' : '☐'} ${escapeHtml(i)}</li>`).join('')}</ul>
    </div>`).join('');

  printDocument(`
    <div class="doc-header"><div class="doc-title">
      <div class="doc-sub">Checklist matériel</div>
      <h1>${escapeHtml(title)}</h1>
    </div></div>
    ${body}
    <div class="doc-foot">Généré avec DJ Pool Tech — ${new Date().toLocaleDateString('fr-FR')}</div>
  `, `Checklist - ${title}`);
}
