import { cellIndex, tileAt } from './arena';
import { CLOSING_STEP_TICKS } from './constants';
import { playerCell } from './movement';
import { letGo, isAirborne } from './grab';
import { GameState, Player } from './types';

/**
 * The arena closes in: once the round's clock runs out, a wall drops every
 * {@link CLOSING_STEP_TICKS}, in a spiral from the top-left corner inwards,
 * until one player (or none) is left. Whoever stands where a wall drops is
 * crushed — no mount, vest or shield saves them, and the kill is nobody's.
 * A bomb, an item or a burning crate under it is gone.
 *
 * The order is a plain function of the arena's size, so the server and every
 * client drop the same wall on the same tick.
 */

/** Every cell inside the border, in the order the walls drop: a clockwise spiral inwards. */
export function closingOrder(cols: number, rows: number): [number, number][] {
  const cells: [number, number][] = [];
  let top = 1;
  let left = 1;
  let bottom = rows - 2;
  let right = cols - 2;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) cells.push([c, top]);
    for (let r = top + 1; r <= bottom; r++) cells.push([right, r]);
    if (top < bottom)
      for (let c = right - 1; c >= left; c--) cells.push([c, bottom]);
    if (left < right)
      for (let r = bottom - 1; r > top; r--) cells.push([left, r]);
    top++;
    left++;
    bottom--;
    right--;
  }
  return cells;
}

/** Whether the walls have started dropping. */
export function isClosing(
  state: Pick<GameState, 'closesAtTick' | 'tick'>,
): boolean {
  return state.closesAtTick !== null && state.tick >= state.closesAtTick;
}

/** Whole seconds left on the round's clock; 0 once it has run out, `null` with no clock. */
export function secondsUntilClosing(
  state: Pick<GameState, 'closesAtTick' | 'tick'>,
  tickRate: number,
): number | null {
  if (state.closesAtTick === null) return null;
  return Math.max(0, Math.ceil((state.closesAtTick - state.tick) / tickRate));
}

/** Runs once per tick: announces the closing, then drops the next wall when one is due. */
export function closeArena(state: GameState): void {
  if (state.closesAtTick === null || state.tick < state.closesAtTick) return;
  // A bonus stage just ends when its time is up; see `stage.ts`.
  if (state.stage?.bonus) return;
  if (!state.closingWalls) {
    // No walls: time's up decides the round — whoever is left shares a draw.
    timeUp(state);
    return;
  }
  if (state.tick === state.closesAtTick)
    state.events.push({ type: 'arena-closing' });
  if ((state.tick - state.closesAtTick) % CLOSING_STEP_TICKS === 0)
    dropNextWall(state);
  // Once the round is decided the walls still fall, but crush nobody.
  if (state.endsAtTick !== null) return;
  // Checked every tick, not only on a drop: a jump can come down where a wall now stands.
  for (const player of state.players) {
    if (
      player.alive &&
      !player.jump &&
      !isAirborne(player) &&
      tileAt(state, ...playerCell(player)) === 'wall'
    )
      crush(state, player);
  }
}

function dropNextWall(state: GameState): void {
  const order = closingOrder(state.cols, state.rows);
  // Cells that already are walls (pillars, the map's own) are skipped at no cost.
  while (state.closedCells < order.length) {
    const cell = order[state.closedCells++] as [number, number];
    if (tileAt(state, ...cell) === 'wall') continue;
    dropWall(state, ...cell);
    return;
  }
}

function dropWall(state: GameState, col: number, row: number): void {
  const index = cellIndex(state, col, row);
  state.tiles[index] = 'wall';
  state.hiddenPowerUps[index] = null;
  const here = (c: { col: number; row: number }) =>
    c.col === col && c.row === row;
  state.bombs = state.bombs.filter((b) => !here(b));
  state.powerUps = state.powerUps.filter((p) => !here(p));
  state.burningBlocks = state.burningBlocks.filter((b) => !here(b));
  state.flames = state.flames.filter((f) => !here(f));
  state.events.push({ type: 'wall-dropped', col, row });
}

function timeUp(state: GameState): void {
  if (state.phase !== 'playing') return;
  const alive = state.players.filter((p) => p.alive);
  state.phase = 'over';
  state.winnerId = alive.length === 1 ? (alive[0]?.id ?? null) : null;
  state.events.push({ type: 'round-over', winnerId: state.winnerId });
}

/** Under a falling wall: out, whatever protects them from fire. The bomb in hand goes with them. */
export function crush(state: GameState, player: Player): void {
  player.alive = false;
  player.moving = false;
  player.mountId = null;
  player.heldBomb = null;
  letGo(state, player);
  player.diedAtTick = state.tick;
  state.events.push({
    type: 'player-died',
    playerId: player.id,
    killerId: null,
  });
}
