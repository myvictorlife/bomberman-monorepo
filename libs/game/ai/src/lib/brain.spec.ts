import {
  BOMB_FUSE_TICKS,
  Bomb,
  cellIndex,
  createGame,
  GameState,
  PlayerInput,
  tick,
} from '@libs/game-core';
import { Bot } from './brain';
import { blastCells, dangerMap, isSafe } from './danger';
import { isBotLevel } from './levels';
import { reachable } from './paths';

/** Two players on an arena with no crates: `bot` the computer, `p1` a still target. */
function arena(): GameState {
  const state = createGame({
    seed: 1,
    players: [
      { id: 'p1', name: 'P1' },
      { id: 'bot', name: 'CPU' },
    ],
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  state.hiddenPowerUps = state.hiddenPowerUps.map(() => null);
  return state;
}

const at = (state: GameState, id: string) =>
  state.players.find((p) => p.id === id) as GameState['players'][0];

function place(state: GameState, id: string, col: number, row: number): void {
  const p = at(state, id);
  p.x = col;
  p.y = row;
}

function bomb(
  state: GameState,
  col: number,
  row: number,
  fuse = BOMB_FUSE_TICKS,
): Bomb {
  const b: Bomb = {
    id: state.nextBombId++,
    col,
    row,
    ownerId: 'p1',
    fuse,
    range: 2,
    passThrough: [],
    pierce: false,
    remote: false,
  };
  state.bombs.push(b);
  return b;
}

/** Runs `n` ticks with the bot deciding and everyone else standing still. */
function play(state: GameState, bot: Bot, n: number): PlayerInput[] {
  const presses: PlayerInput[] = [];
  for (let i = 0; i < n && state.phase === 'playing'; i++) {
    const input = bot.decide(state);
    presses.push(input);
    tick(state, { bot: input });
  }
  return presses;
}

describe('the danger map', () => {
  it('marks a bomb’s blast, stopped by stone, from when it goes off', () => {
    const state = arena();
    bomb(state, 3, 1, 50);
    const map = dangerMap(state, {
      viewerId: 'bot',
      readsChains: true,
      readsClosing: true,
    });
    expect(isSafe(map, 5, 1)).toBe(false);
    expect(isSafe(map, 6, 1)).toBe(true);
    expect(map.start[cellIndex(state, 4, 1)]).toBe(50);
    // (2, 2) is stone: nothing below the bomb's column past it.
    expect(
      blastCells(state, { col: 2, row: 1, range: 3, pierce: false }),
    ).not.toContainEqual([2, 2]);
  });

  it('reads a chain: a bomb in another’s blast goes off with it', () => {
    const state = arena();
    bomb(state, 3, 1, 10);
    bomb(state, 5, 1, 150);
    const chained = dangerMap(state, {
      viewerId: 'bot',
      readsChains: true,
      readsClosing: true,
    });
    const naive = dangerMap(state, {
      viewerId: 'bot',
      readsChains: false,
      readsClosing: true,
    });
    expect(chained.start[cellIndex(state, 7, 1)]).toBe(10);
    expect(naive.start[cellIndex(state, 7, 1)]).toBe(150);
  });

  it('never routes through fire', () => {
    const state = arena();
    place(state, 'bot', 1, 3);
    state.flames.push({
      col: 1,
      row: 2,
      shape: 'center',
      ticksLeft: 30,
      ownerId: null,
    });
    const map = dangerMap(state, {
      viewerId: 'bot',
      readsChains: true,
      readsClosing: true,
    });
    const reach = reachable(state, at(state, 'bot'), map);
    // Not straight in while it burns: only the long way round, once it is out.
    expect(reach.steps[cellIndex(state, 1, 2)]).not.toBe(1);
  });
});

describe('a bot', () => {
  it('runs from a bomb about to go off', () => {
    const state = arena();
    place(state, 'bot', 5, 1);
    place(state, 'p1', 13, 11);
    bomb(state, 4, 1, 60);
    play(state, new Bot('bot', 'medium'), 90);
    expect(at(state, 'bot').alive).toBe(true);
  });

  it('only fears a bomb once it has had time to notice it', () => {
    // A bomb dropped with less fuse left than the bot's reaction time.
    const late = (level: 'casual' | 'medium') => {
      const state = arena();
      place(state, 'bot', 5, 1);
      place(state, 'p1', 5, 3);
      bomb(state, 4, 1, 30);
      play(state, new Bot('bot', level), 60);
      return at(state, 'bot').alive;
    };
    expect(late('medium')).toBe(true);
    expect(late('casual')).toBe(false);
  });

  it('never drops a bomb it cannot get away from', () => {
    const state = arena();
    // Boxed in: stone and crates on every side but the way in, which a bomb covers.
    place(state, 'bot', 1, 1);
    place(state, 'p1', 13, 11);
    state.tiles[cellIndex(state, 2, 1)] = 'block';
    state.tiles[cellIndex(state, 1, 2)] = 'block';
    const presses = play(state, new Bot('bot', 'hard'), 120);
    expect(presses.some((p) => p.bomb)).toBe(false);
    expect(at(state, 'bot').alive).toBe(true);
  });

  it('breaks crates, and lives through its own bombs', () => {
    const state = createGame({
      seed: 3,
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'bot', name: 'CPU' },
      ],
    });
    const crates = () => state.tiles.filter((t) => t === 'block').length;
    const before = crates();
    play(state, new Bot('bot', 'hard'), 30 * 60);
    expect(crates()).toBeLessThan(before);
    expect(at(state, 'bot').alive).toBe(true);
  });

  it('catches a player who has nowhere to run', () => {
    const state = arena();
    // p1 stands still at the end of a dead-end corridor.
    place(state, 'p1', 1, 1);
    state.tiles[cellIndex(state, 1, 2)] = 'block';
    place(state, 'bot', 6, 1);
    play(state, new Bot('bot', 'hard'), 20 * 60);
    expect(at(state, 'p1').alive).toBe(false);
    expect(at(state, 'bot').alive).toBe(true);
  });

  it('picks up an item in reach', () => {
    const state = arena();
    place(state, 'bot', 5, 1);
    place(state, 'p1', 13, 11);
    state.powerUps.push({ col: 5, row: 3, kind: 'fire' });
    play(state, new Bot('bot', 'medium'), 120);
    expect(at(state, 'bot').fireRange).toBe(3);
  });

  it('throws right back whatever lands in its hands', () => {
    const state = arena();
    at(state, 'bot').carrying = 'p1';
    expect(new Bot('bot', 'easy').decide(state)).toEqual({
      direction: null,
      bomb: true,
    });
  });

  it('does nothing once out of the round', () => {
    const state = arena();
    at(state, 'bot').alive = false;
    expect(new Bot('bot', 'easy').decide(state)).toEqual({
      direction: null,
      bomb: false,
    });
  });
});

describe('levels', () => {
  it('knows its levels', () => {
    expect(isBotLevel('hard')).toBe(true);
    expect(isBotLevel('godlike')).toBe(false);
  });
});
