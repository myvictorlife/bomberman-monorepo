/**
 * Pixel art for the classic skin, as data: one string per row, one character
 * per pixel, `.` is transparent. Original art in the style of the 16-bit
 * battle games — a placeholder until the final art replaces this skin.
 */

export type PixelGrid = readonly string[];
export type Palette = Readonly<Record<string, string>>;

export const TILE = 16;

// ── Players ────────────────────────────────────────────────────────────────
// W/S helmet + shade · B/b suit + shade · V visor · E eyes · Y belt
// P gloves · F boots · K outline

const HEAD_TOP: PixelGrid = [
  '................',
  '.....KKKKKK.....',
  '...KKWWWWWWKK...',
];

const DOWN_BODY: PixelGrid = [
  ...HEAD_TOP,
  '..KWWWWWWWWWSK..',
  '.KWWWWWWWWWWWSK.',
  '.KWWKKKKKKKKWSK.',
  '.KWKVVVVVVVVKSK.',
  '.KWKVVEVVEVVKSK.',
  '.KWKVVEVVEVVKSK.',
  '.KWWKKKKKKKKWSK.',
  '..KSWWWWWWWWSK..',
  '..KPKBBBBBBKPK..',
  '..KPKBBYYBBKPK..',
  '...KKbBBBBbKK...',
];

const UP_BODY: PixelGrid = [
  ...HEAD_TOP,
  '..KWWWWWWWWWSK..',
  '.KWWWWWWWWWWWSK.',
  '.KWWWWWWWWWWWSK.',
  '.KWWWWWWWWWWWSK.',
  '.KSWWWWWWWWWWSK.',
  '.KSSWWWWWWWWSSK.',
  '..KSSSSSSSSSSK..',
  '..KKKKKKKKKKKK..',
  '..KPKBBBBBBKPK..',
  '..KPKBBBBBBKPK..',
  '...KKbBBBBbKK...',
];

const SIDE_BODY: PixelGrid = [
  ...HEAD_TOP,
  '..KWWWWWWWWWWK..',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWKKKKKKK.',
  '.KWWWWWKVVVVVVK.',
  '.KSWWWWKVVVVEVK.',
  '.KSWWWWKVVVVEVK.',
  '.KSSWWWWKKKKKKK.',
  '..KSSWWWWWWWWK..',
  '...KBBBBBBPK....',
  '...KBBYYBBPK....',
  '...KKbBBBBKK....',
];

/** Two leg rows per frame: standing, step one, step two. */
const FRONT_LEGS: readonly PixelGrid[] = [
  ['....KFFKKFFK....', '....KKKKKKKK....'],
  ['....KFFKKKK.....', '....KKKK........'],
  ['.....KKKKFFK....', '........KKKK....'],
];

const SIDE_LEGS: readonly PixelGrid[] = [
  ['.....KFFFK......', '.....KKKKK......'],
  ['....KFFKKFFK....', '....KKKKKKKK....'],
  ['......KFFFK.....', '......KKKKK.....'],
];

export type PlayerPose = 'down' | 'up' | 'side';

/** The full 16 × 16 frame. Facing left is facing right, mirrored. */
export function playerGrid(pose: PlayerPose, frame: number): PixelGrid {
  const body =
    pose === 'down' ? DOWN_BODY : pose === 'up' ? UP_BODY : SIDE_BODY;
  const legs = (pose === 'side' ? SIDE_LEGS : FRONT_LEGS)[frame];
  if (!legs) throw new Error(`no player frame ${frame}`);
  return [...body, ...legs];
}

const PLAYER_COMMON: Palette = {
  K: '#14141c',
  V: '#1c2438',
  E: '#7fe8ff',
  Y: '#f8d030',
  P: '#f088a8',
  F: '#c84070',
};

/** One palette per slot: white, black, red, blue and green, like a 5-player battle. */
export const PLAYER_PALETTES: readonly Palette[] = [
  { ...PLAYER_COMMON, W: '#f8f8f8', S: '#b8c0d8', B: '#3868e0', b: '#2848a8' },
  { ...PLAYER_COMMON, W: '#55556a', S: '#33333f', B: '#d8d8e0', b: '#a0a0b0' },
  { ...PLAYER_COMMON, W: '#f05050', S: '#a83030', B: '#f8f8f8', b: '#c0c0cc' },
  { ...PLAYER_COMMON, W: '#58a0f8', S: '#3060c0', B: '#f8d838', b: '#c0a020' },
  { ...PLAYER_COMMON, W: '#48c878', S: '#288048', B: '#f8f8f8', b: '#c0c0cc' },
];

// ── Power-up icons (12 × 12, drawn on a 16 × 16 panel) ─────────────────────

export const FLAME_ICON: PixelGrid = [
  '.....O......',
  '.....OO.....',
  '....OOO.....',
  '....OYOO....',
  '...OOYYOO...',
  '..OOYYYYO...',
  '..OYYWYYOO..',
  '.OOYWWWYYO..',
  '.OYYWWWWYO..',
  '.OYYWWWWYO..',
  '..OYYWWYYO..',
  '...OOOOOO...',
];
export const FLAME_ICON_PALETTE: Palette = {
  O: '#e83010',
  Y: '#f8a020',
  W: '#fff8c0',
};

export const SKATE_ICON: PixelGrid = [
  '............',
  '..KKKK......',
  '..KBBK......',
  '..KBLK......',
  '..KBBK......',
  '..KBLKKK....',
  '..KBBBBBK...',
  '..KBBBBBBK..',
  '..KKKKKKKKK.',
  '...KRK.KRK..',
  '...KKK.KKK..',
  '............',
];
export const SKATE_ICON_PALETTE: Palette = {
  K: '#14141c',
  B: '#e83838',
  L: '#f8f8f8',
  R: '#9898a8',
};

export const EGG_ICON: PixelGrid = [
  '............',
  '....WWWW....',
  '...WWWWWW...',
  '..WWGWWWWW..',
  '..WWWWWGWW..',
  '..WGWWWWWW..',
  '..WWWWGWWW..',
  '..WWWWWWWW..',
  '...WGWWWW...',
  '...WWWWGW...',
  '....WWWW....',
  '............',
];
export const EGG_ICON_PALETTE: Palette = { W: '#f8f4e0', G: '#60a860' };

export const POWER_UP_PANELS = {
  bomb: { fill: '#3858d8', light: '#7890f0', dark: '#203490' },
  fire: { fill: '#d84830', light: '#f08868', dark: '#882818' },
  speed: { fill: '#e0b020', light: '#f8d870', dark: '#8a6a10' },
  egg: { fill: '#38a058', light: '#78d890', dark: '#1c6030' },
  pierce: { fill: '#c83838', light: '#f08080', dark: '#701818' },
  remote: { fill: '#4858b8', light: '#8898f0', dark: '#283080' },
  vest: { fill: '#30a090', light: '#70d8c8', dark: '#186058' },
  glove: { fill: '#d88830', light: '#f8c070', dark: '#884818' },
  kick: { fill: '#8848c8', light: '#c090f0', dark: '#482078' },
  wallpass: { fill: '#9a7a5a', light: '#d0b090', dark: '#5a4028' },
  fullfire: { fill: '#e86020', light: '#f8a060', dark: '#902808' },
  powerbomb: { fill: '#a01818', light: '#e05050', dark: '#580808' },
  skull: { fill: '#383848', light: '#707088', dark: '#18181f' },
  clock: { fill: '#2878a8', light: '#70b0e0', dark: '#104868' },
  oneup: { fill: '#d83878', light: '#f080b0', dark: '#801840' },
} as const;

export const WALLPASS_ICON: PixelGrid = [
  '............',
  '.BBBBB.BBBB.',
  '.BBBBB.BBBB.',
  '............',
  '.BB.WWW.BBB.',
  '.BB.WKWKBBB.',
  '....WWWW....',
  '.BBBWWWW.BB.',
  '.BBBW.W.WBB.',
  '............',
  '.BBBBB.BBBB.',
  '............',
];
export const WALLPASS_ICON_PALETTE: Palette = {
  B: '#c8a078',
  W: '#f0f0f8',
  K: '#14141c',
};

export const FULLFIRE_ICON: PixelGrid = [
  '.....RR.....',
  '....RRRR....',
  '...RRYYRR...',
  '..RRYYYYRR..',
  '..RYYWWYYR..',
  '.RRYWWWWYRR.',
  '.RYYWWWWYYR.',
  '.RYYYWWYYYR.',
  '..RYYYYYYR..',
  '...RRRRRR...',
  '.KKKKKKKKKK.',
  '.KWWWWWWWWK.',
];
export const FULLFIRE_ICON_PALETTE: Palette = {
  R: '#e83818',
  Y: '#ffc040',
  W: '#fff8d0',
  K: '#14141c',
};

export const POWERBOMB_ICON: PixelGrid = [
  '.......YY...',
  '......Y..Y..',
  '.....KK.....',
  '...KKKKKK...',
  '..KKKKKKKK..',
  '.KKWKKKKKKK.',
  '.KWKKKKKKKK.',
  '.KKKKRRKKKK.',
  '.KKKRRRRKKK.',
  '..KKKRRKKK..',
  '...KKKKKK...',
  '............',
];
export const POWERBOMB_ICON_PALETTE: Palette = {
  K: '#14141c',
  W: '#ffffff',
  R: '#ff4030',
  Y: '#ffd870',
};

export const SKULL_ICON: PixelGrid = [
  '............',
  '...WWWWWW...',
  '..WWWWWWWW..',
  '.WWWWWWWWWW.',
  '.WKKWWWWKKW.',
  '.WKKWWWWKKW.',
  '.WWWWKKWWWW.',
  '..WWWWWWWW..',
  '...WKWKWW...',
  '...WWWWWW...',
  '....W.W.....',
  '............',
];
export const SKULL_ICON_PALETTE: Palette = { W: '#e8e8f0', K: '#14141c' };

export const CLOCK_ICON: PixelGrid = [
  '............',
  '....KKKK....',
  '..KKWWWWKK..',
  '..KWWWKWWK..',
  '.KWWWWKWWWK.',
  '.KWWWWKWWWK.',
  '.KWWWWKKKWK.',
  '.KWWWWWWWWK.',
  '..KWWWWWWK..',
  '..KKWWWWKK..',
  '....KKKK....',
  '............',
];
export const CLOCK_ICON_PALETTE: Palette = { W: '#f8f4e0', K: '#14141c' };

export const ONEUP_ICON: PixelGrid = [
  '............',
  '..RR....RR..',
  '.RRRR..RRRR.',
  '.RWRRRRRRRR.',
  '.RRRRRRRRRR.',
  '.RRRRRRRRRR.',
  '..RRRRRRRR..',
  '...RRRRRR...',
  '....RRRR....',
  '.....RR.....',
  '............',
  '............',
];
export const ONEUP_ICON_PALETTE: Palette = { R: '#ff3060', W: '#ffd0e0' };

export const PIERCE_ICON: PixelGrid = [
  '............',
  '......K.....',
  '......KK....',
  '.KKKKKKKKK..',
  '.KYYYYYYYYK.',
  '.KKKKKKKKKK.',
  '......KK....',
  '......K.....',
  '..BBBBBB....',
  '..BBBBBB....',
  '..BBBBBB....',
  '............',
];
export const PIERCE_ICON_PALETTE: Palette = {
  K: '#14141c',
  Y: '#ffd870',
  B: '#c06838',
};

export const REMOTE_ICON: PixelGrid = [
  '........K...',
  '.......K....',
  '...KKKKK....',
  '...KGGGK....',
  '...KGGGK....',
  '...KGRGK....',
  '...KRRRK....',
  '...KGRGK....',
  '...KGGGK....',
  '...KWWWK....',
  '...KGGGK....',
  '...KKKKK....',
];
export const REMOTE_ICON_PALETTE: Palette = {
  K: '#14141c',
  G: '#9898a8',
  R: '#f03838',
  W: '#f8f8f8',
};

export const VEST_ICON: PixelGrid = [
  '............',
  '..KKKKKKKK..',
  '.KWWWWWWWWK.',
  '.KWWWKKWWWK.',
  '.KWWWKKWWWK.',
  '.KWWWKKWWWK.',
  '..KWWKKWWK..',
  '..KWWKKWWK..',
  '...KWKKWK...',
  '....KWWK....',
  '.....KK.....',
  '............',
];
export const VEST_ICON_PALETTE: Palette = { K: '#14141c', W: '#a8f0e0' };

/** A glove holding a bomb up. */
export const GLOVE_ICON: PixelGrid = [
  '....KKK.....',
  '...KBBBK.Y..',
  '...KBBBKK...',
  '....KKK.....',
  '.KK.KK.KK...',
  'KWWKWWKWWK..',
  'KWWWWWWWWWK.',
  'KWWWWWWWWWK.',
  '.KWWWWWWWK..',
  '..KOOOOOK...',
  '..KOOOOOK...',
  '...KKKKK....',
];
export const GLOVE_ICON_PALETTE: Palette = {
  K: '#14141c',
  W: '#f8f0e0',
  B: '#303848',
  O: '#f07828',
  Y: '#f8e060',
};

/** A sneaker kicking a bomb, speed lines behind. */
export const KICK_ICON: PixelGrid = [
  '............',
  '........KKK.',
  '.......KBBBK',
  '.WW.KK.KBBBK',
  '....KPK.KKK.',
  'WWW.KPPK....',
  '....KPPPKK..',
  '.WW.KPPPPPK.',
  '....KWWWWWK.',
  '.....KKKKK..',
  '............',
  '............',
];
export const KICK_ICON_PALETTE: Palette = {
  K: '#14141c',
  W: '#f8f8f8',
  B: '#303848',
  P: '#c090f0',
};

// ── Arena ──────────────────────────────────────────────────────────────────

export const ARENA_COLORS = {
  grass: '#2f8f3f',
  grassDetail: '#2a7f38',
  grassShadow: '#1f5f2a',
  wall: '#a8a8b8',
  wallLight: '#e0e0e8',
  wallDark: '#5c5c6c',
  wallInner: '#bcbccc',
  brick: '#c06838',
  brickLight: '#e89060',
  mortar: '#5a2a14',
  bombBody: '#22222e',
  bombShine: '#50506a',
  bombOutline: '#0a0a10',
  fuse: '#d8b070',
  spark: '#ffd040',
  sparkHot: '#fff2a0',
  flameOuter: '#e83010',
  flameMid: '#f8a020',
  flameInner: '#fff8c0',
} as const;

/**
 * Flame band half-widths (in pixels) per frame, outer → inner layer.
 * Frame 0 is the full blast, frame 3 the last flicker.
 */
export const FLAME_BANDS: readonly (readonly [number, number, number])[] = [
  [7, 5, 2.5],
  [6, 4, 2],
  [4, 3, 1.5],
  [2.5, 1.5, 0.6],
];
