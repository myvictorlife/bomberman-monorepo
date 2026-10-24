import { cellIndex } from './arena';
import { AREAS, findArea, Stage, StageFoe, StagePart } from './campaign';
import { createGame, tick } from './game';
import { Direction, GameState, PlayerInput } from './types';

/** A two-player round with every soft block removed, so a test places its own. */
export function openArena(playerCount = 2): GameState {
  const state = createGame({
    seed: 1,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
    })),
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  state.hiddenPowerUps = state.hiddenPowerUps.map(() => null);
  return state;
}

export function setBlock(state: GameState, col: number, row: number): void {
  state.tiles[cellIndex(state, col, row)] = 'block';
}

export function input(
  direction: Direction | null = null,
  bomb = false,
): PlayerInput {
  return { direction, bomb };
}

/** Runs `n` ticks with the same inputs on every tick. */
export function run(
  state: GameState,
  n: number,
  inputs: Record<string, PlayerInput> = {},
): GameState {
  for (let i = 0; i < n; i++) tick(state, inputs);
  return state;
}

export function player(state: GameState, id: string) {
  const found = state.players.find((p) => p.id === id);
  if (!found) throw new Error(`no player ${id}`);
  return found;
}

/** Where the four players start on {@link withLongStage}: down the left edge. */
export const LONG_SPAWNS = [
  [1, 1],
  [1, 11],
  [1, 5],
  [1, 7],
] as const;

/**
 * Puts one long stage in Área 2, `subestacao-1`: 61 × 13, the players
 * starting on {@link LONG_SPAWNS}. Returns what puts the catalogue back.
 */
export function installLongStage(
  foes: readonly StageFoe[] = [{ creature: 'sauva', count: 12 }],
  parts?: readonly StagePart[],
): () => void {
  const original = AREAS[1];
  const stage: Stage = {
    id: 'subestacao-1',
    foes: parts ? [] : foes,
    boss: null,
    layout: { cols: 61, rows: 13, spawns: LONG_SPAWNS },
    ...(parts ? { parts } : {}),
  };
  (AREAS as unknown as unknown[])[1] = {
    ...findArea('subestacao'),
    stages: [stage],
  };
  return () => ((AREAS as unknown as unknown[])[1] = original);
}

/** Runs `fn` with {@link installLongStage}'s long stage in the catalogue. */
export function withLongStage<T>(fn: () => T): T {
  const restore = installLongStage();
  try {
    return fn();
  } finally {
    restore();
  }
}

/** Four screens, three saúvas each: the second one's gate opens with a key. */
export const TEST_PARTS: readonly StagePart[] = [
  {
    until: 14,
    goal: 'creatures',
    seconds: 90,
    foes: [{ creature: 'sauva', count: 3 }],
  },
  {
    until: 29,
    goal: 'key',
    seconds: 90,
    foes: [{ creature: 'sauva', count: 3 }],
  },
  {
    until: 44,
    goal: 'creatures',
    seconds: 90,
    foes: [{ creature: 'sauva', count: 3 }],
  },
  {
    until: 59,
    goal: 'creatures',
    seconds: 90,
    foes: [{ creature: 'sauva', count: 3 }],
  },
];
