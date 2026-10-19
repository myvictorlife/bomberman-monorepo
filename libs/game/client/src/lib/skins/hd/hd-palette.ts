/** Colours of the HD skin, kept apart from the painter so the HUD can use them cheaply. */

export const HD_TILE = 64;

export interface HdPlayerColors {
  helmet: string;
  helmetLight: string;
  helmetDark: string;
  suit: string;
  suitDark: string;
}

/** White, graphite, coral, azure and jade — muted, so they sit on the dark arena. */
export const HD_PLAYER_COLORS: readonly HdPlayerColors[] = [
  {
    helmet: '#eef0f4',
    helmetLight: '#ffffff',
    helmetDark: '#9aa3b5',
    suit: '#3d7bdc',
    suitDark: '#1f4a92',
  },
  {
    helmet: '#3a3f4c',
    helmetLight: '#6a7184',
    helmetDark: '#171a22',
    suit: '#d9dde6',
    suitDark: '#8c93a4',
  },
  {
    helmet: '#e8575a',
    helmetLight: '#ffa29a',
    helmetDark: '#8a2326',
    suit: '#eef0f4',
    suitDark: '#a3a9b8',
  },
  {
    helmet: '#3f94ea',
    helmetLight: '#a6d2ff',
    helmetDark: '#1c4a8e',
    suit: '#f1c744',
    suitDark: '#9a7a14',
  },
  {
    helmet: '#3fb67a',
    helmetLight: '#9be8bf',
    helmetDark: '#1d6b45',
    suit: '#eef0f4',
    suitDark: '#a3a9b8',
  },
  {
    helmet: '#8b5cf6',
    helmetLight: '#c4adff',
    helmetDark: '#4c2a96',
    suit: '#eef0f4',
    suitDark: '#a3a9b8',
  },
  {
    helmet: '#f08a3c',
    helmetLight: '#ffc192',
    helmetDark: '#94481a',
    suit: '#eef0f4',
    suitDark: '#a3a9b8',
  },
  {
    helmet: '#e86aa6',
    helmetLight: '#ffb3d6',
    helmetDark: '#8f2c5e',
    suit: '#eef0f4',
    suitDark: '#a3a9b8',
  },
];

/**
 * A modern arena at night: graphite floor, matte stone, warm crates, and one
 * accent — the cyan edge light every solid thing catches.
 */
export const HD = {
  outline: 'rgba(8, 10, 16, 0.75)',
  accent: '#5fd3ff',
  visor: '#10141f',
  visorLight: '#2a3348',
  eye: '#7df0ff',
  glove: '#f28aa8',
  gloveDark: '#a84b6d',
  boot: '#d84c78',
  bootDark: '#86224a',
  belt: '#f2c94c',
  beltDark: '#9a7a14',
  floor: '#2b303c',
  floorDark: '#1f2330',
  floorSeam: 'rgba(255, 255, 255, 0.045)',
  stoneTop: '#4a5163',
  stoneTopDark: '#353b4a',
  stoneSide: '#22262f',
  stoneSideDark: '#15181f',
  crate: '#b58658',
  crateDark: '#7a5636',
  crateEdge: '#5a3e28',
  bracket: '#5d6475',
  bracketDark: '#2f3440',
  metal: '#b8c0cf',
  metalDark: '#5f6778',
  fuse: '#d8c39a',
} as const;
