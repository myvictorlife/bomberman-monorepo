import { tileAt } from './arena';
import { BONK_DROPS, START_BOMBS, START_FIRE, STUN_TICKS } from './constants';
import { playerCell } from './movement';
import { GameState, Player, PowerUpKind } from './types';

/**
 * A bomb coming down on someone's head: it bounces on one cell (see
 * `landThrownBombs`), and the one it hit is dizzy for a moment and loses up
 * to {@link BONK_DROPS} of their items, which land on the floor around them
 * for anyone to pick up.
 */

/** Who stands on `col, row` with their feet on the ground — the heads a falling bomb can hit. */
export function headsAt(state: GameState, col: number, row: number): Player[] {
  return state.players.filter((p) => {
    if (!p.alive || p.jump || p.flight || p.carriedBy) return false;
    const [c, r] = playerCell(p);
    return c === col && r === row;
  });
}

/** Stuns `player` and scatters some of what they picked up. */
export function bonk(state: GameState, player: Player): void {
  player.stunnedUntilTick = Math.max(
    player.stunnedUntilTick,
    state.tick + STUN_TICKS,
  );
  player.moving = false;
  state.events.push({ type: 'player-bonked', playerId: player.id });

  const kinds = droppable(player);
  if (kinds.length === 0) return;
  // No dice in the rules: the tick picks where in the list to start, so the
  // same hit always drops the same items, on the server and in a replay.
  const start = state.tick % kinds.length;
  const cells = dropCells(state, player);
  for (let i = 0; i < Math.min(BONK_DROPS, kinds.length); i++) {
    const kind = kinds[(start + i) % kinds.length];
    const cell = cells.shift();
    if (!kind || !cell) return;
    lose(player, kind);
    state.powerUps.push({ col: cell[0], row: cell[1], kind });
    state.events.push({
      type: 'power-up-dropped',
      playerId: player.id,
      kind,
      col: cell[0],
      row: cell[1],
    });
  }
}

/**
 * What a bonk can knock loose: anything above the starting kit. Never the
 * glove — it may be holding a bomb or a player right now — nor a mount or the
 * vest, which are not items in hand.
 */
function droppable(player: Player): PowerUpKind[] {
  const kinds: PowerUpKind[] = [];
  if (player.maxBombs > START_BOMBS) kinds.push('bomb');
  if (player.fireRange > START_FIRE) kinds.push('fire');
  if (player.speedLevel > 0) kinds.push('speed');
  if (player.kick) kinds.push('kick');
  if (player.remote) kinds.push('remote');
  if (player.pierce) kinds.push('pierce');
  return kinds;
}

function lose(player: Player, kind: PowerUpKind): void {
  if (kind === 'bomb') player.maxBombs--;
  else if (kind === 'fire') player.fireRange--;
  else if (kind === 'speed') player.speedLevel--;
  else if (kind === 'kick') player.kick = false;
  else if (kind === 'remote') player.remote = false;
  else if (kind === 'pierce') player.pierce = false;
}

/** Free floor around the player, nearest first: no block, bomb, item or flame on it. */
function dropCells(state: GameState, player: Player): [number, number][] {
  const [col, row] = playerCell(player);
  const cells: [number, number][] = [];
  for (let distance = 1; distance <= 2; distance++) {
    for (let dc = -distance; dc <= distance; dc++) {
      const dr = distance - Math.abs(dc);
      for (const r of dr === 0 ? [row] : [row - dr, row + dr]) {
        const c = col + dc;
        if (isFreeFloor(state, c, r)) cells.push([c, r]);
      }
    }
  }
  return cells;
}

/** Floor an item can land on: no block, bomb, item or flame on it. */
export function isFreeFloor(
  state: GameState,
  col: number,
  row: number,
): boolean {
  return (
    tileAt(state, col, row) === 'empty' &&
    !state.bombs.some((b) => b.col === col && b.row === row) &&
    !state.powerUps.some((p) => p.col === col && p.row === row) &&
    !state.flames.some((f) => f.col === col && f.row === row)
  );
}
