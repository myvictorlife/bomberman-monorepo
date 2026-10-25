import { TICK_RATE } from '@libs/game-core';

/**
 * An arena's special moment: something the place does on its own, over the
 * match, that changes only what is seen — never a rule. Timed from the
 * state's tick, so every client (and the preview) shows it at the same time.
 */
export type ArenaMoment =
  /** The lights go out: for `forTicks` every `everyTicks`, only what burns or glows is left. */
  | {
      readonly kind: 'blackout';
      readonly everyTicks: number;
      readonly forTicks: number;
    }
  /** It rains: drops streak the screen and the floor shines. */
  | { readonly kind: 'rain' }
  /**
   * The arena's eye looks the match over: for `forTicks` every `everyTicks`
   * a red line sweeps down the arena, top to bottom.
   */
  | {
      readonly kind: 'sweep';
      readonly everyTicks: number;
      readonly forTicks: number;
    }
  /**
   * Something goes wrong all at once: for `forTicks` every `everyTicks` the
   * tiles a theme paints an alarm look for (`<key>:alarm`) show it — the
   * build that breaks in the Programador.
   */
  | {
      readonly kind: 'alarm';
      readonly everyTicks: number;
      readonly forTicks: number;
    };

/** The default blackout: every 30 s, 2 s of dark. */
export const BLACKOUT: Extract<ArenaMoment, { kind: 'blackout' }> = {
  kind: 'blackout',
  everyTicks: 30 * TICK_RATE,
  forTicks: 2 * TICK_RATE,
};
export const RAIN: ArenaMoment = { kind: 'rain' };
/** The default alarm: every 30 s, 2 s of it. */
export const ALARM: Extract<ArenaMoment, { kind: 'alarm' }> = {
  kind: 'alarm',
  everyTicks: 30 * TICK_RATE,
  forTicks: 2 * TICK_RATE,
};
/** The default sweep: every 30 s, 2 s for the line to cross the arena. */
export const SWEEP: Extract<ArenaMoment, { kind: 'sweep' }> = {
  kind: 'sweep',
  everyTicks: 30 * TICK_RATE,
  forTicks: 2 * TICK_RATE,
};

/** How much of the fade the lights take to go out and come back, as a share of the dark time. */
const FADE = 0.15;

/**
 * How dark it is at `tick` under a blackout, 0 (lights on) to 1 (out), with a
 * short fade either side. The dark time ends on the period's boundary, so the
 * first one comes a full period in — never at the start of a round.
 */
export function blackoutAt(
  moment: ArenaMoment | null | undefined,
  tick: number,
): number {
  if (!moment || moment.kind !== 'blackout' || moment.everyTicks <= 0) return 0;
  const phase = tick % moment.everyTicks;
  const start = moment.everyTicks - moment.forTicks;
  if (phase < start) return 0;
  const k = (phase - start) / moment.forTicks;
  return Math.max(0, Math.min(1, k / FADE, (1 - k) / FADE));
}

/**
 * How far a sweep has gone at `tick`, 0 (the top) to 1 (the bottom), or
 * `null` when none is under way. Like the blackout, it ends on the period's
 * boundary, so the first one comes a full period in.
 */
export function sweepAt(
  moment: ArenaMoment | null | undefined,
  tick: number,
): number | null {
  if (!moment || moment.kind !== 'sweep' || moment.everyTicks <= 0) return null;
  const phase = tick % moment.everyTicks;
  const start = moment.everyTicks - moment.forTicks;
  if (phase < start) return null;
  return (phase - start) / moment.forTicks;
}

/**
 * Whether an alarm is on at `tick`. Like the blackout, it ends on the
 * period's boundary, so the first one comes a full period in.
 */
export function alarmAt(
  moment: ArenaMoment | null | undefined,
  tick: number,
): boolean {
  if (!moment || moment.kind !== 'alarm' || moment.everyTicks <= 0)
    return false;
  return tick % moment.everyTicks >= moment.everyTicks - moment.forTicks;
}

/**
 * Whether the tiles show their alarm look at `tick`: a sweep under way, or
 * an alarm on.
 */
export function alarmLookAt(
  moment: ArenaMoment | null | undefined,
  tick: number,
): boolean {
  return sweepAt(moment, tick) !== null || alarmAt(moment, tick);
}

/** A blackout, a sweep or an alarm with a shorter wait, for previews that cannot run half a minute. */
export function quickened(
  moment: ArenaMoment | null | undefined,
  everyTicks: number,
): ArenaMoment | null {
  if (!moment) return null;
  return moment.kind === 'rain' ? moment : { ...moment, everyTicks };
}

/** The sweep's colour: CIDA looking, in red. */
export const SWEEP_COLOR = '#ff4a6a';

/**
 * A theme may paint a tile a second time for while a sweep or an alarm is
 * under way, under its key plus this suffix — the eye that goes red.
 */
export const ALARM_SUFFIX = ':alarm';

/**
 * Paints the sweep at height `y` on a 2D context `width` wide: a red glow
 * trailing above it and a bright line on it. `tile` is a cell's size, which
 * the band is measured in.
 */
export function paintSweep(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  tile: number,
): void {
  const top = y - 2.5 * tile;
  const band = ctx.createLinearGradient(0, top, 0, y + 0.4 * tile);
  band.addColorStop(0, 'rgba(255,74,106,0)');
  band.addColorStop(0.86, 'rgba(255,74,106,0.2)');
  band.addColorStop(1, 'rgba(255,74,106,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, top, width, 2.9 * tile);
  ctx.save();
  ctx.shadowColor = SWEEP_COLOR;
  ctx.shadowBlur = 0.4 * tile;
  ctx.fillStyle = SWEEP_COLOR;
  ctx.fillRect(0, y - tile * 0.025, width, tile * 0.05);
  ctx.fillStyle = '#ffd0da';
  ctx.fillRect(0, y - tile * 0.008, width, tile * 0.016);
  ctx.restore();
}
