import {
  cellIndex,
  CHARACTERS,
  createGame,
  DEFAULT_MAP_ID,
  GameState,
  MapId,
  PowerUpKind,
} from '@libs/game-core';
import { HD_TILE } from '../skins/hd/hd-palette';
import { paintHdTextures } from '../skins/hd/hd-painter';
import { paintEgg } from '../skins/hd/egg';
import { themeTextures, tileTextureKey } from '../skins/hd/themes';
import { TEXTURE } from '../skins/texture-keys';

/**
 * Still pictures of the game for pages around it (the title screen, the
 * lobby), painted with the real skin on a plain 2D canvas — no Phaser, so
 * they cost nothing to load. The textures are painted once per page.
 */
let cache: Map<string, HTMLCanvasElement> | null = null;

function textures(doc: Document): Map<string, HTMLCanvasElement> {
  // The roster in slot order, so the title screen shows the real cast.
  cache ??= paintHdTextures(
    doc,
    CHARACTERS.map((c) => c.id),
  );
  return cache;
}

/** One cell with a flame in the preview — a staged mid-match moment. */
const STAGED = {
  bomb: { col: 9, row: 5 },
  blast: { col: 3, row: 7, range: 2 },
  powerUps: [
    { col: 7, row: 3, kind: 'fire' as PowerUpKind },
    { col: 11, row: 9, kind: 'speed' as PowerUpKind },
    { col: 5, row: 11, kind: 'bomb' as PowerUpKind },
  ],
  /** Players are moved off their corners so the picture looks like play. */
  players: [
    { x: 3, y: 1, facing: 'right' },
    { x: 11.4, y: 11, facing: 'left' },
    { x: 13, y: 3.3, facing: 'down' },
    { x: 1, y: 9, facing: 'up' },
  ] as const,
};

export interface TextureLookup {
  get(key: string): HTMLCanvasElement | undefined;
}

/** The skin's textures for a map, painted once per page: the theme's tiles over the base set. */
export function previewTextures(
  doc: Document,
  mapId: MapId = DEFAULT_MAP_ID,
): TextureLookup {
  const base = textures(doc);
  const theme = themeTextures(doc, mapId);
  return { get: (key) => theme.get(key) ?? base.get(key) };
}

/** Paints a mid-match arena into `canvas` (resized to the arena's pixel size). */
export function paintArenaPreview(
  canvas: HTMLCanvasElement,
  seed = 7,
  mapId: MapId = DEFAULT_MAP_ID,
): void {
  const tex = previewTextures(canvas.ownerDocument, mapId);
  const S = HD_TILE;
  const state = stageArena(seed, mapId);
  canvas.width = state.cols * S;
  canvas.height = state.rows * S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const draw = (key: string, x: number, y: number) => {
    const image = tex.get(key);
    if (image) ctx.drawImage(image, x * S, y * S);
  };

  const solid = (col: number, row: number) =>
    state.tiles[cellIndex(state, col, row)] !== 'empty';

  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const tile = state.tiles[cellIndex(state, col, row)] ?? 'wall';
      draw(tileTextureKey(state, col, row, tile, solid), col, row);
    }
  }

  const shadow = (x: number, y: number) => {
    const image = tex.get(TEXTURE.shadow);
    if (image) ctx.drawImage(image, x * S, y * S + S * 0.36);
  };
  for (const p of STAGED.powerUps) draw(TEXTURE.powerUp(p.kind), p.col, p.row);
  shadow(STAGED.bomb.col, STAGED.bomb.row);
  draw(TEXTURE.bomb(1), STAGED.bomb.col, STAGED.bomb.row);

  const { col, row, range } = STAGED.blast;
  draw(TEXTURE.flame('center', 0), col, row);
  const arms = [
    { dx: 1, dy: 0, mid: 'horizontal', end: 'end-right' },
    { dx: -1, dy: 0, mid: 'horizontal', end: 'end-left' },
    { dx: 0, dy: 1, mid: 'vertical', end: 'end-down' },
    { dx: 0, dy: -1, mid: 'vertical', end: 'end-up' },
  ] as const;
  for (const arm of arms) {
    for (let i = 1; i <= range; i++) {
      const c = col + arm.dx * i;
      const r = row + arm.dy * i;
      if (solid(c, r)) break;
      draw(TEXTURE.flame(i === range ? arm.end : arm.mid, 0), c, r);
    }
  }

  STAGED.players.forEach((p, slot) => {
    shadow(p.x, p.y);
    const image = tex.get(TEXTURE.player(slot, p.facing, 0));
    if (image) ctx.drawImage(image, p.x * S, p.y * S - S * 0.12);
  });

  // Vignette, as in the live arena.
  const g = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) * 0.72,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** Paints one power-up tile into `canvas` at its own size. */
export function paintPowerUpIcon(
  canvas: HTMLCanvasElement,
  kind: PowerUpKind,
): void {
  const image = textures(canvas.ownerDocument).get(TEXTURE.powerUp(kind));
  const ctx = canvas.getContext('2d');
  if (!image || !ctx) return;
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
}

/** A fresh arena with the staged cells cleared so the props have room. */
function stageArena(seed: number, mapId: MapId): GameState {
  const state = createGame({
    seed,
    mapId,
    players: [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: `P${n}` })),
  });
  const clear = (col: number, row: number) => {
    const i = cellIndex(state, col, row);
    if (state.tiles[i] === 'block') state.tiles[i] = 'empty';
  };
  const { col, row, range } = STAGED.blast;
  for (let i = -range; i <= range; i++) {
    clear(col + i, row);
    clear(col, row + i);
  }
  clear(STAGED.bomb.col, STAGED.bomb.row);
  for (const p of STAGED.powerUps) clear(p.col, p.row);
  for (const p of STAGED.players) {
    clear(Math.floor(p.x), Math.floor(p.y));
    clear(Math.ceil(p.x), Math.ceil(p.y));
  }
  return state;
}

/**
 * Paints a row of textures into `canvas` — one tile each, `gap` pixels apart.
 * For small illustrations next to text: a bomb, a crate with a flame, a line
 * of power-ups. Use the `TEXTURE` helpers to name the sprites.
 */
export function paintSprites(
  canvas: HTMLCanvasElement,
  keys: readonly string[],
  gap = 8,
): void {
  const tex = textures(canvas.ownerDocument);
  const S = HD_TILE;
  canvas.width = keys.length * S + Math.max(0, keys.length - 1) * gap;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  keys.forEach((key, i) => {
    const image = tex.get(key);
    if (image) ctx.drawImage(image, i * (S + gap), 0);
  });
}

export interface ItemPaintOptions {
  /** Egg only: how cracked it is, 0 … EGG_STAGES - 1. */
  stage?: number;
  /** Egg only: tilt in radians, for the wobble. */
  tilt?: number;
}

/**
 * Paints one item — a power-up, or the egg in a given state — into a context
 * whose unit space is the tile (64 per side). For item galleries and HUDs.
 */
export function paintItem(
  ctx: CanvasRenderingContext2D,
  kind: PowerUpKind,
  options: ItemPaintOptions = {},
): void {
  if (kind === 'egg') {
    paintEgg(ctx, options);
    return;
  }
  const image = textures(ctx.canvas.ownerDocument).get(TEXTURE.powerUp(kind));
  if (image) ctx.drawImage(image, 0, 0);
}

/**
 * Paints one tile of an arena's theme (its floor, pillar, block, border, top
 * row or feature) — falling back to the skin's own tile when the theme has
 * none — into a context whose unit space is the tile.
 */
export function paintArenaTile(
  ctx: CanvasRenderingContext2D,
  mapId: MapId,
  key: string,
): void {
  const doc = ctx.canvas.ownerDocument;
  const image = themeTextures(doc, mapId).get(key) ?? textures(doc).get(key);
  if (image) ctx.drawImage(image, 0, 0);
}
