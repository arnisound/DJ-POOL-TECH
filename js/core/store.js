/**
 * Persistance locale (localStorage) + sauvegarde / restauration globale.
 * Tout reste sur l'appareil de l'utilisateur : aucun envoi réseau.
 */

const PREFIX = 'djpt:';
const listeners = new Map();

function key(name) { return PREFIX + name; }

export function load(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return structuredCloneSafe(fallback);
    return JSON.parse(raw);
  } catch {
    return structuredCloneSafe(fallback);
  }
}

export function save(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch (e) {
    console.warn('Stockage indisponible ou plein', e);
    return false;
  }
  (listeners.get(name) || []).forEach((fn) => fn(value));
  return true;
}

export function remove(name) {
  localStorage.removeItem(key(name));
  (listeners.get(name) || []).forEach((fn) => fn(null));
}

export function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(fn);
  return () => {
    const arr = listeners.get(name) || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };
}

/** Fusionne une mise à jour partielle dans un objet stocké. */
export function patch(name, partial, fallback = {}) {
  const cur = load(name, fallback) || {};
  const next = { ...cur, ...partial };
  save(name, next);
  return next;
}

/** Liste toutes les clés de l'app. */
export function keys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
  }
  return out;
}

/** Export complet, pour sauvegarde dans un fichier .json. */
export function exportAll() {
  const data = {};
  for (const k of keys()) data[k] = load(k);
  return {
    app: 'dj-pool-tech',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Import d'une sauvegarde. `mode` : "merge" (défaut) ou "replace". */
export function importAll(payload, mode = 'merge') {
  if (!payload || payload.app !== 'dj-pool-tech' || typeof payload.data !== 'object') {
    throw new Error('Fichier de sauvegarde non reconnu.');
  }
  if (mode === 'replace') for (const k of keys()) remove(k);
  let n = 0;
  for (const [k, v] of Object.entries(payload.data)) { save(k, v); n++; }
  return n;
}

function structuredCloneSafe(v) {
  if (v === null || typeof v !== 'object') return v;
  try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); }
}

/** Identifiant court et unique pour les éléments de liste. */
export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
