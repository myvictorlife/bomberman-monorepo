import {
  PlayerRecord,
  recordVisit,
  toProfile,
  updateProfile,
} from '@libs/game-lobby';
import { parseProfileUpdate, ProfileUpdateError } from '@libs/game-protocol';
import { IncomingMessage, ServerResponse } from 'node:http';
import { TokenVerifier, VerifiedAccount } from './auth';
import { corsOrigin } from './origin';

/** A profile update is a few short fields; anything bigger is not one. */
const MAX_BODY_BYTES = 4 * 1024;

export interface MeDeps {
  /** `null` without a Firebase project: nobody can sign in, so `/me` is unavailable. */
  verify: TokenVerifier | null;
  records: {
    get(id: string): PlayerRecord | undefined;
    all(): ReadonlyMap<string, PlayerRecord>;
    put(record: PlayerRecord): void;
    putProfile(record: PlayerRecord): void;
  };
  now?: () => number;
  /** The pages allowed to call `/me`; empty or absent lets every origin in. */
  allowedOrigins?: readonly string[];
}

/**
 * `GET /me` and `PUT /me`: the signed-in player's own profile, for the profile
 * page, which has no socket to the room. The caller proves who they are with
 * `Authorization: Bearer <Firebase ID token>`, checked like `hello`'s.
 *
 * - `GET` answers the {@link PlayerProfile}, creating the record on a first visit.
 * - `PUT` takes a {@link ProfileUpdate}: 400 `bad-request`, 409 `name-taken`,
 *   403 `email-not-verified` (a name on the public ranking takes a confirmed
 *   account), or 200 with the new profile. The room is told, and re-sends the
 *   ranking.
 *
 * Open to the same origins as `/ranking` (any, unless `allowedOrigins` is
 * set; 403 otherwise): the bearer token, not a cookie, is the credential.
 * Never cached. Claims `/me` only — see `httpHandler` on why.
 */
export function meHandler(deps: MeDeps) {
  const now = deps.now ?? Date.now;
  // Each response's CORS origin, set once its request is let in.
  const cors = new WeakMap<ServerResponse, Record<string, string>>();
  const headers = {
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
  };
  const reply = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, {
      ...cors.get(res),
      ...headers,
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json; charset=utf-8' }),
    });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };
  const fail = (
    res: ServerResponse,
    status: number,
    error: ProfileUpdateError,
  ) => reply(res, status, { error });

  async function signedIn(
    req: IncomingMessage,
  ): Promise<VerifiedAccount | null> {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!deps.verify || !token || token.length >= 8192) return null;
    try {
      return await deps.verify(token);
    } catch {
      return null;
    }
  }

  /** The record as of this visit: created on the first one, name refreshed unless chosen. */
  function visit(account: VerifiedAccount): PlayerRecord {
    const record = recordVisit(deps.records.get(account.id), account, now());
    deps.records.put(record);
    return record;
  }

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (!deps.verify) return reply(res, 503);
    const account = await signedIn(req);
    if (!account) return fail(res, 401, 'auth-required');

    if (req.method === 'GET') {
      const record = visit(account);
      return reply(res, 200, toProfile(record, deps.records.all().values()));
    }

    if (!account.emailVerified) return fail(res, 403, 'email-not-verified');
    const body = await readBody(req);
    let parsed: unknown = null;
    try {
      parsed = body === null ? null : JSON.parse(body);
    } catch {
      parsed = null;
    }
    const update = parseProfileUpdate(parsed);
    if (!update) return fail(res, 400, 'bad-request');

    const result = updateProfile(
      visit(account),
      update,
      deps.records.all().values(),
    );
    if (result === 'name-taken') return fail(res, 409, 'name-taken');
    deps.records.putProfile(result);
    return reply(res, 200, toProfile(result, deps.records.all().values()));
  }

  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const path = (req.url ?? '/').split('?')[0];
    if (path !== '/me') return false;
    const allowed = corsOrigin(req.headers?.origin, deps.allowedOrigins ?? []);
    if (!allowed) {
      res.writeHead(403, { Vary: 'Origin' });
      res.end();
      return true;
    }
    cors.set(res, allowed);
    if (req.method === 'OPTIONS') {
      reply(res, 204);
      return true;
    }
    if (req.method !== 'GET' && req.method !== 'PUT') return false;
    handle(req, res).catch(() => {
      if (!res.headersSent) reply(res, 500);
    });
    return true;
  };
}

/** The request body as text, or `null` when it is larger than a profile update can be. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
