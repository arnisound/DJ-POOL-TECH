/** Worker d'analyse : garde l'interface fluide pendant les calculs. */
import { analyzeSignal } from './analyze.js';

self.onmessage = (e) => {
  const { id, samples, sampleRate, opts } = e.data || {};
  try {
    const result = analyzeSignal(samples, sampleRate, {
      ...opts,
      onProgress: (p, label) => self.postMessage({ id, type: 'progress', progress: p, label }),
    });
    self.postMessage({ id, type: 'done', result });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};
