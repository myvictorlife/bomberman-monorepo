import { cellIndex, isSpawnZone, tileAt } from './arena';
import { headsAt } from './bonk';
import { POWER_UP_COUNTS, TICK_RATE } from './constants';
import { findMap } from './maps';
import { GameState, PizzaThrow, PowerUpKind } from './types';

/**
 * The Pizzaiolo: the robot in the kitchen window of the Programador's top
 * wall. Out of reach — no flame gets to him — he throws a pizza into the
 * arena every {@link PIZZA_EVERY_TICKS}. He aims at a bomb that will still be
 * there when the pizza lands, else at a free cell; the cell shows a target
 * the whole flight. Where it lands:
 *
 * - on a bomb: the bomb goes out, and a crate stands there with an item inside;
 * - on free floor: a crate with an item as well;
 * - on someone's head: cheese in the face — half speed for a moment, no crate;
 * - on anything else (a flame, a crate, a player half on the cell): a splat.
 *
 * When the build breaks — the arena's alarm, every {@link PIZZA_PANIC_EVERY_TICKS}
 * for {@link PIZZA_PANIC_TICKS} — he panics and throws three at once.
 *
 * No dice: the cell is picked from the tick, so the server and every replay
 * agree.
 */

/** One throw every 20 s; the first a full period in. */
export const PIZZA_EVERY_TICKS = 20 * TICK_RATE;
/** He juggles for a second before each throw: the warning. */
export const PIZZA_WARN_TICKS = 1 * TICK_RATE;
/** How long a pizza is in the air — and its target on the floor. */
export const PIZZA_FLIGHT_TICKS = Math.round(1.5 * TICK_RATE);
/**
 * The broken build: every 30 s, for 2 s, the monitors go red and he throws
 * {@link PIZZA_PANIC_COUNT} pizzas as it starts. The client's alarm moment
 * runs on these numbers, so what is seen and what is thrown agree.
 */
export const PIZZA_PANIC_EVERY_TICKS = 30 * TICK_RATE;
export const PIZZA_PANIC_TICKS = 2 * TICK_RATE;
export const PIZZA_PANIC_COUNT = 3;
/** Cheese in the face: half speed for this long. */
export const PIZZA_CHEESE_TICKS = 2 * TICK_RATE;
/** What a pizza's crate hides: any item a round has, each as likely as the next. */
export const PIZZA_ITEMS = Object.keys(POWER_UP_COUNTS) as PowerUpKind[];

/** Whether the round's map has the Pizzaiolo throwing: a versus round on his map, before the walls close in. */
function throwing(state: GameState): boolean {
  if (state.stage || state.phase !== 'playing') return false;
  if (state.closesAtTick !== null && state.tick >= state.closesAtTick)
    return false;
  return !!findMap(state.mapId).pizzaiolo;
}

/** What the Pizzaiolo is doing at `tick`: panicking while the build is broken, juggling before a throw, throwing, or waiting. */
export function pizzaioloPose(
  state: Pick<GameState, 'tick' | 'pizzas'>,
): 'idle' | 'juggle' | 'throw' | 'panic' {
  if (
    state.tick % PIZZA_PANIC_EVERY_TICKS >=
    PIZZA_PANIC_EVERY_TICKS - PIZZA_PANIC_TICKS
  )
    return 'panic';
  const pizzas = state.pizzas ?? [];
  if (pizzas.some((p) => state.tick - p.startTick < TICK_RATE / 3))
    return 'throw';
  const phase = state.tick % PIZZA_EVERY_TICKS;
  return phase >= PIZZA_EVERY_TICKS - PIZZA_WARN_TICKS ? 'juggle' : 'idle';
}

/** Throws this tick's pizzas, if it is time: one on the beat, three when the build breaks. */
export function throwPizza(state: GameState): void {
  // A state from before the Pizzaiolo (an older server's) has no list yet.
  state.pizzas ??= [];
  if (state.tick === 0) return;
  const panic =
    state.tick % PIZZA_PANIC_EVERY_TICKS ===
    PIZZA_PANIC_EVERY_TICKS - PIZZA_PANIC_TICKS;
  if (!panic && state.tick % PIZZA_EVERY_TICKS !== 0) return;
  if (!throwing(state)) return;
  const count = panic ? PIZZA_PANIC_COUNT : 1;
  for (let i = 0; i < count; i++) launch(state, i);
}

function launch(state: GameState, salt: number): void {
  const window = findMap(state.mapId).pizzaiolo;
  if (!window) return;
  const cell = pizzaTarget(state, salt);
  if (!cell) return;
  const pizza: PizzaThrow = {
    // Unique within the round: at most a few in a tick.
    id: state.tick * 4 + salt,
    // From his hand: the window's right cell.
    fromCol: window[0] + 1,
    fromRow: window[1],
    col: cell[0],
    row: cell[1],
    startTick: state.tick,
    landTick: state.tick + PIZZA_FLIGHT_TICKS,
    direction: 'down',
    cells: 0,
    wraps: false,
  };
  state.pizzas.push(pizza);
  state.events.push({ type: 'pizza-thrown', col: cell[0], row: cell[1] });
}

/**
 * Where the next pizza goes: a bomb that will not have gone off by the time
 * it lands, if there is one; else a free floor cell with no item, out of the
 * spawn corners and not already a target.
 */
export function pizzaTarget(
  state: GameState,
  salt = 0,
): [number, number] | null {
  const targeted = (col: number, row: number) =>
    (state.pizzas ?? []).some((p) => p.col === col && p.row === row);
  const pick = <T>(list: readonly T[]): T | undefined =>
    list[(state.tick + state.nextBombId * 7 + salt * 11) % list.length];

  const bombs = state.bombs.filter(
    (b) =>
      (b.remote || b.fuse > PIZZA_FLIGHT_TICKS + 2) && !targeted(b.col, b.row),
  );
  const bomb = pick(bombs);
  if (bomb) return [bomb.col, bomb.row];

  const free: [number, number][] = [];
  for (let row = 1; row < state.rows - 1; row++) {
    for (let col = 1; col < state.cols - 1; col++) {
      if (tileAt(state, col, row) !== 'empty') continue;
      if (isSpawnZone(col, row) || targeted(col, row)) continue;
      if (state.powerUps.some((p) => p.col === col && p.row === row)) continue;
      if (state.bombs.some((b) => b.col === col && b.row === row)) continue;
      free.push([col, row]);
    }
  }
  return pick(free) ?? null;
}

/** Brings down the pizzas whose flight is over. */
export function landPizzas(state: GameState): void {
  if (!state.pizzas?.length) return;
  const landing = state.pizzas.filter((p) => state.tick >= p.landTick);
  if (landing.length === 0) return;
  state.pizzas = state.pizzas.filter((p) => state.tick < p.landTick);
  for (const pizza of landing) {
    const on = land(state, pizza);
    state.events.push({
      type: 'pizza-landed',
      col: pizza.col,
      row: pizza.row,
      on,
    });
  }
}

function land(
  state: GameState,
  pizza: PizzaThrow,
): 'bomb' | 'floor' | 'player' | 'splat' {
  const { col, row } = pizza;
  if (state.flames.some((f) => f.col === col && f.row === row)) return 'splat';
  const heads = headsAt(state, col, row);
  if (heads.length > 0) {
    for (const player of heads) {
      player.slimedUntilTick = Math.max(
        player.slimedUntilTick,
        state.tick + PIZZA_CHEESE_TICKS,
      );
    }
    return 'player';
  }
  if (tileAt(state, col, row) !== 'empty') return 'splat';
  // Someone half on the cell would be shut inside the crate.
  const overlapped = state.players.some(
    (p) => p.alive && Math.abs(p.x - col) < 1 && Math.abs(p.y - row) < 1,
  );
  if (overlapped) return 'splat';

  const index = cellIndex(state, col, row);
  const bombAt = state.bombs.findIndex((b) => b.col === col && b.row === row);
  const itemAt = state.powerUps.findIndex(
    (p) => p.col === col && p.row === row,
  );
  // The item on the floor goes under the crate, not to waste; else one of
  // them all, picked from the throw and the cell.
  const roll = pizza.id * 7 + col * 3 + row * 5;
  const hidden =
    (itemAt >= 0 ? state.powerUps[itemAt]?.kind : undefined) ??
    PIZZA_ITEMS[roll % PIZZA_ITEMS.length] ??
    null;
  if (itemAt >= 0) state.powerUps.splice(itemAt, 1);
  if (bombAt >= 0) state.bombs.splice(bombAt, 1);
  state.tiles[index] = 'block';
  state.hiddenPowerUps[index] = hidden;
  return bombAt >= 0 ? 'bomb' : 'floor';
}
