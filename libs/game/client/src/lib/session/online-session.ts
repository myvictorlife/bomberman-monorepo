import { Direction, GameEvent, GameState } from '@libs/game-core';
import {
  FRAME_INTERVAL_MS,
  FrameMessage,
  InputMessage,
} from '@libs/game-protocol';
import { ArenaSession } from './arena-session';

/**
 * A round the server runs, seen from this tab. Frames arrive a few times a
 * second; between two of them the players glide from where they were to where
 * they are, so movement looks smooth while the rules stay on the server.
 *
 * `controlIds` are the control schemes that drive this tab's player — both the
 * WASD and the arrow scheme, so either hand works. A spectator passes none.
 */
export class OnlineSession implements ArenaSession {
  readonly state: GameState;
  private previous = new Map<string, { x: number; y: number }>();
  private target = new Map<string, { x: number; y: number }>();
  private receivedAt = 0;
  private pending: GameEvent[] = [];
  private lastDirection: Direction | null = null;

  constructor(
    first: FrameMessage,
    private controlIds: readonly string[],
    private readonly send: (input: InputMessage) => void,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.state = structuredClone(first.state);
    this.remember(first.state);
    this.previous = new Map(this.target);
    this.receivedAt = this.now();
    this.pending.push(...first.events);
  }

  /** A new frame from the server. Same round only: a new round gets a new session. */
  receive(frame: FrameMessage): void {
    this.previous = new Map(
      [...this.state.players, ...this.state.outsiders].map((p) => [
        p.id,
        { x: p.x, y: p.y },
      ]),
    );
    Object.assign(this.state, structuredClone(frame.state));
    this.remember(frame.state);
    this.receivedAt = this.now();
    this.pending.push(...frame.events);
  }

  /**
   * Hands the keys to this tab's player, or takes them away — signing in or
   * out mid-round — without rebuilding the arena. Stops the player first.
   */
  setControls(controlIds: readonly string[]): void {
    if (
      controlIds.length === this.controlIds.length &&
      controlIds.every((id, i) => id === this.controlIds[i])
    )
      return;
    if (
      this.controlIds.length > 0 &&
      controlIds.length === 0 &&
      this.lastDirection !== null
    ) {
      this.send({ direction: null });
    }
    this.controlIds = controlIds;
    this.lastDirection = null;
  }

  advance(
    _deltaMs: number,
    directions: Readonly<Record<string, Direction | null>>,
  ): GameEvent[] {
    const held =
      this.controlIds
        .map((id) => directions[id] ?? null)
        .find((d) => d !== null) ?? null;
    if (this.controlIds.length > 0 && held !== this.lastDirection) {
      this.lastDirection = held;
      this.send({ direction: held });
    }

    const t = Math.min(1, (this.now() - this.receivedAt) / FRAME_INTERVAL_MS);
    for (const player of [...this.state.players, ...this.state.outsiders]) {
      const from = this.previous.get(player.id);
      const to = this.target.get(player.id);
      if (!from || !to) continue;
      player.x = from.x + (to.x - from.x) * t;
      player.y = from.y + (to.y - from.y) * t;
    }

    return this.pending.splice(0);
  }

  pressBomb(controlId: string): void {
    if (this.controlIds.includes(controlId))
      this.send({ direction: this.lastDirection, bomb: true });
  }

  pressAbility(controlId: string): void {
    if (this.controlIds.includes(controlId))
      this.send({ direction: this.lastDirection, ability: true });
  }

  pressDetonate(controlId: string): void {
    if (this.controlIds.includes(controlId))
      this.send({ direction: this.lastDirection, detonate: true });
  }

  private remember(state: GameState): void {
    this.target = new Map(
      [...state.players, ...state.outsiders].map((p) => [
        p.id,
        { x: p.x, y: p.y },
      ]),
    );
  }
}
