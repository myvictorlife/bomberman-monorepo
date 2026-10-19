import { PUBLIC_ROOM_RULES } from '@libs/game-protocol';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RulesStore } from './rules-store';

describe('RulesStore', () => {
  const file = () =>
    join(mkdtempSync(join(tmpdir(), 'rules-')), 'deep/rules.json');

  it('has nothing until something was saved', () => {
    expect(new RulesStore(file()).load()).toBeNull();
  });

  it('saves and loads the rules, creating the folder', () => {
    const store = new RulesStore(file());
    const rules = { ...PUBLIC_ROOM_RULES, outsiders: 0, closingWalls: false };
    store.save(rules);
    expect(store.load()).toEqual(rules);
    expect(new RulesStore(file()).load()).toBeNull();
  });

  it('ignores a file that is not valid rules any more', () => {
    const path = file();
    const store = new RulesStore(path);
    store.save(PUBLIC_ROOM_RULES);
    writeFileSync(path, '{"outsiders": 42}');
    expect(store.load()).toBeNull();
    writeFileSync(path, 'nope');
    expect(store.load()).toBeNull();
  });
});
