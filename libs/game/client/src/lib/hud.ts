import {
  creaturesLeft,
  CurseKind,
  findMount,
  GamePhase,
  GameState,
  isClosing,
  MountId,
  playerColor,
  isExitOpen,
  secondsUntilClosing,
  PartGoal,
  StageResult,
  StageRun,
  TICK_RATE,
} from '@libs/game-core';
import { colorSlot } from './characters/cartoon/ink';

/** What the page around the canvas shows — a small, comparable snapshot. */
export interface HudPlayer {
  id: string;
  slot: number;
  /** Where their colour is in the skin's `playerColors`: their picked colour, else their slot's. */
  colorSlot: number;
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
  /** The campaign's items: absent in snapshots from before they existed. */
  wallPass?: boolean;
  powerBomb?: boolean;
  /** The skull's curse on them right now, if any. */
  curse?: CurseKind | null;
}

export interface HudSnapshot {
  phase: GamePhase;
  winnerId: string | null;
  players: HudPlayer[];
  /** Whole seconds on the round's clock; `null` with no clock (a sandbox). */
  secondsLeft: number | null;
  /** The clock ran out: walls are dropping. */
  closing: boolean;
  /** Stage mode: what is left to do; `null` in a versus round. */
  stage?: HudStage | null;
}

export interface HudStage {
  creaturesLeft: number;
  exitOpen: boolean;
  /** Whole seconds until the gate shuts behind the first one through; `null` while nobody is. */
  gateClosesIn: number | null;
  result: StageResult | null;
  /** The boss's health, on a boss stage; `null` elsewhere. */
  boss: { hp: number; maxHp: number } | null;
  /** Points scored in this stage, everyone together. */
  score: number;
  /** Extra lives picked up in this stage, everyone together. */
  livesGained: number;
  bonus: boolean;
  /** On a stage in parts: which one is played, of how many, and what opens its gate. */
  part?: { n: number; total: number; goal: PartGoal } | null;
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
    stage: state.stage
      ? {
          creaturesLeft: creaturesLeft(state.stage),
          exitOpen: isExitOpen(state.stage),
          gateClosesIn:
            state.stage.exitClosesAtTick === null
              ? null
              : Math.max(
                  0,
                  Math.ceil(
                    (state.stage.exitClosesAtTick - state.tick) / TICK_RATE,
                  ),
                ),
          result: state.stage.result,
          boss: state.stage.boss
            ? { hp: state.stage.boss.hp, maxHp: state.stage.boss.maxHp }
            : null,
          score: sum(state.stage.score),
          livesGained: sum(state.stage.livesGained),
          bonus: state.stage.bonus,
          part: partOf(state.stage),
        }
      : null,
    players: state.players.map((p) => ({
      id: p.id,
      slot: p.slot,
      colorSlot: colorSlot(playerColor(p)),
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
      wallPass: p.wallPass,
      powerBomb: p.powerBomb,
      curse: p.curse && state.tick < p.curse.untilTick ? p.curse.kind : null,
    })),
  };
}

function partOf(run: StageRun): HudStage['part'] {
  const part = run.parts[run.part];
  return part
    ? { n: run.part + 1, total: run.parts.length, goal: part.goal }
    : null;
}

export function sameHud(a: HudSnapshot | null, b: HudSnapshot): boolean {
  if (!a || a.phase !== b.phase || a.winnerId !== b.winnerId) return false;
  if (a.secondsLeft !== b.secondsLeft || a.closing !== b.closing) return false;
  if (
    a.stage?.creaturesLeft !== b.stage?.creaturesLeft ||
    a.stage?.exitOpen !== b.stage?.exitOpen ||
    a.stage?.gateClosesIn !== b.stage?.gateClosesIn ||
    a.stage?.result !== b.stage?.result ||
    a.stage?.boss?.hp !== b.stage?.boss?.hp ||
    a.stage?.score !== b.stage?.score ||
    a.stage?.livesGained !== b.stage?.livesGained ||
    a.stage?.part?.n !== b.stage?.part?.n
  )
    return false;
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
      p.wallPass === q.wallPass &&
      p.powerBomb === q.powerBomb &&
      p.curse === q.curse &&
      p.name === q.name
    );
  });
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((total, n) => total + n, 0);
}
