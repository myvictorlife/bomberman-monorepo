import { CURSE_TICKS, MAX_FIRE, START_BOMBS, START_FIRE } from './constants';
import { createGame, eliminatePlayer, tick } from './game';
import { playerCell } from './movement';
import { openArena, player } from './testing.spec-helper';
import { GameState } from './types';

/** A bomb under `id`, about to go off. */
function bombUnder(state: GameState, id: string): void {
  const [col, row] = playerCell(player(state, id));
  state.bombs.push({
    id: 100,
    col,
    row,
    ownerId: id,
    fuse: 1,
    range: 1,
    passThrough: [id],
    pierce: false,
    remote: false,
  });
}

describe('items left behind by a fall', () => {
  it('scatter what was picked up over free floor, one item per level', () => {
    const state = openArena(3);
    const p1 = player(state, 'p1');
    p1.maxBombs = START_BOMBS + 2;
    p1.fireRange = START_FIRE + 1;
    p1.speedLevel = 1;
    p1.glove = true;
    p1.powerBomb = true;
    p1.wallPass = true;
    bombUnder(state, 'p1');

    tick(state, {});

    expect(p1.alive).toBe(false);
    expect(state.powerUps.map((p) => p.kind).sort()).toEqual(
      [
        'bomb',
        'bomb',
        'fire',
        'speed',
        'glove',
        'powerbomb',
        'wallpass',
      ].sort(),
    );
    const [col, row] = playerCell(p1);
    for (const item of state.powerUps) {
      expect(item.col !== col || item.row !== row).toBe(true);
      expect(state.tiles[item.row * state.cols + item.col]).toBe('empty');
    }
    expect(new Set(state.powerUps.map((p) => `${p.col},${p.row}`)).size).toBe(
      state.powerUps.length,
    );
    expect(
      state.events.filter((e) => e.type === 'power-up-dropped'),
    ).toHaveLength(7);
    expect(p1.maxBombs).toBe(START_BOMBS);
    expect(p1.glove).toBe(false);
  });

  it('give full fire back as itself, and a curse still running as its skull', () => {
    const state = openArena(3);
    const p1 = player(state, 'p1');
    state.powerUps.push({ col: 1, row: 1, kind: 'fullfire' });
    tick(state, {});
    expect(p1.fireRange).toBe(MAX_FIRE);
    p1.curse = {
      kind: 'slow',
      untilTick: state.tick + CURSE_TICKS,
      sinceTick: state.tick,
    };

    eliminatePlayer(state, 'p1');

    expect(state.powerUps.map((p) => p.kind).sort()).toEqual([
      'fullfire',
      'skull',
    ]);
    expect(p1.curse).toBeNull();
  });

  it('leave nothing for someone who picked nothing up', () => {
    const state = openArena(3);
    bombUnder(state, 'p1');

    tick(state, {});

    expect(player(state, 'p1').alive).toBe(false);
    expect(state.powerUps).toEqual([]);
  });

  it('land in the same cells on every machine', () => {
    const fall = () => {
      const state = openArena(3);
      player(state, 'p1').maxBombs = START_BOMBS + 3;
      eliminatePlayer(state, 'p1');
      return state.powerUps;
    };

    expect(fall()).toEqual(fall());
  });

  it('stay with the fallen when the rule is off, and always in a stage', () => {
    const off = createGame({
      seed: 1,
      dropItems: false,
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
        { id: 'p3', name: 'P3' },
      ],
    });
    player(off, 'p1').maxBombs = START_BOMBS + 2;
    eliminatePlayer(off, 'p1');
    expect(off.powerUps).toEqual([]);

    const stage = createGame({
      seed: 1,
      stageId: 'gramado-1',
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
      ],
    });
    player(stage, 'p1').maxBombs = START_BOMBS + 2;
    const before = stage.powerUps.length;
    eliminatePlayer(stage, 'p1');
    expect(stage.powerUps).toHaveLength(before);
  });
});
