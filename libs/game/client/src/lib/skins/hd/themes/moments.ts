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
  | { readonly kind: 'rain' };

/** The default blackout: every 30 s, 2 s of dark. */
export const BLACKOUT: Extract<ArenaMoment, { kind: 'blackout' }> = {
  kind: 'blackout',
  everyTicks: 30 * TICK_RATE,
  forTicks: 2 * TICK_RATE,
};
export const RAIN: ArenaMoment = { kind: 'rain' };

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

/** A blackout with a shorter wait, for previews that cannot run half a minute. */
export function quickened(
  moment: ArenaMoment | null | undefined,
  everyTicks: number,
): ArenaMoment | null {
  if (!moment) return null;
  return moment.kind === 'blackout' ? { ...moment, everyTicks } : moment;
}
