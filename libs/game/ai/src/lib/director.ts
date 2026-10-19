import { GameState, PlayerInput } from '@libs/game-core';
import { Bot } from './brain';
import { BotLevel } from './levels';

/** A seat played by the computer. */
export interface BotSetup {
  id: string;
  level: BotLevel;
}

/**
 * Plays every bot of a match: the one thing a session needs to know. It
 * hands back, each tick, what each bot presses — the session mixes that with
 * the keyboard (offline) or the network (online) and ticks the rules as
 * usual. Nothing here knows whether a seat's brain is the rule set or
 * something else.
 */
export class BotDirector {
  private bots: Bot[];

  constructor(
    private readonly setups: readonly BotSetup[],
    private readonly seed = 1,
  ) {
    this.bots = this.create();
  }

  get ids(): string[] {
    return this.setups.map((s) => s.id);
  }

  /** What every bot presses this tick, by player id. */
  inputs(state: GameState): Record<string, PlayerInput> {
    const inputs: Record<string, PlayerInput> = {};
    for (const bot of this.bots) inputs[bot.id] = bot.decide(state);
    return inputs;
  }

  /** A new round: fresh memories, same seats. */
  reset(): void {
    this.bots = this.create();
  }

  private create(): Bot[] {
    return this.setups.map(
      (s, i) => new Bot(s.id, s.level, this.seed * 31 + i),
    );
  }
}
