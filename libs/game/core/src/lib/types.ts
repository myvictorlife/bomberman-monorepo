import type { CharacterId, MountId } from './characters';
import type { PlayerColorId } from './colors';
import type { MapId } from './maps';

/**
 * The whole game state is plain, JSON-serialisable data: no classes, no maps,
 * no functions. That is what lets the same state be simulated on a server and
 * shipped to every client unchanged.
 */

export type Tile = 'empty' | 'wall' | 'block';

/**
 * `egg` hatches into a random mount for whoever picks it up. `pierce` and
 * `remote` change every bomb the player drops from then on; `vest` is a few
 * seconds of immunity. `glove` lets the player pick up the bomb they just
 * dropped and throw it; `kick` sends a bomb they walk into hopping one cell on.
 */
export type PowerUpKind =
  | 'bomb'
  | 'fire'
  | 'speed'
  | 'egg'
  | 'pierce'
  | 'remote'
  | 'vest'
  | 'glove'
  | 'kick';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type FlameShape =
  | 'center'
  | 'horizontal'
  | 'vertical'
  | 'end-up'
  | 'end-down'
  | 'end-left'
  | 'end-right';

export interface PlayerInput {
  /** The direction held this tick, or `null` to stand still. */
  direction: Direction | null;
  /** `true` on the tick the bomb button was pressed (edge, not level). */
  bomb: boolean;
  /** `true` on the tick the mount-ability button was pressed (edge). */
  ability?: boolean;
  /** `true` on the tick the detonate button was pressed (edge): sets off the oldest remote bomb. */
  detonate?: boolean;
}

/** A player in the air: from where they took off to the cell they land on. */
export interface Jump {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTick: number;
  endTick: number;
}

export interface Player {
  id: string;
  /** 0–4: decides the spawn cell, and the colour when {@link Player.color} is absent. */
  slot: number;
  /**
   * The colour the round gave them (`assignColors`): the one they picked, or
   * the closest free one. Absent in rounds from before colours were picked —
   * read it with `playerColor`.
   */
  color?: PlayerColorId;
  name: string;
  /** Who this player looks like; see `characters.ts`. */
  characterId: CharacterId;
  /** What they ride, if anything. A mount takes the first hit in their place. */
  mountId: MountId | null;
  /** Flames are harmless until this tick — the moment after losing a mount. */
  shieldedUntilTick: number;
  /** A timed mount ability (roll, sniff) runs until this tick. */
  abilityUntilTick: number;
  /** The mount ability can be used again from this tick. */
  abilityReadyAtTick: number;
  /** Mid-jump, when not `null`. */
  jump: Jump | null;
  /** Position in tiles; `(c, r)` is the centre of cell `c, r`. */
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
  alive: boolean;
  diedAtTick: number | null;
  maxBombs: number;
  fireRange: number;
  speedLevel: number;
  /** Their bombs' flames go through soft blocks, burning every one. */
  pierce: boolean;
  /** Their bombs have no fuse: the detonate button sets off the oldest one. */
  remote: boolean;
  /** Flames are harmless until this tick — the vest. */
  vestUntilTick: number;
  /** Can pick up the bomb they just dropped and throw it. */
  glove: boolean;
  /** Walking into a bomb sends it hopping one cell on. */
  kick: boolean;
  /**
   * The bomb in their hands, when not `null`: off the ground, its fuse still
   * burning. It goes off where they stand unless they throw it first.
   */
  heldBomb: Bomb | null;
  /** The glove: the player they hold overhead, by id. */
  carrying: string | null;
  /** Held overhead by this player: no moving, no bombs, out of the flames' reach. */
  carriedBy: string | null;
  /** While carried: when they wriggle free if not thrown first. */
  carriedUntilTick: number;
  /** Thrown with the glove, in the air until the landing. */
  flight: Flight | null;
  /** Dizzy after a landing: no moving, no bombs, until this tick. */
  stunnedUntilTick: number;
}

export interface Bomb {
  id: number;
  col: number;
  row: number;
  ownerId: string;
  /** Ticks left until it explodes. */
  fuse: number;
  range: number;
  /**
   * Players standing on the cell when the bomb was dropped. They may walk off
   * it, but once they have left they cannot walk back on.
   */
  passThrough: string[];
  /** Flames go through soft blocks. */
  pierce: boolean;
  /** No fuse: waits for the owner's detonate button, or for another flame. */
  remote: boolean;
}

export interface Flame {
  col: number;
  row: number;
  shape: FlameShape;
  ticksLeft: number;
  /** Whose bomb lit it — the first one, where two cross. Decides who a kill belongs to. */
  ownerId: string | null;
}

/**
 * Someone outside the arena: next in line, walking the border and throwing
 * bombs in. A kill puts them in the round, in the place of whoever they hit.
 */
export interface Outsider {
  id: string;
  name: string;
  characterId: CharacterId;
  /** Position in tiles, always on the border ring. */
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
}

/** Something in the air, from where it took off to the cell it lands on. See `throw.ts`. */
export interface Flight {
  fromCol: number;
  fromRow: number;
  col: number;
  row: number;
  startTick: number;
  landTick: number;
  direction: Direction;
  /** Cells flown along `direction`, bounces included. */
  cells: number;
  /** Leaves by one side of the arena and comes back by the other; a border throw does not. */
  wraps: boolean;
}

/**
 * A bomb in the air — thrown with the glove, kicked, or thrown in from the
 * border.
 */
export interface ThrownBomb extends Flight {
  id: number;
  /** Whose bomb it is, whoever sent it flying: a kill is theirs. */
  ownerId: string;
  /** What the bomb is once it lands. */
  range: number;
  fuse: number;
  pierce: boolean;
  remote: boolean;
}

export interface BurningBlock {
  col: number;
  row: number;
  ticksLeft: number;
}

export interface PowerUp {
  col: number;
  row: number;
  kind: PowerUpKind;
}

export type GameEvent =
  | { type: 'bomb-placed'; col: number; row: number; playerId: string }
  | { type: 'explosion'; col: number; row: number }
  | { type: 'block-destroyed'; col: number; row: number }
  | { type: 'power-up-collected'; playerId: string; kind: PowerUpKind }
  | { type: 'mount-gained'; playerId: string; mountId: MountId }
  | { type: 'mount-lost'; playerId: string }
  | { type: 'ability-used'; playerId: string; mountId: MountId }
  | { type: 'power-up-burned'; col: number; row: number }
  /** `killerId`: whose bomb lit the flame; `null` when they left the game instead. */
  | { type: 'player-died'; playerId: string; killerId: string | null }
  | { type: 'bomb-thrown'; playerId: string; col: number; row: number }
  /** The glove: a player lifted another; then threw them; then they came down. */
  | { type: 'player-grabbed'; playerId: string; targetId: string }
  | { type: 'player-thrown'; playerId: string; targetId: string }
  | { type: 'player-landed'; playerId: string }
  /** A bomb in the air came down on this player: dizzy, and it bounces on. */
  | { type: 'player-bonked'; playerId: string }
  /** Knocked loose by a bonk: the item is on the floor at `col, row`. */
  | {
      type: 'power-up-dropped';
      playerId: string;
      kind: PowerUpKind;
      col: number;
      row: number;
    }
  /** The glove: a player took their bomb off the ground. */
  | { type: 'bomb-picked-up'; playerId: string }
  /** A player kicked a bomb; it is now in the air (a `bomb-thrown` follows). */
  | { type: 'bomb-kicked'; playerId: string }
  /** An outsider's bomb got someone: they take the victim's place. */
  | { type: 'outsider-entered'; playerId: string; victimId: string }
  /** The round's clock ran out: walls start dropping. */
  | { type: 'arena-closing' }
  | { type: 'wall-dropped'; col: number; row: number }
  | { type: 'round-over'; winnerId: string | null };

export type GamePhase = 'playing' | 'over';

export interface GameState {
  /** Which arena the round is played on; see `maps.ts`. */
  mapId: MapId;
  cols: number;
  rows: number;
  tick: number;
  /** Row-major: `tiles[row * cols + col]`. */
  tiles: Tile[];
  /** What each soft block hides, same indexing as `tiles`. */
  hiddenPowerUps: (PowerUpKind | null)[];
  powerUps: PowerUp[];
  bombs: Bomb[];
  flames: Flame[];
  burningBlocks: BurningBlock[];
  players: Player[];
  /** The next in line, on the border; see `outsiders.ts`. */
  outsiders: Outsider[];
  thrownBombs: ThrownBomb[];
  phase: GamePhase;
  winnerId: string | null;
  /** Tick at which the round will be decided, once ≤ 1 player is left. */
  endsAtTick: number | null;
  nextBombId: number;
  /** The tick the walls start dropping; `null` with no clock (a one-player sandbox). */
  closesAtTick: number | null;
  /** How far along `closingOrder` the dropping walls have got. */
  closedCells: number;
  /** When the clock runs out: walls close in (`true`), or the round is a draw among whoever is left. */
  closingWalls: boolean;
  /** What happened during the last tick — sounds and effects read these. */
  events: GameEvent[];
}

export interface PlayerSetup {
  id: string;
  name: string;
  /** Defaults to the first character of the roster. */
  characterId?: CharacterId;
  /** The colour they asked for; the round may give the closest free one. */
  color?: PlayerColorId;
}

export interface GameOptions {
  seed: number;
  players: PlayerSetup[];
  /** Defaults to the first map of the roster. */
  mapId?: MapId;
  /** How long until the arena closes in, in ticks; defaults to `ROUND_TIME_TICKS`, `null` for no clock. */
  roundTicks?: number | null;
  /** What the end of the clock does; defaults to `true`, walls closing in. `false` ends the round there. */
  closingWalls?: boolean;
  /** Who starts on the border, throwing bombs in. */
  outsiders?: PlayerSetup[];
}
