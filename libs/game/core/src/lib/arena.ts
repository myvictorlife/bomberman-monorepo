import {
  ARENA_COLS,
  ARENA_ROWS,
  BLOCK_DENSITY,
  POWER_UP_COUNTS,
  SPAWN_CELLS,
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

/** Hard walls: the border, plus a pillar on every even column of every even row. */
export function isPillar(col: number, row: number): boolean {
  return (
    col === 0 ||
    row === 0 ||
    col === ARENA_COLS - 1 ||
    row === ARENA_ROWS - 1 ||
    (col % 2 === 0 && row % 2 === 0)
  );
}

/**
 * The 3 × 3 box around every spawn starts free of crates. In a corner the
 * diagonal is a pillar, so that is the corner and its two neighbours; in the
 * middle, where the sideways neighbours are pillars, it also frees the cells
 * above and below on both sides — room to drop a bomb and turn out of its line.
 */
export function isSpawnZone(col: number, row: number): boolean {
  return SPAWN_CELLS.some(
    ([sc, sr]) => Math.abs(sc - col) <= 1 && Math.abs(sr - row) <= 1,
  );
}

/**
 * Builds the battle arena: the classic grid plus the map's extra walls. The
 * same seed and map always give the same arena.
 */
export function generateArena(
  seed: number,
  map: MapDefinition = findMap(DEFAULT_MAP_ID),
): Arena {
  const rng = createRng(seed);
  const tiles: Tile[] = [];
  const blockCells: number[] = [];

  for (let row = 0; row < ARENA_ROWS; row++) {
    for (let col = 0; col < ARENA_COLS; col++) {
      if (isPillar(col, row) || isExtraWall(map, col, row)) {
        tiles.push('wall');
      } else if (!isSpawnZone(col, row) && rng() < BLOCK_DENSITY) {
        blockCells.push(tiles.length);
        tiles.push('block');
      } else {
        tiles.push('empty');
      }
    }
  }

  const hiddenPowerUps: (PowerUpKind | null)[] = tiles.map(() => null);
  const kinds = (Object.keys(POWER_UP_COUNTS) as PowerUpKind[]).flatMap(
    (kind) => Array.from({ length: POWER_UP_COUNTS[kind] }, () => kind),
  );
  shuffle(blockCells, rng)
    .slice(0, kinds.length)
    .forEach((cell, i) => (hiddenPowerUps[cell] = kinds[i] ?? null));

  return { cols: ARENA_COLS, rows: ARENA_ROWS, tiles, hiddenPowerUps };
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
  return inBounds(state, col, row)
    ? (state.tiles[cellIndex(state, col, row)] ?? 'wall')
    : 'wall';
}
