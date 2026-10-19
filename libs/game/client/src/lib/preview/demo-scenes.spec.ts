import {
  BOMB_FUSE_TICKS,
  cellIndex,
  isDashing,
  Player,
  playerCell,
  START_FIRE,
} from '@libs/game-core';
import {
  BERNARDO_SCENE,
  CAPIVARA_SCENE,
  DEMO_SCENES,
  demoScene,
  LOCAL_SCENE,
  ModeDemo,
  MOUNT_SCENES,
  ONLINE_SCENE,
  PATO_SCENE,
  GALINHA_SCENE,
  RESULT_HOLD_TICKS,
  TATU_SCENE,
  towards,
} from './demo-scenes';

/** Runs the scene until the condition holds or `max` ticks went by. */
function runUntil(demo: ModeDemo, done: () => boolean, max = 2_000): number {
  let ticks = 0;
  while (!done() && ticks < max) {
    demo.step();
    ticks++;
  }
  return ticks;
}

describe('towards', () => {
  it('walks one axis at a time and stops on the cell', () => {
    expect(towards({ x: 1, y: 1 }, [3, 1])).toBe('right');
    expect(towards({ x: 3, y: 1 }, [1, 1])).toBe('left');
    expect(towards({ x: 1, y: 1 }, [1, 3])).toBe('down');
    expect(towards({ x: 1, y: 3 }, [1, 1])).toBe('up');
    expect(towards({ x: 2.5, y: 1 }, [2, 3])).toBe('left');
    expect(towards({ x: 2.04, y: 2.96 }, [2, 3])).toBeNull();
  });
});

describe('the local scene', () => {
  it('carves the paths open and plants the crate with the fire', () => {
    const demo = new ModeDemo(LOCAL_SCENE);
    const { state } = demo;
    for (const [col, row] of LOCAL_SCENE.clear)
      expect(state.tiles[cellIndex(state, col, row)]).toBe('empty');
    expect(state.tiles[cellIndex(state, 4, 1)]).toBe('block');
    expect(state.hiddenPowerUps[cellIndex(state, 4, 1)]).toBe('fire');
    expect(state.players.map((p) => p.name)).toEqual(['Faísca', 'Dra. Lia']);
  });

  it('plays the script through: Faísca gets the fire and wins', () => {
    const demo = new ModeDemo(LOCAL_SCENE);
    const p1 = () => demo.state.players[0] as Player;
    const p2 = () => demo.state.players[1] as Player;

    runUntil(demo, () => p1().fireRange > START_FIRE);
    expect(p1().fireRange).toBe(START_FIRE + 1);
    expect(p2().alive).toBe(true);
    expect(demo.state.tick).toBeGreaterThan(250);

    // Dra. Lia goes down to Faísca's bigger blast in the middle, not to her own bomb.
    runUntil(demo, () => demo.state.phase === 'over');
    expect(demo.state.phase).toBe('over');
    expect(demo.state.winnerId).toBe('p1');
    expect(p2().alive).toBe(false);
    expect(p2().diedAtTick).toBeGreaterThan(500);
    expect(demo.state.tick).toBeLessThan(LOCAL_SCENE.lengthTicks);
  });

  it('starts over after the round is shown, and again at the script’s length', () => {
    const demo = new ModeDemo(LOCAL_SCENE);
    runUntil(demo, () => demo.state.phase === 'over');
    const decidedAt = demo.state.tick;
    // The result holds: the rules' clock stops on a decided round.
    for (let i = 0; i < RESULT_HOLD_TICKS; i++) demo.step();
    expect(demo.state.phase).toBe('over');
    expect(demo.state.tick).toBe(decidedAt);
    demo.step();
    expect(demo.state.tick).toBe(1);
    expect(demo.state.phase).toBe('playing');
    expect(demo.state.players.every((p) => p.alive)).toBe(true);
    expect(demo.stepIndex('p1')).toBe(0);

    const idle = new ModeDemo({ ...LOCAL_SCENE, actors: [], lengthTicks: 30 });
    runUntil(idle, () => idle.state.tick === 30);
    expect(idle.finished).toBe(true);
    idle.step();
    expect(idle.state.tick).toBe(1);
  });

  it('squares a walker up to the cell it reached', () => {
    const demo = new ModeDemo({
      ...LOCAL_SCENE,
      actors: [{ id: 'p1', steps: [{ to: [3, 1] }, { wait: 5 }] }],
    });
    runUntil(demo, () => demo.stepIndex('p1') === 1);
    expect((demo.state.players[0] as Player).x).toBe(3);
    expect((demo.state.players[0] as Player).y).toBe(1);
  });

  it('stands still once a script runs out, and an actor who is gone sends nothing', () => {
    const demo = new ModeDemo({
      ...LOCAL_SCENE,
      actors: [
        { id: 'p1', steps: [{ wait: 2 }, { ability: true }, { bomb: true }] },
        { id: 'ghost', steps: [{ to: [3, 3] }] },
      ],
    });
    const start = (demo.state.players[0] as Player).x;
    runUntil(demo, () => demo.state.tick === 10);
    expect((demo.state.players[0] as Player).x).toBe(start);
    expect(demo.stepIndex('p1')).toBe(3);
    expect(demo.state.bombs).toHaveLength(1);
  });
});

describe('the online scene', () => {
  it('has five in the arena and three on the wall', () => {
    const demo = new ModeDemo(ONLINE_SCENE);
    expect(demo.state.players).toHaveLength(5);
    expect(demo.state.outsiders.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(demo.state.mapId).toBe('autodromo');
  });

  it('the thrower from the top catches Tião and takes his place', () => {
    const demo = new ModeDemo(ONLINE_SCENE);
    runUntil(demo, () => demo.state.thrownBombs.length > 0);
    expect(demo.state.thrownBombs[0]?.ownerId).toBe('o1');

    runUntil(demo, () => demo.state.players.some((p) => p.id === 'o1'));
    expect(demo.state.players.find((p) => p.id === 'p5')?.alive).toBe(false);
    expect(demo.state.outsiders.map((o) => o.id)).toEqual(['o2', 'o3']);
    expect(demo.state.phase).toBe('playing');
    expect(demo.state.tick).toBeLessThan(ONLINE_SCENE.lengthTicks);

    // Nobody else dies: the scene plays its whole length, then starts over.
    runUntil(demo, () => demo.state.tick === ONLINE_SCENE.lengthTicks - 1);
    expect(demo.state.phase).toBe('playing');
    expect(demo.state.players.filter((p) => p.alive).map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'o1',
    ]);
  });
});

describe('the mount scenes', () => {
  const rider = (demo: ModeDemo) => demo.state.players[0] as Player;
  const everyoneAlive = (demo: ModeDemo) =>
    demo.state.players.every((p) => p.alive);
  const usedAbility = (demo: ModeDemo) =>
    demo.state.events.some((e) => e.type === 'ability-used');

  it('seats each rider on its mount, and a face step turns without walking', () => {
    for (const [id, scene] of Object.entries(MOUNT_SCENES)) {
      expect(rider(new ModeDemo(scene)).mountId).toBe(id);
    }
    const demo = new ModeDemo({
      ...PATO_SCENE,
      actors: [{ id: 'p1', steps: [{ face: 'right' }, { wait: 5 }] }],
    });
    demo.step();
    expect(rider(demo).facing).toBe('right');
    expect(demo.stepIndex('p1')).toBe(1);
    expect(demo.state.tick).toBe(1);
  });

  it('Tatu sprints the row and walks back', () => {
    const demo = new ModeDemo(TATU_SCENE);
    runUntil(demo, () => usedAbility(demo));
    expect(isDashing(demo.state, rider(demo))).toBe(true);
    runUntil(demo, () => rider(demo).x >= 13);
    expect(demo.state.tick).toBeLessThan(200);
    runUntil(demo, () => demo.state.tick === TATU_SCENE.lengthTicks - 1);
    expect(playerCell(rider(demo))).toEqual([1, 1]);
    expect(everyoneAlive(demo)).toBe(true);
  });

  it('Pato hops one cell at a time, over two pillars and a crate, then walks home', () => {
    const demo = new ModeDemo(PATO_SCENE);
    for (const [toX, toY] of [
      [3, 2],
      [5, 2],
      [3, 1],
    ]) {
      runUntil(demo, () => rider(demo).jump !== null);
      expect(rider(demo).jump).toMatchObject({ toX, toY });
      runUntil(demo, () => rider(demo).jump === null);
    }
    runUntil(demo, () => demo.state.tick === PATO_SCENE.lengthTicks - 1);
    expect(playerCell(rider(demo))).toEqual([1, 1]);
    expect(everyoneAlive(demo)).toBe(true);
  });

  it('Bernardo drops three bombs down the row and outruns them', () => {
    const demo = new ModeDemo(BERNARDO_SCENE);
    runUntil(demo, () => demo.state.bombs.length === 3);
    expect(demo.state.bombs.map((b) => [b.col, b.row])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    runUntil(demo, () => demo.state.bombs.length === 0);
    expect(rider(demo).alive).toBe(true);
    runUntil(demo, () => demo.state.tick === BERNARDO_SCENE.lengthTicks - 1);
    expect(playerCell(rider(demo))).toEqual([1, 1]);
    expect(demo.state.phase).toBe('playing');
  });

  it('Capivara walks over Tião’s bomb and nobody is hurt', () => {
    const demo = new ModeDemo(CAPIVARA_SCENE);
    runUntil(demo, () => demo.state.bombs.length === 1);
    const bomb = demo.state.bombs[0];
    expect([bomb?.col, bomb?.row]).toEqual([7, 1]);
    const ticks = runUntil(
      demo,
      () =>
        playerCell(rider(demo))[0] === 7 && playerCell(rider(demo))[1] === 1,
    );
    expect(ticks).toBeLessThan(BOMB_FUSE_TICKS);
    expect(demo.state.bombs).toHaveLength(1);
    runUntil(demo, () => demo.state.tick === CAPIVARA_SCENE.lengthTicks - 1);
    expect(everyoneAlive(demo)).toBe(true);
    expect(rider(demo).mountId).toBe('capivara');
    expect(playerCell(rider(demo))).toEqual([1, 1]);
  });

  it('Poraquê sets off both bombs at once, early, from behind the crates', () => {
    const demo = new ModeDemo(GALINHA_SCENE);
    runUntil(demo, () => demo.state.bombs.length === 2);
    const placedAt = demo.state.tick;
    expect(demo.state.bombs.map((b) => [b.col, b.row]).sort()).toEqual([
      [5, 1],
      [7, 3],
    ]);
    runUntil(demo, () => usedAbility(demo));
    expect(demo.state.tick).toBeLessThan(placedAt + BOMB_FUSE_TICKS);
    runUntil(demo, () => demo.state.bombs.length === 0, 5);
    expect(demo.state.bombs).toHaveLength(0);
    expect(demo.state.flames.length).toBeGreaterThan(0);
    runUntil(demo, () => demo.state.tick === GALINHA_SCENE.lengthTicks - 1);
    expect(everyoneAlive(demo)).toBe(true);
    expect(rider(demo).mountId).toBe('galinha');
    expect(playerCell(rider(demo))).toEqual([1, 1]);
  });
});

describe('demoScene', () => {
  it('finds a mode or an arena by key, and plays the local match on an arena without a scene', () => {
    expect(demoScene('local')).toBe(LOCAL_SCENE);
    expect(demoScene('arena:autodromo')).toBe(ONLINE_SCENE);
    expect(demoScene('arena:subestacao')?.mapId).toBe('subestacao');
    expect(demoScene('nope')).toBeNull();
    expect(demoScene('arena:atlantis')).toBeNull();
    expect(demoScene('mount:pato')).toBe(PATO_SCENE);
    expect(demoScene('mount:unicorn')).toBeNull();
    expect(Object.keys(DEMO_SCENES)).toContain('arena:subestacao');
  });

  it('plays the fallback on the arena it was asked for', () => {
    const scene = { ...LOCAL_SCENE, mapId: 'autodromo' as const };
    const demo = new ModeDemo(scene);
    expect(demo.state.mapId).toBe('autodromo');
    let ticks = 0;
    while (demo.state.phase !== 'over' && ticks++ < 2_000) demo.step();
    expect(demo.state.winnerId).toBe('p1');
  });
});
