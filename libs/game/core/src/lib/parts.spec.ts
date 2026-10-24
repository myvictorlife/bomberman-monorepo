import { tileAt } from './arena';
import { START_LIVES } from './campaign';
import { ROUND_END_DELAY_TICKS, TICK_RATE, VIEW_COLS } from './constants';
import { createGame } from './game';
import { RESPAWN_SHIELD_TICKS, RESPAWN_TICKS } from './parts';
import { isExitOpen } from './stage';
import {
  input,
  installLongStage,
  player,
  run,
  TEST_PARTS,
} from './testing.spec-helper';
import { GameEvent, GameState, Player, StageRun } from './types';

const stageOf = (state: GameState): StageRun => state.stage as StageRun;

function parts(count = 1, lives?: number): GameState {
  const state = createGame({
    seed: 9,
    stageId: 'subestacao-1',
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
      ...(lives === undefined ? {} : { lives }),
    })),
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  return state;
}

/** The creatures of part `i`, by their columns. */
function creaturesOf(state: GameState, i: number) {
  const run = stageOf(state);
  const from = i === 0 ? 0 : (run.parts[i - 1]?.gate ?? 0);
  const to = run.parts[i]?.gate ?? state.cols;
  return run.creatures.filter((c) => c.x > from && c.x < to);
}

/** Runs ticks one by one, collecting every event. */
function collect(state: GameState, n: number, p1?: ReturnType<typeof input>) {
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++)
    events.push(...run(state, 1, p1 ? { p1 } : {}).events);
  return events;
}

/** Out, as a flame or a creature would leave them. */
function fall(state: GameState, who: Player): void {
  who.alive = false;
  who.moving = false;
  who.diedAtTick = state.tick;
}

describe('a stage in parts', () => {
  let restore: () => void;
  beforeEach(() => (restore = installLongStage(undefined, TEST_PARTS)));
  afterEach(() => restore());

  it('puts each part behind its gate, with its own creatures, and the stage gate at the far end', () => {
    const state = parts();
    const run_ = stageOf(state);

    expect(run_.parts.map((p) => p.gate)).toEqual([15, 30, 45, 60]);
    expect(run_.part).toBe(0);
    for (let i = 0; i < 4; i++) expect(creaturesOf(state, i)).toHaveLength(3);
    // The key goes with one of the second part's creatures.
    expect(creaturesOf(state, 1).map((c) => c.id)).toContain(
      run_.key?.carrierId,
    );
    expect(run_.exit).toEqual({ col: 59, row: 6 });
    expect(tileAt({ ...state, stage: null } as GameState, 59, 6)).toBe('empty');
    expect(state.closesAtTick).toBe(90 * TICK_RATE);
    expect(run_.lives).toEqual({ p1: START_LIVES });
    expect(isExitOpen(run_)).toBe(false);
  });

  it('keeps the screen on a part until its goal is met', () => {
    const state = parts();
    // Untouchable: the part's creatures are still about.
    player(state, 'p1').shieldedUntilTick = Infinity;
    run(state, 600, { p1: input('right') });
    expect(stageOf(state).view).toBe(0);
    expect(player(state, 'p1').x).toBe(VIEW_COLS - 1);

    for (const c of creaturesOf(state, 0)) c.alive = false;
    const events = collect(state, 1);
    expect(stageOf(state).parts[0]?.done).toBe(true);
    expect(stageOf(state).part).toBe(1);
    expect(events).toContainEqual({ type: 'gate-opened', col: 15 });
    // The next part's clock starts with its gate.
    expect(state.closesAtTick).toBe(state.tick + 90 * TICK_RATE);

    run(state, 600, { p1: input('right') });
    expect(stageOf(state).view).toBe(15);
  });

  it('opens a key part when the key, dropped by its carrier, is picked up', () => {
    const state = parts();
    const run_ = stageOf(state);
    for (const part of run_.parts.slice(0, 1)) part.done = true;
    run_.part = 1;
    run_.view = 15;
    const carrier = run_.creatures.find((c) => c.id === run_.key?.carrierId);
    if (!carrier) throw new Error('no key carrier');
    Object.assign(carrier, { x: 21, y: 5 });
    Object.assign(player(state, 'p1'), { x: 17, y: 5 });
    carrier.alive = false;

    expect(collect(state, 1)).toContainEqual({
      type: 'key-dropped',
      col: 21,
      row: 5,
    });
    expect(run_.parts[1]?.done).toBe(false);
    const events = collect(state, 120, input('right'));
    expect(events).toContainEqual({ type: 'key-taken', playerId: 'p1' });
    expect(run_.key).toBeNull();
    expect(run_.parts[1]?.done).toBe(true);
  });

  it('brings a fallen player back on the left edge, for a life', () => {
    const state = parts(1, 2);
    const p1 = player(state, 'p1');
    stageOf(state).view = 0;
    Object.assign(p1, { x: 9, y: 7 });
    fall(state, p1);
    run(state, RESPAWN_TICKS - 1);
    expect(p1.alive).toBe(false);
    expect(stageOf(state).result).toBeNull();

    const events = collect(state, 2);
    expect(events).toContainEqual({ type: 'player-respawned', playerId: 'p1' });
    expect(p1.alive).toBe(true);
    expect([p1.x, p1.y]).toEqual([1, 7]);
    expect(p1.shieldedUntilTick).toBeGreaterThan(
      state.tick + RESPAWN_SHIELD_TICKS - 5,
    );
    expect(stageOf(state).lives['p1']).toBe(1);
    expect(stageOf(state).livesGained['p1']).toBe(-1);
  });

  it('leaves a helmet for whoever has no life left, and a teammate brings them back', () => {
    const state = parts(2, 1);
    const [p1, p2] = [player(state, 'p1'), player(state, 'p2')];
    stageOf(state).lives['p2'] = 0;
    for (const c of stageOf(state).creatures) c.alive = false;
    Object.assign(p2, { x: 7, y: 1 });
    fall(state, p2);
    run(state, RESPAWN_TICKS + 1);
    expect(stageOf(state).helmets).toEqual([
      { playerId: 'p2', col: 7, row: 1 },
    ]);
    expect(p2.alive).toBe(false);

    Object.assign(p1, { x: 5, y: 1 });
    const events = collect(state, 60, input('right'));
    expect(events).toContainEqual({
      type: 'player-rescued',
      playerId: 'p2',
      byId: 'p1',
    });
    expect(p2.alive).toBe(true);
    expect(stageOf(state).helmets).toEqual([]);
  });

  it('is lost when nobody is standing and nobody is coming back', () => {
    const state = parts(1, 1);
    stageOf(state).lives['p1'] = 0;
    fall(state, player(state, 'p1'));
    run(state, RESPAWN_TICKS + 1);

    expect(stageOf(state).result).toBe('failed');
    expect(stageOf(state).helmets).toEqual([]);
  });

  it('is lost when a part’s clock runs out', () => {
    const state = parts(2);
    state.closesAtTick = state.tick + 1;
    run(state, 2);

    expect(state.players.every((p) => !p.alive)).toBe(true);
    run(state, RESPAWN_TICKS + ROUND_END_DELAY_TICKS);
    expect(stageOf(state).result).toBe('failed');
    expect(state.phase).toBe('over');
  });

  it('opens the stage gate with the last part, and is cleared through it', () => {
    const state = parts();
    const run_ = stageOf(state);
    for (const part of run_.parts.slice(0, 3)) part.done = true;
    run_.part = 3;
    run_.view = state.cols - VIEW_COLS;
    for (const c of creaturesOf(state, 3)) c.alive = false;
    Object.assign(player(state, 'p1'), { x: 57, y: 5 });
    run(state, 1);
    expect(isExitOpen(run_)).toBe(true);
    expect(state.closesAtTick).toBeNull();

    Object.assign(player(state, 'p1'), { x: 59, y: 6 });
    run(state, 1);
    expect(run_.exited).toEqual(['p1']);
    expect(run_.result).toBe('cleared');
  });
});
