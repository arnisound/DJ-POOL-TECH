/**
 * Tests du moteur d'analyse et de la théorie musicale.
 * Aucune dépendance : `node tests/dsp.test.mjs`
 *
 * Les modules testés n'utilisent pas le DOM, ils tournent donc tels quels
 * sous Node comme dans le navigateur.
 */
import { onsetEnvelope, estimateTempo, resolveBeatPhase, chromagram, estimateKey } from '../js/audio/analyze.js';
import {
  toCamelot, parseCamelot, toOpenKey, keyCompatibility, transposeCamelot,
  pitchPercent, semitonesFromPercent, percentFromSemitones, parseDuration, fmtDuration,
} from '../js/core/music.js';

const SR = 22050;
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------------ *
 * Générateurs de signaux
 * ------------------------------------------------------------------ */

/** Boucle rythmique : kick sur chaque temps, charley sur les contretemps. */
function makeDrumLoop(bpm, seconds, { swingOffset = 0 } = {}) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  const beat = (60 / bpm) * SR;

  for (let b = 0; b * beat / 2 < n; b++) {
    const start = Math.round(b * beat / 2 + swingOffset * SR);
    const isBeat = b % 2 === 0;

    if (isBeat) {
      // Kick : sinus descendant, attaque franche
      for (let i = 0; i < SR * 0.14 && start + i < n; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 26);
        const freq = 120 * Math.exp(-t * 22) + 45;
        out[start + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.9;
      }
    } else {
      // Charley : bruit filtré très court
      for (let i = 0; i < SR * 0.05 && start + i < n; i++) {
        const env = Math.exp(-(i / SR) * 90);
        out[start + i] += (Math.random() * 2 - 1) * env * 0.28;
      }
    }
  }

  for (let i = 0; i < n; i++) out[i] += (Math.random() * 2 - 1) * 0.004;   // souffle
  return out;
}

/** Suite d'accords tenus, pour tester la détection de tonalité. */
function makeChords(chords, secondsPerChord) {
  const n = Math.round(chords.length * secondsPerChord * SR);
  const out = new Float32Array(n);
  const len = Math.round(secondsPerChord * SR);

  chords.forEach((notes, ci) => {
    const start = ci * len;
    for (const midi of notes) {
      const f0 = 440 * Math.pow(2, (midi - 69) / 12);
      // Fondamentale + trois harmoniques : timbre proche d'un pad
      for (const [mult, amp] of [[1, 0.5], [2, 0.24], [3, 0.12], [4, 0.06]]) {
        const f = f0 * mult;
        if (f > SR / 2.2) continue;
        const phase = Math.random() * Math.PI * 2;
        for (let i = 0; i < len && start + i < n; i++) {
          const t = i / SR;
          const env = Math.min(1, t * 8) * Math.min(1, (secondsPerChord - t) * 8);
          out[start + i] += Math.sin(2 * Math.PI * f * t + phase) * amp * env * 0.3;
        }
      }
    }
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

console.log('\nThéorie musicale — notation Camelot');
{
  // Table de référence : les correspondances publiées de la roue Camelot.
  const expected = [
    [0, 'maj', '8B'], [7, 'maj', '9B'], [2, 'maj', '10B'], [9, 'maj', '11B'],
    [4, 'maj', '12B'], [11, 'maj', '1B'], [6, 'maj', '2B'], [1, 'maj', '3B'],
    [8, 'maj', '4B'], [3, 'maj', '5B'], [10, 'maj', '6B'], [5, 'maj', '7B'],
    [9, 'min', '8A'], [4, 'min', '9A'], [11, 'min', '10A'], [6, 'min', '11A'],
    [1, 'min', '12A'], [8, 'min', '1A'], [3, 'min', '2A'], [10, 'min', '3A'],
    [5, 'min', '4A'], [0, 'min', '5A'], [7, 'min', '6A'], [2, 'min', '7A'],
  ];
  const wrong = expected.filter(([pc, mode, code]) => toCamelot(pc, mode) !== code);
  check('les 24 clefs donnent le bon code Camelot', wrong.length === 0,
    wrong.map(([pc, m, c]) => `${pc}/${m} → ${toCamelot(pc, m)} au lieu de ${c}`).join(', '));

  const roundTrip = expected.every(([pc, mode, code]) => {
    const k = parseCamelot(code);
    return k.pc === pc && k.mode === mode;
  });
  check('parseCamelot est l’inverse exact de toCamelot', roundTrip);

  check('Do majeur = 1d en Open Key', toOpenKey(0, 'maj') === '1d');
  check('La mineur = 1m en Open Key', toOpenKey(9, 'min') === '1m');
  check('Sol# mineur = 6m en Open Key', toOpenKey(8, 'min') === '6m');

  check('8A → 8A est un mix parfait', keyCompatibility('8A', '8A').score === 100);
  check('8A → 9A est excellent', keyCompatibility('8A', '9A').level === 'excellent');
  check('8A → 8B (relatif) est excellent', keyCompatibility('8A', '8B').level === 'excellent');
  check('8A → 3A (+7) est un boost d’énergie', keyCompatibility('8A', '3A').label.includes('boost'));
  check('8A → 2A est déconseillé', keyCompatibility('8A', '2A').score < 50);
  check('transposer 8A de +2 demi-tons donne 10A', transposeCamelot('8A', 2) === '10A');
  check('transposer 12A de +1 boucle sur 7A', transposeCamelot('12A', 1) === '7A');
}

console.log('\nCalculs de pitch');
{
  check('124 → 128 BPM demande +3,23 %', near(pitchPercent(124, 128), 3.2258, 0.001));
  check('+6 % ≈ +1 demi-ton', near(semitonesFromPercent(6), 1.0088, 0.01));
  check('+1 demi-ton ≈ +5,95 %', near(percentFromSemitones(1), 5.946, 0.01));
  check('pitch et demi-tons sont réciproques', near(semitonesFromPercent(percentFromSemitones(3)), 3, 1e-9));
}

console.log('\nFormatage des durées');
{
  check('« 3:45 » vaut 225 s', parseDuration('3:45') === 225);
  check('« 225 » vaut 225 s', parseDuration('225') === 225);
  check('225 s s’affiche « 3:45 »', fmtDuration(225) === '3:45');
  check('3725 s s’affiche « 1:02:05 »', fmtDuration(3725) === '1:02:05');
}

console.log('\nDétection de tempo');
{
  for (const bpm of [90, 124, 128, 140, 174]) {
    const signal = makeDrumLoop(bpm, 24);
    const { env, rate } = onsetEnvelope(signal, SR);
    const tempo = estimateTempo(env, rate, { minBpm: 65, maxBpm: 200 });
    check(
      `boucle à ${bpm} BPM détectée (${tempo.bpm.toFixed(2)}, confiance ${(tempo.confidence * 100).toFixed(0)} %)`,
      near(tempo.bpm, bpm, 0.6)
    );
  }

  // Phase : la grille doit tomber sur le kick, pas sur le charley du contretemps.
  const offset = 0.25;
  const signal = makeDrumLoop(128, 24, { swingOffset: offset });
  const { env, envLow, rate, hop, fftSize } = onsetEnvelope(signal, SR);
  const tempo = estimateTempo(env, rate);
  const phase = resolveBeatPhase(env, envLow, tempo.lag);
  const firstBeat = (phase.offsetFrames * hop + fftSize / 2) / SR;
  const period = 60 / tempo.bpm;
  const err = Math.min(
    Math.abs(((firstBeat - offset) % period + period) % period),
    period - Math.abs(((firstBeat - offset) % period + period) % period)
  );
  check(`le premier temps est calé à ±25 ms (écart ${(err * 1000).toFixed(0)} ms)`, err < 0.025);
}

console.log('\nDétection de tonalité');
{
  // La mineur sans ambiguïté : Am – Dm – E – Am. Le Sol# du Mi majeur
  // n'appartient pas à Do majeur, la tonalité est donc tranchée.
  const aMinor = makeChords([
    [57, 60, 64, 69],   // Am
    [50, 57, 62, 65],   // Dm
    [52, 56, 59, 64],   // E  (contient Sol#)
    [57, 60, 64, 69],   // Am
  ], 4);
  const key = estimateKey(chromagram(aMinor, SR).chroma, 'shaath');
  check(
    `progression en La mineur reconnue (${toCamelot(key.pc, key.mode)}, confiance ${(key.confidence * 100).toFixed(0)} %)`,
    key.pc === 9 && key.mode === 'min',
    `obtenu ${toCamelot(key.pc, key.mode)}`
  );

  // Cas volontairement ambigu : Am – F – C – G partage exactement les mêmes
  // notes que Do majeur. Seul le relatif est attendu, jamais une clef étrangère.
  const ambiguous = makeChords([
    [57, 60, 64, 69],   // Am
    [53, 57, 60, 65],   // F
    [48, 52, 55, 60],   // C
    [55, 59, 62, 67],   // G
  ], 4);
  const k3 = estimateKey(chromagram(ambiguous, SR).chroma, 'shaath');
  const code3 = toCamelot(k3.pc, k3.mode);
  check(
    `progression relative Am/Do reconnue comme 8A ou 8B (${code3})`,
    code3 === '8A' || code3 === '8B'
  );

  // Fa majeur : F – Bb – C – F
  const fMajor = makeChords([
    [53, 57, 60, 65],   // F
    [58, 62, 65, 70],   // Bb
    [48, 52, 55, 60],   // C
    [53, 57, 60, 65],   // F
  ], 4);
  const k2 = estimateKey(chromagram(fMajor, SR).chroma, 'shaath');
  check(
    `progression en Fa majeur reconnue (${toCamelot(k2.pc, k2.mode)})`,
    k2.pc === 5 && k2.mode === 'maj',
    `obtenu ${toCamelot(k2.pc, k2.mode)}`
  );

  // Le diapason doit être détecté quand le morceau est désaccordé de 30 cents.
  const detuned = makeChords([[57 + 0.3, 60 + 0.3, 64 + 0.3, 69 + 0.3]], 8);
  const { tuningCents } = chromagram(detuned, SR);
  check(`désaccord de +30 cents mesuré (${tuningCents.toFixed(0)} cents)`, near(tuningCents, 30, 12));
}

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).\n`);
process.exit(failed ? 1 : 0);
