/**
 * Plan de câblage : modèle, configurations types, contrôles et rendu SVG.
 *
 * Le même moteur de rendu sert à l'écran (interactif) et au document
 * imprimé (statique, sur fond blanc) : le schéma du PDF est donc
 * exactement celui que l'on voit à l'écran.
 */
import { GEAR_MAP, CONNECTORS, CATEGORIES, checkConnection, cableLabel, splitPorts, findPort } from './gear.js';
import * as store from './store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const NODE_W = 200;
export const HEAD_H = 34;
export const PORT_H = 20;

/* ------------------------------------------------------------------ *
 * Modèle
 * ------------------------------------------------------------------ */

export function emptyPlan(name = 'Plan de câblage') {
  return { id: store.uid(), name, preset: '', nodes: [], links: [], notes: '', updatedAt: Date.now() };
}

export function nodeSize(gear) {
  const { inputs, outputs, services } = splitPorts(gear);
  const rows = Math.max(inputs.length, outputs.length);
  return {
    width: NODE_W,
    height: Math.max(70, HEAD_H + rows * PORT_H + 12 + (services.length ? 14 : 0)),
  };
}

/** Coordonnées d'un port dans le repère du schéma. */
export function portPosition(node, portId) {
  const gear = GEAR_MAP[node.gearId];
  if (!gear) return null;
  const { width, height } = nodeSize(gear);
  const { inputs, outputs, services } = splitPorts(gear);

  let i = inputs.findIndex((port) => port.id === portId);
  if (i >= 0) return { x: node.x, y: node.y + HEAD_H + i * PORT_H + PORT_H / 2, side: 'left' };

  i = outputs.findIndex((port) => port.id === portId);
  if (i >= 0) return { x: node.x + width, y: node.y + HEAD_H + i * PORT_H + PORT_H / 2, side: 'right' };

  i = services.findIndex((port) => port.id === portId);
  if (i >= 0) {
    const step = width / (services.length + 1);
    return { x: node.x + step * (i + 1), y: node.y + height, side: 'bottom' };
  }
  return null;
}

/** Ajoute un appareil, placé automatiquement dans une colonne libre. */
export function addNode(plan, gearId, position = null) {
  const gear = GEAR_MAP[gearId];
  if (!gear) return null;

  const column = { player: 0, controller: 0, computer: 0, mic: 0, fx: 0, mixer: 1, sound: 2, utility: 2 }[gear.category] ?? 1;
  const inColumn = plan.nodes.filter((n) => {
    const g = GEAR_MAP[n.gearId];
    if (!g) return false;
    const c = { player: 0, controller: 0, computer: 0, mic: 0, fx: 0, mixer: 1, sound: 2, utility: 2 }[g.category] ?? 1;
    return c === column;
  }).length;

  const node = {
    id: store.uid(),
    gearId,
    label: '',
    x: position ? position.x : 40 + column * 320,
    y: position ? position.y : 30 + inColumn * 150,
  };
  plan.nodes.push(node);
  return node;
}

/**
 * Paire de retours de cabine : une enceinte de chaque côté du DJ, toutes
 * deux alimentées par la sortie BOOTH du mixeur.
 */
export function addBoothPair(plan, mixerId, port = 'booth', length = 5) {
  const left = addNode(plan, 'booth');
  const right = addNode(plan, 'booth');
  left.slot = 'left';
  right.slot = 'right';
  if (mixerId) {
    addLink(plan, { node: mixerId, port }, { node: left.id, port: 'in' }, { length });
    addLink(plan, { node: mixerId, port }, { node: right.id, port: 'in' }, { length });
  }
  return [left, right];
}

export function removeNode(plan, nodeId) {
  plan.nodes = plan.nodes.filter((n) => n.id !== nodeId);
  plan.links = plan.links.filter((l) => l.from.node !== nodeId && l.to.node !== nodeId);
}

/**
 * Crée une liaison après contrôle de compatibilité.
 * @returns {{ok:boolean, link?:object, message:string, level:string}}
 */
export function addLink(plan, from, to, { length = 0 } = {}) {
  if (from.node === to.node && from.port === to.port) {
    return { ok: false, level: 'error', message: 'Un port ne se branche pas sur lui-même.' };
  }

  const fromNode = plan.nodes.find((n) => n.id === from.node);
  const toNode = plan.nodes.find((n) => n.id === to.node);
  if (!fromNode || !toNode) return { ok: false, level: 'error', message: 'Appareil introuvable.' };

  let a = findPort(fromNode.gearId, from.port);
  let b = findPort(toNode.gearId, to.port);
  if (!a || !b) return { ok: false, level: 'error', message: 'Port introuvable.' };

  // L'utilisateur peut cliquer l'entrée avant la sortie : on remet dans l'ordre.
  let src = from;
  let dst = to;
  if ((a.dir === 'in' && b.dir === 'out') || (a.dir === 'in' && b.dir === 'both')) {
    [src, dst] = [to, from];
    [a, b] = [b, a];
  }

  const check = checkConnection(a, b);
  if (!check.ok) return { ok: false, level: check.level, message: check.message };

  const exists = plan.links.some((l) =>
    l.from.node === src.node && l.from.port === src.port && l.to.node === dst.node && l.to.port === dst.port);
  if (exists) return { ok: false, level: 'warn', message: 'Cette liaison existe déjà.' };

  const link = {
    id: store.uid(),
    from: { node: src.node, port: src.port },
    to: { node: dst.node, port: dst.port },
    cable: check.cable,
    level: check.level,
    length,
  };
  plan.links.push(link);
  return { ok: true, link, level: check.level, message: check.message };
}

export function removeLink(plan, linkId) {
  plan.links = plan.links.filter((l) => l.id !== linkId);
}

/* ------------------------------------------------------------------ *
 * Liste de câbles et contrôles
 * ------------------------------------------------------------------ */

/** Nombre de cordons pour une liaison (une paire XLR stéréo, c'est deux câbles). */
export function cableCount(plan, link) {
  const fromNode = plan.nodes.find((n) => n.id === link.from.node);
  const toNode = plan.nodes.find((n) => n.id === link.to.node);
  const a = fromNode && findPort(fromNode.gearId, link.from.port);
  const b = toNode && findPort(toNode.gearId, link.to.port);
  const stereo = (a && a.pair) || (b && b.pair);
  const doubled = ['xlr', 'jack63', 'micxlr', 'speakon'];
  const type = link.cable.split('>')[0];
  return stereo && doubled.includes(type) ? 2 : 1;
}

/** Récapitulatif des câbles nécessaires, regroupés par type et longueur. */
export function cableList(plan) {
  const groups = new Map();
  for (const link of plan.links) {
    const key = `${link.cable}|${link.length || 0}`;
    const entry = groups.get(key) || { cable: link.cable, length: link.length || 0, count: 0 };
    entry.count += cableCount(plan, link);
    groups.set(key, entry);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, label: cableLabel(g.cable) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** Description lisible d'une liaison (« CDJ-3000 · AUDIO OUT → DJM-A9 · CH2 LINE »). */
export function describeLink(plan, link) {
  const from = plan.nodes.find((n) => n.id === link.from.node);
  const to = plan.nodes.find((n) => n.id === link.to.node);
  const fromPort = from && findPort(from.gearId, link.from.port);
  const toPort = to && findPort(to.gearId, link.to.port);
  return {
    from: from ? nodeLabel(from) : '?',
    fromPort: fromPort ? fromPort.name : '?',
    to: to ? nodeLabel(to) : '?',
    toPort: toPort ? toPort.name : '?',
    cable: cableLabel(link.cable),
    count: cableCount(plan, link),
    level: link.level,
  };
}

export function nodeLabel(node) {
  if (node.label) return node.label;
  const gear = GEAR_MAP[node.gearId];
  return gear ? gear.short || gear.label : 'Appareil';
}

/**
 * Contrôles de cohérence : ce qui manque ou ce qui risque de mal se passer.
 * @returns {Array<{level:'error'|'warn'|'info', message:string}>}
 */
export function validate(plan) {
  const issues = [];
  const connected = new Set();
  for (const l of plan.links) { connected.add(l.from.node); connected.add(l.to.node); }

  for (const node of plan.nodes) {
    const gear = GEAR_MAP[node.gearId];
    if (!gear) continue;
    if (!connected.has(node.id)) {
      issues.push({ level: 'warn', message: `${nodeLabel(node)} n'est relié à rien.` });
    }
    const needsPower = gear.ports.some((port) => port.type === 'power' && port.dir === 'in');
    const hasPower = plan.links.some((l) => l.to.node === node.id && findPort(node.gearId, l.to.port)?.type === 'power');
    if (needsPower && !hasPower) {
      issues.push({ level: 'info', message: `${nodeLabel(node)} demande une prise 230 V.` });
    }
  }

  const hasOutput = plan.nodes.some((n) => ['sound'].includes(GEAR_MAP[n.gearId]?.category));
  if (plan.nodes.length && !hasOutput) {
    issues.push({ level: 'warn', message: 'Aucun système de diffusion : le signal ne va nulle part.' });
  }

  for (const link of plan.links) {
    if (link.level === 'warn') {
      const d = describeLink(plan, link);
      issues.push({ level: 'warn', message: `${d.from} → ${d.to} : vérifiez le réglage de la voie (ligne / phono).` });
    }
  }

  // Un même port d'entrée alimenté deux fois : impossible sans splitter.
  const inputs = new Map();
  for (const link of plan.links) {
    const key = `${link.to.node}|${link.to.port}`;
    const type = findPort(plan.nodes.find((n) => n.id === link.to.node)?.gearId, link.to.port)?.type;
    if (type === 'power' || type === 'ethernet') continue;   // multiprise et switch acceptent plusieurs liens
    inputs.set(key, (inputs.get(key) || 0) + 1);
  }
  for (const [key, count] of inputs) {
    if (count > 1) {
      const [nodeId, portId] = key.split('|');
      const node = plan.nodes.find((n) => n.id === nodeId);
      const port = node && findPort(node.gearId, portId);
      issues.push({
        level: 'error',
        message: `${node ? nodeLabel(node) : '?'} · ${port ? port.name : portId} reçoit ${count} sources. Une entrée n'en accepte qu'une.`,
      });
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ *
 * Configurations types
 * ------------------------------------------------------------------ */

export const PRESETS = {
  club2: {
    label: 'Club — 2 CDJ + mixeur',
    description: 'La configuration la plus courante en club.',
    build: () => {
      const plan = emptyPlan('Club — 2 CDJ + mixeur');
      const cdj1 = addNode(plan, 'cdj3000', { x: 30, y: 20 });
      const cdj2 = addNode(plan, 'cdj3000', { x: 30, y: 190 });
      const mixer = addNode(plan, 'djm900', { x: 330, y: 40 });
      const foh = addNode(plan, 'foh', { x: 680, y: 40 });
      const strip = addNode(plan, 'powerstrip', { x: 330, y: 420 });
      addLink(plan, { node: cdj1.id, port: 'out' }, { node: mixer.id, port: 'ch2line' }, { length: 1 });
      addLink(plan, { node: cdj2.id, port: 'out' }, { node: mixer.id, port: 'ch3line' }, { length: 1 });
      addLink(plan, { node: cdj1.id, port: 'link' }, { node: mixer.id, port: 'link' }, { length: 1 });
      addLink(plan, { node: cdj2.id, port: 'link' }, { node: mixer.id, port: 'link' }, { length: 1 });
      addLink(plan, { node: mixer.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
      const [booth] = addBoothPair(plan, mixer.id);
      for (const [i, n] of [cdj1, cdj2, mixer, foh, booth].entries()) {
        addLink(plan, { node: strip.id, port: `o${i + 1}` }, { node: n.id, port: 'pwr' }, { length: 3 });
      }
      return plan;
    },
  },

  club4: {
    label: 'Club — 4 CDJ + mixeur',
    description: 'Quatre lecteurs en réseau : un switch devient nécessaire.',
    build: () => {
      const plan = emptyPlan('Club — 4 CDJ + mixeur');
      const players = [0, 1, 2, 3].map((i) => addNode(plan, 'cdj3000', { x: 30, y: 20 + i * 165 }));
      const mixer = addNode(plan, 'djma9', { x: 330, y: 120 });
      const sw = addNode(plan, 'switch', { x: 330, y: 560 });
      const foh = addNode(plan, 'foh', { x: 700, y: 120 });
      players.forEach((cdj, i) => {
        addLink(plan, { node: cdj.id, port: 'out' }, { node: mixer.id, port: `ch${i + 1}line` }, { length: 1 });
        addLink(plan, { node: cdj.id, port: 'link' }, { node: sw.id, port: `p${i + 1}` }, { length: 1 });
      });
      addLink(plan, { node: mixer.id, port: 'link' }, { node: sw.id, port: 'p5' }, { length: 1 });
      addLink(plan, { node: mixer.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
      const [booth] = addBoothPair(plan, mixer.id);
      return plan;
    },
  },

  controller: {
    label: 'Contrôleur + façade',
    description: 'Vous arrivez avec votre contrôleur et vous vous branchez sur la sono du lieu.',
    build: () => {
      const plan = emptyPlan('Contrôleur + façade');
      const laptop = addNode(plan, 'laptop', { x: 30, y: 20 });
      const ctrl = addNode(plan, 'ddjflx10', { x: 30, y: 200 });
      const console_ = addNode(plan, 'mixerlive', { x: 360, y: 120 });
      const foh = addNode(plan, 'foh', { x: 700, y: 140 });
      addLink(plan, { node: laptop.id, port: 'usb1' }, { node: ctrl.id, port: 'usbb1' }, { length: 2 });
      addLink(plan, { node: ctrl.id, port: 'master1' }, { node: console_.id, port: 'inline' }, { length: 10 });
      addLink(plan, { node: console_.id, port: 'main' }, { node: foh.id, port: 'in' }, { length: 15 });
      return plan;
    },
  },

  dvs: {
    label: 'Vinyle / DVS (timecode)',
    description: 'Deux platines, une interface DVS et un ordinateur.',
    build: () => {
      const plan = emptyPlan('Vinyle / DVS');
      const tt1 = addNode(plan, 'tt1210', { x: 30, y: 20 });
      const tt2 = addNode(plan, 'tt1210', { x: 30, y: 160 });
      const card = addNode(plan, 'soundcard', { x: 320, y: 30 });
      const laptop = addNode(plan, 'laptop', { x: 320, y: 260 });
      const mixer = addNode(plan, 'djm900', { x: 620, y: 30 });
      const foh = addNode(plan, 'foh', { x: 950, y: 60 });
      addLink(plan, { node: tt1.id, port: 'out' }, { node: card.id, port: 'in1' }, { length: 1 });
      addLink(plan, { node: tt2.id, port: 'out' }, { node: card.id, port: 'in2' }, { length: 1 });
      addLink(plan, { node: card.id, port: 'out1' }, { node: mixer.id, port: 'ch1line' }, { length: 1 });
      addLink(plan, { node: card.id, port: 'out2' }, { node: mixer.id, port: 'ch2line' }, { length: 1 });
      addLink(plan, { node: laptop.id, port: 'usb1' }, { node: card.id, port: 'usb' }, { length: 2 });
      addLink(plan, { node: mixer.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
      return plan;
    },
  },

  mobile: {
    label: 'Prestation mobile complète',
    description: 'Vous apportez tout : sono, micro HF, éclairage.',
    build: () => {
      const plan = emptyPlan('Prestation mobile');
      const ctrl = addNode(plan, 'ddjflx10', { x: 30, y: 20 });
      const laptop = addNode(plan, 'laptop', { x: 30, y: 220 });
      const mic = addNode(plan, 'michf', { x: 30, y: 400 });
      const foh = addNode(plan, 'foh', { x: 420, y: 30 });
      const sub = addNode(plan, 'sub', { x: 420, y: 180 });
      const strip = addNode(plan, 'powerstrip', { x: 420, y: 380 });
      const light = addNode(plan, 'lightbar', { x: 750, y: 330 });
      addLink(plan, { node: laptop.id, port: 'usb1' }, { node: ctrl.id, port: 'usbb1' }, { length: 2 });
      addLink(plan, { node: mic.id, port: 'out' }, { node: ctrl.id, port: 'mic1' }, { length: 5 });
      // Chaînage classique en sono mobile : le caisson filtre, puis renvoie les têtes.
      addLink(plan, { node: ctrl.id, port: 'master1' }, { node: sub.id, port: 'in' }, { length: 10 });
      addLink(plan, { node: sub.id, port: 'thru' }, { node: foh.id, port: 'in' }, { length: 3 });
      addLink(plan, { node: strip.id, port: 'o1' }, { node: foh.id, port: 'pwr' }, { length: 5 });
      addLink(plan, { node: strip.id, port: 'o2' }, { node: sub.id, port: 'pwr' }, { length: 5 });
      addLink(plan, { node: strip.id, port: 'o3' }, { node: ctrl.id, port: 'pwr' }, { length: 3 });
      addLink(plan, { node: strip.id, port: 'o4' }, { node: light.id, port: 'pwr' }, { length: 10 });
      addLink(plan, { node: strip.id, port: 'o5' }, { node: mic.id, port: 'pwr' }, { length: 3 });
      return plan;
    },
  },

  club3hub: {
    label: 'Club — 3 CDJ + hub Ethernet',
    description: 'La configuration demandée par la plupart des riders internationaux.',
    build: () => {
      const plan = emptyPlan('Club — 3 CDJ + hub');
      const players = [0, 1, 2].map((i) => addNode(plan, 'cdj3000', { x: 30, y: 20 + i * 200 }));
      const mixer = addNode(plan, 'djm900', { x: 340, y: 120 });
      const hub = addNode(plan, 'switch', { x: 340, y: 660 });
      const laptop = addNode(plan, 'laptop', { x: 30, y: 620 });
      const mic = addNode(plan, 'micfil', { x: 30, y: 800 });
      const foh = addNode(plan, 'foh', { x: 720, y: 120 });

      players.forEach((cdj, i) => {
        addLink(plan, { node: cdj.id, port: 'out' }, { node: mixer.id, port: `ch${i + 1}line` }, { length: 1 });
        addLink(plan, { node: cdj.id, port: 'link' }, { node: hub.id, port: `p${i + 1}` }, { length: 2 });
      });
      addLink(plan, { node: mixer.id, port: 'link' }, { node: hub.id, port: 'p4' }, { length: 2 });
      addLink(plan, { node: laptop.id, port: 'usb1' }, { node: mixer.id, port: 'usbb1' }, { length: 2 });
      addLink(plan, { node: mic.id, port: 'out' }, { node: mixer.id, port: 'mic1' }, { length: 5 });
      addLink(plan, { node: mixer.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
      const [booth] = addBoothPair(plan, mixer.id);
      return plan;
    },
  },

  allinone: {
    label: 'Tout-en-un (XDJ-XZ) + vidéo',
    description: 'Un seul appareil, plus la liaison vidéo vers la régie.',
    build: () => {
      const plan = emptyPlan('XDJ-XZ + vidéo');
      const xz = addNode(plan, 'xdjxz', { x: 40, y: 60 });
      const laptop = addNode(plan, 'laptop', { x: 40, y: 520 });
      const mic = addNode(plan, 'micfil', { x: 40, y: 700 });
      const foh = addNode(plan, 'foh', { x: 430, y: 60 });
      const fiber = addNode(plan, 'hdmifiber', { x: 430, y: 520 });
      const screen = addNode(plan, 'videoproc', { x: 760, y: 520 });

      addLink(plan, { node: xz.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
      const [booth] = addBoothPair(plan, xz.id);
      addLink(plan, { node: mic.id, port: 'out' }, { node: xz.id, port: 'mic1' }, { length: 5 });
      addLink(plan, { node: laptop.id, port: 'usb2' }, { node: xz.id, port: 'usbb' }, { length: 2 });
      addLink(plan, { node: laptop.id, port: 'hdmi' }, { node: fiber.id, port: 'in' }, { length: 2 });
      addLink(plan, { node: fiber.id, port: 'out' }, { node: screen.id, port: 'hdmiin' }, { length: 50 });
      return plan;
    },
  },

  liveband: {
    label: 'DJ + performeur live',
    description: 'Un DJ accompagné d’un saxophoniste ou d’un chanteur, avec son retour.',
    build: () => {
      const plan = emptyPlan('DJ + performeur');
      const cdj1 = addNode(plan, 'cdj3000', { x: 30, y: 20 });
      const cdj2 = addNode(plan, 'cdj3000', { x: 30, y: 190 });
      const mic = addNode(plan, 'michf', { x: 30, y: 370 });
      const mixer = addNode(plan, 'djm900', { x: 340, y: 40 });
      const foh = addNode(plan, 'foh', { x: 700, y: 40 });
      const wedge = addNode(plan, 'wedge', { x: 700, y: 320 });
      addLink(plan, { node: cdj1.id, port: 'out' }, { node: mixer.id, port: 'ch2line' }, { length: 1 });
      addLink(plan, { node: cdj2.id, port: 'out' }, { node: mixer.id, port: 'ch3line' }, { length: 1 });
      addLink(plan, { node: mic.id, port: 'out' }, { node: mixer.id, port: 'mic1' }, { length: 5 });
      addLink(plan, { node: mixer.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
      const [booth] = addBoothPair(plan, mixer.id);
      addLink(plan, { node: mixer.id, port: 'rec' }, { node: wedge.id, port: 'in' }, { length: 8 });
      return plan;
    },
  },
};

/* ------------------------------------------------------------------ *
 * Rendu SVG
 * ------------------------------------------------------------------ */

/** Rectangle englobant le schéma, marges comprises. */
export function planBounds(plan, margin = 30) {
  if (!plan.nodes.length) return { x: 0, y: 0, width: 900, height: 500 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of plan.nodes) {
    const gear = GEAR_MAP[node.gearId];
    if (!gear) continue;
    const { width, height } = nodeSize(gear);
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + width);
    maxY = Math.max(maxY, node.y + height + 18);
  }
  return {
    x: minX - margin, y: minY - margin,
    width: (maxX - minX) + margin * 2,
    height: (maxY - minY) + margin * 2,
  };
}

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

/** Palettes : à l'écran on suit le thème, à l'impression on force le noir sur blanc. */
function palette(mode) {
  if (mode === 'print') {
    return {
      bg: '#ffffff', nodeFill: '#ffffff', nodeStroke: '#333', head: '#f0f1f6',
      title: '#111', port: '#333', portLabel: '#444', grid: 'none',
    };
  }
  const light = document.documentElement.dataset.theme === 'light';
  return light
    ? { bg: 'transparent', nodeFill: '#ffffff', nodeStroke: '#c9d0e2', head: '#eef1f8', title: '#161a28', port: '#4a5570', portLabel: '#5b6580', grid: '#e3e8f4' }
    : { bg: 'transparent', nodeFill: '#161a28', nodeStroke: '#2f3852', head: '#1e2438', title: '#e8ecf7', port: '#9aa7bd', portLabel: '#8792ab', grid: '#1c2233' };
}

/**
 * Dessine le plan.
 * @param {object} plan
 * @param {object} opts
 * @param {'screen'|'print'} [opts.mode]
 * @param {boolean} [opts.interactive]
 * @param {{node:string, port:string}|null} [opts.pendingPort] port en attente de raccordement
 * @param {(node, port, event)=>void} [opts.onPort]
 * @param {(link)=>void} [opts.onLink]
 * @param {(node, event)=>void} [opts.onNodePointerDown]
 */
export function renderPlan(plan, opts = {}) {
  const { mode = 'screen', interactive = false, pendingPort = null, onPort, onLink, onNodePointerDown } = opts;
  const c = palette(mode);
  const box = planBounds(plan);

  const svg = el('svg', {
    viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
    class: 'patch-svg',
    role: 'img',
    'aria-label': `Plan de câblage : ${plan.nodes.length} appareils, ${plan.links.length} liaisons`,
  });

  // Câbles d'abord, pour passer sous les appareils.
  const linkLayer = el('g');
  svg.appendChild(linkLayer);

  for (const link of plan.links) {
    const fromNode = plan.nodes.find((n) => n.id === link.from.node);
    const toNode = plan.nodes.find((n) => n.id === link.to.node);
    if (!fromNode || !toNode) continue;
    const a = portPosition(fromNode, link.from.port);
    const b = portPosition(toNode, link.to.port);
    if (!a || !b) continue;

    const type = link.cable.split('>')[0];
    const color = CONNECTORS[type]?.color || '#888';
    const service = CONNECTORS[type]?.service;

    const path = el('path', {
      d: cablePath(a, b),
      fill: 'none',
      stroke: color,
      'stroke-width': service ? 1.6 : 2.6,
      'stroke-dasharray': service ? '5 4' : null,
      'stroke-linecap': 'round',
      opacity: service ? 0.75 : 0.95,
      class: 'patch-link',
    });
    if (link.level === 'warn') path.setAttribute('stroke-dasharray', '8 4');
    if (interactive && onLink) {
      const hit = el('path', { d: cablePath(a, b), fill: 'none', stroke: 'transparent', 'stroke-width': 16, style: 'cursor:pointer' });
      hit.addEventListener('click', () => onLink(link));
      linkLayer.appendChild(hit);
    }
    linkLayer.appendChild(path);
  }

  // Appareils
  for (const node of plan.nodes) {
    const gear = GEAR_MAP[node.gearId];
    if (!gear) continue;
    const { width, height } = nodeSize(gear);
    const { inputs, outputs, services } = splitPorts(gear);
    const catColor = CATEGORIES[gear.category]?.color || '#888';

    const g = el('g', { class: 'patch-node', 'data-node-id': node.id, transform: `translate(${node.x} ${node.y})` });

    g.appendChild(el('rect', {
      x: 0, y: 0, width, height, rx: 10,
      fill: c.nodeFill, stroke: c.nodeStroke, 'stroke-width': 1.2,
    }));
    g.appendChild(el('path', {
      d: `M0 10a10 10 0 0 1 10-10h${width - 20}a10 10 0 0 1 10 10v${HEAD_H - 10}H0z`,
      fill: mode === 'print' ? c.head : catColor, opacity: mode === 'print' ? 1 : 0.22,
    }));
    g.appendChild(el('rect', { x: 0, y: 0, width: 5, height: HEAD_H, fill: catColor, rx: 2 }));
    g.appendChild(text(nodeLabel(node), {
      x: 12, y: 22, fill: c.title, 'font-size': 13, 'font-weight': 700, class: 'patch-title',
    }));

    const drawPort = (port, x, y, anchor, labelX) => {
      const color = CONNECTORS[port.type]?.color || c.port;
      const isPending = pendingPort && pendingPort.node === node.id && pendingPort.port === port.id;

      const dot = el('circle', {
        cx: x, cy: y, r: isPending ? 6.5 : 4.5,
        fill: isPending ? color : c.nodeFill,
        stroke: color, 'stroke-width': 2,
        class: 'patch-port',
        style: interactive ? 'cursor:pointer' : null,
      });
      g.appendChild(dot);
      g.appendChild(text(port.name, {
        x: labelX, y: y + 3.5, fill: c.portLabel, 'font-size': 8.5, 'text-anchor': anchor, class: 'patch-portlabel',
      }));

      // La zone sensible passe au-dessus du point : sans cela, un clic pile
      // sur le port serait absorbé par le cercle visible et ne ferait rien.
      if (interactive && onPort) {
        const hit = el('circle', { cx: x, cy: y, r: 13, fill: 'transparent', style: 'cursor:pointer' });
        hit.addEventListener('click', (e) => { e.stopPropagation(); onPort(node, port, e); });
        hit.addEventListener('pointerdown', (e) => e.stopPropagation());
        const title = el('title');
        title.textContent = `${port.name} — ${CONNECTORS[port.type]?.label || port.type}`;
        hit.appendChild(title);
        g.appendChild(hit);
      }
    };

    inputs.forEach((port, i) => drawPort(port, 0, HEAD_H + i * PORT_H + PORT_H / 2, 'start', 10));
    outputs.forEach((port, i) => drawPort(port, width, HEAD_H + i * PORT_H + PORT_H / 2, 'end', width - 10));
    services.forEach((port, i) => {
      const step = width / (services.length + 1);
      const x = step * (i + 1);
      const color = CONNECTORS[port.type]?.color || c.port;
      const isPending = pendingPort && pendingPort.node === node.id && pendingPort.port === port.id;
      const dot = el('circle', {
        cx: x, cy: height, r: isPending ? 6 : 4,
        fill: isPending ? color : c.nodeFill, stroke: color, 'stroke-width': 1.8,
        style: interactive ? 'cursor:pointer' : null,
      });
      g.appendChild(dot);
      g.appendChild(text(CONNECTORS[port.type]?.short || port.name, {
        x, y: height + 13, fill: c.portLabel, 'font-size': 7.5, 'text-anchor': 'middle',
      }));
      if (interactive && onPort) {
        const hit = el('circle', { cx: x, cy: height, r: 12, fill: 'transparent', style: 'cursor:pointer' });
        hit.addEventListener('click', (e) => { e.stopPropagation(); onPort(node, port, e); });
        hit.addEventListener('pointerdown', (e) => e.stopPropagation());
        const title = el('title');
        title.textContent = `${port.name} — ${CONNECTORS[port.type]?.label || port.type}`;
        hit.appendChild(title);
        g.appendChild(hit);
      }
    });

    if (interactive && onNodePointerDown) {
      // `touch-action:none` uniquement sur la poignée : le reste du schéma
      // reste défilable au doigt.
      const handle = el('rect', { x: 0, y: 0, width, height: HEAD_H, fill: 'transparent', style: 'cursor:grab;touch-action:none' });
      handle.addEventListener('pointerdown', (e) => onNodePointerDown(node, e));
      g.appendChild(handle);
    }

    svg.appendChild(g);
  }

  return svg;
}

/** Courbe du câble : sortie vers la droite, entrée par la gauche. */
function cablePath(a, b) {
  if (a.side === 'bottom' || b.side === 'bottom') {
    const dy = Math.max(40, Math.abs(b.y - a.y) * 0.4);
    return `M${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y + dy}, ${b.x} ${b.y}`;
  }
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.45);
  return `M${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

/** Schéma sérialisé pour l'insertion dans un document imprimable. */
export function planToPrintSVG(plan, maxWidth = 175) {
  const svg = renderPlan(plan, { mode: 'print' });
  const box = planBounds(plan);
  svg.setAttribute('width', `${maxWidth}mm`);
  svg.setAttribute('height', `${(maxWidth * box.height) / box.width}mm`);
  svg.setAttribute('xmlns', SVG_NS);
  return new XMLSerializer().serializeToString(svg);
}

/* ------------------------------------------------------------------ *
 * Persistance
 * ------------------------------------------------------------------ */

const KEY = 'cablage.plans';

export function allPlans() {
  const list = store.load(KEY, []);
  return Array.isArray(list) && list.length ? list : [];
}

export function savePlans(list) {
  store.save(KEY, list);
  return list;
}

export function savePlan(plan) {
  const list = allPlans();
  const i = list.findIndex((p) => p.id === plan.id);
  plan.updatedAt = Date.now();
  if (i >= 0) list[i] = plan;
  else list.unshift(plan);
  savePlans(list);
  return plan;
}

export function deletePlan(id) {
  savePlans(allPlans().filter((p) => p.id !== id));
}
