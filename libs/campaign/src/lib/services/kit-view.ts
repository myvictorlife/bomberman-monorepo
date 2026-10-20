import { HudPlayer } from '@libs/game-client';
import { PlayerKit } from '@libs/game-core';
import { PlayerBadgeStats } from '@libs/ui';

/** The kit a player has on, read off the arena's HUD. */
export function kitFromHud(player: HudPlayer): PlayerKit {
  return {
    maxBombs: player.bombs,
    fireRange: player.fire,
    speedLevel: player.speed,
    pierce: player.pierce,
    remote: player.remote,
    glove: player.glove,
    kick: player.kick,
    wallPass: player.wallPass ?? false,
    powerBomb: player.powerBomb ?? false,
    mountId: player.mount,
  };
}

/** A kit as the badge row draws it, outside a round: nothing timed running. */
export function kitBadges(kit: PlayerKit): PlayerBadgeStats {
  return {
    bombs: kit.maxBombs,
    fire: kit.fireRange,
    speed: kit.speedLevel,
    pierce: kit.pierce,
    remote: kit.remote,
    glove: kit.glove,
    kick: kit.kick,
    wallPass: kit.wallPass,
    powerBomb: kit.powerBomb,
    vestSeconds: 0,
    mount: kit.mountId,
    abilityReadyIn: 0,
    abilityActive: false,
  };
}
