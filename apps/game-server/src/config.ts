import {
  DEFAULT_GAME_SERVER_PORT,
  PUBLIC_ROOM_RULES,
} from '@libs/game-protocol';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeOrigin } from './origin';

export interface ServerConfig {
  port: number;
  /**
   * The interface to listen on; `null` for all of them. Behind a tunnel on the
   * same machine, `127.0.0.1` keeps the server reachable through the tunnel only.
   */
  host: string | null;
  /** `null` when unknown: then nobody can sign in, and the room is watch-only. */
  firebaseProjectId: string | null;
  dataDir: string;
  /** How many of the queue stand outside the arena during a round; `0` turns it off. */
  outsiders: number;
  /** E-mails (lower case) of the accounts that may change the room's rules from the page. */
  admins: string[];
  /**
   * Most simultaneous connections one address may hold; `0` turns the limit
   * off. A soft guard against one script opening sockets until the room fills.
   */
  maxConnectionsPerIp: number;
  /**
   * The pages allowed to use the server (`https://example.com`); empty lets
   * every origin in. See `originAllowed` in `origin.ts`.
   */
  allowedOrigins: string[];
}

/** The default for {@link ServerConfig.maxConnectionsPerIp}: enough for a shared home or office, far below a flood. */
const DEFAULT_MAX_CONNECTIONS_PER_IP = 20;

/**
 * Environment first (`PORT`, `HOST`, `FIREBASE_PROJECT_ID`, `DATA_DIR`,
 * `OUTSIDERS`, `ADMINS`, `MAX_CONNECTIONS_PER_IP`, `ALLOWED_ORIGINS`), then the same `config/firebase.json` and `config/game-server.json`
 * the web app is generated from, so a local setup has one place to fill in.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): ServerConfig {
  const port = Number(env['PORT']);
  const outsiders = Number(env['OUTSIDERS']);
  const maxConnectionsPerIp = Number(env['MAX_CONNECTIONS_PER_IP']);
  const gameServer = readJson(join(cwd, 'config/game-server.json'));
  const host = env['HOST'] ?? gameServer?.['host'];
  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_GAME_SERVER_PORT,
    host: typeof host === 'string' && host.trim() ? host.trim() : null,
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
        (Array.isArray(gameServer?.['admins']) ? gameServer['admins'] : []),
    ),
    maxConnectionsPerIp:
      Number.isInteger(maxConnectionsPerIp) && maxConnectionsPerIp >= 0
        ? maxConnectionsPerIp
        : DEFAULT_MAX_CONNECTIONS_PER_IP,
    allowedOrigins: origins(
      env['ALLOWED_ORIGINS']?.split(',') ??
        (Array.isArray(gameServer?.['allowedOrigins'])
          ? gameServer['allowedOrigins']
          : []),
    ),
  };
}

const emails = (values: unknown[]): string[] =>
  values
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.includes('@'));

const origins = (values: unknown[]): string[] => [
  ...new Set(
    values
      .filter((v): v is string => typeof v === 'string')
      .map(normalizeOrigin)
      .filter((v): v is string => v !== null),
  ),
];

/** The file's top-level object, or `null` when it is missing, unreadable or not an object. */
function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
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
