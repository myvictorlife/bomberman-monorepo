/**
 * Points, in stage mode: a creature is worth what the catalogue says, an
 * anthill and a boss what is set here, and the time left on the clock is a
 * bonus for everyone who gets through the gate. Points go to whoever lit the
 * flame; a creature crushed by a wall scores for nobody.
 */
import { GameState, StageRun } from './types';

export const BOSS_POINTS = 5000;
export const MOUND_POINTS = 500;

/** Points to a player, when it is one of the stage's. */
export function award(
  state: GameState,
  run: StageRun,
  playerId: string | null,
  points: number,
  col: number,
  row: number,
): void {
  if (!playerId || !state.players.some((p) => p.id === playerId)) return;
  run.score[playerId] = (run.score[playerId] ?? 0) + points;
  state.events.push({ type: 'points', playerId, points, col, row });
}
