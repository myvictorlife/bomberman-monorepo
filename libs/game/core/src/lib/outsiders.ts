import { inBounds, tileAt } from './arena';
import { DEFAULT_CHARACTER_ID } from './characters';
import {
  BOMB_FUSE_TICKS,
  OUTSIDER_BOMB_RANGE,
  OUTSIDER_SPAWN_CELLS,
  OUTSIDER_SPEED,
  OUTSIDER_THROW_CELLS,
  OUTSIDER_THROW_TICKS,
  TICK_RATE,
} from './constants';
import { DIRECTION_DELTA, moveBody, playerCell } from './movement';
import {
  Direction,
  GameState,
  Outsider,
  PlayerSetup,
  ThrownBomb,
} from './types';

/**
 * The outsiders: whoever is next in line stands on the border wall while a
 * round is played, walks around it and throws bombs in. The rules of who gets
 * to stand there belong to the lobby; here they are simply `state.outsiders`,
 * added and removed by the caller as the queue changes. What a kill does —
 * the thrower taking the victim's place — is in `game.ts`, with the other
 * flame rules.
 */

/** The ring of wall cells around the arena: the only place an outsider walks. */
export function isBorderCell(
  state: Pick<GameState, 'cols' | 'rows'>,
  col: number,
  row: number,
): boolean {
  if (!inBounds(state, col, row)) return false;
  return (
    col === 0 || row === 0 || col === state.cols - 1 || row === state.rows - 1
  );
}

/**
 * Which way "in" is from a border cell: across the wall, towards the arena.
 * `null` on a corner, where there is no one way in, and off the border.
 */
export function inwardDirection(
  state: Pick<GameState, 'cols' | 'rows'>,
  col: number,
  row: number,
): Direction | null {
  if (!isBorderCell(state, col, row)) return null;
  const sides = [
    col === 0 ? 'right' : null,
    col === state.cols - 1 ? 'left' : null,
    row === 0 ? 'down' : null,
    row === state.rows - 1 ? 'up' : null,
  ].filter((d): d is Direction => d !== null);
  return sides.length === 1 ? (sides[0] as Direction) : null;
}

/**
 * Puts someone on the border, on the first spawn cell nobody is standing on.
 * Someone already in the state — outside or in the round — is left as is.
 */
export function addOutsider(
  state: GameState,
  setup: PlayerSetup,
): Outsider | null {
  // One who fell in the round may stand outside; one still in it may not.
  if (
    state.outsiders.some((o) => o.id === setup.id) ||
    state.players.some((p) => p.id === setup.id && p.alive)
  ) {
    return null;
  }
  const taken = (cell: readonly [number, number]) =>
    state.outsiders.some(
      (o) => Math.round(o.x) === cell[0] && Math.round(o.y) === cell[1],
    );
  const [x, y] = (OUTSIDER_SPAWN_CELLS.find((cell) => !taken(cell)) ??
    OUTSIDER_SPAWN_CELLS[0]) as readonly [number, number];
  const outsider: Outsider = {
    id: setup.id,
    name: setup.name,
    characterId: setup.characterId ?? DEFAULT_CHARACTER_ID,
    x,
    y,
    facing: inwardDirection(state, x, y) ?? 'down',
    moving: false,
  };
  state.outsiders.push(outsider);
  return outsider;
}

/** Takes someone off the border. A bomb they already threw still lands. */
export function removeOutsider(state: GameState, id: string): void {
  state.outsiders = state.outsiders.filter((o) => o.id !== id);
}

export function moveOutsider(
  state: GameState,
  outsider: Outsider,
  direction: Direction,
): void {
  moveBody(
    outsider,
    direction,
    OUTSIDER_SPEED / TICK_RATE,
    (col, row) => !isBorderCell(state, col, row),
  );
}

/** One bomb at a time: in the air or on the ground, until it goes off. */
export function hasBombOut(state: GameState, id: string): boolean {
  return (
    state.thrownBombs.some((b) => b.ownerId === id) ||
    state.bombs.some((b) => b.ownerId === id)
  );
}

/**
 * The first cell from `col, row` inwards along `direction` a bomb can land on:
 * a floor cell with no bomb on it. `null` when a wall comes first.
 */
export function landingCell(
  state: GameState,
  col: number,
  row: number,
  direction: Direction,
): [number, number] | null {
  const [dx, dy] = DIRECTION_DELTA[direction];
  for (let c = col, r = row; inBounds(state, c, r); c += dx, r += dy) {
    const tile = tileAt(state, c, r);
    if (tile === 'wall') return null;
    if (
      tile === 'empty' &&
      !state.bombs.some((b) => b.col === c && b.row === r)
    )
      return [c, r];
  }
  return null;
}

/**
 * Throws a bomb from where the outsider stands: it flies
 * {@link OUTSIDER_THROW_CELLS} cells in and lands on the first free cell from
 * there. Nothing happens on a corner, with a bomb already out, or when the
 * whole line is crates and bombs.
 */
export function throwBomb(state: GameState, outsider: Outsider): void {
  if (hasBombOut(state, outsider.id)) return;
  const [col, row] = playerCell(outsider);
  const direction = inwardDirection(state, col, row);
  if (!direction) return;
  outsider.facing = direction;
  const [dx, dy] = DIRECTION_DELTA[direction];
  const target = landingCell(
    state,
    col + dx * OUTSIDER_THROW_CELLS,
    row + dy * OUTSIDER_THROW_CELLS,
    direction,
  );
  if (!target) return;

  const bomb: ThrownBomb = {
    id: state.nextBombId++,
    ownerId: outsider.id,
    fromCol: col,
    fromRow: row,
    col: target[0],
    row: target[1],
    startTick: state.tick,
    landTick: state.tick + OUTSIDER_THROW_TICKS,
    direction,
    cells: Math.abs(target[0] - col) + Math.abs(target[1] - row),
    wraps: false,
    range: OUTSIDER_BOMB_RANGE,
    fuse: BOMB_FUSE_TICKS,
    pierce: false,
    remote: false,
  };
  state.thrownBombs.push(bomb);
  state.events.push({
    type: 'bomb-thrown',
    playerId: outsider.id,
    col: target[0],
    row: target[1],
  });
}
