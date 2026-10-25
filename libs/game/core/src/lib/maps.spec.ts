import { generateArena, isPillar } from './arena';
import { ARENA_COLS, ARENA_ROWS } from './constants';
import { createGame } from './game';
import { DEFAULT_MAP_ID, findMap, isExtraWall, isMapId, MAPS } from './maps';

describe('maps', () => {
  it('knows its ids and falls back to the first map', () => {
    expect(isMapId('autodromo')).toBe(true);
    expect(isMapId('gramado')).toBe(true);
    expect(isMapId('lua')).toBe(false);
    expect(findMap('autodromo').id).toBe('autodromo');
    expect(findMap('nope' as never).id).toBe(MAPS[0]?.id);
    expect(MAPS.some((m) => m.id === DEFAULT_MAP_ID)).toBe(true);
  });

  it('adds each map’s extra walls to the classic grid, never on an inner pillar or spawn', () => {
    for (const map of MAPS) {
      const arena = generateArena(5, map);
      for (const [col, row] of map.extraWalls) {
        const border =
          col === 0 ||
          row === 0 ||
          col === ARENA_COLS - 1 ||
          row === ARENA_ROWS - 1;
        // A mark on the border wall is a look, not a wall of its own.
        if (!border) expect(isPillar(col, row)).toBe(false);
        expect(arena.tiles[row * ARENA_COLS + col]).toBe('wall');
        expect(arena.hiddenPowerUps[row * ARENA_COLS + col]).toBeNull();
        expect(isExtraWall(map, col, row)).toBe(true);
      }
      expect(isExtraWall(map, 1, 1)).toBe(false);
    }
  });

  it('keeps the Núcleo’s grid the classic one: its eye sits on the top wall', () => {
    const classic = generateArena(5, findMap('gramado'));
    const nucleo = generateArena(5, findMap('nucleo'));
    expect(nucleo.tiles).toEqual(classic.tiles);
    expect(isExtraWall(findMap('nucleo'), 7, 0)).toBe(true);
  });

  it('keeps the Programador’s grid the classic one: its CI screen and kitchen window sit on the top wall', () => {
    const classic = generateArena(5, findMap('gramado'));
    const programador = generateArena(5, findMap('programador'));
    expect(programador.tiles).toEqual(classic.tiles);
    expect(findMap('programador').pizzaiolo).toEqual([2, 0]);
  });

  it('records the map a round is played on, defaulting to the first', () => {
    const players = [{ id: 'a', name: 'A' }];
    expect(createGame({ seed: 1, players }).mapId).toBe(DEFAULT_MAP_ID);
    expect(createGame({ seed: 1, players, mapId: 'autodromo' }).mapId).toBe(
      'autodromo',
    );
  });
});
