/**
 * Tests du catalogue de matériel, des contrôles de câblage et du plan de
 * cabine : `node tests/gear.test.mjs`
 *
 * Ces modules décrivent du matériel réel : une erreur de connectique se
 * retrouve telle quelle dans un rider envoyé à un organisateur.
 */
import { GEAR, GEAR_MAP, CONNECTORS, CATEGORIES, checkConnection, findPort, splitPorts } from '../js/core/gear.js';
import { PRESETS, validate, cableList, cableCount, addLink, emptyPlan, addNode } from '../js/core/patch.js';
import {
  layout, defaultSlot, providedLists, SLOTS,
  autoArrange, ensurePositions, stageState, nodeStageSize, visibleNodes, stageBounds, GRID,
} from '../js/core/stageplot.js';
import { SHAPES, shapeOf } from '../js/core/stage-shapes.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

/* ------------------------------------------------------------------ */

console.log('\nIntégrité du catalogue');
{
  const ids = GEAR.map((g) => g.id);
  check('aucun identifiant en double', new Set(ids).size === ids.length,
    ids.filter((v, i, a) => a.indexOf(v) !== i).join(', '));

  const badCategory = GEAR.filter((g) => !CATEGORIES[g.category]);
  check('toutes les catégories existent', badCategory.length === 0, badCategory.map((g) => g.id).join(', '));

  const badPorts = [];
  for (const gear of GEAR) {
    const seen = new Set();
    for (const port of gear.ports) {
      if (!CONNECTORS[port.type]) badPorts.push(`${gear.id}.${port.id} : type « ${port.type} » inconnu`);
      if (!['in', 'out', 'both'].includes(port.dir)) badPorts.push(`${gear.id}.${port.id} : sens « ${port.dir} » invalide`);
      if (!port.name) badPorts.push(`${gear.id}.${port.id} : sans libellé`);
      if (seen.has(port.id)) badPorts.push(`${gear.id} : port « ${port.id} » en double`);
      seen.add(port.id);
    }
  }
  check('tous les ports sont valides et uniques', badPorts.length === 0, badPorts.slice(0, 4).join(' ; '));

  const noOutput = GEAR.filter((g) =>
    !['sound', 'utility', 'video'].includes(g.category) && !g.ports.some((port) => port.dir === 'out'));
  check('chaque source possède au moins une sortie', noOutput.length === 0, noOutput.map((g) => g.id).join(', '));

  const mixers = GEAR.filter((g) => g.category === 'mixer');
  const noMaster = mixers.filter((g) => !g.ports.some((port) => /master|mix|main/i.test(port.id) && port.dir === 'out'));
  check('chaque mixeur possède une sortie générale', noMaster.length === 0, noMaster.map((g) => g.id).join(', '));

  // Une console de façade fait exception : elle alimente les retours par ses
  // départs auxiliaires, pas par une sortie cabine.
  const djMixers = mixers.filter((g) => g.id !== 'mixerlive');
  const noBooth = djMixers.filter((g) => !g.ports.some((port) => port.id === 'booth'));
  check('chaque mixeur DJ possède une sortie cabine', noBooth.length === 0, noBooth.map((g) => g.id).join(', '));
  check('la console de façade possède des départs auxiliaires',
    GEAR_MAP.mixerlive.ports.filter((port) => /^aux\d$/.test(port.id) && port.dir === 'out').length >= 2);

  check('le catalogue couvre au moins 50 appareils', GEAR.length >= 50, `${GEAR.length} appareils`);
}

console.log('\nConnectique de référence (relevée sur les documentations)');
{
  const a9 = GEAR_MAP.djma9;
  check('DJM-A9 : 4 entrées ligne', a9.ports.filter((p) => /^ch\d+line$/.test(p.id)).length === 4);
  check('DJM-A9 : 4 entrées phono', a9.ports.filter((p) => /^ch\d+phono$/.test(p.id)).length === 4);
  check('DJM-A9 : 4 entrées numériques coaxiales', a9.ports.filter((p) => /^ch\d+digital$/.test(p.id)).length === 4);
  check('DJM-A9 : MIC 1 avec alimentation fantôme', !!findPort('djma9', 'mic1')?.phantom);
  check('DJM-A9 : master XLR et master RCA', !!findPort('djma9', 'master1') && !!findPort('djma9', 'master2'));
  check('DJM-A9 : boucle send / return', !!findPort('djma9', 'send') && !!findPort('djma9', 'return'));
  check('DJM-A9 : deux sorties casque', a9.ports.filter((p) => /^phones/.test(p.id)).length === 2);

  check('DJM-900NXS2 : send en jack TS mono', findPort('djm900', 'send')?.type === 'jack63ts');
  check('DJM-900NXS2 : deux interfaces USB', GEAR_MAP.djm900.ports.filter((p) => p.type === 'usbB').length === 2);

  check('Xone:96 : quatre returns', GEAR_MAP.xone96.ports.filter((p) => /^ret\d$/.test(p.id)).length === 4);
  check('Xone:96 : insert master', !!findPort('xone96', 'insend') && !!findPort('xone96', 'inret'));

  check('XDJ-XZ : trois ports LINK', GEAR_MAP.xdjxz.ports.filter((p) => p.type === 'ethernet').length === 3);
  check('XDJ-XZ : entrée auxiliaire', !!findPort('xdjxz', 'aux'));

  check('CDJ-3000 : sortie numérique coaxiale', findPort('cdj3000', 'digital')?.type === 'spdif');
  check('X1850 : sortie MIDI', findPort('x1850', 'midiout')?.type === 'midi');
}

console.log('\nContrôles de branchement');
{
  const out = (type) => ({ type, dir: 'out' });
  const inp = (type) => ({ type, dir: 'in' });

  check('deux sorties sont refusées', !checkConnection(out('rca'), out('rca')).ok);
  check('RCA vers RCA passe', checkConnection(out('rca'), inp('rca')).level === 'ok');
  check('ligne vers phono avertit', checkConnection(out('rca'), inp('phono')).level === 'warn');
  check('phono vers ligne avertit', checkConnection(out('phono'), inp('rca')).level === 'warn');
  check('master vers entrée micro avertit', checkConnection(out('xlr'), inp('micxlr')).level === 'warn');
  check('micro vers entrée ligne avertit', checkConnection(out('micxlr'), inp('rca')).level === 'warn');
  check('XLR vers RCA demande un adaptateur', checkConnection(out('xlr'), inp('rca')).level === 'adapter');
  check('une embase combo accepte le XLR sans adaptateur', checkConnection(out('micxlr'), inp('combo')).level === 'ok');
  check('une embase combo accepte le jack sans adaptateur', checkConnection(out('jack63'), inp('combo')).level === 'ok');
  check('jack TS et TRS se raccordent', checkConnection(out('jack63ts'), inp('jack63')).level === 'ok');
  check('la puissance ne va pas dans une entrée ligne', !checkConnection(out('speakon'), inp('rca')).ok);
  check('le HDMI ne va pas dans une entrée audio', !checkConnection(out('hdmi'), inp('xlr')).ok);
}

console.log('\nConfigurations types');
{
  for (const [id, preset] of Object.entries(PRESETS)) {
    const plan = preset.build();
    const issues = validate(plan);
    const errors = issues.filter((i) => i.level === 'error');
    const warns = issues.filter((i) => i.level === 'warn');
    check(
      `« ${preset.label} » se construit sans erreur ni avertissement`,
      errors.length === 0 && warns.length === 0,
      [...errors, ...warns].map((i) => i.message).join(' ; ')
    );
    check(`  ${id} : au moins une liaison et un appareil`, plan.links.length > 0 && plan.nodes.length > 1);
  }
}

console.log('\nComptage des câbles');
{
  const plan = emptyPlan('test');
  const mixer = addNode(plan, 'djm900');
  const foh = addNode(plan, 'foh');
  const cdj = addNode(plan, 'cdj3000');

  const xlr = addLink(plan, { node: mixer.id, port: 'master1' }, { node: foh.id, port: 'in' }, { length: 10 });
  check('la liaison master XLR est acceptée', xlr.ok);
  check('une paire XLR stéréo compte deux cordons', cableCount(plan, xlr.link) === 2);

  const rca = addLink(plan, { node: cdj.id, port: 'out' }, { node: mixer.id, port: 'ch1line' }, { length: 1 });
  check('un cordon RCA double compte pour un', cableCount(plan, rca.link) === 1);

  const list = cableList(plan);
  check('la liste regroupe par type et longueur', list.length === 2, JSON.stringify(list));

  const twice = addLink(plan, { node: cdj.id, port: 'out' }, { node: mixer.id, port: 'ch1line' });
  check('une liaison en double est refusée', !twice.ok);

  const second = addNode(plan, 'cdj3000');
  addLink(plan, { node: second.id, port: 'out' }, { node: mixer.id, port: 'ch1line' });
  const doubled = validate(plan).filter((i) => i.level === 'error');
  check('une entrée alimentée deux fois est signalée', doubled.length === 1, JSON.stringify(doubled));
}

console.log('\nPlan de cabine');
{
  const plan = PRESETS.club3hub.build();
  const slots = layout(plan);

  check('les lecteurs et le mixeur sont sur la table',
    slots.booth.length === 5, `${slots.booth.length} appareils sur la table`);
  check('le hub réseau est placé au-dessus', slots.above.some((n) => n.gearId === 'switch'));
  check('le micro est placé devant', slots.front.some((n) => n.gearId === 'micfil'));
  check('les retours de cabine sont dédoublés à gauche et à droite',
    slots.left.length === 1 && slots.right.length === 1);
  check('la façade n’est pas dessinée dans la cabine', slots.out.some((n) => n.gearId === 'foh'));

  check('emplacement par défaut d’une platine : la table', defaultSlot('tt1210') === 'booth');
  check('emplacement par défaut d’un praticable : devant', defaultSlot('riser') === 'front');
  check('tous les emplacements par défaut sont connus',
    GEAR.every((g) => SLOTS[defaultSlot(g.id)]),
    GEAR.filter((g) => !SLOTS[defaultSlot(g.id)]).map((g) => g.id).join(', '));

  // Un choix explicite prime sur la déduction.
  const laptop = plan.nodes.find((n) => n.gearId === 'laptop');
  laptop.slot = 'front';
  check('un emplacement choisi à la main est respecté',
    layout(plan).front.some((n) => n.id === laptop.id));

  const { promoter, artist } = providedLists(plan);
  check('les CDJ sont regroupés et comptés', promoter.some((e) => e.count === 3 && /CDJ-3000/.test(e.label)),
    JSON.stringify(promoter.map((e) => `${e.count}× ${e.label}`)));
  check('l’ordinateur est à la charge de l’artiste', artist.some((e) => /Ordinateur/.test(e.label)));
  check('les exigences courtes accompagnent le matériel', promoter.every((e) => typeof e.req === 'string'));

  // Un appareil peut changer de fournisseur.
  const mixerNode = plan.nodes.find((n) => n.gearId === 'djm900');
  mixerNode.provided = 'artist';
  check('le fournisseur peut être changé appareil par appareil',
    providedLists(plan).artist.some((e) => /DJM-900NXS2/.test(e.label)));
}

console.log('\nPositionnement libre');
{
  const plan = PRESETS.club3hub.build();
  autoArrange(plan);

  const placed = plan.nodes.every((n) => Number.isFinite(n.sx) && Number.isFinite(n.sy));
  check('le rangement automatique place tout le matériel', placed);
  check('les positions sont alignées sur la grille',
    plan.nodes.every((n) => n.sx % GRID === 0 && n.sy % GRID === 0));

  const booth = plan.nodes.filter((n) => (n.slot || defaultSlot(n.gearId)) === 'booth');
  const bottoms = booth.map((n) => n.sy + nodeStageSize(n).height);
  check('la rangée de cabine repose sur un même plan',
    Math.max(...bottoms) - Math.min(...bottoms) <= GRID, `écart de ${Math.max(...bottoms) - Math.min(...bottoms)}`);

  const stage = stageState(plan);
  check('la silhouette du DJ est positionnée', Number.isFinite(stage.dj?.x));

  // Une position choisie à la main survit à l'ajout d'un appareil.
  const mixer = plan.nodes.find((n) => n.gearId === 'djm900');
  mixer.sx = 777;
  mixer.sy = 333;
  const added = addNode(plan, 'recorder');
  ensurePositions(plan);
  check('une position manuelle n’est pas écrasée', mixer.sx === 777 && mixer.sy === 333);
  check('un appareil ajouté reçoit une position', Number.isFinite(added.sx) && Number.isFinite(added.sy));

  // Échelle et visibilité
  const cdj = plan.nodes.find((n) => n.gearId === 'cdj3000');
  const base = shapeOf('player');
  check('la taille par défaut suit le type d’appareil',
    nodeStageSize(cdj).width === base.w && nodeStageSize(cdj).height === base.h);
  cdj.scale = 1.5;
  check('l’échelle agrandit l’appareil', nodeStageSize(cdj).width === base.w * 1.5);

  const visibleBefore = visibleNodes(plan).length;
  cdj.hidden = true;
  check('un appareil masqué disparaît du plan', visibleNodes(plan).length === visibleBefore - 1);
  cdj.hidden = false;

  const box = stageBounds(plan);
  check('le cadrage englobe tout le contenu', box.width > 300 && box.height > 200,
    `${Math.round(box.width)} × ${Math.round(box.height)}`);

  // Le matériel hors cabine n'est pas dessiné.
  const foh = plan.nodes.find((n) => n.gearId === 'foh');
  check('la façade reste hors du plan de cabine', !visibleNodes(plan).some((n) => n.id === foh.id));

  check('chaque type de dessin a un encombrement', Object.values(SHAPES).every((s) => s.w > 0 && s.h > 0));
  const icons = new Set(GEAR.map((g) => g.icon));
  check('tous les dessins utilisés sont connus',
    [...icons].every((i) => SHAPES[i] || i === 'box'),
    [...icons].filter((i) => !SHAPES[i]).join(', '));
}

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).\n`);
process.exit(failed ? 1 : 0);
