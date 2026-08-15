/** Générateur de fiche technique DJ. */
import { h, clear } from '../core/dom.js';
import { buildForm } from '../core/forms.js';
import { printDocument, downloadJSON, pickFile, readText, toastOk, toastErr, confirmDialog } from '../core/ui.js';
import * as store from '../core/store.js';
import { loadProfile, documentHeader, contactSection } from '../core/profile.js';
import { escapeHtml, bulletList, slugify } from '../core/text.js';
import { section, subBlock, kv, formatDate } from '../core/doc.js';

const KEY = 'fiche.technique';

/* ------------------------ Configurations types ------------------------ */

const SETUPS = {
  cdj: {
    label: 'CDJ + mixeur (standard club)',
    values: {
      players: "2 × Pioneer CDJ-3000 (ou CDJ-2000NXS2 / CDJ-2000NXS)\nLecteurs reliés en PRO DJ LINK, firmware à jour\nClés USB lues en direct — pas d'ordinateur nécessaire",
      mixer: "1 × Pioneer DJM-A9 (ou DJM-900NXS2 / DJM-V10)\nToutes les voies fonctionnelles, faders et EQ vérifiés",
      alternatives: "Denon SC6000 + X1850 accepté si prévenu à l'avance\nAllen & Heath Xone:96 ou :92 accepté",
      ownGear: "J'apporte mes clés USB (×2) et mon casque.",
      connections: "Aucun besoin particulier : je joue sur le matériel installé.\nUne prise USB ou secteur libre en cabine pour recharger un téléphone.",
      network: "Câbles Ethernet entre les lecteurs et le mixeur (PRO DJ LINK) pour la synchro et l'analyse des morceaux.",
    },
  },
  controller: {
    label: 'Contrôleur + ordinateur',
    values: {
      players: "Je joue sur mon propre contrôleur.\nAucun lecteur n'est demandé à l'organisateur.",
      mixer: "1 entrée ligne stéréo disponible sur la console façade ou le mixeur de la cabine.",
      alternatives: "Si un DJM est présent, je peux m'y brancher directement (entrée LINE d'une voie libre).",
      ownGear: "Contrôleur (Pioneer DDJ-FLX / Rane One selon la date)\nOrdinateur portable + alimentation\nCarte son\nCâbles RCA → XLR symétrisés\nCasque",
      connections: "1 × entrée ligne stéréo (RCA ou XLR) disponible et libre.\nSi DI-box nécessaire : 2 × DI actives fournies par l'organisateur.",
      network: "Pas de besoin réseau. Une connexion Wi-Fi est appréciée mais non indispensable.",
      boothTable: "Table stable de 120 × 60 cm minimum, hauteur 95 à 105 cm, capable de supporter 20 kg.",
    },
  },
  dvs: {
    label: 'Vinyle / DVS (timecode)',
    values: {
      players: "2 × Technics SL-1200/1210 (ou équivalent à entraînement direct)\nCellules et diamants en bon état, bras réglés\nSlipmats fournies (j'apporte les miennes en secours)",
      mixer: "1 × mixeur avec entrées PHONO sur les deux voies (DJM-900NXS2, Xone:96, Rane Seventy-Two…)",
      alternatives: "Un jeu de CDJ en complément est apprécié pour les transitions.",
      ownGear: "Vinyles timecode, ordinateur + interface Serato/Rekordbox DVS, cellules de secours, casque.",
      connections: "Deux voies PHONO libres et fonctionnelles, masse reliée.",
      network: "Aucun besoin réseau.",
    },
  },
  hybrid: {
    label: 'Hybride (CDJ + ordinateur)',
    values: {
      players: "2 × Pioneer CDJ-3000 ou CDJ-2000NXS2 en PRO DJ LINK",
      mixer: "1 × Pioneer DJM-A9 / DJM-900NXS2 avec interface audio USB fonctionnelle",
      alternatives: "Denon SC6000 + X1850 accepté (je joue alors en USB).",
      ownGear: "Ordinateur portable + alimentation, câble USB, clés USB de secours, casque.",
      connections: "Un espace stable pour poser l'ordinateur à droite ou à gauche du mixeur, ou un support d'ordinateur.",
      network: "Câbles Ethernet PRO DJ LINK entre lecteurs et mixeur.",
    },
  },
  mobile: {
    label: 'Prestation mobile (j’apporte tout)',
    values: {
      players: "J'apporte l'intégralité du matériel DJ et de sonorisation.",
      mixer: "Fourni par mes soins.",
      alternatives: "—",
      ownGear: "Système de sonorisation adapté à la jauge, table de mixage, lecteurs, micros HF, éclairage, câblage complet.",
      connections: "Aucun matériel son à fournir.",
      power: "2 × prises 230 V / 16 A indépendantes avec terre, à moins de 10 m de l'emplacement DJ.\nCircuit distinct de celui du traiteur et des cuisines.",
      network: "Aucun besoin réseau.",
      boothTable: "Un emplacement plat et abrité de 3 × 2 m minimum, avec accès véhicule pour le déchargement.",
    },
  },
};

const DEFAULTS = {
  setup: 'cdj',
  setFormat: 'DJ set',
  setDuration: '2 heures',
  players: SETUPS.cdj.values.players,
  mixer: SETUPS.cdj.values.mixer,
  alternatives: SETUPS.cdj.values.alternatives,
  ownGear: SETUPS.cdj.values.ownGear,

  boothTable: "Table ou mobilier stable de 150 × 80 cm minimum, hauteur 100 cm.\nLa cabine ne doit pas transmettre les vibrations du système de diffusion.",
  boothMonitor: "2 × moniteurs de cabine sur pied ou en hauteur, orientés vers l'artiste, contrôlés depuis le mixeur.\nNiveau de cabine indépendant de la façade.",
  boothLight: "Éclairage de cabine indépendant et variable, orienté sur le matériel (pas de spot dans les yeux).",
  boothNotes: "Merci de prévoir la cabine hors du passage du public et à l'abri des boissons.\nPas de machine à fumée dirigée vers le matériel.",

  pa: "Système de diffusion professionnel adapté à la jauge et à la salle, calé et vérifié avant l'arrivée de l'artiste.\nSubwoofers présents et en phase avec la façade.",
  soundLimit: "En cas de limiteur, merci d'indiquer le niveau autorisé et le mode de fonctionnement avant la date.",

  connections: SETUPS.cdj.values.connections,
  power: "4 × prises 230 V / 16 A avec terre en cabine, sur un circuit stable.\nMultiprises et rallonges fournies par l'organisateur.",
  network: SETUPS.cdj.values.network,

  arrival: "1 heure avant le début du set",
  setupTime: "30 minutes",
  soundcheck: "30 minutes avant l'ouverture des portes",

  extras: "Merci de prévenir de tout changement de matériel au moins 7 jours avant la date.\nEn cas d'impossibilité sur un point de cette fiche, contactez-moi : une solution existe presque toujours.",
  version: new Date().toISOString().slice(0, 10),
};

const SCHEMA = [
  { type: 'section', label: 'Prestation' },
  { name: 'setFormat', label: 'Format', type: 'select', options: ['DJ set', 'DJ set + MC', 'B2B', 'Live', 'DJ set vinyle'] },
  { name: 'setDuration', label: 'Durée du set', placeholder: '2 heures' },
  { name: 'version', label: 'Version du document', type: 'date' },

  { type: 'section', label: 'Matériel DJ', hint: 'Choisissez une configuration type, puis ajustez le détail. Une ligne par élément.' },
  { name: 'setup', label: 'Configuration', type: 'select', options: Object.entries(SETUPS).map(([value, s]) => ({ value, label: s.label })), width: 'full' },
  { name: 'players', label: 'Lecteurs / platines', type: 'textarea', rows: 4, width: 'full' },
  { name: 'mixer', label: 'Mixeur', type: 'textarea', rows: 3, width: 'full' },
  { name: 'alternatives', label: 'Alternatives acceptées', type: 'textarea', rows: 2, width: 'full', hint: 'Évite les mauvaises surprises : dites ce que vous acceptez plutôt que de laisser deviner.' },
  { name: 'ownGear', label: 'Matériel apporté par l’artiste', type: 'textarea', rows: 3, width: 'full' },

  { type: 'section', label: 'Cabine (booth)' },
  { name: 'boothTable', label: 'Support et espace', type: 'textarea', rows: 3, width: 'full' },
  { name: 'boothMonitor', label: 'Retours de cabine', type: 'textarea', rows: 3, width: 'full' },
  { name: 'boothLight', label: 'Éclairage', type: 'textarea', rows: 2, width: 'full' },
  { name: 'boothNotes', label: 'Remarques cabine', type: 'textarea', rows: 3, width: 'full' },

  { type: 'section', label: 'Diffusion façade' },
  { name: 'pa', label: 'Système de diffusion', type: 'textarea', rows: 3, width: 'full' },
  { name: 'soundLimit', label: 'Limiteur / contraintes de niveau', type: 'textarea', rows: 2, width: 'full' },

  { type: 'section', label: 'Connectique et alimentation' },
  { name: 'connections', label: 'Connexions nécessaires', type: 'textarea', rows: 3, width: 'full' },
  { name: 'power', label: 'Alimentation électrique', type: 'textarea', rows: 3, width: 'full' },
  { name: 'network', label: 'Réseau', type: 'textarea', rows: 2, width: 'full' },

  { type: 'section', label: 'Installation et horaires' },
  { name: 'arrival', label: 'Arrivée de l’artiste' },
  { name: 'setupTime', label: 'Temps d’installation' },
  { name: 'soundcheck', label: 'Balances / soundcheck' },

  { type: 'section', label: 'Remarques' },
  { name: 'extras', label: 'Informations complémentaires', type: 'textarea', rows: 4, width: 'full' },
];

/* ------------------------------ Outil ------------------------------ */

export default function mount(el) {
  const profile = loadProfile();
  const data = { ...DEFAULTS, ...(store.load(KEY, {}) || {}) };

  const previewHost = h('div.doc-preview');
  let saveTimer = 0;

  if (!profile.artistName) {
    el.appendChild(h('div.card', null,
      h('p', { text: 'Votre profil artiste est vide : le document sortira sans nom ni contact.' }),
      h('a.btn.btn-primary.btn-sm', { href: '#/profil', text: 'Compléter mon profil' })
    ));
  }

  const onFieldChange = (name, value) => {
    if (name === 'setup') { applySetup(value); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.save(KEY, data), 350);
    renderPreview();
  };

  let form = buildForm(SCHEMA, data, onFieldChange);
  const formCard = h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Contenu de la fiche' })),
    form
  );
  el.appendChild(formCard);

  el.appendChild(h('div.card', null,
    h('div.card-head', null,
      h('h2', { text: 'Aperçu' }),
      h('span.tiny.muted', { style: { marginLeft: 'auto' }, text: 'Rendu A4 approximatif' })
    ),
    previewHost
  ));

  el.appendChild(h('div.sticky-actions', null,
    h('button.btn.btn-primary', {
      type: 'button', text: 'Imprimer / Enregistrer en PDF',
      on: { click: () => printDocument(buildDoc(loadProfile(), data), `Fiche technique - ${profile.artistName || 'DJ'}`) },
    }),
    h('button.btn.btn-sm', {
      type: 'button', text: 'Exporter (.json)',
      on: { click: () => downloadJSON(`fiche-technique-${slugify(profile.artistName, 'dj')}.json`, { type: 'fiche-technique', data }) },
    }),
    h('button.btn.btn-sm', {
      type: 'button', text: 'Importer',
      on: {
        click: async () => {
          const file = await pickFile('application/json,.json');
          if (!file) return;
          try {
            const payload = JSON.parse(await readText(file));
            Object.assign(data, payload.data || payload);
            store.save(KEY, data);
            toastOk('Fiche importée');
            location.reload();
          } catch { toastErr('Fichier illisible'); }
        },
      },
    }),
    h('button.btn.btn-sm.btn-danger', {
      type: 'button', text: 'Réinitialiser',
      on: {
        click: async () => {
          if (!(await confirmDialog('Revenir au contenu par défaut ? Vos modifications seront perdues.', { title: 'Réinitialiser la fiche', okLabel: 'Réinitialiser', danger: true }))) return;
          store.remove(KEY);
          location.reload();
        },
      },
    })
  ));

  renderPreview();

  function applySetup(id) {
    const preset = SETUPS[id];
    if (!preset) return;
    Object.assign(data, preset.values);
    store.save(KEY, data);
    // Le formulaire est reconstruit pour refléter les valeurs pré-remplies.
    const fresh = buildForm(SCHEMA, data, onFieldChange);
    formCard.replaceChild(fresh, form);
    form = fresh;
    renderPreview();
  }

  function renderPreview() {
    clear(previewHost);
    const doc = h('div.doc');
    doc.innerHTML = buildDoc(loadProfile(), data);
    previewHost.appendChild(doc);
  }

  return () => {
    clearTimeout(saveTimer);
    store.save(KEY, data);
  };
}

/* ------------------------ Génération du document ------------------------ */

export function buildDoc(profile, d) {
  const parts = [];

  parts.push(documentHeader(profile, 'Fiche technique', profile.artistName));

  if (profile.bio) parts.push(`<div class="doc-section"><p>${escapeHtml(profile.bio)}</p></div>`);

  parts.push(section('Prestation', `<div class="doc-grid">
    ${kv('Format', d.setFormat)}
    ${kv('Durée du set', d.setDuration)}
    ${kv('Arrivée', d.arrival)}
    ${kv('Installation', d.setupTime)}
    ${kv('Balances', d.soundcheck)}
    ${kv('Document', d.version ? `version du ${formatDate(d.version)}` : '')}
  </div>`));

  parts.push(section('Matériel demandé', [
    subBlock('Lecteurs / platines', d.players),
    subBlock('Mixeur', d.mixer),
    subBlock('Alternatives acceptées', d.alternatives),
  ].join('')));

  parts.push(section('Matériel apporté par l’artiste', bulletList(d.ownGear)));

  parts.push(section('Cabine (booth)', [
    subBlock('Support et espace', d.boothTable),
    subBlock('Retours de cabine', d.boothMonitor),
    subBlock('Éclairage', d.boothLight),
    subBlock('Remarques', d.boothNotes),
  ].join('')));

  parts.push(section('Diffusion façade', [
    subBlock('Système', d.pa),
    subBlock('Niveau sonore', d.soundLimit),
  ].join('')));

  parts.push(section('Connectique, alimentation et réseau', [
    subBlock('Connexions', d.connections),
    subBlock('Électricité', d.power),
    subBlock('Réseau', d.network),
  ].join('')));

  if (d.extras && d.extras.trim()) {
    parts.push(`<div class="doc-section"><h2>Informations complémentaires</h2><div class="doc-note">${bulletList(d.extras) || escapeHtml(d.extras)}</div></div>`);
  }

  parts.push(contactSection(profile));

  parts.push(`<div class="doc-foot">
    Fiche technique ${escapeHtml(profile.artistName || '')}${d.version ? ` — version du ${formatDate(d.version)}` : ''}.
    Ce document remplace toute version antérieure. Généré avec DJ Pool Tech.
  </div>`);

  return parts.filter(Boolean).join('\n');
}

