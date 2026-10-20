/**
 * The bosses of the campaign, played on the last stage of an area. Area 1's
 * is the Rainha Saúva: she digs under the arena, cracks the ground where she
 * will come up — whoever stands there is caught — and comes out dizzy for a
 * moment, the only time a flame hurts her. Her anthills keep sending out
 * leafcutters until they are blown up. At half health one of two cracks is a
 * feint; on her last hits she digs faster and comes up with two ants.
 *
 * Driven from `advanceStage` in `stage.ts`; as deterministic as the rest.
 */
import { cellIndex, inBounds, tileAt } from './arena';
import { BossId, findBoss, findCreature } from './campaign';
import { FLAME_TICKS, TICK_RATE } from './constants';
import { DIRECTION_DELTA } from './movement';
import { createRng } from './rng';
import { award, BOSS_POINTS, MOUND_POINTS } from './score';
import {
  BossBody,
  CreatureBody,
  Direction,
  GameState,
  Mound,
  Player,
  StageRun,
} from './types';

const seconds = (s: number) => Math.round(s * TICK_RATE);

/** How long each part of the cycle lasts. */
export const BOSS_TICKS = {
  /** Above ground at the start, before the first dig. */
  firstUp: seconds(2),
  sinking: seconds(0.6),
  crack: seconds(1),
  /** The crack on her last hits. */
  fastCrack: seconds(0.6),
  stunned: seconds(2),
} as const;

/** Underground, in cells per second; faster on her last hits. */
export const BOSS_DIG_SPEED = 4;
export const BOSS_FAST_DIG_SPEED = 6;
/** From this many hits left she digs faster and comes up with company. */
export const BOSS_LAST_HITS = 2;
/** How many leafcutters she brings up on her last hits. */
export const BOSS_ESCORT = 2;
/** A boss and a player this close on both axes touch. */
export const BOSS_REACH = 0.7;

export const MOUND_HP = 2;
export const MOUND_COUNT = 3;
export const MOUND_SPAWN_TICKS = seconds(6);
/** The anthills stop sending ants out while this many are about. */
export const MAX_MINIONS = 6;

/** Places the boss in the middle of the arena and its anthills on `cells`. */
export function setUpBoss(
  state: GameState,
  run: StageRun,
  bossId: BossId,
  cells: readonly (readonly [number, number])[],
): void {
  const boss = findBoss(bossId);
  const col = Math.floor(state.cols / 2);
  const row = Math.floor(state.rows / 2);
  clearCell(state, col, row);
  run.boss = {
    bossId,
    hp: boss.hp,
    maxHp: boss.hp,
    phase: 'up',
    phaseStartedAtTick: 0,
    phaseEndsAtTick: BOSS_TICKS.firstUp,
    x: col,
    y: row,
    from: { col, row },
    target: { col, row },
    fakes: [],
    hurtUntilTick: 0,
    alive: true,
    diedAtTick: null,
  };
  run.mounds = cells.slice(0, MOUND_COUNT).map(([c, r], i) => {
    clearCell(state, c, r);
    return {
      id: i + 1,
      col: c,
      row: r,
      hp: MOUND_HP,
      hurtUntilTick: 0,
      alive: true,
      // Staggered, so the three do not open at once.
      nextSpawnTick: MOUND_SPAWN_TICKS + i * seconds(2),
    };
  });
}

function clearCell(state: GameState, col: number, row: number): void {
  const index = cellIndex(state, col, row);
  state.tiles[index] = 'empty';
  state.hiddenPowerUps[index] = null;
}

export function isMoundAt(run: StageRun, col: number, row: number): boolean {
  return run.mounds.some((m) => m.alive && m.col === col && m.row === row);
}

/** Above ground: where flames hurt it and touching it is deadly. */
export function isBossExposed(boss: BossBody): boolean {
  return boss.alive && (boss.phase === 'up' || boss.phase === 'stunned');
}

function flameAt(state: GameState, col: number, row: number) {
  return state.flames.find((f) => f.col === col && f.row === row);
}

function freeFloor(
  state: GameState,
  run: StageRun,
  col: number,
  row: number,
): boolean {
  return (
    inBounds(state, col, row) &&
    tileAt(state, col, row) === 'empty' &&
    !isMoundAt(run, col, row) &&
    !state.bombs.some((b) => b.col === col && b.row === row)
  );
}

function nextCreatureId(run: StageRun): number {
  return run.creatures.reduce((max, c) => Math.max(max, c.id), 0) + 1;
}

/** A leafcutter out of the ground at `col, row`, facing `facing`. */
function spawnAnt(
  run: StageRun,
  col: number,
  row: number,
  facing: Direction,
): void {
  const ant: CreatureBody = {
    id: nextCreatureId(run),
    creatureId: 'sauva',
    x: col,
    y: row,
    facing,
    hp: findCreature('sauva').hp,
    hurtUntilTick: 0,
    alive: true,
    diedAtTick: null,
  };
  run.creatures.push(ant);
}

/** Up to `count` ants on the free cells round `col, row`. */
function spawnAround(
  state: GameState,
  run: StageRun,
  col: number,
  row: number,
  count: number,
): void {
  let left = count;
  for (const way of Object.keys(DIRECTION_DELTA) as Direction[]) {
    if (left === 0) return;
    const [dx, dy] = DIRECTION_DELTA[way];
    if (!freeFloor(state, run, col + dx, row + dy)) continue;
    spawnAnt(run, col + dx, row + dy, way);
    left--;
  }
}

function minionsAbout(run: StageRun): number {
  return run.creatures.filter((c) => c.alive).length;
}

/** The anthills take flames, and send out an ant now and then while the boss lives. */
function advanceMounds(
  state: GameState,
  run: StageRun,
  bossAlive: boolean,
): void {
  for (const mound of run.mounds) {
    if (!mound.alive) continue;
    const flame = flameAt(state, mound.col, mound.row);
    if (flame && state.tick >= mound.hurtUntilTick) {
      mound.hp--;
      mound.hurtUntilTick = state.tick + FLAME_TICKS;
      if (mound.hp <= 0) {
        mound.alive = false;
        state.events.push({
          type: 'mound-destroyed',
          col: mound.col,
          row: mound.row,
        });
        award(state, run, flame.ownerId, MOUND_POINTS, mound.col, mound.row);
        continue;
      }
      state.events.push({ type: 'mound-hurt', col: mound.col, row: mound.row });
    }
    if (!bossAlive || state.tick < mound.nextSpawnTick) continue;
    mound.nextSpawnTick = state.tick + MOUND_SPAWN_TICKS;
    if (minionsAbout(run) < MAX_MINIONS)
      spawnAround(state, run, mound.col, mound.row, 1);
  }
}

/** The nearest player still in the arena, as a cell — where the boss heads for. */
function quarry(state: GameState, boss: BossBody): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDistance = Infinity;
  for (const p of state.players) {
    if (!p.alive) continue;
    const cell: [number, number] = [Math.round(p.x), Math.round(p.y)];
    const d = Math.abs(cell[0] - boss.x) + Math.abs(cell[1] - boss.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = cell;
    }
  }
  return best;
}

function setPhase(
  state: GameState,
  boss: BossBody,
  phase: BossBody['phase'],
  ticks: number,
): void {
  boss.phase = phase;
  boss.phaseStartedAtTick = state.tick;
  boss.phaseEndsAtTick = state.tick + Math.max(1, ticks);
}

function lastHits(boss: BossBody): boolean {
  return boss.hp <= BOSS_LAST_HITS;
}

/** Goes under: heads for the nearest player, with a feint from half health on. */
function dig(state: GameState, run: StageRun, boss: BossBody): void {
  const target = quarry(state, boss) ?? [
    Math.round(boss.x),
    Math.round(boss.y),
  ];
  boss.from = { col: Math.round(boss.x), row: Math.round(boss.y) };
  boss.target = { col: target[0], row: target[1] };
  boss.fakes = [];
  if (boss.hp <= boss.maxHp / 2) {
    const rng = createRng(run.seed ^ Math.imul(state.tick, 2654435761));
    const free: [number, number][] = [];
    for (let row = 1; row < state.rows - 1; row++)
      for (let col = 1; col < state.cols - 1; col++)
        if (
          freeFloor(state, run, col, row) &&
          Math.abs(col - target[0]) + Math.abs(row - target[1]) >= 3
        )
          free.push([col, row]);
    const fake = free[Math.floor(rng() * free.length)];
    if (fake) boss.fakes.push({ col: fake[0], row: fake[1] });
  }
  const distance =
    Math.abs(boss.target.col - boss.from.col) +
    Math.abs(boss.target.row - boss.from.row);
  const speed = lastHits(boss) ? BOSS_FAST_DIG_SPEED : BOSS_DIG_SPEED;
  setPhase(state, boss, 'under', Math.round((distance / speed) * TICK_RATE));
  state.events.push({
    type: 'boss-dug',
    col: boss.from.col,
    row: boss.from.row,
  });
}

/** Underground: the mound of earth runs along the columns, then the rows. */
function burrow(state: GameState, boss: BossBody): void {
  const span = boss.phaseEndsAtTick - boss.phaseStartedAtTick;
  const t = Math.min(1, (state.tick - boss.phaseStartedAtTick) / span);
  const dx = boss.target.col - boss.from.col;
  const dy = boss.target.row - boss.from.row;
  const total = Math.abs(dx) + Math.abs(dy) || 1;
  const along = t * total;
  const first = Math.min(along, Math.abs(dx));
  boss.x = boss.from.col + Math.sign(dx) * first;
  boss.y = boss.from.row + Math.sign(dy) * Math.max(0, along - Math.abs(dx));
}

/** Out of the ground: whoever stands there is caught, a block there breaks, a bomb goes off. */
function emerge(state: GameState, run: StageRun, boss: BossBody): Player[] {
  const { col, row } = boss.target;
  boss.x = col;
  boss.y = row;
  if (tileAt(state, col, row) === 'block') clearCell(state, col, row);
  for (const bomb of state.bombs)
    if (bomb.col === col && bomb.row === row) bomb.fuse = 0;
  boss.fakes = [];
  setPhase(state, boss, 'stunned', BOSS_TICKS.stunned);
  state.events.push({ type: 'boss-emerged', col, row });
  if (lastHits(boss)) spawnAround(state, run, col, row, BOSS_ESCORT);
  return state.players.filter(
    (p) =>
      p.alive &&
      !p.jump &&
      Math.abs(p.x - col) < BOSS_REACH &&
      Math.abs(p.y - row) < BOSS_REACH,
  );
}

/** One flame, one hit — only while it is out of the ground. Its fall takes its creatures with it. */
function hurtBoss(state: GameState, run: StageRun, boss: BossBody): void {
  if (!isBossExposed(boss) || state.tick < boss.hurtUntilTick) return;
  const col = Math.round(boss.x);
  const row = Math.round(boss.y);
  const flame = flameAt(state, col, row);
  if (!flame) return;
  boss.hp--;
  boss.hurtUntilTick = state.tick + FLAME_TICKS;
  if (boss.hp > 0) {
    state.events.push({ type: 'boss-hurt', col, row });
    return;
  }
  boss.alive = false;
  boss.diedAtTick = state.tick;
  state.events.push({ type: 'boss-died', col, row, killerId: flame.ownerId });
  award(state, run, flame.ownerId, BOSS_POINTS, col, row);
  for (const creature of run.creatures) {
    if (!creature.alive) continue;
    creature.alive = false;
    creature.diedAtTick = state.tick;
  }
  for (const mound of run.mounds) mound.alive = false;
}

/**
 * One tick of the boss and its anthills. Returns the players it caught —
 * coming up under them, or touched while it is out.
 */
export function advanceBoss(state: GameState, run: StageRun): Player[] {
  const boss = run.boss;
  if (!boss) return [];
  advanceMounds(state, run, boss.alive);
  if (!boss.alive) return [];
  hurtBoss(state, run, boss);
  if (!boss.alive) return [];

  let caught: Player[] = [];
  if (boss.phase === 'under') burrow(state, boss);
  if (state.tick >= boss.phaseEndsAtTick) {
    switch (boss.phase) {
      case 'up':
      case 'stunned':
        setPhase(state, boss, 'sinking', BOSS_TICKS.sinking);
        break;
      case 'sinking':
        dig(state, run, boss);
        break;
      case 'under':
        setPhase(
          state,
          boss,
          'crack',
          lastHits(boss) ? BOSS_TICKS.fastCrack : BOSS_TICKS.crack,
        );
        state.events.push({ type: 'boss-crack', ...boss.target });
        break;
      case 'crack':
        caught = emerge(state, run, boss);
        break;
    }
  }
  if (isBossExposed(boss)) {
    for (const p of state.players) {
      if (!p.alive || p.jump || p.flight || p.carriedBy || caught.includes(p))
        continue;
      if (
        Math.abs(p.x - boss.x) < BOSS_REACH &&
        Math.abs(p.y - boss.y) < BOSS_REACH
      )
        caught.push(p);
    }
  }
  return caught;
}
