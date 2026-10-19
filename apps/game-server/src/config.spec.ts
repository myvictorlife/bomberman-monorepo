import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config';

describe('loadConfig', () => {
  const workspace = (firebase?: string, gameServer?: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
    mkdirSync(join(dir, 'config'));
    if (firebase !== undefined)
      writeFileSync(join(dir, 'config/firebase.json'), firebase);
    if (gameServer !== undefined)
      writeFileSync(join(dir, 'config/game-server.json'), gameServer);
    return dir;
  };

  it('defaults to port 8086, no project and a data folder in the workspace', () => {
    const dir = workspace();

    expect(loadConfig({}, dir)).toEqual({
      port: 8086,
      host: null,
      firebaseProjectId: null,
      dataDir: join(dir, '.data/game-server'),
      outsiders: 5,
      admins: [],
    });
  });

  it('reads how many stand outside from OUTSIDERS, and keeps the default on a bad value', () => {
    expect(loadConfig({ OUTSIDERS: '0' }, workspace()).outsiders).toBe(0);
    expect(loadConfig({ OUTSIDERS: '3' }, workspace()).outsiders).toBe(3);
    expect(loadConfig({ OUTSIDERS: '-1' }, workspace()).outsiders).toBe(5);
    expect(loadConfig({ OUTSIDERS: 'many' }, workspace()).outsiders).toBe(5);
  });

  it('reads the project id from config/firebase.json', () => {
    expect(
      loadConfig({}, workspace('{"projectId":"my-proj"}')).firebaseProjectId,
    ).toBe('my-proj');
  });

  it('ignores an unreadable or incomplete config file', () => {
    expect(loadConfig({}, workspace('not json')).firebaseProjectId).toBeNull();
    expect(
      loadConfig({}, workspace('{"projectId":""}')).firebaseProjectId,
    ).toBeNull();
  });

  it('lets the environment win', () => {
    const config = loadConfig(
      {
        PORT: '9000',
        HOST: '127.0.0.1',
        FIREBASE_PROJECT_ID: 'from-env',
        DATA_DIR: '/srv/data',
        OUTSIDERS: '2',
      },
      workspace('{"projectId":"my-proj"}'),
    );

    expect(config).toEqual({
      port: 9000,
      host: '127.0.0.1',
      firebaseProjectId: 'from-env',
      dataDir: '/srv/data',
      outsiders: 2,
      admins: [],
    });
  });

  it('falls back to the default port on a bad value', () => {
    expect(loadConfig({ PORT: 'abc' }, workspace()).port).toBe(8086);
  });

  it('reads the admins from config/game-server.json, lower-cased, e-mails only', () => {
    const dir = workspace(
      undefined,
      '{"url":"https://g.example","admins":[" Lead@Example.com ", "nope", 3]}',
    );
    expect(loadConfig({}, dir).admins).toEqual(['lead@example.com']);
    expect(loadConfig({}, workspace(undefined, 'not json')).admins).toEqual([]);
    expect(
      loadConfig({}, workspace(undefined, '{"admins":"a@b.c"}')).admins,
    ).toEqual([]);
  });

  it('reads the interface to listen on from config/game-server.json, HOST winning', () => {
    const dir = workspace(undefined, '{"host":" 127.0.0.1 "}');
    expect(loadConfig({}, dir).host).toBe('127.0.0.1');
    expect(loadConfig({ HOST: '::1' }, dir).host).toBe('::1');
    expect(loadConfig({}, workspace(undefined, '{"host":""}')).host).toBeNull();
    expect(loadConfig({}, workspace(undefined, '{"host":3}')).host).toBeNull();
  });

  it('lets ADMINS in the environment replace the file', () => {
    const dir = workspace(undefined, '{"admins":["file@example.com"]}');
    expect(
      loadConfig({ ADMINS: 'One@Example.com, two@example.com' }, dir).admins,
    ).toEqual(['one@example.com', 'two@example.com']);
  });
});
