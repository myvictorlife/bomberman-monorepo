import { cellIndex, isOutOfView, tileAt } from './arena';
import { VIEW_COLS } from './constants';
import { createGame } from './game';
import { input, installLongStage, player, run } from './testing.spec-helper';
import { GameState, StageRun } from './types';
import { PULL_SHIELD_TICKS, PULL_TICKS } from './view';

const stageOf = (state: GameState): StageRun => state.stage as StageRun;

/** The long stage with `count` players, no creatures and no blocks on the floor. */
function long(count = 1): GameState {
  const state = createGame({
    seed: 5,
    stageId: 'subestacao-1',
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
    })),
  });
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  stageOf(state).creatures = [];
  return state;
}

describe('the view of a long stage', () => {
  let restore: () => void;
  beforeEach(() => (restore = installLongStage()));
  afterEach(() => restore());

  it('starts on the first screen, and a stage that fits the screen has none', () => {
    expect(stageOf(long()).view).toBe(0);
    const classic = createGame({
      seed: 5,
      stageId: 'gramado-1',
      players: [{ id: 'p1', name: 'P1' }],
    });
    expect(stageOf(classic).view).toBeNull();
    expect(isOutOfView(classic, 40)).toBe(false);
  });

  it('is a wall past either edge, whatever the floor is there', () => {
    const state = long();

    expect(state.tiles[cellIndex(state, VIEW_COLS, 1)]).toBe('empty');
    expect(tileAt(state, VIEW_COLS, 1)).toBe('wall');
    expect(tileAt(state, VIEW_COLS - 1, 1)).toBe('empty');
    stageOf(state).view = 10;
    expect(tileAt(state, 9, 1)).toBe('wall');
    expect(tileAt(state, 11, 1)).toBe('empty');
  });

  it('follows the team forward, and never back', () => {
    const state = long();
    const p1 = player(state, 'p1');
    run(state, 600, { p1: input('right') });

    const view = stageOf(state).view as number;
    expect(view).toBeGreaterThan(0);
    expect(p1.x).toBeGreaterThan(view + (VIEW_COLS - 1) / 2 - 1);
    run(state, 300, { p1: input('left') });
    expect(stageOf(state).view).toBe(view);
    // The left edge stops them like a wall.
    expect(p1.x).toBeGreaterThanOrEqual(view);
  });

  it('stops at the end of the stage', () => {
    const state = long();
    run(state, 3000, { p1: input('right') });

    expect(stageOf(state).view).toBe(state.cols - VIEW_COLS);
    expect(player(state, 'p1').x).toBe(state.cols - 2);
  });

  it('does not move on while someone would be left outside it', () => {
    const state = long(2);
    Object.assign(player(state, 'p2'), { x: 1, y: 1 });
    // Not long enough for the pull: p1 reaches the edge and waits.
    run(state, 360, { p1: input('right') });

    expect(stageOf(state).view).toBe(1);
    expect(player(state, 'p1').x).toBe(1 + VIEW_COLS - 1);
    expect(player(state, 'p2').x).toBe(1);
  });

  it('keeps the creatures past the right edge waiting, not crushed', () => {
    const state = long();
    stageOf(state).creatures = [
      {
        id: 1,
        creatureId: 'sauva',
        x: 40,
        y: 5,
        facing: 'left',
        hp: 1,
        hurtUntilTick: 0,
        alive: true,
        diedAtTick: null,
      },
    ];
    run(state, 120);

    const creature = stageOf(state).creatures[0];
    expect(creature?.alive).toBe(true);
    expect([creature?.x, creature?.y]).toEqual([40, 5]);
  });

  it('leaves behind what falls off the left edge', () => {
    const state = long();
    const view = stageOf(state);
    view.view = 1;
    view.creatures = [
      {
        id: 1,
        creatureId: 'sauva',
        x: 1,
        y: 3,
        facing: 'down',
        hp: 1,
        hurtUntilTick: 0,
        alive: true,
        diedAtTick: null,
      },
    ];
    state.powerUps.push({ col: 1, row: 9, kind: 'bomb' });
    Object.assign(player(state, 'p1'), { x: 10, y: 1 });
    run(state, 1);

    expect(view.view).toBe(2);
    expect(view.creatures).toEqual([]);
    expect(state.powerUps).toEqual([]);
  });

  it('pulls along whoever holds the team back on the left edge', () => {
    const state = long(2);
    const [p1, p2] = [player(state, 'p1'), player(state, 'p2')];
    Object.assign(p2, { x: 14, y: 1 });
    run(state, 1);
    expect(stageOf(state).view).toBe(1);

    run(state, PULL_TICKS - 2);
    expect([p1.x, p1.y]).toEqual([1, 1]);
    const events = [];
    for (let i = 0; i < 5; i++) events.push(...run(state, 1).events);
    expect([p1.x, p1.y]).toEqual([14, 1]);
    expect(p1.shieldedUntilTick).toBeGreaterThan(
      state.tick + PULL_SHIELD_TICKS - 10,
    );
    expect(events).toContainEqual({
      type: 'player-pulled',
      playerId: 'p1',
    });
  });

  it('pulls nobody while the others are not waiting at the right edge', () => {
    const state = long(2);
    const p2 = player(state, 'p2');
    Object.assign(p2, { x: 14, y: 1 });
    run(state, 1);
    Object.assign(p2, { x: 7 });
    run(state, PULL_TICKS * 2);

    expect(player(state, 'p1').x).toBe(1);
  });
});
