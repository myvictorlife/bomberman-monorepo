import type * as Phaser from 'phaser';
import type { CharacterId } from '@libs/game-core';

/**
 * A complete set of art for the arena. `load` runs in the scene's `preload` and
 * must register a texture for every key in `allTextureKeys()` — painted on a
 * canvas (see the classic skin) or loaded from a sprite sheet with
 * `scene.load.image` / `scene.load.spritesheet`.
 */
export interface ArenaSkin {
  readonly id: string;
  /** Side of one tile, in texture pixels. */
  readonly tileSize: number;
  /** `true` for pixel art: nearest-neighbour scaling and no additive glow. */
  readonly pixelArt: boolean;
  /** CSS colour per player slot — used by the HUD outside the canvas. */
  readonly playerColors: readonly string[];
  /**
   * `characters[slot]` is who sits in each player slot, so the skin can paint
   * that character's frames under the slot's texture keys. A skin without
   * per-character art may ignore it.
   */
  load(scene: Phaser.Scene, characters: readonly CharacterId[]): void;
  /**
   * Paints one character mid-round: as `TEXTURE.outsider(characterId, …)` when
   * `slot` is `'outsider'` (someone stepped onto the border), or over the
   * player textures of `slot` (an outsider took that slot in the arena).
   * Optional: a skin with one look per slot leaves it out.
   */
  loadCharacter?(
    scene: Phaser.Scene,
    characterId: CharacterId,
    slot: number | 'outsider',
  ): void;
}
