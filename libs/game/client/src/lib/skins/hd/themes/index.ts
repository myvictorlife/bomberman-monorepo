import { findMap, GameState, isExtraWall, MapId, Tile } from '@libs/game-core';
import type * as Phaser from 'phaser';
import { TEXTURE } from '../../texture-keys';
import { autodromoTheme } from './autodromo';
import { subestacaoTheme } from './subestacao';
import { ArenaTheme } from './theme';

export type { ArenaTheme } from './theme';

export const ARENA_THEMES: Readonly<Record<MapId, ArenaTheme>> = {
  subestacao: subestacaoTheme,
  autodromo: autodromoTheme,
};

const cache = new Map<MapId, Map<string, HTMLCanvasElement>>();

/** The theme's tiles, painted once per page. */
export function themeTextures(
  doc: Document,
  mapId: MapId,
): Map<string, HTMLCanvasElement> {
  let textures = cache.get(mapId);
  if (!textures) {
    textures = ARENA_THEMES[mapId].paint(doc);
    cache.set(mapId, textures);
  }
  return textures;
}

/**
 * Swaps the scene's arena tiles for the theme's. Called after the skin has
 * loaded, so the skin's own tiles are the fallback for keys a theme lacks.
 */
export function loadArenaTheme(scene: Phaser.Scene, mapId: MapId): void {
  for (const [key, canvas] of themeTextures(document, mapId)) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  }
}

/**
 * Which texture a tile is drawn with: the map's feature, the border (its top
 * row apart), a pillar, a block, or the floor — shadowed under something
 * solid. `solid(col, row)` says whether a cell still blocks the way.
 */
export function tileTextureKey(
  state: Pick<GameState, 'mapId' | 'cols' | 'rows'>,
  col: number,
  row: number,
  tile: Tile,
  solid: (col: number, row: number) => boolean,
): string {
  if (tile === 'wall') {
    if (isExtraWall(findMap(state.mapId), col, row)) return TEXTURE.feature;
    if (row === 0) return TEXTURE.wallTop;
    if (col === 0 || col === state.cols - 1 || row === state.rows - 1)
      return TEXTURE.wallBorder;
    return TEXTURE.wall;
  }
  if (tile === 'block' && solid(col, row)) return TEXTURE.block;
  return row > 0 && solid(col, row - 1) ? TEXTURE.floorShadow : TEXTURE.floor;
}
export * from './moments';
