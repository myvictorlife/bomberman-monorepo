import { computed, inject } from '@angular/core';
import { ArenaConnection, HudSnapshot } from '@libs/game-client';
import {
  AdminMessage,
  CHAT_HISTORY,
  ChatMessage,
  ChatRemovedMessage,
  CLIENT_MESSAGE,
  ErrorMessage,
  FrameMessage,
  InputMessage,
  LobbySnapshot,
  PlayerProfile,
  RankingEntry,
  Reaction,
  ReactionMessage,
  SERVER_MESSAGE,
  NO_WATCHERS,
  PUBLIC_ROOM_RULES,
  RoomRules,
  ServerErrorCode,
  serverOffset,
} from '@libs/game-protocol';
import { CharacterId } from '@libs/game-core';
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
  | 'offline';

export interface OnlineState {
  status: ConnectionStatus;
  lobby: LobbySnapshot | null;
  ranking: RankingEntry[];
  /** What the server knows about the signed-in account; `null` until it answers. */
  profile: PlayerProfile | null;
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
  lobby: null,
  ranking: [],
  profile: null,
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
    /** Rules an admin set during the round, for the next one; `null` when nothing is pending. */
    nextRules: computed((): RoomRules | null => lobby()?.nextRules ?? null),
  })),
  withMethods((store, connect = inject(ARENA_CONNECTOR)) => {
    let connection: ArenaConnection | null = null;
    let url: string | null = null;
    const frameListeners = new Set<(frame: FrameMessage) => void>();
    let reactionKey = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();

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

    const open = async (): Promise<void> => {
      if (!url) return;
      patchState(store, {
        status: 'connecting',
        serverError: null,
        profile: null,
        admin: false,
        chat: [],
        chatError: null,
      });
      try {
        const opened = await connect(url);
        connection = opened;
        opened.on<LobbySnapshot>(SERVER_MESSAGE.lobby, (lobby) =>
          patchState(store, {
            lobby,
            clockOffset: serverOffset(lobby, Date.now()),
          }),
        );
        opened.on<RankingEntry[]>(SERVER_MESSAGE.ranking, (ranking) =>
          patchState(store, { ranking }),
        );
        opened.on<PlayerProfile>(SERVER_MESSAGE.profile, (profile) =>
          patchState(store, { profile }),
        );
        opened.on<AdminMessage>(SERVER_MESSAGE.admin, ({ admin }) =>
          patchState(store, { admin }),
        );
        opened.on<ErrorMessage>(SERVER_MESSAGE.error, ({ code }) =>
          patchState(
            store,
            CHAT_ERRORS.includes(code)
              ? { chatError: code }
              : { serverError: code },
          ),
        );
        opened.on<ChatMessage[]>(SERVER_MESSAGE.chatHistory, (chat) =>
          patchState(store, { chat }),
        );
        opened.on<ChatMessage>(SERVER_MESSAGE.chat, (message) =>
          patchState(store, {
            chat: [...store.chat(), message].slice(-CHAT_HISTORY),
          }),
        );
        opened.on<ChatRemovedMessage>(SERVER_MESSAGE.chatRemoved, ({ ids }) =>
          patchState(store, {
            chat: store.chat().filter((m) => !ids.includes(m.id)),
          }),
        );
        opened.on<ReactionMessage>(SERVER_MESSAGE.reaction, ({ emoji }) =>
          float(emoji),
        );
        opened.on<FrameMessage>(SERVER_MESSAGE.frame, (frame) =>
          frameListeners.forEach((l) => l(frame)),
        );
        opened.onClose(() => {
          if (connection === opened) {
            connection = null;
            patchState(store, { status: 'offline' });
          }
        });
        patchState(store, { status: 'online' });
      } catch {
        patchState(store, { status: 'offline' });
      }
    };

    const send = (type: string, payload?: unknown) =>
      connection?.send(type, payload);

    return {
      /** No server in this build: the page explains instead of trying. */
      markUnavailable(): void {
        patchState(store, { status: 'unavailable' });
      },
      connect(serverUrl: string): Promise<void> {
        url = serverUrl;
        return open();
      },
      /** Drops the connection and opens a fresh one — also forgets who was signed in on it. */
      async reconnect(): Promise<void> {
        const old = connection;
        connection = null;
        await old?.leave().catch(() => undefined);
        await open();
      },
      disconnect(): void {
        const old = connection;
        connection = null;
        void old?.leave().catch(() => undefined);
      },
      hello(token: string): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.hello, { token });
      },
      /** Gives up the place in the queue or the round now, instead of after the reconnect grace. */
      signOut(): void {
        send(CLIENT_MESSAGE.signOut);
      },
      joinQueue(characterId: CharacterId): void {
        patchState(store, { serverError: null });
        send(CLIENT_MESSAGE.joinQueue, { characterId });
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
