import {
  GameState,
  Player,
  playerCell,
  speedOf,
  TICK_RATE,
  tileAt,
} from '@libs/game-core';
import { burnsDuring, DangerMap } from './danger';

/** Every cell a bot can reach without walking through fire, with how far and how. */
export interface Reach {
  cols: number;
  /** Steps from the bot's cell; `-1` when it cannot get there. */
  steps: Int16Array;
  /** The cell each was reached from, for walking the path back; `-1` at the start. */
  parent: Int32Array;
  /** Reached cells, nearest first. */
  order: number[];
}

/** Floor with no bomb on it — or the bomb the bot still stands on, which it can walk off. */
export function isWalkable(
  state: GameState,
  player: Player,
  col: number,
  row: number,
): boolean {
  if (tileAt(state, col, row) !== 'empty') return false;
  const bomb = state.bombs.find((b) => b.col === col && b.row === row);
  return !bomb || bomb.passThrough.includes(player.id);
}

/**
 * Breadth-first over the floor, timing each step by the bot's speed: a cell
 * is entered only if it is not burning while the bot passes through it.
 */
export function reachable(
  state: GameState,
  player: Player,
  danger: DangerMap,
  from: readonly [number, number] = playerCell(player),
  /** Extra cells' worth of time kept clear of the flames on each side, for plans that must not cut it fine. */
  slack = 0,
): Reach {
  const size = state.cols * state.rows;
  const steps = new Int16Array(size).fill(-1);
  const parent = new Int32Array(size).fill(-1);
  const order: number[] = [];
  const perCell = TICK_RATE / speedOf(player, state.tick);
  const [col, row] = from;
  const startIndex = row * state.cols + col;
  steps[startIndex] = 0;
  order.push(startIndex);

  for (let head = 0; head < order.length; head++) {
    const index = order[head] as number;
    const c = index % state.cols;
    const r = Math.floor(index / state.cols);
    const next = (steps[index] as number) + 1;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const nc = c + dx;
      const nr = r + dy;
      const ni = nr * state.cols + nc;
      if (steps[ni] !== -1 || !isWalkable(state, player, nc, nr)) continue;
      // From half a cell before arriving to half a cell after: the time spent in it.
      const arrive = next * perCell;
      const margin = perCell * (0.6 + slack);
      if (burnsDuring(danger, nc, nr, arrive - margin, arrive + margin))
        continue;
      steps[ni] = next;
      parent[ni] = index;
      order.push(ni);
    }
  }
  return { cols: state.cols, steps, parent, order };
}

/** The cells from the bot's cell (excluded) to `target`, in walking order. */
export function pathTo(reach: Reach, target: number): [number, number][] {
  const path: [number, number][] = [];
  for (
    let i = target;
    reach.parent[i] !== -1 && i !== -1;
    i = reach.parent[i] as number
  ) {
    path.unshift([i % reach.cols, Math.floor(i / reach.cols)]);
  }
  return path;
}
