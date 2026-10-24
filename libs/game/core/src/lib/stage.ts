/**
 * Stage mode: a round of the campaign. The players are on the same side;
 * the arena holds the stage's creatures and a gate hidden under a block. The
 * last creature to fall opens the gate; once every player still standing has
 * gone through it the stage is cleared, and if nobody is left it has failed.
 * A player who falls is out until the stage ends: if the others clear it,
 * they come back next stage with nothing (see `kitsAfterStage`).
 *
 * Everything here is driven from `tick` in `game.ts`, and is as
 * deterministic as the rest: a creature's choices come from the stage's seed
 * and the tick, never from `Math.random()`.
 */
import { cellIndex, inBounds, tileAt } from './arena';
import {
  areaOfStage,
  CreatureId,
  CreatureMove,
  findCreature,
  findStage,
  foesOf,
} from './campaign';
import {
  FLAME_TICKS,
  ROUND_END_DELAY_TICKS,
  TICK_RATE,
  VIEW_COLS,
} from './constants';
import { advanceBoss, isMoundAt, setUpBoss } from './boss';
import { advanceView } from './view';
import { advanceGato } from './gato';
import {
  advanceParts,
  arePartsDone,
  isAnyoneComingBack,
  partRuns,
  setUpParts,
} from './parts';
import { kitOf, PlayerKit, START_KIT } from './kit';
import { award } from './score';
import { DIRECTION_DELTA } from './movement';
import { createRng, shuffle } from './rng';
import {
  CreatureBody,
  Direction,
  GameState,
  Player,
  PowerUpKind,
  StageRun,
} from './types';

const EPS = 1e-6;
const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const REVERSE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Creatures start at least this far (walking-grid distance) from any player's spawn. */
export const CREATURE_SPAWN_DISTANCE = 4;
/** The gate is hidden at least this far from any player's spawn. */
export const EXIT_DISTANCE = 5;
/** Share of the arena's blocks a stage clears away: room for creatures to walk. */
export const STAGE_BLOCK_THINNING = 0.4;
/** A creature and a player closer than this on both axes touch: the player is caught. */
export const CREATURE_REACH = 0.7;
/** How close to the gate's centre a player has to be to go through it. */
export const EXIT_REACH = 0.3;

/** Points per second left on the clock, for each player who gets through the gate. */
export const TIME_BONUS_PER_SECOND = 10;
/** A flame on the uncovered gate brings out this many creatures. */
export const EXIT_BOMB_SPAWN = 2;
/**
 * With a team, the gate stays open this long after the first one is through:
 * time for the others to reach it with what they picked up. Then it shuts.
 */
export const EXIT_GRACE_TICKS = 5 * TICK_RATE;
/** How long a snail's slime stays on the floor, and slows whoever steps in it. */
export const SLIME_TICKS = 5 * TICK_RATE;
export const SLIMED_TICKS = Math.round(1.5 * TICK_RATE);
/** How long a gambá plays dead after its first flame, and how much faster it runs after. */
export const PLAYDEAD_TICKS = 3 * TICK_RATE;
export const RUSH_SPEEDUP = 1.45;
/** A curto's burst when it falls: a bomb's cross of this reach, that burns anyone. */
export const BURST_RANGE = 2;
/** Who a curto's burst belongs to: no player — it hurts everyone, and scores for nobody. */
export const BURST_OWNER = 'curto';
/** How far a quero-quero sees down a line, and how fast it dashes. */
export const CHARGE_SIGHT = 5;
export const CHARGE_SPEED = 5;
/** What a bonus stage hides under its blocks: one item each, in this mix. */
const BONUS_ITEMS: readonly PowerUpKind[] = [
  'bomb',
  'fire',
  'bomb',
  'fire',
  'speed',
  'kick',
  'glove',
  'remote',
  'pierce',
  'vest',
];

/** The map a stage is played on; `undefined` for an unknown stage. */
export function stageMapId(stageId: string) {
  return areaOfStage(stageId)?.mapId;
}

/**
 * Sets a stage up on a freshly created round: thins the blocks, places the
 * creatures and hides the gate. Called by `createGame` when it gets a
 * `stageId`; the arena is already the stage's map.
 */
export function setUpStage(
  state: GameState,
  stageId: string,
  seed: number,
): void {
  const area = areaOfStage(stageId);
  const stage = area?.stages.find((s) => s.id === stageId);
  if (!area || !stage) throw new Error(`Unknown stage: ${stageId}`);
  const rng = createRng(seed ^ 0x5eed);
  // Where the players start: on a fresh round, every one is still on their spawn.
  const spawns = state.players.map((p): [number, number] => [
    Math.round(p.x),
    Math.round(p.y),
  ]);
  const distance = (col: number, row: number) =>
    Math.min(...spawns.map(([c, r]) => Math.abs(c - col) + Math.abs(r - row)));

  // Fewer blocks than a versus round: the creatures need room to walk.
  // A bonus stage keeps them all, an item under each.
  state.tiles.forEach((tile, i) => {
    if (tile !== 'block') return;
    if (stage.bonus) {
      state.hiddenPowerUps[i] =
        BONUS_ITEMS[Math.floor(rng() * BONUS_ITEMS.length)] ?? 'bomb';
    } else if (rng() < STAGE_BLOCK_THINNING) {
      state.tiles[i] = 'empty';
      state.hiddenPowerUps[i] = null;
    }
  });

  const open: [number, number][] = [];
  const blocks: [number, number][] = [];
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const tile = tileAt(state, col, row);
      if (tile === 'wall') continue;
      if (tile === 'block' && distance(col, row) >= EXIT_DISTANCE)
        blocks.push([col, row]);
      if (distance(col, row) >= CREATURE_SPAWN_DISTANCE) open.push([col, row]);
    }
  }

  // The gate first, under a block — in the open, in the middle, on a bonus
  // stage; then the creatures, on other cells.
  const exit: [number, number] = stage.bonus
    ? [Math.floor(state.cols / 2), Math.floor(state.rows / 2)]
    : (shuffle(blocks, rng)[0] ?? [state.cols - 2, state.rows - 2]);
  const exitIndex = cellIndex(state, ...exit);
  state.tiles[exitIndex] = stage.bonus ? 'empty' : 'block';
  state.hiddenPowerUps[exitIndex] = null;
  // The stage's own extras, under blocks other than the gate's.
  const hideouts = shuffle(
    blocks.filter(([c, r]) => c !== exit[0] || r !== exit[1]),
    rng,
  );
  (stage.items ?? []).forEach((kind, i) => {
    const cell = hideouts[i];
    if (cell) state.hiddenPowerUps[cellIndex(state, ...cell)] = kind;
  });

  const cells = shuffle(
    open.filter(([c, r]) => c !== exit[0] || r !== exit[1]),
    rng,
  );
  const kinds: CreatureId[] = stage.foes.flatMap((f) =>
    Array.from({ length: f.count }, () => f.creature),
  );
  const creatures: CreatureBody[] = kinds.map((creatureId, i) => {
    const [col, row] = cells[i % Math.max(cells.length, 1)] ?? exit;
    // A creature starts on open floor: whatever block was there is gone.
    const index = cellIndex(state, col, row);
    state.tiles[index] = 'empty';
    state.hiddenPowerUps[index] = null;
    return {
      id: i + 1,
      creatureId,
      x: col,
      y: row,
      facing: DIRECTIONS[Math.floor(rng() * 4)] as Direction,
      hp: findCreature(creatureId).hp,
      hurtUntilTick: 0,
      alive: true,
      diedAtTick: null,
    };
  });

  const run: StageRun = {
    stageId,
    seed,
    creatures,
    exit: { col: exit[0], row: exit[1] },
    exited: [],
    result: null,
    boss: null,
    mounds: [],
    bonus: !!stage.bonus,
    score: {},
    livesGained: {},
    slime: [],
    exitHurtUntilTick: 0,
    exitClosesAtTick: null,
    view: state.cols > VIEW_COLS ? 0 : null,
    heldSinceTick: null,
    parts: partRuns(stage.parts ?? []),
    part: 0,
    key: null,
    lives: {},
    helmets: [],
    arcs: [],
    cables: [],
    sparks: [],
    scrolledAtTick: 0,
  };
  if (stage.parts) setUpParts(state, run, stage, open, rng);
  // The boss's anthills take the next open cells, away from the middle where it stands.
  if (stage.boss) {
    const middle = [Math.floor(state.cols / 2), Math.floor(state.rows / 2)];
    const mounds = cells
      .slice(kinds.length)
      .filter(
        ([c, r]) =>
          Math.abs(c - (middle[0] ?? 0)) + Math.abs(r - (middle[1] ?? 0)) >= 3,
      );
    setUpBoss(state, run, stage.boss, mounds);
  }
  state.stage = run;
}

/** Whether every creature of the stage, and its boss, has fallen — the gate is open. */
export function isExitOpen(run: StageRun): boolean {
  if (run.parts.length > 0) return arePartsDone(run);
  return run.creatures.every((c) => !c.alive) && !run.boss?.alive;
}

/** Whether the gate is out in the open: its block has burnt. */
export function isExitRevealed(state: GameState, run: StageRun): boolean {
  return tileAt(state, run.exit.col, run.exit.row) === 'empty';
}

/** How many creatures are still standing. */
export function creaturesLeft(run: StageRun): number {
  // On a stage in parts, the part being played: the others are still ahead.
  const part = run.parts[run.part];
  const from = run.part === 0 ? 0 : (run.parts[run.part - 1]?.gate ?? 0);
  return run.creatures.filter(
    (c) => c.alive && (!part || (c.x > from && c.x < part.gate)),
  ).length;
}

function isFreeForCreature(
  state: GameState,
  col: number,
  row: number,
): boolean {
  if (!inBounds(state, col, row) || tileAt(state, col, row) !== 'empty')
    return false;
  if (state.bombs.some((b) => b.col === col && b.row === row)) return false;
  if (state.stage && isMoundAt(state.stage, col, row)) return false;
  return !state.burningBlocks.some((b) => b.col === col && b.row === row);
}

/** A marimbondo flies over the crates, bombs and all: only a hard wall stops it. */
function isFreeForFlyer(state: GameState, col: number, row: number): boolean {
  return inBounds(state, col, row) && tileAt(state, col, row) !== 'wall';
}

type Free = (state: GameState, col: number, row: number) => boolean;

function freeFor(move: CreatureMove): Free {
  return move === 'fly' ? isFreeForFlyer : isFreeForCreature;
}

function freeWays(
  state: GameState,
  col: number,
  row: number,
  free: Free = isFreeForCreature,
): Direction[] {
  return DIRECTIONS.filter((d) => {
    const [dx, dy] = DIRECTION_DELTA[d];
    return free(state, col + dx, row + dy);
  });
}

/** A choice for this creature on this tick: random to the eye, the same everywhere. */
function pick<T>(
  state: GameState,
  creature: CreatureBody,
  options: readonly T[],
): T | undefined {
  const run = state.stage as StageRun;
  const rng = createRng(
    run.seed ^ Math.imul(state.tick, 2654435761) ^ (creature.id * 40503),
  );
  return options[Math.floor(rng() * options.length)];
}

/**
 * Where a creature heads from the centre of a cell. `wander` keeps going and
 * only turns when blocked; `roam` takes a new way at every crossing. The
 * other ways of moving walk like `wander` until they get their own rule.
 */
function chooseWay(
  state: GameState,
  creature: CreatureBody,
  move: CreatureMove,
): Direction | null {
  const col = Math.round(creature.x);
  const row = Math.round(creature.y);
  const ways = freeWays(state, col, row, freeFor(move));
  if (ways.length === 0) return null;
  if (move === 'fly') return homeIn(state, creature, col, row, ways);
  const ahead = ways.includes(creature.facing);
  if (move === 'roam' && ways.length > 2) {
    const onward = ways.filter((w) => w !== REVERSE[creature.facing]);
    return pick(state, creature, onward) ?? creature.facing;
  }
  if (ahead) return creature.facing;
  const turns = ways.filter((w) => w !== REVERSE[creature.facing]);
  return pick(state, creature, turns.length > 0 ? turns : ways) ?? null;
}

/**
 * A flyer's way: the one that brings it closest to the nearest player,
 * straight on when that is as good, never straight back unless it must.
 */
function homeIn(
  state: GameState,
  creature: CreatureBody,
  col: number,
  row: number,
  ways: Direction[],
): Direction {
  const targets = state.players.filter((p) => p.alive);
  if (targets.length === 0) return ways[0] as Direction;
  const onward = ways.filter((w) => w !== REVERSE[creature.facing]);
  const options = onward.length > 0 ? onward : ways;
  const distance = (way: Direction) => {
    const [dx, dy] = DIRECTION_DELTA[way];
    return Math.min(
      ...targets.map(
        (p) => Math.abs(p.x - (col + dx)) + Math.abs(p.y - (row + dy)),
      ),
    );
  };
  return options.reduce((best, way) =>
    distance(way) < distance(best) - EPS ||
    (Math.abs(distance(way) - distance(best)) < EPS && way === creature.facing)
      ? way
      : best,
  );
}

/**
 * The quero-quero's dash: a player in its line of sight — same row or column,
 * within {@link CHARGE_SIGHT} cells, nothing in between — and it turns that
 * way and runs at them until something stops it.
 */
function spotPlayer(
  state: GameState,
  creature: CreatureBody,
): Direction | null {
  const col = Math.round(creature.x);
  const row = Math.round(creature.y);
  for (const way of DIRECTIONS) {
    const [dx, dy] = DIRECTION_DELTA[way];
    for (let i = 1; i <= CHARGE_SIGHT; i++) {
      const c = col + dx * i;
      const r = row + dy * i;
      const seen = state.players.some(
        (p) => p.alive && Math.round(p.x) === c && Math.round(p.y) === r,
      );
      if (seen) return way;
      if (!isFreeForCreature(state, c, r)) break;
    }
  }
  return null;
}

/** A snail leaves slime on every cell it stands on. */
function dropSlime(
  state: GameState,
  run: StageRun,
  col: number,
  row: number,
): void {
  const untilTick = state.tick + SLIME_TICKS;
  const here = run.slime.find((s) => s.col === col && s.row === row);
  if (here) here.untilTick = untilTick;
  else run.slime.push({ col, row, untilTick });
}

function moveCreature(state: GameState, creature: CreatureBody): void {
  const info = findCreature(creature.creatureId);
  if (isPlayingDead(state, creature)) return;
  const free = freeFor(info.move);
  if (info.move === 'charge' && !creature.charging) {
    const atCentre =
      Math.abs(creature.x - Math.round(creature.x)) < EPS &&
      Math.abs(creature.y - Math.round(creature.y)) < EPS;
    const way = atCentre ? spotPlayer(state, creature) : null;
    if (way) {
      creature.facing = way;
      creature.charging = true;
    }
  }
  const speed = creature.charging
    ? CHARGE_SPEED
    : info.speed * (creature.rushing ? RUSH_SPEEDUP : 1);
  let budget = speed / TICK_RATE;
  // At most two centres a tick: enough for any speed the game uses.
  for (let step = 0; step < 2 && budget > EPS; step++) {
    const col = Math.round(creature.x);
    const row = Math.round(creature.y);
    const atCentre =
      Math.abs(creature.x - col) < EPS && Math.abs(creature.y - row) < EPS;
    if (atCentre) {
      if (info.move === 'crawl')
        dropSlime(state, state.stage as StageRun, col, row);
      // Charging, it keeps its line until it is blocked.
      const [cx, cy] = DIRECTION_DELTA[creature.facing];
      if (creature.charging && !free(state, col + cx, row + cy))
        creature.charging = false;
      const way = creature.charging
        ? creature.facing
        : chooseWay(state, creature, info.move);
      if (!way) return;
      creature.facing = way;
    }
    const [dx, dy] = DIRECTION_DELTA[creature.facing];
    // The next centre along the way it faces, from where it is.
    const targetX = atCentre
      ? col + dx
      : dx > 0
        ? Math.ceil(creature.x - EPS)
        : dx < 0
          ? Math.floor(creature.x + EPS)
          : creature.x;
    const targetY = atCentre
      ? row + dy
      : dy > 0
        ? Math.ceil(creature.y - EPS)
        : dy < 0
          ? Math.floor(creature.y + EPS)
          : creature.y;
    // A bomb dropped in its path since it set off: it turns back.
    if (!free(state, Math.round(targetX), Math.round(targetY))) {
      creature.facing = REVERSE[creature.facing];
      creature.charging = false;
      return;
    }
    const left =
      Math.abs(targetX - creature.x) + Math.abs(targetY - creature.y);
    const move = Math.min(left, budget);
    creature.x += dx * move;
    creature.y += dy * move;
    budget -= move;
    if (move >= left - EPS) {
      creature.x = targetX;
      creature.y = targetY;
    }
  }
}

/** Flames hurt each creature once; a falling wall crushes it. */
function hurtCreatures(state: GameState, run: StageRun): void {
  for (const creature of run.creatures) {
    if (!creature.alive) continue;
    const col = Math.round(creature.x);
    const row = Math.round(creature.y);
    // A wall that dropped on it — the real one: past the edge of a long
    // stage's screen everything reads as wall, and the creatures there wait.
    const crushed = state.tiles[cellIndex(state, col, row)] === 'wall';
    const flame = state.flames.find((f) => f.col === col && f.row === row);
    if (!crushed && (!flame || state.tick < creature.hurtUntilTick)) continue;
    creature.hp = crushed ? 0 : creature.hp - 1;
    creature.hurtUntilTick = state.tick + FLAME_TICKS;
    const move = findCreature(creature.creatureId).move;
    if (creature.hp > 0) {
      if (move === 'playdead') {
        creature.downUntilTick = state.tick + PLAYDEAD_TICKS;
        creature.rushing = true;
      }
      state.events.push({ type: 'creature-hurt', col, row });
      continue;
    }
    if (move === 'volatile') burst(state, col, row);
    creature.alive = false;
    creature.diedAtTick = state.tick;
    state.events.push({
      type: 'creature-died',
      creatureId: creature.creatureId,
      col,
      row,
      killerId: flame?.ownerId ?? null,
    });
    award(
      state,
      run,
      flame?.ownerId ?? null,
      findCreature(creature.creatureId).points,
      col,
      row,
    );
  }
}

/** Lying on its back after its first flame: it neither moves nor hurts. */
export function isPlayingDead(
  state: GameState,
  creature: CreatureBody,
): boolean {
  return state.tick < (creature.downUntilTick ?? 0);
}

/**
 * A curto falls and bursts: a bomb with no fuse on its cell, of nobody's —
 * the cross burns crates, creatures and players alike.
 */
function burst(state: GameState, col: number, row: number): void {
  if (state.bombs.some((b) => b.col === col && b.row === row)) return;
  state.bombs.push({
    id: state.nextBombId++,
    col,
    row,
    ownerId: BURST_OWNER,
    fuse: 0,
    range: BURST_RANGE,
    passThrough: [],
    pierce: false,
    remote: false,
  });
}

/**
 * A flame on the gate once it is in the open — the classic mistake: more
 * creatures come out of it, of the stage's first kind, and shut it again.
 */
function bombedGate(state: GameState, run: StageRun): void {
  if (run.bonus || !isExitRevealed(state, run)) return;
  if (state.tick < run.exitHurtUntilTick) return;
  const { col, row } = run.exit;
  if (!state.flames.some((f) => f.col === col && f.row === row)) return;
  run.exitHurtUntilTick = state.tick + FLAME_TICKS;
  const stage = findStage(run.stageId);
  const kind: CreatureId = (stage && foesOf(stage)[0]?.creature) ?? 'sauva';
  let id = run.creatures.reduce((max, c) => Math.max(max, c.id), 0);
  for (let i = 0; i < EXIT_BOMB_SPAWN; i++) {
    run.creatures.push({
      id: ++id,
      creatureId: kind,
      x: col,
      y: row,
      facing: DIRECTIONS[i % DIRECTIONS.length] as Direction,
      hp: findCreature(kind).hp,
      // Born in the flame that called them: it does not hurt them.
      hurtUntilTick: state.tick + FLAME_TICKS,
      alive: true,
      diedAtTick: null,
    });
  }
  state.events.push({ type: 'exit-bombed', col, row });
}

/** Slime dries up; whoever stands in it is slowed. */
function slimePlayers(state: GameState, run: StageRun): void {
  run.slime = run.slime.filter((s) => s.untilTick > state.tick);
  for (const player of state.players) {
    if (!player.alive || player.jump) continue;
    const col = Math.round(player.x);
    const row = Math.round(player.y);
    if (run.slime.some((s) => s.col === col && s.row === row))
      player.slimedUntilTick = state.tick + SLIMED_TICKS;
  }
}

/**
 * One tick of the stage, after the players have moved and the flames have
 * spread: creatures get hurt, walk, and catch whoever they touch. Returns
 * the players caught — `game.ts` takes them out as it would for a flame, so
 * a mount still takes the first hit.
 */
export function advanceStage(state: GameState): Player[] {
  const run = state.stage;
  if (!run || run.result) return [];
  const wasOpen = isExitOpen(run);
  advanceView(state, run);
  const caught =
    run.boss?.bossId === 'gato'
      ? advanceGato(state, run)
      : advanceBoss(state, run);
  bombedGate(state, run);
  hurtCreatures(state, run);
  caught.push(...advanceParts(state, run));
  slimePlayers(state, run);
  for (const creature of run.creatures) {
    if (creature.alive) moveCreature(state, creature);
  }
  if (!wasOpen && isExitOpen(run))
    state.events.push({ type: 'exit-opened', ...run.exit });

  for (const player of state.players) {
    if (
      !player.alive ||
      player.jump ||
      player.flight ||
      player.carriedBy ||
      caught.includes(player)
    )
      continue;
    const touched = run.creatures.some(
      (c) =>
        c.alive &&
        !isPlayingDead(state, c) &&
        Math.abs(c.x - player.x) < CREATURE_REACH &&
        Math.abs(c.y - player.y) < CREATURE_REACH,
    );
    if (touched) caught.push(player);
  }
  return caught;
}

/**
 * After everything else this tick: players on the open gate go through it,
 * and the stage is decided once nobody is left in the arena.
 */
export function updateStageEnd(state: GameState): void {
  const run = state.stage;
  if (!run) return;
  if (run.result) {
    if (state.endsAtTick !== null && state.tick >= state.endsAtTick) {
      state.phase = 'over';
      state.events.push({ type: 'stage-over', result: run.result });
    }
    return;
  }
  if (isExitOpen(run) && isExitRevealed(state, run)) {
    for (const player of state.players) {
      if (!player.alive || player.jump || player.flight || player.carriedBy)
        continue;
      if (
        Math.abs(player.x - run.exit.col) < EXIT_REACH &&
        Math.abs(player.y - run.exit.row) < EXIT_REACH
      ) {
        // Through the gate: out of the arena, not dead — nothing draws them now.
        player.alive = false;
        player.moving = false;
        run.exited.push(player.id);
        state.events.push({ type: 'player-exited', playerId: player.id });
        // The first one through starts the clock on the gate for the rest.
        run.exitClosesAtTick ??= state.tick + EXIT_GRACE_TICKS;
      }
    }
  }
  // The gate shuts: whoever is still inside is left behind — on a bonus
  // stage, through with the others, as at the end of its clock.
  if (run.exitClosesAtTick !== null && state.tick >= run.exitClosesAtTick) {
    for (const player of state.players) {
      if (!player.alive) continue;
      player.alive = false;
      player.moving = false;
      if (run.bonus) run.exited.push(player.id);
      else
        state.events.push({ type: 'player-left-behind', playerId: player.id });
    }
  }
  // A bonus stage ends when its time is up: whoever is still in it is through.
  if (
    run.bonus &&
    state.closesAtTick !== null &&
    state.tick >= state.closesAtTick
  ) {
    for (const player of state.players) {
      if (!player.alive) continue;
      player.alive = false;
      player.moving = false;
      run.exited.push(player.id);
    }
  }
  if (state.players.some((p) => p.alive) || isAnyoneComingBack(state, run))
    return;
  run.result = run.exited.length > 0 ? 'cleared' : 'failed';
  state.endsAtTick = state.tick + ROUND_END_DELAY_TICKS;
  if (run.result === 'cleared' && !run.bonus) {
    // The time left on the clock is worth points to everyone who got through.
    const seconds =
      state.closesAtTick === null
        ? 0
        : Math.max(0, Math.ceil((state.closesAtTick - state.tick) / TICK_RATE));
    for (const id of run.exited)
      award(
        state,
        run,
        id,
        seconds * TIME_BONUS_PER_SECOND,
        run.exit.col,
        run.exit.row,
      );
  }
}

/**
 * What each player takes into the next stage once this one is over. With a
 * team, the stage is cleared once one of them gets through the gate and it
 * shuts {@link EXIT_GRACE_TICKS} later: those who got through keep their
 * kit, those who fell or were left behind come back next stage with the
 * starting one — dying loses it all. A lost stage (nobody through) leaves
 * everyone with nothing. `null` while the stage is still being played.
 */
export function kitsAfterStage(
  state: GameState,
): Record<string, PlayerKit> | null {
  const run = state.stage;
  if (!run?.result) return null;
  const kits: Record<string, PlayerKit> = {};
  for (const player of state.players) {
    kits[player.id] =
      run.result === 'cleared' && run.exited.includes(player.id)
        ? kitOf(player)
        : { ...START_KIT };
  }
  return kits;
}
