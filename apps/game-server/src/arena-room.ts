import { Client, Delayed, Room } from '@colyseus/core';
import {
  addOutsider,
  createGame,
  eliminatePlayer,
  GameEvent,
  GameState,
  MAPS,
  PlayerInput,
  removeOutsider,
  tick,
  TICK_RATE,
} from '@libs/game-core';
import {
  Chat,
  Lobby,
  ranking,
  recordRound,
  recordVisit,
  RoundOutcome,
  toProfile,
} from '@libs/game-lobby';
import {
  ChatEvent,
  ChatRole,
  CLIENT_MESSAGE,
  FRAME_EVERY_TICKS,
  FrameMessage,
  InputMessage,
  parseChatDelete,
  parseChatMute,
  parseChatText,
  parseHello,
  parseInput,
  parseJoinQueue,
  parseReaction,
  parseRules,
  RECONNECT_GRACE_MS,
  RoomRules,
  SERVER_MESSAGE,
  ServerErrorCode,
  Watchers,
} from '@libs/game-protocol';
import { TokenVerifier, VerifiedAccount } from './auth';
import { RecordsStore } from './records-store';

export interface ArenaRoomDeps {
  rules: RoomRules;
  /** `null` when the server has no Firebase project: everyone can watch, nobody can join. */
  verify: TokenVerifier | null;
  records: RecordsStore;
  /** E-mails (lower case) allowed to change the rules from the page. Nobody by default. */
  admins?: readonly string[];
  /** Called with the rules an admin set, so they survive a restart. */
  saveRules?: (rules: RoomRules) => void;
  now?: () => number;
  /** Picks the seed and the map of a new round. */
  random?: () => number;
  /** How long a dropped player keeps their place; see {@link RECONNECT_GRACE_MS}. */
  reconnectGraceMs?: number;
}

/**
 * The round's players, best first: the winner, then whoever is still
 * standing, then the last to fall.
 */
export function standings(game: GameState): string[] {
  const rank = (p: GameState['players'][number]) => {
    if (p.id === game.winnerId) return Infinity;
    return p.alive ? Number.MAX_SAFE_INTEGER : (p.diedAtTick ?? -1);
  };
  return [...game.players].sort((a, b) => rank(b) - rank(a)).map((p) => p.id);
}

/** What the chat says when a round ends, with the winner-stays rule in mind. */
export function chatOutcome(
  name: string | undefined,
  outcome: RoundOutcome | null,
  winnerStays: boolean,
): ChatEvent {
  if (!name || !outcome) return { type: 'round-draw' };
  if (!winnerStays) return { type: 'round-won', name };
  const type = outcome.stays ? 'champion-stays' : 'champion-limit';
  return { type, name, streak: outcome.streak };
}

/** How often the queue is re-checked for a countdown that ran out. */
const LOBBY_CHECK_MS = 250;
const RANKING_SIZE = 10;

interface HeldInput {
  direction: InputMessage['direction'];
  bomb: boolean;
  ability: boolean;
  detonate: boolean;
}

/**
 * The public room: anyone connected watches the round in progress; signed-in
 * players with a confirmed e-mail queue for the next one, and the first few in
 * line stand on the border throwing bombs in. The rules of the queue live in
 * {@link Lobby}; the rules of the game in `@libs/game-core`. This class is the
 * glue: sockets, clock, and who is who.
 *
 * Built by a factory because Colyseus instantiates rooms itself — the closure
 * is how the room receives its dependencies.
 */
export function createArenaRoom(deps: ArenaRoomDeps) {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const graceMs = deps.reconnectGraceMs ?? RECONNECT_GRACE_MS;

  return class ArenaRoom extends Room {
    override maxClients = 500;
    /** The public room outlives its last visitor. */
    override autoDispose = false;
    /** A client cannot flood the room; inputs only go out when something changes. */
    override maxMessagesPerSecond = 120;

    readonly lobby = new Lobby(deps.rules);
    /** In memory only: a restart forgets the conversation and who was silenced. */
    readonly chat = new Chat();
    /** Signed-in account per connection. */
    readonly accounts = new Map<string, VerifiedAccount>();
    game: GameState | null = null;
    private readonly heldInputs = new Map<string, HeldInput>();
    /** Players whose last connection dropped, waiting to come back before they lose their place. */
    private readonly leaving = new Map<string, Delayed>();
    private pendingEvents: GameEvent[] = [];
    private ticksSinceFrame = 0;
    private lastLobby = '';
    /** Counts the rounds, so a client can tell a new one from a changed one. */
    private round = 0;

    override onCreate(): void {
      this.patchRate = null;

      this.onMessage(
        CLIENT_MESSAGE.hello,
        (client, message) => void this.hello(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.signOut, (client) => this.signOut(client));
      this.onMessage(CLIENT_MESSAGE.joinQueue, (client, message) =>
        this.joinQueue(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.leaveQueue, (client) =>
        this.leaveQueue(client),
      );
      this.onMessage(CLIENT_MESSAGE.input, (client, message) =>
        this.input(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.setRules, (client, message) =>
        this.setRules(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.chatSend, (client, message) =>
        this.chatSend(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.react, (client, message) =>
        this.react(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.chatDelete, (client, message) =>
        this.chatDelete(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.chatMute, (client, message) =>
        this.chatMute(client, message),
      );

      this.setSimulationInterval(() => this.step(), 1000 / TICK_RATE);
      this.clock.setInterval(() => this.refreshLobby(), LOBBY_CHECK_MS);
    }

    override onJoin(client: Client): void {
      client.send(
        SERVER_MESSAGE.lobby,
        this.lobby.snapshot(now(), this.watchers()),
      );
      client.send(
        SERVER_MESSAGE.ranking,
        ranking(deps.records.all().values(), RANKING_SIZE),
      );
      if (this.game) client.send(SERVER_MESSAGE.frame, this.frame([]));
      client.send(SERVER_MESSAGE.chatHistory, this.chat.backlog(now()));
      // Everyone else sees one more viewer.
      this.refreshLobby();
    }

    override onLeave(client: Client): void {
      const account = this.accounts.get(client.sessionId);
      this.accounts.delete(client.sessionId);
      this.chat.forget(client.sessionId);
      // One viewer fewer, whatever happens to the place.
      this.refreshLobby();
      // Another tab of the same account keeps the place. Otherwise the place is
      // held for a grace period: a reload reconnects and carries on.
      if (!account || this.hasSession(account.id)) return;
      if (!this.lobby.isQueued(account.id) && !this.lobby.isPlaying(account.id))
        return;
      // Stand still while away, rather than keep walking into a flame.
      this.heldInputs.delete(account.id);
      this.leaving.get(account.id)?.clear();
      this.leaving.set(
        account.id,
        this.clock.setTimeout(() => this.drop(account.id), graceMs),
      );
    }

    /** Signing out on purpose gives the place up at once. */
    signOut(client: Client): void {
      const account = this.accounts.get(client.sessionId);
      if (!account) return;
      this.accounts.delete(client.sessionId);
      if (!this.hasSession(account.id)) this.drop(account.id);
      this.refreshLobby();
    }

    /**
     * The player is gone for good: out of the queue, and out of the round in
     * progress so the others can finish it — with two, the one left wins.
     */
    drop(accountId: string): void {
      this.leaving.get(accountId)?.clear();
      this.leaving.delete(accountId);
      if (this.hasSession(accountId)) return;
      const wasPlaying = this.lobby.isPlaying(accountId);
      this.lobby.leave(accountId);
      this.heldInputs.delete(accountId);
      const event =
        wasPlaying && this.game ? eliminatePlayer(this.game, accountId) : null;
      if (event) this.pendingEvents.push(event);
      this.refreshLobby();
    }

    override onDispose(): void {
      deps.records.flush();
    }

    async hello(client: Client, message: unknown): Promise<void> {
      const hello = parseHello(message);
      if (!hello) return this.fail(client, 'bad-message');
      if (!deps.verify) return this.fail(client, 'auth-required');

      let account: VerifiedAccount;
      try {
        account = await deps.verify(hello.token);
      } catch {
        return this.fail(client, 'invalid-token');
      }
      this.accounts.set(client.sessionId, account);
      // Back within the grace period: the place — character or queue spot — is still theirs.
      this.leaving.get(account.id)?.clear();
      this.leaving.delete(account.id);

      const record = recordVisit(deps.records.get(account.id), account, now());
      deps.records.put(record);
      this.refreshLobby();
      client.send(
        SERVER_MESSAGE.profile,
        toProfile(record, deps.records.all().values()),
      );
      client.send(SERVER_MESSAGE.admin, { admin: this.isAdmin(account) });
      if (!account.emailVerified) this.fail(client, 'email-not-verified');
    }

    /**
     * An admin changes the rules. Between rounds they apply at once; during a
     * round the lobby holds them for the next one, and everyone sees them
     * coming in the snapshot's `nextRules`.
     */
    setRules(client: Client, message: unknown): void {
      const account = this.accounts.get(client.sessionId);
      if (!account || !this.isAdmin(account))
        return this.fail(client, 'forbidden');
      const patch = (message as { rules?: unknown } | null)?.rules;
      const rules = parseRules(patch, this.lobby.nextRules ?? this.lobby.rules);
      if (!rules) return this.fail(client, 'bad-message');
      this.lobby.setRules(rules);
      deps.saveRules?.(rules);
      this.refreshLobby();
    }

    /** A signed-in account with a confirmed e-mail writes; everyone else only reads. */
    chatSend(client: Client, message: unknown): void {
      const account = this.accounts.get(client.sessionId);
      if (!account) return this.fail(client, 'auth-required');
      if (!account.emailVerified)
        return this.fail(client, 'email-not-verified');
      const text = parseChatText(message);
      if (!text) return this.fail(client, 'bad-message');
      const posted = this.chat.post(
        { id: account.id, name: account.name, role: this.roleOf(account.id) },
        text,
        now(),
      );
      if (typeof posted === 'string') return this.fail(client, posted);
      this.broadcast(SERVER_MESSAGE.chat, posted);
    }

    /** Anyone connected may react, signed in or not; over the limit it is dropped without a word. */
    react(client: Client, message: unknown): void {
      const emoji = parseReaction(message);
      const sender =
        this.accounts.get(client.sessionId)?.id ?? client.sessionId;
      if (!emoji || !this.chat.react(sender, now())) return;
      this.broadcast(SERVER_MESSAGE.reaction, { emoji });
    }

    chatDelete(client: Client, message: unknown): void {
      const account = this.accounts.get(client.sessionId);
      if (!account || !this.isAdmin(account))
        return this.fail(client, 'forbidden');
      const target = parseChatDelete(message);
      if (!target) return this.fail(client, 'bad-message');
      if (this.chat.remove(target.id))
        this.broadcast(SERVER_MESSAGE.chatRemoved, { ids: [target.id] });
    }

    chatMute(client: Client, message: unknown): void {
      const account = this.accounts.get(client.sessionId);
      if (!account || !this.isAdmin(account))
        return this.fail(client, 'forbidden');
      const target = parseChatMute(message);
      if (!target || target.accountId === account.id)
        return this.fail(client, 'bad-message');
      const ids = this.chat.mute(target.accountId);
      if (ids.length) this.broadcast(SERVER_MESSAGE.chatRemoved, { ids });
    }

    private announce(event: ChatEvent): void {
      this.broadcast(SERVER_MESSAGE.chat, this.chat.announce(event, now()));
    }

    private roleOf(accountId: string): ChatRole {
      if (this.lobby.isPlaying(accountId)) return 'playing';
      return this.lobby.isQueued(accountId) ? 'queued' : 'watching';
    }

    private isAdmin(account: VerifiedAccount): boolean {
      return (
        account.emailVerified &&
        (deps.admins ?? []).includes(account.email.toLowerCase())
      );
    }

    joinQueue(client: Client, message: unknown): void {
      const account = this.accounts.get(client.sessionId);
      if (!account) return this.fail(client, 'auth-required');
      if (!account.emailVerified)
        return this.fail(client, 'email-not-verified');

      const { characterId } = parseJoinQueue(message);
      const result = this.lobby.join({
        id: account.id,
        name: account.name,
        characterId,
      });
      if (result !== 'queued') return this.fail(client, result);
      this.refreshLobby();
    }

    leaveQueue(client: Client): void {
      const account = this.accounts.get(client.sessionId);
      // Walking out of a round in progress is not a queue action.
      if (!account || this.lobby.isPlaying(account.id)) return;
      this.lobby.leave(account.id);
      this.refreshLobby();
    }

    input(client: Client, message: unknown): void {
      const account = this.accounts.get(client.sessionId);
      const input = parseInput(message);
      if (!account || !input || !this.game) return;
      if (
        !this.lobby.isPlaying(account.id) &&
        !this.lobby.isOutsider(account.id)
      )
        return;

      const held = this.heldInputs.get(account.id) ?? {
        direction: null,
        bomb: false,
        ability: false,
        detonate: false,
      };
      // Presses are latched until the next tick, so one between two ticks is never lost.
      this.heldInputs.set(account.id, {
        direction: input.direction,
        bomb: held.bomb || Boolean(input.bomb),
        ability: held.ability || Boolean(input.ability),
        detonate: held.detonate || Boolean(input.detonate),
      });
    }

    step(): void {
      const game = this.game;
      if (!game || game.phase !== 'playing') return;

      const inputs: Record<string, PlayerInput> = {};
      for (const { id } of [...game.players, ...game.outsiders]) {
        const held = this.heldInputs.get(id);
        inputs[id] = {
          direction:
            this.lobby.isPlaying(id) || this.lobby.isOutsider(id)
              ? (held?.direction ?? null)
              : null,
          bomb: held?.bomb ?? false,
          ability: held?.ability ?? false,
          detonate: held?.detonate ?? false,
        };
        if (held)
          this.heldInputs.set(id, {
            ...held,
            bomb: false,
            ability: false,
            detonate: false,
          });
      }

      tick(game, inputs);
      this.pendingEvents.push(...game.events);
      for (const event of game.events) {
        // Someone got in from the border: the queue moved, and the next in line steps out.
        if (event.type !== 'outsider-entered') continue;
        const name = game.players.find((p) => p.id === event.playerId)?.name;
        if (name) this.announce({ type: 'outsider-entered', name });
        if (this.lobby.enterRound(event.playerId)) this.refreshLobby();
      }

      const over = (game.phase as GameState['phase']) === 'over';
      if (over || ++this.ticksSinceFrame >= FRAME_EVERY_TICKS) this.sendFrame();
      if (over) this.endRound(game);
    }

    refreshLobby(): void {
      const start = this.lobby.update(now());
      if (start) {
        this.round++;
        const rules = this.lobby.rules;
        this.game = createGame({
          seed: Math.floor(random() * 2 ** 31) + 1,
          mapId: MAPS[Math.floor(random() * MAPS.length)]?.id,
          players: start.players.map(({ id, name, characterId }) => ({
            id,
            name,
            characterId,
          })),
          roundTicks:
            rules.roundTimerMs > 0
              ? Math.round((rules.roundTimerMs / 1000) * TICK_RATE)
              : null,
          closingWalls: rules.closingWalls,
        });
        this.heldInputs.clear();
        this.pendingEvents = [];
      }
      if (this.syncOutsiders() || start) this.sendFrame();

      const snapshot = this.lobby.snapshot(now(), this.watchers());
      // `now` changes every call; only a real change goes out.
      const key = JSON.stringify({ ...snapshot, now: 0 });
      if (key !== this.lastLobby) {
        this.lastLobby = key;
        this.broadcast(SERVER_MESSAGE.lobby, snapshot);
        // The room's listing carries a summary, so `GET /status` answers without touching the room.
        void this.setMetadata({
          phase: snapshot.phase,
          playing: snapshot.players.length,
          queued: snapshot.queue.length,
          online: this.clients.length,
        });
      }
    }

    private endRound(game: GameState): void {
      const ids = game.players.map((p) => p.id);
      const updated = recordRound(
        deps.records.all(),
        ids,
        game.winnerId,
        now(),
        new Map(game.players.map((p) => [p.id, p.characterId])),
      );
      deps.records.put(...updated);
      const outcome = this.lobby.finishRound(
        game.winnerId,
        now(),
        standings(game),
      );
      const winner = game.players.find((p) => p.id === game.winnerId);
      this.announce(
        chatOutcome(winner?.name, outcome, this.lobby.rules.winnerStays > 0),
      );

      const all = deps.records.all().values();
      this.broadcast(SERVER_MESSAGE.ranking, ranking(all, RANKING_SIZE));
      for (const client of this.clients) {
        const account = this.accounts.get(client.sessionId);
        const record = account && deps.records.get(account.id);
        if (record && ids.includes(record.id)) {
          client.send(
            SERVER_MESSAGE.profile,
            toProfile(record, deps.records.all().values()),
          );
        }
      }
      this.refreshLobby();
    }

    /**
     * Keeps the border in step with the queue: whoever the lobby says is next
     * in line stands outside, nobody else. Returns whether anything changed.
     */
    private syncOutsiders(): boolean {
      const game = this.game;
      if (!game || game.phase !== 'playing') return false;
      const wanted = this.lobby.outsiders();
      let changed = false;
      for (const outsider of [...game.outsiders]) {
        if (wanted.some((s) => s.id === outsider.id)) continue;
        removeOutsider(game, outsider.id);
        this.heldInputs.delete(outsider.id);
        changed = true;
      }
      for (const seat of wanted) {
        if (
          addOutsider(game, {
            id: seat.id,
            name: seat.name,
            characterId: seat.characterId,
          })
        )
          changed = true;
      }
      return changed;
    }

    private frame(events: GameEvent[]): FrameMessage {
      return { round: this.round, state: this.game as GameState, events };
    }

    private sendFrame(): void {
      if (!this.game) return;
      this.broadcast(SERVER_MESSAGE.frame, this.frame(this.pendingEvents));
      this.pendingEvents = [];
      this.ticksSinceFrame = 0;
    }

    /** Connections that are neither in the round nor in the queue. */
    private watchers(): Watchers {
      const names = new Map<string, string>();
      let anonymous = 0;
      for (const client of this.clients) {
        const account = this.accounts.get(client.sessionId);
        if (!account) anonymous++;
        else if (
          !this.lobby.isPlaying(account.id) &&
          !this.lobby.isQueued(account.id)
        ) {
          names.set(account.id, account.name);
        }
      }
      return {
        names: [...names.values()].sort((a, b) => a.localeCompare(b)),
        anonymous,
      };
    }

    private hasSession(accountId: string): boolean {
      return [...this.accounts.values()].some((a) => a.id === accountId);
    }

    private fail(client: Client, code: ServerErrorCode): void {
      client.send(SERVER_MESSAGE.error, { code });
    }
  };
}
