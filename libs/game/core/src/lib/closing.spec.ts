import { tileAt } from './arena';
import { closingOrder, isClosing, secondsUntilClosing } from './closing';
import {
  CLOSING_STEP_TICKS,
  ROUND_END_DELAY_TICKS,
  ROUND_TIME_TICKS,
  TICK_RATE,
} from './constants';
import { createGame, eliminatePlayer, tick } from './game';
import { openArena, player, setBlock } from './testing.spec-helper';
import { GameState } from './types';

/** An open arena whose clock runs out on the next tick. */
function aboutToClose(): GameState {
  const state = openArena();
  state.closesAtTick = state.tick + 1;
  return state;
}

/** Ticks until the `n`-th wall has dropped since the clock ran out. */
function dropWalls(state: GameState, n: number): GameState {
  let dropped = 0;
  for (let i = 0; i < n * CLOSING_STEP_TICKS + 1 && dropped < n; i++) {
    tick(state, {});
    dropped += state.events.filter((e) => e.type === 'wall-dropped').length;
  }
  return state;
}

describe('the round clock', () => {
  it('runs three minutes in a round of two or more', () => {
    const state = openArena();
    expect(state.closesAtTick).toBe(ROUND_TIME_TICKS);
    expect(secondsUntilClosing(state, TICK_RATE)).toBe(180);
    expect(isClosing(state)).toBe(false);
  });

  it('has no clock in a one-player sandbox, or when a round asks for none', () => {
    expect(
      createGame({ seed: 1, players: [{ id: 'p1', name: 'P1' }] }).closesAtTick,
    ).toBeNull();
    const players = [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ];
    expect(
      createGame({ seed: 1, players, roundTicks: null }).closesAtTick,
    ).toBeNull();
    expect(createGame({ seed: 1, players, roundTicks: 600 }).closesAtTick).toBe(
      600,
    );
  });
});

describe('the closing arena', () => {
  it('drops walls in a clockwise spiral covering every inner cell once', () => {
    const order = closingOrder(15, 13);
    expect(order).toHaveLength(13 * 11);
    expect(new Set(order.map(([c, r]) => `${c},${r}`)).size).toBe(13 * 11);
    expect(order.slice(0, 3)).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    // Along the top, then down the right side.
    expect(order[13]).toEqual([13, 2]);
  });

  it('announces the closing, then drops one wall per step', () => {
    const state = aboutToClose();
    tick(state, {});
    expect(state.events).toContainEqual({ type: 'arena-closing' });
    expect(state.events).toContainEqual({
      type: 'wall-dropped',
      col: 1,
      row: 1,
    });
    expect(tileAt(state, 1, 1)).toBe('wall');

    for (let i = 0; i < CLOSING_STEP_TICKS; i++) tick(state, {});
    expect(tileAt(state, 2, 1)).toBe('wall');
    expect(tileAt(state, 3, 1)).toBe('empty');
  });

  it('crushes whoever stands under a falling wall, mount and vest or not, with no killer', () => {
    const state = aboutToClose();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    p1.vestUntilTick = 10_000;
    tick(state, {});
    expect(p1.alive).toBe(false);
    expect(state.events).toContainEqual({
      type: 'player-died',
      playerId: 'p1',
      killerId: null,
    });
  });

  it('crushes nobody once the round is decided: the last one standing keeps the win', () => {
    const state = openArena();
    eliminatePlayer(state, 'p2');
    tick(state, {});
    state.closesAtTick = state.tick + 1;
    for (let i = 0; i < ROUND_END_DELAY_TICKS && state.phase === 'playing'; i++)
      tick(state, {});

    expect(tileAt(state, 1, 1)).toBe('wall');
    expect(player(state, 'p1').alive).toBe(true);
    expect(state.winnerId).toBe('p1');
  });

  it('takes the bomb, item or crate under it', () => {
    const state = aboutToClose();
    // Move p1 off the first cell so only the things are under it.
    player(state, 'p1').x = 3;
    player(state, 'p1').y = 3;
    setBlock(state, 2, 1);
    state.bombs.push({
      id: 99,
      col: 1,
      row: 1,
      ownerId: 'p2',
      fuse: 100,
      range: 2,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    state.powerUps.push({ col: 3, row: 1, kind: 'fire' });
    dropWalls(state, 3);
    expect(state.bombs).toHaveLength(0);
    expect(state.powerUps).toHaveLength(0);
    expect(tileAt(state, 2, 1)).toBe('wall');
  });

  it('skips cells that already are walls without losing a step', () => {
    const state = aboutToClose();
    player(state, 'p1').x = 3;
    player(state, 'p1').y = 3;
    // The second ring starts at (2, 2), a pillar: the drop after the outer ring goes to (3, 2).
    state.closedCells = closingOrder(state.cols, state.rows).findIndex(
      ([c, r]) => c === 2 && r === 2,
    );
    tick(state, {});
    expect(state.events).toContainEqual({
      type: 'wall-dropped',
      col: 3,
      row: 2,
    });
  });

  it('without closing walls, ends the round as a draw when the clock runs out', () => {
    const state = createGame({
      seed: 1,
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
      ],
      roundTicks: 10,
      closingWalls: false,
    });
    for (let i = 0; i < 10; i++) tick(state, {});
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBeNull();
    expect(state.events).toContainEqual({ type: 'round-over', winnerId: null });
    expect(state.tiles.filter((t) => t === 'wall').length).toBe(
      createGame({ seed: 1, players: [{ id: 'p1', name: 'P1' }] }).tiles.filter(
        (t) => t === 'wall',
      ).length,
    );
  });

  it('ends a round nobody would end: the walls close until one is left', () => {
    const state = openArena();
    state.closesAtTick = 1;
    for (
      let i = 0;
      i < 13 * 11 * CLOSING_STEP_TICKS + 200 && state.phase === 'playing';
      i++
    )
      tick(state, {});
    expect(state.phase).toBe('over');
  });
});
