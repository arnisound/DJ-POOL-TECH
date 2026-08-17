/**
 * Plan de cabine — la vue physique de l'installation, telle qu'on la trouve
 * dans les riders professionnels.
 *
 * Chaque appareil porte sa propre position (`sx`, `sy`), son échelle et son
 * orientation : on le pose où l'on veut. Un rangement automatique replace
 * tout proprement quand on veut repartir d'une base saine, à partir d'un
 * emplacement (`slot`) déduit de la catégorie du matériel.
 */
import { GEAR_MAP } from './gear.js';
import { nodeLabel } from './patch.js';
import { SHAPES, shapeOf, drawShape, drawImage, drawDj } from './stage-shapes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Taille du plateau de travail, en unités du plan. */
export const STAGE_W = 1300;
export const STAGE_H = 860;
export const GRID = 10;

/** Emplacements utilisés par le rangement automatique. */
export const SLOTS = {
  above: { label: 'Au-dessus', hint: 'Réseau, écrans, structures' },
  booth: { label: 'Sur la table', hint: 'Lecteurs, mixeur, ordinateur' },
  left:  { label: 'À gauche', hint: 'Retour, enceinte' },
  right: { label: 'À droite', hint: 'Retour, enceinte' },
  front: { label: 'Devant', hint: 'Micro, instruments, praticable' },
  out:   { label: 'Hors cabine', hint: 'Façade, régie — non dessiné' },
};

export function defaultSlot(gearId) {
  const gear = GEAR_MAP[gearId];
  if (!gear) return 'booth';
  switch (gear.category) {
    case 'player': case 'mixer': case 'controller': case 'computer': return 'booth';
    case 'fx': return gear.icon === 'keys' ? 'front' : 'booth';
    case 'mic': return 'front';
    case 'video': return 'above';
    case 'sound': return gear.id === 'booth' ? 'left' : 'out';
    case 'utility':
      if (gear.icon === 'hub') return 'above';
      if (gear.icon === 'riser') return 'front';
      return 'out';
    default: return 'booth';
  }
}

/** Réglages de scène du plan, créés au besoin. */
export function stageState(plan) {
  if (!plan.stage) plan.stage = {};
  const s = plan.stage;
  if (s.showDj === undefined) s.showDj = true;
  if (s.showLinks === undefined) s.showLinks = true;
  if (!s.dj) s.dj = null;
  return s;
}

/** Dimensions d'un appareil sur le plan, échelle comprise. */
export function nodeStageSize(node) {
  const gear = GEAR_MAP[node.gearId];
  const base = shapeOf(gear?.icon);
  const scale = node.scale || 1;
  return { width: base.w * scale, height: base.h * scale };
}

/**
 * Replace tout le matériel proprement : rangée de cabine centrée, retours
 * de part et d'autre, réseau au-dessus, micros devant.
 */
export function autoArrange(plan) {
  const stage = stageState(plan);
  const groups = { above: [], booth: [], left: [], right: [], front: [], out: [] };

  plan.nodes.forEach((node, i) => {
    const slot = node.slot || defaultSlot(node.gearId);
    (groups[slot] || groups.booth).push({ node, order: node.order ?? i });
  });
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.order - b.order);
    groups[key] = groups[key].map((e) => e.node);
  }

  const rowWidth = (list, gap) =>
    list.reduce((s, n) => s + nodeStageSize(n).width + gap, 0) - gap;

  /**
   * Place une rangée centrée. `align` vaut 'bottom' pour la table de cabine
   * — le matériel y repose sur un même plan — et 'middle' ailleurs.
   */
  const place = (list, y, { gap = 16, align = 'middle' } = {}) => {
    const width = rowWidth(list, gap);
    let x = (STAGE_W - width) / 2;
    for (const node of list) {
      const size = nodeStageSize(node);
      node.sx = Math.round(x / GRID) * GRID;
      node.sy = Math.round((align === 'bottom' ? y - size.height : y - size.height / 2) / GRID) * GRID;
      x += size.width + gap;
    }
    return width;
  };

  const boothY = 400;          // ligne du plan de travail
  place(groups.booth, boothY, { align: 'bottom' });
  place(groups.above, 120);
  place(groups.front, 660);

  const boothWidth = rowWidth(groups.booth, 16) || 400;
  const leftEdge = (STAGE_W - boothWidth) / 2;

  groups.left.forEach((node, i) => {
    const size = nodeStageSize(node);
    node.sx = Math.round((leftEdge - 70 - size.width) / GRID) * GRID;
    node.sy = Math.round((boothY - size.height + i * (size.height + 60)) / GRID) * GRID;
  });
  groups.right.forEach((node, i) => {
    const size = nodeStageSize(node);
    node.sx = Math.round((leftEdge + boothWidth + 70) / GRID) * GRID;
    node.sy = Math.round((boothY - size.height + i * (size.height + 60)) / GRID) * GRID;
  });

  // Le matériel « hors cabine » est rangé en bas, discrètement.
  groups.out.forEach((node, i) => {
    node.sx = 30 + i * 130;
    node.sy = STAGE_H - 120;
    node.hidden = node.hidden ?? true;
  });

  stage.dj = { x: STAGE_W / 2 - 70, y: boothY + 34 };
  return plan;
}

/** Complète les positions manquantes sans déranger celles déjà choisies. */
export function ensurePositions(plan) {
  const stage = stageState(plan);
  const missing = plan.nodes.filter((n) => n.sx === undefined || n.sy === undefined);
  if (!missing.length && stage.dj) return plan;
  if (missing.length === plan.nodes.length || !stage.dj) return autoArrange(plan);

  // Quelques appareils seulement : on les dépose sur une place libre.
  let x = 30;
  let y = STAGE_H - 200;
  for (const node of missing) {
    node.sx = x;
    node.sy = y;
    x += nodeStageSize(node).width + 20;
    if (x > STAGE_W - 150) { x = 30; y -= 170; }
  }
  return plan;
}

/** Appareils réellement dessinés, dans l'ordre d'empilement. */
export function visibleNodes(plan) {
  return plan.nodes.filter((n) => !n.hidden && (n.slot || defaultSlot(n.gearId)) !== 'out');
}

/* ------------------------------------------------------------------ *
 * Rendu
 * ------------------------------------------------------------------ */

const el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  return node;
};

const text = (str, attrs) => {
  const t = el('text', attrs);
  t.textContent = str;
  return t;
};

function palette(mode) {
  if (mode === 'print') {
    return {
      body: '#1c1e26', detail: '#e7eaf2', slot: '#4a505f', screen: '#3a4152',
      edge: '#111', accent: '#8fa2d8', label: '#25336f', sub: '#555',
      dj: '#1c1e26', skin: '#c9a08a', cans: '#7a828f', link: '#4a6fd8', grid: '#eef0f6',
      silhouette: '#1c1e26', silhouetteDetail: '#e7eaf2',
    };
  }
  const light = document.documentElement.dataset.theme === 'light';
  return light
    ? {
      body: '#252b3a', detail: '#e7eaf2', slot: '#59617a', screen: '#3d4557',
      edge: '#aab3c8', accent: '#8fa2ff', label: '#3538c9', sub: '#5b6580',
      dj: '#252b3a', skin: '#c9a08a', cans: '#7a828f', link: '#4a6fd8', grid: '#e6eaf5',
      silhouette: '#252b3a', silhouetteDetail: '#e7eaf2',
    }
    : {
      body: '#161b28', detail: '#dfe5f2', slot: '#39415a', screen: '#2b3347',
      edge: '#4c5570', accent: '#7f96ff', label: '#93a8ff', sub: '#8792ab',
      dj: '#0a0d14', skin: '#c9a08a', cans: '#6b7383', link: '#6f8dff', grid: '#1b2233',
      silhouette: '#dfe5f2', silhouetteDetail: '#161b28',
    };
}

/**
 * Dessine le plan de cabine.
 * @param {object} plan
 * @param {object} opts
 * @param {'screen'|'print'} [opts.mode]
 * @param {boolean} [opts.interactive]
 * @param {string|null} [opts.selected] identifiant de l'appareil sélectionné
 * @param {string} [opts.djLabel]
 * @param {(node, event)=>void} [opts.onNodePointerDown]
 * @param {(event)=>void} [opts.onDjPointerDown]
 * @param {(node)=>void} [opts.onSelect]
 */
export function renderStagePlot(plan, opts = {}) {
  const {
    mode = 'screen', interactive = false, selected = null,
    djLabel = 'DJ', onNodePointerDown, onDjPointerDown, onSelect,
  } = opts;

  ensurePositions(plan);
  const stage = stageState(plan);
  const c = palette(mode);
  const nodes = visibleNodes(plan);

  // Le cadrage suit le contenu : pas de marges vides à l'impression.
  const box = stageBounds(plan, mode === 'print' ? 26 : 16);

  const svg = el('svg', {
    viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
    class: 'stage-svg',
    role: 'img',
    'aria-label': `Plan de cabine : ${nodes.length} appareils`,
  });

  if (mode === 'screen') {
    const defs = el('defs');
    const pattern = el('pattern', { id: 'stage-grid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' });
    pattern.appendChild(el('path', { d: 'M40 0H0V40', fill: 'none', stroke: c.grid, 'stroke-width': 1 }));
    defs.appendChild(pattern);
    svg.appendChild(defs);
    svg.appendChild(el('rect', { x: box.x, y: box.y, width: box.width, height: box.height, fill: 'url(#stage-grid)' }));
  }

  /* --------------------------- Liaisons réseau --------------------------- */
  if (stage.showLinks) {
    const layer = el('g');
    for (const link of plan.links) {
      if (String(link.cable).split('>')[0] !== 'ethernet') continue;
      const a = nodes.find((n) => n.id === link.from.node);
      const b = nodes.find((n) => n.id === link.to.node);
      if (!a || !b) continue;
      const sa = nodeStageSize(a);
      const sb = nodeStageSize(b);
      const ax = a.sx + sa.width / 2;
      const bx = b.sx + sb.width / 2;
      const ay = a.sy + (a.sy < b.sy ? sa.height : 0);
      const by = b.sy + (b.sy < a.sy ? sb.height : 0);
      const mid = (ay + by) / 2;
      layer.appendChild(el('path', {
        d: `M${ax} ${ay} V${mid} H${bx} V${by}`,
        fill: 'none', stroke: c.link, 'stroke-width': 1.6, opacity: 0.8,
      }));
    }
    svg.appendChild(layer);
  }

  /* ------------------------------ Le DJ ------------------------------ */
  if (stage.showDj && stage.dj) {
    const djW = 140;
    const djH = 120;
    const g = el('g', { transform: `translate(${stage.dj.x} ${stage.dj.y})`, class: 'stage-dj' });
    drawDj(g, djW, djH, c, djLabel);
    if (interactive && onDjPointerDown) {
      const handle = el('rect', {
        x: 0, y: 0, width: djW, height: djH, fill: 'transparent',
        style: 'cursor:grab;touch-action:none',
      });
      handle.addEventListener('pointerdown', onDjPointerDown);
      g.appendChild(handle);
    }
    svg.appendChild(g);
  }

  /* ---------------------------- Les appareils ---------------------------- */
  for (const node of nodes) {
    const gear = GEAR_MAP[node.gearId];
    const { width, height } = nodeStageSize(node);
    const g = el('g', { 'data-node-id': node.id, class: 'stage-node' });

    const inner = el('g', {
      transform: node.flip
        ? `translate(${node.sx + width} ${node.sy}) scale(-1 1)`
        : `translate(${node.sx} ${node.sy})`,
    });
    if (node.image) drawImage(inner, node.image, width, height, Math.min(9, width * 0.06));
    else drawShape(inner, gear?.icon || 'box', width, height, c);
    g.appendChild(inner);

    if (selected === node.id) {
      g.appendChild(el('rect', {
        x: node.sx - 5, y: node.sy - 5, width: width + 10, height: height + 10, rx: 10,
        fill: 'none', stroke: c.accent, 'stroke-width': 2, 'stroke-dasharray': '6 4',
      }));
    }

    if (!node.hideLabel) {
      wrapLabel(nodeLabel(node).toUpperCase(), width).forEach((line, i) => {
        g.appendChild(text(line, {
          x: node.sx + width / 2, y: node.sy + height + 15 + i * 11,
          'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 700,
          fill: c.label, 'letter-spacing': '.6',
        }));
      });
    }

    if (interactive && onNodePointerDown) {
      const handle = el('rect', {
        x: node.sx, y: node.sy, width, height, fill: 'transparent',
        style: 'cursor:grab;touch-action:none',
      });
      handle.addEventListener('pointerdown', (e) => {
        if (onSelect) onSelect(node);
        onNodePointerDown(node, e);
      });
      g.appendChild(handle);
    }

    svg.appendChild(g);
  }

  return svg;
}

/** Rectangle englobant tout ce qui est dessiné. */
export function stageBounds(plan, margin = 20) {
  ensurePositions(plan);
  const stage = stageState(plan);
  const nodes = visibleNodes(plan);
  if (!nodes.length) return { x: 0, y: 0, width: 600, height: 380 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x, y, w, h) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  };

  for (const node of nodes) {
    const { width, height } = nodeStageSize(node);
    grow(node.sx, node.sy, width, height + (node.hideLabel ? 0 : 26));
  }
  if (stage.showDj && stage.dj) grow(stage.dj.x, stage.dj.y, 140, 138);

  return {
    x: minX - margin, y: minY - margin,
    width: (maxX - minX) + margin * 2,
    height: (maxY - minY) + margin * 2,
  };
}

/** Coupe une légende trop longue en deux lignes. */
function wrapLabel(label, width) {
  const maxChars = Math.max(9, Math.floor(width / 5.6));
  if (label.length <= maxChars) return [label];
  const words = label.split(/[\s/]+/);
  const lines = [''];
  for (const word of words) {
    const line = lines[lines.length - 1];
    if (!line) lines[lines.length - 1] = word;
    else if ((line + ' ' + word).length <= maxChars) lines[lines.length - 1] = `${line} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 2);
}

/** Plan de cabine sérialisé, pour un document imprimable. */
export function stagePlotToPrintSVG(plan, maxWidth = 165, opts = {}) {
  const svg = renderStagePlot(plan, { ...opts, mode: 'print' });
  const [, , w, hh] = svg.getAttribute('viewBox').split(' ').map(Number);
  svg.setAttribute('width', `${maxWidth}mm`);
  svg.setAttribute('height', `${(maxWidth * hh) / w}mm`);
  svg.setAttribute('xmlns', SVG_NS);
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Matériel réparti selon qui le fournit : les deux listes du rider.
 * @returns {{promoter: Array, artist: Array}}
 */
export function providedLists(plan) {
  const groups = { promoter: new Map(), artist: new Map() };

  for (const node of plan.nodes) {
    const gear = GEAR_MAP[node.gearId];
    if (!gear) continue;
    const by = node.provided || gear.provided || 'promoter';
    const key = node.label || gear.label;
    const map = groups[by] || groups.promoter;
    const entry = map.get(key) || {
      label: key, count: 0,
      req: gear.req || '',
      note: gear.note || '',
      category: gear.category,
    };
    entry.count++;
    map.set(key, entry);
  }

  const order = ['player', 'mixer', 'controller', 'computer', 'fx', 'mic', 'sound', 'video', 'utility'];
  const sort = (map) => [...map.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  return { promoter: sort(groups.promoter), artist: sort(groups.artist) };
}

/** Répartition par emplacement — utilisée par le rangement et les tests. */
export function layout(plan) {
  const slots = { above: [], booth: [], left: [], right: [], front: [], out: [] };
  plan.nodes.forEach((node, i) => {
    const slot = node.slot || defaultSlot(node.gearId);
    (slots[slot] || slots.booth).push({ node, order: node.order ?? i });
  });
  for (const key of Object.keys(slots)) {
    slots[key].sort((a, b) => a.order - b.order);
    slots[key] = slots[key].map((e) => e.node);
  }
  return slots;
}

export { SHAPES };
