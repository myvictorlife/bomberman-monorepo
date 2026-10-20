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

export const CREATURE_ART: Record<CreatureId, CreatureArt> = {
  sauva: SAUVA,
  pombo: POMBO,
  caramujo: CARAMUJO,
  queroquero: QUEROQUERO,
};

export const BOSS_ART: Record<BossId, CreatureArt> = {
  rainha: RAINHA,
};
