import { PlayerRecord, ranking } from '@libs/game-lobby';
import { RoomStatus } from '@libs/game-protocol';
import { IncomingMessage, ServerResponse } from 'node:http';
import { corsOrigin } from './origin';

/** How many the public ranking lists. */
export const RANKING_SIZE = 10;
/** How long a browser or proxy may keep the ranking before asking again. */
const RANKING_MAX_AGE_S = 30;

/**
 * The plain HTTP side of the game server, on the same port as the socket:
 * `GET /ranking` is the leaderboard as JSON and `GET /status` who is around
 * right now, for pages that want them without joining the room (the title
 * screen's podium and presence). Any allowed origin may read them — it is
 * what the room tells every visitor anyway — and they are cached briefly, so a
 * busy title screen costs the server nothing. With `allowedOrigins` set, a
 * request from anywhere else (or from no page at all) is answered 403; `GET /`
 * stays open for the tunnel's health check.
 *
 * Answers only its own paths and says so (`true`); every other request —
 * Colyseus' matchmaking posts above all — is left untouched for the
 * transport's own listener, which `main.ts` runs after this one. Writing to
 * a request Colyseus also answers crashes the process (headers sent twice).
 */
export function httpHandler(
  records: () => Iterable<PlayerRecord>,
  status?: () => Promise<RoomStatus | null>,
  allowedOrigins: readonly string[] = [],
) {
  // The ranking JSON, remembered for as long as a client may cache it, so a
  // flood of `/ranking?x=anything` (which defeats a shared cache) does not
  // re-sort every record on each hit.
  let cachedRanking: { at: number; body: string } | null = null;
  const rankingBody = (): string => {
    const at = Date.now();
    if (!cachedRanking || at - cachedRanking.at >= RANKING_MAX_AGE_S * 1000)
      cachedRanking = {
        at,
        body: JSON.stringify(ranking(records(), RANKING_SIZE)),
      };
    return cachedRanking.body;
  };

  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const path = (req.url ?? '/').split('?')[0];
    const cors = corsOrigin(req.headers?.origin, allowedOrigins);
    const headers: Record<string, string> = {
      ...cors,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': `public, max-age=${RANKING_MAX_AGE_S}`,
    };
    if (!cors && (path === '/ranking' || (path === '/status' && status))) {
      res.writeHead(403, { Vary: 'Origin' });
      res.end();
      return true;
    }
    if (path === '/ranking') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return true;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return false;
      const body = rankingBody();
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    }
    if (path === '/status' && status) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return true;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return false;
      // Who is around changes by the second: cached only long enough to absorb a burst of visitors.
      const live = {
        ...headers,
        'Cache-Control': 'public, max-age=5',
        'Content-Type': 'application/json; charset=utf-8',
      };
      status()
        .then((value) => {
          res.writeHead(200, live);
          res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value));
        })
        .catch(() => {
          res.writeHead(503, headers);
          res.end();
        });
      return true;
    }
    if (path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      // The tunnel's health check, and anyone curious.
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end(req.method === 'HEAD' ? undefined : 'Detona game server');
      return true;
    }
    return false;
  };
}
