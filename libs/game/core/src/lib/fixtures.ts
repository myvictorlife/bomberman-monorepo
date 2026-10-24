/**
 * What a long stage builds into the floor (see `parts.ts`): arc lines that
 * shock on and off until their breaker is blown up, conductor cables that
 * carry a bomb's blast to their far end, and generators that keep sending out
 * faíscas. Breakers and generators are mounds — solid, hit by flames, the
 * same as a boss's lairs — with a `kind`.
 *
 * As deterministic as the rest: an arc's phase comes from the tick.
 */
import { isOutOfView } from './arena';
import { StagePart } from './campaign';
import { TICK_RATE } from './constants';
import { Bomb, GameState, Mound, Player, StageRun } from './types';

/** An arc line is live this long, then off this long. */
export const ARC_ON_TICKS = 2 * TICK_RATE;
export const ARC_OFF_TICKS = 2 * TICK_RATE;
/** Flames a breaker and a generator take. */
export const BREAKER_HP = 1;
export const GENERATOR_HP = 3;
/** A generator sends out a faísca this often — while it is on the screen. */
export const GENERATOR_TICKS = 5 * TICK_RATE;
/** A generator stops while this many creatures are about on the screen. */
export const GENERATOR_CROWD = 6;
/** How fast a spark runs along a cable, in cells per second. */
export const SPARK_SPEED = 12;
/** Never, as a tick that still travels as JSON. */
const NEVER = Number.MAX_SAFE_INTEGER;

/** Builds a part's arcs, cables and generators into the floor. */
export function setUpFixtures(
  state: GameState,
  run: StageRun,
  part: StagePart,
): void {
  const clear = (col: number, row: number) => {
    state.tiles[row * state.cols + col] = 'empty';
    state.hiddenPowerUps[row * state.cols + col] = null;
  };
  const mound = (col: number, row: number, kind: Mound['kind']): Mound => {
    clear(col, row);
    const made: Mound = {
      id: run.mounds.length + 1,
      col,
      row,
      hp: kind === 'breaker' ? BREAKER_HP : GENERATOR_HP,
      hurtUntilTick: 0,
      alive: true,
      nextSpawnTick: kind === 'generator' ? GENERATOR_TICKS : NEVER,
      kind,
    };
    run.mounds.push(made);
    return made;
  };
  for (const arc of part.arcs ?? []) {
    for (let col = arc.from; col <= arc.to; col++) clear(col, arc.row);
    const breaker = mound(arc.to + 1, arc.row, 'breaker');
    run.arcs.push({
      ...arc,
      breakerId: breaker.id,
      offset: run.arcs.length % 2 === 0 ? 0 : ARC_ON_TICKS,
    });
  }
  for (const cable of part.cables ?? []) {
    for (let col = cable.from; col <= cable.to; col++) clear(col, cable.row);
    run.cables.push({ ...cable });
  }
  for (const [col, row] of part.generators ?? []) mound(col, row, 'generator');
}

/** Whether an arc line is shocking right now: on until its breaker is gone, half the time. */
export function isArcLive(
  state: GameState,
  run: StageRun,
  arc: StageRun['arcs'][number],
): boolean {
  const breaker = run.mounds.find((m) => m.id === arc.breakerId);
  if (!breaker?.alive) return false;
  const cycle = ARC_ON_TICKS + ARC_OFF_TICKS;
  return (state.tick + arc.offset) % cycle < ARC_ON_TICKS;
}

/** A live arc line sets off any bomb lying on it, like a flame would. */
export function detonateOnArcs(state: GameState, run: StageRun): void {
  const live = run.arcs.filter((arc) => isArcLive(state, run, arc));
  for (const bomb of state.bombs) {
    if (bomb.fuse <= 0) continue;
    if (
      live.some(
        (arc) =>
          bomb.row === arc.row && bomb.col >= arc.from && bomb.col <= arc.to,
      )
    )
      bomb.fuse = 0;
  }
}

/** The players a live arc line catches. */
export function shockedByArcs(state: GameState, run: StageRun): Player[] {
  const live = run.arcs.filter((arc) => isArcLive(state, run, arc));
  if (live.length === 0) return [];
  return state.players.filter(
    (p) =>
      p.alive &&
      !p.jump &&
      !p.flight &&
      live.some(
        (arc) =>
          Math.abs(p.y - arc.row) < 0.5 &&
          p.x > arc.from - 0.5 &&
          p.x < arc.to + 0.5,
      ),
  );
}

/**
 * A bomb going off on a cable does not burst there: a spark runs to the
 * cable's far end — the end further from the bomb — and bursts there instead.
 * Returns whether it was carried off.
 */
export function divertAlongCable(state: GameState, bomb: Bomb): boolean {
  const run = state.stage;
  const cable = run?.cables.find(
    (c) => c.row === bomb.row && bomb.col >= c.from && bomb.col <= c.to,
  );
  if (!run || !cable || bomb.fromCable) return false;
  const to =
    Math.abs(cable.to - bomb.col) >= Math.abs(bomb.col - cable.from)
      ? cable.to
      : cable.from;
  if (to === bomb.col) return false;
  state.bombs = state.bombs.filter((b) => b !== bomb);
  run.sparks.push({
    x: bomb.col,
    row: bomb.row,
    to,
    ownerId: bomb.ownerId,
    range: bomb.range,
    pierce: bomb.pierce,
  });
  state.events.push({ type: 'cable-spark', col: bomb.col, row: bomb.row });
  return true;
}

/** Sparks run on; one at its end sets a bomb there that goes off at once. */
export function runSparks(state: GameState, run: StageRun): void {
  const step = SPARK_SPEED / TICK_RATE;
  for (const spark of [...run.sparks]) {
    const way = Math.sign(spark.to - spark.x);
    spark.x += way * step;
    if ((spark.to - spark.x) * way > 0) continue;
    run.sparks = run.sparks.filter((s) => s !== spark);
    if (state.bombs.some((b) => b.col === spark.to && b.row === spark.row))
      continue;
    state.bombs.push({
      id: state.nextBombId++,
      col: spark.to,
      row: spark.row,
      ownerId: spark.ownerId,
      fuse: 0,
      range: spark.range,
      passThrough: [],
      pierce: spark.pierce,
      remote: false,
      fromCable: true,
    });
  }
}

/** Whether a generator may send one out now: on the screen, and not too many about. */
export function mayGenerate(
  state: GameState,
  run: StageRun,
  mound: Mound,
): boolean {
  if (mound.kind !== 'generator') return true;
  if (isOutOfView(state, mound.col)) return false;
  const about = run.creatures.filter(
    (c) => c.alive && !isOutOfView(state, Math.round(c.x)),
  ).length;
  return about < GENERATOR_CROWD;
}
