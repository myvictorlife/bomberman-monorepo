/**
 * What a player carries from one stage of the campaign to the next: the
 * power-ups picked up and the mount ridden. A stage starts with the kit the
 * last one was cleared with, so a player grows stronger stage after stage,
 * up to the game's limits. The vest and the skull's curse are timed and stay
 * behind.
 */
import { isMountId, MountId } from './characters';
import {
  MAX_BOMBS,
  MAX_FIRE,
  MAX_SPEED_LEVEL,
  START_BOMBS,
  START_FIRE,
} from './constants';
import type { Player } from './types';

export interface PlayerKit {
  maxBombs: number;
  fireRange: number;
  speedLevel: number;
  pierce: boolean;
  remote: boolean;
  glove: boolean;
  kick: boolean;
  wallPass: boolean;
  powerBomb: boolean;
  mountId: MountId | null;
}

/** What everyone starts the campaign with. */
export const START_KIT: PlayerKit = {
  maxBombs: START_BOMBS,
  fireRange: START_FIRE,
  speedLevel: 0,
  pierce: false,
  remote: false,
  glove: false,
  kick: false,
  wallPass: false,
  powerBomb: false,
  mountId: null,
};

/** The limits a kit grows to. */
export const KIT_LIMITS = {
  maxBombs: MAX_BOMBS,
  fireRange: MAX_FIRE,
  speedLevel: MAX_SPEED_LEVEL,
} as const;

export function kitOf(player: Player): PlayerKit {
  return {
    maxBombs: player.maxBombs,
    fireRange: player.fireRange,
    speedLevel: player.speedLevel,
    pierce: player.pierce,
    remote: player.remote,
    glove: player.glove,
    kick: player.kick,
    wallPass: player.wallPass,
    powerBomb: player.powerBomb,
    mountId: player.mountId,
  };
}

/** Gives a player a kit, kept within the limits. */
export function applyKit(player: Player, kit: PlayerKit): void {
  Object.assign(player, sanitizeKit(kit));
}

function clamp(value: unknown, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : min;
}

/** A kit from anything — storage, the network: numbers clamped, unknown mounts dropped. */
export function sanitizeKit(value: unknown): PlayerKit {
  const v = (value && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  const mount = typeof v['mountId'] === 'string' ? v['mountId'] : '';
  return {
    maxBombs: clamp(v['maxBombs'], START_BOMBS, MAX_BOMBS),
    fireRange: clamp(v['fireRange'], START_FIRE, MAX_FIRE),
    speedLevel: clamp(v['speedLevel'], 0, MAX_SPEED_LEVEL),
    pierce: v['pierce'] === true,
    remote: v['remote'] === true,
    glove: v['glove'] === true,
    kick: v['kick'] === true,
    wallPass: v['wallPass'] === true,
    powerBomb: v['powerBomb'] === true,
    mountId: isMountId(mount) ? mount : null,
  };
}
