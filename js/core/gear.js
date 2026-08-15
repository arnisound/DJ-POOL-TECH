/**
 * Catalogue du matériel DJ et sono, avec sa connectique réelle.
 *
 * Les entrées / sorties sont relevées sur les documentations constructeur
 * (panneaux arrière des DJM-A9, DJM-900NXS2, XDJ-XZ, Xone:96, X1850,
 * CDJ-3000…). Un rider n'a de valeur que si la connectique annoncée est
 * exacte : c'est ce qui permet au régisseur de préparer sans appeler.
 *
 * Un port : { id, name, type, dir, pair?, note? }
 *   dir  : 'in' (entrée), 'out' (sortie), 'both' (bidirectionnel)
 *   pair : liaison stéréo (deux cordons en XLR ou jack, un seul en RCA)
 * Les ports de service (USB, réseau, secteur, HDMI, MIDI) sont placés sous
 * l'appareil ; l'audio à gauche pour les entrées, à droite pour les sorties.
 */

/* ------------------------------------------------------------------ *
 * Types de connecteurs
 * ------------------------------------------------------------------ */

export const CONNECTORS = {
  rca:      { label: 'RCA (cinch)',            short: 'RCA',    color: '#e0a54a', signal: 'ligne',     service: false },
  phono:    { label: 'RCA phono + masse',      short: 'PHONO',  color: '#c2703c', signal: 'phono',     service: false },
  xlr:      { label: 'XLR symétrique',         short: 'XLR',    color: '#5b8dee', signal: 'ligne',     service: false },
  jack63:   { label: 'Jack 6,35 mm TRS',       short: 'JACK',   color: '#7c9cc4', signal: 'ligne',     service: false },
  jack63ts: { label: 'Jack 6,35 mm TS (mono)', short: 'TS',     color: '#6f8bb0', signal: 'ligne',     service: false },
  jack35:   { label: 'Mini-jack 3,5 mm',       short: '3,5',    color: '#9aa7bd', signal: 'ligne',     service: false },
  micxlr:   { label: 'XLR micro',              short: 'MIC',    color: '#e8657f', signal: 'micro',     service: false },
  combo:    { label: 'Combo XLR / jack 6,35',  short: 'COMBO',  color: '#e07f96', signal: 'micro',     service: false },
  speakon:  { label: 'Speakon NL4',            short: 'SPK',    color: '#4bb98a', signal: 'puissance', service: false },
  spdif:    { label: 'S/PDIF coaxial',         short: 'COAX',   color: '#a074e8', signal: 'numérique', service: false },
  usbA:     { label: 'USB type A',             short: 'USB-A',  color: '#8f9bb3', signal: 'données',   service: true },
  usbB:     { label: 'USB type B',             short: 'USB-B',  color: '#8f9bb3', signal: 'données',   service: true },
  usbC:     { label: 'USB type C',             short: 'USB-C',  color: '#8f9bb3', signal: 'données',   service: true },
  ethernet: { label: 'Réseau RJ45 (LINK)',     short: 'LINK',   color: '#4fc3d9', signal: 'réseau',    service: true },
  midi:     { label: 'MIDI DIN 5 broches',     short: 'MIDI',   color: '#b58ae0', signal: 'commande',  service: true },
  dmx:      { label: 'DMX (XLR 3 points)',     short: 'DMX',    color: '#d3b14b', signal: 'commande',  service: true },
  hdmi:     { label: 'HDMI',                   short: 'HDMI',   color: '#e05f8f', signal: 'vidéo',     service: true },
  control:  { label: 'CONTROL (mini-jack)',    short: 'CTRL',   color: '#9aa7bd', signal: 'commande',  service: true },
  power:    { label: 'Alimentation 230 V',     short: '230 V',  color: '#7d879e', signal: 'secteur',   service: true },
};

/** Types acceptés par une embase combo XLR / jack. */
const COMBO_ACCEPTS = ['micxlr', 'jack63', 'jack63ts', 'xlr', 'combo'];

/**
 * Compatibilité entre deux ports.
 * @returns {{ok:boolean, level:'ok'|'adapter'|'warn'|'error', message:string, cable:string}}
 */
export function checkConnection(from, to) {
  const dirOk = (from.dir === 'out' || from.dir === 'both') && (to.dir === 'in' || to.dir === 'both');
  if (!dirOk) {
    return { ok: false, level: 'error', message: 'Deux sorties (ou deux entrées) ne se branchent pas ensemble.', cable: '' };
  }

  const a = CONNECTORS[from.type];
  const b = CONNECTORS[to.type];
  if (!a || !b) return { ok: false, level: 'error', message: 'Connecteur inconnu.', cable: '' };

  if (from.type === to.type) {
    return { ok: true, level: 'ok', message: `Câble ${a.label}`, cable: from.type };
  }

  // Embase combo : elle accepte le XLR comme le jack, sans adaptateur.
  if (to.type === 'combo' && COMBO_ACCEPTS.includes(from.type)) {
    return { ok: true, level: 'ok', message: `Embase combo : câble ${a.label}`, cable: from.type };
  }
  if (from.type === 'combo' && COMBO_ACCEPTS.includes(to.type)) {
    return { ok: true, level: 'ok', message: `Câble ${b.label}`, cable: to.type };
  }

  // Jack TS et TRS partagent la même embase.
  if ((from.type === 'jack63' && to.type === 'jack63ts') || (from.type === 'jack63ts' && to.type === 'jack63')) {
    return { ok: true, level: 'ok', message: 'Câble jack 6,35 mm', cable: 'jack63' };
  }

  if (a.signal === 'ligne' && b.signal === 'phono') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Sortie ligne vers entrée phono : basculez la voie en LINE, sinon le son saturera.',
    };
  }
  if (a.signal === 'phono' && b.signal === 'ligne') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Sortie phono vers entrée ligne : son très faible et sans correction RIAA. Basculez la voie en PHONO.',
    };
  }
  if (a.signal === 'micro' && b.signal === 'ligne') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Micro vers entrée ligne : passez par une DI ou une entrée micro, le niveau sera sinon inaudible.',
    };
  }
  if (a.signal === 'ligne' && b.signal === 'micro') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Sortie ligne dans une entrée micro : engagez le PAD de la voie ou utilisez une entrée ligne, sinon ça saturera.',
    };
  }

  const lineTypes = ['rca', 'xlr', 'jack63', 'jack63ts', 'jack35'];
  if (lineTypes.includes(from.type) && lineTypes.includes(to.type)) {
    return {
      ok: true, level: 'adapter', cable: `${from.type}>${to.type}`,
      message: `Câble ${a.short} → ${b.short} (ou adaptateur).`,
    };
  }

  if (a.signal !== b.signal) {
    return { ok: false, level: 'error', message: `Un signal ${a.signal} ne se raccorde pas à une entrée ${b.signal}.`, cable: '' };
  }

  return { ok: true, level: 'adapter', cable: `${from.type}>${to.type}`, message: `Câble ${a.short} → ${b.short}.` };
}

export function cableLabel(cable) {
  if (!cable) return '—';
  if (!cable.includes('>')) return CONNECTORS[cable]?.label || cable;
  const [a, b] = cable.split('>');
  return `${CONNECTORS[a]?.short || a} → ${CONNECTORS[b]?.short || b}`;
}

/* ------------------------------------------------------------------ *
 * Catégories
 * ------------------------------------------------------------------ */

export const CATEGORIES = {
  player:     { label: 'Lecteurs & platines', color: '#7c5cff' },
  mixer:      { label: 'Mixeurs',             color: '#21d4c4' },
  controller: { label: 'Contrôleurs & tout-en-un', color: '#5b8dee' },
  computer:   { label: 'Informatique',        color: '#9aa7bd' },
  fx:         { label: 'Effets & instruments', color: '#b58ae0' },
  mic:        { label: 'Micros & DI',         color: '#e8657f' },
  sound:      { label: 'Diffusion',           color: '#4bb98a' },
  video:      { label: 'Vidéo',               color: '#e05f8f' },
  utility:    { label: 'Utilitaires & réseau', color: '#d3b14b' },
};

/* ------------------------------------------------------------------ *
 * Fabriques de ports
 * ------------------------------------------------------------------ */

const p = (id, name, type, dir, opts = {}) => ({ id, name, type, dir, ...opts });

const powerIn = () => p('pwr', '230 V', 'power', 'in');
const link = (id = 'link', name = 'LINK') => p(id, name, 'ethernet', 'both');

/** Voie de mixeur club : ligne + phono + entrée numérique coaxiale. */
const djmChannel = (n, { digital = true, phono = true } = {}) => [
  p(`ch${n}line`, `CH${n} LINE`, 'rca', 'in', { pair: true }),
  ...(phono ? [p(`ch${n}phono`, `CH${n} PHONO`, 'phono', 'in', { pair: true })] : []),
  ...(digital ? [p(`ch${n}digital`, `CH${n} DIGITAL`, 'spdif', 'in')] : []),
];

const micCombo = (n, { phantom = false } = {}) =>
  p(`mic${n}`, `MIC ${n}${phantom ? ' (+48 V)' : ''}`, 'combo', 'in', { phantom });

const phones = () => [
  p('phones1', 'CASQUE 6,35', 'jack63', 'out', { pair: true }),
  p('phones2', 'CASQUE 3,5', 'jack35', 'out', { pair: true }),
];

const sendReturn = ({ sendType = 'jack63ts', returnType = 'jack63' } = {}) => [
  p('send', 'SEND', sendType, 'out'),
  p('return', 'RETURN', returnType, 'in', { pair: true }),
];

const masterPair = () => [
  p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
  p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
];

/* ------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------ */

export const GEAR = [
  /* ============================ Lecteurs ============================ */
  {
    id: 'cdj3000', label: 'Pioneer CDJ-3000', short: 'CDJ-3000', category: 'player',
    icon: 'player', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware, reliés entre eux par un hub Ethernet',
    note: 'Lecteur multi-format, standard des clubs. Lecture directe depuis clé USB, réseau PRO DJ LINK en 1000BASE-T.',
    ports: [
      p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB (clé)', 'usbA', 'in'),
      p('usbb', 'USB (ordinateur)', 'usbB', 'both'),
      link(), powerIn(),
    ],
  },
  {
    id: 'cdj2000nxs2', label: 'Pioneer CDJ-2000NXS2', short: 'CDJ-2000NXS2', category: 'player',
    icon: 'player', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware, reliés entre eux par un hub Ethernet',
    note: 'Génération précédente, encore très répandue. Ajoute une prise CONTROL pour le pilotage des anciens modèles.',
    ports: [
      p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB (clé)', 'usbA', 'in'),
      p('usbb', 'USB (ordinateur)', 'usbB', 'both'),
      p('control', 'CONTROL', 'control', 'both'),
      link(), powerIn(),
    ],
  },
  {
    id: 'cdj900nxs', label: 'Pioneer CDJ-900NXS', short: 'CDJ-900NXS', category: 'player',
    icon: 'player', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Lecteur de club plus ancien, courant en bar et en petite salle.',
    ports: [
      p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB (clé)', 'usbA', 'in'),
      p('control', 'CONTROL', 'control', 'both'),
      link(), powerIn(),
    ],
  },
  {
    id: 'xdj1000', label: 'Pioneer XDJ-1000MK2', short: 'XDJ-1000MK2', category: 'player',
    icon: 'player', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Lecteur sans mécanique CD, plus léger : fréquent en location et en bar.',
    ports: [
      p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB (clé)', 'usbA', 'in'),
      link(), powerIn(),
    ],
  },
  {
    id: 'sc6000', label: 'Denon SC6000 Prime', short: 'SC6000', category: 'player',
    icon: 'player', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware, reliés au mixeur en réseau',
    note: 'Lecteur Engine DJ. Sortie ligne symétrique en plus du RCA, et deux ports réseau pour le chaînage.',
    ports: [
      p('out', 'LINE OUT (RCA)', 'rca', 'out', { pair: true }),
      p('outbal', 'BALANCED OUT (XLR)', 'xlr', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB (clé)', 'usbA', 'in'),
      link('link1', 'LINK 1'), link('link2', 'LINK 2'),
      powerIn(),
    ],
  },
  {
    id: 'tt1210', label: 'Technics SL-1200 / SL-1210', short: 'Platine vinyle', category: 'player',
    icon: 'turntable', units: 1, provided: 'promoter',
    req: 'cellules en bon état, bras réglé, slipmats fournies',
    note: 'Platine à entraînement direct. Sortie phono : la voie du mixeur doit être en PHONO et la masse reliée.',
    ports: [
      p('out', 'PHONO OUT', 'phono', 'out', { pair: true }),
      p('gnd', 'MASSE', 'phono', 'out'),
      powerIn(),
    ],
  },
  {
    id: 'rp8000', label: 'Reloop RP-8000 MK2', short: 'RP-8000', category: 'player',
    icon: 'turntable', units: 1, provided: 'promoter',
    req: 'cellules en bon état',
    note: 'Platine à entraînement direct avec section MIDI, appréciée en DVS.',
    ports: [
      p('out', 'PHONO OUT', 'phono', 'out', { pair: true }),
      p('gnd', 'MASSE', 'phono', 'out'),
      p('midi', 'MIDI / USB', 'usbB', 'both'),
      powerIn(),
    ],
  },

  /* ============================= Mixeurs ============================= */
  {
    id: 'djma9', label: 'Pioneer DJM-A9', short: 'DJM-A9', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware, relié au hub Ethernet',
    note: 'Mixeur 4 voies de référence. 4 entrées ligne, 4 phono, 4 numériques, 2 micros dont un avec alimentation fantôme, boucle send/return et interface USB double.',
    ports: [
      ...djmChannel(1), ...djmChannel(2), ...djmChannel(3), ...djmChannel(4),
      micCombo(1, { phantom: true }), micCombo(2),
      ...masterPair(),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('digitalout', 'DIGITAL MASTER', 'spdif', 'out'),
      ...sendReturn(),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      link(), powerIn(),
    ],
  },
  {
    id: 'djm900', label: 'Pioneer DJM-900NXS2', short: 'DJM-900NXS2', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware, relié au hub Ethernet',
    note: 'Le mixeur club le plus répandu. 4 voies ligne/phono/numérique, 2 micros, send/return indépendant, deux interfaces USB.',
    ports: [
      ...djmChannel(1), ...djmChannel(2), ...djmChannel(3), ...djmChannel(4),
      micCombo(1), p('mic2', 'MIC 2 (jack)', 'jack63', 'in'),
      ...masterPair(),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('digitalout', 'DIGITAL OUT', 'spdif', 'out'),
      ...sendReturn(),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      p('usba', 'USB-A', 'usbA', 'in'),
      link(), powerIn(),
    ],
  },
  {
    id: 'djmv10', label: 'Pioneer DJM-V10', short: 'DJM-V10', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Mixeur 6 voies, égaliseur 4 bandes et compresseur par voie. Deux sorties casque, double send/return.',
    ports: [
      ...djmChannel(1), ...djmChannel(2), ...djmChannel(3),
      ...djmChannel(4), ...djmChannel(5, { phono: false }), ...djmChannel(6, { phono: false }),
      micCombo(1, { phantom: true }), micCombo(2),
      ...masterPair(),
      p('booth', 'BOOTH', 'xlr', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('digitalout', 'DIGITAL MASTER', 'spdif', 'out'),
      ...sendReturn(),
      p('send2', 'SEND 2', 'jack63ts', 'out'),
      p('return2', 'RETURN 2', 'jack63', 'in', { pair: true }),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      link(), powerIn(),
    ],
  },
  {
    id: 'djm750', label: 'Pioneer DJM-750MK2', short: 'DJM-750MK2', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'toutes les voies vérifiées',
    note: 'Mixeur 4 voies de milieu de gamme, carte son intégrée. Pas de send/return.',
    ports: [
      ...djmChannel(1, { digital: false }), ...djmChannel(2, { digital: false }),
      ...djmChannel(3, { digital: false }), ...djmChannel(4, { digital: false }),
      micCombo(1),
      ...masterPair(),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      ...phones(),
      p('usbb', 'USB-B', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'djm450', label: 'Pioneer DJM-450', short: 'DJM-450', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'toutes les voies vérifiées',
    note: 'Mixeur 2 voies compact, carte son intégrée. Courant en bar et en prestation mobile.',
    ports: [
      ...djmChannel(1, { digital: false }), ...djmChannel(2, { digital: false }),
      micCombo(1),
      p('master1', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      ...phones(),
      p('usbb', 'USB-B', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'djms11', label: 'Pioneer DJM-S11', short: 'DJM-S11', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Mixeur 2 voies orienté scratch et battle, double interface USB pour les passations.',
    ports: [
      ...djmChannel(1, { digital: false }), ...djmChannel(2, { digital: false }),
      micCombo(1),
      p('master1', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      ...sendReturn(),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'xone96', label: 'Allen & Heath Xone:96', short: 'Xone:96', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'toutes les voies et filtres vérifiés',
    note: 'Mixeur analogique 6 voies, filtres réputés. Deux sends stéréo (le send 1 commutable en Hi-Z), quatre returns, insert master, deux cartes son indépendantes.',
    ports: [
      ...djmChannel(1, { digital: false }), ...djmChannel(2, { digital: false }),
      ...djmChannel(3, { digital: false }), ...djmChannel(4, { digital: false }),
      p('chAmic', 'VOIE A — MIC (XLR)', 'micxlr', 'in'),
      p('chAline', 'VOIE A — LINE (jack)', 'jack63', 'in', { pair: true }),
      p('chBmic', 'VOIE B — MIC (XLR)', 'micxlr', 'in'),
      p('chBline', 'VOIE B — LINE (jack)', 'jack63', 'in', { pair: true }),
      p('mix1xlr', 'MIX 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('mix1rca', 'MIX 1 (RCA)', 'rca', 'out', { pair: true }),
      p('mix2xlr', 'MIX 2 (XLR)', 'xlr', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC', 'rca', 'out', { pair: true }),
      p('send1', 'SEND 1 (Hi-Z)', 'jack63', 'out', { pair: true }),
      p('send2', 'SEND 2', 'jack63', 'out', { pair: true }),
      p('ret1', 'RETURN 1', 'jack63', 'in', { pair: true }),
      p('ret2', 'RETURN 2', 'jack63', 'in', { pair: true }),
      p('ret3', 'RETURN 3', 'jack63', 'in', { pair: true }),
      p('ret4', 'RETURN 4', 'jack63', 'in', { pair: true }),
      p('insend', 'INSERT SEND', 'jack63', 'out', { pair: true }),
      p('inret', 'INSERT RETURN', 'jack63', 'in', { pair: true }),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'xone92', label: 'Allen & Heath Xone:92', short: 'Xone:92', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'toutes les voies et filtres vérifiés',
    note: 'Le classique analogique 6 voies. Deux sends, deux returns, sorties mix XLR et RCA.',
    ports: [
      ...djmChannel(1, { digital: false }), ...djmChannel(2, { digital: false }),
      ...djmChannel(3, { digital: false }), ...djmChannel(4, { digital: false }),
      p('mic', 'MIC (XLR)', 'micxlr', 'in'),
      p('mix1xlr', 'MIX 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('mix1rca', 'MIX 1 (RCA)', 'rca', 'out', { pair: true }),
      p('mix2', 'MIX 2', 'jack63', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC', 'rca', 'out', { pair: true }),
      p('send1', 'SEND 1', 'jack63', 'out', { pair: true }),
      p('send2', 'SEND 2', 'jack63', 'out', { pair: true }),
      p('ret1', 'RETURN 1', 'jack63', 'in', { pair: true }),
      p('ret2', 'RETURN 2', 'jack63', 'in', { pair: true }),
      ...phones(),
      powerIn(),
    ],
  },
  {
    id: 'x1850', label: 'Denon X1850 Prime', short: 'X1850', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware, relié aux lecteurs en réseau',
    note: 'Mixeur 4 voies Engine DJ : 4 entrées ligne/phono commutables, entrées numériques pour les SC6000, réseau intégré, send/return et sortie MIDI.',
    ports: [
      ...djmChannel(1), ...djmChannel(2), ...djmChannel(3), ...djmChannel(4),
      micCombo(1, { phantom: true }), p('mic2', 'MIC 2 (jack)', 'jack63', 'in'),
      p('master1', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('zone', 'ZONE OUT', 'rca', 'out', { pair: true }),
      ...sendReturn(),
      ...phones(),
      p('midiout', 'MIDI OUT', 'midi', 'out'),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      link('link1', 'LINK 1'), link('link2', 'LINK 2'),
      powerIn(),
    ],
  },
  {
    id: 'seventytwo', label: 'Rane Seventy-Two MKII', short: 'Seventy-Two', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Mixeur battle 2 voies, double USB pour les passations, écran tactile.',
    ports: [
      ...djmChannel(1, { digital: false }), ...djmChannel(2, { digital: false }),
      micCombo(1),
      p('master1', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('aux', 'AUX IN', 'rca', 'in', { pair: true }),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'model1', label: 'PLAYdifferently Model 1', short: 'Model 1', category: 'mixer',
    icon: 'mixer', units: 1, provided: 'promoter',
    req: 'toutes les voies vérifiées',
    note: 'Mixeur 6 voies haut de gamme, quatre sends stéréo indépendants et deux sorties mix.',
    ports: [
      ...djmChannel(1, { digital: false, phono: false }), ...djmChannel(2, { digital: false, phono: false }),
      ...djmChannel(3, { digital: false, phono: false }), ...djmChannel(4, { digital: false, phono: false }),
      p('ch5', 'CH5 LINE', 'jack63', 'in', { pair: true }),
      p('ch6', 'CH6 LINE', 'jack63', 'in', { pair: true }),
      p('mix1', 'MIX 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('mix2', 'MIX 2 (XLR)', 'xlr', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('send1', 'SEND 1', 'jack63', 'out', { pair: true }),
      p('send2', 'SEND 2', 'jack63', 'out', { pair: true }),
      p('ret1', 'RETURN 1', 'jack63', 'in', { pair: true }),
      p('ret2', 'RETURN 2', 'jack63', 'in', { pair: true }),
      ...phones(),
      powerIn(),
    ],
  },
  {
    id: 'mixerlive', label: 'Console de façade (analogique)', short: 'Console façade', category: 'mixer',
    icon: 'mixer', units: 2, provided: 'promoter',
    req: 'deux voies libres commutées en ligne pour la cabine',
    note: 'Console du lieu ou de la sono mobile. Prévoir deux voies libres commutées en ligne pour la cabine DJ.',
    ports: [
      p('in1', 'VOIE 1 (combo)', 'combo', 'in'),
      p('in2', 'VOIE 2 (combo)', 'combo', 'in'),
      p('in3', 'VOIE 3 (combo)', 'combo', 'in'),
      p('in4', 'VOIE 4 (combo)', 'combo', 'in'),
      p('inline', 'VOIES LIGNE (L/R)', 'xlr', 'in', { pair: true }),
      p('stereoin', 'ENTRÉE STÉRÉO (jack)', 'jack63', 'in', { pair: true }),
      p('main', 'SORTIE GÉNÉRALE', 'xlr', 'out', { pair: true }),
      p('aux1', 'AUX 1 (retour scène)', 'xlr', 'out'),
      p('aux2', 'AUX 2 (retour scène)', 'xlr', 'out'),
      p('fxsend', 'FX SEND', 'jack63', 'out'),
      p('fxret', 'FX RETURN', 'jack63', 'in', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      powerIn(),
    ],
  },

  /* ====================== Contrôleurs & tout-en-un ====================== */
  {
    id: 'xdjxz', label: 'Pioneer XDJ-XZ', short: 'XDJ-XZ', category: 'controller',
    icon: 'allinone', units: 3, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Système tout-en-un 4 voies : 2 entrées ligne, 2 phono, 1 auxiliaire, 2 micros, un send, trois ports LINK et deux ports USB de façade.',
    ports: [
      p('ch3line', 'LINE 3', 'rca', 'in', { pair: true }),
      p('ch3phono', 'PHONO 3', 'phono', 'in', { pair: true }),
      p('ch4line', 'LINE 4', 'rca', 'in', { pair: true }),
      p('ch4phono', 'PHONO 4', 'phono', 'in', { pair: true }),
      p('aux', 'AUX IN', 'rca', 'in', { pair: true }),
      micCombo(1), micCombo(2),
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('send', 'SEND', 'jack63ts', 'out'),
      ...phones(),
      p('usb1', 'USB-A 1 (clé)', 'usbA', 'in'),
      p('usb2', 'USB-A 2 (clé)', 'usbA', 'in'),
      p('usbb', 'USB-B (ordinateur)', 'usbB', 'both'),
      link('link1', 'LINK 1'), link('link2', 'LINK 2'), link('link3', 'LINK 3'),
      powerIn(),
    ],
  },
  {
    id: 'opusquad', label: 'Pioneer OPUS-QUAD', short: 'OPUS-QUAD', category: 'controller',
    icon: 'allinone', units: 3, provided: 'promoter',
    req: 'à jour du dernier firmware',
    note: 'Tout-en-un 4 voies haut de gamme, sorties master XLR et RCA, deux micros, send/return.',
    ports: [
      p('ch3line', 'LINE 3', 'rca', 'in', { pair: true }),
      p('ch4line', 'LINE 4', 'rca', 'in', { pair: true }),
      micCombo(1), micCombo(2),
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      ...sendReturn(),
      ...phones(),
      p('usb1', 'USB-A (clé)', 'usbA', 'in'),
      p('usbb', 'USB-B (ordinateur)', 'usbB', 'both'),
      link(), powerIn(),
    ],
  },
  {
    id: 'ddjflx10', label: 'Pioneer DDJ-FLX10', short: 'DDJ-FLX10', category: 'controller',
    icon: 'controller', units: 3, provided: 'artist',
    note: 'Contrôleur 4 voies avec carte son intégrée. Se branche en ligne sur la façade.',
    ports: [
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      micCombo(1), p('mic2', 'MIC 2 (jack)', 'jack63', 'in'),
      p('aux', 'AUX IN', 'jack35', 'in', { pair: true }),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'ddjrev7', label: 'Pioneer DDJ-REV7', short: 'DDJ-REV7', category: 'controller',
    icon: 'controller', units: 3, provided: 'artist',
    note: 'Contrôleur Serato à platines motorisées, orienté scratch.',
    ports: [
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      micCombo(1),
      p('line1', 'LINE / PHONO 1', 'phono', 'in', { pair: true }),
      p('line2', 'LINE / PHONO 2', 'phono', 'in', { pair: true }),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'raneone', label: 'Rane One', short: 'Rane One', category: 'controller',
    icon: 'controller', units: 3, provided: 'artist',
    note: 'Contrôleur à platines motorisées, carte son intégrée, entrées phono commutables.',
    ports: [
      p('master1', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      micCombo(1),
      p('aux', 'AUX IN', 'rca', 'in', { pair: true }),
      ...phones(),
      p('usbb1', 'USB-B 1', 'usbB', 'both'),
      p('usbb2', 'USB-B 2', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'kontrols4', label: 'Traktor Kontrol S4 MK3', short: 'Kontrol S4', category: 'controller',
    icon: 'controller', units: 2, provided: 'artist',
    note: 'Contrôleur Traktor 4 voies, carte son intégrée.',
    ports: [
      p('master1', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      micCombo(1),
      p('aux', 'AUX IN', 'rca', 'in', { pair: true }),
      ...phones(),
      p('usbc', 'USB-C (ordinateur)', 'usbC', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'ddjflx4', label: 'Pioneer DDJ-FLX4', short: 'DDJ-FLX4', category: 'controller',
    icon: 'controller', units: 2, provided: 'artist',
    note: 'Contrôleur 2 voies compact, alimenté par le bus USB. Sortie master en RCA uniquement.',
    ports: [
      p('master', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      micCombo(1),
      p('phones', 'CASQUE', 'jack35', 'out', { pair: true }),
      p('usbc', 'USB-C (ordinateur)', 'usbC', 'both'),
    ],
  },

  /* =========================== Informatique =========================== */
  {
    id: 'laptop', label: 'Ordinateur portable', short: 'Ordinateur', category: 'computer',
    icon: 'laptop', units: 2, provided: 'artist',
    note: 'Rekordbox, Serato, Traktor ou Engine DJ. Prévoir son alimentation et un support stable.',
    ports: [
      p('usb1', 'USB-A', 'usbA', 'both'),
      p('usb2', 'USB-C', 'usbC', 'both'),
      p('hdmi', 'HDMI', 'hdmi', 'out'),
      p('jack', 'SORTIE CASQUE', 'jack35', 'out', { pair: true }),
      p('lan', 'RÉSEAU', 'ethernet', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'soundcard', label: 'Interface DVS (Rane SL, Denon DS1…)', short: 'Interface DVS', category: 'computer',
    icon: 'box', units: 1, provided: 'artist',
    note: 'Interface timecode : les platines y entrent en phono, elle ressort en ligne vers le mixeur.',
    ports: [
      p('in1', 'ENTRÉE 1 (phono)', 'phono', 'in', { pair: true }),
      p('in2', 'ENTRÉE 2 (phono)', 'phono', 'in', { pair: true }),
      p('out1', 'SORTIE 1', 'rca', 'out', { pair: true }),
      p('out2', 'SORTIE 2', 'rca', 'out', { pair: true }),
      p('usb', 'USB (ordinateur)', 'usbB', 'both'),
    ],
  },
  {
    id: 'audiointerface', label: 'Carte son studio (2 entrées / 2 sorties)', short: 'Carte son', category: 'computer',
    icon: 'box', units: 1, provided: 'artist',
    note: 'Pour un live ou un enregistrement : entrées combo avec alimentation fantôme, sorties symétriques.',
    ports: [
      p('in1', 'ENTRÉE 1 (combo)', 'combo', 'in', { phantom: true }),
      p('in2', 'ENTRÉE 2 (combo)', 'combo', 'in', { phantom: true }),
      p('out1', 'SORTIE G', 'jack63', 'out'),
      p('out2', 'SORTIE D', 'jack63', 'out'),
      p('phones', 'CASQUE', 'jack63', 'out', { pair: true }),
      p('usb', 'USB (ordinateur)', 'usbC', 'both'),
    ],
  },

  /* ======================= Effets & instruments ======================= */
  {
    id: 'rmx1000', label: 'Pioneer RMX-1000', short: 'RMX-1000', category: 'fx',
    icon: 'fx', units: 1, provided: 'artist',
    note: 'Processeur d’effets. Se place dans la boucle SEND / RETURN du mixeur.',
    ports: [
      p('in', 'ENTRÉE', 'jack63', 'in', { pair: true }),
      p('out', 'SORTIE', 'jack63', 'out', { pair: true }),
      p('usb', 'USB', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'rmx500', label: 'Pioneer RMX-500', short: 'RMX-500', category: 'fx',
    icon: 'fx', units: 1, provided: 'artist',
    note: 'Processeur d’effets compact, également utilisable en insert.',
    ports: [
      p('in', 'ENTRÉE', 'rca', 'in', { pair: true }),
      p('out', 'SORTIE', 'rca', 'out', { pair: true }),
      p('usb', 'USB', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'groovebox', label: 'Groovebox (MPC, Digitakt, SP-404…)', short: 'Groovebox', category: 'fx',
    icon: 'fx', units: 1, provided: 'artist',
    note: 'Instrument joué en parallèle du mix, sur une voie ligne libre.',
    ports: [
      p('outl', 'SORTIE G', 'jack63', 'out'),
      p('outr', 'SORTIE D', 'jack63', 'out'),
      p('midiin', 'MIDI IN', 'midi', 'in'),
      p('midiout', 'MIDI OUT', 'midi', 'out'),
      p('usb', 'USB', 'usbB', 'both'),
      powerIn(),
    ],
  },
  {
    id: 'synth', label: 'Synthétiseur / clavier', short: 'Synthé', category: 'fx',
    icon: 'keys', units: 2, provided: 'artist',
    note: 'Sortie asymétrique : passer par une DI si le câble dépasse 5 mètres.',
    ports: [
      p('outl', 'SORTIE G', 'jack63', 'out'),
      p('outr', 'SORTIE D', 'jack63', 'out'),
      p('midiin', 'MIDI IN', 'midi', 'in'),
      powerIn(),
    ],
  },
  {
    id: 'keytar', label: 'Keytar / clavier d’épaule', short: 'Keytar', category: 'fx',
    icon: 'keys', units: 1, provided: 'artist',
    note: 'Joué debout face au public : prévoir un espace dégagé et un éclairage sur l’artiste.',
    ports: [
      p('out', 'SORTIE', 'jack63', 'out'),
      p('midiout', 'MIDI OUT', 'midi', 'out'),
      powerIn(),
    ],
  },

  /* ============================ Micros & DI ============================ */
  {
    id: 'micfil', label: 'Micro filaire (Shure SM58 / Beta 58)', short: 'Micro filaire', category: 'mic',
    icon: 'mic', units: 1, provided: 'promoter',
    req: 'sur pied, avec câble XLR',
    note: 'Micro dynamique, sans alimentation fantôme. Prévoir un pied et un câble XLR.',
    ports: [p('out', 'SORTIE XLR', 'micxlr', 'out')],
  },
  {
    id: 'michf', label: 'Micro HF main (émetteur + récepteur)', short: 'Micro HF', category: 'mic',
    icon: 'mic', units: 1, provided: 'promoter',
    req: 'piles neuves et fréquence libre validée avant les balances',
    note: 'Piles neuves et fréquence libre à valider avant les balances. Le récepteur demande une prise secteur.',
    ports: [p('out', 'SORTIE RÉCEPTEUR', 'micxlr', 'out'), powerIn()],
  },
  {
    id: 'michs', label: 'Micro HF serre-tête', short: 'Serre-tête HF', category: 'mic',
    icon: 'mic', units: 1, provided: 'promoter',
    req: 'piles neuves et fréquence libre validée',
    note: 'Pour un artiste qui a les mains prises. Prévoir une bonnette de rechange.',
    ports: [p('out', 'SORTIE RÉCEPTEUR', 'micxlr', 'out'), powerIn()],
  },
  {
    id: 'micinstr', label: 'Micro instrument (SM57, e604, clip)', short: 'Micro instrument', category: 'mic',
    icon: 'mic', units: 1, provided: 'promoter',
    req: "adapté à l'instrument",
    note: 'Alimentation fantôme nécessaire si le micro est statique.',
    ports: [p('out', 'SORTIE XLR', 'micxlr', 'out')],
  },
  {
    id: 'dibox', label: 'Boîte de direct (DI) active', short: 'DI', category: 'mic',
    icon: 'box', units: 1, provided: 'promoter',
    req: 'active, alimentée en fantôme',
    note: 'Symétrise un signal instrument et l’amène jusqu’à la console sans perte. Alimentée en fantôme.',
    ports: [
      p('in', 'ENTRÉE INSTRUMENT', 'jack63', 'in'),
      p('thru', 'THRU', 'jack63', 'out'),
      p('out', 'SORTIE XLR', 'micxlr', 'out'),
    ],
  },
  {
    id: 'distereo', label: 'Boîte de direct stéréo', short: 'DI stéréo', category: 'mic',
    icon: 'box', units: 1, provided: 'promoter',
    req: 'active',
    note: 'Pour un clavier, un ordinateur ou un contrôleur à sortie asymétrique.',
    ports: [
      p('inl', 'ENTRÉE G', 'jack63', 'in'),
      p('inr', 'ENTRÉE D', 'jack63', 'in'),
      p('outl', 'SORTIE G (XLR)', 'micxlr', 'out'),
      p('outr', 'SORTIE D (XLR)', 'micxlr', 'out'),
    ],
  },

  /* ============================= Diffusion ============================= */
  {
    id: 'foh', label: 'Système de façade (FOH)', short: 'Façade', category: 'sound',
    icon: 'speaker', units: 1, provided: 'promoter',
    req: "adapté à la jauge, calé et vérifié avant l'arrivée de l'artiste",
    note: 'Diffusion principale, calée et vérifiée par le régisseur avant l’arrivée de l’artiste.',
    ports: [p('in', 'ENTRÉE L/R', 'xlr', 'in', { pair: true }), powerIn()],
  },
  {
    id: 'sub', label: 'Caisson de basses', short: 'Sub', category: 'sound',
    icon: 'sub', units: 1, provided: 'promoter',
    req: 'en phase avec la façade',
    note: 'À placer en phase avec la façade. Souvent chaîné entre la console et les têtes.',
    ports: [
      p('in', 'ENTRÉE', 'xlr', 'in', { pair: true }),
      p('thru', 'LIEN VERS TÊTES', 'xlr', 'out', { pair: true }),
      powerIn(),
    ],
  },
  {
    id: 'booth', label: 'Retours de cabine (avec sub)', short: 'Retours cabine', category: 'sound',
    icon: 'speaker', units: 1, provided: 'promoter',
    req: "de forte puissance, dirigés vers le DJ à hauteur d'oreille",
    note: 'Deux enceintes de forte puissance dirigées vers le DJ, à hauteur d’oreille, niveau indépendant de la façade.',
    ports: [p('in', 'ENTRÉE', 'xlr', 'in', { pair: true }), powerIn()],
  },
  {
    id: 'wedge', label: 'Retour de scène (wedge)', short: 'Retour scène', category: 'sound',
    icon: 'wedge', units: 1, provided: 'promoter',
    req: 'sur circuit de retour indépendant',
    note: 'Retour dédié à un performeur : saxophoniste, chanteur, percussionniste.',
    ports: [p('in', 'ENTRÉE', 'xlr', 'in'), powerIn()],
  },
  {
    id: 'amp', label: 'Amplificateur / processeur', short: 'Ampli', category: 'sound',
    icon: 'box', units: 1, provided: 'promoter',
    req: 'calé par le régisseur',
    note: 'Sur une sono passive : filtrage et amplification entre la console et les enceintes.',
    ports: [
      p('in', 'ENTRÉE L/R', 'xlr', 'in', { pair: true }),
      p('outl', 'HP GAUCHE', 'speakon', 'out'),
      p('outr', 'HP DROITE', 'speakon', 'out'),
      powerIn(),
    ],
  },
  {
    id: 'speakerpassive', label: 'Enceinte passive', short: 'Enceinte passive', category: 'sound',
    icon: 'speaker', units: 1, provided: 'promoter',
    note: 'Reliée à l’amplificateur en Speakon.',
    ports: [p('in', 'ENTRÉE HP', 'speakon', 'in')],
  },

  /* =============================== Vidéo =============================== */
  {
    id: 'videoproc', label: 'Processeur / écran LED', short: 'Écran', category: 'video',
    icon: 'screen', units: 1, provided: 'promoter',
    req: 'liaison HDMI 4K depuis la régie',
    note: 'Reçoit les visuels de l’artiste. Sur les grandes scènes, la liaison se fait en HDMI sur fibre optique.',
    ports: [p('hdmiin', 'HDMI IN', 'hdmi', 'in'), powerIn()],
  },
  {
    id: 'hdmifiber', label: 'Liaison HDMI 4K sur fibre', short: 'HDMI fibre', category: 'video',
    icon: 'box', units: 1, provided: 'promoter',
    req: 'HDMI 4K sur fibre, de la cabine à la régie',
    note: 'Liaison longue distance entre la cabine et la régie vidéo, sans perte ni parasite.',
    ports: [p('in', 'ENTRÉE HDMI', 'hdmi', 'in'), p('out', 'SORTIE HDMI', 'hdmi', 'out')],
  },
  {
    id: 'vjlaptop', label: 'Ordinateur VJ', short: 'Ordinateur VJ', category: 'video',
    icon: 'laptop', units: 2, provided: 'artist',
    note: 'Sortie vidéo vers la régie, et un retour audio de la cabine pour la synchronisation.',
    ports: [
      p('hdmi', 'HDMI OUT', 'hdmi', 'out'),
      p('audioin', 'ENTRÉE AUDIO', 'jack35', 'in', { pair: true }),
      p('usb', 'USB', 'usbC', 'both'),
      powerIn(),
    ],
  },

  /* ======================= Utilitaires & réseau ======================= */
  {
    id: 'switch', label: 'Hub Ethernet PRO DJ LINK (5 ports)', short: 'Hub réseau', category: 'utility',
    icon: 'hub', units: 1, provided: 'promoter',
    req: '5 ports, câbles Ethernet fournis',
    note: 'Indispensable dès trois lecteurs reliés au mixeur. Câbles Ethernet fournis avec.',
    ports: [
      link('p1', 'PORT 1'), link('p2', 'PORT 2'), link('p3', 'PORT 3'),
      link('p4', 'PORT 4'), link('p5', 'PORT 5'),
      powerIn(),
    ],
  },
  {
    id: 'stagebox', label: 'Boîtier de scène (multipaire)', short: 'Boîtier de scène', category: 'utility',
    icon: 'box', units: 1, provided: 'promoter',
    note: 'Regroupe les lignes de la cabine vers la régie, en un seul câble.',
    ports: [
      p('in1', 'LIGNE 1', 'micxlr', 'in'), p('in2', 'LIGNE 2', 'micxlr', 'in'),
      p('in3', 'LIGNE 3', 'micxlr', 'in'), p('in4', 'LIGNE 4', 'micxlr', 'in'),
      p('out1', 'RETOUR 1', 'xlr', 'out'), p('out2', 'RETOUR 2', 'xlr', 'out'),
    ],
  },
  {
    id: 'recorder', label: 'Enregistreur de set', short: 'Enregistreur', category: 'utility',
    icon: 'box', units: 1, provided: 'artist',
    note: 'Branché sur la sortie REC du mixeur pour garder une trace du set.',
    ports: [p('in', 'ENTRÉE LIGNE', 'rca', 'in', { pair: true }), powerIn()],
  },
  {
    id: 'powerstrip', label: 'Multiprise 230 V (6 prises)', short: 'Multiprise', category: 'utility',
    icon: 'power', units: 1, provided: 'promoter',
    req: 'prises avec terre, sur un circuit stable',
    note: 'Bloc de prises avec terre, sur un circuit distinct de celui des cuisines.',
    ports: [
      p('in', 'SECTEUR', 'power', 'in'),
      p('o1', 'PRISE 1', 'power', 'out'), p('o2', 'PRISE 2', 'power', 'out'),
      p('o3', 'PRISE 3', 'power', 'out'), p('o4', 'PRISE 4', 'power', 'out'),
      p('o5', 'PRISE 5', 'power', 'out'), p('o6', 'PRISE 6', 'power', 'out'),
    ],
  },
  {
    id: 'ups', label: 'Onduleur / régulateur', short: 'Onduleur', category: 'utility',
    icon: 'power', units: 1, provided: 'artist',
    note: 'Protège la cabine des coupures brèves et des variations de tension.',
    ports: [
      p('in', 'SECTEUR', 'power', 'in'),
      p('o1', 'SORTIE 1', 'power', 'out'), p('o2', 'SORTIE 2', 'power', 'out'),
      p('o3', 'SORTIE 3', 'power', 'out'),
    ],
  },
  {
    id: 'lightbar', label: 'Barre à LED / jeu de lumière', short: 'Éclairage', category: 'utility',
    icon: 'light', units: 1, provided: 'promoter',
    note: 'Piloté en DMX ou en mode automatique sur le son.',
    ports: [p('dmxin', 'DMX IN', 'dmx', 'in'), p('dmxout', 'DMX OUT', 'dmx', 'out'), powerIn()],
  },
  {
    id: 'dmxctrl', label: 'Contrôleur DMX', short: 'Contrôleur DMX', category: 'utility',
    icon: 'box', units: 1, provided: 'artist',
    note: 'Pilote les projecteurs en chaîne à partir d’un seul câble.',
    ports: [p('dmxout', 'DMX OUT', 'dmx', 'out'), p('usb', 'USB', 'usbB', 'both'), powerIn()],
  },
  {
    id: 'riser', label: 'Praticable / estrade DJ', short: 'Praticable', category: 'utility',
    icon: 'riser', units: 2, provided: 'promoter',
    req: "pour que le public voie l'artiste, avec éclairage dédié",
    note: 'Surélève la cabine pour que le public voie l’artiste. À prévoir avec un éclairage dédié.',
    ports: [],
  },
  {
    id: 'boothtable', label: 'Table de cabine', short: 'Table de cabine', category: 'utility',
    icon: 'riser', units: 2, provided: 'promoter',
    req: '150 × 80 cm minimum, hauteur 100 cm, stable',
    note: 'Plan stable de 150 × 80 cm minimum, hauteur 100 cm, désolidarisé du système de diffusion.',
    ports: [],
  },
];

export const GEAR_MAP = Object.fromEntries(GEAR.map((g) => [g.id, g]));

/** Matériel groupé par catégorie, pour les menus de sélection. */
export function gearByCategory() {
  const out = [];
  for (const [id, cat] of Object.entries(CATEGORIES)) {
    const items = GEAR.filter((g) => g.category === id);
    if (items.length) out.push({ id, ...cat, items });
  }
  return out;
}

export function findPort(gearId, portId) {
  const gear = GEAR_MAP[gearId];
  if (!gear) return null;
  return gear.ports.find((port) => port.id === portId) || null;
}

/** Ports audio (gauche / droite) et ports de service (bas). */
export function splitPorts(gear) {
  const inputs = [];
  const outputs = [];
  const services = [];
  for (const port of gear.ports) {
    if (CONNECTORS[port.type]?.service) services.push(port);
    else if (port.dir === 'out') outputs.push(port);
    else inputs.push(port);
  }
  return { inputs, outputs, services };
}

/** Résumé lisible de la connectique, pour la fiche technique. */
export function describePorts(gear) {
  const { inputs, outputs } = splitPorts(gear);
  const fmt = (list) => list.map((port) => port.name).join(', ');
  return {
    inputs: fmt(inputs),
    outputs: fmt(outputs),
    hasPhantom: gear.ports.some((port) => port.phantom),
    hasSend: gear.ports.some((port) => /send/i.test(port.id)),
    hasNetwork: gear.ports.some((port) => port.type === 'ethernet'),
  };
}
