import { BossId, CreatureId } from '@libs/game-core';

/**
 * The campaign's creatures and bosses as vector art: SVG path data on a
 * square box, painted with the cartoon skin's ink outline. Kept as data so a
 * new creature is one more entry here, and the same art serves the site's
 * collection and the arena's textures. Each faces right; the painter mirrors.
 */
export interface ArtPart {
  /** SVG path data, in the art's box. */
  readonly d: string;
  readonly fill?: string;
  /** Outline colour; ink unless said otherwise. `none` for no outline. */
  readonly stroke?: string;
  /** Outline width, in box units. */
  readonly width?: number;
}

export interface CreatureArt {
  /** Side of the square box the paths are drawn in. */
  readonly box: number;
  readonly parts: readonly ArtPart[];
}

export const ART_INK = '#1d1a17';

/** A circle as path data. */
export function circle(cx: number, cy: number, r: number): string {
  return ellipse(cx, cy, r, r);
}

/** An ellipse as path data. */
export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): string {
  return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0z`;
}

const SHADOW: ArtPart = {
  d: ellipse(60, 108, 40, 7),
  fill: 'rgba(0,0,0,0.35)',
  stroke: 'none',
};

const SAUVA: CreatureArt = {
  box: 120,
  parts: [
    SHADOW,
    { d: 'M36 88 l-8 16 M50 90 l-2 16 M64 90 l6 15', width: 4.5 },
    { d: 'M72 50 l-6 -16', width: 4.5 },
    { d: 'M50 8 q40 2 48 36 q-40 8 -48 -36z', fill: '#7cc055', width: 4.5 },
    { d: 'M56 14 q18 10 36 28', stroke: '#4e8a3c', width: 3 },
    { d: ellipse(32, 78, 22, 17), fill: '#9c3b22', width: 4.5 },
    { d: ellipse(54, 80, 10, 8), fill: '#a8432a', width: 4.5 },
    { d: circle(78, 70, 22), fill: '#c4512f', width: 4.5 },
    { d: 'M74 50 q-4 -14 4 -22 M86 52 q8 -10 18 -8', width: 3.5 },
    { d: circle(86, 64, 7.5), fill: '#ffffff', width: 2 },
    { d: circle(88, 65, 3.8), fill: ART_INK, stroke: 'none' },
    { d: 'M96 80 q10 2 8 11 q-6 -3 -11 -5z', fill: '#3a1a10', width: 3 },
  ],
};

const POMBO: CreatureArt = {
  box: 120,
  parts: [
    SHADOW,
    {
      d: 'M50 94 v12 l-5 2 M50 106 l5 2 M66 94 v12 l-5 2 M66 106 l5 2',
      stroke: '#d76f7f',
      width: 3.5,
    },
    { d: 'M26 74 l-18 -8 l4 18z', fill: '#5d6778', width: 4 },
    {
      d: 'M22 76 q0 -30 34 -32 q30 0 40 24 q-6 26 -40 26 q-26 0 -34 -18z',
      fill: '#8e98a8',
      width: 4.5,
    },
    { d: 'M34 66 q26 -8 46 10 q-20 10 -46 2z', fill: '#6f7a8c', width: 4 },
    { d: 'M48 66 l4 10 M60 68 l3 10', stroke: '#3d4452', width: 4 },
    { d: 'M64 50 q16 -4 22 10 q-10 8 -22 2z', fill: '#4f8f7a', width: 4 },
    { d: circle(82, 38, 15), fill: '#9aa4b4', width: 4.5 },
    { d: circle(87, 35, 5), fill: '#f08a2a', width: 2 },
    { d: circle(88, 35, 2.3), fill: ART_INK, stroke: 'none' },
    { d: 'M95 40 l12 3 l-12 4z', fill: '#e6c9a0', width: 3 },
  ],
};

const CARAMUJO: CreatureArt = {
  box: 120,
  parts: [
    { d: ellipse(60, 108, 48, 6), fill: 'rgba(0,0,0,0.35)', stroke: 'none' },
    { d: 'M2 106 q30 4 66 2', stroke: 'rgba(159,224,198,0.55)', width: 6 },
    { d: 'M100 66 l-4 -22 M108 68 l6 -20', width: 7 },
    { d: 'M100 66 l-4 -22 M108 68 l6 -20', stroke: '#c7b394', width: 3 },
    { d: circle(96, 42, 6), fill: '#ffffff', width: 3 },
    { d: circle(97, 42, 2.6), fill: ART_INK, stroke: 'none' },
    { d: circle(114, 46, 6), fill: '#ffffff', width: 3 },
    { d: circle(115, 46, 2.6), fill: ART_INK, stroke: 'none' },
    {
      d: 'M12 104 q0 -14 20 -14 h54 q12 0 16 -20 q8 -8 12 2 q-2 26 -18 32z',
      fill: '#c7b394',
      width: 4.5,
    },
    { d: circle(50, 64, 32), fill: '#9b6a3c', width: 4.5 },
    {
      d: 'M50 64 m-5 0 a5 5 0 1 1 10 0 a11 11 0 1 1 -18 0 a19 19 0 1 1 32 0 a25 25 0 1 1 -46 4',
      stroke: '#5a3a1e',
      width: 4,
    },
    { d: 'M26 46 q8 -10 20 -12', stroke: 'rgba(229,207,163,0.8)', width: 4 },
  ],
};

const QUEROQUERO: CreatureArt = {
  box: 120,
  parts: [
    { d: ellipse(58, 110, 34, 6), fill: 'rgba(0,0,0,0.35)', stroke: 'none' },
    {
      d: 'M50 84 l-6 24 l-6 2 M44 108 l6 2 M64 84 l6 24 l-6 2 M70 108 l6 2',
      stroke: '#c0525a',
      width: 3.5,
    },
    { d: 'M28 66 l-18 4 l14 10z', fill: '#3a3d38', width: 4 },
    { d: ellipse(56, 70, 32, 20), fill: '#8b8f86', width: 4.5 },
    {
      d: 'M28 76 q28 18 58 0 q-4 14 -30 14 q-24 0 -28 -14z',
      fill: '#f3f0e8',
      width: 4,
    },
    { d: 'M70 52 q14 6 16 24 q-10 -2 -18 -10z', fill: ART_INK, stroke: 'none' },
    { d: 'M40 60 q18 -6 34 4', stroke: '#6b7a5a', width: 4 },
    { d: 'M44 66 l-6 -6 l8 0z', fill: '#d8323a', width: 2.5 },
    { d: circle(82, 42, 14), fill: '#a3a79c', width: 4.5 },
    {
      d: 'M70 36 q8 -8 22 -6 l-2 6 q-12 -2 -20 0z',
      fill: ART_INK,
      stroke: 'none',
    },
    { d: 'M74 30 q-10 -14 -26 -14 q10 4 20 18z', fill: ART_INK, width: 2 },
    { d: circle(87, 42, 4.5), fill: '#d8323a', width: 2 },
    { d: circle(88, 42, 1.8), fill: ART_INK, stroke: 'none' },
    { d: 'M80 36 l13 4', width: 3.5 },
    { d: 'M95 44 l13 2 l-13 5z', fill: '#d65a5a', width: 3 },
  ],
};

const RAINHA: CreatureArt = {
  box: 200,
  parts: [
    { d: ellipse(100, 186, 76, 10), fill: 'rgba(0,0,0,0.4)', stroke: 'none' },
    {
      d: 'M95 100 q-40 -70 -80 -60 q10 40 80 60z',
      fill: 'rgba(214,236,255,0.55)',
      width: 4,
    },
    {
      d: 'M100 104 q-20 -80 -60 -86 q-4 44 60 86z',
      fill: 'rgba(214,236,255,0.45)',
      width: 4,
    },
    { d: 'M88 142 l-18 36 M106 144 l2 36 M122 138 l20 34', width: 7 },
    { d: ellipse(58, 132, 50, 40), fill: '#8a321c', width: 6 },
    {
      d: 'M34 108 q10 30 2 58 M58 94 q10 40 2 76 M82 100 q8 34 0 64',
      stroke: '#6a2412',
      width: 5,
    },
    { d: 'M24 116 q20 -18 48 -16', stroke: '#b5583d', width: 6 },
    { d: ellipse(114, 128, 22, 18), fill: '#a8432a', width: 6 },
    {
      d: 'M96 116 q16 -8 32 0 q-6 14 -16 18 q-10 -4 -16 -18z',
      fill: '#7cc055',
      width: 4,
    },
    { d: circle(148, 98, 38), fill: '#c4512f', width: 6 },
    { d: 'M122 84 q20 -16 46 -8', stroke: '#e07a58', width: 6 },
    { d: 'M136 64 q-12 -26 2 -46 M160 64 q14 -22 34 -22', width: 5 },
    { d: circle(138, 18, 5), fill: ART_INK, stroke: 'none' },
    { d: circle(194, 42, 5), fill: ART_INK, stroke: 'none' },
    {
      d: 'M124 68 l4 -28 l12 14 l8 -22 l8 22 l12 -14 l4 28z',
      fill: '#f2c230',
      width: 5,
    },
    { d: circle(148, 58, 4.5), fill: '#3fae5a', width: 2 },
    { d: circle(132, 60, 3), fill: '#e2483d', width: 1.5 },
    { d: circle(164, 60, 3), fill: '#e2483d', width: 1.5 },
    { d: ellipse(162, 98, 12, 13), fill: '#ffffff', width: 3 },
    { d: circle(166, 100, 6), fill: ART_INK, stroke: 'none' },
    { d: circle(168, 97, 2), fill: '#ffffff', stroke: 'none' },
    { d: 'M146 80 l28 8', width: 6 },
    { d: 'M176 116 q20 0 18 18 q-10 -6 -20 -8z', fill: '#3a1a10', width: 4 },
    { d: 'M168 126 q14 10 6 24 q-6 -10 -14 -14z', fill: '#3a1a10', width: 4 },
  ],
};

const FAISCA: CreatureArt = {
  box: 120,
  parts: [
    { d: ellipse(60, 108, 30, 6), fill: 'rgba(0,0,0,0.35)', stroke: 'none' },
    { d: circle(60, 58, 40), fill: 'rgba(95,211,255,0.18)', stroke: 'none' },
    { d: 'M44 86 l-6 14 l8 -4 M74 86 l6 14 l-8 -4', width: 4.5 },
    {
      d: 'M44 86 l-6 14 l8 -4 M74 86 l6 14 l-8 -4',
      stroke: '#ffd36e',
      width: 2,
    },
    {
      d: 'M60 14 l9 18 l20 -8 l-8 20 l18 10 l-20 6 l4 22 l-20 -12 l-20 12 l4 -22 l-20 -6 l18 -10 l-8 -20 l20 8z',
      fill: '#ffe680',
      width: 4.5,
    },
    {
      d: 'M60 28 l6 12 l13 -5 l-5 13 l11 6 l-13 4 l3 14 l-15 -9 l-15 9 l3 -14 l-13 -4 l11 -6 l-5 -13 l13 5z',
      fill: '#fff8d6',
      stroke: 'none',
    },
    { d: 'M42 38 q6 -8 14 -10', stroke: '#ffffff', width: 3.5 },
    { d: ellipse(51, 58, 7, 8), fill: '#ffffff', width: 2.5 },
    { d: ellipse(69, 58, 7, 8), fill: '#ffffff', width: 2.5 },
    { d: circle(53, 59, 3.5), fill: ART_INK, stroke: 'none' },
    { d: circle(71, 59, 3.5), fill: ART_INK, stroke: 'none' },
    { d: 'M53 70 q7 6 14 0', width: 3 },
    {
      d: 'M100 30 l8 -6 M104 44 l10 0 M14 40 l-8 -4 M18 26 l-6 -8',
      stroke: '#5fd3ff',
      width: 3,
    },
  ],
};

const GAMBA: CreatureArt = {
  box: 120,
  parts: [
    { d: ellipse(58, 108, 44, 6), fill: 'rgba(0,0,0,0.35)', stroke: 'none' },
    { d: 'M18 80 q-16 -2 -14 -22 q2 -10 10 -12', width: 7 },
    {
      d: 'M18 80 q-16 -2 -14 -22 q2 -10 10 -12',
      stroke: '#f0a8b4',
      width: 3.5,
    },
    { d: 'M36 94 l-4 12 M50 96 l0 11 M70 96 l2 11 M84 94 l4 11', width: 5 },
    {
      d: 'M36 94 l-4 12 M50 96 l0 11 M70 96 l2 11 M84 94 l4 11',
      stroke: '#f0a8b4',
      width: 2,
    },
    {
      d: 'M16 82 q0 -34 40 -36 q34 0 42 26 q-4 26 -42 26 q-36 0 -40 -16z',
      fill: '#8f939c',
      width: 4.5,
    },
    { d: 'M24 78 q14 14 50 8', stroke: '#d9dce2', width: 7 },
    { d: 'M30 56 q12 -8 28 -8', stroke: '#b6bac2', width: 4 },
    {
      d: 'M78 52 q14 -6 26 6 l12 10 q-10 8 -24 6 q-12 -2 -16 -12z',
      fill: '#f3f0e8',
      width: 4.5,
    },
    { d: circle(114, 68, 4), fill: '#f0a8b4', width: 2.5 },
    { d: 'M80 50 l-4 -16 l14 10z', fill: ART_INK, stroke: 'none' },
    { d: 'M80 48 l-2 -10 l7 6z', fill: '#f0a8b4', stroke: 'none' },
    { d: circle(96, 58, 5), fill: ART_INK, stroke: 'none' },
    { d: circle(97.5, 56.5, 1.6), fill: '#ffffff', stroke: 'none' },
    { d: 'M100 72 l10 4 M100 74 l8 8', width: 1.8 },
  ],
};

const MARIMBONDO: CreatureArt = {
  box: 120,
  parts: [
    { d: ellipse(60, 112, 22, 4), fill: 'rgba(0,0,0,0.3)', stroke: 'none' },
    {
      d: 'M52 44 q-30 -34 -44 -14 q4 20 44 20z',
      fill: 'rgba(214,236,255,0.6)',
      width: 3.5,
    },
    {
      d: 'M62 44 q14 -40 34 -26 q2 22 -34 30z',
      fill: 'rgba(214,236,255,0.5)',
      width: 3.5,
    },
    { d: 'M40 64 l-10 14 M50 70 l-6 14 M66 72 l2 14', width: 3.5 },
    { d: 'M20 80 q-6 -2 -10 8 l6 -2', width: 3.5 },
    {
      d: 'M12 70 a22 16 -16 1 0 44 0 a22 16 -16 1 0 -44 0z',
      fill: '#f2c230',
      width: 4.5,
    },
    { d: 'M22 60 q-2 14 4 24 M34 56 q-2 16 2 28', width: 5 },
    { d: 'M14 80 l-6 6', width: 4 },
    { d: ellipse(62, 58, 12, 10), fill: '#e9b83a', width: 4.5 },
    { d: circle(84, 50, 17), fill: '#f2c230', width: 4.5 },
    { d: 'M70 46 q14 -10 28 0', width: 4 },
    { d: ellipse(90, 50, 7, 8), fill: '#3a1a10', width: 2.5 },
    { d: circle(92, 47, 2), fill: '#ffffff', stroke: 'none' },
    { d: 'M80 34 q-4 -14 -12 -16 M90 34 q2 -14 10 -18', width: 3 },
    { d: 'M94 62 l6 6 M88 64 l2 8', width: 3 },
    { d: 'M24 46 q4 -6 10 -8', stroke: '#fff3b8', width: 3 },
  ],
};

const CURTO: CreatureArt = {
  box: 120,
  parts: [
    { d: ellipse(60, 108, 34, 6), fill: 'rgba(0,0,0,0.4)', stroke: 'none' },
    { d: 'M40 94 l-6 12 M80 94 l6 12', width: 6 },
    { d: 'M60 24 q-6 -10 2 -16 q6 -4 4 -10', width: 6 },
    { d: 'M60 24 q-6 -10 2 -16 q6 -4 4 -10', stroke: '#ff4a3d', width: 2.5 },
    { d: circle(60, 62, 36), fill: '#2b2f3a', width: 5 },
    {
      d: 'M34 46 l12 8 l-4 10 l12 6 M86 50 l-12 6 l6 10 l-10 8 M50 92 l6 -12 l10 4',
      stroke: '#ff8a3d',
      width: 4,
    },
    { d: 'M38 40 q8 -10 20 -12', stroke: '#4b5160', width: 5 },
    { d: 'M42 54 l14 4 M78 54 l-14 4', width: 4 },
    { d: ellipse(50, 64, 6, 5), fill: '#ffd36e', width: 2 },
    { d: ellipse(70, 64, 6, 5), fill: '#ffd36e', width: 2 },
    { d: circle(51, 65, 2.4), fill: ART_INK, stroke: 'none' },
    { d: circle(69, 65, 2.4), fill: ART_INK, stroke: 'none' },
    { d: 'M50 78 l5 -3 l5 3 l5 -3 l5 3', width: 3 },
    {
      d: 'M98 40 l10 -6 M100 58 l12 2 M20 40 l-10 -6 M18 60 l-12 2',
      stroke: '#ffb43a',
      width: 3,
    },
  ],
};

interface GatoLook {
  readonly wires: readonly [string, string, string];
  readonly head: string;
  readonly eye: string;
  readonly eyeHeight: number;
  readonly slit: number;
}

/** The Gato de Fios, in one of its looks: the colour of its wires tells its mood. */
function gatoArt(look: GatoLook, extra: readonly ArtPart[] = []): CreatureArt {
  const [w1, w2, w3] = look.wires;
  return {
    box: 100,
    parts: [
      { d: ellipse(50, 94, 34, 5), fill: 'rgba(0,0,0,0.45)', stroke: 'none' },
      { d: 'M84 70 q14 -6 10 -22 q-3 -10 4 -16', stroke: '#1b1d24', width: 7 },
      { d: 'M84 70 q14 -6 10 -22 q-3 -10 4 -16', stroke: w2, width: 3 },
      { d: 'M94 24 h7 v10 h-7z', fill: '#7a8296', width: 2 },
      {
        d: 'M18 88 q-6 -30 14 -40 q20 -8 38 0 q22 10 14 40z',
        fill: '#2b2f3a',
        width: 4,
      },
      { d: 'M22 80 q14 -20 30 -6 q16 12 28 -8', stroke: w1, width: 4 },
      { d: 'M24 66 q18 10 32 -4 q12 -10 24 2', stroke: w2, width: 4 },
      { d: 'M30 86 q8 -14 20 -10 q14 4 22 -6', stroke: w3, width: 3 },
      {
        d: 'M24 30 l-4 -22 l16 14z M76 30 l4 -22 l-16 14z',
        fill: '#7a8296',
        width: 4,
      },
      { d: circle(50, 36, 24), fill: look.head, width: 4 },
      { d: 'M30 30 q20 -8 40 0', stroke: w1, width: 3 },
      { d: 'M28 42 q22 8 44 0', stroke: w2, width: 3 },
      { d: ellipse(40, 36, 6, look.eyeHeight), fill: look.eye, stroke: 'none' },
      { d: ellipse(60, 36, 6, look.eyeHeight), fill: look.eye, stroke: 'none' },
      {
        d: `M38.5 ${36 - look.slit / 2} h3 v${look.slit} h-3z M58.5 ${36 - look.slit / 2} h3 v${look.slit} h-3z`,
        fill: '#0b1420',
        stroke: 'none',
      },
      { d: 'M44 48 l6 4 l6 -4', width: 3 },
      {
        d: 'M30 46 l-14 -2 M30 50 l-14 4 M70 46 l14 -2 M70 50 l14 4',
        stroke: w3,
        width: 2.5,
      },
      ...extra,
    ],
  };
}

const GATO_LIVE: GatoLook = {
  wires: ['#ff4a3d', '#e9b83a', '#5fd3ff'],
  head: '#3a3f4c',
  eye: '#9be4ff',
  eyeHeight: 7,
  slit: 10,
};

const GATO = gatoArt(GATO_LIVE);

/** Charging: white eyes, sparks all round — the zap comes in a second. */
const GATO_CHARGE = gatoArt(
  { ...GATO_LIVE, eye: '#ffffff', eyeHeight: 8, slit: 4 },
  [
    {
      d: 'M10 20 l8 6 l-4 4 l8 6 M90 18 l-8 6 l4 4 l-8 6 M6 60 l10 0 l-4 6 l10 0 M94 62 l-10 0 l4 6 l-10 0',
      stroke: '#9be4ff',
      width: 3,
    },
  ],
);

/** Drained after a zap: grey wires, eyes half shut — the time to strike. */
const GATO_DRAINED = gatoArt(
  {
    wires: ['#5a6070', '#5a6070', '#4b5160'],
    head: '#353a45',
    eye: '#4b5160',
    eyeHeight: 2,
    slit: 1,
  },
  [
    {
      d: 'M30 2 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3 l5 0z M66 0 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3 l5 0z',
      fill: '#ffd36e',
      width: 1.5,
    },
  ],
);

/** A boss's other looks, where it has them; anything else wears its art. */
export type BossPose = 'charge' | 'drained';

export const BOSS_POSES: Partial<
  Record<BossId, Partial<Record<BossPose, CreatureArt>>>
> = {
  gato: { charge: GATO_CHARGE, drained: GATO_DRAINED },
};

export const CREATURE_ART: Record<CreatureId, CreatureArt> = {
  sauva: SAUVA,
  pombo: POMBO,
  caramujo: CARAMUJO,
  queroquero: QUEROQUERO,
  faisca: FAISCA,
  gamba: GAMBA,
  marimbondo: MARIMBONDO,
  curto: CURTO,
};

export const BOSS_ART: Record<BossId, CreatureArt> = {
  rainha: RAINHA,
  gato: GATO,
};
