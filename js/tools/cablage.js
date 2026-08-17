/** Plan de câblage : éditeur visuel du schéma de branchement. */
import { h, clear, segmented } from '../core/dom.js';
import { modal, confirmDialog, promptDialog, toast, toastOk, toastErr, printDocument, downloadJSON, pickFile, readDataURL } from '../core/ui.js';
import * as store from '../core/store.js';
import { escapeHtml, slugify } from '../core/text.js';
import { GEAR_MAP, CATEGORIES, gearByCategory } from '../core/gear.js';
import { loadProfile } from '../core/profile.js';
import {
  PRESETS, emptyPlan, addNode, removeNode, addLink, removeLink,
  cableList, describeLink, nodeLabel, validate, renderPlan, planBounds, planToPrintSVG,
  allPlans, savePlan, deletePlan,
} from '../core/patch.js';
import {
  SLOTS, defaultSlot, renderStagePlot, providedLists,
  autoArrange, stageState, stageBounds, nodeStageSize, GRID,
} from '../core/stageplot.js';
import { boothDocument } from '../core/booth-doc.js';

const CUR_KEY = 'cablage.courant';

export default function mount(el) {
  let plans = allPlans();
  if (!plans.length) {
    savePlan(PRESETS.club2.build());
    plans = allPlans();
  }
  let currentId = store.load(CUR_KEY, null);
  if (!plans.find((p) => p.id === currentId)) currentId = plans[0].id;

  let plan = plans.find((p) => p.id === currentId);
  let pendingPort = null;        // premier port cliqué, en attente du second
  let zoom = 0;                  // 0 = ajusté à la largeur
  let dragging = null;
  let view = store.load('cablage.vue', 'cabine');   // 'cabine' | 'cablage'
  let selected = null;             // appareil sélectionné dans le plan de cabine

  const canvas = h('div.patch-canvas');
  const headerHost = h('div');
  const sideHost = h('div');

  el.appendChild(headerHost);
  const canvasHint = h('p.tiny.muted', { text: '' });
  const zoomRow = h('div.row.tight', null,
    h('button.btn.btn-sm', { type: 'button', text: '−', title: 'Réduire', on: { click: () => setZoom(-1) } }),
    h('button.btn.btn-sm', { type: 'button', text: 'Ajuster', on: { click: () => setZoom(0) } }),
    h('button.btn.btn-sm', { type: 'button', text: '+', title: 'Agrandir', on: { click: () => setZoom(1) } })
  );

  const stageTools = h('div.row.tight', { style: { marginBottom: '.6rem' } });

  el.appendChild(h('div.card', null,
    h('div.card-head', null,
      segmented(
        [{ value: 'cabine', label: 'Plan de cabine' }, { value: 'cablage', label: 'Schéma de câblage' }],
        view,
        (v) => { view = v; store.save('cablage.vue', v); pendingPort = null; selected = null; renderCanvas(); renderSide(); }
      ),
      h('span.spacer', { style: { marginLeft: 'auto' } }),
      zoomRow
    ),
    canvasHint,
    stageTools,
    canvas
  ));
  el.appendChild(sideHost);

  renderHeader();
  renderCanvas();
  renderSide();

  /* ------------------------------ En-tête ------------------------------ */

  function persist() {
    savePlan(plan);
    plans = allPlans();
    store.save(CUR_KEY, plan.id);
  }

  function renderHeader() {
    clear(headerHost);

    const selector = h('select');
    for (const p of plans) {
      selector.appendChild(h('option', { value: p.id, text: `${p.name} (${p.nodes.length} appareils)`, selected: p.id === plan.id }));
    }
    selector.value = plan.id;
    selector.addEventListener('change', () => {
      plan = plans.find((p) => p.id === selector.value);
      pendingPort = null;
      store.save(CUR_KEY, plan.id);
      renderHeader(); renderCanvas(); renderSide();
    });

    const presetSelect = h('select');
    presetSelect.appendChild(h('option', { value: '', text: '— partir d’une configuration type —' }));
    for (const [id, preset] of Object.entries(PRESETS)) {
      presetSelect.appendChild(h('option', { value: id, text: preset.label }));
    }
    presetSelect.addEventListener('change', () => {
      const preset = PRESETS[presetSelect.value];
      presetSelect.value = '';
      if (!preset) return;
      plan = preset.build();
      persist();
      renderHeader(); renderCanvas(); renderSide();
      toastOk(`« ${preset.label} » chargé`);
    });

    // Sélecteur de matériel, groupé par catégorie.
    const gearSelect = h('select');
    for (const group of gearByCategory()) {
      const optGroup = h('optgroup', { label: group.label });
      for (const item of group.items) optGroup.appendChild(h('option', { value: item.id, text: item.label }));
      gearSelect.appendChild(optGroup);
    }

    headerHost.appendChild(h('div.card', null,
      h('div.row', { style: { marginBottom: '.7rem' } },
        h('div', { style: { flex: '1 1 240px' } }, selector),
        h('button.btn.btn-sm', {
          type: 'button', text: '＋ Nouveau plan',
          on: {
            click: async () => {
              const name = await promptDialog('Nom du plan', { title: 'Nouveau plan', value: 'Plan de câblage' });
              if (name === undefined) return;
              plan = emptyPlan(name || 'Plan de câblage');
              persist();
              renderHeader(); renderCanvas(); renderSide();
            },
          },
        }),
        h('button.btn.btn-sm', {
          type: 'button', text: 'Renommer',
          on: {
            click: async () => {
              const name = await promptDialog('Nom du plan', { title: 'Renommer', value: plan.name });
              if (!name) return;
              plan.name = name;
              persist(); renderHeader();
            },
          },
        }),
        h('button.btn.btn-sm.btn-danger', {
          type: 'button', text: 'Supprimer',
          on: {
            click: async () => {
              if (!(await confirmDialog(`Supprimer « ${plan.name} » ?`, { title: 'Supprimer le plan', okLabel: 'Supprimer', danger: true }))) return;
              deletePlan(plan.id);
              plans = allPlans();
              plan = plans[0] || emptyPlan();
              if (!plans.length) savePlan(plan);
              persist();
              renderHeader(); renderCanvas(); renderSide();
            },
          },
        })
      ),
      h('div.grid.grid-2', null,
        h('div.field', { style: { marginBottom: 0 } },
          h('label', { text: 'Configuration type' }), presetSelect),
        h('div.field', { style: { marginBottom: 0 } },
          h('label', { text: 'Ajouter un appareil' }),
          h('div.row.tight', null,
            h('div', { style: { flex: '1 1 200px' } }, gearSelect),
            h('button.btn.btn-primary.btn-sm', {
              type: 'button', text: 'Ajouter',
              on: {
                click: () => {
                  addNode(plan, gearSelect.value);
                  persist();
                  renderCanvas(); renderSide();
                  toast(`${GEAR_MAP[gearSelect.value].short || GEAR_MAP[gearSelect.value].label} ajouté`);
                },
              },
            })
          )
        )
      )
    ));
  }

  /* ------------------------------ Schéma ------------------------------ */

  function setZoom(delta) {
    zoom = delta === 0 ? 0 : Math.max(0.35, Math.min(2.5, (zoom || currentFitScale()) * (delta > 0 ? 1.25 : 0.8)));
    applyZoom();
  }

  function currentFitScale() {
    const box = planBounds(plan);
    const width = canvas.clientWidth || 800;
    return width / box.width;
  }

  function applyZoom() {
    const el2 = canvas.querySelector('svg');
    if (!el2) return;
    const box = planBounds(plan);
    if (!zoom) {
      el2.style.width = '100%';
      el2.style.height = 'auto';
    } else {
      el2.style.width = `${box.width * zoom}px`;
      el2.style.height = `${box.height * zoom}px`;
    }
  }

  function renderCanvas() {
    clear(canvas);
    canvasHint.textContent = view === 'cabine'
      ? 'Vue physique de l’installation, telle qu’elle apparaîtra sur votre rider. Les emplacements se règlent dans la liste des appareils ci-dessous.'
      : 'Touchez un port, puis le port d’arrivée, pour créer une liaison. Touchez un câble pour le modifier. Faites glisser l’en-tête d’un appareil pour le déplacer.';
    zoomRow.style.display = view === 'cabine' ? 'none' : '';

    if (!plan.nodes.length) {
      canvas.appendChild(h('div.empty', null,
        h('p', { text: 'Ce plan est vide.' }),
        h('p.tiny', { text: 'Choisissez une configuration type ci-dessus, ou ajoutez vos appareils un par un.' })
      ));
      return;
    }

    if (view === 'cabine') {
      renderStageTools();
      canvas.appendChild(renderStagePlot(plan, {
        interactive: true,
        selected,
        djLabel: djLabel(),
        onNodePointerDown: startStageDrag,
        onDjPointerDown: startDjDrag,
        onSelect: (node) => { selected = node.id; renderSide(); },
      }));
      return;
    }
    clear(stageTools);

    canvas.appendChild(renderPlan(plan, {
      interactive: true,
      pendingPort,
      onPort: handlePortClick,
      onLink: openLinkDialog,
      onNodePointerDown: startDrag,
    }));
    applyZoom();
  }

  function djLabel() {
    const profile = loadProfile();
    return profile.artistName || 'DJ';
  }

  function renderStageTools() {
    clear(stageTools);
    const stage = stageState(plan);
    const toggle = (label, on, onToggle) => h('button.btn.btn-sm', {
      type: 'button', text: label, class: on ? 'btn-primary' : '',
      on: { click: () => { onToggle(); persist(); renderCanvas(); } },
    });

    stageTools.appendChild(h('button.btn.btn-sm', {
      type: 'button', text: '⤢ Ranger automatiquement',
      title: 'Replace tout le matériel proprement',
      on: {
        click: () => {
          autoArrange(plan);
          persist();
          renderCanvas();
          toastOk('Matériel rangé');
        },
      },
    }));
    stageTools.appendChild(toggle('Silhouette du DJ', stage.showDj, () => { stage.showDj = !stage.showDj; }));
    stageTools.appendChild(toggle('Liaisons réseau', stage.showLinks, () => { stage.showLinks = !stage.showLinks; }));
    if (selected) {
      const node = plan.nodes.find((n) => n.id === selected);
      if (node) stageTools.appendChild(h('span.badge.badge-accent', { text: `Sélection : ${nodeLabel(node)}` }));
    }
  }

  /**
   * Glisser-déposer dans le plan de cabine : la position est libre, alignée
   * sur une grille de 10 unités pour garder des rangées nettes.
   */
  function startStageDrag(node, event) {
    event.preventDefault();
    const svgEl = canvas.querySelector('svg');
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const box = stageBounds(plan);
    const scale = box.width / (rect.width || 1);
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = node.sx;
    const origY = node.sy;
    let frame = 0;

    const move = (ev) => {
      node.sx = Math.round((origX + (ev.clientX - startX) * scale) / GRID) * GRID;
      node.sy = Math.round((origY + (ev.clientY - startY) * scale) / GRID) * GRID;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderCanvas(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cancelAnimationFrame(frame);
      persist();
      renderCanvas();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function startDjDrag(event) {
    event.preventDefault();
    const svgEl = canvas.querySelector('svg');
    if (!svgEl) return;
    const stage = stageState(plan);
    const rect = svgEl.getBoundingClientRect();
    const box = stageBounds(plan);
    const scale = box.width / (rect.width || 1);
    const startX = event.clientX;
    const startY = event.clientY;
    const orig = { ...stage.dj };
    let frame = 0;

    const move = (ev) => {
      stage.dj = {
        x: Math.round((orig.x + (ev.clientX - startX) * scale) / GRID) * GRID,
        y: Math.round((orig.y + (ev.clientY - startY) * scale) / GRID) * GRID,
      };
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderCanvas(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cancelAnimationFrame(frame);
      persist();
      renderCanvas();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function handlePortClick(node, port) {
    if (!pendingPort) {
      pendingPort = { node: node.id, port: port.id };
      renderCanvas();
      toast(`${nodeLabel(node)} · ${port.name} — touchez maintenant le port d’arrivée`);
      return;
    }

    if (pendingPort.node === node.id && pendingPort.port === port.id) {
      pendingPort = null;
      renderCanvas();
      return;
    }

    const result = addLink(plan, pendingPort, { node: node.id, port: port.id });
    pendingPort = null;

    if (!result.ok) {
      toastErr(result.message);
      renderCanvas();
      return;
    }
    persist();
    renderCanvas();
    renderSide();
    if (result.level === 'warn') toast(result.message, 'err', 6000);
    else if (result.level === 'adapter') toast(result.message);
    else toastOk('Liaison créée');
  }

  function startDrag(node, event) {
    event.preventDefault();
    const svgEl = canvas.querySelector('svg');
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const box = planBounds(plan);
    const scale = box.width / (rect.width || 1);
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = node.x;
    const origY = node.y;
    let frame = 0;

    dragging = node.id;

    const move = (ev) => {
      node.x = Math.round((origX + (ev.clientX - startX) * scale) / 5) * 5;
      node.y = Math.round((origY + (ev.clientY - startY) * scale) / 5) * 5;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          renderCanvas();
        });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cancelAnimationFrame(frame);
      dragging = null;
      persist();
      renderCanvas();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /* ------------------------------ Liaisons ------------------------------ */

  function openLinkDialog(link) {
    const d = describeLink(plan, link);
    modal((close) => {
      const length = h('input', { type: 'number', min: 0, max: 100, step: 0.5, value: link.length || 0 });
      return h('div', null,
        h('h2', { text: 'Liaison' }),
        h('p.small', null,
          h('strong', { text: `${d.from} · ${d.fromPort}` }),
          ' → ',
          h('strong', { text: `${d.to} · ${d.toPort}` })
        ),
        h('div.row.tight', { style: { marginBottom: '.8rem' } },
          h('span.badge.badge-accent', { text: d.cable }),
          h('span.badge', { text: `${d.count} cordon${d.count > 1 ? 's' : ''}` }),
          link.level === 'warn' ? h('span.badge.badge-warn', { text: 'à vérifier' }) : null
        ),
        h('div.field', null, h('label', { text: 'Longueur de câble (m)' }), length,
          h('div.hint', { text: 'Sert au récapitulatif des câbles à emporter.' })),
        h('div.row.end', { style: { marginTop: '1rem' } },
          h('button.btn.btn-danger', {
            type: 'button', text: 'Supprimer la liaison',
            on: {
              click: () => {
                removeLink(plan, link.id);
                persist();
                close();
                renderCanvas(); renderSide();
              },
            },
          }),
          h('button.btn.btn-primary', {
            type: 'button', text: 'Enregistrer',
            on: {
              click: () => {
                link.length = Number(length.value) || 0;
                persist();
                close();
                renderSide();
              },
            },
          })
        )
      );
    });
  }

  /* --------------------------- Panneaux latéraux --------------------------- */

  function renderSide() {
    clear(sideHost);

    /* Appareils */
    const nodesCard = h('div.card', null,
      h('div.card-head', null, h('h2', { text: `Appareils (${plan.nodes.length})` }))
    );
    if (!plan.nodes.length) {
      nodesCard.appendChild(h('div.empty', { text: 'Aucun appareil.' }));
    }
    for (const node of plan.nodes) {
      const gear = GEAR_MAP[node.gearId];

      // Emplacement dans la cabine
      const compact = { width: 'auto', minWidth: '118px', minHeight: '32px', fontSize: '.78rem', padding: '.25rem 1.6rem .25rem .5rem' };
      const slotSelect = h('select', { style: compact, title: 'Emplacement dans la cabine' });
      for (const [id, slot] of Object.entries(SLOTS)) {
        slotSelect.appendChild(h('option', { value: id, text: slot.label }));
      }
      slotSelect.value = node.slot || defaultSlot(node.gearId);
      slotSelect.addEventListener('change', () => {
        node.slot = slotSelect.value;
        persist(); renderCanvas();
      });

      // Qui fournit le matériel : alimente la liste du rider
      const byWhom = h('select', { style: compact, title: 'Qui fournit ce matériel' });
      byWhom.appendChild(h('option', { value: 'promoter', text: 'Organisateur' }));
      byWhom.appendChild(h('option', { value: 'artist', text: 'Artiste' }));
      byWhom.value = node.provided || gear?.provided || 'promoter';
      byWhom.addEventListener('change', () => {
        node.provided = byWhom.value;
        persist(); renderSide();
      });

      const move = (dir) => {
        const list = plan.nodes.filter((n) => (n.slot || defaultSlot(n.gearId)) === (node.slot || defaultSlot(node.gearId)));
        list.forEach((n, i) => { if (n.order === undefined) n.order = i; });
        const i = list.indexOf(node);
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const a = list[i].order ?? i;
        list[i].order = list[j].order ?? j;
        list[j].order = a;
        persist(); renderCanvas(); renderSide();
      };

      // Réglages d'apparence dans le plan de cabine
      const scaleAt = (factor) => {
        node.scale = Math.max(0.5, Math.min(2.2, Number(((node.scale || 1) * factor).toFixed(2))));
        persist(); renderCanvas();
      };

      const imageBtn = h('button.btn.btn-sm', {
        type: 'button',
        text: node.image ? '🖼 Changer' : '🖼 Photo',
        title: 'Utiliser une photo de l’appareil à la place du dessin',
        on: {
          click: async () => {
            const file = await pickFile('image/png,image/jpeg,image/webp,image/svg+xml');
            if (!file) return;
            if (file.size > 1200 * 1024) {
              toastErr('Image trop lourde (1,2 Mo maximum) — réduisez-la avant de l’ajouter.');
              return;
            }
            node.image = await readDataURL(file);
            persist(); renderCanvas(); renderSide();
            toastOk('Photo ajoutée au plan');
          },
        },
      });

      nodesCard.appendChild(h('div.list-item', { style: { flexWrap: 'wrap' } },
        h('span', { style: { width: '8px', height: '32px', borderRadius: '3px', background: catColor(gear), flex: 'none' } }),
        h('div.grow', null,
          h('div.ttl', { text: nodeLabel(node), title: gear ? gear.note : 'Appareil inconnu' }),
          h('div.row.tight', { style: { marginTop: '.3rem', rowGap: '.3rem' } },
            slotSelect, byWhom,
            h('button.btn.btn-sm.btn-ghost', { type: 'button', text: '◀', title: 'Reculer dans la rangée', on: { click: () => move(-1) } }),
            h('button.btn.btn-sm.btn-ghost', { type: 'button', text: '▶', title: 'Avancer dans la rangée', on: { click: () => move(1) } }),
            imageBtn,
            node.image ? h('button.btn.btn-sm.btn-ghost', {
              type: 'button', text: '✕ photo', title: 'Revenir au dessin',
              on: { click: () => { node.image = ''; persist(); renderCanvas(); renderSide(); } },
            }) : null,
            h('button.btn.btn-sm.btn-ghost', { type: 'button', text: '−', title: 'Réduire', on: { click: () => scaleAt(1 / 1.15) } }),
            h('span.tiny.muted.mono', { text: `${Math.round((node.scale || 1) * 100)}%` }),
            h('button.btn.btn-sm.btn-ghost', { type: 'button', text: '+', title: 'Agrandir', on: { click: () => scaleAt(1.15) } }),
            h('button.btn.btn-sm.btn-ghost', {
              type: 'button', text: '⇄', title: 'Retourner (miroir)',
              on: { click: () => { node.flip = !node.flip; persist(); renderCanvas(); } },
            }),
            h('button.btn.btn-sm.btn-ghost', {
              type: 'button',
              text: node.hidden ? '◻' : '◼',
              title: node.hidden ? 'Masqué dans le plan de cabine' : 'Visible dans le plan de cabine',
              on: { click: () => { node.hidden = !node.hidden; persist(); renderCanvas(); renderSide(); } },
            })
          )
        ),
        h('button.btn.btn-sm.btn-ghost', {
          type: 'button', text: 'Renommer',
          on: {
            click: async () => {
              const name = await promptDialog('Nom affiché', { title: 'Renommer l’appareil', value: nodeLabel(node) });
              if (name === undefined) return;
              node.label = name === (gear?.short || gear?.label) ? '' : name;
              persist(); renderCanvas(); renderSide();
            },
          },
        }),
        h('button.btn.btn-sm.btn-danger', {
          type: 'button', text: '✕',
          title: 'Retirer du plan',
          on: {
            click: () => {
              removeNode(plan, node.id);
              persist(); renderCanvas(); renderSide();
            },
          },
        })
      ));
    }
    sideHost.appendChild(nodesCard);

    /* Contrôles */
    const issues = validate(plan);
    const checkCard = h('div.card', null,
      h('div.card-head', null,
        h('h2', { text: 'Contrôles' }),
        h('span.spacer', { style: { marginLeft: 'auto' } }),
        h('span.badge', {
          class: issues.some((i) => i.level === 'error') ? 'badge-bad' : issues.length ? 'badge-warn' : 'badge-ok',
          text: issues.length ? `${issues.length} point${issues.length > 1 ? 's' : ''}` : 'tout est cohérent',
        })
      )
    );
    if (!issues.length) {
      checkCard.appendChild(h('p.small.muted', { text: 'Aucune anomalie détectée : chaque appareil est relié et aucune entrée ne reçoit deux sources.' }));
    }
    for (const issue of issues) {
      checkCard.appendChild(h('div.row.tight', { style: { padding: '.2rem 0' } },
        h('span.badge', {
          class: issue.level === 'error' ? 'badge-bad' : issue.level === 'warn' ? 'badge-warn' : '',
          text: issue.level === 'error' ? 'erreur' : issue.level === 'warn' ? 'attention' : 'info',
        }),
        h('span.small', { text: issue.message })
      ));
    }
    sideHost.appendChild(checkCard);

    /* Liaisons */
    const links = plan.links.map((link) => {
      const d = describeLink(plan, link);
      return h('tr', { style: { cursor: 'pointer' }, on: { click: () => openLinkDialog(link) } },
        h('td', null, h('div.small', { text: `${d.from} · ${d.fromPort}` })),
        h('td', null, h('div.small', { text: `${d.to} · ${d.toPort}` })),
        h('td', null, h('span.badge', { class: link.level === 'warn' ? 'badge-warn' : '', text: d.cable })),
        h('td.num', { text: link.length ? `${link.length} m` : '—' })
      );
    });

    sideHost.appendChild(h('div.card', null,
      h('div.card-head', null, h('h2', { text: `Liaisons (${plan.links.length})` })),
      plan.links.length
        ? h('div.table-wrap', null, h('table', null,
            h('thead', null, h('tr', null,
              h('th', { text: 'Depuis' }), h('th', { text: 'Vers' }), h('th', { text: 'Câble' }), h('th.num', { text: 'Long.' })
            )),
            h('tbody', null, ...links)
          ))
        : h('div.empty', { text: 'Aucune liaison. Touchez deux ports du schéma pour en créer une.' })
    ));

    /* Câbles à emporter */
    const cables = cableList(plan);
    sideHost.appendChild(h('div.card', null,
      h('div.card-head', null,
        h('h2', { text: 'Câbles à emporter' }),
        h('span.spacer', { style: { marginLeft: 'auto' } }),
        h('span.badge', { text: `${cables.reduce((s, c) => s + c.count, 0)} cordons` })
      ),
      cables.length
        ? h('div.table-wrap', null, h('table', null,
            h('thead', null, h('tr', null,
              h('th.num', { text: 'Qté' }), h('th', { text: 'Type' }), h('th.num', { text: 'Longueur' })
            )),
            h('tbody', null, ...cables.map((c) => h('tr', null,
              h('td.num', { text: `${c.count} ×` }),
              h('td', { text: c.label }),
              h('td.num', { text: c.length ? `${c.length} m` : '—' })
            )))
          ))
        : h('div.empty', { text: 'La liste se remplit à mesure que vous créez des liaisons.' }),
      h('p.tiny.muted', { style: { marginTop: '.6rem' }, text: 'Une liaison stéréo en XLR ou en jack compte deux cordons ; un cordon RCA double compte pour un.' })
    ));

    /* Actions */
    sideHost.appendChild(h('div.sticky-actions', null,
      h('button.btn.btn-primary', {
        type: 'button', text: 'Imprimer le plan de cabine',
        on: { click: () => printDocument(boothDocument(loadProfile(), plan), `Plan de cabine - ${plan.name}`) },
      }),
      h('button.btn.btn-sm', {
        type: 'button', text: 'Imprimer le schéma de câblage',
        on: { click: () => printPlan(plan) },
      }),
      h('button.btn.btn-sm', {
        type: 'button', text: 'Exporter (.json)',
        on: { click: () => downloadJSON(`plan-cablage-${slugify(plan.name, 'plan')}.json`, { type: 'plan-cablage', plan }) },
      }),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button', text: 'Réorganiser',
        on: {
          click: () => {
            const fresh = emptyPlan(plan.name);
            fresh.id = plan.id;
            // On replace chaque appareil dans sa colonne, en gardant les liaisons.
            const order = [...plan.nodes];
            fresh.links = plan.links;
            for (const node of order) {
              const placed = addNode(fresh, node.gearId);
              placed.id = node.id;
              placed.label = node.label;
            }
            plan = fresh;
            persist();
            renderCanvas(); renderSide();
            toastOk('Schéma réorganisé');
          },
        },
      })
    ));
  }

  return () => { dragging = null; };
}

function catColor(gear) {
  if (!gear) return 'var(--line)';
  return CATEGORIES[gear.category]?.color || 'var(--line)';
}

/* ------------------------------ Impression ------------------------------ */

export function planDocument(plan, { title = null } = {}) {
  const cables = cableList(plan);
  const issues = validate(plan);

  const links = plan.links.map((link) => {
    const d = describeLink(plan, link);
    return `<tr>
      <td>${escapeHtml(d.from)}<br><span style="color:#666">${escapeHtml(d.fromPort)}</span></td>
      <td>${escapeHtml(d.to)}<br><span style="color:#666">${escapeHtml(d.toPort)}</span></td>
      <td>${escapeHtml(d.cable)}</td>
      <td>${d.count}</td>
      <td>${link.length ? `${link.length} m` : ''}</td>
    </tr>`;
  }).join('');

  const cableRows = cables.map((c) => `<tr>
      <td>${c.count} ×</td><td>${escapeHtml(c.label)}</td><td>${c.length ? `${c.length} m` : ''}</td>
    </tr>`).join('');

  const gearRows = plan.nodes.map((n) => {
    const gear = GEAR_MAP[n.gearId];
    return `<li><b>${escapeHtml(nodeLabel(n))}</b>${gear && gear.note ? ` — ${escapeHtml(gear.note)}` : ''}</li>`;
  }).join('');

  return `
    <div class="doc-header"><div class="doc-title">
      <div class="doc-sub">Plan de câblage</div>
      <h1>${escapeHtml(title || plan.name)}</h1>
    </div></div>

    <div class="doc-section">
      <h2>Schéma</h2>
      <div style="text-align:center">${planToPrintSVG(plan)}</div>
    </div>

    <div class="doc-section">
      <h2>Matériel (${plan.nodes.length})</h2>
      <ul>${gearRows}</ul>
    </div>

    <div class="doc-section">
      <h2>Liaisons (${plan.links.length})</h2>
      <table>
        <thead><tr><th>Depuis</th><th>Vers</th><th>Câble</th><th>Cordons</th><th>Longueur</th></tr></thead>
        <tbody>${links}</tbody>
      </table>
    </div>

    <div class="doc-section">
      <h2>Câbles à prévoir</h2>
      <table>
        <thead><tr><th>Quantité</th><th>Type</th><th>Longueur</th></tr></thead>
        <tbody>${cableRows}</tbody>
      </table>
    </div>

    ${issues.length ? `<div class="doc-section"><h2>Points de vigilance</h2><ul>${
      issues.map((i) => `<li>${escapeHtml(i.message)}</li>`).join('')
    }</ul></div>` : ''}

    <div class="doc-foot">Plan de câblage généré avec DJ Pool Tech — ${new Date().toLocaleDateString('fr-FR')}</div>`;
}

function printPlan(plan) {
  printDocument(planDocument(plan), `Plan de cablage - ${plan.name}`);
}
