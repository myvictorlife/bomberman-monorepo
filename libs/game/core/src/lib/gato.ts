/**
 * Area 2's boss, the Gato de Fios: a cat made of the tangle of wires someone
 * left in the substation's cellar. It walks after the nearest player, then
 * stops and glows for a moment — its row and column light up on the floor —
 * and zaps them: the shock runs out from it until a crate, a pillar or the
 * wall stops it, and fries one of its own generators if it reaches one, which
 * leaves it dizzy. After every zap it is drained for a moment: the only time
 * a flame hurts it, and the only time it is safe to touch. Every third time,
 * with a player close in a straight line, it pounces instead.
 *
 * From half health on the lights go out now and then, and it walks faster.
 * Driven from `advanceStage`, as deterministic as the rest.
 */
import { tileAt } from './arena';
import { TICK_RATE } from './constants';
import {
  advanceMounds,
  BOSS_REACH,
  freeFloor,
  hurtBoss,
  quarry,
  setPhase,
} from './boss';
import { DIRECTION_DELTA } from './movement';
import { BossBody, Direction, GameState, Player, StageRun } from './types';

const seconds = (s: number) => Math.round(s * TICK_RATE);
const EPS = 1e-6;
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const GATO_TICKS = {
  /** Walking before a charge; shorter from half health on. */
  walk: seconds(2.4),
  angryWalk: seconds(1.6),
  /** The glow before the zap: time to get out of the line. */
  charge: seconds(1),
  zap: seconds(0.35),
  drained: seconds(2),
  /** Its zap fried a generator: dizzy, and hurt by flames, for longer. */
  dizzy: seconds(3),
  crouch: seconds(0.5),
  pounce: seconds(0.35),
} as const;

/** Cells per second, walking; faster from half health on. */
export const GATO_SPEED = 2.2;
export const GATO_ANGRY_SPEED = 3;
/** How far it pounces. */
export const POUNCE_CELLS = 3;
/** From half health on, the lights go out this often, for this long. */
export const BLACKOUT_EVERY = seconds(10);
export const BLACKOUT_TICKS = seconds(2);

/** The Gato's tick. Returns the players it caught: zapped, pounced on or touched. */
export function advanceGato(state: GameState, run: StageRun): Player[] {
  const boss = run.boss;
  if (!boss) return [];
  advanceMounds(state, run, boss.alive);
  if (!boss.alive) return [];
  hurtBoss(state, run, boss);
  if (!boss.alive) return [];
  if (boss.hp <= boss.maxHp / 2) boss.blackoutSinceTick ??= state.tick;

  const caught: Player[] = [];
  switch (boss.phase) {
    case 'walk':
      walk(state, run, boss);
      break;
    case 'pounce':
      leap(state, boss);
      break;
    case 'zap':
      caught.push(...zapped(state, boss));
      break;
  }
  if (state.tick >= boss.phaseEndsAtTick)
    caught.push(...next(state, run, boss));
  if (boss.phase !== 'drained' && boss.phase !== 'stunned') {
    for (const p of state.players) {
      if (!touchable(p) || caught.includes(p)) continue;
      if (
        Math.abs(p.x - boss.x) < BOSS_REACH &&
        Math.abs(p.y - boss.y) < BOSS_REACH
      )
        caught.push(p);
    }
  }
  return caught;
}

/** Whether the lights are out: from half health on, now and then. */
export function isBlackout(state: GameState, boss: BossBody | null): boolean {
  const since = boss?.alive ? boss.blackoutSinceTick : null;
  if (since === null || since === undefined) return false;
  return (
    (state.tick - since) % BLACKOUT_EVERY >= BLACKOUT_EVERY - BLACKOUT_TICKS
  );
}

function touchable(p: Player): boolean {
  return p.alive && !p.jump && !p.flight && !p.carriedBy;
}

/** What follows the phase that just ended. */
function next(state: GameState, run: StageRun, boss: BossBody): Player[] {
  switch (boss.phase) {
    case 'up':
    case 'drained':
    case 'stunned':
    case 'pounce':
      startWalk(state, boss);
      return [];
    case 'walk': {
      // A step under way is finished first.
      if (!atCentre(boss)) return [];
      boss.cycles = (boss.cycles ?? 0) + 1;
      const landing =
        boss.cycles % 3 === 0 ? pounceLanding(state, run, boss) : null;
      if (landing) {
        boss.from = { col: boss.x, row: boss.y };
        boss.target = { col: landing[0], row: landing[1] };
        setPhase(state, boss, 'crouch', GATO_TICKS.crouch);
      } else {
        boss.zap = shockCells(state, run, boss);
        setPhase(state, boss, 'charge', GATO_TICKS.charge);
        state.events.push({ type: 'boss-charge', col: boss.x, row: boss.y });
      }
      return [];
    }
    case 'crouch':
      setPhase(state, boss, 'pounce', GATO_TICKS.pounce);
      return [];
    case 'charge': {
      boss.zap = shockCells(state, run, boss);
      setPhase(state, boss, 'zap', GATO_TICKS.zap);
      state.events.push({ type: 'boss-zap', col: boss.x, row: boss.y });
      // The shock sets off any bomb in its way, like a flame would.
      for (const bomb of state.bombs)
        if (boss.zap.some((c) => c.col === bomb.col && c.row === bomb.row))
          bomb.fuse = 0;
      const fried = run.mounds.filter(
        (m) =>
          m.alive && boss.zap?.some((c) => c.col === m.col && c.row === m.row),
      );
      for (const mound of fried) {
        mound.alive = false;
        state.events.push({
          type: 'mound-destroyed',
          col: mound.col,
          row: mound.row,
        });
      }
      boss.fried = fried.length > 0;
      return zapped(state, boss);
    }
    case 'zap': {
      boss.zap = [];
      const dizzy = !!boss.fried;
      boss.fried = false;
      setPhase(
        state,
        boss,
        dizzy ? 'stunned' : 'drained',
        dizzy ? GATO_TICKS.dizzy : GATO_TICKS.drained,
      );
      return [];
    }
    default:
      startWalk(state, boss);
      return [];
  }
}

function startWalk(state: GameState, boss: BossBody): void {
  boss.x = Math.round(boss.x);
  boss.y = Math.round(boss.y);
  boss.from = { col: boss.x, row: boss.y };
  boss.target = { col: boss.x, row: boss.y };
  const angry = boss.hp <= boss.maxHp / 2;
  setPhase(state, boss, 'walk', angry ? GATO_TICKS.angryWalk : GATO_TICKS.walk);
}

function atCentre(boss: BossBody): boolean {
  return (
    Math.abs(boss.x - Math.round(boss.x)) < EPS &&
    Math.abs(boss.y - Math.round(boss.y)) < EPS
  );
}

/** A cell at a time, always the way that brings it closest to its quarry. */
function walk(state: GameState, run: StageRun, boss: BossBody): void {
  const speed = boss.hp <= boss.maxHp / 2 ? GATO_ANGRY_SPEED : GATO_SPEED;
  let budget = speed / TICK_RATE;
  for (let step = 0; step < 2 && budget > EPS; step++) {
    if (atCentre(boss)) {
      if (state.tick >= boss.phaseEndsAtTick) return;
      const col = Math.round(boss.x);
      const row = Math.round(boss.y);
      const goal = quarry(state, boss);
      const ways = DIRECTIONS.filter((d) => {
        const [dx, dy] = DIRECTION_DELTA[d];
        return freeFloor(state, run, col + dx, row + dy);
      });
      if (!goal || ways.length === 0) return;
      const distance = (d: Direction) => {
        const [dx, dy] = DIRECTION_DELTA[d];
        return Math.abs(goal[0] - (col + dx)) + Math.abs(goal[1] - (row + dy));
      };
      const way = ways.reduce((a, b) => (distance(b) < distance(a) ? b : a));
      if (distance(way) >= Math.abs(goal[0] - col) + Math.abs(goal[1] - row))
        return;
      const [dx, dy] = DIRECTION_DELTA[way];
      boss.from = { col, row };
      boss.target = { col: col + dx, row: row + dy };
    }
    const tx = boss.target.col - boss.x;
    const ty = boss.target.row - boss.y;
    const left = Math.abs(tx) + Math.abs(ty);
    const move = Math.min(left, budget);
    boss.x += Math.sign(tx) * move;
    boss.y += Math.sign(ty) * move;
    budget -= move;
    if (move >= left - EPS) {
      boss.x = boss.target.col;
      boss.y = boss.target.row;
    }
  }
}

/**
 * Its row and column, out from it until something stops the shock: a crate
 * or a pillar stands in its way; one of its generators takes it — and is gone.
 */
function shockCells(
  state: GameState,
  run: StageRun,
  boss: BossBody,
): { col: number; row: number }[] {
  const col = Math.round(boss.x);
  const row = Math.round(boss.y);
  const cells = [{ col, row }];
  for (const way of DIRECTIONS) {
    const [dx, dy] = DIRECTION_DELTA[way];
    for (let c = col + dx, r = row + dy; ; c += dx, r += dy) {
      if (tileAt(state, c, r) !== 'empty') break;
      cells.push({ col: c, row: r });
      if (run.mounds.some((m) => m.alive && m.col === c && m.row === r)) break;
    }
  }
  return cells;
}

/** Whoever stands in the shock while it lasts. */
function zapped(state: GameState, boss: BossBody): Player[] {
  const cells = boss.zap ?? [];
  return state.players.filter(
    (p) =>
      touchable(p) &&
      cells.some(
        (c) => Math.abs(p.x - c.col) < 0.5 && Math.abs(p.y - c.row) < 0.5,
      ),
  );
}

/** A player within its leap in a straight line, and free floor to land on there. */
function pounceLanding(
  state: GameState,
  run: StageRun,
  boss: BossBody,
): [number, number] | null {
  const col = Math.round(boss.x);
  const row = Math.round(boss.y);
  for (const p of state.players) {
    if (!touchable(p)) continue;
    const pc = Math.round(p.x);
    const pr = Math.round(p.y);
    const inLine = pc === col || pr === row;
    const distance = Math.abs(pc - col) + Math.abs(pr - row);
    if (!inLine || distance === 0 || distance > POUNCE_CELLS) continue;
    if (freeFloor(state, run, pc, pr)) return [pc, pr];
  }
  return null;
}

/** In the air: from where it crouched to where it lands, over anything. */
function leap(state: GameState, boss: BossBody): void {
  const span = Math.max(1, boss.phaseEndsAtTick - boss.phaseStartedAtTick);
  const t = Math.min(1, (state.tick - boss.phaseStartedAtTick) / span);
  boss.x = boss.from.col + (boss.target.col - boss.from.col) * t;
  boss.y = boss.from.row + (boss.target.row - boss.from.row) * t;
}
