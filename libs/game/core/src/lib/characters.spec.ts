import {
  CHARACTER_GROUPS,
  CHARACTERS,
  charactersByGroup,
  DEFAULT_CHARACTER_ID,
  findCharacter,
  hatchMount,
  isCharacterId,
  MOUNTS,
} from './characters';

describe('characters', () => {
  it('has the default character first in the roster', () => {
    expect(CHARACTERS[0]?.id).toBe(DEFAULT_CHARACTER_ID);
  });

  it('has unique character, group and mount ids, and every character in a known group', () => {
    for (const list of [CHARACTERS, CHARACTER_GROUPS, MOUNTS]) {
      const ids = list.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    for (const c of CHARACTERS)
      expect(CHARACTER_GROUPS.map((g) => g.id)).toContain(c.group);
  });

  it('groups the roster by profession, in group order, skipping empty groups', () => {
    const groups = charactersByGroup();
    expect(groups.map((g) => g.id)).toEqual([
      'starter',
      'demolition',
      'tech',
      'health',
      'delivery',
      'works',
    ]);
    expect(groups.flatMap((g) => g.characters.map((c) => c.id))).toEqual([
      'novato',
      'faisca',
      'byte',
      'gestora',
      'lia',
      'motoca',
      'tiao',
    ]);
    for (const g of groups) expect(g.characters.length).toBeGreaterThan(0);
  });

  it('recognises an id from the roster and nothing else', () => {
    expect(isCharacterId('motoca')).toBe(true);
    expect(isCharacterId('bomberman')).toBe(false);
  });

  it('finds a character by id and falls back to the first for an unknown one', () => {
    expect(findCharacter('lia').group).toBe('health');
    expect(findCharacter('nobody' as never).id).toBe('novato');
  });

  it('hatches every mount, deterministically, whatever the seed', () => {
    const hatched = new Set(
      Array.from({ length: 16 }, (_, i) => hatchMount(i)),
    );
    expect(hatched.size).toBe(MOUNTS.length);
    expect(hatchMount(7)).toBe(hatchMount(7));
    expect(hatchMount(-1)).toBe(MOUNTS[MOUNTS.length - 1]?.id);
  });
});
