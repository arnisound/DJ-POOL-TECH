/**
 * Point d'entrée public de l'analyse : décodage sur le fil principal
 * (l'API Web Audio l'exige), calcul dans un Worker quand c'est possible.
 */
import { decodeAudioFile, peaks } from './decode.js';
import { analyzeSignal } from './analyze.js';

let worker = null;
let workerBroken = false;
let seq = 0;

function getWorker() {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('error', () => { workerBroken = true; worker = null; });
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function runInWorker(w, samples, sampleRate, opts, onProgress) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const onMessage = (e) => {
      const m = e.data || {};
      if (m.id !== id) return;
      if (m.type === 'progress') { onProgress(m.progress, m.label); return; }
      w.removeEventListener('message', onMessage);
      if (m.type === 'done') resolve(m.result);
      else reject(new Error(m.message || 'Analyse interrompue'));
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ id, samples, sampleRate, opts }, [samples.buffer]);
  });
}

/**
 * Analyse un fichier audio.
 * @param {File|Blob} file
 * @param {object} opts
 * @param {(p:number,label:string)=>void} [opts.onProgress]
 * @param {boolean} [opts.detectTempo=true]
 * @param {boolean} [opts.detectKey=true]
 * @param {string}  [opts.profile='shaath']
 */
export async function analyzeFile(file, opts = {}) {
  const { onProgress = () => {}, ...rest } = opts;

  onProgress(0.03, 'Décodage du fichier…');
  const audio = await decodeAudioFile(file, { maxSeconds: rest.maxSeconds ?? 180 });

  // La forme d'onde est calculée avant tout transfert (qui détache le tampon).
  const waveform = Array.from(peaks(audio.samples, 480));

  const report = (p, label) => onProgress(0.08 + p * 0.92, label);
  const w = getWorker();

  let result;
  if (w) {
    // Copie transférable : conserve `audio.samples` intact côté appelant.
    const copy = new Float32Array(audio.samples);
    try {
      result = await runInWorker(w, copy, audio.sampleRate, rest, report);
    } catch (err) {
      workerBroken = true;
      worker = null;
      result = analyzeSignal(audio.samples, audio.sampleRate, { ...rest, onProgress: report });
    }
  } else {
    // Repli : calcul sur le fil principal, après un rendu pour afficher l'état.
    await new Promise((r) => setTimeout(r, 30));
    result = analyzeSignal(audio.samples, audio.sampleRate, { ...rest, onProgress: report });
  }

  return {
    ...result,
    waveform,
    duration: audio.duration,
    analyzedFrom: audio.analyzedFrom,
    analyzedDuration: audio.analyzedDuration,
    originalRate: audio.originalRate,
    channels: audio.channels,
    file: { name: file.name || 'extrait', size: file.size || 0, type: file.type || '' },
  };
}

/** Analyse un signal déjà décodé (utilisé par l'enregistrement micro). */
export function analyzeSamples(samples, sampleRate, opts = {}) {
  const { onProgress = () => {}, ...rest } = opts;
  return Promise.resolve().then(() => {
    const w = getWorker();
    if (w) return runInWorker(w, new Float32Array(samples), sampleRate, rest, onProgress);
    return analyzeSignal(samples, sampleRate, { ...rest, onProgress });
  });
}
