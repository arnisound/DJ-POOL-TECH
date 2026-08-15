/**
 * DJ Pool Tech — amorçage : routeur par hash, navigation, thème,
 * sauvegarde/restauration et enregistrement du service worker.
 */
import { h, qs, clear } from './core/dom.js';
import { svg } from './core/icons.js';
import * as store from './core/store.js';
import { modal, toastOk, toastErr, downloadJSON, pickFile, readText, confirmDialog } from './core/ui.js';
import { TOOLS, TOOL_MAP, GROUPS, QUICK_ACCESS } from './tools/index.js';

const THEME_KEY = 'ui.theme';
let disposeCurrent = null;

/* ------------------------------ Thème ------------------------------ */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f4f6fb' : '#0b0d12';
  // Les vues qui peignent elles-mêmes (roue Camelot, forme d'onde) se redessinent.
  document.dispatchEvent(new CustomEvent('djpt:theme', { detail: theme }));
}

function initTheme() {
  const saved = store.load(THEME_KEY, null);
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(saved || (prefersLight ? 'light' : 'dark'));

  qs('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    store.save(THEME_KEY, next);
  });
}

/* ------------------------------ Navigation ------------------------------ */

function buildNav() {
  const list = qs('#nav-list');
  clear(list);

  for (const group of GROUPS) {
    const tools = TOOLS.filter((t) => t.group === group.id);
    if (!tools.length) continue;
    if (group.label) {
      list.appendChild(h('li', { style: { margin: '.7rem 0 .2rem' } },
        h('span.sidebar-title', { text: group.label })));
    }
    for (const tool of tools) {
      list.appendChild(h('li', null,
        h('a.nav-link', { href: `#/${tool.id}`, dataset: { route: tool.id } },
          h('span', { html: svg(tool.icon) }).firstChild,
          h('span', { text: tool.title })
        )
      ));
    }
  }

  const tabbar = qs('#tabbar');
  clear(tabbar);
  for (const id of QUICK_ACCESS) {
    const tool = TOOL_MAP[id];
    if (!tool) continue;
    tabbar.appendChild(h('a', { href: `#/${tool.id}`, dataset: { route: tool.id } },
      h('span', { html: svg(tool.icon) }).firstChild,
      h('span', { text: tool.short || tool.title })
    ));
  }
}

function markActive(id) {
  for (const a of document.querySelectorAll('[data-route]')) {
    a.classList.toggle('active', a.dataset.route === id);
  }
}

function initSidebar() {
  const sidebar = qs('#sidebar');
  const backdrop = qs('#sidebar-backdrop');
  const btn = qs('#menu-btn');

  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    backdrop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };

  btn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  qs('#sidebar-close').addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  window.addEventListener('hashchange', () => setOpen(false));
}

/* ------------------------------ Routeur ------------------------------ */

function currentRoute() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [id] = raw.split('?');
  return id || 'accueil';
}

async function render() {
  const id = currentRoute();
  const tool = TOOL_MAP[id] || TOOL_MAP.accueil;
  const view = qs('#view');

  if (typeof disposeCurrent === 'function') {
    try { disposeCurrent(); } catch (e) { console.warn(e); }
  }
  disposeCurrent = null;

  clear(view);
  markActive(tool.id);
  document.title = tool.id === 'accueil' ? 'DJ Pool Tech — La boîte à outils du DJ' : `${tool.title} · DJ Pool Tech`;

  view.appendChild(h('div.page-head', null,
    tool.id === 'accueil' ? null : h('div.eyebrow', { text: tool.eyebrow || 'Outil' }),
    h('h1', { text: tool.heading || tool.title }),
    tool.desc ? h('p', { text: tool.desc }) : null
  ));

  const host = h('div');
  view.appendChild(host);
  window.scrollTo(0, 0);

  try {
    disposeCurrent = await tool.mount(host);
  } catch (err) {
    console.error(err);
    host.appendChild(h('div.card', null,
      h('h2', { text: 'Une erreur est survenue' }),
      h('p.muted', { text: String(err && err.message ? err.message : err) })
    ));
  }
  associateLabels(host);
  qs('#main').focus({ preventScroll: true });
}

let labelSeq = 0;

/**
 * Rattache chaque libellé orphelin à son contrôle. Les vues construisent
 * souvent `<div class="field"><label>…</label><input></div>` sans `for` :
 * on complète ici pour que le libellé soit cliquable et annoncé.
 */
function associateLabels(root) {
  for (const block of root.querySelectorAll('.field')) {
    const label = block.querySelector(':scope > label');
    if (!label || label.getAttribute('for') || label.classList.contains('check')) continue;

    const control = block.querySelector('input, select, textarea');
    // Un contrôle déjà enveloppé dans son propre <label> est étiqueté.
    if (!control || control.closest('label') === label || control.closest('label')) continue;

    if (!control.id) control.id = `champ-auto-${++labelSeq}`;
    label.setAttribute('for', control.id);
  }
}

/* -------------------- Sauvegarde / restauration -------------------- */

function initBackup() {
  qs('#backup-btn').addEventListener('click', () => {
    modal((close) => h('div', null,
      h('h2', { text: 'Sauvegarde et restauration' }),
      h('p.muted.small', { text: "Vos fiches, riders, setlists et réglages sont enregistrés uniquement dans ce navigateur. Exportez-les pour les conserver ou les transférer sur un autre appareil." }),
      h('div.stack', { style: { marginTop: '1rem' } },
        h('button.btn.btn-primary.btn-block', {
          type: 'button',
          text: 'Exporter toutes mes données (.json)',
          on: {
            click: () => {
              const stamp = new Date().toISOString().slice(0, 10);
              downloadJSON(`dj-pool-tech-sauvegarde-${stamp}.json`, store.exportAll());
              close();
            },
          },
        }),
        h('button.btn.btn-block', {
          type: 'button',
          text: 'Importer une sauvegarde',
          on: {
            click: async () => {
              const file = await pickFile('application/json,.json');
              if (!file) return;
              try {
                const n = store.importAll(JSON.parse(await readText(file)), 'merge');
                toastOk(`${n} élément(s) restauré(s)`);
                close();
                render();
              } catch (err) {
                toastErr(err.message || 'Import impossible');
              }
            },
          },
        }),
        h('button.btn.btn-danger.btn-block', {
          type: 'button',
          text: 'Effacer toutes les données',
          on: {
            click: async () => {
              if (await confirmDialog('Toutes vos fiches, riders et réglages seront définitivement supprimés de cet appareil.', { title: 'Tout effacer ?', okLabel: 'Effacer', danger: true })) {
                for (const k of store.keys()) store.remove(k);
                toastOk('Données effacées');
                close();
                render();
              }
            },
          },
        })
      ),
      h('div.row.end', { style: { marginTop: '1rem' } },
        h('button.btn.btn-ghost', { type: 'button', text: 'Fermer', on: { click: () => close() } }))
    ));
  });
}

/* ------------------------------ Service worker ------------------------------ */

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
  });
}

/* ------------------------------ Démarrage ------------------------------ */

initTheme();
buildNav();
initSidebar();
initBackup();
initServiceWorker();
window.addEventListener('hashchange', render);
render();
