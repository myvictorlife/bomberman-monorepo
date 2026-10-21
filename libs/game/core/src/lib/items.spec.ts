import { cellIndex } from './arena';
import {
  BASE_SPEED,
  CLOCK_BONUS_TICKS,
  CURSE_FAST_SPEED,
  CURSE_FUSE_TICKS,
  CURSE_SLOW_SPEED,
  CURSE_TICKS,
  MAX_FIRE,
  POWER_UP_COUNTS,
  TICK_RATE,
} from './constants';
import { createGame, CURSE_KINDS, isCursed, tick } from './game';
import { speedOf } from './movement';
import { input, openArena, player } from './testing.spec-helper';
import { CurseKind, GameState, Player, PowerUpKind } from './types';

/** Drops `kind` under player `id` and runs a tick so they pick it up. */
function pickUp(state: GameState, id: string, kind: PowerUpKind): void {
  const p = player(state, id);
  state.powerUps.push({ col: Math.round(p.x), row: Math.round(p.y), kind });
  tick(state, {});
}

function cursed(state: GameState, id: string, kind: CurseKind): Player {
  const p = player(state, id);
  p.curse = {
    kind,
    untilTick: state.tick + CURSE_TICKS,
    sinceTick: state.tick,
  };
  return p;
}

describe('new items', () => {
  it('are hidden in versus too, all but the extra life, which only a stage gives', () => {
    const versus = createGame({
      seed: 3,
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
      ],
    });
    for (const kind of [
      'skull',
      'wallpass',
      'clock',
      'fullfire',
      'powerbomb',
    ] as const)
      expect(versus.hiddenPowerUps).toContain(kind);
    expect(versus.hiddenPowerUps).not.toContain('oneup');
    expect(POWER_UP_COUNTS).not.toHaveProperty('oneup');

    const stage = createGame({
      seed: 3,
      stageId: 'gramado-3',
      players: [{ id: 'p1', name: 'P1' }],
    });
    expect(stage.hiddenPowerUps).toEqual(
      expect.arrayContaining(['oneup', 'skull', 'fullfire']),
    );
  });

  it('wall pass walks through soft blocks, never walls', () => {
    const state = openArena();
    pickUp(state, 'p1', 'wallpass');
    const p1 = player(state, 'p1');
    expect(p1.wallPass).toBe(true);
    state.tiles[cellIndex(state, 2, 1)] = 'block';

    for (let i = 0; i < 30; i++) tick(state, { p1: input('right') });

    expect(p1.x).toBeGreaterThan(2);
  });

  it('full fire takes the fire to its limit', () => {
    const state = openArena();
    pickUp(state, 'p1', 'fullfire');

    expect(player(state, 'p1').fireRange).toBe(MAX_FIRE);
  });

  it('the power bomb makes the first bomb of a volley reach as far as fire goes', () => {
    const state = openArena();
    pickUp(state, 'p1', 'powerbomb');
    const p1 = player(state, 'p1');
    p1.maxBombs = 2;

    tick(state, { p1: input(null, true) });
    expect(state.bombs[0]?.range).toBe(MAX_FIRE);

    p1.x = 3;
    tick(state, { p1: input(null, true) });
    expect(state.bombs[1]?.range).toBe(p1.fireRange);
  });

  it('the clock puts time back, until the arena has started closing', () => {
    const state = openArena();
    const before = state.closesAtTick ?? 0;
    pickUp(state, 'p1', 'clock');
    expect(state.closesAtTick).toBe(before + CLOCK_BONUS_TICKS);
    expect(state.events).toContainEqual({
      type: 'time-added',
      seconds: CLOCK_BONUS_TICKS / TICK_RATE,
    });

    state.tick = state.closesAtTick ?? 0;
    pickUp(state, 'p1', 'clock');
    expect(state.closesAtTick).toBe(before + CLOCK_BONUS_TICKS);
  });

  it('an extra life only counts in stage mode', () => {
    const versus = openArena();
    pickUp(versus, 'p1', 'oneup');
    expect(versus.events.some((e) => e.type === 'life-gained')).toBe(false);

    const stage = createGame({
      seed: 1,
      stageId: 'gramado-1',
      players: [{ id: 'p1', name: 'P1' }],
    });
    pickUp(stage, 'p1', 'oneup');
    expect(stage.stage?.livesGained).toEqual({ p1: 1 });
    expect(stage.events).toContainEqual({
      type: 'life-gained',
      playerId: 'p1',
    });
  });
});

describe('the skull', () => {
  it('curses for a while, then wears off', () => {
    const state = openArena();
    pickUp(state, 'p1', 'skull');
    const p1 = player(state, 'p1');

    expect(p1.curse?.kind && CURSE_KINDS.includes(p1.curse.kind)).toBe(true);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: 'cursed', playerId: 'p1' }),
    );

    state.tick = (p1.curse?.untilTick ?? 0) - 1;
    tick(state, {});
    expect(p1.curse).toBeNull();
  });

  it('reverse turns the keys round', () => {
    const state = openArena();
    const p1 = cursed(state, 'p1', 'reverse');
    p1.x = 3;

    tick(state, { p1: input('left') });

    expect(p1.x).toBeGreaterThan(3);
  });

  it('diarrhea drops bombs on its own; constipation drops none', () => {
    const state = openArena();
    cursed(state, 'p1', 'diarrhea');
    tick(state, {});
    expect(state.bombs.some((b) => b.ownerId === 'p1')).toBe(true);

    const other = openArena();
    cursed(other, 'p1', 'constipation');
    tick(other, { p1: input(null, true) });
    expect(other.bombs).toEqual([]);
  });

  it('slow and fast force the speed; a short fuse burns fast', () => {
    const state = openArena();
    const p1 = cursed(state, 'p1', 'slow');
    expect(speedOf(p1, state.tick)).toBe(CURSE_SLOW_SPEED);
    cursed(state, 'p1', 'fast');
    expect(speedOf(p1, state.tick)).toBe(CURSE_FAST_SPEED);
    expect(speedOf(p1, (p1.curse?.untilTick ?? 0) + 1)).toBe(BASE_SPEED);

    cursed(state, 'p1', 'shortfuse');
    expect(isCursed(state, p1, 'shortfuse')).toBe(true);
    tick(state, { p1: input(null, true) });
    expect(state.bombs[0]?.fuse).toBeLessThanOrEqual(CURSE_FUSE_TICKS);
  });

  it('passes on by touch, and not straight back', () => {
    const state = openArena();
    const p1 = cursed(state, 'p1', 'slow');
    const p2 = player(state, 'p2');
    Object.assign(p2, { x: p1.x, y: p1.y });

    tick(state, {});
    expect(p2.curse).toBeNull();

    state.tick += TICK_RATE;
    tick(state, {});
    expect(p1.curse).toBeNull();
    expect(p2.curse?.kind).toBe('slow');
    expect(state.events).toContainEqual({
      type: 'curse-passed',
      fromId: 'p1',
      toId: 'p2',
    });

    tick(state, {});
    expect(p1.curse).toBeNull();
  });
});
