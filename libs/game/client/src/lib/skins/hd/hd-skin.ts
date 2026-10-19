import type * as Phaser from 'phaser';
import { TEAM_COLORS } from '../../characters/cartoon/ink';
import { ArenaSkin } from '../skin';
import { HD_TILE } from './hd-palette';
import { paintCharacterTextures, paintHdTextures } from './hd-painter';

/**
 * The default skin: 64 px vector-style arena painted at runtime, with the
 * cartoon cast (see `characters/cartoon`) as the players. The arena art is
 * still placeholder — the final sprites replace it through the same
 * {@link ArenaSkin} contract.
 */
export const hdSkin: ArenaSkin = {
  id: 'hd',
  tileSize: HD_TILE,
  pixelArt: false,
  playerColors: TEAM_COLORS.map((c) => c.suit),
  load(scene, characters, colors) {
    for (const [key, canvas] of paintHdTextures(document, characters, colors)) {
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
