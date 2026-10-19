/**
 * How hard a bot plays. A level is data, not code: every bot runs the same
 * brain, and these numbers decide how quickly it reacts, how far it looks
 * ahead and how often it lets a chance go. Balancing a level is editing a
 * number here.
 */
export type BotLevel = 'easy' | 'casual' | 'medium' | 'hard';

/**
 * The levels a player picks from on `/play`. `casual` is left out: it is the
 * online room's, a notch under `medium`, so bots filling a room of people
 * play more like people than like a machine.
 */
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

export interface BotProfile {
  /** Ticks between two decisions. Lower reacts faster. */
  replanTicks: number;
  /**
   * Ticks a bomb has to sit on the ground before the bot notices it (its own
   * it always knows). A person online sees a bomb a network trip late and
   * takes a moment to react; without this a bot dodges on the very tick a
   * bomb lands, a head start no person can match.
   */
  reactionTicks: number;
  /** Chance (0–1), each time it runs from a blast, of picking any nearby safe cell rather than the best one. */
  slipChance: number;
  /** Chance (0–1) of taking a good bombing chance when one comes up. */
  bombChance: number;
  /** Sees that one bomb sets off another, so a chain's reach is avoided too. */
  readsChains: boolean;
  /** Sees the walls about to drop once the round's clock has run out. */
  readsClosing: boolean;
  /** How much it wants to close in on an enemy, against breaking crates and picking items. */
  aggression: number;
  /**
   * Sets a remote bomb off early, the moment an enemy stands in its blast.
   * Every level presses the button anyway once the bomb has waited a fuse.
   */
  detonates: boolean;
  /** Works out whether an enemy in the blast would have anywhere to run, and goes for the ones who would not. */
  setsTraps: boolean;
}

export const BOT_PROFILES: Readonly<Record<BotLevel, BotProfile>> = {
  easy: {
    replanTicks: 24,
    reactionTicks: 45,
    slipChance: 0.25,
    bombChance: 0.35,
    readsChains: false,
    readsClosing: false,
    aggression: 0.4,
    detonates: false,
    setsTraps: false,
  },
  casual: {
    replanTicks: 16,
    // About what an online player loses: a network trip, then a human's reaction.
    reactionTicks: 45,
    slipChance: 0.25,
    bombChance: 0.45,
    readsChains: false,
    readsClosing: false,
    aggression: 0.5,
    detonates: false,
    setsTraps: false,
  },
  medium: {
    replanTicks: 10,
    reactionTicks: 0,
    slipChance: 0,
    bombChance: 0.7,
    readsChains: true,
    readsClosing: true,
    aggression: 1,
    detonates: true,
    setsTraps: false,
  },
  hard: {
    replanTicks: 3,
    reactionTicks: 0,
    slipChance: 0,
    bombChance: 1,
    readsChains: true,
    readsClosing: true,
    aggression: 1.8,
    detonates: true,
    setsTraps: true,
  },
};

/** A level offered on `/play`. */
export function isBotLevel(value: string): value is BotLevel {
  return (BOT_LEVELS as readonly string[]).includes(value);
}
