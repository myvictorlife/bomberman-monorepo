import {
  findMount,
  GamePhase,
  GameState,
  isClosing,
  MountId,
  secondsUntilClosing,
  TICK_RATE,
} from '@libs/game-core';

/** What the page around the canvas shows — a small, comparable snapshot. */
export interface HudPlayer {
  id: string;
  slot: number;
  name: string;
  alive: boolean;
  bombs: number;
  fire: number;
  speed: number;
  mount: MountId | null;
  /** Whole seconds until the mount ability is ready; 0 when ready or passive. */
  abilityReadyIn: number;
  /** A timed ability is running (rolling, sniffing, in the air). */
  abilityActive: boolean;
  pierce: boolean;
  remote: boolean;
  glove: boolean;
  kick: boolean;
  /** Whole seconds of vest left; 0 when none. */
  vestSeconds: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  winnerId: string | null;
  players: HudPlayer[];
  /** Whole seconds on the round's clock; `null` with no clock (a sandbox). */
  secondsLeft: number | null;
  /** The clock ran out: walls are dropping. */
  closing: boolean;
}

/** `m:ss`, the way the round's clock reads. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function toHud(state: GameState): HudSnapshot {
  return {
    phase: state.phase,
    winnerId: state.winnerId,
    secondsLeft: secondsUntilClosing(state, TICK_RATE),
    closing: isClosing(state),
    players: state.players.map((p) => ({
      id: p.id,
      slot: p.slot,
      name: p.name,
      alive: p.alive,
      bombs: p.maxBombs,
      fire: p.fireRange,
      speed: p.speedLevel,
      mount: p.mountId,
      abilityReadyIn:
        p.mountId && findMount(p.mountId).ability.kind !== 'pass-bombs'
          ? Math.max(
              0,
              Math.ceil((p.abilityReadyAtTick - state.tick) / TICK_RATE),
            )
          : 0,
      abilityActive: p.jump !== null || state.tick < p.abilityUntilTick,
      pierce: p.pierce,
      remote: p.remote,
      glove: p.glove,
      kick: p.kick,
      vestSeconds: Math.max(
        0,
        Math.ceil((p.vestUntilTick - state.tick) / TICK_RATE),
      ),
    })),
  };
}

export function sameHud(a: HudSnapshot | null, b: HudSnapshot): boolean {
  if (!a || a.phase !== b.phase || a.winnerId !== b.winnerId) return false;
  if (a.secondsLeft !== b.secondsLeft || a.closing !== b.closing) return false;
  if (a.players.length !== b.players.length) return false;
  return a.players.every((p, i) => {
    const q = b.players[i];
    return (
      !!q &&
      p.id === q.id &&
      p.alive === q.alive &&
      p.bombs === q.bombs &&
      p.fire === q.fire &&
      p.speed === q.speed &&
      p.mount === q.mount &&
      p.abilityReadyIn === q.abilityReadyIn &&
      p.abilityActive === q.abilityActive &&
      p.pierce === q.pierce &&
      p.remote === q.remote &&
      p.glove === q.glove &&
      p.kick === q.kick &&
      p.vestSeconds === q.vestSeconds &&
      p.name === q.name
    );
  });
}
