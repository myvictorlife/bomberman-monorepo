import { cellIndex, generateArena, inBounds, isPillar, tileAt } from './arena';
import {
  ARENA_COLS,
  ARENA_ROWS,
  POWER_UP_COUNTS,
  SPAWN_CELLS,
} from './constants';
import { createGame } from './game';
import { DEFAULT_MAP_ID, findMap, isExtraWall } from './maps';
import { createRng, shuffle } from './rng';

describe('generateArena', () => {
  it('is 15 × 13 with walls on the border, the even pillars and the map’s extras', () => {
    const map = findMap(DEFAULT_MAP_ID);
    const arena = generateArena(42);

    expect(arena.tiles).toHaveLength(ARENA_COLS * ARENA_ROWS);
    for (let row = 0; row < ARENA_ROWS; row++) {
      for (let col = 0; col < ARENA_COLS; col++) {
        const tile = arena.tiles[row * ARENA_COLS + col];
        expect(tile === 'wall').toBe(
          isPillar(col, row) || isExtraWall(map, col, row),
        );
      }
    }
  });

  it('keeps every spawn and the 3 × 3 box around it free of crates', () => {
    for (const seed of [7, 42, 1234]) {
      const arena = generateArena(seed);
      for (const [col, row] of SPAWN_CELLS) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            expect(arena.tiles[(row + dr) * ARENA_COLS + col + dc]).not.toBe(
              'block',
            );
          }
        }
      }
    }
  });

  it('spawns a fifth player in the middle, with a way out sideways', () => {
    const centre = SPAWN_CELLS[4] as readonly [number, number];
    const arena = generateArena(99);

    expect(centre).toEqual([7, 6]);
    expect(arena.tiles[6 * ARENA_COLS + 7]).toBe('empty');
    // Up and down are open, and from each the row turns both ways.
    for (const [col, row] of [
      [7, 5],
      [7, 7],
      [6, 5],
      [8, 5],
      [6, 7],
      [8, 7],
    ]) {
      expect(arena.tiles[(row as number) * ARENA_COLS + (col as number)]).toBe(
        'empty',
      );
    }
  });

  it('hides exactly the configured power-ups, only under soft blocks', () => {
    const arena = generateArena(3);
    const hidden = arena.hiddenPowerUps.filter((p) => p !== null);

    expect(hidden).toHaveLength(
      Object.values(POWER_UP_COUNTS).reduce((sum, n) => sum + n, 0),
    );
    arena.hiddenPowerUps.forEach((p, i) => {
      if (p) expect(arena.tiles[i]).toBe('block');
    });
    expect(hidden.filter((p) => p === 'speed')).toHaveLength(
      POWER_UP_COUNTS.speed,
    );
    expect(hidden.filter((p) => p === 'egg')).toHaveLength(POWER_UP_COUNTS.egg);
  });

  it('is deterministic for a seed and varies between seeds', () => {
    expect(generateArena(99)).toEqual(generateArena(99));
    expect(generateArena(1).tiles).not.toEqual(generateArena(2).tiles);
  });
});

describe('arena helpers', () => {
  const state = createGame({ seed: 1, players: [{ id: 'a', name: 'A' }] });

  it('treats out-of-bounds cells as walls', () => {
    expect(inBounds(state, -1, 0)).toBe(false);
    expect(inBounds(state, 0, ARENA_ROWS)).toBe(false);
    expect(tileAt(state, -1, 5)).toBe('wall');
    expect(tileAt(state, 1, 1)).toBe('empty');
  });

  it('indexes cells row-major', () => {
    expect(cellIndex(state, 3, 2)).toBe(2 * ARENA_COLS + 3);
  });
});

describe('rng', () => {
  it('produces the same sequence for the same seed, in [0, 1)', () => {
    const a = createRng(5);
    const b = createRng(5);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('shuffles in place without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = shuffle(items, createRng(1));

    expect(result).toBe(items);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
