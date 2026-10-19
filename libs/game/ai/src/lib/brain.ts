import {
  activeBombCount,
  BOMB_FUSE_TICKS,
  createRng,
  Direction,
  GameState,
  isAirborne,
  Player,
  PlayerInput,
  playerCell,
  tileAt,
} from '@libs/game-core';
import { blastCells, dangerMap, DangerMap, isSafe } from './danger';
import { BOT_PROFILES, BotLevel, BotProfile } from './levels';
import { pathTo, Reach, reachable } from './paths';

const IDLE: PlayerInput = { direction: null, bomb: false };

/** The key that brings `me` towards the centre of `col, row`, along the longer gap first. */
function towards(me: Player, col: number, row: number): Direction {
  const dx = col - me.x;
  const dy = row - me.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
/** Close enough to a cell's centre to count as there. */
const ARRIVED = 0.08;
/** Ticks without moving, with somewhere to go, before the bot rethinks. */
const STUCK_TICKS = 20;

/**
 * One bot. Three layers, top to bottom:
 *
 * 1. **Plan** (every `replanTicks`): where to go and whether to drop a bomb
 *    there — flee, pick an item, break crates, hunt an enemy. Today a scored
 *    rule set; tomorrow the same slot can be filled by another strategist
 *    (a language model, say) that returns the same kind of plan.
 * 2. **Steer** (every tick): turn the planned path into a direction key.
 * 3. **Stay alive** (every tick, overriding the plan): a cell about to burn
 *    triggers a new plan at once, and a bomb is only dropped when a way out
 *    of its blast has been found first.
 *
 * Bots see what a player sees: never what the crates hide.
 */
export class Bot {
  readonly profile: BotProfile;
  private readonly rng: () => number;
  private path: [number, number][] = [];
  private bombAt: [number, number] | null = null;
  private nextPlanTick = 0;
  private stillFor = 0;
  private last: [number, number] = [-1, -1];
  /** When each of our remote bombs was first seen, by bomb id: how long it has waited. */
  private readonly laidAt = new Map<number, number>();
  /** When each bomb on the ground was first seen, by bomb id: whether it has been noticed yet. */
  private readonly seenAt = new Map<number, number>();

  constructor(
    readonly id: string,
    readonly level: BotLevel,
    seed = 1,
  ) {
    this.profile = BOT_PROFILES[level];
    this.rng = createRng(seed);
  }

  /** What the bot presses this tick. */
  decide(state: GameState): PlayerInput {
    const me = state.players.find((p) => p.id === this.id);
    if (!me?.alive || isAirborne(me) || state.tick < me.stunnedUntilTick)
      return IDLE;
    // Something in the hands goes straight back out: a bomb, or a player.
    if (me.carrying || me.heldBomb) return { direction: null, bomb: true };

    this.notice(state);
    const danger = this.danger(state, me);
    const [col, row] = playerCell(me);
    this.trackStill(me);
    // Stay alive: under threat with no safe end to the path, rethink now.
    const threatened = !isSafe(danger, col, row) && !this.pathEndsSafe(danger);
    if (
      state.tick >= this.nextPlanTick ||
      threatened ||
      this.stillFor >= STUCK_TICKS
    ) {
      this.plan(state, me, danger);
      this.nextPlanTick = state.tick + this.profile.replanTicks;
      this.stillFor = 0;
    }

    const input: PlayerInput = { direction: this.steer(me), bomb: false };
    if (this.bombAt && this.bombAt[0] === col && this.bombAt[1] === row) {
      input.bomb = true;
      this.bombAt = null;
    }
    if (this.shouldDetonate(state, me)) input.detonate = true;
    return input;
  }

  private danger(
    state: GameState,
    me: Player,
    extra?: { col: number; row: number },
  ): DangerMap {
    const delay = this.profile.reactionTicks;
    // Bombs too fresh to have been noticed are not feared yet; ours, always.
    const seen = delay
      ? {
          ...state,
          bombs: state.bombs.filter(
            (b) =>
              b.ownerId === me.id ||
              state.tick - (this.seenAt.get(b.id) ?? state.tick) >= delay,
          ),
        }
      : state;
    return dangerMap(seen, {
      viewerId: me.id,
      readsChains: this.profile.readsChains,
      readsClosing: this.profile.readsClosing,
      extra: extra && {
        ...extra,
        range: me.fireRange,
        pierce: me.pierce,
        at: BOMB_FUSE_TICKS,
      },
    });
  }

  private plan(state: GameState, me: Player, danger: DangerMap): void {
    const [col, row] = playerCell(me);
    const here = row * state.cols + col;
    const reach = reachable(state, me, danger);
    this.bombAt = null;

    // 1. Under threat: the nearest cell nothing threatens — and once one is
    // chosen, it is kept while it stays safe and in reach. Switching between
    // two equally good refuges is how a bot dithers in a blast line.
    if (!isSafe(danger, col, row)) {
      const target = this.path[this.path.length - 1];
      const kept = target && target[1] * state.cols + target[0];
      if (
        target &&
        kept !== undefined &&
        isSafe(danger, target[0], target[1]) &&
        reach.steps[kept] !== -1
      ) {
        this.path = pathTo(reach, kept);
        return;
      }
      // No refuge in reach: keep running the old way if there is one, else
      // to the cell that catches fire last — standing still is the one sure loss.
      // Now and then, in a hurry, it runs for any refuge rather than the best.
      const slip = this.rng() < this.profile.slipChance;
      this.path =
        this.nearestSafe(reach, danger, here, slip) ??
        (this.path.length > 0 ? this.path : this.latestToBurn(reach, danger));
      return;
    }

    // 2. A bomb right here, if it pays and there is a way out of it.
    const canBomb =
      activeBombCount(state, me.id) < me.maxBombs &&
      !state.bombs.some((b) => b.col === col && b.row === row);
    if (
      canBomb &&
      this.worth(state, me, col, row) > 0 &&
      this.rng() < this.profile.bombChance
    ) {
      const escape = this.escapeFrom(state, me, col, row);
      if (escape) {
        this.bombAt = [col, row];
        this.path = escape;
        return;
      }
    }

    // 3. Somewhere worth going: an item, a spot to bomb, closer to an enemy.
    // A spot only counts for bombing if a bomb there leaves a way out; that
    // check costs a search, so it runs on the best candidates first.
    const enemies = state.players.filter(
      (p) => p.alive && p.id !== me.id && !isAirborne(p),
    );
    const candidates: {
      index: number;
      base: number;
      bomb: number;
      steps: number;
    }[] = [];
    for (const index of reach.order) {
      const c = index % state.cols;
      const r = Math.floor(index / state.cols);
      if (!isSafe(danger, c, r)) continue;
      let base = 0;
      if (state.powerUps.some((p) => p.col === c && p.row === r)) base += 6;
      const nearest = Math.min(
        ...enemies.map(
          (e) =>
            Math.abs(playerCell(e)[0] - c) + Math.abs(playerCell(e)[1] - r),
        ),
        99,
      );
      base += (this.profile.aggression * 2) / (1 + nearest);
      const bomb = canBomb ? this.worth(state, me, c, r) : 0;
      candidates.push({
        index,
        base,
        bomb,
        steps: reach.steps[index] as number,
      });
    }
    const score = (
      k: { base: number; bomb: number; steps: number },
      withBomb: boolean,
    ) => (k.base + (withBomb ? k.bomb : 0)) / (1 + k.steps * 0.35);
    candidates.sort((a, b) => score(b, true) - score(a, true));
    let best: { index: number; score: number } = {
      index: here,
      score: -Infinity,
    };
    for (const k of candidates) {
      // Sorted by the best it could be: nothing after this one can do better.
      if (score(k, true) <= best.score) break;
      const c = k.index % state.cols;
      const r = Math.floor(k.index / state.cols);
      const withBomb = k.bomb > 0 && this.escapeFrom(state, me, c, r) !== null;
      const value = score(k, withBomb);
      if (value > best.score) best = { index: k.index, score: value };
    }
    this.path = best.index === here ? [] : pathTo(reach, best.index);
  }

  /**
   * What a bomb on `col, row` would do: crates it breaks, and enemies it
   * catches — worth far more when the enemy would have nowhere to run, which
   * is the only way a bomb kills someone who dodges.
   */
  private worth(
    state: GameState,
    me: Player,
    col: number,
    row: number,
  ): number {
    let crates = 0;
    let caught = 0;
    let trapped = 0;
    for (const [c, r] of blastCells(state, {
      col,
      row,
      range: me.fireRange,
      pierce: me.pierce,
    })) {
      if (
        tileAt(state, c, r) === 'block' &&
        !state.burningBlocks.some((b) => b.col === c && b.row === r)
      )
        crates++;
      for (const p of state.players) {
        if (
          !p.alive ||
          p.id === me.id ||
          isAirborne(p) ||
          playerCell(p)[0] !== c ||
          playerCell(p)[1] !== r
        )
          continue;
        caught++;
        if (this.profile.setsTraps && !this.canEscape(state, me, p, col, row))
          trapped++;
      }
    }
    return crates * 1.5 + (caught * 3 + trapped * 25) * this.profile.aggression;
  }

  /** Whether `enemy` would still find a cell out of reach once our bomb lands on `col, row`. */
  private canEscape(
    state: GameState,
    me: Player,
    enemy: Player,
    col: number,
    row: number,
  ): boolean {
    const map = dangerMap(state, {
      viewerId: enemy.id,
      readsChains: true,
      readsClosing: true,
      extra: {
        col,
        row,
        range: me.fireRange,
        pierce: me.pierce,
        at: BOMB_FUSE_TICKS,
      },
    });
    const reach = reachable(state, enemy, map);
    return reach.order.some((i) =>
      isSafe(map, i % reach.cols, Math.floor(i / reach.cols)),
    );
  }

  /** A path to a cell out of reach of a bomb dropped on `col, row`; `null` when there is none. */
  private escapeFrom(
    state: GameState,
    me: Player,
    col: number,
    row: number,
  ): [number, number][] | null {
    const withBomb = this.danger(state, me, { col, row });
    // Our own bomb is the one risk we choose: the way out must not cut it fine.
    const reach = reachable(state, me, withBomb, [col, row], 0.6);
    return this.nearestSafe(reach, withBomb, row * state.cols + col);
  }

  /**
   * The way to a cell nothing threatens. Among the nearest few, the one with
   * the most cells reachable around it: a dead end is where bots get cornered.
   */
  private nearestSafe(
    reach: Reach,
    danger: DangerMap,
    here: number,
    /** Any of the nearest few, not the roomiest: a bot in a hurry. */
    slip = false,
  ): [number, number][] | null {
    let best = -1;
    let bestScore = -Infinity;
    let seen = 0;
    for (const index of reach.order) {
      if (index === here) continue;
      const c = index % reach.cols;
      const r = Math.floor(index / reach.cols);
      if (!isSafe(danger, c, r)) continue;
      const room = [
        index - 1,
        index + 1,
        index - reach.cols,
        index + reach.cols,
      ].filter((n) => reach.steps[n] !== -1).length;
      const score = slip
        ? this.rng()
        : room - (reach.steps[index] as number) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
      if (++seen >= 6) break;
    }
    return best === -1 ? null : pathTo(reach, best);
  }

  /** Notes when each bomb on the ground was first seen, and forgets the ones gone. */
  private notice(state: GameState): void {
    if (!this.profile.reactionTicks) return;
    const ids = new Set<number>();
    for (const bomb of state.bombs) {
      ids.add(bomb.id);
      if (!this.seenAt.has(bomb.id)) this.seenAt.set(bomb.id, state.tick);
    }
    for (const id of this.seenAt.keys())
      if (!ids.has(id)) this.seenAt.delete(id);
  }

  private latestToBurn(reach: Reach, danger: DangerMap): [number, number][] {
    let best = reach.order[0] as number;
    for (const index of reach.order)
      if ((danger.start[index] as number) > (danger.start[best] as number))
        best = index;
    return pathTo(reach, best);
  }

  private pathEndsSafe(danger: DangerMap): boolean {
    const end = this.path[this.path.length - 1];
    return !!end && isSafe(danger, end[0], end[1]);
  }

  /**
   * Presses the remote's button for the oldest of our remote bombs (the one
   * the button sets off), never while we stand in the blast of any of them —
   * one sets off the next. Every level fires it once it has waited a fuse,
   * so a remote bomb is at least an ordinary one: without that the bot laid
   * one, never set it off, and could lay no more. A level that `detonates`
   * also fires it early, the moment it catches an enemy.
   */
  private shouldDetonate(state: GameState, me: Player): boolean {
    const mine = state.bombs.filter(
      (b) => b.ownerId === me.id && b.remote && b.fuse > 0,
    );
    for (const id of this.laidAt.keys())
      if (!mine.some((b) => b.id === id)) this.laidAt.delete(id);
    for (const b of mine)
      if (!this.laidAt.has(b.id)) this.laidAt.set(b.id, state.tick);
    const oldest = mine[0];
    if (!oldest) return false;

    const inBlast = (p: Player, cells: [number, number][]) =>
      cells.some(([c, r]) => playerCell(p)[0] === c && playerCell(p)[1] === r);
    if (mine.some((b) => inBlast(me, blastCells(state, b)))) return false;

    const waited = state.tick - (this.laidAt.get(oldest.id) ?? state.tick);
    if (waited >= BOMB_FUSE_TICKS) return true;
    if (!this.profile.detonates) return false;
    const cells = blastCells(state, oldest);
    return state.players.some(
      (p) => p.alive && p.id !== me.id && inBlast(p, cells),
    );
  }

  /** The direction towards the next cell of the path, dropping the cells already reached. */
  private steer(me: Player): Direction | null {
    while (this.path.length > 0) {
      const [c, r] = this.path[0] as [number, number];
      if (Math.abs(me.x - c) < ARRIVED && Math.abs(me.y - r) < ARRIVED) {
        this.path.shift();
        continue;
      }
      return towards(me, c, r);
    }
    // Nowhere to go: back to the middle of the cell, never parked half in the next one.
    const [c, r] = playerCell(me);
    if (Math.abs(me.x - c) < ARRIVED && Math.abs(me.y - r) < ARRIVED)
      return null;
    return towards(me, c, r);
  }

  private trackStill(me: Player): void {
    const moved = me.x !== this.last[0] || me.y !== this.last[1];
    this.last = [me.x, me.y];
    this.stillFor = moved || this.path.length === 0 ? 0 : this.stillFor + 1;
  }
}
