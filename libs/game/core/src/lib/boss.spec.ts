import { cellIndex, tileAt } from './arena';
import {
  BOSS_ESCORT,
  BOSS_TICKS,
  isBossExposed,
  MAX_MINIONS,
  MOUND_COUNT,
  MOUND_HP,
  MOUND_SPAWN_TICKS,
} from './boss';
import { FLAME_TICKS } from './constants';
import { createGame, tick } from './game';
import { isExitOpen } from './stage';
import { run } from './testing.spec-helper';
import { BossBody, GameState, Player, StageRun } from './types';

const bossStage = (seed = 5): GameState => {
  const state = createGame({
    seed,
    stageId: 'gramado-5',
    players: [{ id: 'p1', name: 'P1' }],
  });
  // An open arena: the tests move things by hand.
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  return state;
};
const stageOf = (s: GameState) => s.stage as StageRun;
const bossOf = (s: GameState) => stageOf(s).boss as BossBody;
const p1 = (s: GameState) => s.players[0] as Player;
const flame = (s: GameState, col: number, row: number) =>
  s.flames.push({
    col,
    row,
    shape: 'center',
    ticksLeft: FLAME_TICKS,
    ownerId: 'p1',
  });

/** Runs until the boss is in `phase`, or gives up. */
function until(state: GameState, phase: BossBody['phase'], limit = 2000): void {
  for (let i = 0; i < limit && bossOf(state).phase !== phase; i++)
    tick(state, {});
}

describe('the Rainha Saúva', () => {
  it('stands in the middle at the start, with her anthills around', () => {
    const state = bossStage();
    const boss = bossOf(state);

    expect(boss).toEqual(
      expect.objectContaining({
        bossId: 'rainha',
        hp: 8,
        maxHp: 8,
        phase: 'up',
        x: 7,
        y: 6,
      }),
    );
    expect(isBossExposed(boss)).toBe(true);
    expect(stageOf(state).mounds).toHaveLength(MOUND_COUNT);
    expect(stageOf(state).creatures).toEqual([]);
    expect(isExitOpen(stageOf(state))).toBe(false);
  });

  it('digs, cracks the ground under the nearest player, and comes up there', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 3, y: 1 });

    run(state, BOSS_TICKS.firstUp);
    expect(bossOf(state).phase).toBe('sinking');

    until(state, 'under');
    expect(bossOf(state).target).toEqual({ col: 3, row: 1 });
    expect(state.events).toContainEqual({ type: 'boss-dug', col: 7, row: 6 });
    expect(isBossExposed(bossOf(state))).toBe(false);

    until(state, 'crack');
    expect(state.events).toContainEqual({ type: 'boss-crack', col: 3, row: 1 });

    until(state, 'stunned');
    expect([bossOf(state).x, bossOf(state).y]).toEqual([3, 1]);
    // Still standing on the crack: caught.
    expect(p1(state).alive).toBe(false);
  });

  it('spares whoever stepped off the crack, breaks a block and sets off a bomb there', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 3, y: 1 });
    until(state, 'crack');
    Object.assign(p1(state), { x: 1, y: 1 });
    state.tiles[cellIndex(state, 3, 1)] = 'block';
    state.bombs.push({
      id: 9,
      col: 3,
      row: 1,
      ownerId: 'p1',
      fuse: 999,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: true,
    });

    until(state, 'stunned');
    // The bomb goes off on the next tick: fuses burn before the boss moves.
    tick(state, {});

    expect(p1(state).alive).toBe(true);
    expect(tileAt(state, 3, 1)).not.toBe('block');
    expect(state.bombs.some((b) => b.id === 9)).toBe(false);
  });

  it('takes one hit per flame while out, and none underground', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 1, y: 11 });
    flame(state, 7, 6);
    tick(state, {});
    expect(bossOf(state).hp).toBe(7);
    expect(state.events).toContainEqual({ type: 'boss-hurt', col: 7, row: 6 });
    tick(state, {});
    expect(bossOf(state).hp).toBe(7);

    until(state, 'under');
    const boss = bossOf(state);
    state.flames = [];
    flame(state, Math.round(boss.x), Math.round(boss.y));
    tick(state, {});
    expect(bossOf(state).hp).toBe(7);
  });

  it('catches a player who walks into her while she is out', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 7.5, y: 6 });

    tick(state, {});

    expect(p1(state).alive).toBe(false);
  });

  it('feints from half health on: a second crack somewhere else', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 1, y: 11 });
    bossOf(state).hp = 4;

    until(state, 'under');

    expect(bossOf(state).fakes).toHaveLength(1);
    expect(bossOf(state).fakes[0]).not.toEqual(bossOf(state).target);
  });

  it('comes up with an escort on her last hits', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 1, y: 11 });
    for (const m of stageOf(state).mounds) m.alive = false;
    bossOf(state).hp = 2;

    until(state, 'stunned');

    expect(stageOf(state).creatures.filter((c) => c.alive)).toHaveLength(
      BOSS_ESCORT,
    );
  });

  it('falls on her last hit, taking her ants and anthills with her, and the gate opens', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 1, y: 11 });
    run(state, MOUND_SPAWN_TICKS + 1);
    expect(stageOf(state).creatures.some((c) => c.alive)).toBe(true);
    const boss = bossOf(state);
    Object.assign(boss, {
      hp: 1,
      phase: 'stunned',
      phaseEndsAtTick: state.tick + 99,
      x: 7,
      y: 6,
    });

    flame(state, 7, 6);
    tick(state, {});

    expect(boss.alive).toBe(false);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'boss-died', killerId: 'p1' }),
    );
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'exit-opened' }),
    );
    expect(stageOf(state).creatures.every((c) => !c.alive)).toBe(true);
    expect(stageOf(state).mounds.every((m) => !m.alive)).toBe(true);

    // Dead is dead: nothing more happens to her.
    run(state, 120);
    expect(boss.phase).toBe('stunned');
  });
});

describe('the anthills', () => {
  it('send out an ant every few seconds, up to a limit', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 1, y: 11 });
    // Keep her out of the way: always above ground, never digging.
    const boss = bossOf(state);

    run(state, MOUND_SPAWN_TICKS + 1);
    expect(stageOf(state).creatures.length).toBeGreaterThanOrEqual(1);

    boss.phaseEndsAtTick = Infinity;
    run(state, MOUND_SPAWN_TICKS * 8);
    expect(
      stageOf(state).creatures.filter((c) => c.alive).length,
    ).toBeLessThanOrEqual(MAX_MINIONS + BOSS_ESCORT);
  });

  it('stand like blocks and break after two flames', () => {
    const state = bossStage();
    Object.assign(p1(state), { x: 1, y: 11 });
    const mound = stageOf(state).mounds[0];
    if (!mound) throw new Error('no mound');
    Object.assign(p1(state), { x: mound.col - 1, y: mound.row });

    tick(state, { p1: { direction: 'right', bomb: false } });
    expect(p1(state).x).toBe(mound.col - 1);

    flame(state, mound.col, mound.row);
    tick(state, {});
    expect(mound.hp).toBe(MOUND_HP - 1);
    expect(state.events).toContainEqual({
      type: 'mound-hurt',
      col: mound.col,
      row: mound.row,
    });

    state.tick = mound.hurtUntilTick;
    flame(state, mound.col, mound.row);
    tick(state, {});
    expect(mound.alive).toBe(false);
    expect(state.events).toContainEqual({
      type: 'mound-destroyed',
      col: mound.col,
      row: mound.row,
    });
  });
});
