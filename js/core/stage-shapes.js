/**
 * Dessins du matériel, vus de dessus.
 *
 * Chaque appareil est tracé en vectoriel : le rendu reste net à l'impression,
 * le fichier reste léger et l'application fonctionne hors ligne. Les
 * proportions et l'emplacement des commandes suivent le matériel réel, pour
 * qu'un régisseur reconnaisse un CDJ d'un mixeur au premier coup d'œil.
 *
 * Un appareil peut aussi porter une photo (voir `node.image`) : elle prend
 * alors la place du dessin.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Encombrement par défaut de chaque type d'appareil, en unités du plan. */
export const SHAPES = {
  player:     { w: 100, h: 152 },
  turntable:  { w: 124, h: 152 },
  mixer:      { w: 112, h: 152 },
  allinone:   { w: 268, h: 152 },
  controller: { w: 250, h: 136 },
  laptop:     { w: 152, h: 122 },
  speaker:    { w: 116, h: 130 },
  sub:        { w: 124, h: 118 },
  wedge:      { w: 136, h: 84 },
  mic:        { w: 66,  h: 116 },
  hub:        { w: 116, h: 62 },
  screen:     { w: 168, h: 112 },
  keys:       { w: 210, h: 84 },
  fx:         { w: 116, h: 112 },
  box:        { w: 104, h: 72 },
  power:      { w: 136, h: 56 },
  light:      { w: 148, h: 54 },
  riser:      { w: 300, h: 124 },
};

export function shapeOf(icon) {
  return SHAPES[icon] || SHAPES.box;
}

/* ------------------------------------------------------------------ *
 * Petits utilitaires de tracé
 * ------------------------------------------------------------------ */

const el = (name, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  return node;
};

/**
 * Boîte à outils de dessin dans un repère local (0,0)-(w,h).
 * Les proportions sont exprimées en fractions : le dessin s'adapte
 * à n'importe quelle taille.
 */
function pen(g, w, h, c) {
  const R = (fx, fy, fw, fh, opts = {}) => g.appendChild(el('rect', {
    x: fx * w, y: fy * h, width: fw * w, height: fh * h,
    rx: opts.r ?? 2, fill: opts.fill ?? c.detail, opacity: opts.o ?? 1, stroke: opts.stroke ?? null,
    'stroke-width': opts.sw ?? null,
  }));
  const C = (fx, fy, r, opts = {}) => g.appendChild(el('circle', {
    cx: fx * w, cy: fy * h, r: r * Math.min(w, h),
    fill: opts.fill ?? 'none', stroke: opts.stroke ?? c.detail,
    'stroke-width': opts.sw ?? 1.6, opacity: opts.o ?? 1,
  }));
  const L = (x1, y1, x2, y2, opts = {}) => g.appendChild(el('line', {
    x1: x1 * w, y1: y1 * h, x2: x2 * w, y2: y2 * h,
    stroke: opts.stroke ?? c.detail, 'stroke-width': opts.sw ?? 1.4, opacity: opts.o ?? 1,
    'stroke-linecap': 'round',
  }));
  const P = (d, opts = {}) => g.appendChild(el('path', {
    d, fill: opts.fill ?? 'none', stroke: opts.stroke ?? null,
    'stroke-width': opts.sw ?? null, opacity: opts.o ?? 1, 'stroke-linejoin': 'round',
  }));
  /** Rangée de potentiomètres. */
  const knobRow = (fx, fy, count, step, r = 0.028, opts = {}) => {
    for (let i = 0; i < count; i++) C(fx + i * step, fy, r, opts);
  };
  /** Fader vertical, avec sa glissière et son curseur. */
  const fader = (fx, fy, fh, opts = {}) => {
    R(fx - 0.008, fy, 0.016, fh, { fill: c.slot, r: 1.5 });
    R(fx - 0.026, fy + fh * (opts.at ?? 0.28), 0.052, 0.05, { fill: c.detail, r: 1.5 });
  };
  return { R, C, L, P, knobRow, fader };
}

/* ------------------------------------------------------------------ *
 * Dessins
 * ------------------------------------------------------------------ */

/**
 * Dessine un appareil dans le groupe `g`, à la taille (w, h).
 * @param {SVGGElement} g groupe déjà translaté à la position voulue
 * @param {string} icon type de dessin
 * @param {number} w
 * @param {number} h
 * @param {object} c palette { body, detail, slot, screen, edge, accent }
 */
/** Éléments dessinés sans boîtier : ils apparaissent en silhouette. */
const FRAMELESS = new Set(['mic', 'riser', 'wedge']);

export function drawShape(g, icon, w, h, c) {
  if (!FRAMELESS.has(icon)) {
    g.appendChild(el('rect', {
      x: 0, y: 0, width: w, height: h, rx: Math.min(9, w * 0.06),
      fill: c.body, stroke: c.edge, 'stroke-width': 1.1,
    }));
  }

  const { R, C, L, P, knobRow, fader } = pen(g, w, h, c);

  switch (icon) {
    /* ------------------------------ Lecteur CDJ ------------------------------ */
    case 'player': {
      R(0.16, 0.045, 0.7, 0.2, { fill: c.screen, r: 3 });            // écran
      R(0.19, 0.075, 0.3, 0.04, { fill: c.detail, o: 0.35, r: 1 });  // forme d'onde
      R(0.19, 0.14, 0.5, 0.03, { fill: c.accent, o: 0.55, r: 1 });

      knobRow(0.24, 0.31, 4, 0.16, 0.026, { fill: c.detail, o: 0.85, sw: 0 });  // boutons de boucle

      C(0.52, 0.62, 0.3, { sw: 2.2, o: 0.9 });                       // plateau
      C(0.52, 0.62, 0.24, { sw: 1, o: 0.45 });
      C(0.52, 0.62, 0.085, { fill: c.detail, o: 0.9, sw: 0 });       // moyeu
      C(0.52, 0.62, 0.035, { fill: c.body, sw: 0 });

      fader(0.075, 0.42, 0.42, { at: 0.45 });                        // pitch

      R(0.66, 0.9, 0.14, 0.06, { fill: c.detail, o: 0.9, r: 2 });     // cue
      R(0.83, 0.9, 0.14, 0.06, { fill: c.accent, o: 0.9, r: 2 });     // play
      break;
    }

    /* --------------------------- Platine vinyle --------------------------- */
    case 'turntable': {
      C(0.46, 0.52, 0.38, { fill: c.slot, sw: 0 });                  // plateau
      C(0.46, 0.52, 0.38, { sw: 1.4, o: 0.5 });
      C(0.46, 0.52, 0.26, { sw: 0.9, o: 0.35 });
      C(0.46, 0.52, 0.13, { fill: c.detail, o: 0.55, sw: 0 });       // étiquette
      C(0.46, 0.52, 0.018, { fill: c.body, sw: 0 });                 // axe

      C(0.87, 0.16, 0.055, { fill: c.detail, o: 0.8, sw: 0 });       // base du bras
      L(0.87, 0.16, 0.6, 0.42, { sw: 3, o: 0.85 });                  // bras
      R(0.55, 0.4, 0.05, 0.04, { fill: c.detail, r: 1 });            // cellule

      R(0.06, 0.06, 0.13, 0.09, { fill: c.detail, o: 0.85, r: 2 });   // start/stop
      fader(0.9, 0.55, 0.35, { at: 0.5 });                            // pitch
      R(0.06, 0.86, 0.1, 0.05, { fill: c.detail, o: 0.6, r: 1 });     // 33/45
      break;
    }

    /* ------------------------------ Mixeur DJM ------------------------------ */
    case 'mixer': {
      R(0.08, 0.04, 0.84, 0.12, { fill: c.screen, r: 2 });            // section effets
      knobRow(0.2, 0.1, 4, 0.2, 0.022, { fill: c.detail, o: 0.8, sw: 0 });

      for (let i = 0; i < 4; i++) {                                   // quatre tranches
        const x = 0.19 + i * 0.21;
        knobRow(x, 0.26, 1, 0, 0.03, { stroke: c.detail, sw: 1.4 });   // trim
        knobRow(x, 0.36, 1, 0, 0.026, { stroke: c.detail, sw: 1.2 });  // aigu
        knobRow(x, 0.44, 1, 0, 0.026, { stroke: c.detail, sw: 1.2 });  // médium
        knobRow(x, 0.52, 1, 0, 0.026, { stroke: c.detail, sw: 1.2 });  // grave
        fader(x, 0.62, 0.24, { at: i % 2 ? 0.3 : 0.45 });              // fader de voie
      }

      R(0.1, 0.92, 0.6, 0.035, { fill: c.slot, r: 2 });                // crossfader
      R(0.34, 0.905, 0.075, 0.065, { fill: c.detail, r: 2 });
      C(0.86, 0.86, 0.035, { stroke: c.detail, sw: 1.6 });             // master
      C(0.86, 0.95, 0.03, { stroke: c.detail, sw: 1.4 });              // casque
      break;
    }

    /* --------------------- Contrôleur et tout-en-un --------------------- */
    case 'allinone':
    case 'controller': {
      const jogR = icon === 'allinone' ? 0.155 : 0.15;
      for (const cx of [0.16, 0.84]) {
        C(cx, 0.52, jogR, { fill: c.slot, sw: 0 });
        C(cx, 0.52, jogR, { sw: 1.6, o: 0.6 });
        C(cx, 0.52, jogR * 0.35, { fill: c.detail, o: 0.75, sw: 0 });
      }
      // Section de mixage centrale
      R(0.38, 0.06, 0.24, 0.16, { fill: c.screen, r: 2 });
      for (let i = 0; i < 4; i++) {
        const x = 0.4 + i * 0.068;
        knobRow(x, 0.3, 1, 0, 0.02, { stroke: c.detail, sw: 1.2 });
        knobRow(x, 0.38, 1, 0, 0.018, { stroke: c.detail, sw: 1 });
        fader(x, 0.46, 0.28, { at: 0.35 });
      }
      R(0.4, 0.86, 0.2, 0.03, { fill: c.slot, r: 2 });                 // crossfader
      R(0.47, 0.845, 0.05, 0.06, { fill: c.detail, r: 2 });
      // Pads de performance sous chaque plateau
      for (const bx of [0.05, 0.73]) {
        for (let i = 0; i < 4; i++) {
          R(bx + (i % 4) * 0.056, 0.82, 0.045, 0.07, { fill: c.detail, o: 0.45, r: 1.5 });
        }
      }
      break;
    }

    /* ---------------------------- Ordinateur ---------------------------- */
    case 'laptop': {
      R(0.06, 0.05, 0.88, 0.56, { fill: c.screen, r: 3 });             // écran
      R(0.1, 0.1, 0.8, 0.46, { fill: c.slot, o: 0.55, r: 2 });
      R(0.14, 0.15, 0.34, 0.06, { fill: c.accent, o: 0.6, r: 1 });     // forme d'onde
      R(0.14, 0.26, 0.6, 0.04, { fill: c.detail, o: 0.35, r: 1 });
      R(0.14, 0.34, 0.5, 0.04, { fill: c.detail, o: 0.25, r: 1 });
      R(0.03, 0.68, 0.94, 0.26, { fill: c.detail, o: 0.5, r: 3 });     // clavier
      R(0.4, 0.86, 0.2, 0.06, { fill: c.body, o: 0.5, r: 2 });         // pavé tactile
      break;
    }

    /* ---------------------------- Enceintes ---------------------------- */
    case 'speaker': {
      R(0.08, 0.05, 0.84, 0.9, { fill: c.slot, o: 0.4, r: 4 });        // caisse
      C(0.5, 0.62, 0.28, { fill: c.body, sw: 0 });                     // boomer
      C(0.5, 0.62, 0.28, { sw: 1.6, o: 0.8 });
      C(0.5, 0.62, 0.11, { fill: c.detail, o: 0.8, sw: 0 });
      R(0.36, 0.12, 0.28, 0.14, { fill: c.body, r: 2 });               // pavillon
      R(0.39, 0.145, 0.22, 0.09, { fill: c.detail, o: 0.55, r: 1 });
      break;
    }
    case 'sub': {
      R(0.06, 0.08, 0.88, 0.84, { fill: c.slot, o: 0.4, r: 4 });
      C(0.5, 0.5, 0.36, { fill: c.body, sw: 0 });
      C(0.5, 0.5, 0.36, { sw: 2, o: 0.85 });
      C(0.5, 0.5, 0.22, { sw: 1, o: 0.5 });
      C(0.5, 0.5, 0.1, { fill: c.detail, o: 0.85, sw: 0 });
      break;
    }
    case 'wedge': {
      const S = c.silhouette || c.body;
      const SD = c.silhouetteDetail || c.detail;
      P(`M${0.08 * w} ${0.95 * h} L${0.92 * w} ${0.95 * h} L${0.78 * w} ${0.14 * h} L${0.22 * w} ${0.14 * h} Z`,
        { fill: S });
      C(0.5, 0.62, 0.24, { fill: SD, o: 0.35, sw: 0 });
      C(0.5, 0.62, 0.09, { fill: SD, o: 0.7, sw: 0 });
      R(0.42, 0.22, 0.16, 0.1, { fill: SD, o: 0.5, r: 2 });
      break;
    }

    /* ------------------------------- Micro ------------------------------- */
    case 'mic': {
      const S = c.silhouette || c.body;
      const SD = c.silhouetteDetail || c.detail;
      C(0.5, 0.16, 0.21, { fill: S, sw: 0 });                           // grille
      for (let i = 0; i < 3; i++) {
        L(0.33, 0.12 + i * 0.045, 0.67, 0.12 + i * 0.045, { stroke: SD, sw: 1, o: 0.55 });
      }
      P(`M${0.42 * w} ${0.3 * h} L${0.58 * w} ${0.3 * h} L${0.55 * w} ${0.85 * h} L${0.45 * w} ${0.85 * h} Z`,
        { fill: S });                                                   // corps
      R(0.33, 0.85, 0.34, 0.06, { fill: S, r: 2 });                      // embase
      break;
    }

    /* --------------------------- Réseau, vidéo --------------------------- */
    case 'hub': {
      R(0.06, 0.2, 0.88, 0.6, { fill: c.slot, o: 0.5, r: 3 });
      for (let i = 0; i < 5; i++) {
        R(0.12 + i * 0.16, 0.34, 0.1, 0.3, { fill: c.body, r: 1 });
        R(0.14 + i * 0.16, 0.36, 0.06, 0.08, { fill: c.accent, o: 0.7, r: 0.5 });
      }
      break;
    }
    case 'screen': {
      R(0.05, 0.08, 0.9, 0.62, { fill: c.screen, r: 3 });
      R(0.09, 0.12, 0.82, 0.54, { fill: c.accent, o: 0.35, r: 2 });
      R(0.44, 0.72, 0.12, 0.1, { fill: c.detail, o: 0.7, r: 1 });
      R(0.3, 0.84, 0.4, 0.07, { fill: c.detail, o: 0.8, r: 2 });
      break;
    }

    /* -------------------------- Instruments -------------------------- */
    case 'keys': {
      R(0.04, 0.12, 0.92, 0.28, { fill: c.slot, o: 0.5, r: 2 });        // pupitre
      knobRow(0.12, 0.26, 6, 0.09, 0.05, { stroke: c.detail, sw: 1.2 });
      for (let i = 0; i < 12; i++) {
        R(0.05 + i * 0.078, 0.46, 0.068, 0.46, { fill: c.detail, o: 0.85, r: 1 });
      }
      for (let i = 0; i < 12; i++) {
        if ([2, 6, 9].includes(i % 12)) continue;
        R(0.096 + i * 0.078, 0.46, 0.036, 0.28, { fill: c.body, r: 0.5 });
      }
      break;
    }
    case 'fx': {
      R(0.1, 0.08, 0.8, 0.22, { fill: c.screen, r: 2 });
      knobRow(0.25, 0.46, 3, 0.25, 0.06, { stroke: c.detail, sw: 1.8 });
      for (let i = 0; i < 4; i++) R(0.14 + i * 0.2, 0.72, 0.14, 0.16, { fill: c.detail, o: 0.5, r: 2 });
      break;
    }

    /* --------------------------- Utilitaires --------------------------- */
    case 'power': {
      for (let i = 0; i < 4; i++) {
        C(0.18 + i * 0.21, 0.5, 0.13, { fill: c.slot, o: 0.6, sw: 0 });
        C(0.18 + i * 0.21, 0.5, 0.13, { sw: 1.2, o: 0.7 });
        C(0.155 + i * 0.21, 0.45, 0.03, { fill: c.detail, o: 0.8, sw: 0 });
        C(0.205 + i * 0.21, 0.45, 0.03, { fill: c.detail, o: 0.8, sw: 0 });
      }
      break;
    }
    case 'light': {
      R(0.04, 0.3, 0.92, 0.4, { fill: c.slot, o: 0.5, r: 3 });
      for (let i = 0; i < 6; i++) C(0.12 + i * 0.152, 0.5, 0.09, { fill: c.accent, o: 0.55, sw: 0 });
      break;
    }
    case 'riser': {
      g.appendChild(el('rect', {
        x: w * 0.03, y: h * 0.2, width: w * 0.94, height: h * 0.66, rx: 4,
        fill: c.silhouette || c.body, opacity: 0.12,
        stroke: c.silhouette || c.detail, 'stroke-width': 1.4, 'stroke-dasharray': '8 5',
      }));
      break;
    }

    /* ------------------------------ Par défaut ------------------------------ */
    default: {
      R(0.12, 0.24, 0.76, 0.5, { fill: c.slot, o: 0.5, r: 3 });
      knobRow(0.3, 0.5, 3, 0.2, 0.05, { stroke: c.detail, sw: 1.4 });
    }
  }
}

/** Photo importée par l'utilisateur, à la place du dessin. */
export function drawImage(g, href, w, h, radius = 6) {
  const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
  const defs = el('defs');
  const clip = el('clipPath', { id: clipId });
  clip.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: radius }));
  defs.appendChild(clip);
  g.appendChild(defs);
  g.appendChild(el('image', {
    href, x: 0, y: 0, width: w, height: h,
    preserveAspectRatio: 'xMidYMid meet',
    'clip-path': `url(#${clipId})`,
  }));
}

/** Silhouette du DJ, vue de dessus. */
export function drawDj(g, w, h, c, label) {
  const cx = w / 2;
  const shoulder = h * 0.62;

  const arm = (dx) => g.appendChild(el('path', {
    d: `M${cx + dx * w * 0.34} ${shoulder * 0.55} q${dx * w * 0.1} ${-h * 0.18} ${dx * w * 0.16} ${-h * 0.28}`,
    stroke: c.dj, 'stroke-width': Math.max(9, w * 0.11), fill: 'none', 'stroke-linecap': 'round',
  }));

  g.appendChild(el('path', {
    d: `M${cx - w * 0.46} ${h} q0 ${-shoulder} ${w * 0.46} ${-shoulder} q${w * 0.46} 0 ${w * 0.46} ${shoulder} z`,
    fill: c.dj,
  }));
  arm(-1);
  arm(1);

  const headR = w * 0.19;
  g.appendChild(el('circle', { cx, cy: h * 0.52, r: headR, fill: c.skin }));
  g.appendChild(el('rect', {
    x: cx - headR * 1.08, y: h * 0.5 - headR * 0.13, width: headR * 2.16, height: headR * 0.26,
    rx: headR * 0.13, fill: c.dj,
  }));
  g.appendChild(el('circle', { cx: cx - headR * 1.12, cy: h * 0.52, r: headR * 0.34, fill: c.cans }));
  g.appendChild(el('circle', { cx: cx + headR * 1.12, cy: h * 0.52, r: headR * 0.34, fill: c.cans }));

  if (label) {
    const t = el('text', {
      x: cx, y: h + 14, 'text-anchor': 'middle', 'font-size': 11,
      'font-weight': 700, fill: c.sub, 'letter-spacing': '.5',
    });
    t.textContent = label;
    g.appendChild(t);
  }
}
