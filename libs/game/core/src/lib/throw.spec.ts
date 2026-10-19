import {
  BOMB_FLIGHT_TICKS_PER_CELL,
  BOMB_FUSE_TICKS,
  GLOVE_THROW_CELLS,
} from './constants';
import { activeBombCount, eliminatePlayer, tick } from './game';
import { input, openArena, player, run, setBlock } from './testing.spec-helper';
import { bounceLanding, flightPosition, wrapStep } from './throw';
import { Bomb, GameState } from './types';

/** A bomb of `ownerId` on `col, row`, as if dropped there a moment ago. */
function bombAt(
  state: GameState,
  col: number,
  row: number,
  ownerId: string,
): Bomb {
  const bomb: Bomb = {
    id: state.nextBombId++,
    col,
    row,
    ownerId,
    fuse: BOMB_FUSE_TICKS,
    range: 2,
    passThrough: [],
    pierce: false,
    remote: false,
  };
  state.bombs.push(bomb);
  return bomb;
}

const press = (state: GameState, id = 'p1') =>
  tick(state, { [id]: input(null, true) });

/** Runs until nothing is in the air any more. */
function land(state: GameState): GameState {
  for (let i = 0; i < 200 && state.thrownBombs.length > 0; i++) tick(state, {});
  return state;
}

describe('the flight of a bomb', () => {
  it('wraps round the arena: out on one side, in on the other', () => {
    const state = openArena();
    expect(wrapStep(state, state.cols - 2, 5, 'right')).toEqual([1, 5]);
    expect(wrapStep(state, 1, 5, 'left')).toEqual([state.cols - 2, 5]);
    expect(wrapStep(state, 5, 1, 'up')).toEqual([5, state.rows - 2]);
    expect(wrapStep(state, 5, state.rows - 2, 'down')).toEqual([5, 1]);
  });

  it('lands the given number of cells on when the cell is free', () => {
    expect(bounceLanding(openArena(), 1, 1, 'right', 3)).toEqual({
      cell: [4, 1],
      cells: 3,
    });
  });

  it('bounces over a crate, a pillar or a bomb to the next free cell', () => {
    const state = openArena();
    setBlock(state, 4, 1);
    bombAt(state, 5, 1, 'p2');
    expect(bounceLanding(state, 1, 1, 'right', 3)).toEqual({
      cell: [6, 1],
      cells: 5,
    });
    // (2, 2) is a pillar.
    expect(bounceLanding(state, 2, 1, 'down', 1)).toEqual({
      cell: [2, 3],
      cells: 2,
    });
  });

  it('flies off the top and comes down from the bottom', () => {
    const state = openArena();
    // Up from row 1: the bottom row, then two more.
    expect(bounceLanding(state, 1, 1, 'up', 3)).toEqual({
      cell: [1, state.rows - 4],
      cells: 3,
    });
  });

  it('has nowhere to land when the whole line is taken', () => {
    const state = openArena();
    for (let col = 1; col <= state.cols - 2; col++) setBlock(state, col, 3);
    expect(bounceLanding(state, 1, 3, 'right', 1)).toBeNull();
  });

  it('is drawn crossing the wall, not across the arena', () => {
    const state = openArena();
    player(state, 'p1').glove = true;
    player(state, 'p1').facing = 'up';
    press(state);
    press(state);
    press(state);
    const thrown = state.thrownBombs[0] as NonNullable<
      GameState['thrownBombs'][0]
    >;
    // A third of the way: one cell up from row 1, so half over the top wall's edge.
    const [, row] = flightPosition(
      state,
      thrown,
      thrown.startTick + BOMB_FLIGHT_TICKS_PER_CELL,
    );
    expect(row).toBeGreaterThan(state.rows - 3);
  });
});

describe('the glove', () => {
  it('picks up the bomb just dropped, then throws it', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.glove = true;
    p1.facing = 'right';

    press(state);
    expect(state.bombs).toHaveLength(1);
    press(state);
    expect(state.bombs).toHaveLength(0);
    expect(p1.heldBomb).not.toBeNull();
    expect(state.events).toContainEqual({
      type: 'bomb-picked-up',
      playerId: 'p1',
    });

    press(state);
    expect(p1.heldBomb).toBeNull();
    expect(state.thrownBombs[0]).toMatchObject({
      col: 1 + GLOVE_THROW_CELLS,
      row: 1,
      ownerId: 'p1',
    });

    land(state);
    expect(state.bombs).toEqual([
      expect.objectContaining({
        col: 1 + GLOVE_THROW_CELLS,
        row: 1,
        ownerId: 'p1',
      }),
    ]);
  });

  it('keeps the fuse burning in hand, and waits in the air', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.glove = true;
    p1.facing = 'right';
    press(state);
    press(state);
    run(state, 30);
    const inHand = p1.heldBomb?.fuse ?? 0;
    expect(inHand).toBeLessThan(BOMB_FUSE_TICKS - 30);

    press(state);
    land(state);
    expect(state.bombs[0]?.fuse).toBe(inHand);
  });

  it('walks with the bomb in hand, and it counts as one of theirs', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.glove = true;
    press(state);
    press(state);
    run(state, 20, { p1: input('right') });
    expect(p1.x).toBeGreaterThan(1);
    expect(p1.heldBomb).not.toBeNull();
    expect(activeBombCount(state, 'p1')).toBe(1);
  });

  it('goes off in the hands of whoever holds it too long', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.glove = true;
    press(state);
    press(state);
    run(state, BOMB_FUSE_TICKS + 2);
    expect(p1.alive).toBe(false);
    expect(p1.heldBomb).toBeNull();
  });

  it('cannot pick up a bomb without the glove: the press does nothing', () => {
    const state = openArena();
    press(state);
    press(state);
    expect(state.bombs).toHaveLength(1);
    expect(player(state, 'p1').heldBomb).toBeNull();
  });

  it("cannot pick up someone else's bomb", () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.glove = true;
    p1.maxBombs = 2;
    const theirs = bombAt(state, 1, 1, 'p2');
    theirs.passThrough = ['p1'];
    press(state);
    expect(p1.heldBomb).toBeNull();
  });

  it('drops the bomb in hand when the holder leaves the game', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.glove = true;
    press(state);
    press(state);
    eliminatePlayer(state, 'p1');
    expect(state.bombs).toEqual([expect.objectContaining({ col: 1, row: 1 })]);
  });
});

describe('the kick', () => {
  /** p1 with the kick, and a bomb of p2's two cells to the right of p1. */
  function kickable(): GameState {
    const state = openArena();
    player(state, 'p1').kick = true;
    bombAt(state, 3, 1, 'p2');
    return state;
  }

  it('sends a bomb walked into hopping one cell on, still theirs', () => {
    const state = kickable();
    let kicked = false;
    for (let i = 0; i < 60 && !kicked; i++) {
      tick(state, { p1: input('right') });
      kicked = state.events.some((e) => e.type === 'bomb-kicked');
    }
    expect(kicked).toBe(true);
    expect(state.thrownBombs[0]).toMatchObject({ col: 4, row: 1, cells: 1 });
    land(state);
    expect(state.bombs[0]).toMatchObject({ col: 4, row: 1, ownerId: 'p2' });
  });

  it('hops over a crate in the way', () => {
    const state = kickable();
    setBlock(state, 4, 1);
    for (let i = 0; i < 60 && state.thrownBombs.length === 0; i++)
      tick(state, { p1: input('right') });
    expect(state.thrownBombs[0]).toMatchObject({ col: 5, row: 1, cells: 2 });
  });

  it('keeps the fuse burning in the air', () => {
    const state = kickable();
    for (let i = 0; i < 60 && state.thrownBombs.length === 0; i++)
      tick(state, { p1: input('right') });
    expect(state.thrownBombs[0]?.fuse).toBeLessThan(
      BOMB_FUSE_TICKS - BOMB_FLIGHT_TICKS_PER_CELL,
    );
  });

  it('without the kick, the bomb stops the player', () => {
    const state = openArena();
    bombAt(state, 3, 1, 'p2');
    run(state, 30, { p1: input('right') });
    expect(state.bombs[0]).toMatchObject({ col: 3, row: 1 });
    expect(player(state, 'p1').x).toBe(2);
  });
});

describe('a bomb on the head', () => {
  /** p1 kicks p2's bomb right, towards p2 standing where it would land. */
  function kickAt(): GameState {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.kick = true;
    bombAt(state, 3, 1, 'p1').passThrough = [];
    const p2 = player(state, 'p2');
    p2.x = 4;
    p2.y = 1;
    for (let i = 0; i < 60 && state.thrownBombs.length === 0; i++)
      tick(state, { p1: input('right') });
    return state;
  }

  it('bounces one cell further and leaves the one it hit dizzy', () => {
    const state = kickAt();
    let bonked = false;
    for (let i = 0; i < 60 && !state.bombs.length; i++) {
      tick(state, {});
      bonked ||= state.events.some(
        (e) => e.type === 'player-bonked' && e.playerId === 'p2',
      );
    }

    expect(bonked).toBe(true);
    expect(state.bombs[0]).toMatchObject({ col: 5, row: 1 });
    const p2 = player(state, 'p2');
    expect(p2.stunnedUntilTick).toBeGreaterThan(state.tick);
    run(state, 5, { p2: input('down') });
    expect(p2.y).toBe(1);
  });

  it('knocks two items loose onto the floor around them, the same two for the same hit', () => {
    const drops = () => {
      const state = kickAt();
      const p2 = player(state, 'p2');
      Object.assign(p2, {
        maxBombs: 3,
        fireRange: 4,
        kick: true,
        speedLevel: 0,
        pierce: false,
        remote: false,
      });
      land(state);
      return { state, p2 };
    };
    const { state, p2 } = drops();

    expect(state.powerUps).toHaveLength(2);
    for (const item of state.powerUps)
      expect(
        Math.abs(item.col - 4) + Math.abs(item.row - 1),
      ).toBeLessThanOrEqual(2);
    const lost = 3 - p2.maxBombs + (4 - p2.fireRange) + (p2.kick ? 0 : 1);
    expect(lost).toBe(2);
    expect(state.powerUps.map((p) => p.kind).sort()).toEqual(
      drops()
        .state.powerUps.map((p) => p.kind)
        .sort(),
    );
  });

  it('takes nothing from a player with only the starting kit, and never the glove', () => {
    const state = kickAt();
    player(state, 'p2').glove = true;
    land(state);

    expect(state.powerUps).toEqual([]);
    expect(player(state, 'p2').glove).toBe(true);
  });

  it('flies over a player in mid-air, and lands on them only with their feet on the ground', () => {
    const state = kickAt();
    player(state, 'p2').jump = {
      fromX: 4,
      fromY: 1,
      toX: 4,
      toY: 1,
      startTick: 0,
      endTick: 10_000,
    };
    land(state);

    expect(state.bombs[0]).toMatchObject({ col: 4, row: 1 });
  });
});
