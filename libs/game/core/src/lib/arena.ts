import {
  ARENA_COLS,
  ARENA_ROWS,
  BLOCK_DENSITY,
  POWER_UP_COUNTS,
  SPAWN_CELLS,
  VIEW_COLS,
} from './constants';
import { DEFAULT_MAP_ID, findMap, isExtraWall, MapDefinition } from './maps';
import { createRng, shuffle } from './rng';
import { GameState, PowerUpKind, Tile } from './types';

export interface Arena {
  cols: number;
  rows: number;
  tiles: Tile[];
  hiddenPowerUps: (PowerUpKind | null)[];
}

/**
 * The shape of an arena: its size and where each player slot starts. A round
 * is played on {@link CLASSIC_LAYOUT}; a stage may bring its own — a longer
 * one, players starting elsewhere — with the same grid of pillars.
 */
export interface ArenaLayout {
  readonly cols: number;
  readonly rows: number;
  /** One per player slot, as `[col, row]`; the most players it takes. */
  readonly spawns: readonly (readonly [number, number])[];
}

export const CLASSIC_LAYOUT: ArenaLayout = {
  cols: ARENA_COLS,
  rows: ARENA_ROWS,
  spawns: SPAWN_CELLS,
};

/** Hard walls: the border, plus a pillar on every even column of every even row. */
export function isPillar(
  col: number,
  row: number,
  layout: Pick<ArenaLayout, 'cols' | 'rows'> = CLASSIC_LAYOUT,
): boolean {
  return (
    col === 0 ||
    row === 0 ||
    col === layout.cols - 1 ||
    row === layout.rows - 1 ||
    (col % 2 === 0 && row % 2 === 0)
  );
}

/**
 * The 3 × 3 box around every spawn starts free of crates. In a corner the
 * diagonal is a pillar, so that is the corner and its two neighbours; in the
 * middle, where the sideways neighbours are pillars, it also frees the cells
 * above and below on both sides — room to drop a bomb and turn out of its line.
 */
export function isSpawnZone(
  col: number,
  row: number,
  spawns: ArenaLayout['spawns'] = SPAWN_CELLS,
): boolean {
  return spawns.some(
    ([sc, sr]) => Math.abs(sc - col) <= 1 && Math.abs(sr - row) <= 1,
  );
}

/**
 * Builds the battle arena: the grid of the layout plus the map's extra walls.
 * The same seed, map and layout always give the same arena.
 */
export function generateArena(
  seed: number,
  map: MapDefinition = findMap(DEFAULT_MAP_ID),
  layout: ArenaLayout = CLASSIC_LAYOUT,
): Arena {
  const rng = createRng(seed);
  const tiles: Tile[] = [];
  const blockCells: number[] = [];

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (isPillar(col, row, layout) || isExtraWall(map, col, row)) {
        tiles.push('wall');
      } else if (
        !isSpawnZone(col, row, layout.spawns) &&
        rng() < BLOCK_DENSITY
      ) {
        blockCells.push(tiles.length);
        tiles.push('block');
      } else {
        tiles.push('empty');
      }
    }
  }

  const hiddenPowerUps: (PowerUpKind | null)[] = tiles.map(() => null);
  const kinds = Object.entries(POWER_UP_COUNTS).flatMap(([kind, count]) =>
    Array.from({ length: count }, () => kind as PowerUpKind),
  );
  shuffle(blockCells, rng)
    .slice(0, kinds.length)
    .forEach((cell, i) => (hiddenPowerUps[cell] = kinds[i] ?? null));

  return { cols: layout.cols, rows: layout.rows, tiles, hiddenPowerUps };
}

export function cellIndex(
  state: Pick<GameState, 'cols'>,
  col: number,
  row: number,
): number {
  return row * state.cols + col;
}

export function inBounds(
  state: Pick<GameState, 'cols' | 'rows'>,
  col: number,
  row: number,
): boolean {
  return col >= 0 && row >= 0 && col < state.cols && row < state.rows;
}

export function tileAt(state: GameState, col: number, row: number): Tile {
  return inBounds(state, col, row) && !isOutOfView(state, col)
    ? (state.tiles[cellIndex(state, col, row)] ?? 'wall')
    : 'wall';
}

/**
 * Whether column `col` is outside the part of a long stage in play. Out there
 * everything — players, creatures, flames, a thrown bomb — meets a wall.
 */
export function isOutOfView(
  state: Pick<GameState, 'stage'>,
  col: number,
): boolean {
  const view = state.stage?.view ?? null;
  return view !== null && (col < view || col >= view + VIEW_COLS);
}
