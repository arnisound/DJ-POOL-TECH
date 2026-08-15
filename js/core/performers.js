/**
 * Performeurs accompagnant le DJ (saxophoniste, chanteur, percussionniste,
 * VJ…) et génération de la liste des lignes — la « patch list » que tout
 * régisseur attend dans un rider.
 */
import * as store from './store.js';

const KEY = 'performeurs';

/**
 * Rôles types. Les valeurs par défaut correspondent à ce qu'un régisseur
 * prépare habituellement pour cet instrument.
 */
export const ROLES = {
  sax: {
    label: 'Saxophoniste',
    defaults: {
      instrument: 'Saxophone alto / ténor',
      capture: 'clip',
      micModel: 'Micro clip (Shure Beta 98, DPA 4099) ou SM57 sur pied',
      phantom: true,
      needsMonitor: true,
      needsStand: true,
      needsPower: false,
      space: '2 × 1,5 m à côté de la cabine',
      notes: 'Prévoir un pied perche si le musicien joue en fixe.',
    },
  },
  trumpet: {
    label: 'Trompettiste',
    defaults: {
      instrument: 'Trompette',
      capture: 'clip',
      micModel: 'Micro clip ou SM57 sur pied perche',
      phantom: true,
      needsMonitor: true,
      needsStand: true,
      needsPower: false,
      space: '2 × 1,5 m',
      notes: 'Instrument très directif et puissant : attention au niveau d’entrée.',
    },
  },
  percussion: {
    label: 'Percussionniste',
    defaults: {
      instrument: 'Congas / bongos / cajón',
      capture: 'mic',
      micModel: '2 × micros dynamiques (e604 / SM57) ou 1 statique en surplomb',
      phantom: false,
      needsMonitor: true,
      needsStand: true,
      needsPower: false,
      space: '2 × 2 m, sol plat',
      notes: 'Deux lignes si les fûts sont repris séparément.',
      channels: 2,
    },
  },
  singer: {
    label: 'Chanteur / chanteuse',
    defaults: {
      instrument: 'Voix',
      capture: 'hf',
      micModel: 'Micro HF main (Shure SM58 / Sennheiser EW)',
      phantom: false,
      needsMonitor: true,
      needsStand: false,
      needsPower: true,
      space: 'Devant la cabine, 2 × 2 m',
      notes: 'Piles neuves et fréquence libre à valider avant les balances.',
    },
  },
  mc: {
    label: 'MC / animateur',
    defaults: {
      instrument: 'Voix parlée',
      capture: 'hf',
      micModel: 'Micro HF main',
      phantom: false,
      needsMonitor: true,
      needsStand: false,
      needsPower: true,
      space: 'En cabine ou devant',
      notes: 'Voie micro sur le mixeur DJ, avec compresseur si disponible.',
    },
  },
  violin: {
    label: 'Violoniste',
    defaults: {
      instrument: 'Violon (souvent électro-acoustique)',
      capture: 'di',
      micModel: 'DI active depuis le préampli, ou micro clip',
      phantom: true,
      needsMonitor: true,
      needsStand: false,
      needsPower: true,
      space: '2 × 2 m',
      notes: 'Prévoir une prise secteur pour le préampli.',
    },
  },
  guitar: {
    label: 'Guitariste',
    defaults: {
      instrument: 'Guitare électro-acoustique',
      capture: 'di',
      micModel: 'DI active',
      phantom: true,
      needsMonitor: true,
      needsStand: true,
      needsPower: false,
      space: '2 × 2 m',
      notes: 'Pied de guitare à prévoir.',
    },
  },
  keys: {
    label: 'Claviériste / machines',
    defaults: {
      instrument: 'Synthétiseur ou groovebox',
      capture: 'di',
      micModel: '2 × DI (stéréo) ou entrée ligne libre',
      phantom: false,
      needsMonitor: true,
      needsStand: true,
      needsPower: true,
      space: 'Table de 120 × 60 cm',
      notes: 'Sortie stéréo : deux lignes. Prise secteur nécessaire.',
      channels: 2,
    },
  },
  vj: {
    label: 'VJ / visuels',
    defaults: {
      instrument: 'Visuels',
      capture: 'none',
      micModel: '',
      phantom: false,
      needsMonitor: false,
      needsStand: false,
      needsPower: true,
      space: 'Table de 100 × 60 cm près de la cabine',
      notes: 'Sortie HDMI vers la régie vidéo, et un retour audio de la cabine.',
    },
  },
  dancer: {
    label: 'Danseur / danseuse',
    defaults: {
      instrument: '',
      capture: 'none',
      micModel: '',
      phantom: false,
      needsMonitor: false,
      needsStand: false,
      needsPower: false,
      space: 'Podium ou zone dégagée de 2 × 2 m',
      notes: 'Sol non glissant et éclairage dédié.',
    },
  },
  other: {
    label: 'Autre',
    defaults: {
      instrument: '',
      capture: 'mic',
      micModel: 'Micro dynamique',
      phantom: false,
      needsMonitor: true,
      needsStand: true,
      needsPower: false,
      space: '',
      notes: '',
    },
  },
};

/** Mode de captation → libellé pour la liste des lignes. */
export const CAPTURE = {
  mic:  'Micro filaire',
  clip: 'Micro clip',
  hf:   'Micro HF',
  di:   'Boîte de direct (DI)',
  line: 'Entrée ligne',
  none: '—',
};

export function emptyPerformer(role = 'sax') {
  const preset = ROLES[role] || ROLES.other;
  return {
    id: store.uid(),
    name: '',
    role,
    channels: 1,
    ...preset.defaults,
  };
}

export function allPerformers() {
  const list = store.load(KEY, []);
  return Array.isArray(list) ? list : [];
}

export function savePerformers(list) {
  store.save(KEY, list);
  return list;
}

export function addPerformer(performer) {
  const list = allPerformers();
  list.push(performer);
  return savePerformers(list);
}

export function updatePerformer(id, partial) {
  const list = allPerformers();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return list;
  list[i] = { ...list[i], ...partial };
  return savePerformers(list);
}

export function removePerformer(id) {
  return savePerformers(allPerformers().filter((p) => p.id !== id));
}

export function performerLabel(performer) {
  const role = ROLES[performer.role]?.label || 'Performeur';
  return performer.name ? `${performer.name} — ${role}` : role;
}

/**
 * Liste des lignes : la patch list attendue par le régisseur.
 * Les deux premières voies sont réservées à la cabine DJ.
 * @param {Array} performers
 * @param {object} opts
 * @param {boolean} [opts.includeDj=true]
 * @param {string}  [opts.djLabel='Cabine DJ']
 */
export function inputList(performers, { includeDj = true, djLabel = 'Cabine DJ' } = {}) {
  const rows = [];
  let n = 0;

  if (includeDj) {
    rows.push({ n: ++n, source: `${djLabel} — sortie gauche`, capture: 'line', device: 'Sortie MASTER du mixeur', phantom: false, stand: false, monitor: 'Retours de cabine' });
    rows.push({ n: ++n, source: `${djLabel} — sortie droite`, capture: 'line', device: 'Sortie MASTER du mixeur', phantom: false, stand: false, monitor: 'Retours de cabine' });
  }

  for (const performer of performers) {
    if (performer.capture === 'none') continue;
    const count = Math.max(1, Number(performer.channels) || 1);
    for (let i = 0; i < count; i++) {
      rows.push({
        n: ++n,
        source: performerLabel(performer) + (count > 1 ? ` (${i + 1}/${count})` : ''),
        capture: performer.capture,
        device: performer.micModel || CAPTURE[performer.capture] || '',
        phantom: !!performer.phantom,
        stand: !!performer.needsStand,
        monitor: performer.needsMonitor ? 'Retour dédié' : '—',
      });
    }
  }

  return rows;
}

/** Synthèse des besoins, pour le rider : ce que l'organisateur doit fournir. */
export function requirementSummary(performers) {
  const needs = [];
  const monitors = performers.filter((p) => p.needsMonitor).length;
  const stands = performers.filter((p) => p.needsStand).length;
  const power = performers.filter((p) => p.needsPower).length;
  const phantom = performers.some((p) => p.phantom);
  const wireless = performers.filter((p) => p.capture === 'hf').length;
  const dis = performers.reduce((s, p) => s + (p.capture === 'di' ? Math.max(1, Number(p.channels) || 1) : 0), 0);

  if (monitors) needs.push(`${monitors} retour${monitors > 1 ? 's' : ''} de scène indépendant${monitors > 1 ? 's' : ''} du niveau de cabine`);
  if (stands) needs.push(`${stands} pied${stands > 1 ? 's' : ''} de micro (perche)`);
  if (dis) needs.push(`${dis} boîte${dis > 1 ? 's' : ''} de direct active${dis > 1 ? 's' : ''}`);
  if (wireless) needs.push(`${wireless} micro${wireless > 1 ? 's' : ''} HF avec piles neuves et fréquences validées`);
  if (phantom) needs.push('Alimentation fantôme 48 V disponible sur les voies concernées');
  if (power) needs.push(`${power} prise${power > 1 ? 's' : ''} 230 V supplémentaire${power > 1 ? 's' : ''} sur scène`);

  const spaces = performers.filter((p) => p.space).map((p) => `${performerLabel(p)} : ${p.space}`);
  return { needs, spaces };
}
