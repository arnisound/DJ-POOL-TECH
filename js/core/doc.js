/** Briques de mise en page communes aux documents imprimables. */
import { escapeHtml, bulletList } from './text.js';

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

export function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return String(iso); }
}
