import { computed, inject } from '@angular/core';
import { ArenaConnection, HudSnapshot } from '@libs/game-client';
import {
  AdminMessage,
  ARENA_ROOM,
  CHAT_HISTORY,
  ChatMessage,
  ChatRemovedMessage,
  CLIENT_MESSAGE,
  ErrorMessage,
  FrameMessage,
  GuestIdentity,
  InputMessage,
  LobbySnapshot,
  PlayerProfile,
  RankingEntry,
  Reaction,
  ReactionMessage,
  RestartingMessage,
  SERVER_MESSAGE,
  NO_WATCHERS,
  PUBLIC_ROOM_RULES,
  RoomRules,
  ServerErrorCode,
  serverOffset,
} from '@libs/game-protocol';
import { CampaignProgress, CharacterId, MapId } from '@libs/game-core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ARENA_CONNECTOR } from '../services/online.tokens';

/**
 * - `unavailable`: this build has no game server configured.
 * - `connecting` / `online` / `offline`: the socket to it.
 */
/** How long a reaction floats over the arena. */
export const REACTION_MS = 2_500;
/** Reactions on screen at once; past it the oldest go first. */
const MAX_FLOATING = 24;

/** A reaction on its way up the arena; `x` is where it rises, 0–100 across. */
export interface FloatingReaction {
  key: number;
  emoji: Reaction;
  x: number;
}

/** Chat refusals go next to the chat box, not next to the queue. */
const CHAT_ERRORS: readonly ServerErrorCode[] = [
  'chat-slow-down',
  'chat-muted',
];

export type ConnectionStatus =
  | 'idle'
  | 'unavailable'
  | 'connecting'
  | 'online'
  /** The socket dropped; the store is trying again on its own. */
  | 'reconnecting'
  | 'offline';

/** Reconnect delays: doubling from one second, capped, with a little jitter on top. */
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
/** After the server announced a restart: give it a moment to come back first. */
export const RESTART_RETRY_MS = 2_000;
/** sessionStorage key for the reconnection token, so a reload gets the same session back. */
export const SESSION_TOKEN_KEY = 'online.session';

/** The token's key for a room: each room its own, so a reload never lands in the other one. */
export function sessionTokenKey(roomName: string): string {
  return roomName === ARENA_ROOM
    ? SESSION_TOKEN_KEY
    : `${SESSION_TOKEN_KEY}.${roomName}`;
}

export function reconnectDelay(attempt: number, random = Math.random): number {
  const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  return Math.round(base * (0.85 + random() * 0.3));
}

export interface OnlineState {
  status: ConnectionStatus;
  /** How many times the store has tried to get back since the socket dropped; 0 once it is back. */
  reconnectAttempt: number;
  /** The server said it is restarting: the drop that follows is expected. */
  restarting: boolean;
  lobby: LobbySnapshot | null;
  ranking: RankingEntry[];
  /** What the server knows about the signed-in account; `null` until it answers. */
  profile: PlayerProfile | null;
  /** Who this connection plays as without an account; `null` until the server answers `guest`. */
  guest: GuestIdentity | null;
  serverError: ServerErrorCode | null;
  /** How far the server clock is ahead of this one, for the countdown. */
  clockOffset: number;
  /** What each player of the round on screen has picked up; from the arena, only when it changes. */
  hud: HudSnapshot | null;
  /** Whether the signed-in account may change the room's rules; the server says so after `hello`. */
  admin: boolean;
  /** The conversation, oldest first, never more than {@link CHAT_HISTORY}. */
  chat: ChatMessage[];
  chatError: ServerErrorCode | null;
  reactions: FloatingReaction[];
}

export const initialOnlineState: OnlineState = {
  status: 'idle',
  reconnectAttempt: 0,
  restarting: false,
  lobby: null,
  ranking: [],
  profile: null,
  guest: null,
  serverError: null,
  clockOffset: 0,
  hud: null,
  admin: false,
  chat: [],
  chatError: null,
  reactions: [],
};

/**
 * The online room as the page sees it: lobby, ranking, profile, connection.
 * Frames of the round (20 a second) deliberately bypass the state — they go
 * straight to the arena through {@link onFrame}, so Angular never re-renders
 * per frame. Provided on the route.
 */
export const OnlineStore = signalStore(
  withState(initialOnlineState),
  withComputed(({ lobby }) => ({
    phase: computed(() => lobby()?.phase ?? 'waiting'),
    queue: computed(() => lobby()?.queue ?? []),
    players: computed(() => lobby()?.players ?? []),
    watchers: computed(() => lobby()?.watchers ?? NO_WATCHERS),
    rules: computed((): RoomRules => lobby()?.rules ?? PUBLIC_ROOM_RULES),
    /** The stages room's stage, host and team progress; `null` in a versus room. */
    stage: computed(() => lobby()?.stage ?? null),
    /** Rules an admin set during the round, for the next one; `null` when nothing is pending. */
    nextRules: computed((): RoomRules | null => lobby()?.nextRules ?? null),
    /** The arena vote of the countdown under way; `null` when there is none. */
    vote: computed(() => lobby()?.vote ?? null),
  })),
  withMethods((store, connect = inject(ARENA_CONNECTOR)) => {
    let connection: ArenaConnection | null = null;
    let url: string | null = null;
    let roomName: string = ARENA_ROOM;
    /** Whether the page wants to be connected: drops are retried only while it does. */
    let wanted = false;
    /** The pending retry, between a drop and the next attempt. */
    let retry: ReturnType<typeof setTimeout> | null = null;
    const frameListeners = new Set<(frame: FrameMessage) => void>();
    let reactionKey = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const readToken = (): string | undefined => {
      try {
        return (
          globalThis.sessionStorage?.getItem(sessionTokenKey(roomName)) ??
          undefined
        );
      } catch {
        return undefined;
      }
    };
    const keepToken = (token: string | undefined): void => {
      try {
        if (token)
          globalThis.sessionStorage?.setItem(sessionTokenKey(roomName), token);
        else globalThis.sessionStorage?.removeItem(sessionTokenKey(roomName));
      } catch {
        // Storage off: a reload is a fresh session, which still works.
      }
    };
    const cancelRetry = (): void => {
      if (retry !== null) clearTimeout(retry);
      retry = null;
    };

    const float = (emoji: Reaction): void => {
      const key = ++reactionKey;
      const x = 10 + Math.random() * 80;
      patchState(store, {
        reactions: [...store.reactions(), { key, emoji, x }].slice(
          -MAX_FLOATING,
        ),
      });
      const timer = setTimeout(() => {
        timers.delete(timer);
        patchState(store, {
          reactions: store.reactions().filter((r) => r.key !== key),
        });
      }, REACTION_MS);
      timers.add(timer);
    };

    /**
     * The socket is gone and the page still wants it: try again after a
     * pause that doubles each time — at once if the page asks, sooner when
     * the server said it was restarting. Never gives up: the next attempt
     * is always scheduled.
     */
    const scheduleReconnect = (): void => {
      if (!wanted || retry !== null) return;
      const attempt = store.reconnectAttempt();
      const delay = store.restarting()
        ? RESTART_RETRY_MS
        : reconnectDelay(attempt);
      patchState(store, { status: 'reconnecting' });
      retry = setTimeout(() => {
        retry = null;
        patchState(store, { reconnectAttempt: attempt + 1 });
        void open();
      }, delay);
    };

    const open = async (): Promise<void> => {
      if (!url) return;
      wanted = true;
      cancelRetry();
      // One connection per store. The router keeps a route's providers — and
      // so this store — alive across visits, so coming back to the page must
      // not open a second socket beside the first: both would feed the same
      // frame listeners, ticks would run backwards and the arena would be
      // rebuilt on every frame.
      const previous = connection;
      connection = null;
      patchState(store, {
        status: store.reconnectAttempt() ? 'reconnecting' : 'connecting',
        serverError: null,
        profile: null,
        guest: null,
        admin: false,
        chat: [],
        chatError: null,
      });
      await previous?.leave().catch(() => undefined);
      try {
        // Back on the same session when the server still holds it; fresh otherwise.
        const opened = await connect(url, readToken(), roomName);
        if (!wanted) {
          // The page left while the socket was opening.
          void opened.leave().catch(() => undefined);
          return;
        }
        connection = opened;
        keepToken(opened.token);
        // A connection the store let go of may still deliver what was in
        // flight: only the current one speaks for the room.
        const on = <T>(
          type: string,
          listener: (payload: T) => void,
        ): (() => void) =>
          opened.on<T>(type, (payload) => {
            if (connection === opened) listener(payload);
          });
        on<LobbySnapshot>(SERVER_MESSAGE.lobby, (lobby) =>
          patchState(store, {
            lobby,
            clockOffset: serverOffset(lobby, Date.now()),
          }),
        );
        on<RankingEntry[]>(SERVER_MESSAGE.ranking, (ranking) =>
          patchState(store, { ranking }),
        );
        on<PlayerProfile>(SERVER_MESSAGE.profile, (profile) =>
          patchState(store, { profile }),
        );
        on<GuestIdentity>(SERVER_MESSAGE.guest, (guest) =>
          patchState(store, { guest }),
        );
        on<AdminMessage>(SERVER_MESSAGE.admin, ({ admin }) =>
          patchState(store, { admin }),
        );
        on<ErrorMessage>(SERVER_MESSAGE.error, ({ code }) =>
          patchState(
            store,
            CHAT_ERRORS.includes(code)
              ? { chatError: code }
              : { serverError: code },
          ),
        );
        on<ChatMessage[]>(SERVER_MESSAGE.chatHistory, (chat) =>
          patchState(store, { chat }),
        );
        on<ChatMessage>(SERVER_MESSAGE.chat, (message) =>
          patchState(store, {
            chat: [...store.chat(), message].slice(-CHAT_HISTORY),
          }),
        );
        on<ChatRemovedMessage>(SERVER_MESSAGE.chatRemoved, ({ ids }) =>
          patchState(store, {
            chat: store.chat().filter((m) => !ids.includes(m.id)),
          }),
        );
        on<ReactionMessage>(SERVER_MESSAGE.reaction, ({ emoji }) =>
          float(emoji),
        );
        on<FrameMessage>(SERVER_MESSAGE.frame, (frame) =>
          frameListeners.forEach((l) => l(frame)),
        );
        on<RestartingMessage>(SERVER_MESSAGE.restarting, () =>
          patchState(store, { restarting: true }),
        );
        opened.onClose(() => {
          if (connection !== opened) return;
          // Dropped, not left: get it back.
          connection = null;
          patchState(store, { status: 'offline' });
          scheduleReconnect();
        });
        patchState(store, {
          status: 'online',
          reconnectAttempt: 0,
          restarting: false,
        });
      } catch {
        patchState(store, { status: 'offline' });
        scheduleReconnect();
      }
    };

    const send = (type: string, payload?: unknown) =>
      connection?.send(type, payload);

    return {
      /** No server in this build: the page explains instead of trying. */
      markUnavailable(): void {
        patchState(store, { status: 'unavailable' });
      },
      /** Opens the connection to a room: the versus `arena` unless told otherwise. */
      connect(serverUrl: string, room: string = ARENA_ROOM): Promise<void> {
        url = serverUrl;
        // Another room than last time: nothing of the old one stays on screen.
        if (room !== roomName)
          patchState(store, { lobby: null, hud: null, ranking: [] });
        roomName = room;
        return open();
      },
      /** Drops the connection and opens a fresh one — also forgets who was signed in on it. */
      async reconnect(): Promise<void> {
        const old = connection;
        connection = null;
        keepToken(undefined);
        await old?.leave().catch(() => undefined);
        await open();
      },
      /** Tries now instead of at the scheduled time: the page is back in view, the network is back, or someone pressed the button. */
      reconnectNow(): void {
        if (!wanted || connection) return;
        cancelRetry();
        patchState(store, { reconnectAttempt: store.reconnectAttempt() + 1 });
        void open();
      },
      /** Leaves for good: no retries, and the place is given up at the server's grace. */
      disconnect(): void {
        wanted = false;
        cancelRetry();
        keepToken(undefined);
        const old = connection;
        connection = null;
        void old?.leave().catch(() => undefined);
        patchState(store, { reconnectAttempt: 0, restarting: false });
      },
      hello(token: string): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.hello, { token });
      },
      /** Gives up the place in the queue or the round now, instead of after the reconnect grace. */
      signOut(): void {
        send(CLIENT_MESSAGE.signOut);
      },
      /**
       * Plays without an account, under `name`; the token of an earlier
       * answer gets the same guest back. The server answers `guest` or an error.
       */
      playAsGuest(name: string, token?: string): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.guest, { name, ...(token ? { token } : {}) });
      },
      /** Signed in: the server ended the guest on this connection, and so does the page. */
      forgetGuest(): void {
        patchState(store, { guest: null });
      },
      /** Gets in line; in the stages room with the campaign this browser has. */
      joinQueue(characterId: CharacterId, campaign?: CampaignProgress): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.joinQueue, {
          characterId,
          ...(campaign ? { campaign } : {}),
        });
      },
      /** Stages room, host only: start now with whoever is in line. */
      startNow(): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.startNow);
      },
      /** Stages room, host only: the stage the next round plays. */
      pickStage(stageId: string): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.pickStage, { stageId });
      },
      /** A player of the next round votes for its arena — `null` for any — and is ready. */
      voteMap(mapId: MapId | null): void {
        send(CLIENT_MESSAGE.voteMap, { mapId });
      },
      leaveQueue(): void {
        send(CLIENT_MESSAGE.leaveQueue);
      },
      /** Plays the round out, then is not put back in line; `false` stays after all. */
      leaveAfterRound(leave: boolean): void {
        send(CLIENT_MESSAGE.leaveAfterRound, { leave });
      },
      /** An admin changes some rules; the server answers with the lobby (or `forbidden`). */
      setRules(rules: Partial<RoomRules>): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.setRules, { rules });
      },
      sendChat(text: string): void {
        patchState(store, { chatError: null });
        send(CLIENT_MESSAGE.chatSend, { text });
      },
      react(emoji: Reaction): void {
        send(CLIENT_MESSAGE.react, { emoji });
      },
      /** Admin only; the server answers with `chat:removed` (or `forbidden`). */
      deleteChat(id: number): void {
        send(CLIENT_MESSAGE.chatDelete, { id });
      },
      /** Admin only: silences the account and removes what it wrote. */
      muteChat(accountId: string): void {
        send(CLIENT_MESSAGE.chatMute, { accountId });
      },
      /** Stops the reactions still floating; the store is going away. */
      clearTimers(): void {
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
      },
      sendInput(input: InputMessage): void {
        send(CLIENT_MESSAGE.input, input);
      },
      /** The arena's HUD changed; `null` when a new round is being set up. */
      applyHud(hud: HudSnapshot | null): void {
        patchState(store, { hud });
      },
      /** Subscribes to the round's frames; returns the unsubscribe function. */
      onFrame(listener: (frame: FrameMessage) => void): () => void {
        frameListeners.add(listener);
        return () => frameListeners.delete(listener);
      },
    };
  }),
  withHooks({
    onDestroy(store) {
      store.clearTimers();
      store.disconnect();
    },
  }),
);
