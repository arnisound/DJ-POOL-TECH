/** Utilitaires de texte partagés par les documents et les exports. */

/** Échappe une chaîne destinée à être injectée dans du HTML. */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * Transforme un texte multiligne en liste à puces HTML.
 * Les tirets ou puces déjà saisis en début de ligne sont retirés.
 */
export function bulletList(text) {
  const items = String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  return items.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '';
}

/** Nom de fichier propre : sans accent, sans espace, en minuscules. */
export function slugify(s, fallback = 'document') {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

/**
 * Nombre formaté à la française : virgule décimale, espace insécable
 * pour les milliers. À l'affichage uniquement — les exports CSV et JSON
 * conservent le point décimal, plus interopérable.
 */
export function fmtNum(value, digits = 1) {
  const n = Number(value);
  if (!isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Nombre signé, toujours précédé de son signe (+2,4 / −1,8). */
export function fmtSigned(value, digits = 1) {
  const n = Number(value);
  if (!isFinite(n)) return '—';
  return (n >= 0 ? '+' : '−') + fmtNum(Math.abs(n), digits);
}

/** Sérialise un tableau de lignes en CSV compatible Excel (séparateur « ; »). */
export function toCsv(rows) {
  return rows
    .map((cols) => cols.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
}

/** Marque d'ordre des octets : sans elle, Excel casse les accents. */
export const BOM = '﻿';
