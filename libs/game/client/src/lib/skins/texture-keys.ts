import {
  CharacterId,
  Direction,
  FlameShape,
  MAX_PLAYERS,
  MountId,
  MOUNTS,
  PowerUpKind,
} from '@libs/game-core';

/**
 * The contract between the renderer and a skin. The renderer only ever asks for
 * these keys; a skin is anything that registers a texture under every one of
 * them. Replacing the art means writing a new skin — nothing in the renderer
 * or the rules changes.
 *
 * Every texture is one tile ({@link ArenaSkin.tileSize} square).
 */
export const FLAME_SHAPES: readonly FlameShape[] = [
  'center',
  'horizontal',
  'vertical',
  'end-up',
  'end-down',
  'end-left',
  'end-right',
];
export const POWER_UP_KINDS: readonly PowerUpKind[] = [
  'bomb',
  'fire',
  'speed',
  'egg',
  'pierce',
  'remote',
  'vest',
  'glove',
  'kick',
  'wallpass',
  'fullfire',
  'powerbomb',
  'skull',
  'clock',
  'oneup',
];
export const MOUNT_IDS: readonly MountId[] = MOUNTS.map((m) => m.id);
export const FACINGS: readonly Direction[] = ['down', 'up', 'left', 'right'];

/** 0 = the biggest flame, 3 = almost gone. */
export const FLAME_FRAMES = 4;
/** 0 = standing, 1 and 2 = the two steps of the walk cycle. */
export const PLAYER_FRAMES = 3;
export const BOMB_FRAMES = 2;
/** One set of player textures per slot the rules allow. */
export const PLAYER_SLOTS = MAX_PLAYERS;

export const TEXTURE = {
  floor: 'floor',
  /** Floor directly below a wall or block — darker, like a cast shadow. */
  floorShadow: 'floor-shadow',
  wall: 'wall',
  block: 'block',
  /**
   * Optional, provided by an arena theme (see `hd/themes`): the border wall,
   * the top row of the border, and the map's feature in the middle. The
   * renderer falls back to `wall` when a skin has none.
   */
  wallBorder: 'wall-border',
  wallTop: 'wall-top',
  feature: 'feature',
  /** Soft ellipse drawn under players and bombs (scaled by the renderer). */
  shadow: 'shadow',
  /** A chunk of a broken block — the renderer throws a few around. */
  debris: 'debris',
  /** A bright dot for sparkles; drawn additively. */
  spark: 'spark',
  bomb: (frame: number) => `bomb-${frame}`,
  flame: (shape: FlameShape, frame: number) => `flame-${shape}-${frame}`,
  powerUp: (kind: PowerUpKind) => `power-${kind}`,
  /** The egg as it cracks: stage 0 is `powerUp('egg')`, the last is about to open. */
  egg: (stage: number) => `egg-${stage}`,
  player: (slot: number, facing: Direction, frame: number) =>
    `player-${slot}-${facing}-${frame}`,
  /** The same player riding a mount. */
  playerMounted: (
    slot: number,
    mountId: MountId,
    facing: Direction,
    frame: number,
  ) => `player-${slot}-${mountId}-${facing}-${frame}`,
  /**
   * Someone on the border, by character rather than slot: they are not on a
   * team yet. Optional — registered on demand through `ArenaSkin.loadCharacter`;
   * the renderer falls back to the first slot's player without it.
   */
  outsider: (characterId: CharacterId, facing: Direction, frame: number) =>
    `outsider-${characterId}-${facing}-${frame}`,
} as const;

/** Every key a complete skin must provide. */
export function allTextureKeys(): string[] {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  return [
    TEXTURE.floor,
    TEXTURE.floorShadow,
    TEXTURE.wall,
    TEXTURE.block,
    TEXTURE.shadow,
    TEXTURE.debris,
    TEXTURE.spark,
    ...range(BOMB_FRAMES).map(TEXTURE.bomb),
    ...FLAME_SHAPES.flatMap((s) =>
      range(FLAME_FRAMES).map((f) => TEXTURE.flame(s, f)),
    ),
    ...POWER_UP_KINDS.map(TEXTURE.powerUp),
    ...range(PLAYER_SLOTS).flatMap((slot) =>
      FACINGS.flatMap((facing) =>
        range(PLAYER_FRAMES).map((f) => TEXTURE.player(slot, facing, f)),
      ),
    ),
    ...range(PLAYER_SLOTS).flatMap((slot) =>
      MOUNT_IDS.flatMap((mountId) =>
        FACINGS.flatMap((facing) =>
          range(PLAYER_FRAMES).map((f) =>
            TEXTURE.playerMounted(slot, mountId, facing, f),
          ),
        ),
      ),
    ),
  ];
}
