/** Performeurs : besoins techniques et liste des lignes. */
import { h, clear } from '../core/dom.js';
import { buildForm } from '../core/forms.js';
import { modal, confirmDialog, toastOk, toast, printDocument } from '../core/ui.js';
import { escapeHtml } from '../core/text.js';
import {
  ROLES, CAPTURE, emptyPerformer, allPerformers, addPerformer, updatePerformer,
  removePerformer, performerLabel, inputList, requirementSummary,
} from '../core/performers.js';
import { loadProfile, documentHeader } from '../core/profile.js';
import { allPlans, savePlan, addNode, addLink } from '../core/patch.js';

export default function mount(el) {
  let performers = allPerformers();
  const host = h('div');
  el.appendChild(host);
  render();

  function refresh() {
    performers = allPerformers();
    render();
  }

  function render() {
    clear(host);
    host.appendChild(addCard());
    host.appendChild(listCard());
    if (performers.length) {
      host.appendChild(patchCard());
      host.appendChild(needsCard());
      host.appendChild(actionsBar());
    }
  }

  /* ------------------------------ Ajout ------------------------------ */

  function addCard() {
    const roleSelect = h('select');
    for (const [id, role] of Object.entries(ROLES)) {
      roleSelect.appendChild(h('option', { value: id, text: role.label }));
    }

    return h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'Ajouter un performeur' })),
      h('p.small.muted', { text: 'Choisissez un rôle : ses besoins techniques habituels sont pré-remplis, vous n’avez plus qu’à ajuster.' }),
      h('div.row', null,
        h('div', { style: { flex: '1 1 220px' } }, roleSelect),
        h('button.btn.btn-primary', {
          type: 'button', text: 'Ajouter',
          on: {
            click: () => {
              const performer = emptyPerformer(roleSelect.value);
              addPerformer(performer);
              refresh();
              editPerformer(performer);
            },
          },
        })
      )
    );
  }

  /* ------------------------------ Liste ------------------------------ */

  function listCard() {
    const card = h('div.card', null,
      h('div.card-head', null, h('h2', { text: `Performeurs (${performers.length})` }))
    );

    if (!performers.length) {
      card.appendChild(h('div.empty', null,
        h('p', { text: 'Aucun performeur.' }),
        h('p.tiny', { text: 'Un saxophoniste, un chanteur ou un percussionniste change la fiche technique : micro, retour, pied, alimentation. Ajoutez-les ici, ils apparaîtront dans tous vos documents.' })
      ));
      return card;
    }

    for (const performer of performers) {
      const badges = [
        performer.capture !== 'none' ? CAPTURE[performer.capture] : null,
        performer.phantom ? '48 V' : null,
        performer.needsMonitor ? 'retour' : null,
        performer.needsStand ? 'pied' : null,
        performer.needsPower ? '230 V' : null,
        Number(performer.channels) > 1 ? `${performer.channels} lignes` : null,
      ].filter(Boolean);

      card.appendChild(h('div.list-item', null,
        h('div.grow', null,
          h('div.ttl', { text: performerLabel(performer) }),
          h('div.tiny.muted', { text: [performer.instrument, performer.micModel].filter(Boolean).join(' · ') || '—' }),
          h('div.row.tight', { style: { marginTop: '.3rem' } }, ...badges.map((b) => h('span.badge', { text: b })))
        ),
        h('button.btn.btn-sm', { type: 'button', text: 'Modifier', on: { click: () => editPerformer(performer) } }),
        h('button.btn.btn-sm.btn-danger', {
          type: 'button', text: '✕',
          on: {
            click: async () => {
              if (!(await confirmDialog(`Retirer ${performerLabel(performer)} ?`, { title: 'Supprimer', okLabel: 'Retirer', danger: true }))) return;
              removePerformer(performer.id);
              refresh();
            },
          },
        })
      ));
    }
    return card;
  }

  function editPerformer(performer) {
    const data = { ...performer };
    const schema = [
      { name: 'name', label: 'Nom', placeholder: 'Prénom ou nom de scène', width: 'full' },
      { name: 'role', label: 'Rôle', type: 'select', options: Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label })) },
      { name: 'instrument', label: 'Instrument' },
      { name: 'capture', label: 'Captation', type: 'select', options: Object.entries(CAPTURE).map(([value, label]) => ({ value, label })) },
      { name: 'channels', label: 'Nombre de lignes', type: 'number', min: 1, max: 8 },
      { name: 'micModel', label: 'Micro / DI souhaité', width: 'full' },
      { name: 'phantom', label: 'Alimentation fantôme 48 V', type: 'checkbox' },
      { name: 'needsMonitor', label: 'Retour de scène dédié', type: 'checkbox' },
      { name: 'needsStand', label: 'Pied de micro', type: 'checkbox' },
      { name: 'needsPower', label: 'Prise 230 V sur scène', type: 'checkbox' },
      { name: 'space', label: 'Espace nécessaire', width: 'full' },
      { name: 'notes', label: 'Remarques', type: 'textarea', rows: 3, width: 'full' },
    ];

    modal((close) => {
      const formHost = h('div');
      const build = () => {
        clear(formHost);
        formHost.appendChild(buildForm(schema, data, (name, value) => {
          // Changer de rôle recharge les valeurs habituelles de ce rôle.
          if (name === 'role') {
            Object.assign(data, ROLES[value]?.defaults || {}, { role: value, name: data.name, id: data.id });
            build();
          }
        }));
      };
      build();

      return h('div', null,
        h('h2', { text: 'Performeur' }),
        formHost,
        h('div.row.end', { style: { marginTop: '1rem' } },
          h('button.btn.btn-ghost', { type: 'button', text: 'Annuler', on: { click: () => close() } }),
          h('button.btn.btn-primary', {
            type: 'button', text: 'Enregistrer',
            on: {
              click: () => {
                updatePerformer(performer.id, data);
                close();
                refresh();
                toastOk('Performeur enregistré');
              },
            },
          })
        )
      );
    });
  }

  /* --------------------------- Liste des lignes --------------------------- */

  function patchCard() {
    const rows = inputList(performers);
    return h('div.card', null,
      h('div.card-head', null,
        h('h2', { text: 'Liste des lignes' }),
        h('span.spacer', { style: { marginLeft: 'auto' } }),
        h('span.badge.badge-accent', { text: `${rows.length} voies` })
      ),
      h('p.small.muted', { text: 'C’est le tableau que le régisseur attend : il lui dit quoi brancher, sur quelle voie, avec quel micro.' }),
      h('div.table-wrap', null,
        h('table', null,
          h('thead', null, h('tr', null,
            h('th.num', { text: 'Voie' }), h('th', { text: 'Source' }), h('th', { text: 'Captation' }),
            h('th', { text: 'Micro / DI' }), h('th', { text: '48 V' }), h('th', { text: 'Pied' })
          )),
          h('tbody', null, ...rows.map((r) => h('tr', null,
            h('td.num', { text: String(r.n) }),
            h('td', { text: r.source }),
            h('td.small', { text: CAPTURE[r.capture] || r.capture }),
            h('td.small.muted', { text: r.device }),
            h('td', { text: r.phantom ? 'oui' : '—' }),
            h('td', { text: r.stand ? 'oui' : '—' })
          )))
        )
      )
    );
  }

  function needsCard() {
    const { needs, spaces } = requirementSummary(performers);
    return h('div.card', null,
      h('div.card-head', null, h('h2', { text: 'À demander à l’organisateur' })),
      needs.length
        ? h('ul', { style: { margin: 0, paddingLeft: '1.1rem' } }, ...needs.map((n) => h('li.small', { text: n })))
        : h('p.small.muted', { text: 'Aucun besoin particulier.' }),
      spaces.length ? h('div', { style: { marginTop: '.8rem' } },
        h('div.label', { text: 'Espace scénique' }),
        h('ul', { style: { margin: 0, paddingLeft: '1.1rem' } }, ...spaces.map((s) => h('li.small.muted', { text: s })))
      ) : null,
      h('p.tiny.muted', { style: { marginTop: '.8rem' }, text: 'Ces éléments sont repris automatiquement dans la fiche technique et le rider.' })
    );
  }

  function actionsBar() {
    return h('div.sticky-actions', null,
      h('button.btn.btn-primary', {
        type: 'button', text: 'Imprimer la liste des lignes',
        on: { click: () => printDocument(performersDocument(loadProfile(), performers), 'Liste des lignes') },
      }),
      h('button.btn.btn-sm', {
        type: 'button', text: 'Ajouter au plan de câblage',
        on: { click: () => addToPlan(performers) },
      }),
      h('a.btn.btn-sm.btn-ghost', { href: '#/rider', text: 'Voir le rider' })
    );
  }
}

/* --------------------- Report vers le plan de câblage --------------------- */

function addToPlan(performers) {
  const plans = allPlans();
  if (!plans.length) {
    toast('Créez d’abord un plan de câblage.', 'err');
    return;
  }
  const plan = plans[0];

  // On cherche la console ou le mixeur qui recevra les micros.
  const target = plan.nodes.find((n) => ['djma9', 'djm900', 'djmv10', 'x1850', 'djm450', 'xone96', 'mixerlive'].includes(n.gearId));
  let added = 0;

  for (const performer of performers) {
    if (performer.capture === 'none') continue;

    const gearId = performer.capture === 'hf' ? 'michf'
      : performer.capture === 'di' ? 'dibox'
      : performer.capture === 'clip' ? 'micinstr'
      : 'micfil';

    const node = addNode(plan, gearId);
    node.label = performerLabel(performer);
    added++;

    if (target) {
      const micPorts = ['mic1', 'mic2', 'in1', 'in2', 'in3', 'in4'];
      const used = new Set(plan.links.filter((l) => l.to.node === target.id).map((l) => l.to.port));
      const free = micPorts.find((port) => !used.has(port));
      if (free) addLink(plan, { node: node.id, port: 'out' }, { node: target.id, port: free }, { length: 5 });
    }

    if (performer.needsMonitor) {
      const wedge = addNode(plan, 'wedge');
      wedge.label = `Retour ${performer.name || ROLES[performer.role]?.label || ''}`.trim();
      added++;
    }
  }

  savePlan(plan);
  toastOk(`${added} élément(s) ajouté(s) au plan « ${plan.name} »`);
}

/* ------------------------------ Document ------------------------------ */

export function performersDocument(profile, performers) {
  const rows = inputList(performers);
  const { needs, spaces } = requirementSummary(performers);

  return `
    ${documentHeader(profile, 'Liste des lignes', profile.artistName || 'Plateau')}
    <div class="doc-section">
      <h2>Liste des lignes</h2>
      <table>
        <thead><tr><th>Voie</th><th>Source</th><th>Captation</th><th>Micro / DI</th><th>48 V</th><th>Pied</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td>${r.n}</td>
          <td>${escapeHtml(r.source)}</td>
          <td>${escapeHtml(CAPTURE[r.capture] || r.capture)}</td>
          <td>${escapeHtml(r.device)}</td>
          <td>${r.phantom ? 'oui' : ''}</td>
          <td>${r.stand ? 'oui' : ''}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    ${needs.length ? `<div class="doc-section"><h2>À fournir</h2><ul>${needs.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>` : ''}
    ${spaces.length ? `<div class="doc-section"><h2>Espace scénique</h2><ul>${spaces.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : ''}
    <div class="doc-foot">Généré avec DJ Pool Tech — ${new Date().toLocaleDateString('fr-FR')}</div>`;
}
