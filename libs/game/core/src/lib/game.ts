import { DEFAULT_CHARACTER_ID, findMount, hatchMount } from './characters';
import {
  cellIndex,
  CLASSIC_LAYOUT,
  generateArena,
  inBounds,
  tileAt,
} from './arena';
import {
  BLOCK_BURN_TICKS,
  BOMB_FUSE_TICKS,
  CLOCK_BONUS_TICKS,
  CURSE_FUSE_TICKS,
  CURSE_TICKS,
  ENTRY_SHIELD_TICKS,
  FLAME_TICKS,
  GLOVE_THROW_CELLS,
  MAX_BOMBS,
  MAX_FIRE,
  MAX_PLAYERS,
  MAX_SPEED_LEVEL,
  MOUNT_SHIELD_TICKS,
  ROUND_END_DELAY_TICKS,
  ROUND_TIME_TICKS,
  START_BOMBS,
  START_FIRE,
  TICK_RATE,
  VEST_TICKS,
} from './constants';
import { findStage } from './campaign';
import { applyKit } from './kit';
import { DEFAULT_MAP_ID, findMap } from './maps';
import { advanceStage, setUpStage, stageMapId, updateStageEnd } from './stage';
import { startLives } from './parts';
import { divertAlongCable } from './fixtures';
import {
  DIRECTION_DELTA,
  movePlayer,
  overlapsCell,
  standsOn,
  playerCell,
} from './movement';
import {
  addOutsider,
  isBorderCell,
  moveOutsider,
  removeOutsider,
  throwBomb,
} from './outsiders';
import { landPizzas, throwPizza } from './pizza';
import { landThrownBombs, launchBomb } from './throw';
import { closeArena } from './closing';
import { scatterItems } from './scatter';
import { assignColors, PlayerColorId } from './colors';
import {
  carryAlong,
  grabPlayer,
  isAirborne,
  landThrownPlayers,
  letGo,
  throwCarried,
} from './grab';
import {
  Bomb,
  CurseKind,
  Direction,
  FlameShape,
  GameEvent,
  GameOptions,
  GameState,
  Outsider,
  Player,
  PlayerInput,
  PlayerSetup,
  PowerUpKind,
} from './types';

export function createGame(options: GameOptions): GameState {
  const stageMap = options.stageId ? stageMapId(options.stageId) : undefined;
  const layout =
    (options.stageId ? findStage(options.stageId)?.layout : undefined) ??
    CLASSIC_LAYOUT;
  const most = Math.min(MAX_PLAYERS, layout.spawns.length);
  if (options.players.length < 1 || options.players.length > most) {
    throw new Error(`A round needs 1–${most} players.`);
  }
  const map = findMap(stageMap ?? options.mapId ?? DEFAULT_MAP_ID);
  const arena = generateArena(options.seed, map, layout);
  const colors = assignColors(options.players.map((p) => p.color));
  const players: Player[] = options.players.map((setup, slot) => {
    const [x, y] = layout.spawns[slot] as readonly [number, number];
    const player = newPlayer(setup, slot, x, y, colors[slot]);
    if (setup.kit) applyKit(player, setup.kit);
    return player;
  });

  const state: GameState = {
    ...arena,
    mapId: map.id,
    tick: 0,
    powerUps: [],
    bombs: [],
    flames: [],
    burningBlocks: [],
    players,
    outsiders: [],
    thrownBombs: [],
    pizzas: [],
    phase: 'playing',
    winnerId: null,
    endsAtTick: null,
    nextBombId: 1,
    // A one-player sandbox has no clock: nobody to close the arena on.
    closesAtTick:
      options.players.length < 2
        ? null
        : options.roundTicks === undefined
          ? ROUND_TIME_TICKS
          : options.roundTicks,
    closedCells: 0,
    closingWalls: options.closingWalls ?? true,
    dropItems: options.dropItems ?? true,
    events: [],
  };
  for (const setup of options.outsiders ?? []) addOutsider(state, setup);
  if (options.stageId) {
    setUpStage(state, options.stageId, options.seed);
    // A stage runs against the clock even alone: the walls close in on whoever
    // is left. A bonus stage has its own, short one.
    const stage = findStage(options.stageId);
    const seconds = stage?.parts?.[0]?.seconds ?? stage?.seconds;
    state.closesAtTick =
      options.roundTicks !== undefined
        ? options.roundTicks
        : seconds
          ? seconds * TICK_RATE
          : ROUND_TIME_TICKS;
    if (state.stage) startLives(state.stage, options.players);
  }
  return state;
}

/** A player as they start: on `x, y`, with the starting kit and nothing picked up. */
function newPlayer(
  setup: PlayerSetup,
  slot: number,
  x: number,
  y: number,
  color: PlayerColorId | undefined,
): Player {
  return {
    id: setup.id,
    slot,
    ...(color ? { color } : {}),
    name: setup.name,
    characterId: setup.characterId ?? DEFAULT_CHARACTER_ID,
    mountId: null,
    shieldedUntilTick: 0,
    abilityUntilTick: 0,
    abilityReadyAtTick: 0,
    jump: null,
    x,
    y,
    facing: 'down',
    moving: false,
    alive: true,
    diedAtTick: null,
    maxBombs: START_BOMBS,
    fireRange: START_FIRE,
    speedLevel: 0,
    pierce: false,
    remote: false,
    vestUntilTick: 0,
    glove: false,
    kick: false,
    heldBomb: null,
    carrying: null,
    carriedBy: null,
    carriedUntilTick: 0,
    flight: null,
    stunnedUntilTick: 0,
    wallPass: false,
    powerBomb: false,
    curse: null,
    slimedUntilTick: 0,
  };
}

/**
 * Advances the simulation by exactly one tick, in place. Inputs are keyed by
 * player id; a missing input means "standing still". The order of the steps is
 * part of the rules — e.g. flames age before new ones are added, so a flame
 * always lives exactly {@link FLAME_TICKS} ticks.
 */
export function tick(
  state: GameState,
  inputs: Readonly<Record<string, PlayerInput | undefined>>,
): GameState {
  state.events = [];
  if (state.phase === 'over') return state;
  state.tick++;

  for (const player of state.players) {
    if (!player.alive) continue;
    // Held overhead or flying after a throw: their keys do nothing.
    if (isAirborne(player)) continue;
    if (state.tick < player.stunnedUntilTick) {
      player.moving = false;
      continue;
    }
    if (player.curse && state.tick >= player.curse.untilTick)
      player.curse = null;
    const input = cursedInput(player, inputs[player.id]);
    if (input?.ability) useAbility(state, player, input.direction);
    if (input?.detonate) detonateOldest(state, player);
    if (player.jump) {
      // In the air: no steering, no bombs, until the landing.
      advanceJump(state, player);
      continue;
    }
    if (input?.bomb) pressBomb(state, player);
    if (isDashing(state, player)) {
      roll(state, player);
      continue;
    }
    if (input?.direction) {
      movePlayer(state, player, input.direction);
      if (!player.moving && player.kick)
        kickBomb(state, player, input.direction);
    } else player.moving = false;
  }

  carryAlong(state);
  passCurses(state);

  for (const outsider of state.outsiders) {
    const input = inputs[outsider.id];
    if (input?.bomb) throwBomb(state, outsider);
    if (input?.direction) moveOutsider(state, outsider, input.direction);
    else outsider.moving = false;
  }

  releasePassThrough(state);
  collectPowerUps(state);
  ageFlames(state);
  detonateBombs(state);
  // After the fuses: a bomb that lands keeps its whole fuse for the next tick.
  landThrownBombs(state);
  landThrownPlayers(state);
  landPizzas(state);
  throwPizza(state);
  closeArena(state);
  killPlayersInFlames(state);
  if (state.stage) {
    for (const player of advanceStage(state)) hitPlayer(state, player, null);
    updateStageEnd(state);
  } else updateRoundEnd(state);
  return state;
}

/** Sprinting (Tatu): faster until the dash ends. */
export function isDashing(state: GameState, player: Player): boolean {
  return (
    !!player.mountId &&
    findMount(player.mountId).ability.kind === 'dash' &&
    state.tick < player.abilityUntilTick
  );
}

/** How many cells a jump can cross, crates, pillars and bombs included. */
export const JUMP_REACH = 1;

/**
 * Where a jump from the player's cell lands: exactly `reach + 1` cells ahead,
 * over whatever the `reach` cells in between hold — crate, pillar, bomb or
 * nothing. That cell has to be free floor and inside the border; otherwise
 * there is no jump (`null`): the Pato never hops further to find room.
 */
export function jumpLanding(
  state: GameState,
  player: Player,
  reach: number,
): [number, number] | null {
  const [col, row] = playerCell(player);
  const [dx, dy] = DIRECTION_DELTA[player.facing];
  const cell: [number, number] = [
    col + dx * (reach + 1),
    row + dy * (reach + 1),
  ];
  if (!inBounds(state, ...cell) || isBorderCell(state, ...cell)) return null;
  const blocked =
    tileAt(state, ...cell) !== 'empty' ||
    state.bombs.some((b) => b.col === cell[0] && b.row === cell[1]);
  return blocked ? null : cell;
}

/**
 * Tatu rolling: straight on the way it faces, at full tilt — the keys do not
 * steer it. The roll ends against the first wall, crate or bomb (kicking the
 * bomb, with the kick), on a second press, or after `durationTicks`, enough
 * to cross the arena.
 */
function roll(state: GameState, player: Player): void {
  movePlayer(state, player, player.facing);
  if (player.moving) return;
  if (player.kick) kickBomb(state, player, player.facing);
  player.abilityUntilTick = state.tick;
}

function useAbility(
  state: GameState,
  player: Player,
  direction: Direction | null = null,
): void {
  if (!player.mountId) return;
  const mount = findMount(player.mountId);
  const ability = mount.ability;
  if (ability.kind === 'pass-bombs') return;
  // A press mid-roll stops the Tatu where it is.
  if (ability.kind === 'dash' && isDashing(state, player)) {
    player.abilityUntilTick = state.tick;
    player.moving = false;
    return;
  }
  if (state.tick < player.abilityReadyAtTick) return;
  if (player.jump || state.tick < player.abilityUntilTick) return;

  if (ability.kind === 'jump') {
    const land = jumpLanding(state, player, JUMP_REACH);
    if (!land) return;
    const cells =
      Math.abs(land[0] - Math.round(player.x)) +
      Math.abs(land[1] - Math.round(player.y));
    player.jump = {
      fromX: player.x,
      fromY: player.y,
      toX: land[0],
      toY: land[1],
      startTick: state.tick,
      // The same speed whatever the distance: a longer jump takes longer.
      endTick: state.tick + Math.round((ability.durationTicks * cells) / 2),
    };
    player.moving = true;
  } else if (ability.kind === 'line-bombs') {
    // Not with a bomb in hand: the barrage would leave it stranded there.
    if (player.heldBomb || placeBombLine(state, player, ability.count) === 0)
      return;
  } else {
    // The roll sets off the way the keys point as it starts, then holds that line.
    if (ability.kind === 'dash' && direction) player.facing = direction;
    player.abilityUntilTick = state.tick + ability.durationTicks;
    if (ability.kind === 'short-circuit')
      shortCircuit(state, player, ability.radius);
  }
  player.abilityReadyAtTick = state.tick + ability.cooldownTicks;
  state.events.push({
    type: 'ability-used',
    playerId: player.id,
    mountId: mount.id,
  });
}

function advanceJump(state: GameState, player: Player): void {
  const jump = player.jump;
  if (!jump) return;
  const progress =
    (state.tick - jump.startTick) / (jump.endTick - jump.startTick);
  if (progress >= 1) {
    player.x = jump.toX;
    player.y = jump.toY;
    player.jump = null;
    player.moving = false;
    return;
  }
  player.x = jump.fromX + (jump.toX - jump.fromX) * progress;
  player.y = jump.fromY + (jump.toY - jump.fromY) * progress;
}

/** Every bomb of theirs still to go off: on the ground, in the air, or in their hands. */
export function activeBombCount(state: GameState, playerId: string): number {
  return (
    state.bombs.filter((b) => b.ownerId === playerId).length +
    state.thrownBombs.filter((b) => b.ownerId === playerId).length +
    (state.players.find((p) => p.id === playerId)?.heldBomb ? 1 : 0)
  );
}

/**
 * The bomb button. With a bomb in hand it throws it; with the glove, standing
 * on a bomb of theirs they have not yet stepped off, it picks that bomb up;
 * otherwise it drops a bomb.
 */
function pressBomb(state: GameState, player: Player): void {
  if (player.carrying) {
    throwCarried(state, player);
    return;
  }
  if (player.heldBomb) {
    throwHeldBomb(state, player);
    return;
  }
  if (player.glove && (pickUpBomb(state, player) || grabPlayer(state, player)))
    return;
  placeBomb(state, player);
}

/** The glove: the bomb under their feet, if it is theirs and they have not left it, goes into their hands. */
function pickUpBomb(state: GameState, player: Player): boolean {
  const [col, row] = playerCell(player);
  const bomb = state.bombs.find(
    (b) =>
      b.col === col &&
      b.row === row &&
      b.ownerId === player.id &&
      b.passThrough.includes(player.id),
  );
  if (!bomb) return false;
  state.bombs = state.bombs.filter((b) => b !== bomb);
  bomb.passThrough = [];
  player.heldBomb = bomb;
  state.events.push({ type: 'bomb-picked-up', playerId: player.id });
  return true;
}

/**
 * Throws the bomb in hand {@link GLOVE_THROW_CELLS} cells the way they face,
 * bouncing on to the first free cell. With nowhere to land, it stays in hand.
 */
function throwHeldBomb(state: GameState, player: Player): void {
  const bomb = player.heldBomb;
  if (!bomb) return;
  if (
    launchBomb(
      state,
      bomb,
      playerCell(player),
      player.facing,
      GLOVE_THROW_CELLS,
      { fuseRuns: false, by: player.id },
    )
  ) {
    player.heldBomb = null;
  }
}

/**
 * Kick: walking into a bomb — anyone's — that stops them sends it hopping one
 * cell on, over whatever is in the way. Only from the middle of a cell,
 * facing the bomb square on.
 */
function kickBomb(
  state: GameState,
  player: Player,
  direction: Direction,
): void {
  const [col, row] = playerCell(player);
  if (Math.abs(player.x - col) > 1e-6 || Math.abs(player.y - row) > 1e-6)
    return;
  const [dx, dy] = DIRECTION_DELTA[direction];
  const bomb = state.bombs.find(
    (b) =>
      b.col === col + dx &&
      b.row === row + dy &&
      !b.passThrough.includes(player.id),
  );
  if (!bomb) return;
  state.bombs = state.bombs.filter((b) => b !== bomb);
  if (
    launchBomb(state, bomb, [bomb.col, bomb.row], direction, 1, {
      fuseRuns: true,
      by: player.id,
    })
  ) {
    state.events.push({ type: 'bomb-kicked', playerId: player.id });
  } else {
    state.bombs.push(bomb);
  }
}

/** The bomb in their hands falls where they stand, fuse and all. */
function dropHeldBomb(state: GameState, player: Player): Bomb | null {
  const bomb = player.heldBomb;
  if (!bomb) return null;
  player.heldBomb = null;
  const [col, row] = playerCell(player);
  bomb.col = col;
  bomb.row = row;
  bomb.passThrough = state.players
    .filter((p) => p.alive && standsOn(p, col, row))
    .map((p) => p.id);
  state.bombs.push(bomb);
  return bomb;
}

/**
 * The detonate button: the oldest of the player's remote bombs goes off this
 * tick. One per press, so a row of bombs is set off in the order it was laid.
 * Works in the air too: it is a button, not a hand.
 */
function detonateOldest(state: GameState, player: Player): void {
  const oldest = state.bombs.find(
    (b) => b.ownerId === player.id && b.remote && b.fuse > 0,
  );
  if (oldest) oldest.fuse = 0;
}

/**
 * The Poraquê's jolt: every bomb within `radius` cells of the rider (walking
 * distance, so a plus-shaped reach of diamonds), anyone's and remote ones too,
 * goes off this tick — the rider's own bomb underfoot included.
 */
function shortCircuit(state: GameState, player: Player, radius: number): void {
  const [col, row] = playerCell(player);
  for (const bomb of state.bombs) {
    if (Math.abs(bomb.col - col) + Math.abs(bomb.row - row) <= radius)
      bomb.fuse = 0;
  }
}

function placeBomb(state: GameState, player: Player): void {
  if (activeBombCount(state, player.id) >= player.maxBombs) return;
  placeBombAt(
    state,
    player,
    ...playerCell(player),
    nextBombRange(state, player),
  );
}

/**
 * How far the next bomb a player drops will reach: their fire — or, with the
 * power bomb, as far as fire goes for the first of a volley.
 */
export function nextBombRange(state: GameState, player: Player): number {
  return player.powerBomb && activeBombCount(state, player.id) === 0
    ? MAX_FIRE
    : player.fireRange;
}

/**
 * Bernardo's line: a bomb under the rider and one on each free cell ahead,
 * up to `count` in all, stopping at the first crate, wall or bomb. Ignores the
 * bomb limit — that is the ability. Returns how many were dropped.
 */
function placeBombLine(
  state: GameState,
  player: Player,
  count: number,
): number {
  const [col, row] = playerCell(player);
  const [dx, dy] = DIRECTION_DELTA[player.facing];
  let dropped = 0;
  for (let i = 0; i < count; i++) {
    if (!placeBombAt(state, player, col + dx * i, row + dy * i)) break;
    dropped++;
  }
  return dropped;
}

/** Drops one of the player's bombs on a cell, if it is free. */
function placeBombAt(
  state: GameState,
  player: Player,
  col: number,
  row: number,
  range = player.fireRange,
): boolean {
  if (!inBounds(state, col, row)) return false;
  if (state.bombs.some((b) => b.col === col && b.row === row)) return false;
  if (tileAt(state, col, row) !== 'empty') return false;

  const bomb: Bomb = {
    id: state.nextBombId++,
    col,
    row,
    ownerId: player.id,
    fuse: isCursed(state, player, 'shortfuse')
      ? CURSE_FUSE_TICKS
      : BOMB_FUSE_TICKS,
    range,
    passThrough: state.players
      .filter((p) => p.alive && standsOn(p, col, row))
      .map((p) => p.id),
    pierce: player.pierce,
    remote: player.remote,
  };
  state.bombs.push(bomb);
  state.events.push({ type: 'bomb-placed', col, row, playerId: player.id });
  return true;
}

function releasePassThrough(state: GameState): void {
  for (const bomb of state.bombs) {
    bomb.passThrough = bomb.passThrough.filter((id) => {
      const player = state.players.find((p) => p.id === id);
      return !!player?.alive && overlapsCell(player, bomb.col, bomb.row);
    });
  }
}

function collectPowerUps(state: GameState): void {
  for (const player of state.players) {
    if (!player.alive || isAirborne(player)) continue;
    const [col, row] = playerCell(player);
    const index = state.powerUps.findIndex(
      (p) => p.col === col && p.row === row,
    );
    if (index === -1) continue;
    const [powerUp] = state.powerUps.splice(index, 1);
    if (!powerUp) continue;
    state.events.push({
      type: 'power-up-collected',
      playerId: player.id,
      kind: powerUp.kind,
    });
    if (powerUp.kind === 'egg') {
      // Random to the player, deterministic to the rules: the same egg hatches
      // the same mount on the server and on every client.
      player.mountId = hatchMount(state.tick + col * 7 + row * 13);
      state.events.push({
        type: 'mount-gained',
        playerId: player.id,
        mountId: player.mountId,
      });
    } else if (powerUp.kind === 'vest') {
      player.vestUntilTick = state.tick + VEST_TICKS;
    } else if (powerUp.kind === 'skull') {
      curse(state, player, col, row);
    } else if (powerUp.kind === 'clock') {
      addTime(state);
    } else if (powerUp.kind === 'oneup') {
      if (state.stage) {
        const gained = state.stage.livesGained;
        gained[player.id] = (gained[player.id] ?? 0) + 1;
        const lives = state.stage.lives[player.id];
        if (lives !== undefined) state.stage.lives[player.id] = lives + 1;
        state.events.push({ type: 'life-gained', playerId: player.id });
      }
    } else {
      applyPowerUp(player, powerUp.kind);
    }
  }
}

export function applyPowerUp(player: Player, kind: PowerUpKind): void {
  switch (kind) {
    case 'bomb':
      player.maxBombs = Math.min(MAX_BOMBS, player.maxBombs + 1);
      break;
    case 'fire':
      player.fireRange = Math.min(MAX_FIRE, player.fireRange + 1);
      break;
    case 'speed':
      player.speedLevel = Math.min(MAX_SPEED_LEVEL, player.speedLevel + 1);
      break;
    case 'pierce':
      player.pierce = true;
      break;
    case 'remote':
      player.remote = true;
      break;
    case 'glove':
      player.glove = true;
      break;
    case 'kick':
      player.kick = true;
      break;
    case 'wallpass':
      player.wallPass = true;
      break;
    case 'fullfire':
      player.fireRange = MAX_FIRE;
      player.fullFire = true;
      break;
    case 'powerbomb':
      player.powerBomb = true;
      break;
    case 'egg':
    case 'vest':
    case 'skull':
    case 'clock':
    case 'oneup':
      // These need the game state; see `collectPowerUps`.
      break;
  }
}

function ageFlames(state: GameState): void {
  for (const flame of state.flames) flame.ticksLeft--;
  state.flames = state.flames.filter((f) => f.ticksLeft > 0);

  for (const block of state.burningBlocks) block.ticksLeft--;
  for (const block of state.burningBlocks.filter((b) => b.ticksLeft <= 0)) {
    const index = cellIndex(state, block.col, block.row);
    state.tiles[index] = 'empty';
    const hidden = state.hiddenPowerUps[index];
    if (hidden) {
      state.powerUps.push({ col: block.col, row: block.row, kind: hidden });
      state.hiddenPowerUps[index] = null;
    }
  }
  state.burningBlocks = state.burningBlocks.filter((b) => b.ticksLeft > 0);
}

function detonateBombs(state: GameState): void {
  // A bomb in hand burns like one on the ground, and a flame where the holder
  // stands sets it off — unless they are in the air with it.
  for (const player of state.players) {
    const held = player.heldBomb;
    if (!held || !player.alive) continue;
    if (!held.remote) held.fuse--;
    const [col, row] = playerCell(player);
    if (
      !player.jump &&
      state.flames.some((f) => f.col === col && f.row === row)
    )
      held.fuse = 0;
    // Dropped already burnt down: the loop below must not count it again.
    if (held.fuse <= 0) dropHeldBomb(state, player);
  }

  for (const bomb of state.bombs) {
    if (bomb.fuse <= 0) continue;
    // A remote bomb waits for its owner (or another flame); its fuse never runs.
    if (!bomb.remote) bomb.fuse--;
    // A bomb dropped into (or caught by) a lingering flame goes off at once.
    if (state.flames.some((f) => f.col === bomb.col && f.row === bomb.row)) {
      bomb.fuse = 0;
    }
  }

  const queue = state.bombs.filter((b) => b.fuse <= 0);
  while (queue.length > 0) {
    const bomb = queue.shift() as Bomb;
    if (!state.bombs.includes(bomb)) continue;
    // On a long stage's cable the blast is carried off to the far end.
    if (state.stage && divertAlongCable(state, bomb)) continue;
    explode(state, bomb, queue);
  }
}

const END_SHAPE: Record<Direction, FlameShape> = {
  up: 'end-up',
  down: 'end-down',
  left: 'end-left',
  right: 'end-right',
};

function explode(state: GameState, bomb: Bomb, queue: Bomb[]): void {
  state.bombs = state.bombs.filter((b) => b !== bomb);
  state.events.push({ type: 'explosion', col: bomb.col, row: bomb.row });
  const addFlame = (col: number, row: number, shape: FlameShape) =>
    lightFlame(state, col, row, shape, bomb.ownerId);
  addFlame(bomb.col, bomb.row, 'center');

  for (const direction of Object.keys(DIRECTION_DELTA) as Direction[]) {
    const [dx, dy] = DIRECTION_DELTA[direction];
    const axis: FlameShape = dx !== 0 ? 'horizontal' : 'vertical';

    for (let i = 1; i <= bomb.range; i++) {
      const col = bomb.col + dx * i;
      const row = bomb.row + dy * i;
      if (!inBounds(state, col, row)) break;
      const tile = tileAt(state, col, row);
      if (tile === 'wall') break;
      if (tile === 'block') {
        burnBlock(state, col, row);
        // A piercing flame burns the block and carries on through it.
        if (!bomb.pierce) break;
        addFlame(col, row, i === bomb.range ? END_SHAPE[direction] : axis);
        continue;
      }

      const end = i === bomb.range;
      const hitBomb = state.bombs.find((b) => b.col === col && b.row === row);
      if (hitBomb) {
        // Chain reaction: the other bomb takes over from here.
        if (!queue.includes(hitBomb)) queue.push(hitBomb);
        addFlame(col, row, END_SHAPE[direction]);
        break;
      }

      const powerUpIndex = state.powerUps.findIndex(
        (p) => p.col === col && p.row === row,
      );
      if (powerUpIndex !== -1) {
        // An exposed power-up is destroyed by the flame, and stops it.
        state.powerUps.splice(powerUpIndex, 1);
        state.events.push({ type: 'power-up-burned', col, row });
        addFlame(col, row, END_SHAPE[direction]);
        break;
      }

      addFlame(col, row, end ? END_SHAPE[direction] : axis);
    }
  }
}

function burnBlock(state: GameState, col: number, row: number): void {
  if (state.burningBlocks.some((b) => b.col === col && b.row === row)) return;
  state.burningBlocks.push({ col, row, ticksLeft: BLOCK_BURN_TICKS });
  state.events.push({ type: 'block-destroyed', col, row });
}

function lightFlame(
  state: GameState,
  col: number,
  row: number,
  shape: FlameShape,
  ownerId: string | null,
): void {
  const existing = state.flames.find((f) => f.col === col && f.row === row);
  if (existing) {
    existing.shape = mergeFlameShapes(existing.shape, shape);
    existing.ticksLeft = FLAME_TICKS;
    // The first flame on a cell keeps the kill: a second owner does not take it over.
    existing.ownerId ??= ownerId;
    return;
  }
  state.flames.push({ col, row, shape, ticksLeft: FLAME_TICKS, ownerId });
}

function axisOf(shape: FlameShape): 'h' | 'v' | 'c' {
  if (shape === 'center') return 'c';
  return shape === 'horizontal' || shape === 'end-left' || shape === 'end-right'
    ? 'h'
    : 'v';
}

/** Two flames crossing the same cell: same axis → a straight piece, else a cross. */
export function mergeFlameShapes(a: FlameShape, b: FlameShape): FlameShape {
  if (a === b) return a;
  const axisA = axisOf(a);
  if (axisA === 'c' || axisA !== axisOf(b)) return 'center';
  return axisA === 'h' ? 'horizontal' : 'vertical';
}

/**
 * Takes a player out of the round without a flame — they left the game. The
 * round then ends by the usual rule: once one player (or none) is left, it is
 * decided, and over after {@link ROUND_END_DELAY_TICKS}. Leaving once it is
 * decided changes nothing: the winner who closes the tab still won.
 *
 * Returns the `player-died` event for the caller to forward, because
 * `state.events` only holds what the last tick did and is cleared by the next.
 * `null` when there is no such living player.
 */
export function eliminatePlayer(
  state: GameState,
  playerId: string,
): GameEvent | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player?.alive || state.phase !== 'playing' || isDecided(state))
    return null;
  player.alive = false;
  player.moving = false;
  player.mountId = null;
  player.diedAtTick = state.tick;
  dropHeldBomb(state, player);
  letGo(state, player);
  scatterItems(state, player);
  return { type: 'player-died', playerId, killerId: null };
}

function killPlayersInFlames(state: GameState): void {
  // Decided: the last one standing has won, whatever still burns around them.
  if (isDecided(state)) return;
  // A copy: a kill by an outsider adds a player, who must not be judged this tick.
  for (const player of [...state.players]) {
    if (!player.alive) continue;
    // In the air (jumping, held overhead or thrown), flames pass underneath.
    if (player.jump || isAirborne(player)) continue;
    const [col, row] = playerCell(player);
    const flame = state.flames.find((f) => f.col === col && f.row === row);
    if (!flame) continue;
    // A stage is played as a team: a teammate's flame does not hurt — only
    // one's own bomb does, as ever.
    if (state.stage && isTeammateFlame(state, player, flame.ownerId)) continue;
    if (!hitPlayer(state, player, flame.ownerId)) continue;

    const thrower = state.outsiders.find((o) => o.id === flame.ownerId);
    if (thrower) enterArena(state, thrower, player);
  }
}

/** Whether a flame was lit by another player of the stage — a teammate, never an outsider. */
function isTeammateFlame(
  state: GameState,
  player: Player,
  ownerId: string | null,
): boolean {
  return (
    ownerId !== null &&
    ownerId !== player.id &&
    state.players.some((p) => p.id === ownerId)
  );
}

/**
 * Something deadly reached a player — a flame, or a creature in stage mode.
 * Shielded or in the vest, nothing happens; on a mount, the mount takes the
 * hit and the rider gets a moment to get away. Returns whether they are out.
 */
function hitPlayer(
  state: GameState,
  player: Player,
  killerId: string | null,
): boolean {
  if (
    state.tick < player.shieldedUntilTick ||
    state.tick < player.vestUntilTick
  )
    return false;
  if (player.mountId) {
    player.mountId = null;
    player.abilityUntilTick = 0;
    player.shieldedUntilTick = state.tick + MOUNT_SHIELD_TICKS;
    state.events.push({ type: 'mount-lost', playerId: player.id });
    return false;
  }
  player.alive = false;
  player.moving = false;
  player.diedAtTick = state.tick;
  dropHeldBomb(state, player);
  letGo(state, player);
  state.events.push({ type: 'player-died', playerId: player.id, killerId });
  scatterItems(state, player);
  return true;
}

/**
 * An outsider's bomb got someone: the thrower steps in where the victim fell,
 * with the starting kit and the vest for a few seconds — immune to the
 * flame still burning there, and to whatever comes next. The victim is out as usual; the round has one more player in it.
 */
function enterArena(state: GameState, thrower: Outsider, victim: Player): void {
  removeOutsider(state, thrower.id);
  const [col, row] = playerCell(victim);
  // Back from the border after falling: their own slot and colour, a fresh
  // start where the victim stood. Anyone else from the line takes the
  // victim's slot and colour: the arena repaints that slot with their look.
  const fallen = state.players.findIndex((p) => p.id === thrower.id);
  const old = state.players[fallen];
  const entrant = old
    ? newPlayer(thrower, old.slot, col, row, old.color)
    : newPlayer(thrower, victim.slot, col, row, victim.color);
  entrant.vestUntilTick = state.tick + ENTRY_SHIELD_TICKS;
  if (old) state.players[fallen] = entrant;
  else state.players.push(entrant);
  state.events.push({
    type: 'outsider-entered',
    playerId: thrower.id,
    victimId: victim.id,
  });
}

/**
 * One player (or none) is left: the round is decided, and nobody dies from
 * here on — not by flame, wall or leaving — so the one standing when it was
 * decided is the one standing when it is over. Players who fall in the same
 * tick fall together: with nobody left, it is a draw.
 */
export function isDecided(state: Pick<GameState, 'endsAtTick'>): boolean {
  return state.endsAtTick !== null;
}

function updateRoundEnd(state: GameState): void {
  // A single-player sandbox never ends on its own.
  if (state.players.length < 2) return;
  const alive = state.players.filter((p) => p.alive);

  if (state.endsAtTick === null) {
    if (alive.length <= 1)
      state.endsAtTick = state.tick + ROUND_END_DELAY_TICKS;
    return;
  }
  // Nobody dies once it is decided, so nobody enters either: `alive` stays as it was.
  if (state.tick < state.endsAtTick) return;

  state.phase = 'over';
  state.winnerId = alive.length === 1 ? (alive[0]?.id ?? null) : null;
  state.events.push({ type: 'round-over', winnerId: state.winnerId });
}

/** The skull's curses, in the order a pickup cycles through them. */
export const CURSE_KINDS: readonly CurseKind[] = [
  'diarrhea',
  'constipation',
  'reverse',
  'slow',
  'fast',
  'shortfuse',
];

const REVERSED: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Whether `player` is under the `kind` curse right now. */
export function isCursed(
  state: Pick<GameState, 'tick'>,
  player: Player,
  kind: CurseKind,
): boolean {
  return player.curse?.kind === kind && state.tick < player.curse.untilTick;
}

/**
 * A skull: a curse for {@link CURSE_TICKS}. Which one is random to the eye —
 * from the tick and the cell — and the same on every machine.
 */
function curse(
  state: GameState,
  player: Player,
  col: number,
  row: number,
): void {
  const kind = CURSE_KINDS[
    (state.tick + col * 3 + row * 5) % CURSE_KINDS.length
  ] as CurseKind;
  player.curse = {
    kind,
    untilTick: state.tick + CURSE_TICKS,
    sinceTick: state.tick,
  };
  state.events.push({ type: 'cursed', playerId: player.id, curse: kind });
}

/** The keys as a curse turns them: reversed, a bomb on every tick, or none at all. */
function cursedInput(
  player: Player,
  input: PlayerInput | undefined,
): PlayerInput | undefined {
  const kind = player.curse?.kind;
  if (!kind) return input;
  const held = input ?? { direction: null, bomb: false };
  if (kind === 'reverse')
    return {
      ...held,
      direction: held.direction ? REVERSED[held.direction] : null,
    };
  if (kind === 'diarrhea') return { ...held, bomb: true };
  if (kind === 'constipation') return { ...held, bomb: false };
  return input;
}

/**
 * Touching passes a curse on: the one who had it is rid of it, the other
 * takes the time it had left. Not straight back — a curse caught this
 * second does not pass on yet.
 */
function passCurses(state: GameState): void {
  const players = state.players.filter((p) => p.alive && !isAirborne(p));
  for (const from of players) {
    const held = from.curse;
    if (!held || state.tick - held.sinceTick < TICK_RATE) continue;
    const to = players.find(
      (p) =>
        p !== from &&
        !p.curse &&
        Math.abs(p.x - from.x) < 0.7 &&
        Math.abs(p.y - from.y) < 0.7,
    );
    if (!to) continue;
    to.curse = { ...held, sinceTick: state.tick };
    from.curse = null;
    state.events.push({ type: 'curse-passed', fromId: from.id, toId: to.id });
  }
}

/** The clock: more time before the arena closes in — only while it has not started to. */
function addTime(state: GameState): void {
  if (state.closesAtTick === null || state.tick >= state.closesAtTick) return;
  state.closesAtTick += CLOCK_BONUS_TICKS;
  state.events.push({
    type: 'time-added',
    seconds: CLOCK_BONUS_TICKS / TICK_RATE,
  });
}
