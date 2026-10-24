import { cellIndex } from './arena';
import { FLAME_TICKS } from './constants';
import { createGame } from './game';
import { BLACKOUT_EVERY, GATO_TICKS, isBlackout } from './gato';
import { run } from './testing.spec-helper';
import { BossBody, BossPhase, GameState, StageRun } from './types';

const stageOf = (state: GameState): StageRun => state.stage as StageRun;
const bossOf = (state: GameState): BossBody => stageOf(state).boss as BossBody;

/** The Gato's cellar, `count` players, no crates and no generators unless a test adds them. */
function cellar(count = 1): GameState {
  const state = createGame({
    seed: 4,
    stageId: 'subestacao-5',
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
    })),
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  stageOf(state).mounds = [];
  stageOf(state).creatures = [];
  for (const p of state.players) p.shieldedUntilTick = Infinity;
  return state;
}

function until(state: GameState, phase: BossPhase, limit = 1200): void {
  for (let i = 0; i < limit && bossOf(state).phase !== phase; i++)
    run(state, 1);
  expect(bossOf(state).phase).toBe(phase);
}

const burn = (state: GameState, col: number, row: number) =>
  state.flames.push({
    col,
    row,
    shape: 'center',
    ticksLeft: FLAME_TICKS,
    ownerId: 'p1',
  });

describe('the Gato de Fios', () => {
  it('takes more hits the bigger the team, and brings two generators', () => {
    const solo = createGame({
      seed: 4,
      stageId: 'subestacao-5',
      players: [{ id: 'p1', name: 'P1' }],
    });
    expect(bossOf(solo).hp).toBe(7);
    expect(stageOf(solo).mounds).toHaveLength(2);
    const pair = createGame({
      seed: 4,
      stageId: 'subestacao-5',
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
      ],
    });
    expect(bossOf(pair).hp).toBe(10);
  });

  it('walks after the nearest player, then charges its row and column', () => {
    const state = cellar();
    const boss = bossOf(state);
    const start = Math.abs(boss.x - 1) + Math.abs(boss.y - 1);
    until(state, 'charge');

    expect(Math.abs(boss.x - 1) + Math.abs(boss.y - 1)).toBeLessThan(start);
    const zap = boss.zap ?? [];
    expect(zap).toContainEqual({ col: boss.x, row: boss.y });
    expect(zap.every((c) => c.col === boss.x || c.row === boss.y)).toBe(true);
  });

  it('zaps whoever is in its line — a crate in between shields them', () => {
    const state = cellar(2);
    const boss = bossOf(state);
    Object.assign(boss, { x: 7, y: 5 });
    const [p1, p2] = state.players;
    if (!p1 || !p2) throw new Error('two players');
    until(state, 'charge');
    const [col, row] = [Math.round(boss.x), Math.round(boss.y)];
    // p1 in the open on its row; p2 on its column, behind a crate.
    Object.assign(p1, { x: col - 2, y: row, shieldedUntilTick: 0 });
    Object.assign(p2, { x: col, y: row + 3, shieldedUntilTick: 0 });
    state.tiles[cellIndex(state, col, row + 1)] = 'block';
    until(state, 'zap', GATO_TICKS.charge + 2);
    run(state, 1);

    expect(p1.alive).toBe(false);
    expect(p2.alive).toBe(true);
  });

  it('sets off a bomb in the path of its zap', () => {
    const state = cellar();
    const boss = bossOf(state);
    until(state, 'charge');
    const [col, row] = [Math.round(boss.x), Math.round(boss.y)];
    const side =
      state.tiles[cellIndex(state, col + 1, row)] === 'empty' ? 1 : -1;
    state.bombs.push({
      id: 55,
      col: col + side,
      row,
      ownerId: 'p1',
      fuse: 999,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    until(state, 'zap', GATO_TICKS.charge + 2);
    run(state, 1);
    expect(state.bombs.some((b) => b.id === 55)).toBe(false);
  });

  it('is only hurt while drained after a zap', () => {
    const state = cellar();
    const boss = bossOf(state);
    until(state, 'walk');
    burn(state, Math.round(boss.x), Math.round(boss.y));
    run(state, 1);
    expect(boss.hp).toBe(boss.maxHp);

    state.flames = [];
    until(state, 'drained');
    burn(state, Math.round(boss.x), Math.round(boss.y));
    run(state, 1);
    expect(boss.hp).toBe(boss.maxHp - 1);
  });

  it('fries its own generator when the zap reaches it, and is dizzy for longer', () => {
    const state = cellar();
    const boss = bossOf(state);
    until(state, 'charge');
    const [col, row] = [Math.round(boss.x), Math.round(boss.y)];
    stageOf(state).mounds = [
      {
        id: 1,
        col: col + 2,
        row,
        hp: 2,
        hurtUntilTick: 0,
        alive: true,
        nextSpawnTick: Infinity,
      },
    ];
    for (let c = col + 1; c <= col + 2; c++)
      state.tiles[cellIndex(state, c, row)] = 'empty';
    until(state, 'zap', GATO_TICKS.charge + 2);

    expect(stageOf(state).mounds[0]?.alive).toBe(false);
    until(state, 'stunned', GATO_TICKS.zap + 2);
    expect(
      bossOf(state).phaseEndsAtTick - bossOf(state).phaseStartedAtTick,
    ).toBe(GATO_TICKS.dizzy);
  });

  it('puts the lights out now and then from half health on', () => {
    const state = cellar();
    const boss = bossOf(state);
    expect(isBlackout(state, boss)).toBe(false);
    boss.hp = Math.floor(boss.maxHp / 2);
    run(state, 1);
    let dark = 0;
    for (let i = 0; i < BLACKOUT_EVERY; i++) {
      run(state, 1);
      if (isBlackout(state, boss)) dark++;
    }
    expect(dark).toBeGreaterThan(0);
    expect(dark).toBeLessThan(BLACKOUT_EVERY / 2);
  });
});
