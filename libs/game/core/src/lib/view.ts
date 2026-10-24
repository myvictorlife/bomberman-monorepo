/**
 * A long stage, a screen at a time. Only `VIEW_COLS` columns are in play,
 * from `StageRun.view` on; past either edge is a wall for everything (see
 * `isOutOfView`). The screen follows the team forward and never back: it moves
 * on one column when the middle of the team is past the middle of the screen,
 * and only if nobody would be left outside it. What falls behind is gone.
 *
 * Someone on the left edge holds everyone back; after {@link PULL_TICKS} of
 * the others waiting on the right, they are pulled along to a teammate.
 */
import { TICK_RATE, VIEW_COLS } from './constants';
import { isScrolling, viewLimit } from './parts';
import { GameState, Player, StageRun } from './types';

/** How long the team waits on someone at the left edge before pulling them along. */
export const PULL_TICKS = 3 * TICK_RATE;
/** A pulled player blinks this long, untouchable, where they land. */
export const PULL_SHIELD_TICKS = 2 * TICK_RATE;
/** A running screen moves on a column this often. */
export const SCROLL_TICKS = Math.round(1.2 * TICK_RATE);
/** Within this many columns of the right edge, a player is waiting for the screen. */
export const WAITING_EDGE = 3;

/** How many columns a screen shows: the view on a long stage, the whole arena otherwise. */
export function screenCols(state: Pick<GameState, 'cols' | 'stage'>): number {
  return state.stage?.view == null ? state.cols : VIEW_COLS;
}

export function advanceView(state: GameState, run: StageRun): void {
  if (run.view === null) return;
  // A `survive` part: the screen runs on by itself, whoever is behind or not.
  if (
    isScrolling(run) &&
    state.tick - run.scrolledAtTick >= SCROLL_TICKS &&
    run.view < viewLimit(state, run)
  ) {
    run.view += 1;
    run.scrolledAtTick = state.tick;
    leaveBehind(state, run, run.view);
  }
  const team = state.players.filter((p) => p.alive && !p.flight);
  if (team.length === 0) return;
  const left = Math.min(...team.map((p) => p.x));
  const right = Math.max(...team.map((p) => p.x));
  const view = run.view;

  if (
    view < viewLimit(state, run) &&
    (left + right) / 2 > view + (VIEW_COLS - 1) / 2 &&
    left >= view + 1
  ) {
    run.view = view + 1;
    run.heldSinceTick = null;
    leaveBehind(state, run, run.view);
    return;
  }

  // A running screen burns its edge instead of waiting on anyone.
  if (isScrolling(run)) return;
  const behind = team.filter((p) => p.x < view + 1);
  const waiting = team.some((p) => p.x >= view + VIEW_COLS - 1 - WAITING_EDGE);
  if (behind.length === 0 || behind.length === team.length || !waiting) {
    run.heldSinceTick = null;
    return;
  }
  run.heldSinceTick ??= state.tick;
  if (state.tick - run.heldSinceTick < PULL_TICKS) return;
  const ahead = team.filter((p) => !behind.includes(p));
  for (const player of behind) pull(state, player, ahead);
  run.heldSinceTick = null;
}

/** Everything left of the first column in play is gone: the screen never comes back for it. */
function leaveBehind(state: GameState, run: StageRun, view: number): void {
  run.creatures = run.creatures.filter((c) => c.x >= view);
  state.bombs = state.bombs.filter((b) => b.col >= view);
  state.flames = state.flames.filter((f) => f.col >= view);
  state.powerUps = state.powerUps.filter((p) => p.col >= view);
  state.burningBlocks = state.burningBlocks.filter((b) => b.col >= view);
  run.slime = run.slime.filter((s) => s.col >= view);
  // A helmet is not left behind: it is dragged along the edge.
  for (const helmet of run.helmets) helmet.col = Math.max(helmet.col, view);
}

/** Puts `player` on the cell of the teammate furthest ahead, shielded for a moment. */
function pull(state: GameState, player: Player, ahead: Player[]): void {
  if (player.jump || player.carriedBy) return;
  const leader = ahead.reduce((a, b) => (b.x > a.x ? b : a));
  player.x = Math.round(leader.x);
  player.y = Math.round(leader.y);
  player.moving = false;
  player.shieldedUntilTick = Math.max(
    player.shieldedUntilTick,
    state.tick + PULL_SHIELD_TICKS,
  );
  state.events.push({ type: 'player-pulled', playerId: player.id });
}
