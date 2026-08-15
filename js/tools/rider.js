/** Générateur de rider technique et d'accueil. */
import { h, clear } from '../core/dom.js';
import { buildForm } from '../core/forms.js';
import { printDocument, downloadJSON, pickFile, readText, toastOk, toastErr, confirmDialog } from '../core/ui.js';
import * as store from '../core/store.js';
import { loadProfile, documentHeader, contactSection } from '../core/profile.js';
import { escapeHtml, bulletList, slugify } from '../core/text.js';
import { section, subBlock, kvGrid, note, signatures, formatDate, performersSection, inputListSection, patchSection } from '../core/doc.js';
import { allPerformers } from '../core/performers.js';
import { allPlans } from '../core/patch.js';

const KEY = 'rider.technique';

/* ------------------------------ Presets ------------------------------ */

const PRESETS = {
  club: {
    label: 'Club',
    values: {
      context: "Set en club, cabine intégrée à la salle.",
      lighting: "Éclairage géré par la salle.\nAucun jeu de lumière n'est demandé à l'artiste.",
      staff: "Un régisseur son présent à l'arrivée de l'artiste et joignable pendant toute la prestation.",
      hospitality: "Loge fermant à clé ou espace réservé à l'artiste.\n6 bouteilles d'eau plate 50 cl (dont 2 en cabine).\nUn repas chaud si le set débute après 21 h.\nBoissons : à convenir selon la carte du lieu.",
      travel: "Déplacement en train ou en voiture selon la distance, pris en charge par l'organisateur.\nStationnement à proximité si trajet en voiture.",
      lodging: "Hébergement en hôtel 3★ minimum, chambre individuelle, si le set se termine après 1 h ou si le trajet retour excède 1 h 30.",
      guests: "2 invitations sur la liste d'entrée.",
    },
  },
  festival: {
    label: 'Festival',
    values: {
      context: "Set en festival, scène partagée avec d'autres artistes.",
      lighting: "Éclairage et écrans gérés par la régie du festival.\nMerci de prévoir un éclairage de cabine indépendant, indispensable en fin de journée.",
      staff: "Un technicien dédié à la cabine DJ pour le changement de plateau.\nChangement de plateau de 15 minutes maximum entre deux artistes.",
      hospitality: "Accès aux loges artistes et au catering.\nEau plate en cabine (4 bouteilles 50 cl).\nRepas chaud si présence sur site supérieure à 4 heures.",
      travel: "Transport pris en charge selon accord contractuel.\nNavette ou parking artiste à moins de 300 m de la scène.",
      lodging: "Hébergement la nuit du set, chambre individuelle, si le retour n'est pas possible le soir même.",
      guests: "2 pass artiste (accompagnant / technicien).",
      recording: "Captation audio ou vidéo du set : accord écrit préalable de l'artiste requis, avec fourniture d'une copie du fichier.",
    },
  },
  prive: {
    label: 'Mariage / privé',
    values: {
      context: "Prestation privée : cérémonie, cocktail puis soirée dansante.",
      lighting: "Éclairage d'ambiance et de piste apporté par l'artiste, sauf mention contraire.\nUn éclairage de salle réglable est nécessaire en fin de soirée.",
      staff: "Aucun personnel technique requis. Un interlocuteur unique doit être désigné pour la soirée.",
      hospitality: "Repas chaud assis pour l'artiste (et son assistant le cas échéant), servi avant le début de la soirée dansante.\nEau plate et boissons non alcoolisées à disposition tout au long de la prestation.",
      travel: "Frais de déplacement calculés depuis la ville de départ de l'artiste, aller-retour.\nAccès véhicule pour le déchargement à proximité immédiate du lieu de jeu.",
      lodging: "Hébergement à la charge de l'organisateur si le lieu se situe à plus de 150 km ou si la prestation se termine après 2 h.",
      guests: "Sans objet.",
    },
  },
  bar: {
    label: 'Bar / restaurant',
    values: {
      context: "Set d'ambiance en bar ou restaurant, volume modéré.",
      lighting: "Éclairage existant du lieu, aucun besoin particulier.",
      staff: "Aucun personnel technique requis.",
      hospitality: "Boissons non alcoolisées offertes pendant la prestation.\nRepas si la prestation dépasse 4 heures.",
      travel: "Frais de déplacement selon accord.",
      lodging: "Sans objet.",
      guests: "1 invitation.",
    },
  },
};

const DEFAULTS = {
  preset: 'club',
  context: PRESETS.club.values.context,
  eventDate: '',
  setDuration: '2 heures',
  setTime: '',

  includeLighting: true,
  includeHospitality: true,
  includeTravel: true,
  includeSecurity: true,
  includeRecording: true,
  includeSignature: false,
  includePerformers: true,
  includeInputList: true,
  includePatch: true,
  patchPlanId: '',

  pa: "Système de diffusion professionnel adapté à la jauge (L-Acoustics, d&b, Funktion-One, Void ou équivalent).\nSystème calé, vérifié et fonctionnel avant l'arrivée de l'artiste.\nSubwoofers en phase avec la façade.",
  soundLimit: "En présence d'un limiteur, merci d'en préciser le seuil et le fonctionnement au moins 7 jours avant la date.\nUn limiteur mal réglé coupant la diffusion en pleine soirée n'est pas de la responsabilité de l'artiste.",

  players: "2 × Pioneer CDJ-3000 (ou CDJ-2000NXS2), reliés en PRO DJ LINK, firmware à jour.",
  mixer: "1 × Pioneer DJM-A9 (ou DJM-900NXS2 / Xone:96).\nToutes les voies, faders et EQ testés le jour même.",
  alternatives: "Denon SC6000 + X1850 accepté sur information préalable.\nTout autre matériel doit être validé au moins 7 jours avant la date.",
  ownGear: "Clés USB (×2), casque, adaptateurs.",

  boothTable: "Cabine stable de 150 × 80 cm minimum, hauteur 100 cm, désolidarisée du système de diffusion.\nEspace de circulation derrière la cabine.",
  boothMonitor: "2 × moniteurs de cabine sur pied, à hauteur d'oreille, niveau réglable indépendamment de la façade.",
  boothLight: "Éclairage de cabine indépendant, variable, orienté sur le matériel.",
  power: "4 × prises 230 V / 16 A avec terre en cabine, sur un circuit stable et distinct de celui des cuisines.",

  lighting: PRESETS.club.values.lighting,
  staff: PRESETS.club.values.staff,

  arrival: "1 heure avant le début du set",
  setupTime: "30 minutes",
  soundcheck: "30 minutes, avant l'ouverture des portes",

  hospitality: PRESETS.club.values.hospitality,
  dietary: "",
  guests: PRESETS.club.values.guests,

  travel: PRESETS.club.values.travel,
  lodging: PRESETS.club.values.lodging,
  parking: "Un emplacement de stationnement gratuit à proximité immédiate, ou remboursement du parking le plus proche.",

  security: "Accès à la cabine réservé à l'artiste et au personnel technique.\nAucune boisson posée sur le matériel.\nMachine à fumée et confettis tenus à l'écart de la cabine.",
  recording: "Toute captation audio ou vidéo destinée à une diffusion publique nécessite l'accord écrit préalable de l'artiste.\nUne copie du fichier sera fournie à l'artiste.",

  terms: "Ce rider fait partie intégrante du contrat d'engagement.\nToute impossibilité de respecter un point doit être signalée au moins 7 jours avant la date afin de trouver ensemble une solution.\nEn l'absence de retour, les éléments décrits sont considérés comme acceptés.",
  version: new Date().toISOString().slice(0, 10),
};

const buildSchema = () => [
  { type: 'section', label: 'Cadre de la prestation' },
  { name: 'preset', label: 'Type de date', type: 'select', options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), width: 'full' },
  { name: 'context', label: 'Contexte', type: 'textarea', rows: 2, width: 'full' },
  { name: 'eventDate', label: 'Date de l’événement', type: 'date' },
  { name: 'setTime', label: 'Horaire du set', placeholder: '23 h 00 – 01 h 00' },
  { name: 'setDuration', label: 'Durée' },
  { name: 'version', label: 'Version du rider', type: 'date' },

  { type: 'section', label: 'Sections à inclure', hint: 'Décochez ce qui ne s’applique pas : le document s’adapte.' },
  { name: 'includeLighting', label: 'Éclairage et effets', type: 'checkbox' },
  { name: 'includeHospitality', label: 'Loges et restauration', type: 'checkbox' },
  { name: 'includeTravel', label: 'Transport et hébergement', type: 'checkbox' },
  { name: 'includeSecurity', label: 'Sécurité et accès', type: 'checkbox' },
  { name: 'includeRecording', label: 'Captation et diffusion', type: 'checkbox' },
  { name: 'includeSignature', label: 'Bloc de signatures', type: 'checkbox' },
  { name: 'includePerformers', label: 'Performeurs', type: 'checkbox' },
  { name: 'includeInputList', label: 'Liste des lignes (patch list)', type: 'checkbox' },
  { name: 'includePatch', label: 'Plan de câblage', type: 'checkbox' },
  { name: 'patchPlanId', label: 'Plan à joindre', type: 'select', options: riderPlanOptions(), width: 'full' },

  { type: 'section', label: 'Diffusion façade' },
  { name: 'pa', label: 'Système', type: 'textarea', rows: 3, width: 'full' },
  { name: 'soundLimit', label: 'Limiteur / niveau sonore', type: 'textarea', rows: 3, width: 'full' },

  { type: 'section', label: 'Matériel DJ' },
  { name: 'players', label: 'Lecteurs / platines', type: 'textarea', rows: 3, width: 'full' },
  { name: 'mixer', label: 'Mixeur', type: 'textarea', rows: 3, width: 'full' },
  { name: 'alternatives', label: 'Alternatives acceptées', type: 'textarea', rows: 2, width: 'full' },
  { name: 'ownGear', label: 'Matériel apporté par l’artiste', type: 'textarea', rows: 2, width: 'full' },

  { type: 'section', label: 'Cabine' },
  { name: 'boothTable', label: 'Support et espace', type: 'textarea', rows: 3, width: 'full' },
  { name: 'boothMonitor', label: 'Retours de cabine', type: 'textarea', rows: 2, width: 'full' },
  { name: 'boothLight', label: 'Éclairage de cabine', type: 'textarea', rows: 2, width: 'full' },
  { name: 'power', label: 'Alimentation électrique', type: 'textarea', rows: 2, width: 'full' },

  { type: 'section', label: 'Éclairage et personnel' },
  { name: 'lighting', label: 'Éclairage et effets scéniques', type: 'textarea', rows: 3, width: 'full' },
  { name: 'staff', label: 'Personnel technique', type: 'textarea', rows: 3, width: 'full' },

  { type: 'section', label: 'Planning' },
  { name: 'arrival', label: 'Arrivée' },
  { name: 'setupTime', label: 'Installation' },
  { name: 'soundcheck', label: 'Balances' },

  { type: 'section', label: 'Loges et restauration' },
  { name: 'hospitality', label: 'Loges, boissons, repas', type: 'textarea', rows: 5, width: 'full' },
  { name: 'dietary', label: 'Régime alimentaire particulier', type: 'textarea', rows: 2, width: 'full', placeholder: 'Végétarien, allergies…' },
  { name: 'guests', label: 'Invitations / pass', type: 'textarea', rows: 2, width: 'full' },

  { type: 'section', label: 'Transport et hébergement' },
  { name: 'travel', label: 'Transport', type: 'textarea', rows: 3, width: 'full' },
  { name: 'lodging', label: 'Hébergement', type: 'textarea', rows: 3, width: 'full' },
  { name: 'parking', label: 'Stationnement', type: 'textarea', rows: 2, width: 'full' },

  { type: 'section', label: 'Sécurité et captation' },
  { name: 'security', label: 'Sécurité et accès', type: 'textarea', rows: 3, width: 'full' },
  { name: 'recording', label: 'Captation et diffusion', type: 'textarea', rows: 3, width: 'full' },

  { type: 'section', label: 'Conditions' },
  { name: 'terms', label: 'Conditions générales', type: 'textarea', rows: 4, width: 'full' },
];

/** Liste des plans enregistrés, pour le sélecteur. */
function riderPlanOptions() {
  const plans = allPlans();
  return [{ value: '', label: plans.length ? '— le plus récent —' : '— aucun plan enregistré —' },
    ...plans.map((p) => ({ value: p.id, label: p.name }))];
}

/* ------------------------------ Outil ------------------------------ */

export default function mount(el) {
  const profile = loadProfile();
  const data = { ...DEFAULTS, ...(store.load(KEY, {}) || {}) };

  const previewHost = h('div.doc-preview');
  let saveTimer = 0;

  if (!profile.artistName) {
    el.appendChild(h('div.card', null,
      h('p', { text: 'Votre profil artiste est vide : le rider sortira sans nom ni contact.' }),
      h('a.btn.btn-primary.btn-sm', { href: '#/profil', text: 'Compléter mon profil' })
    ));
  }

  const onFieldChange = (name) => {
    if (name === 'preset') { applyPreset(data.preset); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.save(KEY, data), 350);
    renderPreview();
  };

  let form = buildForm(buildSchema(), data, onFieldChange);
  const formCard = h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Contenu du rider' })),
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
      on: { click: () => printDocument(buildRider(loadProfile(), data), `Rider - ${profile.artistName || 'DJ'}`) },
    }),
    h('button.btn.btn-sm', {
      type: 'button', text: 'Exporter (.json)',
      on: { click: () => downloadJSON(`rider-${slugify(profile.artistName, 'dj')}.json`, { type: 'rider', data }) },
    }),
    h('button.btn.btn-sm', {
      type: 'button', text: 'Importer',
      on: {
        click: async () => {
          const file = await pickFile('application/json,.json');
          if (!file) return;
          try {
            Object.assign(data, JSON.parse(await readText(file)).data || {});
            store.save(KEY, data);
            toastOk('Rider importé');
            location.reload();
          } catch { toastErr('Fichier illisible'); }
        },
      },
    }),
    h('button.btn.btn-sm.btn-danger', {
      type: 'button', text: 'Réinitialiser',
      on: {
        click: async () => {
          if (!(await confirmDialog('Revenir au contenu par défaut ? Vos modifications seront perdues.', { title: 'Réinitialiser le rider', okLabel: 'Réinitialiser', danger: true }))) return;
          store.remove(KEY);
          location.reload();
        },
      },
    })
  ));

  renderPreview();

  function applyPreset(id) {
    const preset = PRESETS[id];
    if (!preset) return;
    Object.assign(data, preset.values);
    store.save(KEY, data);
    const fresh = buildForm(buildSchema(), data, onFieldChange);
    formCard.replaceChild(fresh, form);
    form = fresh;
    renderPreview();
  }

  function renderPreview() {
    clear(previewHost);
    const doc = h('div.doc');
    doc.innerHTML = buildRider(loadProfile(), data);
    previewHost.appendChild(doc);
  }

  return () => {
    clearTimeout(saveTimer);
    store.save(KEY, data);
  };
}

/* ------------------------ Génération du document ------------------------ */

export function buildRider(profile, d) {
  const parts = [];

  parts.push(documentHeader(profile, 'Rider technique et d’accueil', profile.artistName));

  parts.push(section('Prestation', [
    kvGrid([
      ['Contexte', d.context],
      ['Date', formatDate(d.eventDate)],
      ['Horaire', d.setTime],
      ['Durée', d.setDuration],
      ['Arrivée', d.arrival],
      ['Installation', d.setupTime],
      ['Balances', d.soundcheck],
    ]),
  ].join('')));

  parts.push(section('Diffusion façade', [
    subBlock('Système', d.pa),
    subBlock('Niveau sonore et limiteur', d.soundLimit),
  ].join('')));

  parts.push(section('Matériel DJ', [
    subBlock('Lecteurs / platines', d.players),
    subBlock('Mixeur', d.mixer),
    subBlock('Alternatives acceptées', d.alternatives),
    subBlock('Apporté par l’artiste', d.ownGear),
  ].join('')));

  parts.push(section('Cabine', [
    subBlock('Support et espace', d.boothTable),
    subBlock('Retours', d.boothMonitor),
    subBlock('Éclairage', d.boothLight),
    subBlock('Électricité', d.power),
  ].join('')));

  if (d.includeLighting) parts.push(section('Éclairage et effets', bulletList(d.lighting)));

  parts.push(section('Personnel technique', bulletList(d.staff)));

  const performers = allPerformers();
  if (d.includePerformers) parts.push(performersSection(performers));
  if (d.includeInputList) parts.push(inputListSection(performers, { djLabel: profile.artistName || 'Cabine DJ' }));

  if (d.includePatch) {
    const plans = allPlans();
    const plan = plans.find((pl) => pl.id === d.patchPlanId) || plans[0];
    parts.push(patchSection(plan));
  }

  if (d.includeHospitality) {
    parts.push(section('Loges et restauration', [
      bulletList(d.hospitality),
      subBlock('Régime alimentaire', d.dietary),
      subBlock('Invitations', d.guests),
    ].join(''), { breakBefore: true }));
  }

  if (d.includeTravel) {
    parts.push(section('Transport et hébergement', [
      subBlock('Transport', d.travel),
      subBlock('Hébergement', d.lodging),
      subBlock('Stationnement', d.parking),
    ].join('')));
  }

  if (d.includeSecurity) parts.push(section('Sécurité et accès', bulletList(d.security)));
  if (d.includeRecording) parts.push(section('Captation et diffusion', bulletList(d.recording)));

  parts.push(section('Conditions', note(d.terms)));
  parts.push(contactSection(profile));

  if (d.includeSignature) parts.push(signatures());

  parts.push(`<div class="doc-foot">
    Rider ${escapeHtml(profile.artistName || '')}${d.version ? ` — version du ${formatDate(d.version)}` : ''}.
    Ce document remplace toute version antérieure et fait partie intégrante du contrat. Généré avec DJ Pool Tech.
  </div>`);

  return parts.filter(Boolean).join('\n');
}
