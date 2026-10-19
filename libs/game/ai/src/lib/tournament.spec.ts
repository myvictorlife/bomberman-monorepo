import { createGame, GameState, MAPS, TICK_RATE, tick } from '@libs/game-core';
import { BotDirector, BotSetup } from './director';
import { BotLevel } from './levels';

interface Result {
  winner: string | null;
  seconds: number;
  selfKills: number;
  deaths: number;
  crushed: number;
  closing: boolean;
}

/** One headless match between bots, to the end. */
function playMatch(levels: BotLevel[], seed: number, mapIndex = 0): Result {
  const setups: BotSetup[] = levels.map((level, i) => ({
    id: `b${i}-${level}`,
    level,
  }));
  const state: GameState = createGame({
    seed,
    mapId: MAPS[mapIndex % MAPS.length]?.id,
    players: setups.map((s) => ({ id: s.id, name: s.id })),
  });
  const director = new BotDirector(setups, seed);
  let selfKills = 0;
  let deaths = 0;
  let crushed = 0;
  for (let i = 0; i < 6 * 60 * TICK_RATE && state.phase === 'playing'; i++) {
    tick(state, director.inputs(state));
    for (const e of state.events) {
      if (e.type !== 'player-died') continue;
      deaths++;
      if (e.killerId === e.playerId) selfKills++;
      if (e.killerId === null) crushed++;
    }
  }
  return {
    winner: state.winnerId,
    seconds: state.tick / TICK_RATE,
    selfKills,
    deaths,
    crushed,
    closing: state.closesAtTick !== null && state.tick >= state.closesAtTick,
  };
}

describe('bots against bots', () => {
  const matches = (levels: BotLevel[], n: number) =>
    Array.from({ length: n }, (_, i) => playMatch(levels, 100 + i, i));

  it('always finishes a round, the clock and the walls seeing to it', () => {
    for (const result of matches(['medium', 'medium'], 4))
      expect(result.seconds).toBeLessThan(5 * 60);
  });

  it('a harder bot beats an easier one most of the time', () => {
    const results = matches(['hard', 'easy'], 12);
    const hard = results.filter((r) => r.winner?.endsWith('hard')).length;
    expect(hard).toBeGreaterThanOrEqual(9);
  });

  it('rarely blows itself up', () => {
    const rate = (results: ReturnType<typeof matches>) =>
      results.reduce((s, r) => s + r.selfKills, 0) /
      Math.max(
        1,
        results.reduce((s, r) => s + r.deaths, 0),
      );
    // One on one, every death is someone's mistake or someone's trap.
    expect(rate(matches(['hard', 'medium'], 10))).toBeLessThan(0.2);
    // Four at once, a flame belongs to whichever bomb lit it first, so a bot
    // caught in a chain someone else set off still counts as its own kill.
    expect(rate(matches(['hard', 'hard', 'medium', 'easy'], 8))).toBeLessThan(
      0.35,
    );
  });
});
