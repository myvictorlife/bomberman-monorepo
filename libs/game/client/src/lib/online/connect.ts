import { ARENA_ROOM } from '@libs/game-protocol';

/** A live connection to the public room — the only part of the client that knows the network library. */
export interface ArenaConnection {
  /**
   * What gets this session back after a drop (`connectToArena(url, token)`),
   * for as long as the server holds the place. A credential: kept in memory
   * and session storage only, never logged or put in a URL.
   */
  readonly token?: string;
  send(type: string, payload?: unknown): void;
  /** Subscribes to one server message type; returns the unsubscribe function. */
  on<T>(type: string, listener: (payload: T) => void): () => void;
  /** The connection dropped or was closed; the code says why. */
  onClose(listener: (code: number) => void): void;
  leave(): Promise<void>;
}

type Protocols = string | string[] | undefined;

/**
 * A browser `WebSocket` that also accepts Node's `(url, { protocols })` form.
 *
 * The Colyseus SDK first tries `new WebSocket(url, { headers, protocols })` and
 * falls back to the browser form only if that throws. Chrome and Firefox throw;
 * Safari does not — it fails the connection instead, so the room never opens.
 */
export function withNodeSignature(Native: typeof WebSocket): typeof WebSocket {
  return class extends Native {
    constructor(
      url: string | URL,
      options?: Protocols | { protocols?: Protocols },
    ) {
      const protocols =
        options && typeof options === 'object' && !Array.isArray(options)
          ? options.protocols
          : options;
      super(url, protocols);
    }
  };
}

/** The SDK reads `globalThis.WebSocket` once, when its module first loads. */
async function loadSdk() {
  const native = globalThis.WebSocket;
  if (!native) return import('@colyseus/sdk');
  globalThis.WebSocket = withNodeSignature(native);
  try {
    return await import('@colyseus/sdk');
  } finally {
    globalThis.WebSocket = native;
  }
}

/**
 * Joins the public room — the server creates it and refuses to make another.
 * With a `reconnectionToken` from a dropped connection it asks for that
 * session back first (the place, the identity), and joins afresh if the
 * server no longer holds it. The Colyseus client is imported here,
 * dynamically, so it is downloaded only when someone opens the online room.
 */
export async function connectToArena(
  serverUrl: string,
  reconnectionToken?: string,
): Promise<ArenaConnection> {
  const { Client } = await loadSdk();
  const client = new Client(serverUrl);
  const room = reconnectionToken
    ? await client
        .reconnect(reconnectionToken)
        .catch(() => client.join(ARENA_ROOM))
    : await client.join(ARENA_ROOM);
  return {
    token: room.reconnectionToken,
    send: (type, payload) => room.send(type, payload),
    on: (type, listener) => room.onMessage(type, listener),
    onClose: (listener) => {
      room.onLeave((code) => listener(code));
    },
    leave: async () => {
      await room.leave();
    },
  };
}
