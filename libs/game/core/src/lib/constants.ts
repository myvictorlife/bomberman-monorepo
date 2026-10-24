/**
 * Every rule number of the game in one place. Times are in ticks; the
 * simulation always advances at {@link TICK_RATE} ticks per second, whatever
 * the frame rate of whoever is drawing it — the server will run the exact same
 * numbers.
 */
export const TICK_RATE = 60;

/** The classic battle arena: 15 × 13 including the outer wall. */
export const ARENA_COLS = 15;
export const ARENA_ROWS = 13;
/** How many columns of a longer stage are in play at once: the classic arena's width. */
export const VIEW_COLS = ARENA_COLS;

/** Chance that a free cell (outside the spawn zones) starts as a soft block. */
export const BLOCK_DENSITY = 0.8;

export const BOMB_FUSE_TICKS = Math.round(2.5 * TICK_RATE);
export const FLAME_TICKS = Math.round(0.5 * TICK_RATE);
export const BLOCK_BURN_TICKS = FLAME_TICKS;
/** How long a player's death animation lasts before the sprite is gone. */
export const DEATH_TICKS = Math.round(1 * TICK_RATE);
/**
 * Once one player (or none) is left, the round waits this long before it is
 * decided — a survivor caught by a flame in that window turns the win into a
 * draw, like the original.
 */
export const ROUND_END_DELAY_TICKS = Math.round(1.5 * TICK_RATE);

export const START_BOMBS = 1;
export const START_FIRE = 2;
export const MAX_BOMBS = 8;
export const MAX_FIRE = 8;
export const MAX_SPEED_LEVEL = 4;

/** Tiles per second. */
export const BASE_SPEED = 3.2;
export const SPEED_PER_LEVEL = 0.6;

/**
 * Power-ups hidden under the soft blocks of a fresh arena, in versus and in
 * the online room. A stage hides its own instead — see `items` in
 * `campaign.ts` — and only a stage hides the extra life: a versus round has
 * no lives to give.
 */
export const POWER_UP_COUNTS = {
  bomb: 8,
  fire: 8,
  speed: 4,
  egg: 2,
  pierce: 1,
  remote: 1,
  vest: 1,
  glove: 2,
  kick: 2,
  wallpass: 1,
  fullfire: 1,
  powerbomb: 1,
  skull: 2,
  clock: 1,
} as const;

/** How long a skull's curse lasts. */
export const CURSE_TICKS = 10 * TICK_RATE;
/** Speeds the `slow` and `fast` curses force, in tiles per second. */
export const CURSE_SLOW_SPEED = 1.6;
export const CURSE_FAST_SPEED = 7;
/** The `shortfuse` curse: bombs go off this soon. */
export const CURSE_FUSE_TICKS = Math.round(1 * TICK_RATE);
/** What the clock puts back on the round's clock. */
export const CLOCK_BONUS_TICKS = 30 * TICK_RATE;

/** How far the glove throws a bomb, before any bounce. */
export const GLOVE_THROW_CELLS = 3;
/** How long a bomb in the air takes per cell it crosses: a longer throw or a bounce takes longer. */
export const BOMB_FLIGHT_TICKS_PER_CELL = Math.round(0.15 * TICK_RATE);

/**
 * The round's clock: when it runs out the arena closes in, a wall dropping
 * every {@link CLOSING_STEP_TICKS} in a spiral from the edges, until one
 * player (or none) is left. See `closing.ts`.
 */
export const ROUND_TIME_TICKS = 3 * 60 * TICK_RATE;
export const CLOSING_STEP_TICKS = Math.round(0.3 * TICK_RATE);

/** How long the glove holds a player overhead before they wriggle free. */
export const CARRY_TICKS = 2 * TICK_RATE;
/** How long a thrown player stays dizzy after the landing — or one a bomb came down on. */
export const STUN_TICKS = 1 * TICK_RATE;
/** How many items a bomb on the head knocks loose. */
export const BONK_DROPS = 2;

/** How long the vest keeps flames off. */
export const VEST_TICKS = 8 * TICK_RATE;

/** Extra tiles per second while riding a mount. */
export const MOUNT_SPEED_BONUS = 0.8;
/**
 * After a mount takes a hit the rider is untouchable for this long: the flame
 * that took it is still burning under their feet.
 */
export const MOUNT_SHIELD_TICKS = FLAME_TICKS + Math.round(0.25 * TICK_RATE);

/**
 * Spawn cells, by player slot: P1 top-left, P2 bottom-right, then the other two
 * corners, and a fifth player in the middle of the arena — the classic
 * five-player battle layout.
 */
export const SPAWN_CELLS: readonly (readonly [number, number])[] = [
  [1, 1],
  [ARENA_COLS - 2, ARENA_ROWS - 2],
  [ARENA_COLS - 2, 1],
  [1, ARENA_ROWS - 2],
  [Math.floor(ARENA_COLS / 2), Math.floor(ARENA_ROWS / 2)],
];

export const MAX_PLAYERS = SPAWN_CELLS.length;

/**
 * The outsiders: the next in line stand on the border wall during a round and
 * throw bombs in. A thrown bomb lands {@link OUTSIDER_THROW_CELLS} cells in
 * from the wall (further if that cell is taken), after a short flight, and
 * burns like a starting bomb. A kill puts the thrower in the round, on the
 * victim's cell, untouchable for {@link ENTRY_SHIELD_TICKS} — the flame that
 * made the kill is still burning there.
 */
export const OUTSIDER_THROW_CELLS = 3;
export const OUTSIDER_THROW_TICKS = Math.round(0.6 * TICK_RATE);
export const OUTSIDER_BOMB_RANGE = START_FIRE;
/** Tiles per second along the border. */
export const OUTSIDER_SPEED = BASE_SPEED;
export const ENTRY_SHIELD_TICKS = 1 * TICK_RATE;

/**
 * Where outsiders appear, in order: the middle of each side, then a corner.
 * The first free one is taken; a corner is a place to walk from, not to throw
 * from.
 */
export const OUTSIDER_SPAWN_CELLS: readonly (readonly [number, number])[] = [
  [Math.floor(ARENA_COLS / 2), 0],
  [Math.floor(ARENA_COLS / 2), ARENA_ROWS - 1],
  [0, Math.floor(ARENA_ROWS / 2)],
  [ARENA_COLS - 1, Math.floor(ARENA_ROWS / 2)],
  [0, 0],
];
