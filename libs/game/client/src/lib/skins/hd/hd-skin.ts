import type * as Phaser from 'phaser';
import { TEAM_COLORS } from '../../characters/cartoon/ink';
import { ArenaSkin } from '../skin';
import { HD_TILE } from './hd-palette';
import { paintCharacterTextures, paintHdTextures } from './hd-painter';

/**
 * How finely the art is painted on this screen: the device's pixels per CSS
 * pixel, whole, between 1 and 2. Painted at 64 px and shown on a dense
 * screen, every tile was scaled up and went soft; painted at 128 px the
 * canvas is scaled down to fit, which stays sharp. The cap keeps a phone at
 * 3× from painting four times the pixels it can show for little gain.
 */
export const HD_RESOLUTION = Math.min(
  2,
  Math.max(1, Math.round(globalThis.devicePixelRatio ?? 1)),
);

/**
 * The default skin: 64 px vector-style arena painted at runtime, with the
 * cartoon cast (see `characters/cartoon`) as the players. The arena art is
 * still placeholder — the final sprites replace it through the same
 * {@link ArenaSkin} contract.
 */
export const hdSkin: ArenaSkin = {
  id: 'hd',
  tileSize: HD_TILE * HD_RESOLUTION,
  resolution: HD_RESOLUTION,
  pixelArt: false,
  playerColors: TEAM_COLORS.map((c) => c.suit),
  load(scene, characters, colors) {
    for (const [key, canvas] of paintHdTextures(
      document,
      characters,
      colors,
      HD_RESOLUTION,
    )) {
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
    }
  },
  loadCharacter(scene, characterId, slot, color) {
    for (const [key, canvas] of paintCharacterTextures(
      document,
      characterId,
      slot,
      undefined,
      color,
      HD_RESOLUTION,
    )) {
      if (!scene.textures.exists(key)) {
        scene.textures.addCanvas(key, canvas);
        continue;
      }
      // A slot already drawn is repainted in place, so every sprite using it changes look.
      // (Phaser stays a type here: this file is imported by pages that never load it.)
      const existing = scene.textures.get(
        key,
      ) as Partial<Phaser.Textures.CanvasTexture>;
      if (!existing.context || !existing.refresh) continue;
      existing.context.clearRect(0, 0, canvas.width, canvas.height);
      existing.context.drawImage(canvas, 0, 0);
      existing.refresh();
    }
  },
};
