import {
  createGame,
  Direction,
  GameEvent,
  GameOptions,
  GameState,
  PlayerInput,
  tick,
  TICK_RATE,
} from '@libs/game-core';
import { BotDirector, BotSetup } from '@libs/game-ai';
import { ArenaSession } from './arena-session';

const TICK_MS = 1000 / TICK_RATE;
/** A frame longer than this (tab in background, breakpoint) is not caught up. */
const MAX_FRAME_MS = 250;

/**
 * Runs the rules on this machine: every player is at this keyboard. The online
 * session will implement the same surface, with the server ticking instead.
 *
 * Rendering happens at whatever rate the browser draws; the simulation always
 * advances in fixed {@link TICK_RATE} steps, carrying the remainder over.
 */
export class LocalSession implements ArenaSession {
  private current: GameState;
  private accumulator = 0;
  private readonly pendingBombs = new Set<string>();
  private readonly pendingAbilities = new Set<string>();
  private readonly pendingDetonates = new Set<string>();

  private readonly bots: BotDirector | null;

  /** `bots` are seats the computer plays: their keys come from the bot, never the keyboard. */
  constructor(
    private readonly options: GameOptions,
    bots: readonly BotSetup[] = [],
  ) {
    this.current = createGame(options);
    this.bots = bots.length > 0 ? new BotDirector(bots, options.seed) : null;
  }

  get state(): GameState {
    return this.current;
  }

  /** Latched until the next tick, so a press between two ticks is never lost. */
  pressBomb(playerId: string): void {
    this.pendingBombs.add(playerId);
  }

  /** The mount-ability button, latched like the bomb. */
  pressAbility(playerId: string): void {
    this.pendingAbilities.add(playerId);
  }

  /** The detonate button, latched like the bomb. */
  pressDetonate(playerId: string): void {
    this.pendingDetonates.add(playerId);
  }

  /** Advances by `deltaMs` of wall time; returns the events of every tick run. */
  advance(
    deltaMs: number,
    directions: Readonly<Record<string, Direction | null>>,
  ): GameEvent[] {
    this.accumulator += Math.min(Math.max(deltaMs, 0), MAX_FRAME_MS);
    const events: GameEvent[] = [];

    while (this.accumulator >= TICK_MS) {
      const inputs: Record<string, PlayerInput> = {};
      for (const player of this.current.players) {
        inputs[player.id] = {
          direction: directions[player.id] ?? null,
          bomb: this.pendingBombs.has(player.id),
          ability: this.pendingAbilities.has(player.id),
          detonate: this.pendingDetonates.has(player.id),
        };
      }
      this.pendingBombs.clear();
      this.pendingAbilities.clear();
      this.pendingDetonates.clear();
      if (this.bots) Object.assign(inputs, this.bots.inputs(this.current));
      tick(this.current, inputs);
      events.push(...this.current.events);
      this.accumulator -= TICK_MS;
    }
    return events;
  }

  /** A fresh round with the same players — a new arena unless a seed is given. */
  restart(seed = Date.now()): void {
    this.current = createGame({ ...this.options, seed });
    this.accumulator = 0;
    this.bots?.reset();
    this.pendingBombs.clear();
    this.pendingAbilities.clear();
    this.pendingDetonates.clear();
  }
}
