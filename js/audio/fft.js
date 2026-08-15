/**
 * FFT radix-2 en place (Cooley-Tukey), tables précalculées.
 * Suffisamment rapide pour analyser plusieurs minutes d'audio dans l'onglet.
 */
export class FFT {
  /** @param {number} n taille, puissance de 2 */
  constructor(n) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error('FFT : la taille doit être une puissance de 2');
    this.n = n;
    this.levels = Math.round(Math.log2(n));

    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }

    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) this.rev[i] = reverseBits(i, this.levels);

    // Tampons réutilisés pour éviter les allocations à chaque trame.
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.mag = new Float64Array(n / 2);
  }

  /** Transformée en place de (re, im). */
  transform(re, im) {
    const { n, rev, cos, sin } = this;

    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }

    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre =  re[l] * cos[k] + im[l] * sin[k];
          const tim = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim;
          re[j] += tre;        im[j] += tim;
        }
      }
    }
  }

  /**
   * Spectre d'amplitude d'une trame réelle déjà fenêtrée.
   * @param {Float32Array|Float64Array} frame longueur n
   * @returns {Float64Array} amplitudes des n/2 premiers bins (tampon réutilisé)
   */
  magnitudes(frame) {
    const { n, re, im, mag } = this;
    for (let i = 0; i < n; i++) { re[i] = frame[i]; im[i] = 0; }
    this.transform(re, im);
    const scale = 2 / n;
    for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i]) * scale;
    return mag;
  }
}

function reverseBits(x, bits) {
  let y = 0;
  for (let i = 0; i < bits; i++) { y = (y << 1) | (x & 1); x >>>= 1; }
  return y >>> 0;
}

/** Fenêtre de Hann de taille n. */
export function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}
