import { generateArena, isPillar } from './arena';
import { ARENA_COLS } from './constants';
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

  it('adds each map’s extra walls to the classic grid, never on a pillar or spawn', () => {
    for (const map of MAPS) {
      const arena = generateArena(5, map);
      for (const [col, row] of map.extraWalls) {
        expect(isPillar(col, row)).toBe(false);
        expect(arena.tiles[row * ARENA_COLS + col]).toBe('wall');
        expect(arena.hiddenPowerUps[row * ARENA_COLS + col]).toBeNull();
        expect(isExtraWall(map, col, row)).toBe(true);
      }
      expect(isExtraWall(map, 1, 1)).toBe(false);
    }
  });

  it('records the map a round is played on, defaulting to the first', () => {
    const players = [{ id: 'a', name: 'A' }];
    expect(createGame({ seed: 1, players }).mapId).toBe(DEFAULT_MAP_ID);
    expect(createGame({ seed: 1, players, mapId: 'autodromo' }).mapId).toBe(
      'autodromo',
    );
  });
});
