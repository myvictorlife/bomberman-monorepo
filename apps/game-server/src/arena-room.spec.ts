import { matchMaker, Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DEFAULT_CHARACTER_ID, GameState } from '@libs/game-core';
import {
  ChatMessage,
  CLIENT_MESSAGE,
  FrameMessage,
  GuestIdentity,
  LobbySnapshot,
  PlayerProfile,
  RankingEntry,
  RoomRules,
  SERVER_MESSAGE,
} from '@libs/game-protocol';
// The SDK is banned in the server's own code; a test plays the browser's part.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { Client, Room } from '@colyseus/sdk';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chatOutcome,
  clientAddress,
  createArenaRoom,
  GUESTS_PER_ADDRESS,
  standings,
} from './arena-room';
import { TokenVerifier } from './auth';
import { RecordsStore } from './records-store';

const RULES: RoomRules = {
  maxPlayers: 5,
  minPlayers: 2,
  countdownMs: 300,
  resultsMs: 300,
  outsiders: 2,
  roundTimerMs: 0,
  closingWalls: true,
  // Off here, so the rotation tests below read as before; `champion` turns it on.
  winnerStays: 0,
  bots: 0,
  botsFillTo: 5,
  idleMs: 0,
};
const saved: RoomRules[] = [];
const PORT = 18_000 + Math.floor(Math.random() * 1_000);

/** Tokens are `id:name:verified` — the server only sees what the verifier returns. */
const fakeVerify: TokenVerifier = async (token) => {
  const [id, name, verified] = token.split(':');
  if (!id || token === 'bad') throw new Error('invalid');
  return {
    id,
    name: name ?? id,
    email: `${id}@test.dev`,
    emailVerified: verified === 'yes',
  };
};

let server: Server;
let records: RecordsStore;
const rooms: Room[] = [];

beforeAll(async () => {
  records = new RecordsStore(
    join(mkdtempSync(join(tmpdir(), 'arena-')), 'players.json'),
    10,
  );
  server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    gracefullyShutdown: false,
  });
  server.define(
    'arena',
    createArenaRoom({
      rules: RULES,
      verify: fakeVerify,
      records,
      reconnectGraceMs: 400,
    }),
  );
  server.define(
    'admin',
    createArenaRoom({
      rules: RULES,
      verify: fakeVerify,
      records,
      reconnectGraceMs: 400,
      admins: ['lead@test.dev'],
      saveRules: (r) => saved.push(r),
    }),
  );
  server.define(
    'watch-only',
    createArenaRoom({ rules: RULES, verify: null, records }),
  );
  server.define(
    'champion',
    createArenaRoom({
      rules: { ...RULES, outsiders: 0, winnerStays: 5 },
      verify: fakeVerify,
      records,
    }),
  );
  server.define(
    'no-outsiders',
    createArenaRoom({
      rules: { ...RULES, outsiders: 0 },
      verify: fakeVerify,
      records,
    }),
  );
  server.define(
    'idle',
    createArenaRoom({
      rules: { ...RULES, idleMs: 600 },
      verify: fakeVerify,
      records,
    }),
  );
  server.define(
    'bots',
    createArenaRoom({
      rules: { ...RULES, bots: 5 },
      verify: fakeVerify,
      records,
    }),
  );
  await server.listen(PORT);
});

afterEach(async () => {
  const settle = (p: Promise<unknown>) =>
    Promise.race([
      p.catch(() => undefined),
      new Promise((r) => setTimeout(r, 300)),
    ]);
  await Promise.all(rooms.splice(0).map((r) => settle(r.leave())));
  await Promise.all(
    (await matchMaker.query({})).map((r) =>
      matchMaker.getLocalRoomById(r.roomId)?.disconnect(),
    ),
  );
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

/** Collects every message a room receives, so a test can wait for one that matches. */
async function connect(roomName = 'arena') {
  const client = new Client(`http://localhost:${PORT}`);
  return wrap(await client.joinOrCreate(roomName));
}

/** Back on a dropped peer's session, by its reconnection token. */
async function reconnectAs(peer: { room: Room }) {
  const client = new Client(`http://localhost:${PORT}`);
  return wrap(await client.reconnect(peer.room.reconnectionToken));
}

function wrap(room: Room) {
  rooms.push(room);
  const inbox: { type: string; payload: unknown }[] = [];
  const waiters: (() => void)[] = [];
  room.onMessage('*', (type, payload) => {
    inbox.push({ type: String(type), payload });
    waiters.splice(0).forEach((wake) => wake());
  });

  function next<T>(
    type: string,
    match: (payload: T) => boolean = () => true,
    timeoutMs = 4_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no "${type}" message matched`)),
        timeoutMs,
      );
      const check = () => {
        const index = inbox.findIndex(
          (m) => m.type === type && match(m.payload as T),
        );
        if (index !== -1) {
          clearTimeout(timer);
          // Consumed with everything before it: the next wait only sees what came after.
          const [found] = inbox.splice(0, index + 1).slice(-1);
          resolve(found?.payload as T);
        } else {
          waiters.push(check);
        }
      };
      check();
    });
  }
  const clear = () => (inbox.length = 0);
  return { room, next, clear };
}

async function signedIn(id: string, verified = true, roomName = 'arena') {
  const peer = await connect(roomName);
  peer.room.send(CLIENT_MESSAGE.hello, {
    token: `${id}:${id.toUpperCase()}:${verified ? 'yes' : 'no'}`,
  });
  await peer.next<PlayerProfile>(SERVER_MESSAGE.profile);
  return peer;
}

async function asGuest(name: string, token?: string, roomName = 'arena') {
  const peer = await connect(roomName);
  peer.room.send(CLIENT_MESSAGE.guest, { name, ...(token ? { token } : {}) });
  const identity = await peer.next<GuestIdentity>(SERVER_MESSAGE.guest);
  return { ...peer, identity };
}

const localRoom = (peer: { room: Room }) =>
  matchMaker.getLocalRoomById(peer.room.roomId) as unknown as {
    game: GameState | null;
  };

describe('ArenaRoom', () => {
  it('plays a round of bots for whoever watches, and ends it when someone queues', async () => {
    const viewer = await connect('bots');

    const first = await viewer.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => f.state.phase === 'playing',
    );
    expect(first.state.players.map((p) => p.id)).toEqual([
      'cpu1',
      'cpu2',
      'cpu3',
      'cpu4',
      'cpu5',
    ]);
    const start = first.state.players.map((p) => [p.x, p.y]);
    // The bots play: someone has moved within a couple of seconds.
    await viewer.next<FrameMessage>(SERVER_MESSAGE.frame, (f) =>
      f.state.players.some(
        (p, i) => p.x !== start[i]?.[0] || p.y !== start[i]?.[1],
      ),
    );

    const player = await signedIn('bia', true, 'bots');
    player.room.send(CLIENT_MESSAGE.joinQueue, {});
    const countdown = await viewer.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'countdown',
    );
    expect(countdown.players).toEqual([]);
    expect(localRoom(viewer).game).toBeNull();

    const next = await player.next<FrameMessage>(SERVER_MESSAGE.frame, (f) =>
      f.state.players.some((p) => p.id === 'bia'),
    );
    expect(next.state.players[0]?.id).toBe('bia');
    expect(next.round).toBe(first.round + 1);
  });

  it('is the only room of its kind: a second one is refused', async () => {
    const peer = await connect();

    await expect(matchMaker.createRoom('arena', {})).rejects.toThrow();
    const arenas = await matchMaker.query({ name: 'arena' });
    expect(arenas.map((r) => r.roomId)).toEqual([peer.room.roomId]);
  });

  it('lets anyone watch: the lobby and the ranking arrive on join', async () => {
    const peer = await connect();

    const lobby = await peer.next<LobbySnapshot>(SERVER_MESSAGE.lobby);
    expect(lobby.phase).toBe('waiting');
    expect(lobby.rules).toEqual(RULES);
    await expect(
      peer.next<RankingEntry[]>(SERVER_MESSAGE.ranking),
    ).resolves.toEqual(expect.any(Array));
  });

  it('lists who is watching: signed-in viewers by name, the rest as a count', async () => {
    const viewer = await signedIn('nia');
    const anonymous = await connect();
    const player = await signedIn('oto');
    player.room.send(CLIENT_MESSAGE.joinQueue, {});

    const lobby = await anonymous.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) =>
        l.queue.some((s) => s.id === 'oto') && l.watchers.names.includes('NIA'),
    );
    // Oto is queued, so not counted as a viewer; the anonymous tab is.
    expect(lobby.watchers.names).toEqual(['NIA']);
    expect(lobby.watchers.anonymous).toBe(1);

    await viewer.room.leave();
    await anonymous.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.watchers.names.length === 0,
    );
  });

  it('answers a sign-in with the profile, and tells a returning player', async () => {
    const peer = await connect();
    peer.room.send(CLIENT_MESSAGE.hello, { token: 'ret:Rita:yes' });

    const profile = await peer.next<PlayerProfile>(SERVER_MESSAGE.profile);
    expect(profile).toMatchObject({
      id: 'ret',
      name: 'Rita',
      visits: 1,
      returning: false,
    });
  });

  it('re-sends the profile and the ranking when a player renames themselves', async () => {
    const peer = await signedIn('ren');
    const record = records.get('ren');
    if (!record) throw new Error('no record');
    peer.clear();

    records.putProfile({ ...record, name: 'Renomeado', nameChosen: true });

    // The ranking goes to everyone first, then the profile to the player.
    await peer.next(SERVER_MESSAGE.ranking);
    const profile = await peer.next<PlayerProfile>(SERVER_MESSAGE.profile);
    expect(profile).toMatchObject({ name: 'Renomeado', nameChosen: true });

    // Signing in again does not bring the account's name back.
    peer.room.send(CLIENT_MESSAGE.hello, { token: 'ren:REN:yes' });
    const again = await peer.next<PlayerProfile>(SERVER_MESSAGE.profile);
    expect(again.name).toBe('Renomeado');
  });

  it('refuses the queue without a sign-in, a confirmed e-mail or a valid token', async () => {
    const anonymous = await connect();
    anonymous.room.send(CLIENT_MESSAGE.joinQueue, {});
    await expect(
      anonymous.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'auth-required',
      ),
    ).resolves.toBeTruthy();

    const unconfirmed = await signedIn('unconfirmed', false);
    await unconfirmed.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'email-not-verified',
    );
    unconfirmed.clear();
    unconfirmed.room.send(CLIENT_MESSAGE.joinQueue, {});
    await unconfirmed.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'email-not-verified',
    );

    const forged = await connect();
    forged.room.send(CLIENT_MESSAGE.hello, { token: 'bad' });
    await forged.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'invalid-token',
    );
    forged.room.send(CLIENT_MESSAGE.hello, { nope: true });
    await forged.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'bad-message',
    );
  });

  it('is watch-only when the server has no Firebase project', async () => {
    const peer = await connect('watch-only');
    peer.room.send(CLIENT_MESSAGE.hello, { token: 'a:A:yes' });

    await peer.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'auth-required',
    );
  });

  it('queues, counts down, plays, takes input, and keeps one place per account', async () => {
    const ana = await signedIn('ana');
    const bia = await signedIn('bia');

    ana.room.send(CLIENT_MESSAGE.joinQueue, { characterId: 'byte' });
    await ana.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 1,
    );
    ana.room.send(CLIENT_MESSAGE.joinQueue, {});
    await ana.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'already-queued',
    );

    bia.room.send(CLIENT_MESSAGE.joinQueue, {});
    const countdown = await ana.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'countdown',
    );
    expect(countdown.countdownEndsAt).toEqual(expect.any(Number));

    const playing = await ana.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );
    expect(playing.players.map((p) => [p.id, p.characterId])).toEqual([
      ['ana', 'byte'],
      ['bia', DEFAULT_CHARACTER_ID],
    ]);
    const first = await bia.next<FrameMessage>(SERVER_MESSAGE.frame);
    expect(first.state.players.map((p) => p.id)).toEqual(['ana', 'bia']);

    ana.room.send(CLIENT_MESSAGE.input, { direction: 'right' });
    const moved = await bia.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => (f.state.players[0]?.x ?? 0) > 1.2,
    );
    expect(moved.state.players[0]?.facing).toBe('right');

    ana.room.send(CLIENT_MESSAGE.joinQueue, {});
    await ana.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'already-playing',
    );
    // Leaving the queue during your own round does nothing.
    ana.room.send(CLIENT_MESSAGE.leaveQueue);
    ana.room.send(CLIENT_MESSAGE.input, { direction: 'sideways' });
    // Leaving after the round is: everyone sees it coming.
    ana.room.send(CLIENT_MESSAGE.leaveAfterRound, { leave: true });
    await bia.next<LobbySnapshot>(SERVER_MESSAGE.lobby, (l) =>
      (l.leavingAfter ?? []).includes('ana'),
    );
    ana.room.send(CLIENT_MESSAGE.leaveAfterRound, { leave: false });
    await bia.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => (l.leavingAfter ?? []).length === 0,
    );
  });

  it('plays each player in the colour on their profile, first in line first', async () => {
    const gil = await signedIn('gil');
    const hal = await signedIn('hal');
    for (const id of ['gil', 'hal']) {
      const record = records.get(id);
      if (record) records.put({ ...record, color: 'purple' });
    }

    gil.room.send(CLIENT_MESSAGE.joinQueue, {});
    await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 1,
    );
    hal.room.send(CLIENT_MESSAGE.joinQueue, {});
    const first = await hal.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => f.state.players.length === 2,
    );

    // Gil was first and keeps purple; Hal gets the closest free colour
    // (blue and pink are as close: palette order picks blue).
    expect(first.state.players.map((p) => [p.id, p.color])).toEqual([
      ['gil', 'purple'],
      ['hal', 'blue'],
    ]);
  });

  it('records the result, updates the ranking and puts the players back in line', async () => {
    const cai = await signedIn('cai');
    const dan = await signedIn('dan');
    const eva = await signedIn('eva');
    cai.room.send(CLIENT_MESSAGE.joinQueue, {});
    dan.room.send(CLIENT_MESSAGE.joinQueue, {});
    await cai.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );
    // Someone arriving mid-round queues for the next one.
    eva.room.send(CLIENT_MESSAGE.joinQueue, {});
    await cai.next<LobbySnapshot>(SERVER_MESSAGE.lobby, (l) =>
      l.queue.some((s) => s.id === 'eva'),
    );

    // Dan is caught by a flame.
    const game = localRoom(cai).game as GameState;
    const victim = game.players.find((p) => p.id === 'dan');
    if (!victim) throw new Error('no dan');
    victim.alive = false;
    victim.diedAtTick = game.tick;

    // The server sends the new ranking and profiles, then the lobby in its results phase.
    const top = await cai.next<RankingEntry[]>(
      SERVER_MESSAGE.ranking,
      (r) => r.length > 0,
    );
    expect(top[0]).toEqual({
      id: 'cai',
      name: 'CAI',
      wins: 1,
      matches: 1,
      characterId: DEFAULT_CHARACTER_ID,
    });
    await expect(
      cai.next<PlayerProfile>(SERVER_MESSAGE.profile, (p) => p.wins === 1),
    ).resolves.toMatchObject({ rank: 1 });
    const results = await cai.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'results',
    );
    expect(results.winnerId).toBe('cai');
    // The room tells the chat, too.
    await expect(
      eva.next<ChatMessage>(SERVER_MESSAGE.chat),
    ).resolves.toMatchObject({
      author: null,
      event: { type: 'round-won', name: 'CAI' },
    });

    const next = await cai.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'countdown',
    );
    expect(next.queue.map((s) => s.id)).toEqual(['eva', 'cai', 'dan']);
    expect(records.get('dan')).toMatchObject({ matches: 1, wins: 0 });
  }, 15_000);

  it('takes a player who leaves out of the round, and the one left wins', async () => {
    const hal = await signedIn('hal');
    const ivy = await signedIn('ivy');
    hal.room.send(CLIENT_MESSAGE.joinQueue, {});
    ivy.room.send(CLIENT_MESSAGE.joinQueue, {});
    await hal.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );

    await ivy.room.leave();

    const died = await hal.next<FrameMessage>(SERVER_MESSAGE.frame, (f) =>
      f.events.some((e) => e.type === 'player-died' && e.playerId === 'ivy'),
    );
    expect(died.state.players.find((p) => p.id === 'ivy')?.alive).toBe(false);
    const results = await hal.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'results',
    );
    expect(results.winnerId).toBe('hal');
    expect(records.get('hal')).toMatchObject({ wins: 1 });
  }, 15_000);

  it('gives a reloading player their character back', async () => {
    const jon = await signedIn('jon');
    const kim = await signedIn('kim');
    jon.room.send(CLIENT_MESSAGE.joinQueue, {});
    kim.room.send(CLIENT_MESSAGE.joinQueue, {});
    await kim.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );

    // The page reloads: the socket drops, a new one signs in again.
    await jon.room.leave();
    const back = await signedIn('jon');
    await new Promise((r) => setTimeout(r, 600));

    const game = localRoom(kim).game as GameState;
    expect(game.players.find((p) => p.id === 'jon')?.alive).toBe(true);
    back.room.send(CLIENT_MESSAGE.input, { direction: 'down' });
    await expect(
      kim.next<FrameMessage>(
        SERVER_MESSAGE.frame,
        (f) => (f.state.players[0]?.y ?? 0) > 1.2,
      ),
    ).resolves.toBeTruthy();
  });

  it('gives the place up at once on sign-out', async () => {
    const lia = await signedIn('lia');
    const max = await signedIn('max');
    lia.room.send(CLIENT_MESSAGE.joinQueue, {});
    max.room.send(CLIENT_MESSAGE.joinQueue, {});
    await max.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );

    lia.room.send(CLIENT_MESSAGE.signOut);

    await max.next<FrameMessage>(SERVER_MESSAGE.frame, (f) =>
      f.events.some((e) => e.type === 'player-died' && e.playerId === 'lia'),
    );
    // Signing out again, or signed out already, is harmless.
    lia.room.send(CLIENT_MESSAGE.signOut);
  });

  it('stands the next in line on the border, takes their throws, and clears it when they leave', async () => {
    const ola = await signedIn('ola');
    const pam = await signedIn('pam');
    const rui = await signedIn('rui');
    ola.room.send(CLIENT_MESSAGE.joinQueue, {});
    pam.room.send(CLIENT_MESSAGE.joinQueue, {});
    await rui.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );

    rui.room.send(CLIENT_MESSAGE.joinQueue, { characterId: 'lia' });
    const outside = await rui.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => f.state.outsiders.length === 1,
    );
    expect(outside.state.outsiders[0]).toMatchObject({
      id: 'rui',
      name: 'RUI',
      characterId: 'lia',
    });
    expect(outside.state.players.map((p) => p.id)).toEqual(['ola', 'pam']);

    rui.room.send(CLIENT_MESSAGE.input, { direction: null, bomb: true });
    const thrown = await ola.next<FrameMessage>(SERVER_MESSAGE.frame, (f) =>
      f.events.some((e) => e.type === 'bomb-thrown' && e.playerId === 'rui'),
    );
    expect(thrown.state.thrownBombs[0]).toMatchObject({ ownerId: 'rui' });

    rui.room.send(CLIENT_MESSAGE.leaveQueue);
    await ola.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => f.state.outsiders.length === 0,
    );
  });

  it("lets an outsider who gets a kill into the round, in the victim's place", async () => {
    const sam = await signedIn('sam');
    const tom = await signedIn('tom');
    const uma = await signedIn('uma');
    sam.room.send(CLIENT_MESSAGE.joinQueue, {});
    tom.room.send(CLIENT_MESSAGE.joinQueue, {});
    await uma.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );
    uma.room.send(CLIENT_MESSAGE.joinQueue, {});
    const outside = await uma.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => f.state.outsiders.length === 1,
    );

    // Sam stands where Uma's throw from the top wall will land — no crate in the way.
    const game = localRoom(uma).game as GameState;
    game.tiles = game.tiles.map((t) => (t === 'block' ? 'empty' : t));
    const sam$ = game.players.find(
      (p) => p.id === 'sam',
    ) as GameState['players'][number];
    const [col, row] = [
      outside.state.outsiders[0]?.x ?? 0,
      (outside.state.outsiders[0]?.y ?? 0) + 3,
    ];
    sam$.x = col;
    sam$.y = row;
    uma.room.send(CLIENT_MESSAGE.input, { direction: null, bomb: true });

    // The queue moves first, then the frame with the entry goes out.
    const lobby = await tom.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.players.length === 3,
      8_000,
    );
    expect(lobby.players.map((p) => p.id)).toEqual(['sam', 'tom', 'uma']);
    expect(lobby.queue).toEqual([]);
    const entered = await tom.next<FrameMessage>(SERVER_MESSAGE.frame, (f) =>
      f.events.some(
        (e) => e.type === 'outsider-entered' && e.playerId === 'uma',
      ),
    );
    expect(entered.state.players.map((p) => [p.id, p.alive])).toEqual([
      ['sam', false],
      ['tom', true],
      ['uma', true],
    ]);
    expect(entered.state.outsiders).toEqual([]);
    uma.room.send(CLIENT_MESSAGE.joinQueue, {});
    await uma.next(
      SERVER_MESSAGE.error,
      (e: { code: string }) => e.code === 'already-playing',
    );
  }, 15_000);

  it('keeps the border empty when the room has no outsiders', async () => {
    const vic = await signedIn('vic', true, 'no-outsiders');
    const wes = await signedIn('wes', true, 'no-outsiders');
    const zoe = await signedIn('zoe', true, 'no-outsiders');
    vic.room.send(CLIENT_MESSAGE.joinQueue, {});
    wes.room.send(CLIENT_MESSAGE.joinQueue, {});
    await zoe.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );

    zoe.room.send(CLIENT_MESSAGE.joinQueue, {});
    const queued = await zoe.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 1,
    );
    expect(queued.rules.outsiders).toBe(0);
    const frame = await zoe.next<FrameMessage>(
      SERVER_MESSAGE.frame,
      (f) => f.state.tick > 5,
    );
    expect(frame.state.outsiders).toEqual([]);
  });

  it('takes a player who stands still too long out of the round and the line, and says so', async () => {
    const ana = await signedIn('ana', true, 'idle');
    const bia = await signedIn('bia', true, 'idle');
    ana.room.send(CLIENT_MESSAGE.joinQueue, {});
    bia.room.send(CLIENT_MESSAGE.joinQueue, {});
    await ana.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'playing',
    );
    // Ana keeps moving; Bia never touches a key.
    const moving = setInterval(
      () => ana.room.send(CLIENT_MESSAGE.input, { direction: 'right' }),
      150,
    );
    try {
      const out = await bia.next<{ code: string }>(
        SERVER_MESSAGE.error,
        (e) => e.code === 'idle',
        3_000,
      );
      expect(out.code).toBe('idle');
      const told = await ana.next<ChatMessage>(
        SERVER_MESSAGE.chat,
        (m) => m.event?.type === 'idle-out',
        3_000,
      );
      expect(told.event).toEqual({ type: 'idle-out', name: 'BIA' });
      // With Bia out, Ana is the last one standing; Bia is not put back in line.
      const results = await ana.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'results',
        3_000,
      );
      expect(results.winnerId).toBe('ana');
      const next = await ana.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase !== 'results' && l.phase !== 'playing',
        3_000,
      );
      expect(next.queue.map((q) => q.id)).toEqual(['ana']);
    } finally {
      clearInterval(moving);
    }
  });

  it('holds a dropped player’s session: back by token within the grace, place and identity kept', async () => {
    const fay = await signedIn('fay');
    const gil = await signedIn('gil');
    fay.room.send(CLIENT_MESSAGE.joinQueue, {});
    await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 1,
    );

    // The socket goes, with no goodbye: a phone in a pocket.
    await fay.room.leave(false);
    const back = await reconnectAs(fay);
    // Welcomed again with the room as it is; no hello needed, the spot is kept.
    const still = await back.next<LobbySnapshot>(SERVER_MESSAGE.lobby);
    expect(still.queue.map((q) => q.id)).toEqual(['fay']);
    back.room.send(CLIENT_MESSAGE.leaveQueue);
    await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 0,
    );
  });

  it('gives a dropped player’s place up once the grace runs out', async () => {
    const fay = await signedIn('fay');
    const gil = await signedIn('gil');
    fay.room.send(CLIENT_MESSAGE.joinQueue, {});
    await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 1,
    );
    await fay.room.leave(false);
    const empty = await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 0,
      2_000,
    );
    expect(empty.phase).toBe('waiting');
  });

  it('announces a restart before letting everyone go', async () => {
    const fay = await signedIn('fay');
    const room = matchMaker.getLocalRoomById(fay.room.roomId) as unknown as {
      onBeforeShutdown(): void;
    };
    const gone = new Promise<number>((resolve) =>
      fay.room.onLeave((code) => resolve(code)),
    );
    room.onBeforeShutdown();
    expect(await fay.next<{ inMs: number }>(SERVER_MESSAGE.restarting)).toEqual(
      { inMs: 300 },
    );
    expect(await gone).toBeGreaterThan(0);
  });

  it('drops a player who disconnects, but not while another tab is open', async () => {
    const fay = await signedIn('fay');
    const fay2 = await signedIn('fay');
    const gil = await signedIn('gil');
    fay.room.send(CLIENT_MESSAGE.joinQueue, {});
    await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 1,
    );

    await fay2.room.leave();
    gil.room.send(CLIENT_MESSAGE.joinQueue, {});
    await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.phase === 'countdown',
    );

    gil.room.send(CLIENT_MESSAGE.leaveQueue);
    await fay.room.leave();
    const empty = await gil.next<LobbySnapshot>(
      SERVER_MESSAGE.lobby,
      (l) => l.queue.length === 0,
    );
    expect(empty.phase).toBe('waiting');
  });

  describe('guests', () => {
    it('plays a guest under a name, and a reload gets the same guest back', async () => {
      const acc = await signedIn('acc');
      const guest = await asGuest('Visita');
      expect(guest.identity).toEqual({
        id: expect.stringMatching(/^guest:/),
        name: 'Visita',
        token: expect.any(String),
      });

      guest.room.send(CLIENT_MESSAGE.joinQueue, { characterId: 'byte' });
      acc.room.send(CLIENT_MESSAGE.joinQueue, {});
      const playing = await acc.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'playing',
      );
      expect(playing.players.map((p) => [p.id, p.name])).toEqual([
        [guest.identity.id, 'Visita'],
        ['acc', 'ACC'],
      ]);

      // The page reloads and sends the token it kept: same guest, same place.
      await guest.room.leave();
      const back = await asGuest('Visita', guest.identity.token);
      expect(back.identity.id).toBe(guest.identity.id);
      await new Promise((r) => setTimeout(r, 600));
      const game = localRoom(acc).game as GameState;
      expect(game.players.find((p) => p.id === back.identity.id)?.alive).toBe(
        true,
      );
    });

    it('refuses a name an account or another guest has, and a bad one', async () => {
      await signedIn('nia');
      const taken = await connect();
      taken.room.send(CLIENT_MESSAGE.guest, { name: ' Niá ' });
      await taken.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'name-taken',
      );

      await asGuest('Primeiro');
      taken.room.send(CLIENT_MESSAGE.guest, { name: 'primeiro' });
      await taken.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'name-taken',
      );
      taken.room.send(CLIENT_MESSAGE.guest, { name: 'x' });
      await taken.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'bad-message',
      );
    });

    it('keeps the chat for accounts', async () => {
      const guest = await asGuest('Calado');
      guest.room.send(CLIENT_MESSAGE.chatSend, { text: 'oi' });
      await guest.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'auth-required',
      );
    });

    it('lets only a few guests from one address hold a place', async () => {
      const guests = [];
      for (let i = 0; i <= GUESTS_PER_ADDRESS; i++)
        guests.push(await asGuest(`Casa ${i}`, undefined, 'no-outsiders'));
      for (const guest of guests.slice(0, GUESTS_PER_ADDRESS))
        guest.room.send(CLIENT_MESSAGE.joinQueue, {});
      const last = guests[GUESTS_PER_ADDRESS];
      if (!last) throw new Error('no last guest');
      await last.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.players.length + l.queue.length === GUESTS_PER_ADDRESS,
      );
      last.room.send(CLIENT_MESSAGE.joinQueue, {});
      await last.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'guest-limit',
      );
    });

    it('ends playing as a guest when the connection signs in', async () => {
      const guest = await asGuest('Depois', undefined, 'no-outsiders');
      guest.room.send(CLIENT_MESSAGE.joinQueue, {});
      await guest.next<LobbySnapshot>(SERVER_MESSAGE.lobby, (l) =>
        l.queue.some((s) => s.id === guest.identity.id),
      );
      guest.room.send(CLIENT_MESSAGE.hello, { token: 'ped:PED:yes' });
      await guest.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => !l.queue.some((s) => s.id === guest.identity.id),
      );
      // An account cannot play as a guest on top of it.
      guest.room.send(CLIENT_MESSAGE.guest, { name: 'Outro' });
      await guest.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'bad-message',
      );
    });

    it('records a round only with two accounts in it', async () => {
      const que = await signedIn('que');
      const guest = await asGuest('Rival');
      que.room.send(CLIENT_MESSAGE.joinQueue, {});
      guest.room.send(CLIENT_MESSAGE.joinQueue, {});
      await que.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'playing',
      );
      const game = localRoom(que).game as GameState;
      const victim = game.players.find((p) => p.id === guest.identity.id);
      if (!victim) throw new Error('no guest');
      victim.alive = false;
      victim.diedAtTick = game.tick;

      const results = await que.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'results',
      );
      expect(results.winnerId).toBe('que');
      expect(records.get('que')).toMatchObject({ wins: 0, matches: 0 });
      expect(records.get(guest.identity.id)).toBeUndefined();
    }, 15_000);

    it('records the accounts of a round a guest wins', async () => {
      const ray = await signedIn('ray');
      const sol = await signedIn('sol');
      const guest = await asGuest('Penetra', undefined, 'no-outsiders');
      // `ray` and `sol` join the same room as the guest.
      const rayHere = await signedIn('ray', true, 'no-outsiders');
      const solHere = await signedIn('sol', true, 'no-outsiders');
      await Promise.all([ray.room.leave(), sol.room.leave()]);
      guest.room.send(CLIENT_MESSAGE.joinQueue, {});
      rayHere.room.send(CLIENT_MESSAGE.joinQueue, {});
      solHere.room.send(CLIENT_MESSAGE.joinQueue, {});
      await guest.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'playing',
      );
      const game = localRoom(guest).game as GameState;
      for (const p of game.players) {
        if (p.id === guest.identity.id) continue;
        p.alive = false;
        p.diedAtTick = game.tick;
      }
      const results = await guest.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'results',
      );
      expect(results.winnerId).toBe(guest.identity.id);
      expect(records.get('ray')).toMatchObject({ wins: 0, matches: 1 });
      expect(records.get('sol')).toMatchObject({ wins: 0, matches: 1 });
    }, 15_000);

    it('answers a message type it does not know, without dropping the connection', async () => {
      const peer = await connect();
      peer.room.send('from-the-future', { x: 1 });
      await peer.next(
        SERVER_MESSAGE.error,
        (e: { code: string }) => e.code === 'bad-message',
      );
      peer.room.send(CLIENT_MESSAGE.react, { emoji: '🔥' });
      await expect(peer.next(SERVER_MESSAGE.reaction)).resolves.toBeTruthy();
    });

    it('reads the visitor address Cloudflare passes on, else Colyseus’ own', () => {
      const headers = new Headers({ 'cf-connecting-ip': '200.1.2.3' });
      expect(clientAddress({ ip: '127.0.0.1', headers })).toBe('200.1.2.3');
      expect(clientAddress({ ip: '10.0.0.9', headers: new Headers() })).toBe(
        '10.0.0.9',
      );
      expect(clientAddress({ ip: undefined, headers: new Headers() })).toBe(
        'unknown',
      );
    });
  });

  describe('rules', () => {
    it('tells an account whether it is an admin, and refuses rule changes from anyone else', async () => {
      const lead = await signedIn('lead', true, 'admin');
      await expect(
        lead.next<{ admin: boolean }>(SERVER_MESSAGE.admin),
      ).resolves.toEqual({ admin: true });
      const other = await signedIn('other', true, 'admin');
      await expect(
        other.next<{ admin: boolean }>(SERVER_MESSAGE.admin),
      ).resolves.toEqual({ admin: false });

      other.room.send(CLIENT_MESSAGE.setRules, { rules: { outsiders: 0 } });
      await expect(
        other.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'forbidden' });
      // Not signed in at all: the same answer.
      const nobody = await connect('admin');
      nobody.room.send(CLIENT_MESSAGE.setRules, { rules: { outsiders: 0 } });
      await expect(
        nobody.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'forbidden' });
    });

    it('applies an admin change at once between rounds, saves it, and rejects a bad one', async () => {
      const lead = await signedIn('lead', true, 'admin');
      lead.clear();
      saved.length = 0;

      lead.room.send(CLIENT_MESSAGE.setRules, {
        rules: { outsiders: 0, closingWalls: false },
      });
      const lobby = await lead.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.rules.outsiders === 0,
      );
      expect(lobby.rules.closingWalls).toBe(false);
      expect(lobby.nextRules).toBeNull();
      expect(saved.at(-1)).toEqual({
        ...RULES,
        outsiders: 0,
        closingWalls: false,
      });

      lead.room.send(CLIENT_MESSAGE.setRules, { rules: { outsiders: 99 } });
      await expect(
        lead.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'bad-message' });
      lead.room.send(CLIENT_MESSAGE.setRules, {
        rules: { outsiders: 2, closingWalls: true },
      });
      await lead.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.rules.outsiders === 2,
      );
    });

    it('holds a change made during a round for the next one', async () => {
      const a = await signedIn('ra', true, 'admin');
      const b = await signedIn('rb', true, 'admin');
      const lead = await signedIn('lead', true, 'admin');
      a.room.send(CLIENT_MESSAGE.joinQueue, {
        characterId: DEFAULT_CHARACTER_ID,
      });
      b.room.send(CLIENT_MESSAGE.joinQueue, {
        characterId: DEFAULT_CHARACTER_ID,
      });
      await lead.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'playing',
      );

      lead.room.send(CLIENT_MESSAGE.setRules, { rules: { outsiders: 1 } });
      const pending = await lead.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.nextRules?.outsiders === 1,
      );
      expect(pending.rules.outsiders).toBe(2);

      // The round ends when one leaves; after the results the new rules are the rules.
      await b.room.leave();
      const after = await lead.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) =>
          l.phase !== 'playing' &&
          l.phase !== 'results' &&
          l.rules.outsiders === 1,
        6_000,
      );
      expect(after.nextRules).toBeNull();
    });
  });

  describe('chat', () => {
    it('lets a confirmed account write, tagged with what it is doing, and everyone read it', async () => {
      const reader = await connect();
      const ana = await signedIn('ana');
      const bob = await signedIn('bob');
      bob.room.send(CLIENT_MESSAGE.joinQueue, {});
      await bob.next<LobbySnapshot>(SERVER_MESSAGE.lobby, (l) =>
        l.queue.some((s) => s.id === 'bob'),
      );

      ana.room.send(CLIENT_MESSAGE.chatSend, { text: '  boa\nsorte ' });
      await reader.next<ChatMessage>(SERVER_MESSAGE.chat);
      bob.room.send(CLIENT_MESSAGE.chatSend, { text: 'valeu' });
      await reader.next<ChatMessage>(SERVER_MESSAGE.chat);

      // A newcomer gets what was said.
      const late = await connect();
      const history = await late.next<ChatMessage[]>(
        SERVER_MESSAGE.chatHistory,
      );
      // Sent from two sockets, so read in the order the room took them.
      expect(history.map((m) => [m.text, m.author])).toEqual([
        ['boa sorte', { id: 'ana', name: 'ANA', role: 'watching' }],
        ['valeu', { id: 'bob', name: 'BOB', role: 'queued' }],
      ]);
    });

    it('refuses writing without a confirmed account, an empty line, and a flood', async () => {
      const anonymous = await connect();
      anonymous.room.send(CLIENT_MESSAGE.chatSend, { text: 'oi' });
      await expect(
        anonymous.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'auth-required' });

      const unconfirmed = await signedIn('unc', false);
      unconfirmed.clear();
      unconfirmed.room.send(CLIENT_MESSAGE.chatSend, { text: 'oi' });
      await expect(
        unconfirmed.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'email-not-verified' });

      const cal = await signedIn('cal');
      cal.room.send(CLIENT_MESSAGE.chatSend, { text: '   ' });
      await expect(
        cal.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'bad-message' });
      cal.room.send(CLIENT_MESSAGE.chatSend, { text: 'um' });
      await cal.next<ChatMessage>(SERVER_MESSAGE.chat);
      cal.room.send(CLIENT_MESSAGE.chatSend, { text: 'dois' });
      await expect(
        cal.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'chat-slow-down' });
    });

    it('passes reactions from anyone, only the offered ones, and never keeps them', async () => {
      const watcher = await connect();
      const anonymous = await connect();

      anonymous.room.send(CLIENT_MESSAGE.react, { emoji: '🍕' });
      anonymous.room.send(CLIENT_MESSAGE.react, { emoji: '🔥' });

      await expect(
        watcher.next<{ emoji: string }>(SERVER_MESSAGE.reaction),
      ).resolves.toEqual({ emoji: '🔥' });
      const late = await connect();
      await expect(
        late.next<ChatMessage[]>(SERVER_MESSAGE.chatHistory),
      ).resolves.toEqual([]);
    });

    it('lets an admin remove a message and silence an account; nobody else', async () => {
      const lead = await signedIn('lead', true, 'admin');
      const troll = await signedIn('troll', true, 'admin');
      troll.room.send(CLIENT_MESSAGE.chatSend, { text: 'spam' });
      const spam = await lead.next<ChatMessage>(SERVER_MESSAGE.chat);

      troll.room.send(CLIENT_MESSAGE.chatDelete, { id: spam.id });
      await expect(
        troll.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'forbidden' });
      troll.room.send(CLIENT_MESSAGE.chatMute, { accountId: 'lead' });
      await expect(
        troll.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'forbidden' });

      lead.room.send(CLIENT_MESSAGE.chatDelete, { id: spam.id });
      await expect(
        troll.next<{ ids: number[] }>(SERVER_MESSAGE.chatRemoved),
      ).resolves.toEqual({ ids: [spam.id] });

      await new Promise((r) => setTimeout(r, 2_100));
      troll.room.send(CLIENT_MESSAGE.chatSend, { text: 'more spam' });
      const more = await lead.next<ChatMessage>(SERVER_MESSAGE.chat);
      lead.room.send(CLIENT_MESSAGE.chatMute, { accountId: 'troll' });
      await expect(
        lead.next<{ ids: number[] }>(SERVER_MESSAGE.chatRemoved),
      ).resolves.toEqual({ ids: [more.id] });
      lead.room.send(CLIENT_MESSAGE.chatMute, { accountId: 'lead' });
      await expect(
        lead.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'bad-message' });

      await new Promise((r) => setTimeout(r, 2_100));
      troll.clear();
      troll.room.send(CLIENT_MESSAGE.chatSend, { text: 'still here' });
      await expect(
        troll.next<{ code: string }>(SERVER_MESSAGE.error),
      ).resolves.toEqual({ code: 'chat-muted' });
    }, 15_000);
  });

  describe('winner stays', () => {
    it('keeps the winner first in line for the next round, and says so in the chat', async () => {
      const kai = await signedIn('kai', true, 'champion');
      const lou = await signedIn('lou', true, 'champion');
      const max = await signedIn('max', true, 'champion');
      kai.room.send(CLIENT_MESSAGE.joinQueue, {});
      lou.room.send(CLIENT_MESSAGE.joinQueue, {});
      await kai.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'playing',
      );
      max.room.send(CLIENT_MESSAGE.joinQueue, {});
      await kai.next<LobbySnapshot>(SERVER_MESSAGE.lobby, (l) =>
        l.queue.some((s) => s.id === 'max'),
      );

      const game = localRoom(kai).game as GameState;
      const victim = game.players.find((p) => p.id === 'lou');
      if (!victim) throw new Error('no lou');
      victim.alive = false;
      victim.diedAtTick = game.tick;

      await expect(
        max.next<ChatMessage>(SERVER_MESSAGE.chat),
      ).resolves.toMatchObject({
        event: { type: 'champion-stays', name: 'KAI', streak: 1 },
      });
      const results = await kai.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'results',
      );
      expect(results.champion).toEqual({ id: 'kai', streak: 1 });
      const next = await kai.next<LobbySnapshot>(
        SERVER_MESSAGE.lobby,
        (l) => l.phase === 'countdown',
      );
      expect(next.queue.map((s) => s.id)).toEqual(['kai', 'max', 'lou']);
    }, 15_000);

    it('ranks the round best first and words the outcome for the chat', () => {
      const game = {
        winnerId: 'w',
        players: [
          { id: 'early', alive: false, diedAtTick: 10 },
          { id: 'w', alive: true, diedAtTick: null },
          { id: 'late', alive: false, diedAtTick: 90 },
          { id: 'standing', alive: true, diedAtTick: null },
        ],
      } as unknown as GameState;
      expect(standings(game)).toEqual(['w', 'standing', 'late', 'early']);

      const stays = { winnerId: 'w', streak: 2, stays: true };
      expect(chatOutcome('W', stays, true)).toEqual({
        type: 'champion-stays',
        name: 'W',
        streak: 2,
      });
      expect(chatOutcome('W', { ...stays, stays: false }, true)).toEqual({
        type: 'champion-limit',
        name: 'W',
        streak: 2,
      });
      expect(chatOutcome('W', stays, false)).toEqual({
        type: 'round-won',
        name: 'W',
      });
      expect(chatOutcome(undefined, null, true)).toEqual({
        type: 'round-draw',
      });
    });
  });
});
