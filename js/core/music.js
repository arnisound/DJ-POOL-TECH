/**
 * Théorie musicale appliquée au mix : noms de clefs, notation Camelot /
 * Open Key, compatibilité harmonique, transposition, pitch et tempo.
 *
 * Convention interne : une clef = { pc, mode }
 *   pc   : pitch class 0..11 (0 = Do / C)
 *   mode : 'maj' | 'min'
 */

export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTES_FR    = ['Do', 'Do#', 'Ré', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'];

/* --------------------------- Camelot / Open Key --------------------------- */

/** Numéro Camelot (1..12) d'une clef. */
export function camelotNumber(pc, mode) {
  const n = mode === 'min' ? (pc * 7 + 5) % 12 : (pc * 7 + 8) % 12;
  return n === 0 ? 12 : n;
}

/** Code Camelot complet, ex. "8A". */
export function toCamelot(pc, mode) {
  return camelotNumber(pc, mode) + (mode === 'min' ? 'A' : 'B');
}

/** Parse "8A", "12b", "5 A" → { pc, mode, num, letter } ou null. */
export function parseCamelot(code) {
  const m = /^\s*(\d{1,2})\s*([ABab])\s*$/.exec(String(code || ''));
  if (!m) return null;
  const num = Number(m[1]);
  if (num < 1 || num > 12) return null;
  const letter = m[2].toUpperCase();
  const mode = letter === 'A' ? 'min' : 'maj';
  const pc = ((7 * (num - (mode === 'min' ? 5 : 8))) % 12 + 12) % 12;
  return { pc, mode, num, letter };
}

/** Notation Open Key, ex. "1m" (La mineur) ou "1d" (Do majeur). */
export function toOpenKey(pc, mode) {
  const n = ((camelotNumber(pc, mode) - 8) % 12 + 12) % 12 + 1;
  return n + (mode === 'min' ? 'm' : 'd');
}

/* ------------------------------- Libellés ------------------------------- */

/**
 * Libellé d'une clef.
 * @param {'camelot'|'openkey'|'standard'|'fr'|'full'} notation
 */
export function keyLabel(pc, mode, notation = 'camelot') {
  switch (notation) {
    case 'openkey':  return toOpenKey(pc, mode);
    case 'standard': return NOTES_SHARP[pc] + (mode === 'min' ? 'm' : '');
    case 'fr':       return NOTES_FR[pc] + (mode === 'min' ? ' mineur' : ' majeur');
    case 'full':     return `${toCamelot(pc, mode)} · ${NOTES_SHARP[pc]}${mode === 'min' ? 'm' : ''} (${NOTES_FR[pc]} ${mode === 'min' ? 'mineur' : 'majeur'})`;
    default:         return toCamelot(pc, mode);
  }
}

/** Les 24 clefs, utile pour peupler un <select>. */
export function allKeys(notation = 'camelot') {
  const out = [];
  for (let num = 1; num <= 12; num++) {
    for (const mode of ['min', 'maj']) {
      const k = parseCamelot(num + (mode === 'min' ? 'A' : 'B'));
      out.push({ ...k, code: toCamelot(k.pc, k.mode), label: keyLabel(k.pc, k.mode, notation) });
    }
  }
  return out;
}

/* --------------------------- Compatibilité --------------------------- */

const wrap12 = (n) => ((n - 1) % 12 + 12) % 12 + 1;

/**
 * Voisinage harmonique d'un code Camelot.
 * @returns {{perfect:string, up:string, down:string, relative:string, boost:string, diagonal:string}}
 */
export function neighbours(code) {
  const k = parseCamelot(code);
  if (!k) return null;
  const other = k.letter === 'A' ? 'B' : 'A';
  return {
    perfect:  k.num + k.letter,
    up:       wrap12(k.num + 1) + k.letter,
    down:     wrap12(k.num - 1) + k.letter,
    relative: k.num + other,
    boost:    wrap12(k.num + 7) + k.letter,
    diagonal: (k.letter === 'A' ? wrap12(k.num + 1) : wrap12(k.num - 1)) + other,
  };
}

/**
 * Évalue l'enchaînement entre deux clefs Camelot.
 * @returns {{score:number, level:'parfait'|'excellent'|'bon'|'risqué'|'à éviter', label:string}}
 */
export function keyCompatibility(fromCode, toCode) {
  const a = parseCamelot(fromCode);
  const b = parseCamelot(toCode);
  if (!a || !b) return { score: 0, level: 'inconnu', label: 'Clef inconnue' };

  const n = neighbours(fromCode);
  if (toCode === n.perfect)  return { score: 100, level: 'parfait',   label: 'Même clef' };
  if (toCode === n.relative) return { score: 92,  level: 'excellent', label: a.letter === 'A' ? 'Relatif majeur' : 'Relatif mineur' };
  if (toCode === n.up)       return { score: 90,  level: 'excellent', label: '+1 — quinte, monte l’énergie' };
  if (toCode === n.down)     return { score: 88,  level: 'excellent', label: '−1 — quarte, adoucit' };
  if (toCode === n.boost)    return { score: 72,  level: 'bon',       label: '+7 — boost d’énergie (+1 ton)' };
  if (toCode === n.diagonal) return { score: 68,  level: 'bon',       label: 'Diagonale — changement de couleur' };

  const dist = Math.min(Math.abs(a.num - b.num), 12 - Math.abs(a.num - b.num));
  if (dist === 2) return { score: 45, level: 'risqué', label: `${dist} pas sur la roue — à tester à l’oreille` };
  return { score: 18, level: 'à éviter', label: `${dist} pas sur la roue — dissonance probable` };
}

/** Transpose une clef Camelot de n demi-tons. */
export function transposeCamelot(code, semitones) {
  const k = parseCamelot(code);
  if (!k) return null;
  const pc = ((k.pc + Math.round(semitones)) % 12 + 12) % 12;
  return toCamelot(pc, k.mode);
}

/* ------------------------------ Pitch / BPM ------------------------------ */

/** Pourcentage de pitch nécessaire pour passer de `from` à `to` BPM. */
export function pitchPercent(fromBpm, toBpm) {
  if (!fromBpm) return 0;
  return (toBpm / fromBpm - 1) * 100;
}

/** BPM obtenu en appliquant un pitch de `percent` %. */
export function bpmAtPitch(bpm, percent) {
  return bpm * (1 + percent / 100);
}

/** Demi-tons correspondant à un pitch en % (platine sans master tempo). */
export function semitonesFromPercent(percent) {
  return 12 * Math.log2(1 + percent / 100);
}

/** Pitch en % correspondant à un décalage en demi-tons. */
export function percentFromSemitones(semitones) {
  return (Math.pow(2, semitones / 12) - 1) * 100;
}

/** Écart de tempo en %, valeur absolue. */
export function tempoDelta(a, b) {
  if (!a || !b) return 0;
  return Math.abs(b - a) / a * 100;
}

/** Durée d'une phrase de n mesures, en secondes. */
export function phraseSeconds(bars, bpm) {
  return bars * 4 * 60 / bpm;
}

/* ------------------------------ Formatage ------------------------------ */

export function fmtDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Parse "3:45", "3.45", "225" (secondes) → secondes. */
export function parseDuration(txt) {
  const s = String(txt || '').trim();
  if (!s) return 0;
  const m = /^(\d+)\s*[:.']\s*(\d{1,2})$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s.replace(',', '.'));
  return isFinite(n) ? n : 0;
}
