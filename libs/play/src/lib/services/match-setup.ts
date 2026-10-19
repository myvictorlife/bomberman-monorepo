import { BotLevel, BotSetup, isBotLevel } from '@libs/game-ai';
import { CHARACTERS, MAX_PLAYERS, PlayerSetup } from '@libs/game-core';

/**
 * Who plays an offline match: player 1 at the keyboard, optionally a second
 * player on the other hand of the keyboard, and the rest bots of one difficulty. It travels
 * in the URL — `/play?bots=3&level=hard&p2=1` — so a link to a match carries
 * it, and a test can open any line-up without clicking.
 */
export interface MatchSetup {
  bots: number;
  level: BotLevel;
  /** A second person on the same keyboard, on whichever hand player 1 left. */
  secondHuman: boolean;
}

/** One bot of medium difficulty: what a first visit plays. */
export const DEFAULT_SETUP: MatchSetup = {
  bots: 1,
  level: 'medium',
  secondHuman: false,
};

export function humansIn(setup: Pick<MatchSetup, 'secondHuman'>): number {
  return setup.secondHuman ? 2 : 1;
}

/** As many bots as the arena has spawn points left after the people. */
export function maxBots(setup: Pick<MatchSetup, 'secondHuman'>): number {
  return MAX_PLAYERS - humansIn(setup);
}

/** Anything unknown or out of range falls back to the default, or to the nearest allowed count. */
export function setupFromQuery(params: {
  get(name: string): string | null;
}): MatchSetup {
  const secondHuman = params.get('p2') === '1';
  const level = params.get('level') ?? '';
  const rawBots = params.get('bots');
  const bots = rawBots === null ? DEFAULT_SETUP.bots : Number(rawBots);
  return {
    secondHuman,
    level: isBotLevel(level) ? level : DEFAULT_SETUP.level,
    bots: Number.isInteger(bots)
      ? Math.min(Math.max(bots, 0), maxBots({ secondHuman }))
      : DEFAULT_SETUP.bots,
  };
}

/** The URL query for a setup — `p2` left out when off, so the plain link stays short. */
export function setupToQuery(setup: MatchSetup): Record<string, string | null> {
  return {
    bots: String(setup.bots),
    level: setup.level,
    p2: setup.secondHuman ? '1' : null,
  };
}

/** A bot's seat id: `cpu1`, `cpu2`… — never the same as a person's. */
export const botId = (n: number): string => `cpu${n}`;

export function isBotId(id: string): boolean {
  return /^cpu\d+$/.test(id);
}

/** The bot's number as shown on screen, from its id. */
export function botNumber(id: string): number {
  return Number(id.slice(3));
}

/**
 * The players of a match, in spawn order: the people first, then the bots.
 * Player 1 is whoever was chosen on the roster; everyone else takes the next
 * characters round the roster, so no two look alike.
 */
export function matchPlayers(
  chosen: PlayerSetup['characterId'],
  setup: MatchSetup,
): { players: PlayerSetup[]; bots: BotSetup[] } {
  const start = Math.max(
    0,
    CHARACTERS.findIndex((c) => c.id === chosen),
  );
  const look = (i: number) => CHARACTERS[(start + i) % CHARACTERS.length]?.id;
  const players: PlayerSetup[] = [
    { id: 'p1', name: 'P1', characterId: chosen },
  ];
  if (setup.secondHuman)
    players.push({ id: 'p2', name: 'P2', characterId: look(1) });
  const bots: BotSetup[] = [];
  for (let n = 1; n <= setup.bots; n++) {
    const id = botId(n);
    players.push({ id, name: `CPU ${n}`, characterId: look(players.length) });
    bots.push({ id, level: setup.level });
  }
  return { players, bots };
}
