import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ARENA_ROOM, PUBLIC_ROOM_RULES, RoomStatus } from '@libs/game-protocol';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { createArenaRoom } from './arena-room';
import { firebaseTokenVerifier } from './auth';
import { httpHandler } from './http';
import { loadConfig } from './config';
import { RecordsStore } from './records-store';
import { RulesStore } from './rules-store';

const config = loadConfig();

/** Who is around, from the public room's listing: what `refreshLobby` last put in its metadata. */
async function roomStatus(): Promise<RoomStatus | null> {
  const [room] = await matchMaker.query({ name: ARENA_ROOM });
  if (!room) return null;
  const meta = (room.metadata ?? {}) as Partial<RoomStatus>;
  return {
    online: room.clients ?? meta.online ?? 0,
    phase: meta.phase ?? 'waiting',
    playing: meta.playing ?? 0,
    queued: meta.queued ?? 0,
  };
}
const records = new RecordsStore(join(config.dataDir, 'players.json'));
records.load();
// What an admin last set wins over the environment: the page is the source of truth once used.
const rulesStore = new RulesStore(join(config.dataDir, 'rules.json'));
const rules = rulesStore.load() ?? {
  ...PUBLIC_ROOM_RULES,
  outsiders: config.outsiders,
};

if (!config.firebaseProjectId) {
  console.warn(
    '[game-server] No Firebase project (FIREBASE_PROJECT_ID or config/firebase.json): ' +
      'the room is watch-only, nobody can sign in to play.',
  );
}

// Shutdown is handled below, once: Colyseus' own signal handler and ours used to
// race, and a SIGTERM could leave the old process holding the port.
// The socket and the plain HTTP routes (`/ranking`) share one port: Colyseus
// binds its own request listener to this server when it listens (below).
const httpServer = createServer();
const server = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  greet: false,
  gracefullyShutdown: false,
});
server.define(
  ARENA_ROOM,
  createArenaRoom({
    rules,
    verify: config.firebaseProjectId
      ? firebaseTokenVerifier(config.firebaseProjectId)
      : null,
    records,
    admins: config.admins,
    saveRules: (next) => rulesStore.save(next),
  }),
);

await server.listen(config.port);
// Our routes answer first; what they do not claim goes on to Colyseus' listener
// (matchmaking). One listener in charge: two answers to one request would
// throw once the headers are sent, and take the process down.
const colyseusListeners = httpServer.listeners('request') as ((
  req: IncomingMessage,
  res: ServerResponse,
) => void)[];
httpServer.removeAllListeners('request');
const ours = httpHandler(() => records.all().values(), roomStatus);
httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  if (ours(req, res)) return;
  for (const next of colyseusListeners) next.call(httpServer, req, res);
});
// The one public room exists from the start, so the first visitor joins it
// instead of creating it.
await matchMaker.createRoom(ARENA_ROOM, {});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[game-server] ${signal}: saving records and shutting down`);
  records.flush();
  // Never hang on a client that will not say goodbye.
  setTimeout(() => process.exit(0), 3_000).unref();
  await server.gracefullyShutdown(false).catch(() => undefined);
  records.flush();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

console.log(
  `[game-server] ws://localhost:${config.port} — room "${ARENA_ROOM}" ready`,
);
console.log(
  `[game-server] rules: ${JSON.stringify(rules)} · admins: ${config.admins.length}`,
);
