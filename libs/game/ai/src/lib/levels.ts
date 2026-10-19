/**
 * How hard a bot plays. A level is data, not code: every bot runs the same
 * brain, and these numbers decide how quickly it reacts, how far it looks
 * ahead and how often it lets a chance go. Balancing a level is editing a
 * number here.
 */
export type BotLevel = 'easy' | 'medium' | 'hard';

export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

export interface BotProfile {
  /** Ticks between two decisions. Lower reacts faster. */
  replanTicks: number;
  /** Chance (0–1) of taking a good bombing chance when one comes up. */
  bombChance: number;
  /** Sees that one bomb sets off another, so a chain's reach is avoided too. */
  readsChains: boolean;
  /** Sees the walls about to drop once the round's clock has run out. */
  readsClosing: boolean;
  /** How much it wants to close in on an enemy, against breaking crates and picking items. */
  aggression: number;
  /** Uses the remote's detonate button when an enemy stands in the blast. */
  detonates: boolean;
  /** Works out whether an enemy in the blast would have anywhere to run, and goes for the ones who would not. */
  setsTraps: boolean;
}

export const BOT_PROFILES: Readonly<Record<BotLevel, BotProfile>> = {
  easy: {
    replanTicks: 24,
    bombChance: 0.35,
    readsChains: false,
    readsClosing: false,
    aggression: 0.4,
    detonates: false,
    setsTraps: false,
  },
  medium: {
    replanTicks: 10,
    bombChance: 0.7,
    readsChains: true,
    readsClosing: true,
    aggression: 1,
    detonates: true,
    setsTraps: false,
  },
  hard: {
    replanTicks: 3,
    bombChance: 1,
    readsChains: true,
    readsClosing: true,
    aggression: 1.8,
    detonates: true,
    setsTraps: true,
  },
};

export function isBotLevel(value: string): value is BotLevel {
  return (BOT_LEVELS as readonly string[]).includes(value);
}
