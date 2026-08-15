/**
 * Plan de cabine — la vue physique de l'installation, telle qu'on la trouve
 * dans les riders professionnels : la rangée de matériel vue de dessus, le
 * DJ derrière, les retours de part et d'autre, le réseau au-dessus.
 *
 * C'est un autre regard sur le même plan que le schéma de câblage : les
 * appareils sont les mêmes, seule leur disposition change. Chaque appareil
 * porte un emplacement (`slot`) et un rang (`order`) déduits de sa catégorie,
 * que l'utilisateur peut corriger.
 */
import { GEAR_MAP, CATEGORIES } from './gear.js';
import { nodeLabel } from './patch.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Emplacements possibles dans la cabine. */
export const SLOTS = {
  above: { label: 'Au-dessus', hint: 'Réseau, écrans, structures' },
  booth: { label: 'Sur la table', hint: 'Lecteurs, mixeur, ordinateur' },
  left:  { label: 'À gauche', hint: 'Retour, enceinte' },
  right: { label: 'À droite', hint: 'Retour, enceinte' },
  front: { label: 'Devant', hint: 'Micro, instruments, praticable' },
  out:   { label: 'Hors cabine', hint: 'Façade, régie, matériel non représenté' },
};

/** Emplacement par défaut d'un appareil, d'après sa catégorie. */
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

/**
 * Répartit les appareils du plan par emplacement, en respectant les choix
 * explicites de l'utilisateur (`node.slot`, `node.order`).
 */
export function layout(plan) {
  const slots = { above: [], booth: [], left: [], right: [], front: [], out: [] };

  plan.nodes.forEach((node, i) => {
    const slot = node.slot || defaultSlot(node.gearId);
    (slots[slot] || slots.booth).push({ node, order: node.order ?? i });
  });

  for (const key of Object.keys(slots)) {
    slots[key].sort((a, b) => a.order - b.order);
    slots[key] = slots[key].map((entry) => entry.node);
  }

  // Un seul retour de cabine placé à gauche est en réalité une paire :
  // on le représente des deux côtés, comme sur les riders.
  if (slots.left.length && !slots.right.length) {
    const pair = slots.left.find((n) => GEAR_MAP[n.gearId]?.id === 'booth');
    if (pair) slots.right.push({ ...pair, id: pair.id + ':miroir', mirrored: true });
  }

  return slots;
}

/* ------------------------------------------------------------------ *
 * Dessin
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
      body: '#1a1c22', face: '#e9ebf2', edge: '#333', label: '#2b3a8f',
      sub: '#555', dj: '#1a1c22', skin: '#c9a08a', link: '#4a6fd8', dash: '#666',
    };
  }
  const light = document.documentElement.dataset.theme === 'light';
  return light
    ? { body: '#242938', face: '#e9ebf2', edge: '#9aa4bd', label: '#3b3ecc', sub: '#5b6580', dj: '#242938', skin: '#c9a08a', link: '#4a6fd8', dash: '#8792ab' }
    : { body: '#0f131e', face: '#2b3347', edge: '#4a5570', label: '#8fa6ff', sub: '#8792ab', dj: '#0b0d12', skin: '#c9a08a', link: '#6f8dff', dash: '#6f7b99' };
}

const UNIT = 86;      // largeur d'une « unité » de matériel
const GAP = 14;
const DEV_H = 150;

/** Pictogrammes : chaque appareil est dessiné de dessus, en silhouette. */
function drawDevice(g, gear, x, y, w, h, c) {
  const face = el('rect', { x, y, width: w, height: h, rx: 7, fill: c.body, stroke: c.edge, 'stroke-width': 1.2 });
  g.appendChild(face);

  const cx = x + w / 2;
  const inner = (dx, dy, dw, dh, extra = {}) =>
    g.appendChild(el('rect', { x: x + dx, y: y + dy, width: dw, height: dh, rx: 3, fill: c.face, opacity: 0.85, ...extra }));
  const circle = (ccx, ccy, r, opts = {}) =>
    g.appendChild(el('circle', { cx: ccx, cy: ccy, r, fill: 'none', stroke: c.face, 'stroke-width': 2, opacity: 0.8, ...opts }));

  switch (gear.icon) {
    case 'player': {
      inner(w * 0.12, 10, w * 0.76, h * 0.22);                 // écran
      circle(cx, y + h * 0.62, Math.min(w, h) * 0.26);          // plateau
      circle(cx, y + h * 0.62, Math.min(w, h) * 0.09);
      inner(w * 0.08, h * 0.42, w * 0.1, h * 0.34, { rx: 2 });  // pitch
      break;
    }
    case 'turntable': {
      circle(cx, y + h * 0.55, Math.min(w, h) * 0.33);
      circle(cx, y + h * 0.55, 4, { fill: c.face });
      inner(w * 0.72, h * 0.15, w * 0.2, h * 0.12, { rx: 2 });   // bras
      inner(w * 0.08, h * 0.72, w * 0.12, h * 0.2, { rx: 2 });   // pitch
      break;
    }
    case 'mixer': {
      // Quatre voies : trois potentiomètres d'égaliseur puis un fader vertical.
      for (let i = 0; i < 4; i++) {
        const rel = w * (0.13 + i * 0.23);
        for (let k = 0; k < 3; k++) circle(x + rel + w * 0.055, y + 18 + k * 15, 4.5);
        inner(rel + w * 0.03, h * 0.52, w * 0.05, h * 0.32, { rx: 2 });
      }
      inner(w * 0.13, h * 0.91, w * 0.74, 6, { rx: 3 });          // crossfader
      break;
    }
    case 'allinone':
    case 'controller': {
      circle(x + w * 0.2, y + h * 0.55, Math.min(w * 0.32, h * 0.3));
      circle(x + w * 0.8, y + h * 0.55, Math.min(w * 0.32, h * 0.3));
      inner(w * 0.42, 12, w * 0.16, h * 0.3);
      for (let i = 0; i < 4; i++) inner(w * (0.4 + i * 0.05), h * 0.55, w * 0.025, h * 0.3, { rx: 1 });
      break;
    }
    case 'laptop': {
      inner(w * 0.1, 8, w * 0.8, h * 0.55, { rx: 4 });
      g.appendChild(el('rect', { x: x + w * 0.05, y: y + h * 0.68, width: w * 0.9, height: h * 0.2, rx: 3, fill: c.face, opacity: 0.55 }));
      break;
    }
    case 'speaker': {
      g.appendChild(el('path', {
        d: `M${x + w * 0.2} ${y + h * 0.3} L${x + w * 0.5} ${y + h * 0.12} L${x + w * 0.5} ${y + h * 0.88} L${x + w * 0.2} ${y + h * 0.7} Z`,
        fill: c.face, opacity: 0.9,
      }));
      g.appendChild(el('path', {
        d: `M${x + w * 0.5} ${y + h * 0.12} L${x + w * 0.85} ${y + h * 0.02} L${x + w * 0.85} ${y + h * 0.98} L${x + w * 0.5} ${y + h * 0.88} Z`,
        fill: c.face, opacity: 0.55,
      }));
      break;
    }
    case 'wedge': {
      g.appendChild(el('path', {
        d: `M${x + w * 0.1} ${y + h * 0.85} L${x + w * 0.9} ${y + h * 0.85} L${x + w * 0.75} ${y + h * 0.3} L${x + w * 0.25} ${y + h * 0.3} Z`,
        fill: c.face, opacity: 0.85,
      }));
      break;
    }
    case 'sub': {
      circle(cx, y + h / 2, Math.min(w, h) * 0.3, { 'stroke-width': 3 });
      circle(cx, y + h / 2, Math.min(w, h) * 0.12, { fill: c.face });
      break;
    }
    case 'mic': {
      inner(w * 0.42, h * 0.08, w * 0.16, h * 0.34, { rx: 8 });
      inner(w * 0.47, h * 0.42, w * 0.06, h * 0.42, { rx: 2 });
      inner(w * 0.32, h * 0.84, w * 0.36, h * 0.07, { rx: 3 });
      break;
    }
    case 'hub': {
      inner(w * 0.1, h * 0.3, w * 0.8, h * 0.4, { rx: 4 });
      for (let i = 0; i < 5; i++) {
        g.appendChild(el('rect', { x: x + w * (0.16 + i * 0.15), y: y + h * 0.42, width: w * 0.08, height: h * 0.16, fill: c.body, rx: 1 }));
      }
      break;
    }
    case 'screen': {
      inner(w * 0.08, h * 0.12, w * 0.84, h * 0.6, { rx: 3 });
      inner(w * 0.42, h * 0.74, w * 0.16, h * 0.1, { rx: 1 });
      inner(w * 0.28, h * 0.86, w * 0.44, h * 0.06, { rx: 2 });
      break;
    }
    case 'keys': {
      for (let i = 0; i < 7; i++) inner(w * (0.08 + i * 0.12), h * 0.35, w * 0.1, h * 0.5, { rx: 1 });
      for (let i = 0; i < 5; i++) {
        g.appendChild(el('rect', { x: x + w * (0.16 + i * 0.12 + (i > 1 ? 0.06 : 0)), y: y + h * 0.35, width: w * 0.05, height: h * 0.3, fill: c.body }));
      }
      break;
    }
    case 'fx': {
      circle(x + w * 0.3, y + h * 0.4, Math.min(w, h) * 0.14);
      circle(x + w * 0.7, y + h * 0.4, Math.min(w, h) * 0.14);
      inner(w * 0.15, h * 0.65, w * 0.7, h * 0.18, { rx: 3 });
      break;
    }
    case 'power': {
      for (let i = 0; i < 3; i++) {
        circle(x + w * (0.25 + i * 0.25), y + h / 2, Math.min(w, h) * 0.1);
      }
      break;
    }
    case 'riser': {
      g.appendChild(el('rect', { x: x + w * 0.06, y: y + h * 0.35, width: w * 0.88, height: h * 0.42, rx: 3, fill: c.face, opacity: 0.35, stroke: c.face, 'stroke-dasharray': '5 4' }));
      break;
    }
    default: {
      inner(w * 0.15, h * 0.3, w * 0.7, h * 0.4, { rx: 4 });
    }
  }
}

/** Enceinte de retour dans son encadré pointillé, comme sur les riders. */
function drawMonitor(g, node, x, y, w, h, c, side) {
  g.appendChild(el('rect', {
    x, y, width: w, height: h, rx: 4,
    fill: 'none', stroke: c.dash, 'stroke-width': 1.4, 'stroke-dasharray': '7 5',
  }));
  const gear = GEAR_MAP[node.gearId] || { icon: 'speaker' };
  const flip = side === 'right';
  const inner = el('g', flip ? { transform: `translate(${2 * (x + w / 2)} 0) scale(-1 1)` } : {});
  drawDeviceFace(inner, gear, x + 12, y + 12, w - 24, h - 24, c);
  g.appendChild(inner);
}

/** Silhouette d'enceinte sans le boîtier sombre (les retours sont dessinés en aplat). */
function drawDeviceFace(g, gear, x, y, w, h, c) {
  g.appendChild(el('path', {
    d: `M${x + w * 0.05} ${y + h * 0.28} L${x + w * 0.45} ${y + h * 0.08} L${x + w * 0.45} ${y + h * 0.92} L${x + w * 0.05} ${y + h * 0.72} Z`,
    fill: c.body,
  }));
  g.appendChild(el('path', {
    d: `M${x + w * 0.45} ${y + h * 0.08} L${x + w * 0.95} ${y} L${x + w * 0.95} ${y + h} L${x + w * 0.45} ${y + h * 0.92} Z`,
    fill: c.body, opacity: 0.75,
  }));
  g.appendChild(el('rect', { x: x + w * 0.62, y: y + h * 0.44, width: w * 0.16, height: h * 0.12, fill: c.face, opacity: 0.6 }));
}

/**
 * Silhouette du DJ, vue de dessus, devant la cabine.
 * Elle est placée sous la ligne des légendes : sur un rider, un nom
 * d'appareil masqué par un bras est un appel téléphonique de plus.
 */
function drawDj(g, cx, y, c, label) {
  const arm = (dx) => el('path', {
    d: `M${cx + dx} ${y + 16} q${dx * 0.28} -10 ${dx * 0.46} -16`,
    stroke: c.dj, 'stroke-width': 15, fill: 'none', 'stroke-linecap': 'round',
  });
  g.appendChild(el('path', {
    d: `M${cx - 62} ${y + 78} q0 -74 62 -74 q62 0 62 74 z`,
    fill: c.dj,
  }));
  g.appendChild(arm(-46));
  g.appendChild(arm(46));
  g.appendChild(el('circle', { cx, cy: y + 40, r: 25, fill: c.skin }));
  g.appendChild(el('rect', { x: cx - 27, y: y + 34, width: 54, height: 11, rx: 5, fill: c.dj }));
  g.appendChild(el('circle', { cx: cx - 30, cy: y + 40, r: 9, fill: '#666e80' }));
  g.appendChild(el('circle', { cx: cx + 30, cy: y + 40, r: 9, fill: '#666e80' }));
  if (label) {
    g.appendChild(text(label, {
      x: cx, y: y + 96, 'text-anchor': 'middle', 'font-size': 11,
      'font-weight': 700, fill: c.sub, 'letter-spacing': '.5',
    }));
  }
}

/** Coupe une légende en deux lignes si elle dépasse la largeur de l'appareil. */
function wrapLabel(label, width) {
  const maxChars = Math.max(8, Math.floor(width / 5.6));
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

/**
 * Dessine le plan de cabine.
 * @param {object} plan
 * @param {object} opts
 * @param {'screen'|'print'} [opts.mode]
 * @param {string} [opts.djLabel]
 */
export function renderStagePlot(plan, opts = {}) {
  const { mode = 'screen', djLabel = 'DJ' } = opts;
  const c = palette(mode);
  const slots = layout(plan);

  const widthOf = (node) => (GEAR_MAP[node.gearId]?.units || 1) * UNIT;
  const rowWidth = (list) => list.reduce((s, n) => s + widthOf(n) + GAP, 0) - GAP;

  const boothW = Math.max(rowWidth(slots.booth), 300);
  const monitorW = 118;
  const monitorH = 118;
  const sideGap = 40;

  const LABEL_Y = 17;    // hauteur de la ligne de légendes sous les appareils
  const DJ_Y = 34;       // la silhouette commence sous les légendes

  const totalW = boothW + (slots.left.length ? monitorW + sideGap : 0) + (slots.right.length ? monitorW + sideGap : 0) + 80;
  const aboveH = slots.above.length ? 110 : 0;
  const frontH = slots.front.length ? 130 : 0;
  const totalH = aboveH + DEV_H + 150 + frontH + 40;

  const svg = el('svg', {
    viewBox: `0 0 ${totalW} ${totalH}`,
    class: 'stage-svg',
    role: 'img',
    'aria-label': `Plan de cabine : ${plan.nodes.length} appareils`,
  });

  const boothX = (totalW - boothW) / 2;
  const boothY = aboveH + 30;
  const linkLayer = el('g');
  svg.appendChild(linkLayer);

  /* ------------------------- Rangée au-dessus ------------------------- */
  const abovePositions = new Map();
  if (slots.above.length) {
    const w = rowWidth(slots.above);
    let x = (totalW - w) / 2;
    for (const node of slots.above) {
      const dw = widthOf(node);
      const g = el('g');
      drawDevice(g, GEAR_MAP[node.gearId] || {}, x, 14, dw, 56, c);
      g.appendChild(text(nodeLabel(node).toUpperCase(), {
        x: x + dw / 2, y: 84, 'text-anchor': 'middle', 'font-size': 9,
        'font-weight': 700, fill: c.label, 'letter-spacing': '.6',
      }));
      svg.appendChild(g);
      abovePositions.set(node.id, { x: x + dw / 2, y: 70 });
      x += dw + GAP;
    }
  }

  /* ------------------------- Rangée de cabine ------------------------- */
  let x = boothX;
  const boothPositions = new Map();
  for (const node of slots.booth) {
    const dw = widthOf(node);
    const gear = GEAR_MAP[node.gearId] || {};
    const g = el('g');
    drawDevice(g, gear, x, boothY, dw, DEV_H, c);

    // Une légende trop longue est coupée en deux lignes, comme sur un rider.
    wrapLabel(nodeLabel(node).toUpperCase(), dw).forEach((line, i) => {
      g.appendChild(text(line, {
        x: x + dw / 2, y: boothY + DEV_H + LABEL_Y + i * 11, 'text-anchor': 'middle',
        'font-size': 9, 'font-weight': 700, fill: c.label, 'letter-spacing': '.6',
      }));
    });
    svg.appendChild(g);
    boothPositions.set(node.id, { x: x + dw / 2, y: boothY, w: dw });
    x += dw + GAP;
  }

  /* --------------------------- Liaisons réseau --------------------------- */
  // Les câbles LINK sont les seuls tracés : sur un plan de cabine, c'est la
  // seule information de câblage qui intéresse l'organisateur.
  for (const link of plan.links) {
    const type = String(link.cable).split('>')[0];
    if (type !== 'ethernet') continue;
    const a = abovePositions.get(link.from.node) || boothPositions.get(link.from.node);
    const b = abovePositions.get(link.to.node) || boothPositions.get(link.to.node);
    if (!a || !b) continue;
    const ay = abovePositions.has(link.from.node) ? a.y : boothY;
    const by = abovePositions.has(link.to.node) ? b.y : boothY;
    const top = Math.min(ay, by) - 14;
    linkLayer.appendChild(el('path', {
      d: `M${a.x} ${ay} V${top} H${b.x} V${by}`,
      fill: 'none', stroke: c.link, 'stroke-width': 1.6, opacity: 0.85,
    }));
  }

  /* ------------------------------- Le DJ ------------------------------- */
  drawDj(svg, boothX + boothW / 2, boothY + DEV_H + DJ_Y, c, djLabel);

  /* ----------------------------- Les retours ----------------------------- */
  const drawSide = (list, side) => {
    if (!list.length) return;
    const sx = side === 'left' ? boothX - sideGap - monitorW : boothX + boothW + sideGap;
    let sy = boothY + 10;
    for (const node of list) {
      const g = el('g');
      drawMonitor(g, node, sx, sy, monitorW, monitorH, c, side);
      const label = nodeLabel(node);
      g.appendChild(text(label, {
        x: sx + monitorW / 2, y: sy + monitorH + 16, 'text-anchor': 'middle',
        'font-size': 10, 'font-weight': 700, fill: c.sub,
      }));
      g.appendChild(text(side === 'left' ? '(GAUCHE)' : '(DROITE)', {
        x: sx + monitorW / 2, y: sy + monitorH + 30, 'text-anchor': 'middle',
        'font-size': 9, fill: c.sub, opacity: 0.8,
      }));
      svg.appendChild(g);
      sy += monitorH + 54;
    }
  };
  drawSide(slots.left, 'left');
  drawSide(slots.right, 'right');

  /* ------------------------------ Devant ------------------------------ */
  if (slots.front.length) {
    const w = rowWidth(slots.front);
    let fx = (totalW - w) / 2;
    const fy = boothY + DEV_H + 150;
    for (const node of slots.front) {
      const dw = widthOf(node);
      const g = el('g');
      drawDevice(g, GEAR_MAP[node.gearId] || {}, fx, fy, dw, 84, c);
      g.appendChild(text(nodeLabel(node).toUpperCase(), {
        x: fx + dw / 2, y: fy + 100, 'text-anchor': 'middle', 'font-size': 9,
        'font-weight': 700, fill: c.label, 'letter-spacing': '.6',
      }));
      svg.appendChild(g);
      fx += dw + GAP;
    }
  }

  return svg;
}

/** Plan de cabine sérialisé, pour l'insertion dans un document imprimable. */
export function stagePlotToPrintSVG(plan, maxWidth = 165, opts = {}) {
  const svg = renderStagePlot(plan, { ...opts, mode: 'print' });
  const [, , w, hh] = svg.getAttribute('viewBox').split(' ').map(Number);
  svg.setAttribute('width', `${maxWidth}mm`);
  svg.setAttribute('height', `${(maxWidth * hh) / w}mm`);
  svg.setAttribute('xmlns', SVG_NS);
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Matériel réparti selon qui le fournit : c'est la liste
 * « l'organisateur doit fournir » des riders professionnels.
 * @returns {{promoter: Array<{label, count, note}>, artist: Array}}
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
      req: gear.req || '',        // exigence courte, pour la liste du rider
      note: gear.note || '',      // description longue, pour l'écran
      category: gear.category,
    };
    entry.count++;
    map.set(key, entry);
  }

  const order = Object.keys(CATEGORIES);
  const sort = (map) => [...map.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  return { promoter: sort(groups.promoter), artist: sort(groups.artist) };
}
