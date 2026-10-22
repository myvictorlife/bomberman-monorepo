import {
  cleanRecord,
  nameKey,
  PlayerRecord,
  ranking,
  recordRound,
  recordStage,
  recordVisit,
  toProfile,
  updateProfile,
  VISIT_GAP_MS,
} from './records';

const record = (
  id: string,
  wins: number,
  matches: number,
  name = id,
): PlayerRecord => ({
  id,
  name,
  wins,
  matches,
  visits: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
});

describe('recordVisit', () => {
  it('creates the record on the first visit', () => {
    expect(recordVisit(undefined, { id: 'u1', name: 'Ana' }, 1_000)).toEqual({
      id: 'u1',
      name: 'Ana',
      wins: 0,
      matches: 0,
      visits: 1,
      firstSeenAt: 1_000,
      lastSeenAt: 1_000,
    });
  });

  it('counts a new visit only after a while away', () => {
    const first = recordVisit(undefined, { id: 'u1', name: 'Ana' }, 0);
    const soon = recordVisit(
      first,
      { id: 'u1', name: 'Ana' },
      VISIT_GAP_MS - 1,
    );
    const later = recordVisit(
      soon,
      { id: 'u1', name: 'Ana' },
      soon.lastSeenAt + VISIT_GAP_MS,
    );

    expect(soon.visits).toBe(1);
    expect(later.visits).toBe(2);
    expect(later.firstSeenAt).toBe(0);
  });

  it('keeps the old name when the new one is empty', () => {
    const first = recordVisit(undefined, { id: 'u1', name: 'Ana' }, 0);

    expect(recordVisit(first, { id: 'u1', name: '' }, 1).name).toBe('Ana');
    expect(recordVisit(first, { id: 'u1', name: 'Bia' }, 1).name).toBe('Bia');
  });

  it('keeps a name the player chose over the account name', () => {
    const chosen = { ...record('u1', 0, 0, 'Dev Cansado'), nameChosen: true };

    expect(
      recordVisit(chosen, { id: 'u1', name: 'Victor César (myvict' }, 1).name,
    ).toBe('Dev Cansado');
  });

  it('keeps only record fields, never the e-mail of a verified account', () => {
    const account = { id: 'u1', name: 'Ana', email: 'ana@example.com' };
    const first = recordVisit(undefined, account, 0);
    // A record saved before this was fixed still carries it.
    const old = { ...first, email: 'ana@example.com' } as PlayerRecord;

    expect(first).not.toHaveProperty('email');
    expect(recordVisit(old, account, 1)).not.toHaveProperty('email');
  });
});

describe('cleanRecord', () => {
  it('drops empty optional fields', () => {
    const r = { ...record('a', 0, 0), nameChosen: false };

    expect(cleanRecord(r)).toEqual(record('a', 0, 0));
  });
});

describe('updateProfile', () => {
  const ana = record('a', 1, 1, 'Ana');
  const bia = record('b', 1, 1, 'Bia');

  it('sets a chosen name, favourite character and colour', () => {
    expect(
      updateProfile(
        ana,
        { name: 'Ana Maria', favoriteCharacterId: 'lia', color: 'pink' },
        [ana, bia],
      ),
    ).toEqual({
      ...ana,
      name: 'Ana Maria',
      nameChosen: true,
      favoriteCharacterId: 'lia',
      color: 'pink',
    });
  });

  it('refuses a name someone else has, ignoring case, accents and spaces', () => {
    expect(updateProfile(ana, { name: 'bía' }, [ana, bia])).toBe('name-taken');
    expect(updateProfile(ana, { name: 'B ia' }, [ana, bia])).toBe('name-taken');
  });

  it('lets a player keep or re-case their own name', () => {
    expect(updateProfile(ana, { name: 'ANA' }, [ana, bia])).toMatchObject({
      name: 'ANA',
      nameChosen: true,
    });
  });

  it('clears the colour with null and leaves untouched fields alone', () => {
    const pink = {
      ...ana,
      color: 'pink' as const,
      favoriteCharacterId: 'lia' as const,
    };

    expect(updateProfile(pink, { color: null }, [pink])).toEqual({
      ...ana,
      favoriteCharacterId: 'lia',
    });
  });

  it('compares names by key', () => {
    expect(nameKey(' Jo  ão ')).toBe(nameKey('joao'));
  });
});

describe('recordRound', () => {
  it('counts a match for everyone and a win for the winner, skipping unknown ids', () => {
    const records = new Map([
      ['a', record('a', 0, 0)],
      ['b', record('b', 2, 3)],
    ]);

    const updated = recordRound(records, ['a', 'b', 'ghost'], 'b', 50);

    expect(updated).toEqual([
      { ...record('a', 0, 1), lastSeenAt: 50 },
      { ...record('b', 3, 4), lastSeenAt: 50 },
    ]);
  });

  it('remembers who each player was, for the podium', () => {
    const records = new Map([
      ['a', record('a', 1, 1)],
      ['b', { ...record('b', 0, 0), characterId: 'lia' as const }],
    ]);

    const updated = recordRound(
      records,
      ['a', 'b'],
      'a',
      9,
      new Map([['a', 'faisca' as const]]),
    );

    expect(updated[0]?.characterId).toBe('faisca');
    expect(updated[1]?.characterId).toBe('lia');
    expect(ranking(updated)[0]).toEqual({
      id: 'a',
      name: 'a',
      wins: 2,
      matches: 2,
      characterId: 'faisca',
    });
  });

  it('counts no win on a draw', () => {
    const updated = recordRound(
      new Map([['a', record('a', 0, 0)]]),
      ['a'],
      null,
      0,
    );

    expect(updated[0]?.wins).toBe(0);
  });
});

describe('ranking', () => {
  it('orders by wins, then fewer matches, then name, and leaves out players with no win', () => {
    const list = ranking([
      record('a', 3, 10),
      record('b', 5, 9),
      record('c', 3, 4),
      record('d', 0, 7),
      record('e', 3, 4, 'Ana'),
    ]);

    expect(list.map((r) => r.id)).toEqual(['b', 'e', 'c', 'a']);
  });

  it('shows the favourite character over the last one played, and the colour', () => {
    const [entry] = ranking([
      {
        ...record('a', 1, 1),
        characterId: 'faisca',
        favoriteCharacterId: 'lia',
        color: 'purple',
      },
    ]);

    expect(entry).toEqual({
      id: 'a',
      name: 'a',
      wins: 1,
      matches: 1,
      characterId: 'lia',
      color: 'purple',
    });
  });

  it('respects the limit', () => {
    expect(ranking([record('a', 1, 1), record('b', 2, 2)], 1)).toHaveLength(1);
  });
});

describe('toProfile', () => {
  it('tells a returning player and their place', () => {
    const all = [record('a', 5, 5), { ...record('b', 2, 3), visits: 4 }];

    expect(toProfile(all[1] as PlayerRecord, all)).toMatchObject({
      id: 'b',
      returning: true,
      rank: 2,
    });
    expect(toProfile(record('z', 0, 0), all)).toMatchObject({
      returning: false,
      rank: null,
    });
  });

  it('tells whether the name was chosen, and carries the favourite and colour', () => {
    const r = {
      ...record('a', 0, 0),
      nameChosen: true,
      favoriteCharacterId: 'tiao' as const,
      color: 'orange' as const,
    };

    expect(toProfile(r, [r])).toMatchObject({
      nameChosen: true,
      characterId: 'tiao',
      favoriteCharacterId: 'tiao',
      color: 'orange',
    });
    expect(toProfile(record('b', 0, 0), [])).toMatchObject({
      nameChosen: false,
    });
  });
});

describe('the campaign on the record', () => {
  const base = {
    id: 'a',
    name: 'Ana',
    wins: 0,
    matches: 0,
    visits: 1,
    firstSeenAt: 0,
    lastSeenAt: 0,
  };

  it('keeps the campaign a stage left, cleaned, and shows it on the profile', () => {
    const record = recordStage(
      base,
      { cleared: ['gramado-1', 'nowhere'], lives: 2 },
      50,
    );

    expect(record.campaign).toEqual({ cleared: ['gramado-1'], lives: 2 });
    expect(record.lastSeenAt).toBe(50);
    expect(toProfile(record, [record]).campaign?.cleared).toEqual([
      'gramado-1',
    ]);
    expect(toProfile(base, [base]).campaign).toBeUndefined();
  });
});
