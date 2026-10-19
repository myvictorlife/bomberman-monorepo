import {
  cellIndex,
  CharacterId,
  createGame,
  DEFAULT_MAP_ID,
  Direction,
  GameState,
  isMapId,
  MapId,
  MountId,
  PlayerInput,
  PlayerSetup,
  PowerUpKind,
  tick,
  TICK_RATE,
} from '@libs/game-core';

/**
 * Little scripted matches for the pages around the game — the "videos" of
 * each mode on the title screen. They run the real rules (`createGame` and
 * `tick`) on an arena carved so the script's paths are open, so what plays is
 * exactly what the game does, with the art of the day. A step walks to a
 * cell, drops a bomb, waits, or uses the mount; the walker holds a direction
 * until the body is on the cell, so the script never depends on the speed.
 */
export type DemoStep =
  /** Walk to a cell, one axis at a time, along open cells. */
  | { to: readonly [number, number] }
  /** Turn to face a side: one tick of pushing that way, into a wall if need be. */
  | { face: Direction }
  | { bomb: true }
  | { ability: true }
  /** Stand still for this many ticks. */
  | { wait: number };

export interface DemoActor {
  id: string;
  steps: readonly DemoStep[];
}

export interface DemoScene {
  mapId: MapId;
  seed: number;
  players: readonly PlayerSetup[];
  outsiders?: readonly PlayerSetup[];
  /** Who starts the scene already riding what, by player id. */
  mounts?: Readonly<Record<string, MountId>>;
  /** Cells to clear of crates, so the paths are open. */
  clear: readonly (readonly [number, number])[];
  /** Crates to make sure of, with what they hide. */
  crates?: readonly {
    cell: readonly [number, number];
    hides: PowerUpKind | null;
  }[];
  actors: readonly DemoActor[];
  /** Ticks the scene plays before it starts over. */
  lengthTicks: number;
  /** With reduced motion, the tick shown as a still: a moment with something to see. */
  stillAt?: number;
}

/** Close enough to a cell's centre to count as there: under one step at base speed. */
const ARRIVED = 0.06;
/** How long the decided round stays on screen before the scene starts over. */
export const RESULT_HOLD_TICKS = 2 * TICK_RATE;

interface Cursor {
  index: number;
  waited: number;
}

/** One scene, playing: step it at the tick rate and read `state` to paint. */
export class ModeDemo {
  state!: GameState;
  private cursors = new Map<string, Cursor>();

  constructor(readonly scene: DemoScene) {
    this.restart();
  }

  restart(): void {
    const { scene } = this;
    const state = createGame({
      seed: scene.seed,
      mapId: scene.mapId,
      players: scene.players.map((p) => ({ ...p })),
      outsiders: scene.outsiders?.map((o) => ({ ...o })),
      roundTicks: null,
    });
    for (const [col, row] of scene.clear) {
      if (state.tiles[cellIndex(state, col, row)] === 'block')
        state.tiles[cellIndex(state, col, row)] = 'empty';
    }
    for (const { cell, hides } of scene.crates ?? []) {
      const index = cellIndex(state, cell[0], cell[1]);
      state.tiles[index] = 'block';
      state.hiddenPowerUps[index] = hides;
    }
    for (const [id, mountId] of Object.entries(scene.mounts ?? {})) {
      const player = state.players.find((p) => p.id === id);
      if (player) player.mountId = mountId;
    }
    this.state = state;
    this.cursors = new Map(
      scene.actors.map((a) => [a.id, { index: 0, waited: 0 }]),
    );
  }

  /** The scene is over: the result was on screen long enough, or the script ran its length. */
  get finished(): boolean {
    return (
      this.state.tick >= this.scene.lengthTicks ||
      this.shownOver >= RESULT_HOLD_TICKS
    );
  }

  /** Steps spent on the decided round — the clock of the rules stops there. */
  private shownOver = 0;

  /** One tick of the rules, with what the script says each actor does. */
  step(): void {
    if (this.finished) {
      this.restart();
      this.shownOver = 0;
    }
    if (this.state.phase === 'over') {
      this.shownOver++;
      return;
    }
    const inputs: Record<string, PlayerInput> = {};
    for (const actor of this.scene.actors)
      inputs[actor.id] = this.inputFor(actor);
    tick(this.state, inputs);
  }

  /** Where the actor's script is: the step index, for tests. */
  stepIndex(id: string): number {
    return this.cursors.get(id)?.index ?? 0;
  }

  private inputFor(actor: DemoActor): PlayerInput {
    const cursor = this.cursors.get(actor.id) ?? { index: 0, waited: 0 };
    const still: PlayerInput = { direction: null, bomb: false };
    const body = this.bodyOf(actor.id);
    // Walking a cell at a time; a finished step moves on in the same tick so no tick is lost.
    for (let guard = 0; guard < 4; guard++) {
      const step = actor.steps[cursor.index];
      if (!step || !body) return still;
      if ('to' in step) {
        const direction = towards(body, step.to);
        if (direction) return { direction, bomb: false };
        // On the cell: square up to its centre, so the body never hangs a hair into the next one.
        body.x = step.to[0];
        body.y = step.to[1];
        cursor.index++;
      } else if ('face' in step) {
        cursor.index++;
        return { direction: step.face, bomb: false };
      } else if ('bomb' in step) {
        cursor.index++;
        return { direction: null, bomb: true };
      } else if ('ability' in step) {
        cursor.index++;
        return { direction: null, bomb: false, ability: true };
      } else {
        if (cursor.waited < step.wait) {
          cursor.waited++;
          return still;
        }
        cursor.waited = 0;
        cursor.index++;
      }
    }
    return still;
  }

  private bodyOf(id: string): { x: number; y: number } | null {
    const player = this.state.players.find((p) => p.id === id);
    if (player) return player.alive ? player : null;
    return this.state.outsiders.find((o) => o.id === id) ?? null;
  }
}

/** The direction that brings the body to the cell, one axis at a time; `null` once it is there. */
export function towards(
  body: { x: number; y: number },
  [col, row]: readonly [number, number],
): Direction | null {
  const dx = col - body.x;
  const dy = row - body.y;
  if (Math.abs(dx) > ARRIVED) return dx > 0 ? 'right' : 'left';
  if (Math.abs(dy) > ARRIVED) return dy > 0 ? 'down' : 'up';
  return null;
}

const cast = (
  id: string,
  name: string,
  characterId: CharacterId,
): PlayerSetup => ({ id, name, characterId });

/**
 * Versus local: Faísca breaks a crate, picks up the fire it hid, and catches
 * Dra. Lia with a bigger blast in the middle. Two players, one keyboard.
 * Flames reach `START_FIRE` cells and burn `FLAME_TICKS`: every retreat is
 * further than that, and every wait outlasts it.
 */
export const LOCAL_SCENE: DemoScene = {
  mapId: DEFAULT_MAP_ID,
  seed: 11,
  players: [cast('p1', 'Faísca', 'faisca'), cast('p2', 'Dra. Lia', 'lia')],
  clear: [
    [2, 1],
    [3, 1],
    [1, 2],
    [1, 3],
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
    [5, 5],
    [6, 5],
    [7, 5],
    [13, 10],
    [13, 9],
    [13, 8],
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [9, 6],
    [9, 5],
    [8, 5],
  ],
  crates: [
    { cell: [4, 1], hides: 'fire' },
    { cell: [13, 6], hides: null },
  ],
  actors: [
    {
      id: 'p1',
      steps: [
        { to: [3, 1] },
        { bomb: true },
        { to: [1, 1] },
        { to: [1, 3] },
        { wait: 120 },
        { to: [1, 1] },
        { to: [5, 1] },
        { to: [5, 5] },
        { to: [7, 5] },
        { bomb: true },
        { to: [5, 5] },
        { to: [5, 3] },
      ],
    },
    {
      id: 'p2',
      steps: [
        { to: [13, 7] },
        { bomb: true },
        { to: [13, 10] },
        { wait: 160 },
        { to: [13, 7] },
        { to: [9, 7] },
        { to: [9, 5] },
        { wait: 600 },
      ],
    },
  ],
  lengthTicks: 900,
  stillAt: 470,
};

/**
 * Online: five in the arena, the next three in line on the wall. The one at
 * the top throws a bomb three cells in, it catches the player in the middle,
 * and the thrower steps into the round in their place.
 */
export const ONLINE_SCENE: DemoScene = {
  mapId: 'autodromo',
  seed: 23,
  players: [
    cast('p1', 'Faísca', 'faisca'),
    cast('p2', 'Dev Cansado', 'byte'),
    cast('p3', 'Dra. Lia', 'lia'),
    cast('p4', 'Zé Motoca', 'motoca'),
    cast('p5', 'Tião', 'tiao'),
  ],
  outsiders: [
    cast('o1', 'Novato', 'novato'),
    cast('o2', 'Byte', 'byte'),
    cast('o3', 'Lia', 'lia'),
  ],
  clear: [
    [7, 5],
    [7, 4],
    [7, 3],
    [7, 9],
    [3, 6],
    [1, 2],
    [1, 3],
    [2, 1],
    [3, 1],
    [12, 11],
    [11, 11],
    [13, 10],
    [13, 9],
    [13, 2],
    [13, 3],
    [12, 1],
    [11, 1],
    [2, 11],
    [3, 11],
    [1, 10],
    [1, 9],
  ],
  actors: [
    { id: 'p5', steps: [{ to: [7, 4] }, { wait: 900 }] },
    { id: 'o1', steps: [{ wait: 60 }, { bomb: true }, { wait: 900 }] },
    { id: 'o2', steps: [{ wait: 150 }, { bomb: true }, { wait: 900 }] },
    { id: 'o3', steps: [{ wait: 220 }, { bomb: true }, { wait: 900 }] },
    // Each drops one bomb and gets well clear of it: two cells past the flame's reach.
    {
      id: 'p1',
      steps: [
        { to: [1, 3] },
        { bomb: true },
        { to: [1, 1] },
        { to: [3, 1] },
        { wait: 200 },
        { to: [1, 1] },
        { to: [1, 3] },
      ],
    },
    {
      id: 'p2',
      steps: [
        { wait: 40 },
        { to: [11, 11] },
        { bomb: true },
        { to: [13, 11] },
        { to: [13, 9] },
        { wait: 200 },
        { to: [13, 11] },
        { to: [11, 11] },
      ],
    },
    {
      id: 'p3',
      steps: [
        { wait: 80 },
        { to: [13, 3] },
        { bomb: true },
        { to: [13, 1] },
        { to: [11, 1] },
        { wait: 200 },
        { to: [13, 1] },
        { to: [13, 3] },
      ],
    },
    {
      id: 'p4',
      steps: [
        { wait: 120 },
        { to: [3, 11] },
        { bomb: true },
        { to: [1, 11] },
        { to: [1, 9] },
        { wait: 200 },
        { to: [1, 11] },
        { to: [3, 11] },
      ],
    },
  ],
  lengthTicks: 720,
  stillAt: 250,
};

/** Cells `[from, to]` along one row or column, inclusive. */
const span = (
  from: readonly [number, number],
  to: readonly [number, number],
): (readonly [number, number])[] => {
  const cells: (readonly [number, number])[] = [];
  const dc = Math.sign(to[0] - from[0]);
  const dr = Math.sign(to[1] - from[1]);
  for (let c = from[0], r = from[1]; ; c += dc, r += dr) {
    cells.push([c, r]);
    if (c === to[0] && r === to[1]) break;
  }
  return cells;
};

/**
 * The mounts, one scene each for the mounts page: the rider shows the
 * ability on the top row of the default arena, then walks back to go again.
 * Each script keeps everyone out of its own flames: a retreat goes past
 * `START_FIRE` cells, a wait outlasts the fuse and the flame.
 */

/** Tatu: one roll the length of the row, stopped by the wall, then a plain walk back for the contrast. */
export const TATU_SCENE: DemoScene = {
  mapId: DEFAULT_MAP_ID,
  seed: 31,
  players: [cast('p1', 'Faísca', 'faisca')],
  mounts: { p1: 'tatu' },
  clear: span([2, 1], [13, 1]),
  actors: [
    {
      id: 'p1',
      steps: [
        { wait: 30 },
        { face: 'right' },
        { ability: true },
        { to: [13, 1] },
        { wait: 45 },
        { to: [1, 1] },
        { wait: 30 },
      ],
    },
  ],
  lengthTicks: 420,
  stillAt: 70,
};

/** Pato: one cell per hop — over a pillar, another pillar, then a crate — and home. */
export const PATO_SCENE: DemoScene = {
  mapId: DEFAULT_MAP_ID,
  seed: 37,
  players: [cast('p1', 'Dev Cansado', 'byte')],
  mounts: { p1: 'pato' },
  clear: [
    [1, 2],
    [3, 2],
    [5, 2],
    [5, 1],
    [3, 1],
    [2, 1],
  ],
  crates: [{ cell: [4, 1], hides: null }],
  actors: [
    {
      id: 'p1',
      steps: [
        { to: [1, 2] },
        { face: 'right' },
        { ability: true },
        { wait: 45 },
        { ability: true },
        { wait: 45 },
        { to: [5, 1] },
        { face: 'left' },
        { ability: true },
        { wait: 45 },
        { to: [1, 1] },
        { wait: 20 },
      ],
    },
  ],
  lengthTicks: 360,
  stillAt: 30,
};

/** Bernardo: three bombs down the row at once, and a run down the side before they go. */
export const BERNARDO_SCENE: DemoScene = {
  mapId: DEFAULT_MAP_ID,
  seed: 41,
  players: [cast('p1', 'Dra. Lia', 'lia')],
  mounts: { p1: 'bernardo' },
  clear: [...span([2, 1], [4, 1]), ...span([1, 2], [1, 5])],
  actors: [
    {
      id: 'p1',
      steps: [
        { wait: 30 },
        { face: 'right' },
        { ability: true },
        { to: [1, 5] },
        { wait: 200 },
        { to: [1, 1] },
        { wait: 20 },
      ],
    },
  ],
  lengthTicks: 400,
  stillAt: 40,
};

/** Capivara: Tião drops a bomb in the row; the rider walks straight over it and off to the side. */
export const CAPIVARA_SCENE: DemoScene = {
  mapId: DEFAULT_MAP_ID,
  seed: 43,
  players: [
    cast('p1', 'Zé Motoca', 'motoca'),
    cast('p2', 'Faísca', 'faisca'),
    cast('p3', 'Tião', 'tiao'),
  ],
  mounts: { p1: 'capivara' },
  clear: [
    ...span([2, 1], [12, 1]),
    [9, 2],
    [9, 3],
    [13, 2],
    [13, 3],
    [13, 10],
    [13, 9],
  ],
  actors: [
    {
      id: 'p1',
      steps: [
        { wait: 40 },
        { to: [9, 1] },
        { to: [9, 3] },
        { wait: 150 },
        { to: [9, 1] },
        { to: [1, 1] },
        { wait: 30 },
      ],
    },
    {
      id: 'p2',
      steps: [{ to: [13, 9] }, { wait: 150 }, { to: [13, 11] }, { wait: 300 }],
    },
    {
      id: 'p3',
      steps: [
        { to: [7, 1] },
        { bomb: true },
        { to: [13, 1] },
        { to: [13, 3] },
        { wait: 300 },
      ],
    },
  ],
  lengthTicks: 540,
  stillAt: 130,
};

/**
 * Poraquê: two bombs are dropped two cells from the eel, each behind a crate
 * that will take the flame; the jolt sets both off well before their fuse.
 */
export const GALINHA_SCENE: DemoScene = {
  mapId: DEFAULT_MAP_ID,
  seed: 47,
  players: [
    cast('p1', 'Tião', 'tiao'),
    cast('p2', 'Faísca', 'faisca'),
    cast('p3', 'Dev Cansado', 'byte'),
    cast('p4', 'Dra. Lia', 'lia'),
  ],
  mounts: { p1: 'galinha' },
  clear: [
    ...span([1, 2], [1, 3]),
    ...span([2, 3], [5, 3]),
    ...span([5, 1], [12, 1]),
    ...span([1, 10], [1, 5]),
    ...span([2, 5], [9, 5]),
    [7, 4],
    [7, 3],
    [13, 10],
    [13, 9],
  ],
  crates: [
    { cell: [5, 2], hides: null },
    { cell: [6, 3], hides: null },
  ],
  actors: [
    {
      id: 'p1',
      steps: [
        { to: [1, 3] },
        { to: [5, 3] },
        { wait: 240 },
        { ability: true },
        { wait: 120 },
        { to: [1, 3] },
        { to: [1, 1] },
        { wait: 20 },
      ],
    },
    {
      id: 'p2',
      steps: [{ to: [13, 9] }, { wait: 150 }, { to: [13, 11] }, { wait: 400 }],
    },
    {
      id: 'p3',
      steps: [
        { wait: 110 },
        { to: [5, 1] },
        { bomb: true },
        { to: [11, 1] },
        { wait: 400 },
      ],
    },
    {
      id: 'p4',
      steps: [
        { to: [1, 5] },
        { to: [7, 5] },
        { to: [7, 3] },
        { bomb: true },
        { to: [7, 5] },
        { to: [9, 5] },
        { wait: 400 },
      ],
    },
  ],
  lengthTicks: 600,
  stillAt: 350,
};

/** A mount's scene, by its id — the mounts page keys its videos `mount:<id>`. */
export const MOUNT_SCENES: Readonly<Record<MountId, DemoScene>> = {
  tatu: TATU_SCENE,
  pato: PATO_SCENE,
  bernardo: BERNARDO_SCENE,
  capivara: CAPIVARA_SCENE,
  galinha: GALINHA_SCENE,
};

/**
 * The scenes by what they stand for: a mode of the title screen, an arena
 * (`arena:<id>`) of the gallery, or a mount (`mount:<id>`) of the mounts
 * page. A new arena with no scene of its own plays the local one on its
 * map; one with a story to tell gets an entry here.
 */
export const DEMO_SCENES: Readonly<Record<string, DemoScene>> = {
  local: LOCAL_SCENE,
  online: ONLINE_SCENE,
  /** The title screen's stage: the online crowd, on the first arena. */
  hero: { ...ONLINE_SCENE, mapId: 'subestacao' },
  'arena:subestacao': LOCAL_SCENE,
  'arena:autodromo': ONLINE_SCENE,
  ...Object.fromEntries(
    Object.entries(MOUNT_SCENES).map(([id, scene]) => [`mount:${id}`, scene]),
  ),
};

/** The scene for a key, or the local match on an arena's map; `null` for a key nobody knows. */
export function demoScene(key: string): DemoScene | null {
  const known = DEMO_SCENES[key];
  if (known) return known;
  const mapId = key.startsWith('arena:') ? key.slice('arena:'.length) : '';
  return isMapId(mapId) ? { ...LOCAL_SCENE, mapId } : null;
}
