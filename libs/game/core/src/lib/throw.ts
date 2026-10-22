import { tileAt } from './arena';
import { bonk, headsAt } from './bonk';
import { BOMB_FLIGHT_TICKS_PER_CELL } from './constants';
import { DIRECTION_DELTA, standsOn } from './movement';
import { Bomb, Direction, Flight, GameState, ThrownBomb } from './types';

/**
 * Bombs that leave the ground: thrown by the glove, kicked, or thrown in from
 * the border by an outsider. One flight for all three — where it lands, how
 * it wraps round the arena and how it comes down are the same rules.
 *
 * A bomb in the air is out of reach: flames pass under it and nobody can
 * kick or pick it up until it lands.
 */

/**
 * A cell a bomb can come down on: floor with no bomb on it. Where it flies
 * this ignores players — they move while it is in the air; who is under it
 * when it lands is {@link landThrownBombs}' business.
 */
export function isFreeLanding(
  state: GameState,
  col: number,
  row: number,
): boolean {
  return (
    tileAt(state, col, row) === 'empty' &&
    !state.bombs.some((b) => b.col === col && b.row === row)
  );
}

/**
 * One cell along `direction`, wrapping round the arena: past the last cell
 * inside the border wall, the bomb comes back in on the opposite side — out
 * at the top, in at the bottom.
 */
export function wrapStep(
  state: Pick<GameState, 'cols' | 'rows'>,
  col: number,
  row: number,
  direction: Direction,
): [number, number] {
  const [dx, dy] = DIRECTION_DELTA[direction];
  return [wrapAxis(col + dx, state.cols), wrapAxis(row + dy, state.rows)];
}

/** Keeps `value` inside the walls: `1 … size - 2`. */
function wrapAxis(value: number, size: number): number {
  const inner = size - 2;
  return ((((value - 1) % inner) + inner) % inner) + 1;
}

/**
 * Where a bomb flying `steps` cells from `col, row` comes down, and how many
 * cells it travels in all. It flies over anything; on a crate, a wall or a
 * bomb it bounces one cell on, again and again, wrapping round the arena.
 * `null` when the whole line has nowhere to land.
 */
export function bounceLanding(
  state: GameState,
  col: number,
  row: number,
  direction: Direction,
  steps: number,
): { cell: [number, number]; cells: number } | null {
  const line =
    direction === 'left' || direction === 'right'
      ? state.cols - 2
      : state.rows - 2;
  let cell: [number, number] = [col, row];
  for (let i = 0; i < steps; i++) cell = wrapStep(state, ...cell, direction);
  // One lap at most: past that, every cell of the line has been tried.
  for (let bounces = 0; bounces <= line; bounces++) {
    if (isFreeLanding(state, ...cell)) return { cell, cells: steps + bounces };
    cell = wrapStep(state, ...cell, direction);
  }
  return null;
}

/**
 * Sends `bomb` (already off the ground) flying from `col, row`. It keeps its
 * owner, range, pierce and remote; a kick's fuse keeps burning in the air, a
 * throw's waits for the landing. Returns `false`, launching nothing, when
 * there is nowhere to land.
 */
export function launchBomb(
  state: GameState,
  bomb: Bomb,
  from: readonly [number, number],
  direction: Direction,
  steps: number,
  options: { fuseRuns: boolean; by: string },
): boolean {
  const landing = bounceLanding(state, from[0], from[1], direction, steps);
  if (!landing) return false;
  const flightTicks = landing.cells * BOMB_FLIGHT_TICKS_PER_CELL;
  // Burnt down in the air, it goes off right after it lands — never inside the flight.
  const fuse =
    options.fuseRuns && !bomb.remote
      ? Math.max(1, bomb.fuse - flightTicks)
      : bomb.fuse;
  state.thrownBombs.push({
    id: bomb.id,
    ownerId: bomb.ownerId,
    fromCol: from[0],
    fromRow: from[1],
    col: landing.cell[0],
    row: landing.cell[1],
    startTick: state.tick,
    landTick: state.tick + flightTicks,
    direction,
    cells: landing.cells,
    wraps: true,
    range: bomb.range,
    fuse,
    pierce: bomb.pierce,
    remote: bomb.remote,
  });
  state.events.push({
    type: 'bomb-thrown',
    playerId: options.by,
    col: landing.cell[0],
    row: landing.cell[1],
  });
  return true;
}

/**
 * Bombs whose flight is over touch down and become ordinary bombs again, with
 * what they had when they took off. A cell taken while the bomb was in the
 * air sends it on to the next free one; with none left, the bomb is lost.
 * Coming down on someone's head, it bonks them and bounces one cell on.
 */
export function landThrownBombs(state: GameState): void {
  const landing = state.thrownBombs.filter((b) => state.tick >= b.landTick);
  if (landing.length === 0) return;
  state.thrownBombs = state.thrownBombs.filter((b) => state.tick < b.landTick);

  for (const thrown of landing) {
    const cell = landingFor(state, thrown);
    if (!cell) continue;
    const [col, row] = cell;
    const heads = headsAt(state, col, row);
    if (heads.length > 0) {
      heads.forEach((player) => bonk(state, player));
      state.thrownBombs.push(bounceOn(state, thrown, cell));
      continue;
    }
    state.bombs.push({
      id: thrown.id,
      col,
      row,
      ownerId: thrown.ownerId,
      fuse: thrown.fuse,
      range: thrown.range,
      passThrough: state.players
        .filter((p) => p.alive && standsOn(p, col, row))
        .map((p) => p.id),
      pierce: thrown.pierce,
      remote: thrown.remote,
    });
    state.events.push({
      type: 'bomb-placed',
      col,
      row,
      playerId: thrown.ownerId,
    });
  }
}

/** The same bomb off a head and one cell further, along its line; still in the air, so no head is hit twice in a tick. */
function bounceOn(
  state: GameState,
  thrown: ThrownBomb,
  from: [number, number],
): ThrownBomb {
  const [dx, dy] = DIRECTION_DELTA[thrown.direction];
  const next: [number, number] = thrown.wraps
    ? wrapStep(state, ...from, thrown.direction)
    : [from[0] + dx, from[1] + dy];
  return {
    ...thrown,
    fromCol: from[0],
    fromRow: from[1],
    col: next[0],
    row: next[1],
    startTick: state.tick,
    landTick: state.tick + BOMB_FLIGHT_TICKS_PER_CELL,
    cells: 1,
  };
}

function landingFor(
  state: GameState,
  thrown: ThrownBomb,
): [number, number] | null {
  if (thrown.wraps)
    return (
      bounceLanding(state, thrown.col, thrown.row, thrown.direction, 0)?.cell ??
      null
    );
  // From the border: straight in, no wrapping — the far wall ends the line.
  const [dx, dy] = DIRECTION_DELTA[thrown.direction];
  for (let c = thrown.col, r = thrown.row; ; c += dx, r += dy) {
    const tile = tileAt(state, c, r);
    if (tile === 'wall') return null;
    if (isFreeLanding(state, c, r)) return [c, r];
  }
}

/**
 * Where a bomb in the air is at `tick`, in tiles, and how high (0–1) it is on
 * its arc. A wrapping flight leaves by one side and comes back by the other,
 * so the path is walked cell by cell rather than drawn straight to the end.
 */
export function flightPosition(
  state: Pick<GameState, 'cols' | 'rows'>,
  bomb: Flight,
  tick: number,
): [number, number, number] {
  const span = bomb.landTick - bomb.startTick;
  const progress =
    span > 0 ? Math.min(1, Math.max(0, (tick - bomb.startTick) / span)) : 1;
  const arc = Math.sin(Math.PI * progress);
  if (!bomb.wraps) {
    return [
      bomb.fromCol + (bomb.col - bomb.fromCol) * progress,
      bomb.fromRow + (bomb.row - bomb.fromRow) * progress,
      arc,
    ];
  }
  const [dx, dy] = DIRECTION_DELTA[bomb.direction];
  const travelled = bomb.cells * progress;
  return [
    wrapPosition(bomb.fromCol + dx * travelled, state.cols),
    wrapPosition(bomb.fromRow + dy * travelled, state.rows),
    arc,
  ];
}

/** Like {@link wrapAxis} for a position between cells: half a cell over the wall, then the other side. */
function wrapPosition(value: number, size: number): number {
  const inner = size - 2;
  return ((((value - 0.5) % inner) + inner) % inner) + 0.5;
}
