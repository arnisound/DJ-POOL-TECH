/**
 * Import de playlists depuis les logiciels DJ.
 *
 * Formats reconnus :
 *  - Rekordbox : export XML de la collection ou d'une playlist (.xml)
 *  - Traktor   : fichiers .nml (playlist ou collection)
 *  - Serato    : export CSV ou texte de l'historique
 *  - Engine DJ : export CSV ou texte d'une playlist
 *  - M3U / M3U8 : chemins de fichiers, titres déduits des noms
 *  - Tout tableau délimité : séparateur et colonnes détectés automatiquement
 *
 * Le format n'est pas demandé à l'utilisateur : il est reconnu au contenu.
 */
import { parseAnyKey, keyFromTraktorValue, parseDuration } from './music.js';
import { parseXML, findAll, find, children, attr } from './xml.js';

/* ------------------------------------------------------------------ *
 * Lecture du fichier (l'encodage varie selon les logiciels)
 * ------------------------------------------------------------------ */

/**
 * Décode un fichier en texte. Rekordbox exporte ses playlists en UTF-16LE :
 * lu en UTF-8, le contenu serait illisible.
 */
export async function readPlaylistFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer);
  }

  // Sans marque d'ordre : un octet nul sur deux trahit de l'UTF-16.
  const sample = bytes.subarray(0, Math.min(400, bytes.length));
  let zerosOdd = 0;
  for (let i = 1; i < sample.length; i += 2) if (sample[i] === 0) zerosOdd++;
  if (sample.length > 20 && zerosOdd > sample.length / 4) {
    return new TextDecoder('utf-16le').decode(buffer);
  }

  const utf8 = new TextDecoder('utf-8').decode(buffer);
  // Un caractère de remplacement signale un fichier Windows-1252.
  if (utf8.includes('�')) return new TextDecoder('windows-1252').decode(buffer);
  return utf8.replace(/^﻿/, '');
}

/* ------------------------------------------------------------------ *
 * Point d'entrée
 * ------------------------------------------------------------------ */

/**
 * @param {string} content contenu texte du fichier
 * @param {string} filename nom du fichier (sert d'indice et de nom par défaut)
 * @returns {{source:string, name:string, tracks:Array, warnings:Array<string>, columns:object}}
 */
export function parsePlaylist(content, filename = '') {
  const text = String(content || '').replace(/^﻿/, '');
  const head = text.slice(0, 4000);

  if (/<DJ_PLAYLISTS/i.test(head)) return parseRekordboxXML(text, filename);
  if (/<NML\b/i.test(head) || /<ENTRY\b[^>]*>\s*<LOCATION/i.test(head)) return parseTraktorNML(text, filename);
  if (/^\s*#EXTM3U/i.test(head) || /\.m3u8?$/i.test(filename)) return parseM3U(text, filename);
  if (/^\s*[[{]/.test(head)) return parseJSON(text, filename);
  return parseDelimited(text, filename);
}

const baseName = (filename) => String(filename || 'Playlist').replace(/\.[^.]+$/, '') || 'Playlist';

function emptyTrack() {
  return { title: '', artist: '', bpm: null, key: '', duration: 0, comment: '', album: '', genre: '', year: '' };
}

/* ------------------------------------------------------------------ *
 * Rekordbox (XML)
 * ------------------------------------------------------------------ */

function parseRekordboxXML(text, filename) {
  const warnings = [];
  const doc = parseXML(text);
  const collection = find(doc, 'COLLECTION');
  if (!collection) {
    return { source: 'Rekordbox', name: baseName(filename), tracks: [], warnings: ['Aucune section COLLECTION dans ce fichier.'], columns: {} };
  }

  // Table des morceaux, indexée par TrackID.
  const byId = new Map();
  for (const node of children(collection, 'TRACK')) {
    const track = {
      ...emptyTrack(),
      title: attr(node, 'Name'),
      artist: attr(node, 'Artist'),
      album: attr(node, 'Album'),
      genre: attr(node, 'Genre'),
      year: attr(node, 'Year'),
      bpm: toBpm(attr(node, 'AverageBpm')),
      key: parseAnyKey(attr(node, 'Tonality')),
      duration: Number(attr(node, 'TotalTime')) || 0,
      comment: attr(node, 'Comments'),
    };
    byId.set(attr(node, 'TrackID'), track);
  }

  // Playlists : on prend la plus fournie, sinon toute la collection.
  const playlistNodes = findAll(doc, 'NODE').filter((n) => attr(n, 'Type') === '1');
  let best = null;
  for (const node of playlistNodes) {
    const keys = children(node, 'TRACK').map((t) => attr(t, 'Key'));
    if (!keys.length) continue;
    if (!best || keys.length > best.keys.length) {
      best = { name: attr(node, 'Name') || baseName(filename), keys };
    }
  }

  let tracks;
  let name;
  if (best) {
    name = best.name;
    tracks = best.keys.map((k) => byId.get(k)).filter(Boolean);
    if (tracks.length < best.keys.length) {
      warnings.push(`${best.keys.length - tracks.length} titre(s) de la playlist sont absents de la collection exportée.`);
    }
  } else {
    name = baseName(filename);
    tracks = [...byId.values()];
  }

  const playlistCount = playlistNodes.filter((n) => children(n, 'TRACK').length).length;
  if (playlistCount > 1) {
    warnings.push(`Le fichier contient ${playlistCount} playlists ; la plus fournie a été retenue. Exportez une playlist seule pour choisir précisément.`);
  }

  return { source: 'Rekordbox', name, tracks, warnings, columns: { bpm: true, key: true, duration: true } };
}

/* ------------------------------------------------------------------ *
 * Traktor (NML)
 * ------------------------------------------------------------------ */

function parseTraktorNML(text, filename) {
  const warnings = [];
  const doc = parseXML(text);

  const tracks = [];
  for (const entry of findAll(doc, 'ENTRY')) {
    const info = find(entry, 'INFO');
    const tempo = find(entry, 'TEMPO');
    const musical = find(entry, 'MUSICAL_KEY');

    const key = musical
      ? keyFromTraktorValue(attr(musical, 'VALUE'))
      : parseAnyKey(attr(info, 'KEY'));

    const track = {
      ...emptyTrack(),
      title: attr(entry, 'TITLE'),
      artist: attr(entry, 'ARTIST'),
      album: attr(find(entry, 'ALBUM'), 'TITLE'),
      genre: attr(info, 'GENRE'),
      bpm: toBpm(attr(tempo, 'BPM')),
      key,
      duration: Math.round(Number(attr(info, 'PLAYTIME')) || 0),
      comment: attr(info, 'COMMENT'),
    };
    if (track.title || track.artist) tracks.push(track);
  }

  const playlistName = attr(findAll(doc, 'NODE').find((n) => attr(n, 'TYPE') === 'PLAYLIST'), 'NAME');

  if (!tracks.length) warnings.push('Aucune entrée trouvée dans ce fichier NML.');

  return {
    source: 'Traktor',
    name: playlistName || baseName(filename),
    tracks,
    warnings,
    columns: { bpm: true, key: true, duration: true },
  };
}

/* ------------------------------------------------------------------ *
 * M3U / M3U8
 * ------------------------------------------------------------------ */

function parseM3U(text, filename) {
  const tracks = [];
  const lines = text.split(/\r?\n/);
  let pending = null;

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;

    const ext = /^#EXTINF:(-?\d+(?:\.\d+)?)\s*,\s*(.*)$/.exec(l);
    if (ext) {
      const duration = Math.max(0, Math.round(Number(ext[1]) || 0));
      const [artist, title] = splitArtistTitle(ext[2]);
      pending = { ...emptyTrack(), artist, title, duration };
      continue;
    }
    if (l.startsWith('#')) continue;

    if (pending) {
      tracks.push(pending);
      pending = null;
    } else {
      const name = l.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
      const [artist, title] = splitArtistTitle(name);
      tracks.push({ ...emptyTrack(), artist, title });
    }
  }
  if (pending) tracks.push(pending);

  return {
    source: 'M3U',
    name: baseName(filename),
    tracks,
    warnings: ['Un fichier M3U ne contient ni tempo ni tonalité : analysez les morceaux pour les compléter.'],
    columns: { bpm: false, key: false, duration: true },
  };
}

/* ------------------------------------------------------------------ *
 * JSON (export DJ Pool Tech, ou tableau générique)
 * ------------------------------------------------------------------ */

function parseJSON(text, filename) {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : (data.tracks || data.data?.tracks || []);
    const tracks = list.map((t) => ({
      ...emptyTrack(),
      title: t.title || t.name || '',
      artist: t.artist || '',
      bpm: toBpm(t.bpm),
      key: parseAnyKey(t.key || t.camelot || ''),
      duration: typeof t.duration === 'number' ? t.duration : parseDuration(t.duration),
      comment: t.notes || t.comment || '',
    })).filter((t) => t.title || t.artist);

    return {
      source: 'JSON',
      name: (!Array.isArray(data) && (data.name || data.title)) || baseName(filename),
      tracks,
      warnings: [],
      columns: { bpm: true, key: true, duration: true },
    };
  } catch {
    return { source: 'JSON', name: baseName(filename), tracks: [], warnings: ['Fichier JSON illisible.'], columns: {} };
  }
}

/* ------------------------------------------------------------------ *
 * Tableaux délimités : Serato, Engine DJ, Rekordbox TXT, tableur
 * ------------------------------------------------------------------ */

/** Noms de colonnes rencontrés dans les exports, en plusieurs langues. */
const COLUMN_ALIASES = {
  title:    ['name', 'title', 'track title', 'track name', 'titre', 'song', 'trackname', 'track'],
  artist:   ['artist', 'artists', 'artiste', 'author', 'interprète', 'interprete', 'album artist'],
  bpm:      ['bpm', 'tempo', 'average bpm', 'averagebpm', 'track bpm'],
  key:      ['key', 'tonality', 'clé', 'clef', 'tonalité', 'tonalite', 'initial key', 'camelot', 'key result'],
  duration: ['time', 'length', 'duration', 'durée', 'duree', 'total time', 'totaltime', 'playtime'],
  album:    ['album', 'release'],
  genre:    ['genre', 'style'],
  year:     ['year', 'année', 'annee', 'date'],
  comment:  ['comment', 'comments', 'commentaire', 'notes', 'my tag'],
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^["']|["']$/g, '')
    .replace(/[#()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectDelimiter(lines) {
  const candidates = ['\t', ';', ',', '|'];
  let best = { delimiter: '\t', score: -1 };
  for (const delimiter of candidates) {
    const counts = lines.slice(0, 12).map((l) => splitLine(l, delimiter).length);
    if (!counts.length) continue;
    const max = Math.max(...counts);
    if (max < 2) continue;
    // On privilégie le séparateur qui donne le même nombre de colonnes partout.
    const consistent = counts.filter((c) => c === max).length;
    const score = consistent * 10 + max;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

/** Découpe une ligne en respectant les guillemets. */
function splitLine(line, delimiter) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim().replace(/^["']|["']$/g, '').trim());
}

function parseDelimited(text, filename) {
  const warnings = [];
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!rawLines.length) {
    return { source: 'Texte', name: baseName(filename), tracks: [], warnings: ['Fichier vide.'], columns: {} };
  }

  // Serato place le nom de la session sur la première ligne, avant l'en-tête.
  let lines = rawLines;
  let name = baseName(filename);
  const delimiter = detectDelimiter(lines);

  let headerIndex = lines.findIndex((l) => {
    const cells = splitLine(l, delimiter).map(normalizeHeader);
    return cells.some((c) => COLUMN_ALIASES.title.includes(c) || COLUMN_ALIASES.artist.includes(c));
  });

  if (headerIndex > 0) {
    const firstCells = splitLine(lines[0], delimiter).filter(Boolean);
    if (firstCells.length && firstCells[0].length < 80) name = firstCells[0];
  }
  if (headerIndex < 0) {
    warnings.push("Aucune ligne d'en-tête reconnue : les colonnes ont été devinées d'après leur contenu.");
    headerIndex = -1;
  }

  const columns = {};
  let dataLines;

  if (headerIndex >= 0) {
    const header = splitLine(lines[headerIndex], delimiter).map(normalizeHeader);
    header.forEach((cell, i) => {
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (columns[field] === undefined && aliases.includes(cell)) columns[field] = i;
      }
    });
    dataLines = lines.slice(headerIndex + 1);
  } else {
    dataLines = lines;
    Object.assign(columns, guessColumns(dataLines.map((l) => splitLine(l, delimiter))));
  }

  const tracks = [];
  for (const line of dataLines) {
    const cells = splitLine(line, delimiter);
    if (!cells.length || cells.every((c) => !c)) continue;

    const track = {
      ...emptyTrack(),
      title: pick(cells, columns.title),
      artist: pick(cells, columns.artist),
      album: pick(cells, columns.album),
      genre: pick(cells, columns.genre),
      year: pick(cells, columns.year),
      comment: pick(cells, columns.comment),
      bpm: toBpm(pick(cells, columns.bpm)),
      key: parseAnyKey(pick(cells, columns.key)),
      duration: parseDuration(pick(cells, columns.duration)),
    };

    // Beaucoup d'exports mettent « Artiste - Titre » dans une seule colonne.
    if (track.title && !track.artist && /\s+-\s+/.test(track.title)) {
      const [artist, title] = splitArtistTitle(track.title);
      track.artist = artist;
      track.title = title;
    }
    if (!track.title && !track.artist) continue;
    tracks.push(track);
  }

  const source = /engine/i.test(filename) ? 'Engine DJ'
    : /serato|history/i.test(filename) ? 'Serato'
    : delimiter === '\t' ? 'Texte (tabulations)'
    : 'CSV';

  if (columns.key === undefined) warnings.push('Aucune colonne de tonalité repérée.');
  if (columns.bpm === undefined) warnings.push('Aucune colonne de tempo repérée.');

  return { source, name, tracks, warnings, columns: {
    bpm: columns.bpm !== undefined, key: columns.key !== undefined, duration: columns.duration !== undefined,
  } };
}

/** Sans en-tête : on devine les colonnes d'après le contenu des cellules. */
function guessColumns(rows) {
  const columns = {};
  const width = Math.max(...rows.map((r) => r.length));
  for (let i = 0; i < width; i++) {
    const values = rows.map((r) => r[i] || '').filter(Boolean);
    if (!values.length) continue;

    const numericBpm = values.filter((v) => {
      const n = Number(String(v).replace(',', '.'));
      return isFinite(n) && n >= 50 && n <= 220;
    }).length;
    const keyish = values.filter((v) => parseAnyKey(v)).length;
    const timeish = values.filter((v) => /^\d{1,2}:\d{2}$/.test(v)).length;

    if (columns.bpm === undefined && numericBpm > values.length * 0.7) { columns.bpm = i; continue; }
    if (columns.key === undefined && keyish > values.length * 0.7) { columns.key = i; continue; }
    if (columns.duration === undefined && timeish > values.length * 0.7) { columns.duration = i; continue; }
    if (columns.artist === undefined) { columns.artist = i; continue; }
    if (columns.title === undefined) { columns.title = i; }
  }
  return columns;
}

const pick = (cells, index) => (index === undefined ? '' : (cells[index] || '').trim());

/* ------------------------------------------------------------------ *
 * Utilitaires
 * ------------------------------------------------------------------ */

function toBpm(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.').replace(/[^\d.]/g, ''));
  if (!isFinite(n) || n <= 0) return null;
  // Certains exports stockent le tempo en millièmes (128000).
  const bpm = n > 1000 ? n / 1000 : n;
  return bpm >= 20 && bpm <= 300 ? Math.round(bpm * 10) / 10 : null;
}

/** « Artiste - Titre » → ['Artiste', 'Titre']. */
export function splitArtistTitle(value) {
  const s = String(value || '').trim();
  const parts = s.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' - ').trim()];
  return ['', s];
}

/** Résumé chiffré d'un import, pour l'aperçu. */
export function summarize(result) {
  const tracks = result.tracks || [];
  return {
    count: tracks.length,
    withBpm: tracks.filter((t) => t.bpm).length,
    withKey: tracks.filter((t) => t.key).length,
    withDuration: tracks.filter((t) => t.duration).length,
    totalDuration: tracks.reduce((s, t) => s + (t.duration || 0), 0),
  };
}
