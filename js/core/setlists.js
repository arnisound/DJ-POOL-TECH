/** Modèle partagé des setlists (utilisé par l'analyseur et l'outil Setlist). */
import * as store from './store.js';

const KEY = 'setlists';

export function all() {
  const list = store.load(KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveAll(list) {
  store.save(KEY, list);
  return list;
}

export function create(name = 'Nouveau set') {
  const set = {
    id: store.uid(),
    name,
    venue: '',
    date: '',
    notes: '',
    tracks: [],
    updatedAt: Date.now(),
  };
  saveAll([set, ...all()]);
  return set;
}

export function get(id) {
  return all().find((s) => s.id === id) || null;
}

export function update(id, partial) {
  const list = all();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...partial, updatedAt: Date.now() };
  // La setlist modifiée remonte en tête.
  const [set] = list.splice(i, 1);
  saveAll([set, ...list]);
  return set;
}

export function remove(id) {
  saveAll(all().filter((s) => s.id !== id));
}

export function emptyTrack(partial = {}) {
  return {
    id: store.uid(),
    title: '',
    artist: '',
    bpm: null,
    key: '',
    duration: 0,
    energy: 3,
    notes: '',
    ...partial,
  };
}

/** Ajoute un titre à la setlist courante (créée au besoin). */
export function addTrack(track, setId = null) {
  let set = setId ? get(setId) : all()[0];
  if (!set) set = create('Set en cours');
  const tracks = [...(set.tracks || []), emptyTrack(track)];
  return update(set.id, { tracks });
}

/** Durée totale, en secondes. */
export function totalDuration(set) {
  return (set.tracks || []).reduce((s, t) => s + (Number(t.duration) || 0), 0);
}
