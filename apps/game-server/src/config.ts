import {
  DEFAULT_GAME_SERVER_PORT,
  PUBLIC_ROOM_RULES,
} from '@libs/game-protocol';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ServerConfig {
  port: number;
  /** `null` when unknown: then nobody can sign in, and the room is watch-only. */
  firebaseProjectId: string | null;
  dataDir: string;
  /** How many of the queue stand outside the arena during a round; `0` turns it off. */
  outsiders: number;
  /** E-mails (lower case) of the accounts that may change the room's rules from the page. */
  admins: string[];
}

/**
 * Environment first (`PORT`, `FIREBASE_PROJECT_ID`, `DATA_DIR`, `OUTSIDERS`,
 * `ADMINS`), then the same `config/firebase.json` and `config/game-server.json`
 * the web app is generated from, so a local setup has one place to fill in.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): ServerConfig {
  const port = Number(env['PORT']);
  const outsiders = Number(env['OUTSIDERS']);
  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_GAME_SERVER_PORT,
    firebaseProjectId:
      env['FIREBASE_PROJECT_ID'] ||
      projectIdFromFile(join(cwd, 'config/firebase.json')),
    dataDir: env['DATA_DIR'] || join(cwd, '.data/game-server'),
    outsiders:
      Number.isInteger(outsiders) && outsiders >= 0
        ? outsiders
        : PUBLIC_ROOM_RULES.outsiders,
    admins: emails(
      env['ADMINS']?.split(',') ??
        adminsFromFile(join(cwd, 'config/game-server.json')),
    ),
  };
}

const emails = (values: unknown[]): string[] =>
  values
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.includes('@'));

function adminsFromFile(path: string): unknown[] {
  if (!existsSync(path)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const admins = (parsed as { admins?: unknown } | null)?.admins;
    return Array.isArray(admins) ? admins : [];
  } catch {
    return [];
  }
}

function projectIdFromFile(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const id = (parsed as { projectId?: unknown } | null)?.projectId;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}
