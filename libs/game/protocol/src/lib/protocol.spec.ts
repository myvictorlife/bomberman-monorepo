import { DEFAULT_CHARACTER_ID, MAX_PLAYERS } from '@libs/game-core';
import {
  CHAT_MAX_LENGTH,
  parseChatDelete,
  parseChatMute,
  parseChatText,
  parseHello,
  parseInput,
  parseJoinQueue,
  parseLeaveAfterRound,
  parsePlayerName,
  parseProfileUpdate,
  parseReaction,
  peopleNeeded,
  parseRules,
  PLAYER_NAME_LENGTH,
  PUBLIC_ROOM_RULES,
  REACTIONS,
  RULE_FIELDS,
  secondsLeft,
  serverOffset,
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
    expect(RULE_FIELDS.map((f) => f.key).sort()).toEqual(
      Object.keys(PUBLIC_ROOM_RULES).sort(),
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
