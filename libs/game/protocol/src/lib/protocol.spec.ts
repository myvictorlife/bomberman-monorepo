import { createGame, DEFAULT_CHARACTER_ID, MAX_PLAYERS } from '@libs/game-core';
import {
  botsFor,
  CHAT_MAX_LENGTH,
  countsForRanking,
  isGuestId,
  parseChatDelete,
  parseChatMute,
  parseChatText,
  parseGuest,
  parseHello,
  parseInput,
  parseJoinQueue,
  parseLeaveAfterRound,
  parsePickStage,
  parsePlayerName,
  parseProfileUpdate,
  parseReaction,
  peopleNeeded,
  parseRules,
  PLAYER_NAME_LENGTH,
  PUBLIC_ROOM_RULES,
  ROOM_BOT_LEVELS,
  REACTIONS,
  RULE_FIELDS,
  secondsLeft,
  serverOffset,
  STAGES_ROOM_RULES,
  publicState,
} from './protocol';

describe('PUBLIC_ROOM_RULES', () => {
  it('plays up to the arena’s five spawns and starts with two', () => {
    expect(PUBLIC_ROOM_RULES.maxPlayers).toBe(MAX_PLAYERS);
    expect(MAX_PLAYERS).toBe(5);
    expect(PUBLIC_ROOM_RULES.minPlayers).toBe(2);
  });
});

describe('parseHello', () => {
  it('accepts a token and trims it', () => {
    expect(parseHello({ token: ' abc ' })).toEqual({ token: 'abc' });
  });

  it.each([
    null,
    'abc',
    [],
    {},
    { token: 42 },
    { token: '   ' },
    { token: 'x'.repeat(9000) },
  ])('rejects %j', (value) => expect(parseHello(value)).toBeNull());
});

describe('parseLeaveAfterRound', () => {
  it('leaves unless told explicitly to stay', () => {
    expect(parseLeaveAfterRound({ leave: false })).toEqual({ leave: false });
    expect(parseLeaveAfterRound({ leave: true })).toEqual({ leave: true });
    expect(parseLeaveAfterRound(undefined)).toEqual({ leave: true });
  });
});

describe('parseJoinQueue', () => {
  it('keeps a known character', () => {
    expect(parseJoinQueue({ characterId: 'byte' })).toEqual({
      characterId: 'byte',
    });
  });

  it.each([undefined, {}, { characterId: 'nobody' }, 'byte'])(
    'falls back to the default for %j',
    (value) => {
      expect(parseJoinQueue(value)).toEqual({
        characterId: DEFAULT_CHARACTER_ID,
      });
    },
  );
});

describe('parseInput', () => {
  it('reads a direction and the two buttons', () => {
    expect(parseInput({ direction: 'left', bomb: true })).toEqual({
      direction: 'left',
      bomb: true,
      ability: false,
      detonate: false,
    });
  });

  it('accepts standing still', () => {
    expect(
      parseInput({ direction: null, ability: true, detonate: true }),
    ).toEqual({
      direction: null,
      bomb: false,
      ability: true,
      detonate: true,
    });
  });

  it('treats anything but `true` as not pressed', () => {
    expect(
      parseInput({ direction: 'up', bomb: 'yes', ability: 1, detonate: 'now' }),
    ).toEqual({
      direction: 'up',
      bomb: false,
      ability: false,
      detonate: false,
    });
  });

  it.each([null, [], { direction: 'north' }, { direction: 3 }, {}])(
    'rejects %j',
    (value) => {
      expect(parseInput(value)).toBeNull();
    },
  );
});

describe('countdown clock', () => {
  it('measures how far the server clock is ahead', () => {
    expect(serverOffset({ now: 10_500 }, 10_000)).toBe(500);
  });

  it('rounds the seconds left up and never goes below zero', () => {
    expect(secondsLeft(20_000, 10_000, 500)).toBe(10);
    expect(secondsLeft(20_000, 10_000, 0)).toBe(10);
    expect(secondsLeft(20_000, 10_001, 0)).toBe(10);
    expect(secondsLeft(20_000, 25_000, 0)).toBe(0);
    expect(secondsLeft(null, 10_000, 0)).toBe(0);
  });
});

describe('peopleNeeded', () => {
  it('is one when bots fill the seats, minPlayers otherwise', () => {
    expect(peopleNeeded({ ...PUBLIC_ROOM_RULES, bots: 2 })).toBe(1);
    expect(peopleNeeded({ ...PUBLIC_ROOM_RULES, bots: 0, minPlayers: 3 })).toBe(
      3,
    );
  });
});

describe('parseRules', () => {
  it('applies a change of offered values on top of the current rules', () => {
    expect(
      parseRules(
        { outsiders: 0, roundTimerMs: 0, closingWalls: false },
        PUBLIC_ROOM_RULES,
      ),
    ).toEqual({
      ...PUBLIC_ROOM_RULES,
      outsiders: 0,
      roundTimerMs: 0,
      closingWalls: false,
    });
    expect(parseRules({}, PUBLIC_ROOM_RULES)).toEqual(PUBLIC_ROOM_RULES);
  });

  it('refuses unknown keys, wrong types and values that are not offered', () => {
    expect(parseRules({ robots: 3 }, PUBLIC_ROOM_RULES)).toBeNull();
    expect(parseRules({ outsiders: '2' }, PUBLIC_ROOM_RULES)).toBeNull();
    expect(parseRules({ outsiders: 99 }, PUBLIC_ROOM_RULES)).toBeNull();
    expect(parseRules({ closingWalls: 'no' }, PUBLIC_ROOM_RULES)).toBeNull();
    expect(parseRules('outsiders=0', PUBLIC_ROOM_RULES)).toBeNull();
    expect(parseRules(null, PUBLIC_ROOM_RULES)).toBeNull();
  });

  it('never lets the minimum exceed the maximum', () => {
    expect(
      parseRules({ maxPlayers: 2, minPlayers: 3 }, PUBLIC_ROOM_RULES),
    ).toBeNull();
    expect(
      parseRules({ maxPlayers: 3, minPlayers: 3 }, PUBLIC_ROOM_RULES)
        ?.maxPlayers,
    ).toBe(3);
  });

  it('offers every rule the public room has, with its default among the choices', () => {
    for (const field of RULE_FIELDS) {
      const value = PUBLIC_ROOM_RULES[field.key];
      if (field.kind === 'boolean') expect(typeof value).toBe('boolean');
      else expect(field.options).toContain(value);
    }
    // Every rule but the mode, which is what the room is, not a setting.
    expect(RULE_FIELDS.map((f) => f.key).sort()).toEqual(
      Object.keys(PUBLIC_ROOM_RULES)
        .filter((k) => k !== 'mode')
        .sort(),
    );
  });
});

describe('parseChatText', () => {
  it('keeps a line, flattening breaks, control and invisible characters', () => {
    expect(parseChatText({ text: '  boa\n\tjogada\u200b  ' })).toBe(
      'boa jogada',
    );
    expect(parseChatText({ text: 'a\u0007b\u202ec' })).toBe('a b c');
  });

  it('counts an emoji as one character and refuses what is too long or empty', () => {
    expect(parseChatText({ text: '🔥'.repeat(CHAT_MAX_LENGTH) })).toHaveLength(
      CHAT_MAX_LENGTH * 2,
    );
    expect(parseChatText({ text: 'x'.repeat(CHAT_MAX_LENGTH + 1) })).toBeNull();
    expect(parseChatText({ text: ' \n ' })).toBeNull();
    expect(parseChatText({ text: 3 })).toBeNull();
    expect(parseChatText('oi')).toBeNull();
  });
});

describe('parseReaction', () => {
  it('accepts only the offered reactions', () => {
    expect(parseReaction({ emoji: REACTIONS[0] })).toBe(REACTIONS[0]);
    expect(parseReaction({ emoji: '🍕' })).toBeNull();
    expect(parseReaction(null)).toBeNull();
  });
});

describe('parseChatDelete and parseChatMute', () => {
  it('accept a positive id and a sensible account id', () => {
    expect(parseChatDelete({ id: 3 })).toEqual({ id: 3 });
    expect(parseChatDelete({ id: 0 })).toBeNull();
    expect(parseChatDelete({ id: 1.5 })).toBeNull();
    expect(parseChatMute({ accountId: 'u1' })).toEqual({ accountId: 'u1' });
    expect(parseChatMute({ accountId: '' })).toBeNull();
    expect(parseChatMute({ accountId: 'x'.repeat(129) })).toBeNull();
    expect(parseChatMute(undefined)).toBeNull();
  });
});

describe('parsePlayerName', () => {
  it('cleans a name like a chat line', () => {
    expect(parsePlayerName('  Dev\n Cansado\u200b ')).toBe('Dev Cansado');
  });

  it('counts characters, so an emoji is one', () => {
    expect(parsePlayerName('💣'.repeat(PLAYER_NAME_LENGTH.max))).not.toBeNull();
    expect(parsePlayerName('a'.repeat(PLAYER_NAME_LENGTH.max + 1))).toBeNull();
  });

  it('refuses a name too short once cleaned, or not a string', () => {
    expect(parsePlayerName(' a \u0007 ')).toBeNull();
    expect(parsePlayerName(42)).toBeNull();
  });
});

describe('parseProfileUpdate', () => {
  it('keeps every valid field', () => {
    expect(
      parseProfileUpdate({
        name: ' Ana ',
        favoriteCharacterId: 'lia',
        color: 'purple',
      }),
    ).toEqual({ name: 'Ana', favoriteCharacterId: 'lia', color: 'purple' });
  });

  it('takes a null colour as "clear it"', () => {
    expect(parseProfileUpdate({ color: null })).toEqual({ color: null });
  });

  it('refuses the whole update when one field is wrong', () => {
    expect(parseProfileUpdate({ name: 'Ana', color: 'teal' })).toBeNull();
    expect(parseProfileUpdate({ favoriteCharacterId: 'mario' })).toBeNull();
    expect(parseProfileUpdate({ name: 'x' })).toBeNull();
  });

  it('refuses an empty update or something that is not an object', () => {
    expect(parseProfileUpdate({})).toBeNull();
    expect(parseProfileUpdate({ email: 'a@b.c' })).toBeNull();
    expect(parseProfileUpdate('Ana')).toBeNull();
  });
});

describe('botsFor', () => {
  const rules = { ...PUBLIC_ROOM_RULES, bots: 5, botsFillTo: 3 };

  it('plays five in an empty room, then fills the round up to three', () => {
    expect([0, 1, 2, 3, 4].map((n) => botsFor(rules, n))).toEqual([
      5, 2, 1, 0, 0,
    ]);
  });

  it('never plays more than `bots`, nor more than the seats left', () => {
    expect(botsFor({ ...rules, bots: 1 }, 1)).toBe(1);
    expect(botsFor({ ...rules, bots: 0 }, 0)).toBe(0);
    expect(botsFor({ ...rules, botsFillTo: 5, maxPlayers: 3 }, 1)).toBe(2);
    expect(botsFor({ ...rules, botsFillTo: 0 }, 1)).toBe(0);
  });

  it('needs one person to start when bots join people, else `minPlayers`', () => {
    expect(peopleNeeded(rules)).toBe(1);
    expect(peopleNeeded({ ...rules, botsFillTo: 0 })).toBe(rules.minPlayers);
  });
});

describe('guests', () => {
  it('takes a cleaned name and, optionally, a well-formed token', () => {
    expect(parseGuest({ name: '  Visita ' })).toEqual({ name: 'Visita' });
    const token = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    expect(parseGuest({ name: 'Visita', token })).toEqual({
      name: 'Visita',
      token,
    });
    expect(parseGuest({ name: 'Visita', token: null })).toEqual({
      name: 'Visita',
    });
  });

  it('refuses a bad name or a token that is not one', () => {
    expect(parseGuest({ name: 'x' })).toBeNull();
    expect(parseGuest({})).toBeNull();
    expect(parseGuest('Visita')).toBeNull();
    expect(parseGuest({ name: 'Visita', token: 'short' })).toBeNull();
    expect(parseGuest({ name: 'Visita', token: 'a'.repeat(65) })).toBeNull();
    expect(
      parseGuest({ name: 'Visita', token: 'not a token!!!!!!' }),
    ).toBeNull();
  });

  it('tells guest ids from account ids', () => {
    expect(isGuestId('guest:abc')).toBe(true);
    expect(isGuestId('Xy12FirebaseUid')).toBe(false);
  });

  it('counts a round for the ranking only with two accounts in it', () => {
    const account = (id: string) => ({ id });
    const guest = (n: number) => ({ id: `guest:${n}` });
    const bot = (n: number) => ({ id: `cpu${n}`, bot: true });
    expect(countsForRanking([account('a'), account('b')])).toBe(true);
    expect(
      countsForRanking([account('a'), account('b'), guest(1), bot(1)]),
    ).toBe(true);
    expect(countsForRanking([account('a'), guest(1), guest(2)])).toBe(false);
    expect(countsForRanking([account('a'), bot(1), bot(2)])).toBe(false);
    expect(countsForRanking([guest(1), guest(2)])).toBe(false);
  });
});

describe('STAGES_ROOM_RULES', () => {
  it('plays the campaign as a team of four, starting with one person and no bots', () => {
    expect(STAGES_ROOM_RULES.mode).toBe('stages');
    expect(STAGES_ROOM_RULES.maxPlayers).toBe(4);
    expect(STAGES_ROOM_RULES.minPlayers).toBe(1);
    expect(STAGES_ROOM_RULES.bots).toBe(0);
    expect(STAGES_ROOM_RULES.outsiders).toBe(0);
    expect(STAGES_ROOM_RULES.winnerStays).toBe(0);
    expect(peopleNeeded(STAGES_ROOM_RULES)).toBe(1);
  });

  it('keeps the mode through a change of rules: it is not one an admin sets', () => {
    expect(parseRules({ outsiders: 1 }, STAGES_ROOM_RULES)?.mode).toBe(
      'stages',
    );
    expect(parseRules({ mode: 'versus' }, STAGES_ROOM_RULES)).toBeNull();
    expect(PUBLIC_ROOM_RULES.mode).toBe('versus');
  });
});

describe('parsePickStage', () => {
  it('accepts a known stage and nothing else', () => {
    expect(parsePickStage({ stageId: 'gramado-2' })).toEqual({
      stageId: 'gramado-2',
    });
    expect(parsePickStage({ stageId: 'nowhere-9' })).toBeNull();
    expect(parsePickStage({ stageId: 3 })).toBeNull();
    expect(parsePickStage(null)).toBeNull();
  });
});

describe('bot level', () => {
  it('is medium by default, the online casual, and takes only 1 to 3', () => {
    expect(PUBLIC_ROOM_RULES.botLevel).toBe(2);
    expect(ROOM_BOT_LEVELS[PUBLIC_ROOM_RULES.botLevel]).toBe('casual');
    expect(ROOM_BOT_LEVELS[1]).toBe('easy');
    expect(ROOM_BOT_LEVELS[3]).toBe('hard');
    expect(parseRules({ botLevel: 3 }, PUBLIC_ROOM_RULES)?.botLevel).toBe(3);
    expect(parseRules({ botLevel: 4 }, PUBLIC_ROOM_RULES)).toBeNull();
    expect(parseRules({ botLevel: 'hard' }, PUBLIC_ROOM_RULES)).toBeNull();
  });
});

describe('publicState', () => {
  it('keeps what every block hides on the server, and the rest as it is', () => {
    const state = createGame({ seed: 3, players: [{ id: 'a', name: 'A' }] });
    const hidden = [...state.hiddenPowerUps];
    const sent = publicState(state);

    expect(hidden.some((p) => p !== null)).toBe(true);
    expect(sent.hiddenPowerUps).toEqual([]);
    expect({ ...sent, hiddenPowerUps: hidden }).toEqual(state);
    expect(state.hiddenPowerUps).toEqual(hidden);
  });
});
