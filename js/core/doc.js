/** Briques de mise en page communes aux documents imprimables. */
import { escapeHtml, bulletList } from './text.js';
import { CAPTURE, performerLabel, inputList, requirementSummary } from './performers.js';
import { planToPrintSVG, cableList, describeLink, nodeLabel } from './patch.js';
import { GEAR_MAP } from './gear.js';

/** Section titrée. Renvoie une chaîne vide si le contenu est vide. */
export function section(title, html, { breakBefore = false } = {}) {
  if (!html || !String(html).trim()) return '';
  return `<div class="doc-section${breakBefore ? ' break-before' : ''}"><h2>${escapeHtml(title)}</h2>${html}</div>`;
}

/** Sous-bloc titré avec liste à puces. */
export function subBlock(title, text) {
  const list = bulletList(text);
  if (!list) return '';
  return `<div style="margin-bottom:2mm"><b style="font-size:9pt">${escapeHtml(title)}</b>${list}</div>`;
}

/** Paire clé / valeur pour les grilles d'informations. */
export function kv(k, v) {
  return v ? `<div class="doc-kv"><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>` : '';
}

/** Grille de paires clé / valeur. */
export function kvGrid(pairs) {
  const html = pairs.map(([k, v]) => kv(k, v)).join('');
  return html.trim() ? `<div class="doc-grid">${html}</div>` : '';
}

/** Encadré mis en avant. */
export function note(text) {
  const list = bulletList(text);
  return text && String(text).trim() ? `<div class="doc-note">${list || escapeHtml(text)}</div>` : '';
}

/** Bloc de signatures pour les documents contractuels. */
export function signatures(leftLabel = 'L’artiste', rightLabel = 'L’organisateur') {
  return `<div class="doc-signature">
    <div><div class="line"></div><b>${escapeHtml(leftLabel)}</b><br><span style="font-size:8pt;color:#666">Nom, date et signature</span></div>
    <div><div class="line"></div><b>${escapeHtml(rightLabel)}</b><br><span style="font-size:8pt;color:#666">Nom, date et signature</span></div>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Sections partagées par la fiche technique et le rider
 * ------------------------------------------------------------------ */

/** Présentation des performeurs et de leurs besoins. */
export function performersSection(performers) {
  if (!performers || !performers.length) return '';

  const items = performers.map((p) => {
    const bits = [
      p.instrument,
      p.capture !== 'none' ? (p.micModel || CAPTURE[p.capture]) : null,
      p.phantom ? 'alimentation fantôme 48 V' : null,
      p.needsMonitor ? 'retour dédié' : null,
      p.needsStand ? 'pied de micro' : null,
      p.needsPower ? 'prise 230 V' : null,
      p.space ? `espace : ${p.space}` : null,
    ].filter(Boolean);
    return `<li><b>${escapeHtml(performerLabel(p))}</b> — ${escapeHtml(bits.join(' · '))}${
      p.notes ? `<br><span style="color:#666">${escapeHtml(p.notes)}</span>` : ''}</li>`;
  }).join('');

  const { needs } = requirementSummary(performers);
  const toProvide = needs.length
    ? `<div class="doc-note"><b>À fournir par l’organisateur :</b><ul>${
        needs.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
    : '';

  return section('Performeurs', `<ul>${items}</ul>${toProvide}`);
}

/** Liste des lignes (patch list). */
export function inputListSection(performers, { djLabel = 'Cabine DJ' } = {}) {
  if (!performers || !performers.length) return '';
  const rows = inputList(performers, { djLabel });
  if (!rows.length) return '';

  const body = rows.map((r) => `<tr>
    <td>${r.n}</td>
    <td>${escapeHtml(r.source)}</td>
    <td>${escapeHtml(CAPTURE[r.capture] || r.capture)}</td>
    <td>${escapeHtml(r.device)}</td>
    <td>${r.phantom ? '48 V' : ''}</td>
    <td>${r.stand ? 'oui' : ''}</td>
  </tr>`).join('');

  return section('Liste des lignes', `<table>
    <thead><tr><th>Voie</th><th>Source</th><th>Captation</th><th>Micro / DI</th><th>Fantôme</th><th>Pied</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`);
}

/** Schéma de câblage, matériel et câbles à prévoir. */
export function patchSection(plan, { withCables = true, breakBefore = true } = {}) {
  if (!plan || !plan.nodes || !plan.nodes.length) return '';

  const gear = plan.nodes.map((n) => {
    const g = GEAR_MAP[n.gearId];
    return `<li><b>${escapeHtml(nodeLabel(n))}</b>${g && g.note ? ` — ${escapeHtml(g.note)}` : ''}</li>`;
  }).join('');

  const links = plan.links.map((link) => {
    const d = describeLink(plan, link);
    return `<tr>
      <td>${escapeHtml(d.from)} · <span style="color:#666">${escapeHtml(d.fromPort)}</span></td>
      <td>${escapeHtml(d.to)} · <span style="color:#666">${escapeHtml(d.toPort)}</span></td>
      <td>${escapeHtml(d.cable)}</td>
      <td>${link.length ? `${link.length} m` : ''}</td>
    </tr>`;
  }).join('');

  const cables = withCables
    ? cableList(plan).map((c) => `<li>${c.count} × ${escapeHtml(c.label)}${c.length ? ` — ${c.length} m` : ''}</li>`).join('')
    : '';

  return section('Plan de câblage', `
    <div style="text-align:center;margin-bottom:3mm">${planToPrintSVG(plan)}</div>
    <div style="margin-bottom:2mm"><b style="font-size:9pt">Matériel</b><ul>${gear}</ul></div>
    ${links ? `<table>
      <thead><tr><th>Depuis</th><th>Vers</th><th>Câble</th><th>Longueur</th></tr></thead>
      <tbody>${links}</tbody>
    </table>` : ''}
    ${cables ? `<div style="margin-top:2mm"><b style="font-size:9pt">Câbles à prévoir</b><ul>${cables}</ul></div>` : ''}
  `, { breakBefore });
}

export function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return String(iso); }
}
