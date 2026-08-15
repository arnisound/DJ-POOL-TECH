/**
 * Document « plan de cabine » — une page, dans la forme des riders
 * professionnels : un encadré de titre, la liste de ce que l'organisateur
 * doit fournir, celle de ce que l'artiste apporte, puis le plan de cabine.
 *
 * C'est la page que l'on envoie en pièce jointe et que le régisseur imprime
 * pour la poser sur la table de la cabine.
 */
import { escapeHtml } from './text.js';
import { providedLists, stagePlotToPrintSVG } from './stageplot.js';
import { GEAR_MAP } from './gear.js';
import { cableList } from './patch.js';
import { section } from './doc.js';

/** Une ligne de la liste « doit fournir », dans le style du rider de référence. */
function provideItem(entry) {
  return `<li><b>${entry.count} ×</b> <b>${escapeHtml(entry.label)}</b>${
    entry.req ? ` <span class="doc-soft">${escapeHtml(entry.req)}</span>` : ''
  }</li>`;
}

/**
 * Page complète.
 * @param {object} profile profil artiste
 * @param {object} plan plan de câblage
 * @param {object} opts
 * @param {string}   [opts.title]
 * @param {string[]} [opts.extras] exigences libres ajoutées à la liste
 * @param {boolean}  [opts.withCables]
 */
export function boothDocument(profile, plan, opts = {}) {
  const {
    title = `${profile.artistName || 'Artiste'} — Rider technique`,
    extras = [],
    withCables = false,
  } = opts;

  const { promoter, artist } = providedLists(plan);

  const promoterList = promoter.length || extras.length
    ? `<ul class="doc-provide">
        ${promoter.map(provideItem).join('')}
        ${extras.filter(Boolean).map((e) => `<li><b>${escapeHtml(e)}</b></li>`).join('')}
      </ul>`
    : '<p class="doc-soft">Aucun matériel demandé à l’organisateur.</p>';

  const artistList = artist.length
    ? `<ul class="doc-provide">${artist.map(provideItem).join('')}</ul>`
    : '';

  const cables = withCables
    ? cableList(plan).map((c) => `<li>${c.count} × ${escapeHtml(c.label)}${c.length ? ` — ${c.length} m` : ''}</li>`).join('')
    : '';

  return `
    <div class="doc-titlebox"><h1>${escapeHtml(title)}</h1></div>

    <div class="doc-section">
      <h2 class="doc-provide-head">L’organisateur doit fournir</h2>
      ${promoterList}
    </div>

    ${artistList ? `<div class="doc-section">
      <h2>L’artiste apporte</h2>
      ${artistList}
    </div>` : ''}

    ${cables ? `<div class="doc-section"><h2>Câbles à prévoir</h2><ul>${cables}</ul></div>` : ''}

    <div class="doc-section doc-stage">
      <div style="text-align:center">${stagePlotToPrintSVG(plan, 165, { djLabel: profile.artistName || 'DJ' })}</div>
    </div>

    <div class="doc-foot">
      Plan de cabine ${escapeHtml(profile.artistName || '')} — ${new Date().toLocaleDateString('fr-FR')}.
      Toute impossibilité doit être signalée avant la date. Généré avec DJ Pool Tech.
    </div>`;
}

/** Version « section », pour insertion dans la fiche technique ou le rider. */
export function boothSection(plan, profile, { breakBefore = true } = {}) {
  if (!plan || !plan.nodes || !plan.nodes.length) return '';
  const { promoter } = providedLists(plan);

  const list = promoter.length
    ? `<ul class="doc-provide">${promoter.map(provideItem).join('')}</ul>`
    : '';

  return section('Plan de cabine', `
    ${list}
    <div style="text-align:center;margin-top:3mm">${stagePlotToPrintSVG(plan, 160, { djLabel: profile?.artistName || 'DJ' })}</div>
  `, { breakBefore });
}

/** Intitulé lisible d'un appareil du plan, pour les listes hors document. */
export function gearTitle(node) {
  const gear = GEAR_MAP[node.gearId];
  return node.label || (gear ? gear.label : 'Appareil');
}
