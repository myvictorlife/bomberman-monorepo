import { TestBed } from '@angular/core/testing';
import { createGame } from '@libs/game-core';
import {
  CHAT_HISTORY,
  ChatMessage,
  CLIENT_MESSAGE,
  FrameMessage,
  LobbySnapshot,
  PUBLIC_ROOM_RULES,
  SERVER_MESSAGE,
} from '@libs/game-protocol';
import { ARENA_CONNECTOR } from '../services/online.tokens';
import { FakeConnection } from '../testing/fake-connection';
import { OnlineStore, REACTION_MS } from './online.store';

const lobby = (over: Partial<LobbySnapshot> = {}): LobbySnapshot => ({
  phase: 'waiting',
  queue: [],
  players: [],
  countdownEndsAt: null,
  resultsEndsAt: null,
  winnerId: null,
  now: Date.now() + 2_000,
  rules: PUBLIC_ROOM_RULES,
  watchers: { names: [], anonymous: 0 },
  ...over,
});

describe('OnlineStore', () => {
  let connections: FakeConnection[];
  let connector: ReturnType<typeof vi.fn>;

  const setup = () => {
    connections = [];
    connector = vi.fn(async () => {
      const c = new FakeConnection();
      connections.push(c);
      return c;
    });
    TestBed.configureTestingModule({
      providers: [
        OnlineStore,
        { provide: ARENA_CONNECTOR, useValue: connector },
      ],
    });
    return TestBed.inject(OnlineStore);
  };

  it('starts idle and empty', () => {
    const store = setup();

    expect(store.status()).toBe('idle');
    expect(store.phase()).toBe('waiting');
    expect(store.queue()).toEqual([]);
    expect(store.players()).toEqual([]);
  });

  it('says so when the build has no server', () => {
    const store = setup();
    store.markUnavailable();

    expect(store.status()).toBe('unavailable');
  });

  it('connects and mirrors the lobby, ranking, profile and errors', async () => {
    const store = setup();
    const pending = store.connect('http://server');
    expect(store.status()).toBe('connecting');
    await pending;

    const c = connections[0] as FakeConnection;
    expect(connector).toHaveBeenCalledWith('http://server');
    expect(store.status()).toBe('online');

    c.push(
      SERVER_MESSAGE.lobby,
      lobby({
        phase: 'countdown',
        queue: [{ id: 'a', name: 'A', characterId: 'byte' }],
      }),
    );
    c.push(SERVER_MESSAGE.ranking, [
      { id: 'a', name: 'A', wins: 2, matches: 3 },
    ]);
    c.push(SERVER_MESSAGE.profile, {
      id: 'a',
      name: 'A',
      wins: 2,
      matches: 3,
      visits: 2,
      firstSeenAt: 0,
      lastSeenAt: 0,
      returning: true,
      rank: 1,
    });
    c.push(SERVER_MESSAGE.error, { code: 'already-queued' });

    expect(store.phase()).toBe('countdown');
    expect(store.queue()).toHaveLength(1);
    expect(store.clockOffset()).toBeGreaterThan(1_000);
    expect(store.ranking()[0]?.wins).toBe(2);
    expect(store.profile()?.returning).toBe(true);
    expect(store.serverError()).toBe('already-queued');
  });

  it('exposes the watchers and keeps the arena HUD', async () => {
    const store = setup();
    expect(store.watchers()).toEqual({ names: [], anonymous: 0 });
    await store.connect('http://server');

    connections[0]?.push(
      SERVER_MESSAGE.lobby,
      lobby({ watchers: { names: ['Bia'], anonymous: 3 } }),
    );
    store.applyHud({
      phase: 'playing',
      winnerId: null,
      players: [],
      secondsLeft: 180,
      closing: false,
    });

    expect(store.watchers()).toEqual({ names: ['Bia'], anonymous: 3 });
    expect(store.hud()?.phase).toBe('playing');
    store.applyHud(null);
    expect(store.hud()).toBeNull();
  });

  it('forwards frames to subscribers without storing them', async () => {
    const store = setup();
    await store.connect('http://server');
    const frames: FrameMessage[] = [];
    const stop = store.onFrame((f) => frames.push(f));
    const frame = {
      round: 1,
      state: createGame({ seed: 1, players: [{ id: 'a', name: 'A' }] }),
      events: [],
    };

    connections[0]?.push(SERVER_MESSAGE.frame, frame);
    stop();
    connections[0]?.push(SERVER_MESSAGE.frame, frame);

    expect(frames).toEqual([frame]);
  });

  it('sends hello, queue and input messages', async () => {
    const store = setup();
    await store.connect('http://server');
    store.hello('tok');
    store.joinQueue('lia');
    store.leaveQueue();
    store.sendInput({ direction: 'up' });
    store.signOut();

    expect(connections[0]?.sent).toEqual([
      { type: CLIENT_MESSAGE.hello, payload: { token: 'tok' } },
      { type: CLIENT_MESSAGE.joinQueue, payload: { characterId: 'lia' } },
      { type: CLIENT_MESSAGE.leaveQueue, payload: undefined },
      { type: CLIENT_MESSAGE.input, payload: { direction: 'up' } },
      { type: CLIENT_MESSAGE.signOut, payload: undefined },
    ]);
  });

  it('plays as a guest: sends the name and the kept token, and takes the identity', async () => {
    const store = setup();
    await store.connect('http://server');
    store.playAsGuest('Visita');
    store.playAsGuest('Visita', 'tok-1234567890abcdef');
    expect(connections[0]?.sent).toEqual([
      { type: CLIENT_MESSAGE.guest, payload: { name: 'Visita' } },
      {
        type: CLIENT_MESSAGE.guest,
        payload: { name: 'Visita', token: 'tok-1234567890abcdef' },
      },
    ]);

    const identity = { id: 'guest:1', name: 'Visita', token: 't' };
    connections[0]?.push(SERVER_MESSAGE.guest, identity);
    expect(store.guest()).toEqual(identity);
    store.forgetGuest();
    expect(store.guest()).toBeNull();

    // A fresh connection is nobody until it says so again.
    connections[0]?.push(SERVER_MESSAGE.guest, identity);
    await store.reconnect();
    expect(store.guest()).toBeNull();
  });

  it('goes offline when the socket drops, and comes back on reconnect', async () => {
    const store = setup();
    await store.connect('http://server');
    connections[0]?.close();
    expect(store.status()).toBe('offline');

    await store.reconnect();
    expect(store.status()).toBe('online');
    expect(connections).toHaveLength(2);
  });

  it('ignores the close of a connection it already replaced', async () => {
    const store = setup();
    await store.connect('http://server');
    await store.reconnect();

    connections[0]?.close();

    expect(connections[0]?.left).toBe(true);
    expect(store.status()).toBe('online');
  });

  it('goes offline when the server cannot be reached', async () => {
    const store = setup();
    connector.mockRejectedValueOnce(new Error('refused'));

    await store.connect('http://server');

    expect(store.status()).toBe('offline');
  });

  it('does nothing on reconnect before a first connect, and sends nothing while disconnected', async () => {
    const store = setup();
    await store.reconnect();
    store.hello('tok');

    expect(connector).not.toHaveBeenCalled();
    expect(store.status()).toBe('idle');
  });

  it('leaves the room when the route is left', async () => {
    const store = setup();
    await store.connect('http://server');

    TestBed.resetTestingModule();

    expect(connections[0]?.left).toBe(true);
  });

  it('learns whether the account is an admin, forgets it on reconnect, and sends rule changes', async () => {
    const store = setup();
    await store.connect('ws://x');
    const connection = connections[0] as FakeConnection;

    expect(store.admin()).toBe(false);
    expect(store.rules()).toEqual(PUBLIC_ROOM_RULES);
    expect(store.nextRules()).toBeNull();
    connection.push(SERVER_MESSAGE.admin, { admin: true });
    expect(store.admin()).toBe(true);
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ nextRules: { ...PUBLIC_ROOM_RULES, outsiders: 0 } }),
    );
    expect(store.nextRules()?.outsiders).toBe(0);

    store.setRules({ outsiders: 0 });
    expect(connection.sent.at(-1)).toEqual({
      type: CLIENT_MESSAGE.setRules,
      payload: { rules: { outsiders: 0 } },
    });

    await store.reconnect();
    expect(store.admin()).toBe(false);
  });

  describe('chat', () => {
    const line = (id: number, text = `m${id}`): ChatMessage => ({
      id,
      at: 0,
      author: { id: 'ana', name: 'Ana', role: 'watching' },
      text,
    });

    const online = async () => {
      const store = setup();
      await store.connect('http://server');
      return { store, c: connections[0] as FakeConnection };
    };

    it('takes the backlog, appends new lines up to the cap, and drops removed ones', async () => {
      const { store, c } = await online();

      c.push(SERVER_MESSAGE.chatHistory, [line(1), line(2)]);
      c.push(SERVER_MESSAGE.chat, line(3));
      expect(store.chat().map((m) => m.id)).toEqual([1, 2, 3]);

      c.push(SERVER_MESSAGE.chatRemoved, { ids: [2] });
      expect(store.chat().map((m) => m.id)).toEqual([1, 3]);

      for (let id = 4; id < CHAT_HISTORY + 10; id++)
        c.push(SERVER_MESSAGE.chat, line(id));
      expect(store.chat()).toHaveLength(CHAT_HISTORY);
      expect(store.chat().at(-1)?.id).toBe(CHAT_HISTORY + 9);
    });

    it('sends lines, reactions and admin actions', async () => {
      const { store, c } = await online();

      store.sendChat('oi');
      store.react('🔥');
      store.deleteChat(3);
      store.muteChat('troll');

      expect(c.sent).toEqual([
        { type: CLIENT_MESSAGE.chatSend, payload: { text: 'oi' } },
        { type: CLIENT_MESSAGE.react, payload: { emoji: '🔥' } },
        { type: CLIENT_MESSAGE.chatDelete, payload: { id: 3 } },
        { type: CLIENT_MESSAGE.chatMute, payload: { accountId: 'troll' } },
      ]);
    });

    it("keeps chat refusals apart from the queue's errors, and clears them on the next send", async () => {
      const { store, c } = await online();

      c.push(SERVER_MESSAGE.error, { code: 'chat-slow-down' });
      expect(store.chatError()).toBe('chat-slow-down');
      expect(store.serverError()).toBeNull();

      store.sendChat('again');
      expect(store.chatError()).toBeNull();
    });

    it('floats a reaction for a moment, then lets it go', async () => {
      vi.useFakeTimers();
      try {
        const { store, c } = await online();

        c.push(SERVER_MESSAGE.reaction, { emoji: '👏' });
        expect(store.reactions()).toEqual([
          { key: 1, emoji: '👏', x: expect.any(Number) },
        ]);

        vi.advanceTimersByTime(REACTION_MS);
        expect(store.reactions()).toEqual([]);

        c.push(SERVER_MESSAGE.reaction, { emoji: '🔥' });
        TestBed.resetTestingModule();
        vi.advanceTimersByTime(REACTION_MS);
      } finally {
        vi.useRealTimers();
      }
    });

    it('forgets the conversation on a fresh connection: the server sends it again', async () => {
      const { store, c } = await online();
      c.push(SERVER_MESSAGE.chat, line(1));

      await store.reconnect();

      expect(store.chat()).toEqual([]);
    });
  });
});
