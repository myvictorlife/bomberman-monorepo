import { cellIndex } from './arena';
import { FLAME_TICKS, VIEW_COLS } from './constants';
import {
  ARC_ON_TICKS,
  GENERATOR_TICKS,
  isArcLive,
  SPARK_SPEED,
} from './fixtures';
import { createGame } from './game';
import { isExitOpen } from './stage';
import { player, run } from './testing.spec-helper';
import { GameState, StageRun } from './types';
import { SCROLL_TICKS } from './view';

const stageOf = (state: GameState): StageRun => state.stage as StageRun;

function stage(id: string, lives = 3): GameState {
  const state = createGame({
    seed: 2,
    stageId: id,
    players: [{ id: 'p1', name: 'P1', lives }],
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  return state;
}

/** Straight to part `n`, its creatures gone: only the floor's pieces left to deal with. */
function atPart(state: GameState, n: number): StageRun {
  const run_ = stageOf(state);
  run_.parts.slice(0, n).forEach((p) => (p.done = true));
  run_.part = n;
  run_.view = Math.min(run_.parts[n - 1]?.gate ?? 0, state.cols - VIEW_COLS);
  run_.scrolledAtTick = state.tick;
  run_.creatures = [];
  run_.key = null;
  return run_;
}

const burn = (state: GameState, col: number, row: number) =>
  state.flames.push({
    col,
    row,
    shape: 'center',
    ticksLeft: FLAME_TICKS,
    ownerId: 'p1',
  });

describe('arc lines and their breakers (2-2)', () => {
  it('shock on and off along their row, and a blown breaker switches them off', () => {
    const state = stage('subestacao-2');
    const run_ = atPart(state, 1);
    const [top, bottom] = run_.arcs;
    if (!top || !bottom) throw new Error('two arcs');
    expect([top.row, top.from, top.to]).toEqual([3, 17, 26]);
    const breaker = run_.mounds.find((m) => m.id === top.breakerId);
    expect(breaker).toMatchObject({ col: 27, row: 3, kind: 'breaker' });
    // Neighbouring lines take turns.
    expect(isArcLive(state, run_, top)).not.toBe(
      isArcLive(state, run_, bottom),
    );

    burn(state, 27, 3);
    run(state, 1);
    expect(breaker?.alive).toBe(false);
    for (let i = 0; i < ARC_ON_TICKS * 2; i += 10) {
      run(state, 10);
      expect(isArcLive(state, run_, top)).toBe(false);
    }
  });

  it('sets off a bomb lying on a live line', () => {
    const state = stage('subestacao-2');
    const run_ = atPart(state, 1);
    const top = run_.arcs[0];
    if (!top) throw new Error('an arc');
    while (isArcLive(state, run_, top)) run(state, 1);
    player(state, 'p1').shieldedUntilTick = Infinity;
    state.bombs.push({
      id: 77,
      col: 20,
      row: 3,
      ownerId: 'p1',
      fuse: 999,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    run(state, 1);
    expect(state.bombs.some((b) => b.id === 77)).toBe(true);

    while (!isArcLive(state, run_, top)) run(state, 1);
    run(state, 2);
    expect(state.bombs.some((b) => b.id === 77)).toBe(false);
    expect(state.flames.some((f) => f.col === 20 && f.row === 3)).toBe(true);
  });

  it('catches whoever stands on a live line', () => {
    const state = stage('subestacao-2');
    const run_ = atPart(state, 1);
    const p1 = player(state, 'p1');
    const top = run_.arcs[0];
    if (!top) throw new Error('an arc');
    while (!isArcLive(state, run_, top)) run(state, 1);
    Object.assign(p1, { x: 20, y: 3, shieldedUntilTick: 0 });
    run(state, 1);
    expect(p1.alive).toBe(false);
  });

  it('opens the part once every breaker is blown up', () => {
    const state = stage('subestacao-2');
    const run_ = atPart(state, 1);
    for (const m of run_.mounds) if (m.kind === 'breaker') m.alive = false;
    run(state, 1);
    expect(run_.parts[1]?.done).toBe(true);
    expect(isExitOpen(run_)).toBe(true);
  });
});

describe('cables', () => {
  it('carry a bomb’s blast to the far end', () => {
    const state = stage('subestacao-2');
    const p1 = player(state, 'p1');
    p1.shieldedUntilTick = Infinity;
    stageOf(state).creatures = [];
    state.bombs.push({
      id: 99,
      col: 4,
      row: 7,
      ownerId: 'p1',
      fuse: 1,
      range: 2,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    run(state, 2);
    expect(state.flames.some((f) => f.col === 4 && f.row === 7)).toBe(false);
    expect(stageOf(state).sparks).toHaveLength(1);

    run(state, Math.ceil((9 / SPARK_SPEED) * 60) + 2);
    expect(state.flames.some((f) => f.col === 13 && f.row === 7)).toBe(true);
    expect(state.flames.some((f) => f.col === 4 && f.row === 7)).toBe(false);
  });
});

describe('generators (2-3)', () => {
  it('send out faíscas while on the screen, and open the part once blown up', () => {
    const state = stage('subestacao-3');
    const run_ = stageOf(state);
    const generators = run_.mounds.filter((m) => m.kind === 'generator');
    expect(generators.map((g) => [g.col, g.row])).toEqual([
      [21, 3],
      [25, 9],
      [23, 7],
    ]);
    // Off the screen they wait.
    run_.creatures = [];
    player(state, 'p1').shieldedUntilTick = Infinity;
    run(state, GENERATOR_TICKS + 2);
    expect(run_.creatures).toHaveLength(0);

    atPart(state, 1);
    run(state, GENERATOR_TICKS + 2);
    expect(run_.creatures.length).toBeGreaterThan(0);
    expect(run_.creatures.every((c) => c.creatureId === 'faisca')).toBe(true);

    for (const g of generators) g.alive = false;
    run(state, 1);
    expect(run_.parts[1]?.done).toBe(true);
  });

  it('take three flames', () => {
    const state = stage('subestacao-3');
    const run_ = atPart(state, 1);
    const g = run_.mounds.find((m) => m.kind === 'generator');
    if (!g) throw new Error('a generator');
    for (let i = 0; i < 2; i++) {
      burn(state, g.col, g.row);
      run(state, FLAME_TICKS + 1);
      state.flames = [];
    }
    expect(g.alive).toBe(true);
    burn(state, g.col, g.row);
    run(state, 1);
    expect(g.alive).toBe(false);
  });
});

describe('the escape (2-4)', () => {
  it('runs the screen on by itself, burns its edge, and opens the floor at the end', () => {
    const state = stage('subestacao-4');
    const run_ = atPart(state, 2);
    const p1 = player(state, 'p1');
    const start = run_.view as number;
    Object.assign(p1, { x: start + 7, y: 1, shieldedUntilTick: Infinity });
    run(state, SCROLL_TICKS * 3 + 1);
    expect(run_.view).toBe(start + 3);

    // Left on the edge, it burns.
    Object.assign(p1, { x: run_.view, y: 1, shieldedUntilTick: 0 });
    run(state, 1);
    expect(p1.alive).toBe(false);

    run_.view = state.cols - VIEW_COLS - 1;
    run(state, SCROLL_TICKS + 1);
    expect(run_.view).toBe(state.cols - VIEW_COLS);
    run(state, 1);
    expect(run_.parts[2]?.done).toBe(true);
    expect(isExitOpen(run_)).toBe(true);
    expect(cellIndex(state, run_.exit.col, run_.exit.row)).toBeGreaterThan(0);
  });
});
