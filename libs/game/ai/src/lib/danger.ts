import {
  CLOSING_STEP_TICKS,
  closingOrder,
  FLAME_TICKS,
  GameState,
  inBounds,
  tileAt,
} from '@libs/game-core';

/**
 * When each cell of the arena will burn, as seen by one bot: for every cell
 * the first tick (counted from now) a flame may be there, and the last. A
 * cell nothing threatens has `start = Infinity`.
 *
 * It follows the explosion rules of `game.ts`: a blast runs `range` cells
 * each way, stone stops it, a crate stops it (and burns) unless the bomb
 * pierces, and a bomb or an exposed item it reaches stops it too.
 */
export interface DangerMap {
  cols: number;
  start: Float64Array;
  end: Float64Array;
}

/** A bomb as the danger map sees it: where, how far, and in how many ticks it goes off. */
export interface ThreatBomb {
  col: number;
  row: number;
  range: number;
  pierce: boolean;
  /** Ticks from now until it explodes; `Infinity` for one that waits (a remote of our own). */
  at: number;
}

export interface DangerOptions {
  /** Whose eyes: their own remote bombs wait for them, anyone else's may go at any moment. */
  viewerId: string;
  readsChains: boolean;
  readsClosing: boolean;
  /** A bomb the bot is thinking of dropping. */
  extra?: ThreatBomb;
}

/** The cells a blast from `bomb` reaches, its own cell first. */
export function blastCells(
  state: GameState,
  bomb: Pick<ThreatBomb, 'col' | 'row' | 'range' | 'pierce'>,
): [number, number][] {
  const cells: [number, number][] = [[bomb.col, bomb.row]];
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    for (let i = 1; i <= bomb.range; i++) {
      const col = bomb.col + dx * i;
      const row = bomb.row + dy * i;
      if (!inBounds(state, col, row)) break;
      const tile = tileAt(state, col, row);
      if (tile === 'wall') break;
      cells.push([col, row]);
      if (tile === 'block' && !bomb.pierce) break;
      if (state.bombs.some((b) => b.col === col && b.row === row)) break;
      if (state.powerUps.some((p) => p.col === col && p.row === row)) break;
    }
  }
  return cells;
}

/** Every bomb that can go off, with when — on the ground and in the air. */
export function threats(state: GameState, viewerId: string): ThreatBomb[] {
  const wait = (ownerId: string, remote: boolean, fuse: number) =>
    !remote ? fuse : ownerId === viewerId ? Infinity : 0;
  return [
    ...state.bombs.map((b) => ({
      col: b.col,
      row: b.row,
      range: b.range,
      pierce: b.pierce,
      at: wait(b.ownerId, b.remote, b.fuse),
    })),
    ...state.thrownBombs.map((b) => ({
      col: b.col,
      row: b.row,
      range: b.range,
      pierce: b.pierce,
      at: b.landTick - state.tick + wait(b.ownerId, b.remote, b.fuse),
    })),
  ];
}

export function dangerMap(state: GameState, options: DangerOptions): DangerMap {
  const size = state.cols * state.rows;
  const start = new Float64Array(size).fill(Infinity);
  const end = new Float64Array(size).fill(-Infinity);
  const mark = (col: number, row: number, from: number, to: number) => {
    const i = row * state.cols + col;
    start[i] = Math.min(start[i] as number, from);
    end[i] = Math.max(end[i] as number, to);
  };

  const bombs = threats(state, options.viewerId);
  if (options.extra) bombs.push({ ...options.extra });
  const reach = bombs.map((b) => blastCells(state, b));

  // A chain: a bomb in another's blast goes off no later than that one.
  if (options.readsChains) {
    for (
      let changed = true, rounds = 0;
      changed && rounds < bombs.length;
      rounds++
    ) {
      changed = false;
      bombs.forEach((a, i) => {
        for (const [col, row] of reach[i] ?? []) {
          for (const b of bombs) {
            if (b !== a && b.col === col && b.row === row && b.at > a.at) {
              b.at = a.at;
              changed = true;
            }
          }
        }
      });
    }
  }

  bombs.forEach((b, i) => {
    if (b.at === Infinity) return;
    for (const [col, row] of reach[i] ?? [])
      mark(col, row, b.at, b.at + FLAME_TICKS);
  });
  for (const f of state.flames) mark(f.col, f.row, 0, f.ticksLeft);

  // The walls about to drop once the clock has run out: deadly from then on, for good.
  if (
    options.readsClosing &&
    state.closingWalls &&
    state.closesAtTick !== null
  ) {
    const until = state.closesAtTick - state.tick;
    if (until < 10 * 60) {
      const order = closingOrder(state.cols, state.rows);
      let step = 0;
      for (let k = state.closedCells; k < order.length && step < 40; k++) {
        const [col, row] = order[k] as [number, number];
        if (tileAt(state, col, row) === 'wall') continue;
        mark(
          col,
          row,
          Math.max(0, until) + step * CLOSING_STEP_TICKS,
          Infinity,
        );
        step++;
      }
    }
  }
  return { cols: state.cols, start, end };
}

/** Whether `col, row` is burning at any moment in `from … to` ticks from now. */
export function burnsDuring(
  map: DangerMap,
  col: number,
  row: number,
  from: number,
  to: number,
): boolean {
  const i = row * map.cols + col;
  return (map.start[i] as number) <= to && (map.end[i] as number) >= from;
}

/** Nothing ever threatens this cell, as far as the bot can see. */
export function isSafe(map: DangerMap, col: number, row: number): boolean {
  return map.start[row * map.cols + col] === Infinity;
}
