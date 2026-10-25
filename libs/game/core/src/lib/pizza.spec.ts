import { cellIndex, isSpawnZone, tileAt } from './arena';
import { createGame, tick } from './game';
import {
  PIZZA_CHEESE_TICKS,
  PIZZA_EVERY_TICKS,
  PIZZA_FLIGHT_TICKS,
  PIZZA_ITEMS,
  PIZZA_PANIC_COUNT,
  PIZZA_PANIC_EVERY_TICKS,
  PIZZA_PANIC_TICKS,
  PIZZA_WARN_TICKS,
  pizzaioloPose,
} from './pizza';
import { run } from './testing.spec-helper';
import { Bomb, GameState } from './types';
import { MapId } from './maps';

/** A two-player round on `mapId` with the soft blocks cleared, a tick before the first throw. */
function round(mapId: MapId = 'programador'): GameState {
  const state = createGame({
    seed: 1,
    mapId,
    players: [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ],
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  state.hiddenPowerUps = state.hiddenPowerUps.map(() => null);
  state.tick = PIZZA_EVERY_TICKS - 1;
  return state;
}

function remoteBomb(state: GameState, col: number, row: number): Bomb {
  const bomb: Bomb = {
    id: state.nextBombId++,
    col,
    row,
    ownerId: 'p1',
    fuse: 1,
    range: 2,
    passThrough: [],
    pierce: false,
    remote: true,
  };
  state.bombs.push(bomb);
  return bomb;
}

describe('the Pizzaiolo', () => {
  it('throws only on his own map', () => {
    const state = round('nucleo');
    tick(state, {});
    expect(state.pizzas).toEqual([]);
  });

  it('juggles for a second, then throws at a free cell away from the spawns', () => {
    const state = round();
    state.tick = PIZZA_EVERY_TICKS - PIZZA_WARN_TICKS - 1;
    expect(pizzaioloPose(state)).toBe('idle');
    run(state, 1);
    expect(pizzaioloPose(state)).toBe('juggle');
    run(state, PIZZA_WARN_TICKS);

    expect(state.pizzas).toHaveLength(1);
    expect(pizzaioloPose(state)).toBe('throw');
    const pizza = state.pizzas[0];
    expect(pizza).toMatchObject({ fromCol: 3, fromRow: 0 });
    expect(tileAt(state, pizza?.col ?? 0, pizza?.row ?? 0)).toBe('empty');
    expect(isSpawnZone(pizza?.col ?? 0, pizza?.row ?? 0)).toBe(false);
    expect(state.events).toContainEqual({
      type: 'pizza-thrown',
      col: pizza?.col,
      row: pizza?.row,
    });
  });

  it('can hide any item a round has', () => {
    expect(PIZZA_ITEMS).toContain('bomb');
    expect(PIZZA_ITEMS).toContain('glove');
    expect(PIZZA_ITEMS).toContain('skull');
  });

  it('turns the free cell it lands on into a crate with an item inside', () => {
    const state = round();
    run(state, 1);
    const pizza = state.pizzas[0];
    if (!pizza) throw new Error('no pizza');
    run(state, PIZZA_FLIGHT_TICKS);

    expect(state.pizzas).toEqual([]);
    expect(tileAt(state, pizza.col, pizza.row)).toBe('block');
    expect(PIZZA_ITEMS).toContain(
      state.hiddenPowerUps[cellIndex(state, pizza.col, pizza.row)],
    );
    expect(state.events).toContainEqual({
      type: 'pizza-landed',
      col: pizza.col,
      row: pizza.row,
      on: 'floor',
    });
  });

  it('aims at a bomb and puts it out: a crate stands there instead', () => {
    const state = round();
    const bomb = remoteBomb(state, 5, 5);
    run(state, 1);
    expect(state.pizzas[0]).toMatchObject({ col: 5, row: 5 });
    run(state, PIZZA_FLIGHT_TICKS);

    expect(state.bombs.some((b) => b.id === bomb.id)).toBe(false);
    expect(tileAt(state, 5, 5)).toBe('block');
    expect(state.events).toContainEqual({
      type: 'pizza-landed',
      col: 5,
      row: 5,
      on: 'bomb',
    });
  });

  it('hides an item lying on the cell under the crate', () => {
    const state = round();
    remoteBomb(state, 5, 5);
    run(state, 1);
    state.bombs = [];
    state.powerUps.push({ col: 5, row: 5, kind: 'fire' });
    run(state, PIZZA_FLIGHT_TICKS);

    expect(state.powerUps).toEqual([]);
    expect(state.hiddenPowerUps[cellIndex(state, 5, 5)]).toBe('fire');
  });

  it('slows whoever it lands on, and leaves no crate', () => {
    const state = round();
    remoteBomb(state, 5, 5);
    run(state, 1);
    state.bombs = [];
    const p1 = state.players[0];
    if (!p1) throw new Error('no player');
    p1.x = 5;
    p1.y = 5;
    run(state, PIZZA_FLIGHT_TICKS);

    expect(tileAt(state, 5, 5)).toBe('empty');
    expect(p1.slimedUntilTick).toBe(state.tick + PIZZA_CHEESE_TICKS);
    expect(p1.alive).toBe(true);
  });

  it('panics when the build breaks: three pizzas at once, at three different cells', () => {
    const state = round();
    state.tick = PIZZA_PANIC_EVERY_TICKS - PIZZA_PANIC_TICKS - 1;
    run(state, 1);

    expect(pizzaioloPose(state)).toBe('panic');
    expect(state.pizzas).toHaveLength(PIZZA_PANIC_COUNT);
    const cells = new Set(state.pizzas.map((p) => `${p.col},${p.row}`));
    expect(cells.size).toBe(PIZZA_PANIC_COUNT);
    expect(new Set(state.pizzas.map((p) => p.id)).size).toBe(PIZZA_PANIC_COUNT);
    run(state, PIZZA_FLIGHT_TICKS);
    expect(state.pizzas).toEqual([]);
  });

  it('stops once the walls start closing in', () => {
    const state = round();
    state.closesAtTick = state.tick;
    run(state, 1);
    expect(state.pizzas).toEqual([]);
  });
});
