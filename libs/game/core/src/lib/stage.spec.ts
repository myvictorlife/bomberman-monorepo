import { cellIndex, tileAt } from './arena';
import {
  FLAME_TICKS,
  ROUND_END_DELAY_TICKS,
  ROUND_TIME_TICKS,
  SPAWN_CELLS,
} from './constants';
import { createGame, tick } from './game';
import {
  CREATURE_SPAWN_DISTANCE,
  creaturesLeft,
  EXIT_DISTANCE,
  isExitOpen,
  CHARGE_SPEED,
  EXIT_BOMB_SPAWN,
  isExitRevealed,
  EXIT_GRACE_TICKS,
  kitsAfterStage,
  SLIME_TICKS,
  TIME_BONUS_PER_SECOND,
  stageMapId,
  BURST_OWNER,
  BURST_RANGE,
  isPlayingDead,
  PLAYDEAD_TICKS,
} from './stage';
import { stageCode } from './campaign';
import { START_KIT } from './kit';
import { LONG_SPAWNS, run, withLongStage } from './testing.spec-helper';
import { CreatureBody, GameState, StageRun } from './types';

const solo = (seed = 7, stageId = 'gramado-1'): GameState =>
  createGame({ seed, stageId, players: [{ id: 'p1', name: 'P1' }] });

const stageOf = (state: GameState): StageRun => state.stage as StageRun;

/** Clears every block and creature but one, standing at `col, row`. */
function lone(state: GameState, col: number, row: number): CreatureBody {
  state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
  const run = stageOf(state);
  const creature = run.creatures[0] as CreatureBody;
  run.creatures = [creature];
  Object.assign(creature, { x: col, y: row, facing: 'left' });
  return creature;
}

describe('setting up a stage', () => {
  it('plays a stage on its own layout: longer, with the players starting on its spawns', () => {
    withLongStage(() => {
      const players = LONG_SPAWNS.map((_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
      }));
      const state = createGame({ seed: 3, stageId: 'subestacao-1', players });

      expect([state.cols, state.rows]).toEqual([61, 13]);
      expect(state.players.map((p) => [p.x, p.y])).toEqual(
        LONG_SPAWNS.map(([c, r]) => [c, r]),
      );
      expect(stageOf(state).creatures).toHaveLength(12);
      for (const c of stageOf(state).creatures) {
        const nearest = Math.min(
          ...LONG_SPAWNS.map(
            ([sc, sr]) => Math.abs(c.x - sc) + Math.abs(c.y - sr),
          ),
        );
        expect(nearest).toBeGreaterThanOrEqual(CREATURE_SPAWN_DISTANCE);
      }
      // As many players as it has spawns, and no more.
      expect(() =>
        createGame({
          seed: 3,
          stageId: 'subestacao-1',
          players: [...players, { id: 'p9', name: 'P9' }],
        }),
      ).toThrow('1–4 players');
    });
  });

  it('plays on the area map, against the clock even alone', () => {
    const state = solo();

    expect(state.mapId).toBe(stageMapId('gramado-1'));
    expect(state.closesAtTick).toBe(ROUND_TIME_TICKS);
    expect(stageMapId('nope')).toBeUndefined();
  });

  it('places the stage creatures away from the spawn, on open floor', () => {
    const state = solo();
    const run = stageOf(state);
    const [sc, sr] = SPAWN_CELLS[0] as readonly [number, number];

    expect(run.creatures).toHaveLength(6);
    for (const c of run.creatures) {
      expect(c.creatureId).toBe('sauva');
      expect(Math.abs(c.x - sc) + Math.abs(c.y - sr)).toBeGreaterThanOrEqual(
        CREATURE_SPAWN_DISTANCE,
      );
      expect(tileAt(state, c.x, c.y)).toBe('empty');
    }
    expect(creaturesLeft(run)).toBe(6);
  });

  it('hides the gate under a block, far from the spawn, with nothing else under it', () => {
    const state = solo();
    const { exit } = stageOf(state);
    const [sc, sr] = SPAWN_CELLS[0] as readonly [number, number];

    expect(tileAt(state, exit.col, exit.row)).toBe('block');
    expect(
      state.hiddenPowerUps[cellIndex(state, exit.col, exit.row)],
    ).toBeNull();
    expect(
      Math.abs(exit.col - sc) + Math.abs(exit.row - sr),
    ).toBeGreaterThanOrEqual(EXIT_DISTANCE);
    expect(isExitRevealed(state, stageOf(state))).toBe(false);
  });

  it('is the same stage for the same seed', () => {
    expect(solo(3).stage).toEqual(solo(3).stage);
    expect(solo(3).stage).not.toEqual(solo(4).stage);
  });

  it('refuses a stage that does not exist', () => {
    expect(() => solo(1, 'nope')).toThrow('Unknown stage');
  });
});

describe('creatures', () => {
  it('walk on their own, at their speed, and stay on the grid', () => {
    const state = solo();
    const before = stageOf(state).creatures.map((c) => [c.x, c.y]);

    run(state, 60);

    const after = stageOf(state).creatures.map((c) => [c.x, c.y]);
    expect(after).not.toEqual(before);
    for (const c of stageOf(state).creatures) {
      // Always on a line through cell centres.
      expect(Number.isInteger(c.x) || Number.isInteger(c.y)).toBe(true);
      expect(tileAt(state, Math.round(c.x), Math.round(c.y))).not.toBe('wall');
    }
  });

  it('turn back from a bomb dropped in their way', () => {
    const state = solo();
    const creature = lone(state, 7, 7);
    creature.x = 6.5;
    state.bombs.push({
      id: 99,
      col: 6,
      row: 7,
      ownerId: 'p1',
      fuse: 999,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    tick(state, {});

    expect(creature.facing).toBe('right');
    expect(creature.x).toBe(6.5);
  });

  it('take one hit per flame, and fall when out of health', () => {
    const state = solo(7, 'gramado-3');
    const run = stageOf(state);
    const snail = run.creatures.find(
      (c) => c.creatureId === 'caramujo',
    ) as CreatureBody;
    run.creatures = [snail];
    const flame = (col: number, row: number) =>
      state.flames.push({
        col,
        row,
        shape: 'center',
        ticksLeft: FLAME_TICKS,
        ownerId: 'p1',
      });
    Object.assign(snail, { x: 7, y: 7 });
    state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
    // Boxed in: it stays where the flame is.
    for (const [c, r] of [
      [6, 7],
      [8, 7],
      [7, 6],
      [7, 8],
    ] as const)
      state.tiles[cellIndex(state, c, r)] = 'block';

    flame(7, 7);
    tick(state, {});
    expect(snail.hp).toBe(1);
    expect(state.events).toContainEqual({
      type: 'creature-hurt',
      col: 7,
      row: 7,
    });

    tick(state, {});
    expect(snail.alive).toBe(true);

    state.tick = snail.hurtUntilTick;
    flame(7, 7);
    tick(state, {});
    expect(snail.alive).toBe(false);
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: 'creature-died',
        creatureId: 'caramujo',
        killerId: 'p1',
      }),
    );
    expect(state.events).toContainEqual({
      type: 'exit-opened',
      ...stageOf(state).exit,
    });
  });

  it('are crushed by a falling wall', () => {
    const state = solo();
    const creature = lone(state, 7, 7);
    state.tiles[cellIndex(state, 7, 7)] = 'wall';

    tick(state, {});

    expect(creature.alive).toBe(false);
  });

  it('roam: pick a new way at a crossing', () => {
    const state = solo(7, 'gramado-2');
    const run = stageOf(state);
    const pigeon = run.creatures.find(
      (c) => c.creatureId === 'pombo',
    ) as CreatureBody;
    run.creatures = [pigeon];
    state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
    Object.assign(pigeon, { x: 7, y: 7, facing: 'left' });

    tick(state, {});

    expect(pigeon.facing).not.toBe('right');
    expect(pigeon.x !== 7 || pigeon.y !== 7).toBe(true);
  });

  it('stay put when boxed in on every side', () => {
    const state = solo();
    const creature = lone(state, 7, 7);
    for (const [c, r] of [
      [6, 7],
      [8, 7],
      [7, 6],
      [7, 8],
    ] as const)
      state.tiles[cellIndex(state, c, r)] = 'block';

    tick(state, {});

    expect([creature.x, creature.y]).toEqual([7, 7]);
  });
});

describe('players and creatures', () => {
  it('a creature that reaches a player takes them out', () => {
    const state = solo();
    lone(state, 1, 1);

    tick(state, {});

    expect(state.players[0]?.alive).toBe(false);
    expect(state.events).toContainEqual({
      type: 'player-died',
      playerId: 'p1',
      killerId: null,
    });
  });

  it('a mount takes the creature hit instead', () => {
    const state = solo();
    lone(state, 1, 1);
    const p1 = state.players[0];
    if (p1) p1.mountId = 'tatu';

    tick(state, {});

    expect(p1?.alive).toBe(true);
    expect(p1?.mountId).toBeNull();
  });

  it('a player in the vest, or in the air, is not caught', () => {
    const state = solo();
    lone(state, 1, 1);
    const p1 = state.players[0] as GameState['players'][number];
    p1.vestUntilTick = 999;

    tick(state, {});
    expect(p1.alive).toBe(true);

    p1.vestUntilTick = 0;
    p1.jump = {
      fromX: 1,
      fromY: 1,
      toX: 1,
      toY: 3,
      startTick: state.tick,
      endTick: state.tick + 99,
    };
    tick(state, {});
    expect(p1.alive).toBe(true);
  });

  it('fails the stage once nobody is left', () => {
    const state = solo();
    lone(state, 1, 1);

    tick(state, {});
    expect(stageOf(state).result).toBe('failed');
    expect(state.phase).toBe('playing');

    run(state, ROUND_END_DELAY_TICKS);
    expect(state.phase).toBe('over');
  });
});

describe('the gate', () => {
  const cleared = (): GameState => {
    const state = solo();
    const run = stageOf(state);
    for (const c of run.creatures) c.alive = false;
    return state;
  };

  it('does nothing while still under its block', () => {
    const state = cleared();
    const { exit } = stageOf(state);
    Object.assign(state.players[0] as object, { x: exit.col, y: exit.row });

    tick(state, {});

    expect(isExitOpen(stageOf(state))).toBe(true);
    expect(stageOf(state).exited).toEqual([]);
  });

  it('waits for a player in the air to come down before taking them through', () => {
    const state = cleared();
    const run = stageOf(state);
    state.tiles[cellIndex(state, run.exit.col, run.exit.row)] = 'empty';
    const p1 = state.players[0] as GameState['players'][number];
    Object.assign(p1, {
      x: run.exit.col,
      y: run.exit.row,
      jump: {
        fromX: run.exit.col,
        fromY: run.exit.row,
        toX: run.exit.col,
        toY: run.exit.row,
        startTick: 0,
        endTick: 999,
      },
    });

    tick(state, {});

    expect(run.exited).toEqual([]);
    expect(run.result).toBeNull();
  });

  it('stays shut while a creature stands', () => {
    const state = solo();
    const run = stageOf(state);
    run.creatures = run.creatures.slice(0, 1);
    Object.assign(run.creatures[0] as object, { x: 13, y: 11 });
    state.tiles[cellIndex(state, run.exit.col, run.exit.row)] = 'empty';
    Object.assign(state.players[0] as object, {
      x: run.exit.col,
      y: run.exit.row,
    });

    tick(state, {});

    expect(run.exited).toEqual([]);
  });

  it('takes the players through once open and in the open, and clears the stage', () => {
    const state = cleared();
    const run = stageOf(state);
    state.tiles[cellIndex(state, run.exit.col, run.exit.row)] = 'empty';
    Object.assign(state.players[0] as object, {
      x: run.exit.col,
      y: run.exit.row,
    });

    tick(state, {});

    expect(run.exited).toEqual(['p1']);
    expect(state.events).toContainEqual({
      type: 'player-exited',
      playerId: 'p1',
    });
    expect(run.result).toBe('cleared');

    run_(state);
    expect(state.phase).toBe('over');
    expect(state.events).toContainEqual({
      type: 'stage-over',
      result: 'cleared',
    });
  });
});

function run_(state: GameState): void {
  run(state, ROUND_END_DELAY_TICKS);
}

describe('playing as a team', () => {
  const duo = (): GameState => {
    const state = createGame({
      seed: 7,
      stageId: 'gramado-1',
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
      ],
    });
    const run = stageOf(state);
    for (const c of run.creatures) c.alive = false;
    state.tiles[cellIndex(state, run.exit.col, run.exit.row)] = 'empty';
    return state;
  };

  it('is cleared when the one left standing gets through; the fallen one comes back with nothing', () => {
    const state = duo();
    const [p1, p2] = state.players;
    if (!p1 || !p2) throw new Error('two players');
    p1.maxBombs = 4;
    p2.maxBombs = 5;
    p2.alive = false;
    const { exit } = stageOf(state);
    Object.assign(p1, { x: exit.col, y: exit.row });

    expect(kitsAfterStage(state)).toBeNull();
    tick(state, {});

    expect(stageOf(state).result).toBe('cleared');
    const kits = kitsAfterStage(state);
    expect(kits?.['p1']?.maxBombs).toBe(4);
    expect(kits?.['p2']).toEqual(START_KIT);
  });

  it('keeps going while one of them is still in the arena', () => {
    const state = duo();
    const p2 = state.players[1];
    if (p2) p2.alive = false;

    tick(state, {});

    expect(stageOf(state).result).toBeNull();
  });

  it('is lost when they all fall, and nobody keeps anything', () => {
    const state = duo();
    for (const p of state.players) {
      p.alive = false;
      p.maxBombs = 6;
    }

    tick(state, {});

    expect(stageOf(state).result).toBe('failed');
    expect(Object.values(kitsAfterStage(state) ?? {})).toEqual([
      START_KIT,
      START_KIT,
    ]);
  });

  it('keeps the gate open a moment after the first one is through, then leaves the rest behind', () => {
    const state = duo();
    const [p1, p2] = state.players;
    if (!p1 || !p2) throw new Error('two players');
    p2.maxBombs = 5;
    const { exit } = stageOf(state);
    Object.assign(p1, { x: exit.col, y: exit.row });
    // P2 stands clear of the gate and of any creature.
    Object.assign(p2, { x: 1, y: 1 });

    tick(state, {});
    expect(stageOf(state).exited).toEqual(['p1']);
    expect(stageOf(state).result).toBeNull();
    expect(stageOf(state).exitClosesAtTick).toBe(1 + EXIT_GRACE_TICKS);

    run(state, EXIT_GRACE_TICKS - 1);
    expect(stageOf(state).result).toBeNull();
    expect(p2.alive).toBe(true);

    tick(state, {});
    expect(stageOf(state).result).toBe('cleared');
    expect(p2.alive).toBe(false);
    expect(state.events).toContainEqual({
      type: 'player-left-behind',
      playerId: 'p2',
    });
    expect(kitsAfterStage(state)?.['p2']).toEqual(START_KIT);
  });

  it('lets the second one through the gate within the grace, kit and all', () => {
    const state = duo();
    const [p1, p2] = state.players;
    if (!p1 || !p2) throw new Error('two players');
    p2.maxBombs = 5;
    const { exit } = stageOf(state);
    Object.assign(p1, { x: exit.col, y: exit.row });
    Object.assign(p2, { x: 1, y: 1 });
    tick(state, {});

    Object.assign(p2, { x: exit.col, y: exit.row });
    tick(state, {});

    expect(stageOf(state).exited).toEqual(['p1', 'p2']);
    expect(stageOf(state).result).toBe('cleared');
    expect(kitsAfterStage(state)?.['p2']?.maxBombs).toBe(5);
  });

  it("does not burn a teammate with one's flame, but one's own bomb still hurts", () => {
    const state = duo();
    const [p1, p2] = state.players;
    if (!p1 || !p2) throw new Error('two players');
    Object.assign(p1, { x: 1, y: 1 });
    Object.assign(p2, { x: 2, y: 1 });
    state.flames.push({
      col: 2,
      row: 1,
      shape: 'center',
      ticksLeft: 10,
      ownerId: 'p1',
    });
    state.flames.push({
      col: 1,
      row: 1,
      shape: 'center',
      ticksLeft: 10,
      ownerId: 'p1',
    });

    tick(state, {});

    expect(p2.alive).toBe(true);
    expect(p1.alive).toBe(false);
  });
});

describe('points', () => {
  it('a creature is worth its catalogue points to whoever lit the flame', () => {
    const state = solo();
    const creature = lone(state, 7, 7);
    for (const [c, r] of [
      [6, 7],
      [8, 7],
      [7, 6],
      [7, 8],
    ] as const)
      state.tiles[cellIndex(state, c, r)] = 'block';
    state.flames.push({
      col: 7,
      row: 7,
      shape: 'center',
      ticksLeft: FLAME_TICKS,
      ownerId: 'p1',
    });

    tick(state, {});

    expect(creature.alive).toBe(false);
    expect(stageOf(state).score).toEqual({ p1: 100 });
    expect(state.events).toContainEqual({
      type: 'points',
      playerId: 'p1',
      points: 100,
      col: 7,
      row: 7,
    });
  });

  it('a creature crushed by a wall scores for nobody', () => {
    const state = solo();
    lone(state, 7, 7);
    state.tiles[cellIndex(state, 7, 7)] = 'wall';

    tick(state, {});

    expect(stageOf(state).score).toEqual({});
  });

  it('the time left is a bonus for whoever gets through the gate', () => {
    const state = solo();
    const run = stageOf(state);
    for (const c of run.creatures) c.alive = false;
    state.tiles[cellIndex(state, run.exit.col, run.exit.row)] = 'empty';
    Object.assign(state.players[0] as object, {
      x: run.exit.col,
      y: run.exit.row,
    });
    state.closesAtTick = state.tick + 1 + 100 * 60;

    tick(state, {});

    expect(run.score['p1']).toBe(100 * TIME_BONUS_PER_SECOND);
  });
});

describe('a flame on the uncovered gate', () => {
  it('brings out more creatures, once per flame, and shuts the gate again', () => {
    const state = solo();
    const run = stageOf(state);
    for (const c of run.creatures) c.alive = false;
    state.tiles[cellIndex(state, run.exit.col, run.exit.row)] = 'empty';
    Object.assign(state.players[0] as object, { x: 1, y: 1 });
    state.flames.push({
      ...run.exit,
      shape: 'center',
      ticksLeft: FLAME_TICKS,
      ownerId: 'p1',
    });

    tick(state, {});
    tick(state, {});

    expect(creaturesLeft(run)).toBe(EXIT_BOMB_SPAWN);
    expect(isExitOpen(run)).toBe(false);
    expect(state.events.some((e) => e.type === 'exit-bombed')).toBe(false);
  });

  it('does nothing while the gate is still under its block', () => {
    const state = solo();
    const run = stageOf(state);
    const before = run.creatures.length;
    state.flames.push({
      ...run.exit,
      shape: 'center',
      ticksLeft: FLAME_TICKS,
      ownerId: 'p1',
    });

    tick(state, {});

    expect(run.creatures.length).toBe(before);
  });
});

describe('creature habits', () => {
  it('a snail leaves slime that slows whoever steps in it', () => {
    const state = solo(7, 'gramado-3');
    const run = stageOf(state);
    const snail = run.creatures.find(
      (c) => c.creatureId === 'caramujo',
    ) as CreatureBody;
    run.creatures = [snail];
    state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
    Object.assign(snail, { x: 7, y: 7 });

    tick(state, {});
    expect(run.slime).toContainEqual(
      expect.objectContaining({ col: 7, row: 7 }),
    );

    snail.alive = false;
    Object.assign(state.players[0] as object, { x: 7, y: 7 });
    tick(state, {});
    expect(state.players[0]?.slimedUntilTick).toBeGreaterThan(state.tick);

    state.tick += SLIME_TICKS;
    tick(state, {});
    expect(run.slime).toEqual([]);
  });

  it('a quero-quero dashes at a player in its line of sight', () => {
    const state = solo(7, 'gramado-4');
    const run = stageOf(state);
    const bird = run.creatures.find(
      (c) => c.creatureId === 'queroquero',
    ) as CreatureBody;
    run.creatures = [bird];
    state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
    Object.assign(bird, { x: 5, y: 1, facing: 'down' });

    tick(state, {});

    expect(bird.charging).toBe(true);
    expect(bird.facing).toBe('left');
    expect(bird.x).toBeCloseTo(5 - CHARGE_SPEED / 60);
  });

  it('stops dashing when something is in the way', () => {
    const state = solo(7, 'gramado-4');
    const run = stageOf(state);
    const bird = run.creatures.find(
      (c) => c.creatureId === 'queroquero',
    ) as CreatureBody;
    run.creatures = [bird];
    state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
    Object.assign(state.players[0] as object, { x: 13, y: 11 });
    Object.assign(bird, { x: 3, y: 1, facing: 'left', charging: true });
    state.tiles[cellIndex(state, 2, 1)] = 'block';

    tick(state, {});

    expect(bird.charging).toBe(false);
  });
});

describe('the bonus stage', () => {
  const bonus = () => solo(7, 'gramado-bonus');

  it('has no creatures, the gate open in the middle, an item under every block and a short clock', () => {
    const state = bonus();
    const run = stageOf(state);

    expect(run.bonus).toBe(true);
    expect(run.creatures).toEqual([]);
    expect(run.exit).toEqual({ col: 7, row: 6 });
    expect(isExitOpen(run) && isExitRevealed(state, run)).toBe(true);
    const blocks = state.tiles.flatMap((t, i) => (t === 'block' ? [i] : []));
    expect(blocks.every((i) => state.hiddenPowerUps[i])).toBe(true);
    expect(state.hiddenPowerUps).toContain('oneup');
    expect(state.closesAtTick).toBe(30 * 60);
    expect(stageCode('gramado-bonus')).toBe('1-B');
    expect(stageCode('gramado-5')).toBe('1-5');
  });

  it('ends when the time is up, cleared for whoever is still in it', () => {
    const state = bonus();
    state.tick = (state.closesAtTick ?? 0) - 1;

    tick(state, {});

    expect(stageOf(state).result).toBe('cleared');
    expect(stageOf(state).exited).toEqual(['p1']);
    expect(state.closedCells).toBe(0);
  });
});

describe('stage extras', () => {
  it('hides the stage items under blocks', () => {
    const state = solo(7, 'gramado-3');
    expect(state.hiddenPowerUps).toContain('oneup');
  });
});

describe('the substation creatures', () => {
  /** A stage with one creature of `kind` at `col, row`, and p1 parked out of the way. */
  function oneOf(kind: CreatureBody['creatureId'], col: number, row: number) {
    const state = solo();
    const creature = lone(state, col, row);
    Object.assign(creature, {
      creatureId: kind,
      hp: kind === 'gamba' ? 2 : 1,
    });
    return { state, creature, p1: state.players[0] as GameState['players'][0] };
  }

  const burn = (state: GameState, col: number, row: number) =>
    state.flames.push({
      col,
      row,
      shape: 'center',
      ticksLeft: FLAME_TICKS,
      ownerId: 'p1',
    });

  it('a gambá plays dead after its first flame — still and harmless — then runs', () => {
    const { state, creature, p1 } = oneOf('gamba', 7, 7);
    burn(state, 7, 7);
    run(state, 1);
    expect(creature.alive).toBe(true);
    expect(isPlayingDead(state, creature)).toBe(true);

    state.flames = [];
    Object.assign(p1, { x: 7, y: 7 });
    run(state, PLAYDEAD_TICKS - 5);
    expect([creature.x, creature.y]).toEqual([7, 7]);
    expect(p1.alive).toBe(true);

    Object.assign(p1, { x: 1, y: 1 });
    run(state, 10);
    expect(creature.rushing).toBe(true);
    burn(state, Math.round(creature.x), Math.round(creature.y));
    run(state, 1);
    expect(creature.alive).toBe(false);
  });

  it('a marimbondo flies over the crates, towards the nearest player', () => {
    const { state, creature, p1 } = oneOf('marimbondo', 7, 1);
    Object.assign(p1, { x: 1, y: 1 });
    p1.shieldedUntilTick = Infinity;
    for (let col = 2; col <= 6; col++)
      state.tiles[cellIndex(state, col, 1)] = 'block';
    run(state, 60 * 3);

    expect(creature.x).toBeLessThan(4);
    expect(creature.y).toBe(1);
  });

  it('a curto bursts when it falls, and the burst burns anyone near', () => {
    const { state, creature, p1 } = oneOf('curto', 7, 7);
    Object.assign(p1, { x: 7, y: 9 });
    burn(state, 7, 7);
    run(state, 1);
    expect(creature.alive).toBe(false);
    expect(state.bombs).toContainEqual(
      expect.objectContaining({
        col: 7,
        row: 7,
        ownerId: BURST_OWNER,
        range: BURST_RANGE,
      }),
    );

    run(state, 3);
    expect(state.flames.some((f) => f.col === 7 && f.row === 9)).toBe(true);
    expect(p1.alive).toBe(false);
  });
});
