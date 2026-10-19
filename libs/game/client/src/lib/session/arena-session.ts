import { Direction, GameEvent, GameState } from '@libs/game-core';

/**
 * What the arena scene draws from and feeds input into. `LocalSession` runs
 * the rules in this tab; `OnlineSession` mirrors a round the server runs.
 *
 * `state` keeps its identity for the whole round — the scene rebuilds the
 * arena whenever it sees a different object.
 */
export interface ArenaSession {
  readonly state: GameState;
  /** Called every frame with the directions held, keyed by control scheme; returns what happened. */
  advance(
    deltaMs: number,
    directions: Readonly<Record<string, Direction | null>>,
  ): GameEvent[];
  pressBomb(controlId: string): void;
  pressAbility(controlId: string): void;
  /** Sets off the oldest remote bomb. */
  pressDetonate(controlId: string): void;
}
