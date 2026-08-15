/**
 * Catalogue du matériel DJ et sono, avec sa connectique.
 *
 * Chaque appareil déclare ses ports : c'est ce qui permet au plan de câblage
 * de proposer des liaisons cohérentes et de repérer les erreurs classiques
 * (une sortie ligne branchée dans une entrée phono, par exemple).
 *
 * Un port : { id, name, type, dir }
 *   dir  : 'in' (entrée), 'out' (sortie), 'both' (bidirectionnel)
 *   type : voir CONNECTORS ci-dessous
 * Les ports de service (USB, réseau, secteur) sont placés sous l'appareil,
 * les ports audio à gauche (entrées) et à droite (sorties).
 */

/* ------------------------------------------------------------------ *
 * Types de connecteurs
 * ------------------------------------------------------------------ */

export const CONNECTORS = {
  rca:      { label: 'RCA (cinch)',        short: 'RCA',    color: '#e0a54a', signal: 'ligne',    service: false },
  phono:    { label: 'RCA phono + masse',  short: 'PHONO',  color: '#c2703c', signal: 'phono',    service: false },
  xlr:      { label: 'XLR symétrique',     short: 'XLR',    color: '#5b8dee', signal: 'ligne',    service: false },
  jack63:   { label: 'Jack 6,35 mm',       short: 'JACK',   color: '#7c9cc4', signal: 'ligne',    service: false },
  jack35:   { label: 'Mini-jack 3,5 mm',   short: '3,5',    color: '#9aa7bd', signal: 'ligne',    service: false },
  micxlr:   { label: 'XLR micro',          short: 'MIC',    color: '#e8657f', signal: 'micro',    service: false },
  speakon:  { label: 'Speakon NL4',        short: 'SPK',    color: '#4bb98a', signal: 'puissance', service: false },
  spdif:    { label: 'S/PDIF coaxial',     short: 'S/PDIF', color: '#a074e8', signal: 'numérique', service: false },
  usbA:     { label: 'USB type A',         short: 'USB-A',  color: '#8f9bb3', signal: 'données',  service: true },
  usbB:     { label: 'USB type B',         short: 'USB-B',  color: '#8f9bb3', signal: 'données',  service: true },
  usbC:     { label: 'USB type C',         short: 'USB-C',  color: '#8f9bb3', signal: 'données',  service: true },
  ethernet: { label: 'Réseau RJ45 (LINK)', short: 'LINK',   color: '#4fc3d9', signal: 'réseau',   service: true },
  midi:     { label: 'MIDI DIN',           short: 'MIDI',   color: '#b58ae0', signal: 'commande', service: true },
  dmx:      { label: 'DMX (XLR 3 pts)',    short: 'DMX',    color: '#d3b14b', signal: 'commande', service: true },
  power:    { label: 'Alimentation 230 V', short: '230 V',  color: '#7d879e', signal: 'secteur',  service: true },
};

/**
 * Compatibilité entre deux ports.
 * @returns {{ok:boolean, level:'ok'|'adapter'|'warn'|'error', message:string, cable:string}}
 */
export function checkConnection(from, to) {
  // Sens du signal : une sortie va vers une entrée.
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

  // Un signal ligne entrant dans une entrée phono : le préampli sature.
  if (a.signal === 'ligne' && b.signal === 'phono') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Sortie ligne vers entrée phono : basculez la voie en LINE, sinon le son saturera.',
    };
  }
  if (a.signal === 'phono' && b.signal === 'ligne') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Sortie phono vers entrée ligne : le son sera très faible et sans correction RIAA. Basculez la voie en PHONO.',
    };
  }
  if (a.signal === 'micro' && b.signal !== 'micro') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Micro vers entrée ligne : passez par une DI ou une entrée micro, le niveau sera sinon inaudible.',
    };
  }
  // Cela se pratique (avec le pad engagé), mais c'est la première cause de
  // saturation en prestation mobile : on prévient sans interdire.
  if (a.signal === 'ligne' && b.signal === 'micro') {
    return {
      ok: true, level: 'warn', cable: from.type,
      message: 'Sortie ligne dans une entrée micro : engagez le PAD de la voie ou utilisez une entrée ligne, sinon ça saturera.',
    };
  }

  // Adaptations courantes entre formats de niveau ligne.
  const lineTypes = ['rca', 'xlr', 'jack63', 'jack35'];
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

/** Libellé lisible d'un câble (utilisé dans la liste de câbles). */
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
  controller: { label: 'Contrôleurs',         color: '#5b8dee' },
  computer:   { label: 'Informatique',        color: '#9aa7bd' },
  fx:         { label: 'Effets & machines',   color: '#b58ae0' },
  mic:        { label: 'Micros & DI',         color: '#e8657f' },
  sound:      { label: 'Diffusion',           color: '#4bb98a' },
  utility:    { label: 'Utilitaires',         color: '#d3b14b' },
};

/* ------------------------------------------------------------------ *
 * Raccourcis de déclaration
 * ------------------------------------------------------------------ */

/** `pair` marque une liaison stéréo : deux câbles XLR ou jack, un seul cordon RCA. */
const p = (id, name, type, dir, opts = {}) => ({ id, name, type, dir, ...opts });
const powerIn = p('pwr', '230 V', 'power', 'in');
const linkPort = p('link', 'LINK', 'ethernet', 'both');

/** Voie de mixeur acceptant ligne et phono (le sélecteur est sur la façade). */
const chanLinePhono = (n) => [
  p(`ch${n}line`, `CH${n} LINE`, 'rca', 'in', { pair: true }),
  p(`ch${n}phono`, `CH${n} PHONO`, 'phono', 'in', { pair: true }),
];
const chanLine = (n) => [p(`ch${n}line`, `CH${n} LINE`, 'rca', 'in', { pair: true })];

/* ------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------ */

export const GEAR = [
  /* ----------------------------- Lecteurs ----------------------------- */
  {
    id: 'cdj3000', label: 'Pioneer CDJ-3000', short: 'CDJ-3000', category: 'player',
    note: 'Lecteur multi-format, standard des clubs. Lecture directe depuis clé USB.',
    ports: [
      p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB', 'usbA', 'in'),
      linkPort, powerIn,
    ],
  },
  {
    id: 'cdj2000nxs2', label: 'Pioneer CDJ-2000NXS2', short: 'CDJ-2000NXS2', category: 'player',
    note: 'Génération précédente, encore très répandue. Même connectique que le CDJ-3000.',
    ports: [
      p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }),
      p('digital', 'DIGITAL OUT', 'spdif', 'out'),
      p('usb', 'USB', 'usbA', 'in'),
      linkPort, powerIn,
    ],
  },
  {
    id: 'xdj1000', label: 'Pioneer XDJ-1000MK2', short: 'XDJ-1000MK2', category: 'player',
    note: 'Lecteur sans platine CD, plus léger et fréquent en bar ou en location.',
    ports: [p('out', 'AUDIO OUT', 'rca', 'out', { pair: true }), p('usb', 'USB', 'usbA', 'in'), linkPort, powerIn],
  },
  {
    id: 'sc6000', label: 'Denon SC6000 Prime', short: 'SC6000', category: 'player',
    note: 'Lecteur Engine DJ. Sortie ligne symétrique disponible en plus du RCA.',
    ports: [
      p('out', 'LINE OUT', 'rca', 'out', { pair: true }),
      p('outbal', 'BALANCED OUT', 'xlr', 'out', { pair: true }),
      p('usb', 'USB', 'usbA', 'in'),
      p('net', 'LINK', 'ethernet', 'both'), powerIn,
    ],
  },
  {
    id: 'tt1210', label: 'Technics SL-1210 (ou équivalent)', short: 'Platine vinyle', category: 'player',
    note: 'Platine à entraînement direct. Sortie phono : la voie du mixeur doit être en PHONO, masse reliée.',
    ports: [p('out', 'PHONO OUT', 'phono', 'out', { pair: true }), powerIn],
  },

  /* ----------------------------- Mixeurs ----------------------------- */
  {
    id: 'djma9', label: 'Pioneer DJM-A9', short: 'DJM-A9', category: 'mixer',
    note: 'Mixeur 4 voies de référence en club. Interface audio USB intégrée pour le DVS.',
    ports: [
      ...chanLinePhono(1), ...chanLinePhono(2), ...chanLinePhono(3), ...chanLinePhono(4),
      p('mic1', 'MIC 1', 'micxlr', 'in'),
      p('mic2', 'MIC 2', 'micxlr', 'in'),
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'xlr', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('phones', 'CASQUE', 'jack63', 'out'),
      p('usbb', 'USB', 'usbB', 'both'),
      linkPort, powerIn,
    ],
  },
  {
    id: 'djm900', label: 'Pioneer DJM-900NXS2', short: 'DJM-900NXS2', category: 'mixer',
    note: 'Le plus répandu des mixeurs club. Connectique identique au DJM-A9.',
    ports: [
      ...chanLinePhono(1), ...chanLinePhono(2), ...chanLinePhono(3), ...chanLinePhono(4),
      p('mic1', 'MIC 1', 'micxlr', 'in'),
      p('mic2', 'MIC 2', 'micxlr', 'in'),
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('master2', 'MASTER 2 (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('send', 'SEND', 'jack63', 'out'),
      p('return', 'RETURN', 'jack63', 'in'),
      p('phones', 'CASQUE', 'jack63', 'out'),
      p('usbb', 'USB', 'usbB', 'both'),
      linkPort, powerIn,
    ],
  },
  {
    id: 'djmv10', label: 'Pioneer DJM-V10', short: 'DJM-V10', category: 'mixer',
    note: 'Mixeur 6 voies avec égaliseur 4 bandes, apprécié en techno et en house.',
    ports: [
      ...chanLinePhono(1), ...chanLinePhono(2), ...chanLinePhono(3),
      ...chanLinePhono(4), ...chanLine(5), ...chanLine(6),
      p('mic1', 'MIC 1', 'micxlr', 'in'),
      p('master1', 'MASTER 1 (XLR)', 'xlr', 'out', { pair: true }),
      p('booth', 'BOOTH', 'xlr', 'out', { pair: true }),
      p('rec', 'REC OUT', 'rca', 'out', { pair: true }),
      p('send', 'SEND', 'jack63', 'out'),
      p('return', 'RETURN', 'jack63', 'in'),
      p('usbb', 'USB', 'usbB', 'both'), linkPort, powerIn,
    ],
  },
  {
    id: 'xone96', label: 'Allen & Heath Xone:96', short: 'Xone:96', category: 'mixer',
    note: 'Mixeur analogique 6 voies, filtres réputés. Deux interfaces USB indépendantes.',
    ports: [
      ...chanLinePhono(1), ...chanLinePhono(2), ...chanLinePhono(3), ...chanLinePhono(4),
      p('mic1', 'MIC', 'micxlr', 'in'),
      p('master', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('rec', 'REC', 'rca', 'out', { pair: true }),
      p('send1', 'SEND 1', 'jack63', 'out'),
      p('ret1', 'RETURN 1', 'jack63', 'in'),
      p('usbb', 'USB', 'usbB', 'both'), powerIn,
    ],
  },
  {
    id: 'x1850', label: 'Denon X1850 Prime', short: 'X1850', category: 'mixer',
    note: 'Mixeur 4 voies Engine DJ, avec réseau intégré pour les SC6000.',
    ports: [
      ...chanLinePhono(1), ...chanLinePhono(2), ...chanLinePhono(3), ...chanLinePhono(4),
      p('mic1', 'MIC 1', 'micxlr', 'in'),
      p('mic2', 'MIC 2', 'micxlr', 'in'),
      p('master', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('masterrca', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('usbb', 'USB', 'usbB', 'both'), linkPort, powerIn,
    ],
  },
  {
    id: 'djm450', label: 'Pioneer DJM-450', short: 'DJM-450', category: 'mixer',
    note: 'Mixeur 2 voies compact, courant en bar et en prestation mobile.',
    ports: [
      ...chanLinePhono(1), ...chanLinePhono(2),
      p('mic1', 'MIC', 'micxlr', 'in'),
      p('master', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('masterrca', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('usbb', 'USB', 'usbB', 'both'), powerIn,
    ],
  },
  {
    id: 'mixerlive', label: 'Console de façade (analogique)', short: 'Console façade', category: 'mixer',
    note: 'Console du lieu ou de la sono mobile. Prévoir deux voies libres pour la cabine DJ.',
    ports: [
      p('in1', 'VOIE 1', 'micxlr', 'in'),
      p('in2', 'VOIE 2', 'micxlr', 'in'),
      p('in3', 'VOIE 3', 'micxlr', 'in'),
      p('in4', 'VOIE 4', 'micxlr', 'in'),
      p('inline', 'VOIES LIGNE (L/R)', 'xlr', 'in', { pair: true }),
      p('stereoin', 'ENTRÉE STÉRÉO', 'jack63', 'in', { pair: true }),
      p('main', 'SORTIE GÉNÉRALE', 'xlr', 'out', { pair: true }),
      p('aux1', 'AUX 1 (retour)', 'xlr', 'out'),
      p('aux2', 'AUX 2 (retour)', 'xlr', 'out'),
      powerIn,
    ],
  },

  /* --------------------------- Contrôleurs --------------------------- */
  {
    id: 'ddjflx10', label: 'Pioneer DDJ-FLX10', short: 'DDJ-FLX10', category: 'controller',
    note: 'Contrôleur 4 voies tout-en-un, carte son intégrée. Se branche en ligne sur la façade.',
    ports: [
      p('master', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('masterrca', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('mic', 'MIC', 'micxlr', 'in'),
      p('usbb', 'USB vers ordinateur', 'usbB', 'both'), powerIn,
    ],
  },
  {
    id: 'raneone', label: 'Rane One', short: 'Rane One', category: 'controller',
    note: 'Contrôleur à platines motorisées, orienté scratch, carte son intégrée.',
    ports: [
      p('master', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('booth', 'BOOTH', 'jack63', 'out', { pair: true }),
      p('mic', 'MIC', 'micxlr', 'in'),
      p('usbb', 'USB vers ordinateur', 'usbB', 'both'), powerIn,
    ],
  },
  {
    id: 'kontrols4', label: 'Traktor Kontrol S4 MK3', short: 'Kontrol S4', category: 'controller',
    note: 'Contrôleur Traktor 4 voies, carte son intégrée.',
    ports: [
      p('master', 'MASTER (XLR)', 'xlr', 'out', { pair: true }),
      p('masterrca', 'MASTER (RCA)', 'rca', 'out', { pair: true }),
      p('mic', 'MIC', 'micxlr', 'in'),
      p('usbc', 'USB vers ordinateur', 'usbC', 'both'), powerIn,
    ],
  },

  /* --------------------------- Informatique --------------------------- */
  {
    id: 'laptop', label: 'Ordinateur portable', short: 'Ordinateur', category: 'computer',
    note: 'Rekordbox, Serato, Traktor ou Engine DJ. Prévoir son alimentation et un support stable.',
    ports: [
      p('usb1', 'USB 1', 'usbA', 'both'),
      p('usb2', 'USB 2', 'usbC', 'both'),
      p('jack', 'SORTIE CASQUE', 'jack35', 'out'),
      powerIn,
    ],
  },
  {
    id: 'soundcard', label: 'Carte son externe / interface DVS', short: 'Carte son', category: 'computer',
    note: 'Rane SL, Denon DS1 ou interface équivalente pour jouer en timecode.',
    ports: [
      p('in1', 'ENTRÉE 1 (phono)', 'phono', 'in'),
      p('in2', 'ENTRÉE 2 (phono)', 'phono', 'in'),
      p('out1', 'SORTIE 1', 'rca', 'out'),
      p('out2', 'SORTIE 2', 'rca', 'out'),
      p('usb', 'USB vers ordinateur', 'usbB', 'both'),
    ],
  },

  /* ------------------------- Effets & machines ------------------------- */
  {
    id: 'rmx1000', label: 'Pioneer RMX-1000', short: 'RMX-1000', category: 'fx',
    note: 'Processeur d’effets. Se place dans la boucle SEND / RETURN du mixeur.',
    ports: [
      p('in', 'ENTRÉE', 'jack63', 'in'),
      p('out', 'SORTIE', 'jack63', 'out'),
      p('usb', 'USB', 'usbB', 'both'), powerIn,
    ],
  },
  {
    id: 'groovebox', label: 'Groovebox / machine (MPC, Digitakt…)', short: 'Groovebox', category: 'fx',
    note: 'Instrument live joué en parallèle du mix, sur une voie ligne libre.',
    ports: [
      p('out', 'SORTIE PRINCIPALE', 'jack63', 'out'),
      p('midiin', 'MIDI IN', 'midi', 'in'),
      p('midiout', 'MIDI OUT', 'midi', 'out'),
      powerIn,
    ],
  },
  {
    id: 'synth', label: 'Synthétiseur / clavier', short: 'Synthé', category: 'fx',
    note: 'Sortie asymétrique : passer par une DI si le câble dépasse 5 mètres.',
    ports: [
      p('outl', 'SORTIE G', 'jack63', 'out'),
      p('outr', 'SORTIE D', 'jack63', 'out'),
      p('midiin', 'MIDI IN', 'midi', 'in'),
      powerIn,
    ],
  },

  /* ---------------------------- Micros & DI ---------------------------- */
  {
    id: 'micfil', label: 'Micro filaire (SM58 ou équivalent)', short: 'Micro filaire', category: 'mic',
    note: 'Micro dynamique, sans alimentation fantôme. Prévoir pied et câble XLR.',
    ports: [p('out', 'SORTIE XLR', 'micxlr', 'out')],
  },
  {
    id: 'michf', label: 'Micro HF (émetteur + récepteur)', short: 'Micro HF', category: 'mic',
    note: 'Prévoir des piles neuves et une fréquence libre. Le récepteur demande une prise secteur.',
    ports: [p('out', 'SORTIE RÉCEPTEUR', 'micxlr', 'out'), powerIn],
  },
  {
    id: 'micinstr', label: 'Micro instrument (cuivres, percussions)', short: 'Micro instrument', category: 'mic',
    note: 'SM57, e604 ou statique selon l’instrument. Alimentation fantôme si statique.',
    ports: [p('out', 'SORTIE XLR', 'micxlr', 'out')],
  },
  {
    id: 'dibox', label: 'Boîte de direct (DI)', short: 'DI', category: 'mic',
    note: 'Symétrise un signal instrument et l’amène jusqu’à la console sans perte.',
    ports: [
      p('in', 'ENTRÉE INSTRUMENT', 'jack63', 'in'),
      p('thru', 'THRU', 'jack63', 'out'),
      p('out', 'SORTIE XLR', 'micxlr', 'out'),
    ],
  },

  /* ---------------------------- Diffusion ---------------------------- */
  {
    id: 'foh', label: 'Système de façade (FOH)', short: 'Façade', color: '#4bb98a', category: 'sound',
    note: 'Diffusion principale, calée par le régisseur avant l’arrivée de l’artiste.',
    ports: [p('in', 'ENTRÉE L/R', 'xlr', 'in', { pair: true }), powerIn],
  },
  {
    id: 'sub', label: 'Caisson de basses', short: 'Sub', category: 'sound',
    note: 'À placer en phase avec la façade. Souvent alimenté depuis le processeur.',
    ports: [p('in', 'ENTRÉE', 'xlr', 'in'), p('thru', 'LIEN', 'xlr', 'out'), powerIn],
  },
  {
    id: 'booth', label: 'Retours de cabine', short: 'Retours cabine', category: 'sound',
    note: 'Niveau réglable indépendamment de la façade, à hauteur d’oreille.',
    ports: [p('in', 'ENTRÉE', 'xlr', 'in', { pair: true }), powerIn],
  },
  {
    id: 'wedge', label: 'Retour de scène (wedge)', short: 'Retour scène', category: 'sound',
    note: 'Pour un performeur : saxophoniste, chanteur, percussionniste.',
    ports: [p('in', 'ENTRÉE', 'xlr', 'in', { pair: true }), powerIn],
  },
  {
    id: 'amp', label: 'Amplificateur / processeur', short: 'Ampli', category: 'sound',
    note: 'Sur une sono passive : filtrage et amplification entre la console et les enceintes.',
    ports: [
      p('in', 'ENTRÉE L/R', 'xlr', 'in', { pair: true }),
      p('outl', 'HP GAUCHE', 'speakon', 'out'), p('outr', 'HP DROITE', 'speakon', 'out'),
      powerIn,
    ],
  },
  {
    id: 'speakerpassive', label: 'Enceinte passive', short: 'Enceinte passive', category: 'sound',
    note: 'Reliée à l’amplificateur en Speakon.',
    ports: [p('in', 'ENTRÉE HP', 'speakon', 'in')],
  },

  /* ---------------------------- Utilitaires ---------------------------- */
  {
    id: 'recorder', label: 'Enregistreur de set', short: 'Enregistreur', category: 'utility',
    note: 'Branché sur la sortie REC du mixeur pour garder une trace du set.',
    ports: [p('in', 'ENTRÉE LIGNE', 'rca', 'in', { pair: true }), powerIn],
  },
  {
    id: 'switch', label: 'Switch réseau (PRO DJ LINK)', short: 'Switch réseau', category: 'utility',
    note: 'Nécessaire dès trois lecteurs reliés au mixeur. Câbles Ethernet fournis.',
    ports: [
      p('p1', 'PORT 1', 'ethernet', 'both'), p('p2', 'PORT 2', 'ethernet', 'both'),
      p('p3', 'PORT 3', 'ethernet', 'both'), p('p4', 'PORT 4', 'ethernet', 'both'),
      p('p5', 'PORT 5', 'ethernet', 'both'), powerIn,
    ],
  },
  {
    id: 'powerstrip', label: 'Multiprise 230 V', short: 'Multiprise', category: 'utility',
    note: 'Bloc de prises avec terre, sur un circuit distinct de celui des cuisines.',
    ports: [
      p('o1', 'PRISE 1', 'power', 'out'), p('o2', 'PRISE 2', 'power', 'out'),
      p('o3', 'PRISE 3', 'power', 'out'), p('o4', 'PRISE 4', 'power', 'out'),
      p('o5', 'PRISE 5', 'power', 'out'), p('o6', 'PRISE 6', 'power', 'out'),
      p('in', 'SECTEUR', 'power', 'in'),
    ],
  },
  {
    id: 'lightbar', label: 'Barre à LED / jeu de lumière', short: 'Éclairage', category: 'utility',
    note: 'Piloté en DMX ou en mode automatique sur le son.',
    ports: [p('dmxin', 'DMX IN', 'dmx', 'in'), p('dmxout', 'DMX OUT', 'dmx', 'out'), powerIn],
  },
  {
    id: 'dmxctrl', label: 'Contrôleur DMX', short: 'Contrôleur DMX', category: 'utility',
    note: 'Pilote les projecteurs en chaîne à partir d’un seul câble.',
    ports: [p('dmxout', 'DMX OUT', 'dmx', 'out'), powerIn],
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

/** Ports audio (gauche/droite) et ports de service (bas). */
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
