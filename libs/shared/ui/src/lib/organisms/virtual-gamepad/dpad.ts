/** The four ways a pad can point — the same words the game's `Direction` uses. */
export type PadDirection = 'up' | 'down' | 'left' | 'right';

export interface PadPoint {
  x: number;
  y: number;
}

export interface DpadOptions {
  /** Inside this radius of the centre, in pixels, the pad points nowhere. */
  deadZone: number;
  /**
   * How much farther the finger must go off the held axis before the pad
   * switches axis, as a fraction (0.3 = 30 % farther). It keeps a thumb on
   * the diagonal from flickering between two directions.
   */
  hysteresis: number;
}

export const DPAD_DEFAULTS: DpadOptions = { deadZone: 12, hysteresis: 0.3 };

const HORIZONTAL = new Set<PadDirection>(['left', 'right']);

/**
 * Which way a finger at `point` pushes a pad centred on `centre`: the
 * dominant axis, signed. Within the dead zone it pushes nowhere. With a
 * direction `held`, its axis wins ties and a bit beyond, so turning a corner
 * takes a deliberate move and a shaky thumb keeps walking straight.
 */
export function dragDirection(
  centre: PadPoint,
  point: PadPoint,
  held: PadDirection | null,
  options: DpadOptions = DPAD_DEFAULTS,
): PadDirection | null {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  if (Math.hypot(dx, dy) < options.deadZone) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const bias = 1 + options.hysteresis;
  let horizontal: boolean;
  if (held === null) horizontal = ax > ay;
  else if (HORIZONTAL.has(held)) horizontal = ax * bias >= ay;
  else horizontal = ax > ay * bias;
  if (horizontal) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * Where a floating pad's centre goes when the finger has strayed more than
 * `reach` from it: dragged along behind the finger, `reach` away. A thumb
 * that drifts keeps steering without lifting, and turning back takes the
 * same short move wherever the thumb has wandered.
 */
export function followCentre(
  centre: PadPoint,
  point: PadPoint,
  reach: number,
): PadPoint {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= reach) return centre;
  const pull = (distance - reach) / distance;
  return { x: centre.x + dx * pull, y: centre.y + dy * pull };
}

/**
 * Where each direction points once the pad is drawn a quarter turn
 * clockwise — a game turned sideways on a phone held upright. The screen's
 * right is then the pad's up, and so on round.
 */
export const QUARTER_TURN: Readonly<Record<PadDirection, PadDirection>> = {
  right: 'up',
  down: 'right',
  left: 'down',
  up: 'left',
};

/** The other way round: the pad's direction as the screen sees it. */
export const QUARTER_TURN_BACK: Readonly<Record<PadDirection, PadDirection>> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};
