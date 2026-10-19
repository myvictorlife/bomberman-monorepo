import {
  BOMB_FLIGHT_TICKS_PER_CELL,
  CARRY_TICKS,
  GLOVE_THROW_CELLS,
  STUN_TICKS,
} from './constants';
import { DIRECTION_DELTA, playerCell } from './movement';
import { bounceLanding, isFreeLanding } from './throw';
import { GameState, Player } from './types';

/**
 * The glove, on people: the bomb key, facing a player right next to you,
 * lifts them overhead. They cannot move or drop bombs, and flames pass under
 * them; after {@link CARRY_TICKS} they wriggle free. The bomb key again throws
 * them {@link GLOVE_THROW_CELLS} cells the way you face — over crates, stone
 * and bombs, bouncing on to a free cell and wrapping round the arena like a
 * thrown bomb — and they land dizzy for {@link STUN_TICKS}.
 */

/** Carried, or in the air after a throw: out of reach of their own keys. */
export function isAirborne(player: Player): boolean {
  return player.carriedBy !== null || player.flight !== null;
}

function byId(state: GameState, id: string | null): Player | undefined {
  return id === null ? undefined : state.players.find((p) => p.id === id);
}

/**
 * Lifts the player in front of `holder` — on the next cell the way they face,
 * or sharing their cell. Returns `false` when there is nobody to lift.
 */
export function grabPlayer(state: GameState, holder: Player): boolean {
  if (holder.carrying || holder.heldBomb || holder.jump) return false;
  const [col, row] = playerCell(holder);
  const [dx, dy] = DIRECTION_DELTA[holder.facing];
  const target = state.players.find((p) => {
    if (p === holder || !p.alive || p.jump || isAirborne(p) || p.carrying)
      return false;
    const [c, r] = playerCell(p);
    return (c === col + dx && r === row + dy) || (c === col && r === row);
  });
  if (!target) return false;
  holder.carrying = target.id;
  target.carriedBy = holder.id;
  target.carriedUntilTick = state.tick + CARRY_TICKS;
  target.moving = false;
  state.events.push({
    type: 'player-grabbed',
    playerId: holder.id,
    targetId: target.id,
  });
  return true;
}

/** Throws the player overhead; with nowhere to land, they are simply put down. */
export function throwCarried(state: GameState, holder: Player): void {
  const target = byId(state, holder.carrying);
  if (!target) {
    holder.carrying = null;
    return;
  }
  const from = playerCell(holder);
  const landing = bounceLanding(
    state,
    from[0],
    from[1],
    holder.facing,
    GLOVE_THROW_CELLS,
  );
  if (!landing) {
    putDown(state, holder);
    return;
  }
  holder.carrying = null;
  target.carriedBy = null;
  target.flight = {
    fromCol: from[0],
    fromRow: from[1],
    col: landing.cell[0],
    row: landing.cell[1],
    startTick: state.tick,
    landTick: state.tick + landing.cells * BOMB_FLIGHT_TICKS_PER_CELL,
    direction: holder.facing,
    cells: landing.cells,
    wraps: true,
  };
  target.facing = holder.facing;
  state.events.push({
    type: 'player-thrown',
    playerId: holder.id,
    targetId: target.id,
  });
}

/** The held player steps down where the holder stands. */
function putDown(state: GameState, holder: Player): void {
  const target = byId(state, holder.carrying);
  holder.carrying = null;
  if (!target) return;
  target.carriedBy = null;
  const [col, row] = playerCell(holder);
  target.x = col;
  target.y = row;
}

/** Runs once per tick, after everyone moved: the held ride along, or wriggle free when time is up. */
export function carryAlong(state: GameState): void {
  for (const holder of state.players) {
    if (!holder.carrying) continue;
    const target = byId(state, holder.carrying);
    if (!holder.alive || !target?.alive) {
      letGo(state, holder);
      continue;
    }
    if (state.tick >= target.carriedUntilTick) {
      putDown(state, holder);
      continue;
    }
    target.x = holder.x;
    target.y = holder.y;
  }
}

/** Thrown players whose flight is over come down, dizzy, on the cell — or the next free one. */
export function landThrownPlayers(state: GameState): void {
  for (const player of state.players) {
    const flight = player.flight;
    if (!flight || state.tick < flight.landTick) continue;
    const cell: [number, number] = isFreeLanding(state, flight.col, flight.row)
      ? [flight.col, flight.row]
      : (bounceLanding(state, flight.col, flight.row, flight.direction, 0)
          ?.cell ?? [flight.col, flight.row]);
    player.flight = null;
    player.x = cell[0];
    player.y = cell[1];
    player.moving = false;
    player.stunnedUntilTick = state.tick + STUN_TICKS;
    state.events.push({ type: 'player-landed', playerId: player.id });
  }
}

/**
 * Someone is out of the round: whoever they held is put down where they
 * stood, and whoever held them has empty hands.
 */
export function letGo(state: GameState, player: Player): void {
  if (player.carrying) putDown(state, player);
  const holder = byId(state, player.carriedBy);
  if (holder) holder.carrying = null;
  player.carriedBy = null;
  player.flight = null;
}
