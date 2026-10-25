import { PadPoint } from './dpad';

/** Where the demo thumb is, in pad widths from the pad's resting centre. */
export interface DemoPose extends PadPoint {
  /** Whether the thumb is on the screen. */
  down: boolean;
}

interface DemoKey extends DemoPose {
  /** When, in milliseconds into the loop. */
  at: number;
}

/**
 * The demo's script, one loop: a thumb lands above and to the right of the
 * pad, which jumps under it; it pushes up, strays right far enough to drag
 * the pad along, turns back left (past the dragged centre: a short move,
 * however far it strayed) and lifts. Then a thumb lands on the pad itself
 * and pushes down, as on a fixed pad. Between two keys that are both down
 * the thumb slides; otherwise it jumps.
 */
const SCRIPT: readonly DemoKey[] = [
  { at: 0, x: 1.2, y: -0.7, down: false },
  { at: 700, x: 1.2, y: -0.7, down: true },
  { at: 1000, x: 1.2, y: -1.05, down: true },
  { at: 1500, x: 1.2, y: -1.05, down: true },
  { at: 1800, x: 1.6, y: -1.05, down: true },
  { at: 2300, x: 2.3, y: -1.05, down: true },
  { at: 2700, x: 2.3, y: -1.05, down: true },
  { at: 2900, x: 1.6, y: -1.05, down: true },
  { at: 3300, x: 1.6, y: -1.05, down: true },
  { at: 3300, x: 1.6, y: -1.05, down: false },
  { at: 4100, x: 0, y: 0.38, down: false },
  { at: 4100, x: 0, y: 0.38, down: true },
  { at: 4800, x: 0, y: 0.38, down: true },
  { at: 4800, x: 0, y: 0.38, down: false },
];

/** How long the demo takes before it starts over. */
export const DEMO_LOOP_MS = 5600;

/** The thumb at `at` milliseconds into the demo (any time: it loops). */
export function demoPose(at: number): DemoPose {
  const t = ((at % DEMO_LOOP_MS) + DEMO_LOOP_MS) % DEMO_LOOP_MS;
  let from = SCRIPT[0] as DemoKey;
  for (const key of SCRIPT) {
    if (key.at > t) {
      if (!from.down || !key.down) break;
      const share = (t - from.at) / (key.at - from.at);
      return {
        x: from.x + (key.x - from.x) * share,
        y: from.y + (key.y - from.y) * share,
        down: true,
      };
    }
    from = key;
  }
  return { x: from.x, y: from.y, down: from.down };
}
