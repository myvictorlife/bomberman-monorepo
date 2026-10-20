import {
  BOMB_FUSE_TICKS,
  CHARACTERS,
  createGame,
  MOUNTS,
  TICK_RATE,
} from '@libs/game-core';
import {
  CHARACTER_PAINTERS,
  MOUNT_PAINTERS,
} from './characters/cartoon/cartoon';
import { CHARACTER_TILE } from './characters/paint-character';
import { DirectionTracker } from './controls';
import { sameHud, toHud } from './hud';
import { LocalSession } from './session/local-session';
import {
  FLAME_ICON,
  PLAYER_PALETTES,
  playerGrid,
  SKATE_ICON,
  TILE,
} from './skins/classic/classic-sprites';
import { allTextureKeys, TEXTURE } from './skins/texture-keys';

const TICK_MS = 1000 / TICK_RATE;
const players = [
  { id: 'p1', name: 'P1' },
  { id: 'p2', name: 'P2' },
];

describe('DirectionTracker', () => {
  it('follows the most recently pressed key that is still held', () => {
    const tracker = new DirectionTracker();
    expect(tracker.current).toBeNull();

    tracker.press('right');
    tracker.press('down');
    expect(tracker.current).toBe('down');

    tracker.release('down');
    expect(tracker.current).toBe('right');

    tracker.press('up');
    tracker.press('right'); // pressed again → moves to the top
    tracker.release('up');
    expect(tracker.current).toBe('right');

    tracker.release('left'); // not held: no-op
    tracker.clear();
    expect(tracker.current).toBeNull();
  });
});

describe('LocalSession', () => {
  it('runs one fixed tick per 1/60 s and carries the remainder', () => {
    const session = new LocalSession({ seed: 1, players });

    session.advance(TICK_MS * 0.6, {});
    expect(session.state.tick).toBe(0);
    session.advance(TICK_MS * 0.6, {});
    expect(session.state.tick).toBe(1);
    session.advance(TICK_MS * 3, {});
    expect(session.state.tick).toBe(4);
  });

  it('does not try to catch up a huge frame, nor go backwards', () => {
    const session = new LocalSession({ seed: 1, players });

    session.advance(10_000, {});
    expect(session.state.tick).toBe(15); // capped at 250 ms

    const before = session.state.tick;
    session.advance(-50, {});
    expect(session.state.tick).toBe(before);
  });

  it('feeds held directions and latched bomb presses into the ticks', () => {
    const session = new LocalSession({ seed: 1, players });

    session.pressBomb('p1');
    const events = session.advance(TICK_MS, { p1: 'right' });

    expect(events).toContainEqual({
      type: 'bomb-placed',
      col: 1,
      row: 1,
      playerId: 'p1',
    });
    expect(session.state.players[0]?.x).toBeGreaterThan(1);

    // The press is consumed by one tick only.
    session.advance(TICK_MS * 2, {});
    expect(session.state.bombs).toHaveLength(1);
    session.advance(BOMB_FUSE_TICKS * TICK_MS, {});
  });

  it('latches the detonate press for the next tick', () => {
    const session = new LocalSession({ seed: 1, players });
    const p1 = session.state.players[0];
    if (!p1) throw new Error('no p1');
    p1.remote = true;
    session.pressBomb('p1');
    session.advance(TICK_MS, {});
    expect(session.state.bombs).toHaveLength(1);

    session.pressDetonate('p1');
    const events = session.advance(TICK_MS, {});

    expect(events).toContainEqual({ type: 'explosion', col: 1, row: 1 });
  });

  it('latches the ability press for the next tick', () => {
    const session = new LocalSession({ seed: 1, players });
    const p1 = session.state.players[0];
    if (!p1) throw new Error('no p1');
    p1.mountId = 'tatu';

    session.pressAbility('p1');
    const events = session.advance(TICK_MS, {});

    expect(events).toContainEqual({
      type: 'ability-used',
      playerId: 'p1',
      mountId: 'tatu',
    });
  });

  it('restarts with a fresh state and the same players', () => {
    const session = new LocalSession({ seed: 1, players });
    const first = session.state;
    session.pressBomb('p1');
    session.advance(TICK_MS * 0.5, {});

    session.restart(2);

    expect(session.state).not.toBe(first);
    expect(session.state.tick).toBe(0);
    expect(session.state.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    session.advance(TICK_MS * 0.6, {});
    expect(session.state.tick).toBe(0);
    session.advance(TICK_MS * 0.6, {});
    expect(session.state.bombs).toEqual([]);

    session.restart();
    expect(session.state.tick).toBe(0);
  });
});

describe('hud', () => {
  it('summarises the players and detects changes', () => {
    const state = createGame({ seed: 1, players });
    const hud = toHud(state);

    expect(hud.players[0]).toEqual({
      id: 'p1',
      slot: 0,
      colorSlot: 0,
      name: 'P1',
      alive: true,
      bombs: 1,
      fire: 2,
      speed: 0,
      mount: null,
      abilityReadyIn: 0,
      abilityActive: false,
      pierce: false,
      remote: false,
      glove: false,
      kick: false,
      vestSeconds: 0,
      wallPass: false,
      powerBomb: false,
      curse: null,
    });
    expect(sameHud(null, hud)).toBe(false);
    expect(sameHud(hud, toHud(state))).toBe(true);

    (state.players[0] as { mountId: string | null }).mountId = 'tatu';
    expect(sameHud(hud, toHud(state))).toBe(false);
    (state.players[0] as { abilityReadyAtTick: number }).abilityReadyAtTick =
      state.tick + 90;
    expect(toHud(state).players[0]?.abilityReadyIn).toBe(2);
    (state.players[0] as { mountId: string | null }).mountId = null;

    (state.players[1] as { fireRange: number }).fireRange = 3;
    expect(sameHud(hud, toHud(state))).toBe(false);

    state.phase = 'over';
    expect(sameHud(hud, toHud(state))).toBe(false);
    expect(sameHud(hud, { ...hud, players: hud.players.slice(1) })).toBe(false);
  });

  it('reports what is left of a stage, and nothing in a versus round', () => {
    expect(toHud(createGame({ seed: 1, players })).stage).toBeNull();

    const state = createGame({
      seed: 1,
      stageId: 'gramado-1',
      players: [{ id: 'p1', name: 'P1' }],
    });
    const hud = toHud(state);
    expect(hud.stage).toEqual({
      creaturesLeft: 6,
      exitOpen: false,
      result: null,
      boss: null,
      score: 0,
      livesGained: 0,
      bonus: false,
    });

    const first = state.stage?.creatures[0];
    if (first) first.alive = false;
    expect(sameHud(hud, toHud(state))).toBe(false);

    const scored = toHud(state);
    if (state.stage) state.stage.score['p1'] = 100;
    expect(sameHud(scored, toHud(state))).toBe(false);
    const cursed = toHud(state);
    const p1 = state.players[0];
    if (p1) p1.curse = { kind: 'slow', untilTick: 99, sinceTick: 0 };
    expect(toHud(state).players[0]?.curse).toBe('slow');
    expect(sameHud(cursed, toHud(state))).toBe(false);
  });

  it('reports the boss health on a boss stage', () => {
    const state = createGame({
      seed: 1,
      stageId: 'gramado-5',
      players: [{ id: 'p1', name: 'P1' }],
    });
    const hud = toHud(state);
    expect(hud.stage?.boss).toEqual({ hp: 8, maxHp: 8 });

    if (state.stage?.boss) state.stage.boss.hp = 7;
    expect(sameHud(hud, toHud(state))).toBe(false);
  });
});

describe('classic skin data', () => {
  const allowed = (palette: Record<string, string>) =>
    new Set(['.', ...Object.keys(palette)]);

  it('has a 16 × 16 player frame for every pose and step, using only palette colours', () => {
    const colours = allowed(PLAYER_PALETTES[0] as Record<string, string>);
    for (const pose of ['down', 'up', 'side'] as const) {
      for (let frame = 0; frame < 3; frame++) {
        const grid = playerGrid(pose, frame);
        expect(grid).toHaveLength(TILE);
        for (const row of grid) {
          expect(row).toHaveLength(TILE);
          for (const ch of row) expect(colours.has(ch)).toBe(true);
        }
      }
    }
    expect(() => playerGrid('down', 3)).toThrow();
  });

  it('gives every slot a palette with the same colour keys', () => {
    const keys = Object.keys(PLAYER_PALETTES[0] as object).sort();
    for (const palette of PLAYER_PALETTES)
      expect(Object.keys(palette).sort()).toEqual(keys);
  });

  it('has 12 × 12 power-up icons', () => {
    for (const icon of [FLAME_ICON, SKATE_ICON]) {
      expect(icon).toHaveLength(12);
      for (const row of icon) expect(row).toHaveLength(12);
    }
  });
});

describe('texture contract', () => {
  it('lists every key once', () => {
    const keys = allTextureKeys();

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(TEXTURE.player(3, 'left', 2));
    expect(TEXTURE.egg(2)).toBe('egg-2');
    expect(TEXTURE.playerMounted(1, 'pato', 'up', 0)).toBe(
      'player-1-pato-up-0',
    );
    expect(keys).toContain(TEXTURE.flame('end-up', 3));
    expect(keys).toContain(TEXTURE.powerUp('speed'));
    expect(TEXTURE.egg(2)).toBe('egg-2');
  });
});

describe('cartoon cast', () => {
  it('has a painter for every character and every mount', () => {
    for (const { id } of CHARACTERS)
      expect(typeof CHARACTER_PAINTERS[id]).toBe('function');
    for (const { id } of MOUNTS)
      expect(typeof MOUNT_PAINTERS[id]).toBe('function');
    expect(CHARACTER_TILE).toBe(64);
  });
});
