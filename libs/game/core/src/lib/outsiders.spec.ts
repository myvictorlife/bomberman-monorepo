import {
  BOMB_FLIGHT_TICKS_PER_CELL,
  BOMB_FUSE_TICKS,
  ENTRY_SHIELD_TICKS,
  FLAME_TICKS,
  OUTSIDER_BOMB_RANGE,
  OUTSIDER_SPAWN_CELLS,
  OUTSIDER_THROW_CELLS,
  OUTSIDER_THROW_TICKS,
  ROUND_END_DELAY_TICKS,
  START_BOMBS,
  START_FIRE,
} from './constants';
import { createGame, tick } from './game';
import {
  addOutsider,
  inwardDirection,
  isBorderCell,
  landingCell,
  removeOutsider,
} from './outsiders';
import { input, openArena, player, run, setBlock } from './testing.spec-helper';
import { GameState } from './types';

/** An open two-player arena with `ids` on the border. */
function withOutsiders(...ids: string[]): GameState {
  const state = openArena();
  for (const id of ids) addOutsider(state, { id, name: id.toUpperCase() });
  return state;
}

const outsider = (state: GameState, id: string) => {
  const found = state.outsiders.find((o) => o.id === id);
  if (!found) throw new Error(`no outsider ${id}`);
  return found;
};

/** Ticks until `done`, or fails after `max` ticks. */
function runUntil(state: GameState, done: () => boolean, max = 400): GameState {
  for (let i = 0; i < max && !done(); i++) tick(state, {});
  if (!done()) throw new Error('never happened');
  return state;
}

/** Parks `id` on the left wall, level with row `row`, and throws. */
function throwFrom(
  state: GameState,
  id: string,
  col: number,
  row: number,
): GameState {
  const o = outsider(state, id);
  o.x = col;
  o.y = row;
  return tick(state, { [id]: input(null, true) });
}

describe('the border', () => {
  it('is the ring of wall cells, and "in" is across it', () => {
    const state = openArena();

    expect(isBorderCell(state, 0, 5)).toBe(true);
    expect(isBorderCell(state, 14, 0)).toBe(true);
    expect(isBorderCell(state, 1, 1)).toBe(false);
    expect(isBorderCell(state, -1, 0)).toBe(false);

    expect(inwardDirection(state, 0, 5)).toBe('right');
    expect(inwardDirection(state, 14, 5)).toBe('left');
    expect(inwardDirection(state, 7, 0)).toBe('down');
    expect(inwardDirection(state, 7, 12)).toBe('up');
    // A corner has no one way in; the arena itself is not the border.
    expect(inwardDirection(state, 0, 0)).toBeNull();
    expect(inwardDirection(state, 3, 3)).toBeNull();
  });
});

describe('outsiders', () => {
  it('start on the spawn cells in order, facing in, and leave when removed', () => {
    const state = createGame({
      seed: 1,
      players: [{ id: 'a', name: 'A' }],
      outsiders: [
        { id: 'x', name: 'X', characterId: 'lia' },
        { id: 'y', name: 'Y' },
      ],
    });

    expect(state.outsiders.map((o) => [o.x, o.y])).toEqual([
      OUTSIDER_SPAWN_CELLS[0],
      OUTSIDER_SPAWN_CELLS[1],
    ]);
    expect(state.outsiders[0]).toMatchObject({
      characterId: 'lia',
      facing: 'down',
      moving: false,
    });

    removeOutsider(state, 'x');
    expect(state.outsiders.map((o) => o.id)).toEqual(['y']);
  });

  it('never seats the same account twice, nor a player of the round', () => {
    const state = withOutsiders('x');

    expect(addOutsider(state, { id: 'x', name: 'X' })).toBeNull();
    expect(addOutsider(state, { id: 'p1', name: 'P1' })).toBeNull();
    expect(state.outsiders).toHaveLength(1);
  });

  it('takes a spawn cell nobody stands on, and shares the first when all are taken', () => {
    const state = withOutsiders('a', 'b', 'c', 'd', 'e');
    const sixth = addOutsider(state, { id: 'f', name: 'F' });

    expect(
      new Set(state.outsiders.slice(0, 5).map((o) => `${o.x},${o.y}`)).size,
    ).toBe(5);
    expect([sixth?.x, sixth?.y]).toEqual(OUTSIDER_SPAWN_CELLS[0]);
  });

  it('walk along the border and never off it', () => {
    const state = withOutsiders('x');
    const o = outsider(state, 'x');
    o.x = 0;
    o.y = 5;

    run(state, 30, { x: input('down') });
    expect(o.x).toBe(0);
    expect(o.y).toBeGreaterThan(5);
    expect(o.moving).toBe(true);

    run(state, 30, { x: input('right') });
    expect(o.x).toBe(0);
    expect(o.moving).toBe(false);

    // Round the corner: down to the bottom row, then along it.
    o.y = 12;
    run(state, 30, { x: input('right') });
    expect(o.y).toBe(12);
    expect(o.x).toBeGreaterThan(0);
  });

  it('stand still without input', () => {
    const state = withOutsiders('x');
    run(state, 5, { x: input('down') });
    tick(state, {});
    expect(outsider(state, 'x').moving).toBe(false);
  });
});

describe('throwing', () => {
  it(`sends a bomb ${OUTSIDER_THROW_CELLS} cells in, which lands after its flight`, () => {
    const state = withOutsiders('x');
    throwFrom(state, 'x', 0, 5);

    expect(state.thrownBombs).toHaveLength(1);
    expect(state.thrownBombs[0]).toMatchObject({
      ownerId: 'x',
      fromCol: 0,
      fromRow: 5,
      col: 3,
      row: 5,
    });
    expect(state.events).toContainEqual({
      type: 'bomb-thrown',
      playerId: 'x',
      col: 3,
      row: 5,
    });
    expect(outsider(state, 'x').facing).toBe('right');
    expect(state.bombs).toHaveLength(0);

    run(state, OUTSIDER_THROW_TICKS - 1);
    expect(state.thrownBombs).toHaveLength(1);
    run(state, 1);

    expect(state.thrownBombs).toHaveLength(0);
    expect(state.bombs[0]).toMatchObject({
      col: 3,
      row: 5,
      ownerId: 'x',
      fuse: BOMB_FUSE_TICKS,
      range: OUTSIDER_BOMB_RANGE,
      pierce: false,
      remote: false,
    });
    expect(state.events).toContainEqual({
      type: 'bomb-placed',
      col: 3,
      row: 5,
      playerId: 'x',
    });
  });

  it('throws from every side, towards the arena', () => {
    const state = withOutsiders('x');
    throwFrom(state, 'x', 7, 0);
    expect(state.thrownBombs[0]).toMatchObject({ col: 7, row: 3 });
    state.thrownBombs = [];
    throwFrom(state, 'x', 14, 5);
    expect(state.thrownBombs[0]).toMatchObject({ col: 11, row: 5 });
    state.thrownBombs = [];
    throwFrom(state, 'x', 7, 12);
    expect(state.thrownBombs[0]).toMatchObject({ col: 7, row: 9 });
  });

  it('does nothing from a corner', () => {
    const state = withOutsiders('x');
    throwFrom(state, 'x', 0, 0);
    expect(state.thrownBombs).toHaveLength(0);
  });

  it('lands past a crate or a bomb, and is lost when the whole line is taken', () => {
    const state = withOutsiders('x');
    setBlock(state, 3, 5);
    state.bombs.push({
      id: 9,
      col: 4,
      row: 5,
      ownerId: 'p2',
      fuse: 999,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    expect(landingCell(state, 3, 5, 'right')).toEqual([5, 5]);
    throwFrom(state, 'x', 0, 5);
    expect(state.thrownBombs[0]).toMatchObject({ col: 5, row: 5 });

    // The cell was free when thrown and taken while in the air: it rolls on.
    setBlock(state, 5, 5);
    run(state, OUTSIDER_THROW_TICKS);
    expect(state.bombs.find((b) => b.ownerId === 'x')).toMatchObject({
      col: 6,
      row: 5,
    });

    // Everything up to the far wall is taken: the bomb is lost.
    for (let col = 3; col <= 13; col++) setBlock(state, col, 7);
    throwFrom(state, 'x', 0, 7);
    expect(state.thrownBombs).toHaveLength(0);
  });

  it('allows one bomb out at a time, in the air or on the ground', () => {
    const state = withOutsiders('x');
    throwFrom(state, 'x', 0, 5);
    throwFrom(state, 'x', 0, 7);
    expect(state.thrownBombs).toHaveLength(1);

    run(state, OUTSIDER_THROW_TICKS);
    throwFrom(state, 'x', 0, 7);
    expect(state.thrownBombs).toHaveLength(0);

    run(state, BOMB_FUSE_TICKS + FLAME_TICKS + 1);
    throwFrom(state, 'x', 0, 7);
    expect(state.thrownBombs).toHaveLength(1);
  });

  it('explodes at once when it lands in a flame', () => {
    const state = withOutsiders('x');
    throwFrom(state, 'x', 0, 5);
    run(state, OUTSIDER_THROW_TICKS - 1);
    state.flames.push({
      col: 3,
      row: 5,
      shape: 'center',
      ticksLeft: 5,
      ownerId: null,
    });
    run(state, 2);

    expect(state.bombs).toHaveLength(0);
    expect(state.events).toContainEqual({ type: 'explosion', col: 3, row: 5 });
  });
});

describe('a kill from outside', () => {
  /** `x` on the left wall throws at row 5 and `p1` is standing where it lands. */
  function killP1(): GameState {
    const state = withOutsiders('x');
    player(state, 'p1').x = 3;
    player(state, 'p1').y = 5;
    throwFrom(state, 'x', 0, 5);
    return runUntil(state, () => !player(state, 'p1').alive);
  }

  it('puts the thrower in the round where the victim fell, briefly shielded', () => {
    const state = killP1();
    const victim = player(state, 'p1');
    const entrant = player(state, 'x');

    expect(victim.alive).toBe(false);
    expect(state.outsiders).toHaveLength(0);
    expect(entrant).toMatchObject({
      slot: victim.slot,
      x: 3,
      y: 5,
      alive: true,
      maxBombs: START_BOMBS,
      fireRange: START_FIRE,
      mountId: null,
      shieldedUntilTick: (victim.diedAtTick ?? 0) + ENTRY_SHIELD_TICKS,
    });
    expect(state.events).toContainEqual({
      type: 'player-died',
      playerId: 'p1',
      killerId: 'x',
    });
    expect(state.events).toContainEqual({
      type: 'outsider-entered',
      playerId: 'x',
      victimId: 'p1',
    });

    // Standing in the flame that made the kill, and alive at the end of it.
    run(state, FLAME_TICKS);
    expect(player(state, 'x').alive).toBe(true);
    expect(state.players.map((p) => p.id)).toEqual(['p1', 'p2', 'x']);
  });

  it('keeps the round going with the entrant in it', () => {
    const state = killP1();
    run(state, ROUND_END_DELAY_TICKS + 5);

    expect(state.phase).toBe('playing');
    expect(state.endsAtTick).toBeNull();
  });

  it('is only a death, not an entry, when the thrower has left the border', () => {
    const state = withOutsiders('x');
    player(state, 'p1').x = 3;
    player(state, 'p1').y = 5;
    throwFrom(state, 'x', 0, 5);
    removeOutsider(state, 'x');
    // Off p1's head and one cell on: the blast still reaches them, dizzy where they stood.
    run(
      state,
      OUTSIDER_THROW_TICKS + BOMB_FLIGHT_TICKS_PER_CELL + BOMB_FUSE_TICKS,
    );

    expect(player(state, 'p1').alive).toBe(false);
    expect(state.players.some((p) => p.id === 'x')).toBe(false);
  });

  it('does not count when a mount takes the hit', () => {
    const state = withOutsiders('x');
    const p1 = player(state, 'p1');
    p1.x = 3;
    p1.y = 5;
    p1.mountId = 'tatu';
    throwFrom(state, 'x', 0, 5);
    run(
      state,
      OUTSIDER_THROW_TICKS + BOMB_FLIGHT_TICKS_PER_CELL + BOMB_FUSE_TICKS,
    );

    expect(p1.alive).toBe(true);
    expect(p1.mountId).toBeNull();
    expect(state.outsiders.map((o) => o.id)).toEqual(['x']);
  });

  it('belongs to the first flame on the cell when two cross', () => {
    const state = withOutsiders('x');
    const p1 = player(state, 'p1');
    p1.x = 3;
    p1.y = 5;
    // p2's bomb next to the victim goes off on the same tick as x's, but first.
    state.bombs.push({
      id: 9,
      col: 3,
      row: 4,
      ownerId: 'p2',
      fuse: OUTSIDER_THROW_TICKS + BOMB_FUSE_TICKS,
      range: 2,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    throwFrom(state, 'x', 0, 5);
    run(state, OUTSIDER_THROW_TICKS + BOMB_FUSE_TICKS);

    expect(p1.alive).toBe(false);
    expect(state.flames.find((f) => f.col === 3 && f.row === 5)?.ownerId).toBe(
      'p2',
    );
    expect(state.outsiders.map((o) => o.id)).toEqual(['x']);
  });

  it('resumes the ending once the entrant is the only one left, or none is', () => {
    const state = killP1();
    // p2 walks into the entrant's next bomb line: nobody else is left afterwards.
    player(state, 'p2').alive = false;
    run(state, ROUND_END_DELAY_TICKS + 1);

    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('x');
  });
});
