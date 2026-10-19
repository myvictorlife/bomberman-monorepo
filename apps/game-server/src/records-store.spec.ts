import { PlayerRecord } from '@libs/game-lobby';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordsStore } from './records-store';

const record = (id: string, wins = 0): PlayerRecord => ({
  id,
  name: id,
  wins,
  matches: wins,
  visits: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
});

describe('RecordsStore', () => {
  const file = () =>
    join(mkdtempSync(join(tmpdir(), 'records-')), 'nested', 'players.json');

  it('starts empty when there is no file yet', () => {
    const store = new RecordsStore(file());
    store.load();

    expect(store.all().size).toBe(0);
  });

  it('writes on flush and reads it back', () => {
    const path = file();
    const store = new RecordsStore(path);
    store.put(record('a', 2), record('b'));
    store.flush();

    const again = new RecordsStore(path);
    again.load();
    expect(again.get('a')).toEqual(record('a', 2));
    expect(again.all().size).toBe(2);
  });

  it('batches writes until the delay passes', async () => {
    vi.useFakeTimers();
    const path = file();
    const store = new RecordsStore(path, 1_000);
    store.put(record('a'));
    store.put(record('b'));

    expect(() => readFileSync(path)).toThrow();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveLength(2);
    vi.useRealTimers();
  });

  it('ignores a file that is not a list, and entries without an id', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'records-')), 'players.json');
    writeFileSync(path, '{"a":1}');
    const store = new RecordsStore(path);
    store.load();
    expect(store.all().size).toBe(0);

    writeFileSync(path, JSON.stringify([record('a'), null, { name: 'no id' }]));
    store.load();
    expect([...store.all().keys()]).toEqual(['a']);
  });

  it('drops fields a record should not have when it loads', () => {
    const path = file();
    const store = new RecordsStore(path);
    store.put({ ...record('a'), email: 'a@example.com' } as PlayerRecord);
    store.flush();

    const again = new RecordsStore(path);
    again.load();
    expect(again.get('a')).toEqual(record('a'));
  });

  it('tells watchers about a profile change until they stop watching', () => {
    const store = new RecordsStore(file());
    const seen: string[] = [];
    const stop = store.watchProfiles((r) => seen.push(r.name));

    store.putProfile({ ...record('a'), name: 'Ana' });
    stop();
    store.putProfile({ ...record('a'), name: 'Bia' });

    expect(seen).toEqual(['Ana']);
    expect(store.get('a')?.name).toBe('Bia');
  });
});
