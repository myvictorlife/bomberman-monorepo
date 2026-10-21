import { START_BOMBS, START_FIRE } from './constants';
import { isFreeFloor } from './bonk';
import { playerCell } from './movement';
import { createRng, shuffle } from './rng';
import { GameState, Player, PowerUpKind } from './types';

/**
 * The scavenger rule (`state.dropItems`): whoever falls leaves what they
 * picked up behind, scattered over free floor anywhere in the arena for the
 * ones still standing. Never in stage mode, where the kit is carried to the
 * next stage instead.
 */
export function scatterItems(state: GameState, player: Player): void {
  if (!state.dropItems || state.stage) return;
  const kinds = collected(state, player);
  if (kinds.length === 0) return;

  // Not where they fell: an outsider steps in right there.
  const [deadCol, deadRow] = playerCell(player);
  const cells: [number, number][] = [];
  for (let row = 0; row < state.rows; row++)
    for (let col = 0; col < state.cols; col++)
      if (
        !(col === deadCol && row === deadRow) &&
        isFreeFloor(state, col, row) &&
        !state.players.some((p) => {
          if (!p.alive) return false;
          const [c, r] = playerCell(p);
          return c === col && r === row;
        })
      )
        cells.push([col, row]);
  // Random to the eye, the same on the server and on every client.
  shuffle(cells, createRng(state.tick * 31 + player.slot * 7 + 1));

  kinds.slice(0, cells.length).forEach((kind, i) => {
    const [col, row] = cells[i] as [number, number];
    state.powerUps.push({ col, row, kind });
    state.events.push({
      type: 'power-up-dropped',
      playerId: player.id,
      kind,
      col,
      row,
    });
  });

  player.maxBombs = START_BOMBS;
  player.fireRange = START_FIRE;
  player.fullFire = false;
  player.speedLevel = 0;
  player.pierce = false;
  player.remote = false;
  player.glove = false;
  player.kick = false;
  player.wallPass = false;
  player.powerBomb = false;
  player.curse = null;
}

/**
 * Every item above the starting kit, one per level: three extra bombs are
 * three bomb items. Full fire goes back as itself, not as fire items; a curse
 * still running goes back as its skull. The vest and the clock are spent, and
 * a mount is gone before its rider can fall.
 */
function collected(state: GameState, player: Player): PowerUpKind[] {
  const repeat = (kind: PowerUpKind, n: number): PowerUpKind[] =>
    Array.from({ length: Math.max(0, n) }, () => kind);
  return [
    ...repeat('bomb', player.maxBombs - START_BOMBS),
    ...(player.fullFire
      ? ['fullfire' as const]
      : repeat('fire', player.fireRange - START_FIRE)),
    ...repeat('speed', player.speedLevel),
    ...(player.pierce ? ['pierce' as const] : []),
    ...(player.remote ? ['remote' as const] : []),
    ...(player.glove ? ['glove' as const] : []),
    ...(player.kick ? ['kick' as const] : []),
    ...(player.wallPass ? ['wallpass' as const] : []),
    ...(player.powerBomb ? ['powerbomb' as const] : []),
    ...(player.curse && state.tick < player.curse.untilTick
      ? ['skull' as const]
      : []),
  ];
}
