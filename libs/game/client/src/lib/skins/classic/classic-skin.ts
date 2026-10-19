import { ArenaSkin } from '../skin';
import { paintClassicTextures } from './classic-painter';
import { PLAYER_PALETTES, TILE } from './classic-sprites';

/**
 * The placeholder skin: original 16-bit-style pixel art painted at runtime, so
 * the game ships without a single image file. Swap it for the final art by
 * providing another {@link ArenaSkin} — see `texture-keys.ts` for the contract.
 */
export const classicSkin: ArenaSkin = {
  id: 'classic',
  tileSize: TILE,
  pixelArt: true,
  playerColors: PLAYER_PALETTES.map((p) => p['W'] as string),
  load(scene) {
    for (const [key, canvas] of paintClassicTextures(document)) {
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
    }
  },
};
