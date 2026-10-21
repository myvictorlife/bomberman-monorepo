import type * as Phaser from 'phaser';
import { MOUNT_IDS, TEXTURE } from '../texture-keys';
import { TEAM_COLORS } from '../../characters/cartoon/ink';
import { ArenaSkin } from '../skin';
import { HD_TILE } from './hd-palette';
import {
  paintCharacterTextures,
  paintHdTextures,
  paintMountTextures,
} from './hd-painter';

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
    // Timed, so a slow first paint shows up in the performance timeline.
    performance.mark?.('hd-skin:paint:start');
    const textures = paintHdTextures(
      document,
      characters,
      colors,
      HD_RESOLUTION,
    );
    performance.measure?.('hd-skin:paint', 'hd-skin:paint:start');
    for (const [key, canvas] of textures) {
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
    }
  },
  loadCharacter(scene, characterId, slot, color) {
    addOrRepaint(
      scene,
      paintCharacterTextures(
        document,
        characterId,
        slot,
        undefined,
        color,
        HD_RESOLUTION,
      ),
    );
    // The slot's mounts already painted change look with it.
    if (slot === 'outsider') return;
    for (const mountId of MOUNT_IDS) {
      if (
        !scene.textures.exists(TEXTURE.playerMounted(slot, mountId, 'down', 0))
      )
        continue;
      addOrRepaint(
        scene,
        paintMountTextures(
          document,
          characterId,
          slot,
          mountId,
          undefined,
          color,
          HD_RESOLUTION,
        ),
      );
    }
  },
  loadMount(scene, characterId, slot, mountId, color) {
    addOrRepaint(
      scene,
      paintMountTextures(
        document,
        characterId,
        slot,
        mountId,
        undefined,
        color,
        HD_RESOLUTION,
      ),
    );
  },
};

/** Registers each canvas, or repaints a texture already drawn in place, so every sprite using it changes look. */
function addOrRepaint(
  scene: Phaser.Scene,
  textures: Map<string, HTMLCanvasElement>,
): void {
  for (const [key, canvas] of textures) {
    if (!scene.textures.exists(key)) {
      scene.textures.addCanvas(key, canvas);
      continue;
    }
    // (Phaser stays a type here: this file is imported by pages that never load it.)
    const existing = scene.textures.get(
      key,
    ) as Partial<Phaser.Textures.CanvasTexture>;
    if (!existing.context || !existing.refresh) continue;
    existing.context.clearRect(0, 0, canvas.width, canvas.height);
    existing.context.drawImage(canvas, 0, 0);
    existing.refresh();
  }
}
