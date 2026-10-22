import { tileAt } from './arena';
import { findMount } from './characters';
import {
  BASE_SPEED,
  CURSE_FAST_SPEED,
  CURSE_SLOW_SPEED,
  MOUNT_SPEED_BONUS,
  SPEED_PER_LEVEL,
  TICK_RATE,
} from './constants';
import { Direction, GameState, Player } from './types';

const EPS = 1e-6;

export const DIRECTION_DELTA: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Cells per second, at `tick`: a dashing mount (Tatu) adds its sprint while the ability lasts. */
export function speedOf(
  player: Player,
  tick = Number.POSITIVE_INFINITY,
): number {
  const ability = player.mountId ? findMount(player.mountId).ability : null;
  const dash =
    ability?.kind === 'dash' && tick < player.abilityUntilTick
      ? ability.speedBonus
      : 0;
  const cursed =
    player.curse && tick < player.curse.untilTick ? player.curse.kind : null;
  if (cursed === 'slow') return CURSE_SLOW_SPEED;
  if (cursed === 'fast') return CURSE_FAST_SPEED;
  const speed =
    BASE_SPEED +
    SPEED_PER_LEVEL * player.speedLevel +
    (player.mountId ? MOUNT_SPEED_BONUS : 0) +
    dash;
  // A snail's slime: half speed while it sticks.
  return tick < player.slimedUntilTick ? speed / 2 : speed;
}

/** The cell a player counts as standing on: the one under their centre. */
export function playerCell(player: Pick<Body, 'x' | 'y'>): [number, number] {
  return [Math.round(player.x), Math.round(player.y)];
}

/**
 * Who may walk off a bomb just set on `col, row`: whoever stands on that cell
 * — their centre in it, as {@link playerCell} counts. Someone merely brushing
 * its edge on the way past is not on it, and the bomb blocks them like any
 * other: they walk on, but cannot turn back through it.
 */
export function standsOn(
  player: Pick<Body, 'x' | 'y'>,
  col: number,
  row: number,
): boolean {
  const [c, r] = playerCell(player);
  return c === col && r === row;
}

/** Whether `player`'s 1×1 body overlaps cell `col, row` at all. */
export function overlapsCell(
  player: Pick<Body, 'x' | 'y'>,
  col: number,
  row: number,
): boolean {
  return (
    Math.abs(player.x - col) < 1 - EPS && Math.abs(player.y - row) < 1 - EPS
  );
}

export function isBlockedFor(
  state: GameState,
  player: Player,
  col: number,
  row: number,
): boolean {
  const tile = tileAt(state, col, row);
  // Wall pass: a soft block is no obstacle.
  if (tile !== 'empty' && !(tile === 'block' && player.wallPass)) return true;
  // A boss stage's anthill stands like a block.
  if (
    state.stage?.mounds.some((m) => m.alive && m.col === col && m.row === row)
  )
    return true;
  const bomb = state.bombs.find((b) => b.col === col && b.row === row);
  if (!bomb || bomb.passThrough.includes(player.id)) return false;
  return !(
    player.mountId && findMount(player.mountId).ability.kind === 'pass-bombs'
  );
}

type Axis = 'x' | 'y';

/** Anything that walks the grid: a player in the arena, an outsider on the border. */
export interface Body {
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
}

/**
 * Moves `player` one tick towards `direction`.
 *
 * Players run along the corridors: at any moment at least one coordinate is a
 * whole number. Asking to turn while slightly off a lane does what the original
 * does — the player is first slid onto the nearest lane that is open in that
 * direction ("corner sliding"), and keeps going with whatever movement is left.
 */
export function movePlayer(
  state: GameState,
  player: Player,
  direction: Direction,
): void {
  moveBody(
    player,
    direction,
    speedOf(player, state.tick) / TICK_RATE,
    (col, row) => isBlockedFor(state, player, col, row),
  );
}

/**
 * The walk itself: `step` tiles towards `direction`, never into a cell
 * `blocked` says no to. See {@link movePlayer} for the lane rules.
 */
export function moveBody(
  player: Body,
  direction: Direction,
  distance: number,
  isBlocked: (col: number, row: number) => boolean,
): void {
  let step = distance;
  player.facing = direction;
  const [dx, dy] = DIRECTION_DELTA[direction];
  const along: Axis = dx !== 0 ? 'x' : 'y';
  const perp: Axis = along === 'x' ? 'y' : 'x';
  const dir = dx !== 0 ? dx : dy;

  const cellOf = (alongValue: number, perpValue: number): [number, number] =>
    along === 'x' ? [alongValue, perpValue] : [perpValue, alongValue];
  const blocked = (alongValue: number, perpValue: number) =>
    isBlocked(...cellOf(alongValue, perpValue));

  const startX = player.x;
  const startY = player.y;

  const lane = Math.round(player[perp]);
  const offset = player[perp] - lane;

  if (Math.abs(offset) > EPS) {
    // Off-lane: the along coordinate is whole, so the cell ahead is well defined.
    const ahead = Math.round(player[along]) + dir;
    const other = lane + Math.sign(offset);
    const target = !blocked(ahead, lane)
      ? lane
      : !blocked(ahead, other)
        ? other
        : null;

    if (target === null) {
      player.moving = false;
      return;
    }

    const distance = target - player[perp];
    const slide = Math.min(Math.abs(distance), step);
    player[perp] += Math.sign(distance) * slide;
    step -= slide;
    if (Math.abs(player[perp] - target) > EPS) {
      player.moving = true;
      return;
    }
    player[perp] = target;
  } else {
    player[perp] = lane;
  }

  if (step > EPS) {
    const current = player[along];
    let next = current + dir * step;
    if (dir > 0) {
      const entering = Math.ceil(next - EPS);
      if (
        entering > Math.ceil(current - EPS) &&
        blocked(entering, player[perp])
      ) {
        next = entering - 1;
      }
      // Already brushing a cell that blocks — a bomb set as they passed —
      // they may not walk deeper into it.
      const brushing = Math.ceil(current - EPS);
      if (brushing > current + EPS && blocked(brushing, player[perp]))
        next = Math.min(next, current);
    } else {
      const entering = Math.floor(next + EPS);
      if (
        entering < Math.floor(current + EPS) &&
        blocked(entering, player[perp])
      ) {
        next = entering + 1;
      }
      const brushing = Math.floor(current + EPS);
      if (brushing < current - EPS && blocked(brushing, player[perp]))
        next = Math.max(next, current);
    }
    player[along] = snap(next);
  }

  player.moving = player.x !== startX || player.y !== startY;
}

function snap(value: number): number {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < EPS ? rounded : value;
}
