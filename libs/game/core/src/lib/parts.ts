/**
 * A stage in parts: a long arena crossed a screen at a time (see `view.ts`).
 * Each part's gate is the column past its last one; until the part's goal is
 * met the screen cannot reach past it, so it stands there as a wall. Met, the
 * gate opens, the next part's clock starts, and the screen moves on with the
 * team. The last part's goal opens the stage's own gate, at the far end.
 *
 * Here a fall is not the end: it spends a life, and a moment later the
 * player is back on the screen's left edge, untouchable for a while. With no
 * life left they leave a helmet where they fell; a teammate who reaches it
 * brings them back. The stage is lost when nobody is standing and nobody is
 * coming back — or when a part's clock runs out.
 */
import { tileAt } from './arena';
import {
  CreatureId,
  findCreature,
  Stage,
  StagePart,
  START_LIVES,
} from './campaign';
import { DEATH_TICKS, TICK_RATE, VIEW_COLS } from './constants';
import { advanceMounds } from './boss';
import { crush } from './closing';
import {
  detonateOnArcs,
  runSparks,
  setUpFixtures,
  shockedByArcs,
} from './fixtures';
import { shuffle } from './rng';
import {
  CreatureBody,
  Direction,
  GameState,
  PartRun,
  Player,
  StageRun,
} from './types';

/** How long after a fall a player with a life to spend is back. */
export const RESPAWN_TICKS = DEATH_TICKS + Math.round(0.5 * TICK_RATE);
/** Back from a fall or a rescue, a player blinks this long, untouchable. */
export const RESPAWN_SHIELD_TICKS = 2 * TICK_RATE;
/** How close a player has to come to the key, or to a helmet, to take it. */
export const PICK_REACH = 0.6;
/** A part's creatures start at least this many columns in from the gate the team comes through. */
export const PART_ENTRY_DISTANCE = 4;

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** The parts as a fresh stage starts them: none met, the first one's clock running. */
export function partRuns(parts: readonly StagePart[]): PartRun[] {
  return parts.map((part) => ({
    gate: part.until + 1,
    goal: part.goal,
    done: false,
    ticks: part.seconds * TICK_RATE,
  }));
}

/**
 * Puts each part's creatures in its own columns — away from where the team
 * comes in — gives the key to one of a `key` part's, and the stage's gate to
 * the far end of the last part, in the open.
 */
export function setUpParts(
  state: GameState,
  run: StageRun,
  stage: Stage,
  open: readonly [number, number][],
  rng: () => number,
): void {
  const parts = stage.parts ?? [];
  for (const part of parts) setUpFixtures(state, run, part);
  // Not on what the floor now holds: a breaker, a generator, an arc line.
  const free = open.filter(
    ([c, r]) =>
      !run.mounds.some((m) => m.col === c && m.row === r) &&
      !run.arcs.some((a) => a.row === r && c >= a.from && c <= a.to),
  );
  let from = 1;
  parts.forEach((part) => {
    // Away from the players on the first screen, away from the gate behind on the others.
    const cells = shuffle(
      free.filter(
        ([c]) =>
          c <= part.until && c >= from + (from > 1 ? PART_ENTRY_DISTANCE : 0),
      ),
      rng,
    );
    const kinds: CreatureId[] = part.foes.flatMap((f) =>
      Array.from({ length: f.count }, () => f.creature),
    );
    const placed = kinds.map((creatureId, i) =>
      placeCreature(
        state,
        run,
        creatureId,
        cells[i % Math.max(cells.length, 1)],
        rng,
      ),
    );
    const carrier = placed[0];
    if (part.goal === 'key' && carrier)
      run.key = { col: carrier.x, row: carrier.y, carrierId: carrier.id };
    from = part.until + 2;
  });
  const exit = { col: state.cols - 2, row: Math.floor(state.rows / 2) };
  run.exit = exit;
  state.tiles[exit.row * state.cols + exit.col] = 'empty';
  state.hiddenPowerUps[exit.row * state.cols + exit.col] = null;
}

function placeCreature(
  state: GameState,
  run: StageRun,
  creatureId: CreatureId,
  cell: readonly [number, number] | undefined,
  rng: () => number,
): CreatureBody {
  const [col, row] = cell ?? [state.cols - 2, 1];
  const index = row * state.cols + col;
  state.tiles[index] = 'empty';
  state.hiddenPowerUps[index] = null;
  const creature: CreatureBody = {
    id: run.creatures.length + 1,
    creatureId,
    x: col,
    y: row,
    facing: DIRECTIONS[Math.floor(rng() * 4)] as Direction,
    hp: findCreature(creatureId).hp,
    hurtUntilTick: 0,
    alive: true,
    diedAtTick: null,
  };
  run.creatures.push(creature);
  return creature;
}

/** The lives each player brings to a stage in parts; nothing on any other stage. */
export function startLives(
  run: StageRun,
  players: readonly { id: string; lives?: number }[],
): void {
  if (run.parts.length === 0) return;
  for (const p of players)
    run.lives[p.id] = Math.max(1, p.lives ?? START_LIVES);
}

/** The furthest the screen may go: up to the gate of the part being played. */
export function viewLimit(state: GameState, run: StageRun): number {
  const last = state.cols - VIEW_COLS;
  const part = run.parts[run.part];
  // The last part has no gate of its own: the far wall ends it.
  const isLast = run.part === run.parts.length - 1;
  return part && !part.done && !isLast
    ? Math.min(last, part.gate - VIEW_COLS)
    : last;
}

/** Whether every part's goal is met: the stage's gate is open. */
export function arePartsDone(run: StageRun): boolean {
  return run.parts.every((p) => p.done);
}

/** Whether the screen is running on by itself: a `survive` part being played. */
export function isScrolling(run: StageRun): boolean {
  const part = run.parts[run.part];
  return !!part && part.goal === 'survive' && !part.done;
}

/**
 * Once per tick on a stage in parts: the floor's generators, breakers and
 * sparks, the key, the goal of the part being played, its clock, falls and
 * rescues. Returns the players caught — on a live arc line, or by the
 * burning edge of a running screen.
 */
export function advanceParts(state: GameState, run: StageRun): Player[] {
  if (run.parts.length === 0 || run.result) return [];
  if (!run.boss) advanceMounds(state, run, true);
  runSparks(state, run);
  carryKey(state, run);
  const part = run.parts[run.part];
  if (part && !part.done && isGoalMet(state, run, part))
    openGate(state, run, part);
  detonateOnArcs(state, run);
  const caught = shockedByArcs(state, run);
  if (isScrolling(run)) {
    // The edge burns: whoever lingers on it is caught.
    const edge = (run.view ?? 0) + 0.5;
    for (const p of state.players)
      if (p.alive && !p.flight && !p.jump && p.x < edge && !caught.includes(p))
        caught.push(p);
  }
  if (
    state.closesAtTick !== null &&
    state.tick >= state.closesAtTick &&
    !arePartsDone(run)
  )
    runOut(state, run);
  comeBack(state, run);
  return caught;
}

/** The key goes with its creature, drops where it falls, and is taken by the first player there. */
function carryKey(state: GameState, run: StageRun): void {
  const key = run.key;
  if (!key) return;
  if (key.carrierId !== null) {
    const carrier = run.creatures.find((c) => c.id === key.carrierId);
    if (carrier) {
      key.col = Math.round(carrier.x);
      key.row = Math.round(carrier.y);
    }
    if (carrier?.alive) return;
    key.carrierId = null;
    state.events.push({ type: 'key-dropped', col: key.col, row: key.row });
  }
  const taker = state.players.find(
    (p) => p.alive && !p.flight && near(p, key.col, key.row),
  );
  if (!taker) return;
  run.key = null;
  state.events.push({ type: 'key-taken', playerId: taker.id });
}

function isGoalMet(state: GameState, run: StageRun, part: PartRun): boolean {
  const from = run.part === 0 ? 0 : (run.parts[run.part - 1]?.gate ?? 0);
  const inPart = (col: number) => col > from && col < part.gate;
  switch (part.goal) {
    case 'key':
      return run.key === null;
    case 'breakers':
    case 'generators': {
      const kind = part.goal === 'breakers' ? 'breaker' : 'generator';
      return !run.mounds.some(
        (m) => m.alive && m.kind === kind && inPart(m.col),
      );
    }
    case 'survive':
      return run.view !== null && run.view >= state.cols - VIEW_COLS;
    default:
      return !run.creatures.some((c) => c.alive && inPart(c.x));
  }
}

function openGate(state: GameState, run: StageRun, part: PartRun): void {
  part.done = true;
  const next = run.parts[run.part + 1];
  if (next) {
    run.part += 1;
    run.scrolledAtTick = state.tick;
    state.closesAtTick = state.tick + next.ticks;
    state.events.push({ type: 'gate-opened', col: part.gate });
  } else {
    // The last part: the stage's gate opens (see `isExitOpen`), the clock stops.
    state.closesAtTick = null;
  }
}

/** A part's clock ran out: the substation shorts — everyone standing falls, nobody comes back. */
function runOut(state: GameState, run: StageRun): void {
  for (const player of state.players) {
    run.lives[player.id] = 0;
    if (player.alive) crush(state, player);
  }
  run.helmets = [];
  state.closesAtTick = null;
}

/** Falls spend a life and come back on the left edge; with none left they leave a helmet. */
function comeBack(state: GameState, run: StageRun): void {
  for (const player of state.players) {
    if (player.alive || player.diedAtTick === null) continue;
    if (run.exited.includes(player.id)) continue;
    if (run.helmets.some((h) => h.playerId === player.id)) continue;
    if (state.tick - player.diedAtTick < RESPAWN_TICKS) continue;
    const lives = run.lives[player.id] ?? 0;
    if (lives > 0) {
      run.lives[player.id] = lives - 1;
      run.livesGained[player.id] = (run.livesGained[player.id] ?? 0) - 1;
      const [col, row] = edgeCell(state, run, Math.round(player.y));
      revive(state, player, col, row);
      state.events.push({ type: 'player-respawned', playerId: player.id });
    } else if (state.players.some((p) => p.alive)) {
      run.helmets.push({
        playerId: player.id,
        col: Math.round(player.x),
        row: Math.round(player.y),
      });
    }
  }
  for (const helmet of [...run.helmets]) {
    const rescuer = state.players.find(
      (p) => p.alive && !p.flight && near(p, helmet.col, helmet.row),
    );
    const fallen = state.players.find((p) => p.id === helmet.playerId);
    if (!rescuer || !fallen) continue;
    run.helmets = run.helmets.filter((h) => h !== helmet);
    revive(state, fallen, helmet.col, helmet.row);
    state.events.push({
      type: 'player-rescued',
      playerId: fallen.id,
      byId: rescuer.id,
    });
  }
}

/** Whether someone who fell is still to come back: the stage is not lost while they are. */
export function isAnyoneComingBack(state: GameState, run: StageRun): boolean {
  if (run.parts.length === 0) return false;
  return state.players.some(
    (p) =>
      !p.alive &&
      p.diedAtTick !== null &&
      !run.exited.includes(p.id) &&
      (run.lives[p.id] ?? 0) > 0,
  );
}

/** A free cell on the screen's left edge, as close as it gets to `row`. */
function edgeCell(
  state: GameState,
  run: StageRun,
  row: number,
): [number, number] {
  const left = (run.view ?? 0) + 1;
  const rows = Array.from({ length: state.rows }, (_, r) => r).sort(
    (a, b) => Math.abs(a - row) - Math.abs(b - row),
  );
  for (let col = left; col < left + 4; col++) {
    for (const r of rows) {
      if (tileAt(state, col, r) !== 'empty') continue;
      if (state.bombs.some((b) => b.col === col && b.row === r)) continue;
      if (state.flames.some((f) => f.col === col && f.row === r)) continue;
      return [col, r];
    }
  }
  return [left, 1];
}

function revive(
  state: GameState,
  player: Player,
  col: number,
  row: number,
): void {
  player.alive = true;
  player.diedAtTick = null;
  player.x = col;
  player.y = row;
  player.moving = false;
  player.shieldedUntilTick = state.tick + RESPAWN_SHIELD_TICKS;
}

function near(player: Player, col: number, row: number): boolean {
  return (
    Math.abs(player.x - col) < PICK_REACH &&
    Math.abs(player.y - row) < PICK_REACH
  );
}
