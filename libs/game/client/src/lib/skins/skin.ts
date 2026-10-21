import type * as Phaser from 'phaser';
import type { CharacterId, MountId, PlayerColorId } from '@libs/game-core';

/**
 * A complete set of art for the arena. `load` runs in the scene's `preload` and
 * must register a texture for every key in `allTextureKeys()` (mounted
 * frames may wait for `loadMount`) — painted on a
 * canvas (see the classic skin) or loaded from a sprite sheet with
 * `scene.load.image` / `scene.load.spritesheet`.
 */
export interface ArenaSkin {
  readonly id: string;
  /** Side of one tile, in texture pixels. */
  readonly tileSize: number;
  /**
   * Texture pixels per unit of the art, for skins painted at runtime: 2 on
   * a dense screen paints every tile twice as fine, so the canvas is scaled
   * down to the page instead of up. Absent, 1.
   */
  readonly resolution?: number;
  /** `true` for pixel art: nearest-neighbour scaling and no additive glow. */
  readonly pixelArt: boolean;
  /**
   * CSS colour per colour index (`colorSlot`) — the HUD outside the canvas.
   * Indexed like `PLAYER_COLOR_IDS`, so the first five are the slot colours.
   */
  readonly playerColors: readonly string[];
  /**
   * `characters[slot]` is who sits in each player slot and `colors[slot]` the
   * colour the round gave them, so the skin can paint that character, in that
   * colour, under the slot's texture keys. A skin without per-character art
   * or picked colours may ignore them.
   */
  load(
    scene: Phaser.Scene,
    characters: readonly CharacterId[],
    colors?: readonly PlayerColorId[],
  ): void;
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
    color?: PlayerColorId,
  ): void;
  /**
   * Paints one slot riding one mount (`TEXTURE.playerMounted`), the first
   * time that slot climbs on. Optional: a skin may paint every mount in
   * `load` instead; without either the renderer shows the rider on foot.
   */
  loadMount?(
    scene: Phaser.Scene,
    characterId: CharacterId,
    slot: number,
    mountId: MountId,
    color?: PlayerColorId,
  ): void;
}
