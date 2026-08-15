/**
 * Analyse de tempo et de tonalité — fonctions pures (aucun accès au DOM),
 * exécutables dans un Web Worker comme sur le fil principal.
 *
 * Tempo : flux spectral → enveloppe d'attaques → autocorrélation en peigne
 *         → affinage à lag fractionnaire → détection de la phase des temps.
 * Clef  : chromagramme par sélection de pics (avec estimation du diapason)
 *         → corrélation avec des profils tonaux.
 */
import { FFT, hannWindow } from './fft.js';

/* ======================================================================
   Enveloppe d'attaques (onset strength)
   ====================================================================== */

/** Limite haute de la bande « grosse caisse », en hertz. */
const LOW_BAND_HZ = 220;

/**
 * Deux enveloppes sont produites :
 *  - `env`    : toute la bande, la plus fiable pour trouver la période ;
 *  - `envLow` : uniquement les basses, qui suivent la grosse caisse et
 *               donnent donc la bonne phase (sans quoi la grille se cale
 *               volontiers sur les charleys, à un demi-temps près).
 * @returns {{env: Float64Array, envLow: Float64Array, rate: number, hop: number, fftSize: number}}
 */
export function onsetEnvelope(samples, sampleRate, { fftSize = 1024, hop = 256 } = {}) {
  const fft = new FFT(fftSize);
  const win = hannWindow(fftSize);
  const bins = fftSize / 2;
  const frames = Math.max(1, Math.floor((samples.length - fftSize) / hop) + 1);

  const env = new Float64Array(frames);
  const envLow = new Float64Array(frames);
  const prev = new Float64Array(bins);
  const buf = new Float64Array(fftSize);

  const lowMax = Math.max(2, Math.min(bins - 1, Math.round((LOW_BAND_HZ * fftSize) / sampleRate)));

  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < fftSize; i++) buf[i] = samples[off + i] * win[i];
    const mag = fft.magnitudes(buf);

    let flux = 0;
    let fluxLow = 0;
    for (let i = 1; i < bins; i++) {
      const m = Math.log1p(500 * mag[i]);   // compression logarithmique
      const d = m - prev[i];
      if (d > 0) {                          // rectification demi-onde
        flux += d;
        if (i <= lowMax) fluxLow += d;
      }
      prev[i] = m;
    }
    env[f] = flux;
    envLow[f] = fluxLow;
  }

  const rate = sampleRate / hop;
  return {
    env: normalizeEnvelope(env, rate),
    envLow: normalizeEnvelope(envLow, rate),
    rate, hop, fftSize,
  };
}

/** Retire la tendance locale puis normalise (moyenne 0, écart-type 1, rectifié). */
function normalizeEnvelope(env, rate) {
  const n = env.length;
  const w = Math.max(3, Math.round(0.35 * rate));

  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + env[i];

  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - w);
    const b = Math.min(n, i + w + 1);
    out[i] = Math.max(0, env[i] - (pre[b] - pre[a]) / (b - a));
  }

  let mean = 0;
  for (let i = 0; i < n; i++) mean += out[i];
  mean /= n || 1;
  let sd = 0;
  for (let i = 0; i < n; i++) sd += (out[i] - mean) ** 2;
  sd = Math.sqrt(sd / (n || 1)) || 1;
  for (let i = 0; i < n; i++) out[i] /= sd;
  return out;
}

/* ======================================================================
   Tempo
   ====================================================================== */

const TEMPO_CENTER = 125;   // tempo a priori le plus probable
const TEMPO_SIGMA = 0.9;    // largeur du prior, en octaves de tempo

const tempoPrior = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / TEMPO_CENTER) / TEMPO_SIGMA) ** 2);

/** Autocorrélation normalisée à décalage fractionnaire (interpolation linéaire). */
function acfAt(env, lag) {
  const n = env.length;
  const i0 = Math.floor(lag);
  const fr = lag - i0;
  const last = n - i0 - 1;
  if (last <= 1) return 0;
  let s = 0;
  for (let t = 0; t < last; t++) {
    s += env[t] * (env[t + i0] * (1 - fr) + env[t + i0 + 1] * fr);
  }
  return s / last;
}

/** Score en peigne : le lag et ses harmoniques (double, triple, quadruple). */
function combScore(env, lag, maxLag) {
  let s = acfAt(env, lag);
  let w = 1;
  const harmonics = [[2, 0.55], [3, 0.35], [4, 0.22]];
  for (const [mult, weight] of harmonics) {
    const l = lag * mult;
    if (l < maxLag) { s += weight * acfAt(env, l); w += weight; }
  }
  return s / w;
}

/**
 * Estime le tempo à partir de l'enveloppe d'attaques.
 * @returns {{bpm:number, lag:number, confidence:number, candidates:Array<{bpm:number,score:number,relation:string}>}}
 */
export function estimateTempo(env, envRate, { minBpm = 65, maxBpm = 200 } = {}) {
  const minLag = Math.max(2, Math.floor((60 * envRate) / maxBpm));
  const maxLag = Math.ceil((60 * envRate) / minBpm);
  const searchMax = Math.min(env.length - 2, maxLag * 4);

  const scores = [];
  let best = { score: -Infinity, lag: minLag };
  for (let lag = minLag; lag <= maxLag; lag++) {
    const raw = combScore(env, lag, searchMax);
    const bpm = (60 * envRate) / lag;
    const score = raw * tempoPrior(bpm);
    scores.push({ lag, score, raw });
    if (score > best.score) best = { score, lag, raw };
  }

  // Affinage à décalage fractionnaire autour du meilleur lag entier.
  let fine = { score: -Infinity, lag: best.lag };
  for (let lag = Math.max(minLag, best.lag - 1.5); lag <= best.lag + 1.5; lag += 0.02) {
    const raw = combScore(env, lag, searchMax);
    const score = raw * tempoPrior((60 * envRate) / lag);
    if (score > fine.score) fine = { score, lag, raw };
  }

  const bpm = (60 * envRate) / fine.lag;

  // Confiance : saillance du pic par rapport au fond.
  const vals = scores.map((s) => s.score).filter((v) => isFinite(v));
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1e-9;
  const confidence = clamp(((fine.score - mean) / sd) / 4, 0, 1);

  // Alternatives : erreurs d'octave et de métrique classiques.
  const relations = [
    { factor: 0.5,     label: 'moitié (÷2)' },
    { factor: 2,       label: 'double (×2)' },
    { factor: 2 / 3,   label: '×2/3 (feel triolet)' },
    { factor: 1.5,     label: '×3/2' },
    { factor: 4 / 3,   label: '×4/3' },
  ];
  const candidates = [{ bpm, score: 1, relation: 'détecté' }];
  for (const r of relations) {
    const b = bpm * r.factor;
    if (b < minBpm * 0.6 || b > maxBpm * 1.6) continue;
    const lag = (60 * envRate) / b;
    if (lag < 2 || lag > env.length / 4) continue;
    const raw = combScore(env, lag, searchMax);
    candidates.push({ bpm: b, score: fine.raw ? raw / fine.raw : 0, relation: r.label });
  }

  return { bpm, lag: fine.lag, confidence, candidates };
}

/**
 * Trouve la position du premier temps pour une période donnée.
 * @returns {{offsetFrames:number, strength:number, salience:number}}
 */
export function beatPhase(env, periodFrames) {
  const n = env.length;
  let best = { offsetFrames: 0, strength: -Infinity };
  let sum = 0;
  let tried = 0;

  for (let off = 0; off < periodFrames; off += 0.05) {
    let s = 0;
    let count = 0;
    for (let t = off; t < n - 1; t += periodFrames) {
      const i = Math.floor(t);
      const fr = t - i;
      s += env[i] * (1 - fr) + env[i + 1] * fr;
      count++;
    }
    if (count > 0) {
      const strength = s / count;
      sum += strength;
      tried++;
      if (strength > best.strength) best = { offsetFrames: off, strength };
    }
  }

  // Saillance : à quel point ce décalage se détache des autres.
  const mean = tried ? sum / tried : 0;
  return { ...best, salience: mean > 1e-9 ? best.strength / mean : 0 };
}

/**
 * Phase des temps, calée sur la grosse caisse quand celle-ci est franche.
 * Sur un morceau sans basses marquées, on retombe sur la bande complète.
 */
export function resolveBeatPhase(env, envLow, periodFrames) {
  const full = beatPhase(env, periodFrames);
  if (!envLow || !envLow.length) return full;

  const low = beatPhase(envLow, periodFrames);
  const usable = isFinite(low.strength) && low.strength > 0 && low.salience >= 1.15;
  return usable ? low : full;
}

/** Positions (en secondes) des temps, dans le repère du signal analysé. */
export function beatGrid(offsetFrames, periodFrames, hop, sampleRate, totalFrames, fftSize) {
  const out = [];
  const centre = fftSize / 2;
  for (let t = offsetFrames; t < totalFrames; t += periodFrames) {
    out.push((t * hop + centre) / sampleRate);
  }
  return out;
}

/* ======================================================================
   Tonalité
   ====================================================================== */

/** Profils tonaux (12 valeurs, à partir de la tonique). */
export const KEY_PROFILES = {
  // Shaath (KeyFinder) — calibré sur de la musique électronique.
  shaath: {
    label: 'Shaath (électro / club)',
    maj: [6.6, 2.0, 3.5, 2.3, 4.6, 4.0, 2.5, 5.2, 2.4, 3.7, 2.3, 3.4],
    min: [6.5, 2.7, 3.5, 5.4, 2.6, 3.5, 2.5, 5.2, 4.0, 2.7, 4.3, 3.2],
  },
  // Krumhansl-Kessler — référence historique, plus « classique ».
  krumhansl: {
    label: 'Krumhansl (généraliste)',
    maj: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    min: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
  },
  // Temperley — pondère davantage les degrés diatoniques.
  temperley: {
    label: 'Temperley (acoustique)',
    maj: [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
    min: [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0],
  },
};

/**
 * Chromagramme par sélection de pics spectraux, avec estimation du diapason.
 * @returns {{chroma: Float64Array, tuningCents: number, frames: number}}
 */
export function chromagram(samples, sampleRate, { fftSize = 8192, hop = 4096, fMin = 90, fMax = 3800 } = {}) {
  const fft = new FFT(fftSize);
  const win = hannWindow(fftSize);
  const bins = fftSize / 2;
  const frames = Math.max(1, Math.floor((samples.length - fftSize) / hop) + 1);
  const buf = new Float64Array(fftSize);

  const iMin = Math.max(1, Math.floor((fMin * fftSize) / sampleRate));
  const iMax = Math.min(bins - 2, Math.ceil((fMax * fftSize) / sampleRate));

  // Passe 1 : écart moyen au diapason 440 Hz (certains morceaux sont désaccordés).
  let devSum = 0;
  let devWeight = 0;
  const spectra = [];

  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < fftSize; i++) buf[i] = samples[off + i] * win[i];
    const mag = fft.magnitudes(buf);

    const peaksFound = [];
    for (let i = iMin; i <= iMax; i++) {
      const m = mag[i];
      if (m <= mag[i - 1] || m < mag[i + 1] || m < 1e-6) continue;
      // Interpolation parabolique pour la fréquence exacte du pic.
      const a = Math.log(mag[i - 1] + 1e-12);
      const b = Math.log(m + 1e-12);
      const c = Math.log(mag[i + 1] + 1e-12);
      const delta = clamp((0.5 * (a - c)) / (a - 2 * b + c || 1e-12), -0.5, 0.5);
      const freq = ((i + delta) * sampleRate) / fftSize;
      if (freq < fMin || freq > fMax) continue;
      peaksFound.push([freq, m]);

      const midi = 69 + 12 * Math.log2(freq / 440);
      const dev = midi - Math.round(midi);
      devSum += dev * m;
      devWeight += m;
    }
    spectra.push(peaksFound);
  }

  const tuningCents = clamp(devWeight ? (devSum / devWeight) * 100 : 0, -50, 50);
  const reference = 440 * Math.pow(2, tuningCents / 1200);

  // Passe 2 : accumulation des classes de hauteur, corrigée du diapason.
  const chroma = new Float64Array(12);
  for (const peaksFound of spectra) {
    const frame = new Float64Array(12);
    let total = 0;
    for (const [freq, m] of peaksFound) {
      const midi = 69 + 12 * Math.log2(freq / reference);
      const nearest = Math.round(midi);
      const dev = midi - nearest;
      const w = m * Math.cos(Math.PI * dev) ** 2;  // 1 au centre, 0 à ±50 cents
      const pc = ((nearest % 12) + 12) % 12;
      frame[pc] += w;
      total += w;
    }
    if (total > 1e-9) for (let i = 0; i < 12; i++) chroma[i] += frame[i] / total;
  }

  const sum = chroma.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < 12; i++) chroma[i] /= sum;

  return { chroma, tuningCents, frames };
}

/**
 * Détermine la clef la plus probable à partir d'un chromagramme.
 * @returns {{pc:number, mode:'maj'|'min', score:number, confidence:number,
 *            ranking:Array<{pc:number, mode:string, score:number}>}}
 */
export function estimateKey(chroma, profileName = 'shaath') {
  const profile = KEY_PROFILES[profileName] || KEY_PROFILES.shaath;
  const ranking = [];

  for (const mode of ['maj', 'min']) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const rotated = new Float64Array(12);
      for (let i = 0; i < 12; i++) rotated[i] = chroma[(tonic + i) % 12];
      ranking.push({ pc: tonic, mode, score: pearson(rotated, profile[mode]) });
    }
  }

  ranking.sort((a, b) => b.score - a.score);
  const best = ranking[0];
  const second = ranking[1];

  // Confiance : à la fois force de la corrélation et écart avec la suivante.
  const margin = clamp((best.score - second.score) / 0.25, 0, 1);
  const strength = clamp((best.score - 0.35) / 0.45, 0, 1);
  const confidence = clamp(0.45 * margin + 0.55 * strength, 0, 1);

  return { ...best, confidence, ranking: ranking.slice(0, 5) };
}

function pearson(a, b) {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den ? num / den : 0;
}

/* ======================================================================
   Orchestration
   ====================================================================== */

/**
 * Analyse complète d'un signal mono.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {object} opts
 * @param {(p:number, label:string)=>void} [opts.onProgress]
 */
export function analyzeSignal(samples, sampleRate, opts = {}) {
  const { onProgress = () => {}, profile = 'shaath', minBpm = 65, maxBpm = 200, detectKey = true, detectTempo = true } = opts;
  const result = { sampleRate, duration: samples.length / sampleRate };

  if (detectTempo) {
    onProgress(0.05, 'Détection des attaques…');
    const { env, envLow, rate, hop, fftSize } = onsetEnvelope(samples, sampleRate);

    onProgress(0.45, 'Recherche du tempo…');
    const tempo = estimateTempo(env, rate, { minBpm, maxBpm });

    onProgress(0.62, 'Calage de la grille…');
    const phase = resolveBeatPhase(env, envLow, tempo.lag);
    const firstBeat = (phase.offsetFrames * hop + fftSize / 2) / sampleRate;

    result.tempo = {
      bpm: tempo.bpm,
      confidence: tempo.confidence,
      candidates: tempo.candidates,
      firstBeat,
      beatSeconds: 60 / tempo.bpm,
      beats: beatGrid(phase.offsetFrames, tempo.lag, hop, sampleRate, env.length, fftSize),
    };
  }

  if (detectKey) {
    onProgress(0.72, 'Analyse harmonique…');
    const { chroma, tuningCents } = chromagram(samples, sampleRate);
    const key = estimateKey(chroma, profile);
    result.key = { ...key, chroma: Array.from(chroma), tuningCents, profile };
  }

  onProgress(1, 'Terminé');
  return result;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
