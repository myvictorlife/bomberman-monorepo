import { InjectionToken } from '@angular/core';
import { ARENA_ROOM } from '@libs/game-protocol';
import {
  ArenaConnection,
  ArenaLauncher,
  connectToArena,
  mountArena,
} from '@libs/game-client';

/**
 * How the page reaches the game server. A token so unit tests swap in a fake
 * connection — no socket, no server.
 */
export const ARENA_CONNECTOR = new InjectionToken<
  (
    url: string,
    reconnectionToken?: string,
    roomName?: string,
  ) => Promise<ArenaConnection>
>('ARENA_CONNECTOR', { factory: () => connectToArena });

/** How the page draws the round. A token because Phaser needs a canvas the test DOM lacks. */
export const ONLINE_ARENA_LAUNCHER = new InjectionToken<ArenaLauncher>(
  'ONLINE_ARENA_LAUNCHER',
  {
    factory: () => mountArena,
  },
);

/**
 * Which room the page is: the versus `arena` unless the route provides
 * `stages`. A token, so the same page serves both and a test picks one.
 */
export const ONLINE_ROOM = new InjectionToken<string>('ONLINE_ROOM', {
  factory: () => ARENA_ROOM,
});
