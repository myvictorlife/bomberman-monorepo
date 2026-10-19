import { cellIndex, tileAt } from './arena';
import {
  BLOCK_BURN_TICKS,
  BOMB_FUSE_TICKS,
  FLAME_TICKS,
  MAX_BOMBS,
  MAX_FIRE,
  MAX_SPEED_LEVEL,
  ROUND_END_DELAY_TICKS,
  START_BOMBS,
  START_FIRE,
  MOUNT_SHIELD_TICKS,
  TICK_RATE,
  VEST_TICKS,
} from './constants';
import { findMount } from './characters';
import {
  activeBombCount,
  applyPowerUp,
  createGame,
  eliminatePlayer,
  isDashing,
  JUMP_REACH,
  jumpLanding,
  mergeFlameShapes,
  tick,
} from './game';
import { speedOf } from './movement';
import { input, openArena, player, run, setBlock } from './testing.spec-helper';

describe('createGame', () => {
  it('spawns players in the corners with the starting stats', () => {
    const state = createGame({
      seed: 1,
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
    });

    expect(state.players.map((p) => [p.x, p.y])).toEqual([
      [1, 1],
      [13, 11],
      [13, 1],
      [1, 11],
    ]);
    expect(state.players[0]).toMatchObject({
      alive: true,
      maxBombs: START_BOMBS,
      fireRange: START_FIRE,
      speedLevel: 0,
    });
    expect(state.phase).toBe('playing');
  });

  it('rejects an empty or overfull round', () => {
    expect(() => createGame({ seed: 1, players: [] })).toThrow();
    expect(() =>
      createGame({
        seed: 1,
        players: Array.from({ length: 6 }, (_, i) => ({
          id: `${i}`,
          name: '',
        })),
      }),
    ).toThrow();
  });

  it('seats five players: four corners and the middle', () => {
    const state = createGame({
      seed: 1,
      players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: '' })),
    });

    expect(state.players.map((p) => [p.x, p.y])).toEqual([
      [1, 1],
      [13, 11],
      [13, 1],
      [1, 11],
      [7, 6],
    ]);
  });
});

describe('bombs', () => {
  it('drops a bomb on the cell under the player', () => {
    const state = openArena();
    tick(state, { p1: input(null, true) });

    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]).toMatchObject({
      col: 1,
      row: 1,
      ownerId: 'p1',
      range: START_FIRE,
    });
    expect(state.events).toContainEqual({
      type: 'bomb-placed',
      col: 1,
      row: 1,
      playerId: 'p1',
    });
  });

  it('respects the bomb limit and never stacks two bombs on one cell', () => {
    const state = openArena();
    tick(state, { p1: input(null, true) });
    tick(state, { p1: input(null, true) });
    expect(state.bombs).toHaveLength(1);

    player(state, 'p1').maxBombs = 3;
    tick(state, { p1: input(null, true) });
    expect(state.bombs).toHaveLength(1);
    expect(activeBombCount(state, 'p1')).toBe(1);
  });

  it('lets the owner walk off their bomb but not back onto it', () => {
    const state = openArena();
    tick(state, { p1: input(null, true) });
    run(state, 30, { p1: input('right') });
    const p1 = player(state, 'p1');
    expect(p1.x).toBeGreaterThanOrEqual(2);
    expect(state.bombs[0]?.passThrough).toEqual([]);

    run(state, 30, { p1: input('left') });
    expect(p1.x).toBe(2);
  });

  it('explodes after the fuse in a cross of its range, stopped by walls', () => {
    const state = openArena();
    tick(state, { p1: input(null, true) });
    run(state, 30, { p1: input('right') }); // to (2,1)…
    run(state, 30, { p1: input('right') }); // …and on to safety
    // The bomb lives exactly BOMB_FUSE_TICKS ticks, counting the one it was dropped on.
    run(state, BOMB_FUSE_TICKS - 62);
    expect(state.bombs).toHaveLength(1);

    tick(state, {});

    expect(state.bombs).toHaveLength(0);
    expect(state.events).toContainEqual({ type: 'explosion', col: 1, row: 1 });
    const cells = state.flames
      .map((f) => `${f.col},${f.row}:${f.shape}`)
      .sort();
    // Range 2 from (1,1): up/left hit the outer wall; right and down reach 2 cells.
    expect(cells).toEqual(
      [
        '1,1:center',
        '1,2:vertical',
        '1,3:end-down',
        '2,1:horizontal',
        '3,1:end-right',
      ].sort(),
    );
  });

  it('burns the first soft block it meets and stops there', () => {
    const state = openArena();
    setBlock(state, 7, 1);
    const index = cellIndex(state, 7, 1);
    state.hiddenPowerUps[index] = 'fire';
    state.bombs.push({
      id: 1,
      col: 5,
      row: 1,
      ownerId: 'p2',
      fuse: 1,
      range: 5,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    tick(state, {});

    expect(state.burningBlocks).toEqual([
      expect.objectContaining({ col: 7, row: 1 }),
    ]);
    expect(state.events).toContainEqual({
      type: 'block-destroyed',
      col: 7,
      row: 1,
    });
    expect(state.flames.some((f) => f.col === 7 || f.col === 8)).toBe(false);
    expect(state.tiles[index]).toBe('block');

    run(state, BLOCK_BURN_TICKS);
    expect(state.tiles[index]).toBe('empty');
    expect(state.powerUps).toEqual([{ col: 7, row: 1, kind: 'fire' }]);
    expect(state.hiddenPowerUps[index]).toBeNull();
  });

  it('burns a block only once when two flames reach it', () => {
    const state = openArena();
    setBlock(state, 7, 1);
    state.bombs.push(
      {
        id: 1,
        col: 5,
        row: 1,
        ownerId: 'p2',
        fuse: 1,
        range: 3,
        passThrough: [],
        pierce: false,
        remote: false,
      },
      {
        id: 2,
        col: 9,
        row: 1,
        ownerId: 'p2',
        fuse: 1,
        range: 3,
        passThrough: [],
        pierce: false,
        remote: false,
      },
    );

    tick(state, {});

    expect(state.burningBlocks).toHaveLength(1);
  });

  it('chains into another bomb in its path', () => {
    const state = openArena();
    state.bombs.push(
      {
        id: 10,
        col: 5,
        row: 1,
        ownerId: 'p2',
        fuse: 1,
        range: 2,
        passThrough: [],
        pierce: false,
        remote: false,
      },
      {
        id: 11,
        col: 7,
        row: 1,
        ownerId: 'p2',
        fuse: 999,
        range: 2,
        passThrough: [],
        pierce: false,
        remote: false,
      },
    );

    tick(state, {});

    expect(state.bombs).toHaveLength(0);
    expect(state.events.filter((e) => e.type === 'explosion')).toHaveLength(2);
    expect(state.flames.find((f) => f.col === 7 && f.row === 1)?.shape).toBe(
      'center',
    );
    expect(state.flames.some((f) => f.col === 9 && f.row === 1)).toBe(true);
  });

  it('detonates a bomb dropped into a lingering flame', () => {
    const state = openArena();
    state.flames.push({
      col: 5,
      row: 1,
      shape: 'horizontal',
      ticksLeft: 10,
      ownerId: null,
    });
    state.bombs.push({
      id: 1,
      col: 5,
      row: 1,
      ownerId: 'p2',
      fuse: 999,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    tick(state, {});

    expect(state.bombs).toHaveLength(0);
  });

  it('destroys an exposed power-up in its path, which stops the flame', () => {
    const state = openArena();
    state.powerUps.push({ col: 6, row: 1, kind: 'bomb' });
    state.bombs.push({
      id: 1,
      col: 5,
      row: 1,
      ownerId: 'p2',
      fuse: 1,
      range: 3,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    tick(state, {});

    expect(state.powerUps).toEqual([]);
    expect(state.events).toContainEqual({
      type: 'power-up-burned',
      col: 6,
      row: 1,
    });
    expect(state.flames.find((f) => f.col === 6)?.shape).toBe('end-right');
    expect(state.flames.some((f) => f.col === 7 && f.row === 1)).toBe(false);
  });

  it('removes flames after their lifetime', () => {
    const state = openArena();
    state.bombs.push({
      id: 1,
      col: 7,
      row: 5,
      ownerId: 'p2',
      fuse: 1,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    tick(state, {});
    expect(state.flames.length).toBeGreaterThan(0);

    run(state, FLAME_TICKS);
    expect(state.flames).toEqual([]);
  });
});

describe('flame shapes', () => {
  it('merges flames crossing the same cell', () => {
    expect(mergeFlameShapes('horizontal', 'horizontal')).toBe('horizontal');
    expect(mergeFlameShapes('end-left', 'end-right')).toBe('horizontal');
    expect(mergeFlameShapes('end-up', 'vertical')).toBe('vertical');
    expect(mergeFlameShapes('horizontal', 'vertical')).toBe('center');
    expect(mergeFlameShapes('center', 'end-up')).toBe('center');
  });
});

describe('power-ups', () => {
  it('is collected by walking over it', () => {
    const state = openArena();
    state.powerUps.push({ col: 2, row: 1, kind: 'bomb' });

    run(state, 20, { p1: input('right') });

    expect(state.powerUps).toEqual([]);
    expect(player(state, 'p1').maxBombs).toBe(START_BOMBS + 1);
  });

  it('applies each kind and caps it', () => {
    const p = player(openArena(), 'p1');
    applyPowerUp(p, 'fire');
    applyPowerUp(p, 'speed');
    expect(p.fireRange).toBe(START_FIRE + 1);
    expect(p.speedLevel).toBe(1);

    for (let i = 0; i < 20; i++) {
      applyPowerUp(p, 'bomb');
      applyPowerUp(p, 'fire');
      applyPowerUp(p, 'speed');
    }
    expect(p.maxBombs).toBe(MAX_BOMBS);
    expect(p.fireRange).toBe(MAX_FIRE);
    expect(p.speedLevel).toBe(MAX_SPEED_LEVEL);
  });

  it('hatches an egg into a mount, deterministically', () => {
    const state = openArena();
    state.powerUps.push({ col: 2, row: 1, kind: 'egg' });
    const again = openArena();
    again.powerUps.push({ col: 2, row: 1, kind: 'egg' });

    run(state, 20, { p1: input('right') });
    run(again, 20, { p1: input('right') });

    const p1 = player(state, 'p1');
    expect(p1.mountId).not.toBeNull();
    expect(p1.mountId).toBe(player(again, 'p1').mountId);
    expect(p1.maxBombs).toBe(START_BOMBS);
  });

  it('reports the mount gained with the egg', () => {
    const state = openArena();
    state.powerUps.push({ col: 1, row: 1, kind: 'egg' });

    tick(state, {});

    expect(state.events).toContainEqual({
      type: 'power-up-collected',
      playerId: 'p1',
      kind: 'egg',
    });
    expect(state.events).toContainEqual({
      type: 'mount-gained',
      playerId: 'p1',
      mountId: player(state, 'p1').mountId,
    });
  });
});

describe('mounts', () => {
  it("takes the hit in the rider's place and shields them while the flame burns", () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    state.bombs.push({
      id: 100,
      col: 1,
      row: 1,
      ownerId: 'p1',
      fuse: 1,
      range: 1,
      passThrough: ['p1'],
      pierce: false,
      remote: false,
    });

    tick(state, {});

    expect(p1.alive).toBe(true);
    expect(p1.mountId).toBeNull();
    expect(state.events).toContainEqual({ type: 'mount-lost', playerId: 'p1' });

    // Standing in the same flame for its whole life: still alive.
    run(state, FLAME_TICKS, {});
    expect(p1.alive).toBe(true);
  });

  it('is mortal again once the shield runs out', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'pato';
    state.bombs.push({
      id: 100,
      col: 1,
      row: 1,
      ownerId: 'p1',
      fuse: 1,
      range: 1,
      passThrough: ['p1'],
      pierce: false,
      remote: false,
    });
    tick(state, {});
    run(state, MOUNT_SHIELD_TICKS, {});

    state.bombs.push({
      id: 101,
      col: 1,
      row: 1,
      ownerId: 'p1',
      fuse: 1,
      range: 1,
      passThrough: ['p1'],
      pierce: false,
      remote: false,
    });
    tick(state, {});

    expect(p1.alive).toBe(false);
  });
});

describe('deaths and the end of a round', () => {
  function killWithBomb(state: ReturnType<typeof openArena>, id: string) {
    const p = player(state, id);
    state.bombs.push({
      id: 100 + p.slot,
      col: Math.round(p.x),
      row: Math.round(p.y),
      ownerId: id,
      fuse: 1,
      range: 1,
      passThrough: [id],
      pierce: false,
      remote: false,
    });
  }

  it('kills a player standing in a flame and stops reading their input', () => {
    const state = openArena();
    killWithBomb(state, 'p1');

    tick(state, {});

    const p1 = player(state, 'p1');
    expect(p1.alive).toBe(false);
    expect(p1.diedAtTick).toBe(state.tick);
    expect(state.events).toContainEqual({
      type: 'player-died',
      playerId: 'p1',
      killerId: 'p1',
    });

    run(state, 5, { p1: input('right', true) });
    expect(p1.x).toBe(1);
  });

  it('declares the last survivor the winner after the delay', () => {
    const state = openArena();
    killWithBomb(state, 'p1');
    tick(state, {});
    expect(state.endsAtTick).toBe(state.tick + ROUND_END_DELAY_TICKS);

    run(state, ROUND_END_DELAY_TICKS - 1);
    expect(state.phase).toBe('playing');
    tick(state, {});

    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p2');
    expect(state.events).toContainEqual({ type: 'round-over', winnerId: 'p2' });

    const frozenAt = state.tick;
    tick(state, {});
    expect(state.tick).toBe(frozenAt);
    expect(state.events).toEqual([]);
  });

  it('keeps the last one standing as the winner, whatever reaches them before the delay runs out', () => {
    const state = openArena();
    killWithBomb(state, 'p1');
    tick(state, {});
    killWithBomb(state, 'p2');
    run(state, ROUND_END_DELAY_TICKS);

    expect(player(state, 'p2').alive).toBe(true);
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('p2');
  });

  it('is a draw only when the last two fall in the same tick', () => {
    const state = openArena();
    killWithBomb(state, 'p1');
    killWithBomb(state, 'p2');
    tick(state, {});
    run(state, ROUND_END_DELAY_TICKS);

    expect(state.phase).toBe('over');
    expect(state.winnerId).toBeNull();
  });

  it('gives the round to a rider whose mount took the blast that killed the other', () => {
    const state = openArena();
    player(state, 'p1').mountId = 'tatu';
    killWithBomb(state, 'p1');
    killWithBomb(state, 'p2');
    tick(state, {});
    expect(state.events).toContainEqual({ type: 'mount-lost', playerId: 'p1' });

    // The rider's moment of shelter runs out long before the flame does: no matter.
    killWithBomb(state, 'p1');
    run(state, ROUND_END_DELAY_TICKS);

    expect(state.winnerId).toBe('p1');
  });

  it('lets nobody leave a decided round: the winner who closes the tab still won', () => {
    const state = openArena();
    killWithBomb(state, 'p1');
    tick(state, {});

    expect(eliminatePlayer(state, 'p2')).toBeNull();
    run(state, ROUND_END_DELAY_TICKS);
    expect(state.winnerId).toBe('p2');
  });

  it('never ends a single-player sandbox', () => {
    const state = openArena(1);
    killWithBomb(state, 'p1');
    run(state, ROUND_END_DELAY_TICKS + 5);

    expect(state.phase).toBe('playing');
  });
});

describe('mount abilities', () => {
  const bombUnder = (
    state: ReturnType<typeof openArena>,
    id: string,
    fuse = 1,
  ) => {
    const p = player(state, id);
    state.bombs.push({
      id: 200,
      col: Math.round(p.x),
      row: Math.round(p.y),
      ownerId: id,
      fuse,
      range: 1,
      passThrough: [id],
      pierce: false,
      remote: false,
    });
  };

  it('Tatu rolls the way the keys point, faster, still bombing, and keeps going with no keys held', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    const { cooldownTicks, speedBonus } = findMount('tatu').ability as {
      cooldownTicks: number;
      speedBonus: number;
    };
    expect(cooldownTicks).toBe(0);
    const walking = speedOf(p1);

    tick(state, { p1: { direction: 'right', bomb: true, ability: true } });

    expect(isDashing(state, p1)).toBe(true);
    expect(state.events).toContainEqual({
      type: 'ability-used',
      playerId: 'p1',
      mountId: 'tatu',
    });
    expect(speedOf(p1, state.tick)).toBeCloseTo(walking + speedBonus);
    expect(p1.x).toBeCloseTo(1 + (walking + speedBonus) / TICK_RATE);
    // Bombs still drop while rolling.
    expect(state.bombs).toHaveLength(1);

    // Hands off the keys: it rolls on.
    run(state, 10, {});
    expect(isDashing(state, p1)).toBe(true);
    expect(p1.x).toBeGreaterThan(2);
  });

  it('Tatu cannot turn mid-roll: the keys are ignored until it stops', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    tick(state, { p1: { direction: 'right', bomb: false, ability: true } });

    run(state, 10, { p1: input('down') });

    expect(p1.y).toBe(1);
    expect(p1.facing).toBe('right');
  });

  it('Tatu rolls until something stops it, then walks normally again', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    setBlock(state, 6, 1);
    tick(state, { p1: { direction: 'right', bomb: false, ability: true } });

    for (let i = 0; i < 200 && isDashing(state, p1); i++) tick(state, {});

    expect(isDashing(state, p1)).toBe(false);
    expect(p1.x).toBe(5);
    expect(speedOf(p1, state.tick)).toBeCloseTo(
      speedOf({ ...p1, mountId: 'tatu' }),
    );
    run(state, 10, { p1: input('down') });
    expect(p1.y).toBeGreaterThan(1);
  });

  it('Tatu crosses the open arena if nothing stops it', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    // Row 1 is open from wall to wall in the test arena.
    for (let col = 2; col < state.cols - 1; col++)
      expect(tileAt(state, col, 1)).toBe('empty');
    tick(state, { p1: { direction: 'right', bomb: false, ability: true } });
    for (let i = 0; i < 400 && isDashing(state, p1); i++) tick(state, {});

    expect(p1.x).toBe(state.cols - 2);
  });

  it('Tatu stops on a second press, and can roll again at once', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    tick(state, { p1: { direction: 'right', bomb: false, ability: true } });
    run(state, 5, {});

    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(isDashing(state, p1)).toBe(false);
    const stoppedAt = p1.x;
    tick(state, {});
    expect(p1.x).toBe(stoppedAt);

    tick(state, { p1: { direction: 'left', bomb: false, ability: true } });
    expect(isDashing(state, p1)).toBe(true);
    expect(p1.facing).toBe('left');
  });

  it('Tatu still takes hits: a flame takes the mount', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'tatu';
    tick(state, { p1: { direction: 'right', bomb: false, ability: true } });
    bombUnder(state, 'p1');
    tick(state, {});
    expect(p1.mountId).toBeNull();
  });

  it("Poraquê short-circuits: every bomb within 2 cells goes off at once, anyone's", () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'galinha';
    const { radius, cooldownTicks } = findMount('galinha').ability as {
      radius: number;
      cooldownTicks: number;
    };
    expect(radius).toBe(2);
    expect(cooldownTicks).toBe(0);
    const bomb = (id: number, col: number, row: number, remote = false) => ({
      id,
      col,
      row,
      ownerId: 'p2',
      fuse: BOMB_FUSE_TICKS,
      range: 1,
      passThrough: [],
      pierce: false,
      remote,
    });
    // p1 stands on (1,1): (3,1) and (2,2) are 2 away, (3,3) is 4 away.
    state.bombs.push(bomb(301, 3, 1, true), bomb(302, 2, 2), bomb(303, 3, 3));

    tick(state, { p1: { direction: null, bomb: false, ability: true } });

    expect(state.events).toContainEqual({
      type: 'ability-used',
      playerId: 'p1',
      mountId: 'galinha',
    });
    expect(state.bombs.map((b) => b.id)).toEqual([303]);
    expect(
      state.events.filter((e) => e.type === 'explosion').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('Pato jumps over the bomb ahead and lands on the next cell, untouchable in the air', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'pato';
    p1.facing = 'right';
    state.bombs.push({
      id: 201,
      col: 2,
      row: 1,
      ownerId: 'p2',
      fuse: 1,
      range: 3,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    const { durationTicks } = findMount('pato').ability as {
      durationTicks: number;
    };

    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(p1.jump).not.toBeNull();
    expect(state.events).toContainEqual({
      type: 'ability-used',
      playerId: 'p1',
      mountId: 'pato',
    });

    // The bomb goes off underneath; steering and bombs are ignored in the air.
    tick(state, { p1: input('left', true) });
    expect(p1.x).toBeGreaterThan(1);
    expect(p1.alive).toBe(true);
    expect(p1.mountId).toBe('pato');
    expect(state.bombs.filter((b) => b.ownerId === 'p1')).toHaveLength(0);

    // Lands exactly on the next cell, whatever was held meanwhile.
    run(state, durationTicks - 1, { p1: input('left', true) });
    expect(p1.jump).toBeNull();
    expect([p1.x, p1.y]).toEqual([3, 1]);
    expect(p1.alive).toBe(true);
  });

  it('Pato hops over exactly one cell, crate or pillar, and lands on the next', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'pato';
    p1.x = 1;
    p1.y = 2;
    p1.facing = 'right';
    expect(tileAt(state, 2, 2)).toBe('wall');
    const { durationTicks } = findMount('pato').ability as {
      durationTicks: number;
    };

    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(p1.jump).toMatchObject({
      toX: 3,
      toY: 2,
      endTick: durationTicks + 1,
    });

    run(state, durationTicks, {});
    expect(p1.jump).toBeNull();
    expect([p1.x, p1.y]).toEqual([3, 2]);
  });

  it('Pato does not jump when the cell after the one it clears is taken, even with room further on', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'pato';
    p1.facing = 'right';
    // Crate, crate, free: the free cell is the third one, out of reach.
    setBlock(state, 2, 1);
    setBlock(state, 3, 1);
    expect(jumpLanding(state, p1, JUMP_REACH)).toBeNull();
    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(p1.jump).toBeNull();
    expect(state.events).not.toContainEqual(
      expect.objectContaining({ type: 'ability-used' }),
    );

    // A bomb on the landing cell blocks it the same way.
    state.tiles = state.tiles.map((t) => (t === 'block' ? 'empty' : t));
    state.bombs.push({
      id: 7,
      col: 3,
      row: 1,
      ownerId: 'p2',
      fuse: 99,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });
    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(p1.jump).toBeNull();
  });

  it('Pato cannot jump over the border', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'pato';
    p1.facing = 'up';
    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(p1.jump).toBeNull();
  });

  it('Bernardo drops a line of three bombs at once, over the limit, stopping at a crate', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'bernardo';
    p1.facing = 'right';
    expect(p1.maxBombs).toBe(1);
    // Cells (1,1) … (4,1) are open at the start; a crate at (4,1) ends the line early.
    setBlock(state, 4, 1);

    tick(state, { p1: { direction: null, bomb: false, ability: true } });

    expect(state.bombs.map((b) => [b.col, b.row])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(
      state.bombs.every((b) => b.ownerId === 'p1' && b.range === p1.fireRange),
    ).toBe(true);
    expect(state.events.filter((e) => e.type === 'bomb-placed')).toHaveLength(
      3,
    );
    expect(state.events).toContainEqual({
      type: 'ability-used',
      playerId: 'p1',
      mountId: 'bernardo',
    });
    // The rider stands on the first one and can walk off it.
    expect(state.bombs[0]?.passThrough).toEqual(['p1']);

    // Up against a crate the line is shorter; with nowhere at all it is nothing.
    state.bombs = [];
    setBlock(state, 2, 1);
    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(state.bombs.map((b) => [b.col, b.row])).toEqual([[1, 1]]);
    state.bombs = [];
    setBlock(state, 1, 1);
    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(state.bombs).toHaveLength(0);
    expect(state.events).not.toContainEqual(
      expect.objectContaining({ type: 'ability-used' }),
    );
  });

  it('Capivara needs no button: the ability press does nothing', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.mountId = 'capivara';

    tick(state, { p1: { direction: null, bomb: false, ability: true } });

    expect(state.events).toEqual([]);
    expect(p1.abilityReadyAtTick).toBe(0);
  });

  it('ignores the button without a mount', () => {
    const state = openArena();
    tick(state, { p1: { direction: null, bomb: false, ability: true } });
    expect(state.events).toEqual([]);
  });
});

describe('bomb items', () => {
  it('pierce: the flame burns every crate in range instead of stopping at the first', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    setBlock(state, 2, 1);
    setBlock(state, 3, 1);
    p1.fireRange = 3;
    p1.pierce = true;

    tick(state, { p1: input(null, true) });
    run(state, BOMB_FUSE_TICKS, {});

    expect(state.burningBlocks.map((b) => b.col)).toEqual([2, 3]);
    expect(state.flames.some((f) => f.col === 3 && f.row === 1)).toBe(true);
  });

  it('remote: bombs wait for the detonate button, which sets off the oldest, whatever the count', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.remote = true;
    p1.maxBombs = 3;
    p1.fireRange = 1;

    tick(state, { p1: input(null, true) });
    // Far enough that the first blast does not chain into the second bomb.
    run(state, 60, { p1: input('right') });
    tick(state, { p1: input(null, true) });
    run(state, BOMB_FUSE_TICKS * 2, {});
    expect(state.bombs).toHaveLength(2);
    expect(state.bombs.every((b) => b.remote)).toBe(true);

    // The bomb button keeps dropping bombs; it never detonates.
    expect(state.events).not.toContainEqual(
      expect.objectContaining({ type: 'explosion' }),
    );

    tick(state, { p1: { direction: null, bomb: false, detonate: true } });
    expect(state.bombs).toHaveLength(1);
    expect(state.events).toContainEqual({ type: 'explosion', col: 1, row: 1 });

    tick(state, { p1: { direction: null, bomb: false, detonate: true } });
    expect(state.bombs).toHaveLength(0);
  });

  it('detonate does nothing without remote bombs', () => {
    const state = openArena();
    tick(state, { p1: input(null, true) });
    tick(state, { p1: { direction: null, bomb: false, detonate: true } });
    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]?.fuse).toBeGreaterThan(0);
  });

  it('remote: a remote bomb still goes off when another flame reaches it', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.remote = true;
    tick(state, { p1: input(null, true) });
    run(state, 5, { p1: input('right') });
    state.bombs.push({
      id: 400,
      col: 2,
      row: 1,
      ownerId: 'p2',
      fuse: 1,
      range: 2,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    tick(state, {});

    expect(state.bombs).toHaveLength(0);
  });

  it('vest: flames are harmless for a while, then not', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    state.powerUps.push({ col: 1, row: 1, kind: 'vest' });
    tick(state, {});
    expect(p1.vestUntilTick).toBe(state.tick + VEST_TICKS);

    state.bombs.push({
      id: 401,
      col: 1,
      row: 1,
      ownerId: 'p1',
      fuse: 1,
      range: 1,
      passThrough: ['p1'],
      pierce: false,
      remote: false,
    });
    tick(state, {});
    expect(p1.alive).toBe(true);

    run(state, VEST_TICKS, {});
    state.bombs.push({
      id: 402,
      col: 1,
      row: 1,
      ownerId: 'p1',
      fuse: 1,
      range: 1,
      passThrough: ['p1'],
      pierce: false,
      remote: false,
    });
    tick(state, {});
    expect(p1.alive).toBe(false);
  });

  it('applies pierce and remote as flags', () => {
    const p = player(openArena(), 'p1');
    applyPowerUp(p, 'pierce');
    applyPowerUp(p, 'remote');
    expect(p.pierce).toBe(true);
    expect(p.remote).toBe(true);
  });
});

describe('eliminatePlayer', () => {
  const twoPlayers = () =>
    createGame({
      seed: 1,
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    });

  it('takes a player out and hands back the event to forward', () => {
    const state = twoPlayers();

    expect(eliminatePlayer(state, 'b')).toEqual({
      type: 'player-died',
      playerId: 'b',
      killerId: null,
    });
    expect(state.players[1]).toMatchObject({
      alive: false,
      moving: false,
      diedAtTick: state.tick,
    });
  });

  it('ends a two-player round with the one who stayed as the winner', () => {
    const state = twoPlayers();
    eliminatePlayer(state, 'b');

    for (let i = 0; i <= ROUND_END_DELAY_TICKS + 1; i++) {
      tick(state, {
        a: { direction: null, bomb: false },
        b: { direction: null, bomb: false },
      });
    }

    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe('a');
  });

  it('does nothing for an unknown, dead or finished player', () => {
    const state = twoPlayers();

    expect(eliminatePlayer(state, 'ghost')).toBeNull();
    eliminatePlayer(state, 'b');
    expect(eliminatePlayer(state, 'b')).toBeNull();
    state.phase = 'over';
    expect(eliminatePlayer(state, 'a')).toBeNull();
  });
});
