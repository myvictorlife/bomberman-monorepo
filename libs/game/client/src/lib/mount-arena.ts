import type { BotSetup } from '@libs/game-ai';
import { MapId, PlayerSetup } from '@libs/game-core';
import { ControlScheme, PlayerController } from './controls';
import { HudSnapshot } from './hud';
import { ArenaSession } from './session/arena-session';
import { ArenaSkin } from './skins/skin';

export interface ArenaOptions {
  /**
   * Draw this session instead of running a local round — an online round
   * mirrored from the server. `players`, `seed` and `mapId` are then ignored,
   * and `restart` does nothing: the server decides when the next round starts.
   */
  session?: ArenaSession;
  players: PlayerSetup[];
  /** Seats the computer plays, by player id; ignored with a `session`. */
  bots?: readonly BotSetup[];
  /** Which keys drive which player. Players without a scheme stand still. */
  controls: readonly ControlScheme[];
  /** Defaults to a fresh arena every time. */
  seed?: number;
  /** Which arena to play on; defaults to the first of the roster. */
  mapId?: MapId;
  /** Plays this stage of the campaign: its arena, creatures and gate; `mapId` is then ignored. */
  stageId?: string;
  /** Defaults to the HD skin. */
  skin?: ArenaSkin;
  /** Start with sound off. */
  muted?: boolean;
  /** Start with the arena theme playing; defaults to on. */
  music?: boolean;
  /** Called whenever something the HUD shows changes. */
  onHud?: (hud: HudSnapshot) => void;
}

export interface ArenaHandle {
  /** A new round with the same players. */
  restart(seed?: number): void;
  setMuted(muted: boolean): void;
  /** Plays or stops the arena theme. */
  setMusic(on: boolean): void;
  /**
   * A second pair of hands for `playerId`, beside any keys bound to it: what
   * a touch controller drives. Directions it holds and keys held at the same
   * time share one tracker, so the last one pressed wins either way.
   */
  controller(playerId: string): PlayerController;
  /** Stops the game loop, removes the canvas and every keyboard listener. */
  destroy(): void;
}

export type ArenaLauncher = (
  host: HTMLElement,
  options: ArenaOptions,
) => Promise<ArenaHandle>;

/**
 * Starts a local match inside `host`. Phaser (~1 MB) is loaded here with
 * `import()`, so it is only downloaded when someone actually opens the game.
 */
export const mountArena: ArenaLauncher = async (host, options) => {
  const { createArenaGame } = await import('./phaser/create-arena-game');
  return createArenaGame(host, options);
};
