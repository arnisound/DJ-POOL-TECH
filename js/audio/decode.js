/**
 * Décodage d'un fichier audio vers un signal mono ré-échantillonné,
 * prêt pour l'analyse. Tout se passe dans le navigateur : aucun envoi.
 */

export const ANALYSIS_RATE = 22050;

const AC = window.AudioContext || window.webkitAudioContext;
const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

/** Formats couramment acceptés par les navigateurs. */
export const ACCEPTED_AUDIO = 'audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.aiff,.aif';

function decodeWithContext(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

/**
 * Décode un fichier et renvoie un signal mono.
 * @param {File|Blob} file
 * @param {object} opts
 * @param {number} [opts.rate=22050] fréquence d'échantillonnage d'analyse
 * @param {number} [opts.maxSeconds=180] longueur maximale analysée (extrait centré)
 * @returns {Promise<{samples:Float32Array, sampleRate:number, duration:number, analyzedFrom:number, analyzedDuration:number, channels:number, originalRate:number}>}
 */
export async function decodeAudioFile(file, { rate = ANALYSIS_RATE, maxSeconds = 180 } = {}) {
  if (!AC && !OAC) throw new Error("L'API Web Audio n'est pas disponible sur ce navigateur.");

  const raw = await file.arrayBuffer();
  let buffer = null;

  // Chemin rapide : le décodeur ré-échantillonne directement au débit d'analyse.
  if (OAC) {
    try {
      const ctx = new OAC(1, 128, rate);
      buffer = await decodeWithContext(ctx, raw.slice(0));
    } catch { buffer = null; }
  }
  if (!buffer) {
    const ctx = new AC();
    try {
      buffer = await decodeWithContext(ctx, raw.slice(0));
    } finally {
      if (ctx.close) ctx.close();
    }
  }
  if (!buffer) throw new Error('Format audio non reconnu par ce navigateur.');

  const duration = buffer.duration;
  const originalRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;

  // Extrait centré si le morceau est long : le cœur du titre est plus représentatif.
  let from = 0;
  let length = duration;
  if (maxSeconds && duration > maxSeconds) {
    from = (duration - maxSeconds) / 2;
    length = maxSeconds;
  }

  const samples = await toMono(buffer, rate, from, length);
  return {
    samples,
    sampleRate: rate,
    duration,
    analyzedFrom: from,
    analyzedDuration: Math.min(length, duration),
    channels,
    originalRate,
  };
}

/** Somme des canaux + ré-échantillonnage via un rendu hors-ligne. */
async function toMono(buffer, rate, from, length) {
  const frames = Math.max(1, Math.round(length * rate));
  if (!OAC) return sliceChannel(buffer, from, length);

  const ctx = new OAC(1, frames, rate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  // Un gain léger évite l'écrêtage lors du repliement stéréo → mono.
  const gain = ctx.createGain();
  gain.gain.value = buffer.numberOfChannels > 1 ? 0.7 : 1;
  src.connect(gain).connect(ctx.destination);
  src.start(0, from, length);

  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

/** Repli : extraction manuelle sans ré-échantillonnage. */
function sliceChannel(buffer, from, length) {
  const sr = buffer.sampleRate;
  const start = Math.floor(from * sr);
  const n = Math.min(buffer.length - start, Math.floor(length * sr));
  const out = new Float32Array(n);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += data[start + i];
  }
  if (buffer.numberOfChannels > 1) for (let i = 0; i < n; i++) out[i] /= buffer.numberOfChannels;
  return out;
}

/**
 * Enveloppe de crêtes pour l'affichage d'une forme d'onde.
 * @returns {Float32Array} `buckets` valeurs entre 0 et 1
 */
export function peaks(samples, buckets = 400) {
  const out = new Float32Array(buckets);
  const size = Math.max(1, Math.floor(samples.length / buckets));
  let max = 1e-9;
  for (let b = 0; b < buckets; b++) {
    const start = b * size;
    let peak = 0;
    for (let i = start, end = Math.min(start + size, samples.length); i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > peak) peak = v;
    }
    out[b] = peak;
    if (peak > max) max = peak;
  }
  for (let i = 0; i < buckets; i++) out[i] /= max;
  return out;
}
