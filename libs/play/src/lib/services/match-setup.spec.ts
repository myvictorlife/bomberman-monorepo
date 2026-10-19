import { convertToParamMap } from '@angular/router';
import {
  botNumber,
  DEFAULT_SETUP,
  isBotId,
  matchPlayers,
  maxBots,
  setupFromQuery,
  setupToQuery,
} from './match-setup';

describe('match setup', () => {
  const q = (params: Record<string, string>) => convertToParamMap(params);

  it('defaults to one medium bot', () => {
    expect(setupFromQuery(q({}))).toEqual(DEFAULT_SETUP);
  });

  it('reads the bots, their level and a second player from the URL', () => {
    expect(setupFromQuery(q({ bots: '3', level: 'hard', p2: '1' }))).toEqual({
      bots: 3,
      level: 'hard',
      secondHuman: true,
    });
  });

  it('keeps the count within the spawn points and ignores what it does not know', () => {
    expect(setupFromQuery(q({ bots: '9' })).bots).toBe(4);
    expect(setupFromQuery(q({ bots: '9', p2: '1' })).bots).toBe(3);
    expect(setupFromQuery(q({ bots: '-2' })).bots).toBe(0);
    expect(setupFromQuery(q({ bots: 'many', level: 'godlike' }))).toEqual(
      DEFAULT_SETUP,
    );
    expect(maxBots({ secondHuman: false })).toBe(4);
  });

  it('writes the setup back as a short query', () => {
    expect(
      setupToQuery({ bots: 2, level: 'easy', secondHuman: false }),
    ).toEqual({ bots: '2', level: 'easy', p2: null });
    expect(setupToQuery({ bots: 0, level: 'hard', secondHuman: true })).toEqual(
      { bots: '0', level: 'hard', p2: '1' },
    );
  });

  it('seats the people first, then the bots, each with a different look', () => {
    const { players, bots } = matchPlayers('tiao', {
      bots: 3,
      level: 'hard',
      secondHuman: true,
    });
    expect(players.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'cpu1',
      'cpu2',
      'cpu3',
    ]);
    expect(new Set(players.map((p) => p.characterId)).size).toBe(5);
    expect(players[0]?.characterId).toBe('tiao');
    expect(bots).toEqual([
      { id: 'cpu1', level: 'hard' },
      { id: 'cpu2', level: 'hard' },
      { id: 'cpu3', level: 'hard' },
    ]);
  });

  it('tells a bot seat from a person', () => {
    expect(isBotId('cpu2')).toBe(true);
    expect(isBotId('p2')).toBe(false);
    expect(botNumber('cpu3')).toBe(3);
  });
});
