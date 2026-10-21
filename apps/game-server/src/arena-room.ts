import { AuthContext, Client, CloseCode, Delayed, Room } from '@colyseus/core';
import { BotDirector, BotLevel } from '@libs/game-ai';
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
  isBotId,
  Lobby,
  nameKey,
  PlayerRecord,
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
  countsForRanking,
  FRAME_EVERY_TICKS,
  FrameMessage,
  GUEST_ID_PREFIX,
  GuestIdentity,
  InputMessage,
  parseChatDelete,
  parseChatMute,
  parseChatText,
  parseGuest,
  parseHello,
  parseInput,
  parseJoinQueue,
  parseLeaveAfterRound,
  parseReaction,
  parseRules,
  RECONNECT_GRACE_MS,
  RoomRules,
  SERVER_MESSAGE,
  ServerErrorCode,
  Watchers,
} from '@libs/game-protocol';
import { randomUUID } from 'node:crypto';
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

/** How well the room's bots play: a notch under `/play`'s medium, so people stand a chance. */
const BOT_LEVEL: BotLevel = 'casual';

/**
 * How many guests from one address may hold a place — queued or playing — at
 * once. More than one, since a family shares a connection; few, so one person
 * opening tabs cannot fill the line.
 */
export const GUESTS_PER_ADDRESS = 3;

/** A guest as the room knows them: who they play as, and where they connect from. */
interface Guest extends GuestIdentity {
  address: string;
}

/**
 * Where a connection comes from: behind Cloudflare, the visitor's address
 * (`CF-Connecting-IP`); otherwise what Colyseus resolved from the proxy
 * headers or the socket. Only guests are limited by it, and only softly.
 */
export function clientAddress(
  context: Pick<AuthContext, 'ip' | 'headers'>,
): string {
  return context.headers.get('cf-connecting-ip') ?? context.ip ?? 'unknown';
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
  /** How long clients get the restart notice before they are let go. */
  const RESTART_NOTICE_MS = 300;
  /** The one instance: it never disposes itself, so a second would only pile up. */
  let liveId: string | null = null;

  return class ArenaRoom extends Room {
    override maxClients = 500;
    /** The public room outlives its last visitor. */
    override autoDispose = false;
    /** A client cannot flood the room; inputs only go out when something changes. */
    override maxMessagesPerSecond = 120;

    readonly lobby = new Lobby(deps.rules, random);
    /** In memory only: a restart forgets the conversation and who was silenced. */
    readonly chat = new Chat();
    /** Signed-in account per connection. */
    readonly accounts = new Map<string, VerifiedAccount>();
    /** Guest per connection: plays under a name, never in the ranking or the chat. */
    readonly guests = new Map<string, Guest>();
    /** Guests by their token, kept while they hold a place, so a reload gets the same guest back. */
    private readonly guestTokens = new Map<string, Guest>();
    game: GameState | null = null;
    /** Plays the round's bots; `null` in a round of people only. */
    private bots: BotDirector | null = null;
    private readonly heldInputs = new Map<string, HeldInput>();
    /** When each person in the round last sent an input — the idle rule's clock. */
    private readonly lastInputAt = new Map<string, number>();
    /** Players whose last connection dropped, waiting to come back before they lose their place. */
    private readonly leaving = new Map<string, Delayed>();
    private pendingEvents: GameEvent[] = [];
    private unwatchProfiles: (() => void) | null = null;
    private ticksSinceFrame = 0;
    private lastLobby = '';
    /** Counts the rounds, so a client can tell a new one from a changed one. */
    private round = 0;

    override onCreate(): void {
      if (liveId) throw new Error('The public room already exists.');
      liveId = this.roomId;
      this.patchRate = null;
      this.unwatchProfiles = deps.records.watchProfiles((record) =>
        this.profileChanged(record),
      );

      this.onMessage(
        CLIENT_MESSAGE.hello,
        (client, message) => void this.hello(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.signOut, (client) => this.signOut(client));
      this.onMessage(CLIENT_MESSAGE.guest, (client, message) =>
        this.guest(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.joinQueue, (client, message) =>
        this.joinQueue(client, message),
      );
      this.onMessage(CLIENT_MESSAGE.leaveQueue, (client) =>
        this.leaveQueue(client),
      );
      this.onMessage(CLIENT_MESSAGE.leaveAfterRound, (client, message) =>
        this.leaveAfterRound(client, message),
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

      // A type this server does not know — a newer page talking to an older
      // server — is refused, not punished: Colyseus would otherwise drop the
      // connection in production, mid-round.
      this.onMessage('*', (client) => this.fail(client, 'bad-message'));

      this.setSimulationInterval(() => this.step(), 1000 / TICK_RATE);
      this.clock.setInterval(() => this.refreshLobby(), LOBBY_CHECK_MS);
    }

    /** Notes where the connection comes from; anyone may connect. */
    override onAuth(
      _client: Client,
      _options: unknown,
      context: AuthContext,
    ): { address: string } {
      return { address: clientAddress(context) };
    }

    override onJoin(client: Client): void {
      this.welcome(client);
      // Everyone else sees one more viewer.
      this.refreshLobby();
    }

    /** Everything a connection needs to draw the room: on arrival, and again when a dropped one is back. */
    private welcome(client: Client): void {
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
    }

    override async onLeave(client: Client, code?: number): Promise<void> {
      const account = this.player(client);
      // Colyseus hands the socket's close code: 4000 is a leave the client
      // asked for (`room.leave()`); anything else is a drop.
      const consented = code === CloseCode.CONSENTED;
      // Dropped rather than left — a phone in a pocket, a change of network,
      // this server restarting — and a player, not a watcher: hold the session
      // itself for the grace. The client comes back on it by token and keeps
      // identity, queue spot or seat, no hello needed. (While it waits, the
      // seat counts toward `maxClients`.)
      if (!consented && account && !this.hasSession(account.id, client)) {
        this.heldInputs.delete(account.id);
        this.refreshLobby();
        try {
          // Resolves with the new socket, on the same session.
          const back = await this.allowReconnection(client, graceMs / 1_000);
          // Its page starts blank: everything again, as on arrival.
          this.welcome(back);
          this.refreshLobby();
          return;
        } catch {
          // The grace ran out: gone for good, like a consented leave below.
        }
      }
      this.accounts.delete(client.sessionId);
      this.guests.delete(client.sessionId);
      this.chat.forget(client.sessionId);
      // One viewer fewer, whatever happens to the place.
      this.refreshLobby();
      // Another tab of the same account keeps the place. Otherwise the place is
      // held for a grace period: a reload reconnects and carries on.
      if (!account || this.hasSession(account.id)) return;
      if (!consented) {
        // The grace was already spent waiting for the socket.
        if (
          !this.lobby.isQueued(account.id) &&
          !this.lobby.isPlaying(account.id)
        )
          return this.forgetGuest(account.id);
        return this.drop(account.id);
      }
      if (!this.lobby.isQueued(account.id) && !this.lobby.isPlaying(account.id))
        return this.forgetGuest(account.id);
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
      const account = this.player(client);
      if (!account) return;
      this.accounts.delete(client.sessionId);
      this.guests.delete(client.sessionId);
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
      this.forgetGuest(accountId);
      this.refreshLobby();
    }

    /**
     * Play without an account: the room hands out a guest id and a token. The
     * token of an earlier answer gets the same guest back — and their place,
     * within the reconnect grace. The name may be no account's and no other
     * guest's, so nobody plays as someone on the ranking.
     */
    guest(client: Client, message: unknown): void {
      if (this.accounts.has(client.sessionId))
        return this.fail(client, 'bad-message');
      const request = parseGuest(message);
      if (!request) return this.fail(client, 'bad-message');
      const known = request.token
        ? this.guestTokens.get(request.token)
        : undefined;
      if (this.nameTaken(request.name, known?.id))
        return this.fail(client, 'name-taken');

      const address =
        (client.auth as { address?: string } | undefined)?.address ?? 'unknown';
      // A seat already in the queue or the round keeps the name it was taken with.
      const guest: Guest = known
        ? Object.assign(known, { name: request.name, address })
        : {
            id: `${GUEST_ID_PREFIX}${randomUUID()}`,
            name: request.name,
            token: randomUUID(),
            address,
          };
      this.guestTokens.set(guest.token, guest);
      this.leaving.get(guest.id)?.clear();
      this.leaving.delete(guest.id);

      const previous = this.guests.get(client.sessionId);
      this.guests.set(client.sessionId, guest);
      if (previous && previous.id !== guest.id && !this.hasSession(previous.id))
        this.drop(previous.id);
      const { id, name, token } = guest;
      client.send(SERVER_MESSAGE.guest, { id, name, token });
      this.refreshLobby();
    }

    /**
     * The process is going down for a restart. Everyone hears it first, so
     * their client waits a moment and reconnects instead of treating the drop
     * as a failure; then they are let go.
     */
    override onBeforeShutdown(): void {
      this.broadcast(SERVER_MESSAGE.restarting, { inMs: RESTART_NOTICE_MS });
      setTimeout(() => void this.disconnect(), RESTART_NOTICE_MS);
    }

    override onDispose(): void {
      if (liveId === this.roomId) liveId = null;
      this.unwatchProfiles?.();
      deps.records.flush();
    }

    /**
     * A player changed their profile from the profile page (`PUT /me`): their
     * connections take the new name, and everyone gets the ranking again.
     * A seat already in the queue or the round keeps the name it was taken with.
     */
    profileChanged(record: PlayerRecord): void {
      for (const [sessionId, account] of this.accounts) {
        if (account.id === record.id)
          this.accounts.set(sessionId, { ...account, name: record.name });
      }
      const all = deps.records.all().values();
      this.broadcast(SERVER_MESSAGE.ranking, ranking(all, RANKING_SIZE));
      for (const client of this.clients) {
        if (this.accounts.get(client.sessionId)?.id !== record.id) continue;
        client.send(
          SERVER_MESSAGE.profile,
          toProfile(record, deps.records.all().values()),
        );
      }
      this.refreshLobby();
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
      // Signing in ends playing as a guest on this connection.
      const guest = this.guests.get(client.sessionId);
      if (guest) {
        this.guests.delete(client.sessionId);
        if (!this.hasSession(guest.id)) this.drop(guest.id);
      }
      // Back within the grace period: the place — character or queue spot — is still theirs.
      this.leaving.get(account.id)?.clear();
      this.leaving.delete(account.id);

      const record = recordVisit(deps.records.get(account.id), account, now());
      deps.records.put(record);
      // The name everyone sees is the record's: one the player chose wins over the account's.
      this.accounts.set(client.sessionId, { ...account, name: record.name });
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
      const guest = account ? undefined : this.guests.get(client.sessionId);
      const player = account ?? guest;
      if (!player) return this.fail(client, 'auth-required');
      if (account && !account.emailVerified)
        return this.fail(client, 'email-not-verified');
      if (guest && this.placesHeldFrom(guest) >= GUESTS_PER_ADDRESS)
        return this.fail(client, 'guest-limit');

      const { characterId } = parseJoinQueue(message);
      // The colour is the profile's, never the message's: it is the server's record.
      const color = account && deps.records.get(account.id)?.color;
      const result = this.lobby.join({
        id: player.id,
        name: player.name,
        characterId,
        ...(color ? { color } : {}),
      });
      if (result !== 'queued') return this.fail(client, result);
      this.refreshLobby();
    }

    leaveQueue(client: Client): void {
      const account = this.player(client);
      // Walking out of a round in progress is not a queue action.
      if (!account || this.lobby.isPlaying(account.id)) return;
      this.lobby.leave(account.id);
      this.refreshLobby();
    }

    /** A player of the round plays it out, then is not put back in line. */
    leaveAfterRound(client: Client, message: unknown): void {
      const account = this.player(client);
      if (!account) return this.fail(client, 'auth-required');
      const { leave } = parseLeaveAfterRound(message);
      if (this.lobby.leaveAfterRound(account.id, leave)) this.refreshLobby();
    }

    input(client: Client, message: unknown): void {
      const account = this.player(client);
      const input = parseInput(message);
      if (!account || !input || !this.game) return;
      if (
        !this.lobby.isPlaying(account.id) &&
        !this.lobby.isOutsider(account.id)
      )
        return;

      this.lastInputAt.set(account.id, now());
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
      this.kickIdle(game);

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

      if (this.bots) Object.assign(inputs, this.bots.inputs(game));

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

    /**
     * The idle rule: a person in the round who has sent nothing for
     * `rules.idleMs` is out of it — eliminated, so the others can finish —
     * and out of the line, told why. Bots are never idle.
     */
    private kickIdle(game: GameState): void {
      const limit = this.lobby.rules.idleMs;
      if (!limit) return;
      const at = now();
      for (const player of game.players) {
        if (!player.alive || isBotId(player.id)) continue;
        if (!this.lobby.isPlaying(player.id)) continue;
        const last = this.lastInputAt.get(player.id);
        if (last === undefined || at - last < limit) continue;
        this.lastInputAt.delete(player.id);
        this.lobby.leave(player.id);
        this.heldInputs.delete(player.id);
        const event = eliminatePlayer(game, player.id);
        if (event) this.pendingEvents.push(event);
        this.announce({ type: 'idle-out', name: player.name });
        for (const client of this.clients)
          if (this.player(client)?.id === player.id) this.fail(client, 'idle');
        this.forgetGuest(player.id);
        this.refreshLobby();
      }
    }

    refreshLobby(): void {
      const start = this.lobby.update(now(), this.clients.length > 0);
      // The lobby ended a round of bots alone for people who queued: stop playing it.
      if (
        !start &&
        this.game?.phase === 'playing' &&
        this.lobby.phase !== 'playing'
      ) {
        this.game = null;
        this.bots = null;
        this.heldInputs.clear();
        this.pendingEvents = [];
      }
      if (start) {
        this.round++;
        const rules = this.lobby.rules;
        const seed = Math.floor(random() * 2 ** 31) + 1;
        const bots = start.players.filter((s) => s.bot);
        this.bots = bots.length
          ? new BotDirector(
              bots.map((s) => ({ id: s.id, level: BOT_LEVEL })),
              seed,
            )
          : null;
        // The idle clock starts for every person at the round's start.
        this.lastInputAt.clear();
        const startedAt = now();
        for (const seat of start.players)
          if (!seat.bot) this.lastInputAt.set(seat.id, startedAt);
        this.game = createGame({
          seed,
          mapId: MAPS[Math.floor(random() * MAPS.length)]?.id,
          players: start.players.map(({ id, name, characterId, color }) => ({
            id,
            name,
            characterId,
            color,
          })),
          roundTicks:
            rules.roundTimerMs > 0
              ? Math.round((rules.roundTimerMs / 1000) * TICK_RATE)
              : null,
          closingWalls: rules.closingWalls,
          dropItems: rules.dropItems,
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
          // People only: the title screen's pill says who is here to play.
          playing: this.lobby.people().length,
          queued: snapshot.queue.length,
          online: this.clients.length,
        });
      }
    }

    private endRound(game: GameState): void {
      // Bots and guests have no record, so only accounts are counted, and only
      // in a round with enough of them.
      const people = this.lobby.people();
      const ids = people.map((s) => s.id);
      if (countsForRanking(people)) {
        const updated = recordRound(
          deps.records.all(),
          ids,
          game.winnerId,
          now(),
          new Map(game.players.map((p) => [p.id, p.characterId])),
        );
        deps.records.put(...updated);
      }
      const outcome = this.lobby.finishRound(
        game.winnerId,
        now(),
        standings(game),
      );
      const winner = game.players.find((p) => p.id === game.winnerId);
      const keepsSeat =
        this.lobby.rules.winnerStays > 0 && !isBotId(game.winnerId ?? '');
      this.announce(chatOutcome(winner?.name, outcome, keepsSeat));

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
        const account = this.player(client);
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

    /** Whether the account (or guest) is on any connection — other than `except`, when given. */
    private hasSession(accountId: string, except?: Client): boolean {
      const other = (sessionId: string) =>
        !except || sessionId !== except.sessionId;
      for (const [sessionId, a] of this.accounts)
        if (a.id === accountId && other(sessionId)) return true;
      for (const [sessionId, g] of this.guests)
        if (g.id === accountId && other(sessionId)) return true;
      return false;
    }

    /** Who plays on this connection: the signed-in account, or the guest. */
    private player(client: Client): { id: string; name: string } | null {
      return (
        this.accounts.get(client.sessionId) ??
        this.guests.get(client.sessionId) ??
        null
      );
    }

    private nameTaken(name: string, exceptId?: string): boolean {
      const key = nameKey(name);
      for (const record of deps.records.all().values())
        if (nameKey(record.name) === key) return true;
      for (const guest of this.guestTokens.values())
        if (guest.id !== exceptId && nameKey(guest.name) === key) return true;
      return false;
    }

    /** Other guests from the same address with a place in the queue or the round. */
    private placesHeldFrom(guest: Guest): number {
      let held = 0;
      for (const other of this.guestTokens.values()) {
        if (other.id === guest.id || other.address !== guest.address) continue;
        if (this.lobby.isQueued(other.id) || this.lobby.isPlaying(other.id))
          held++;
      }
      return held;
    }

    /** A guest with no place left and no connection is forgotten, token and all. */
    private forgetGuest(id: string): void {
      for (const [token, guest] of this.guestTokens)
        if (guest.id === id) this.guestTokens.delete(token);
    }

    private fail(client: Client, code: ServerErrorCode): void {
      client.send(SERVER_MESSAGE.error, { code });
    }
  };
}
