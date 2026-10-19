import { cellIndex } from './arena';
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
