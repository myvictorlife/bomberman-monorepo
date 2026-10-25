import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { previewTextures, TEXTURE, TextureLookup } from '@libs/game-client';
import { Direction, FlameShape } from '@libs/game-core';

/** Seconds each rule plays before the board moves on to the next. */
export const RULE_SECONDS = 3.2;
const RULES = 4;
const COLS = 7;
const ROWS = 5;
/** Texture side, in texture pixels. */
const TILE = 64;
const FLAME_FRAMES = 5;
/** The skin's pose frames: placing a bomb, cheering, scared. */
const PLACE = 3;
const CHEER = 4;
const SCARED = 5;

type Cell = readonly [number, number];
type Flame = readonly [number, number, FlameShape];

const PILLARS: readonly Cell[] = [
  [1, 1],
  [3, 1],
  [5, 1],
  [1, 3],
  [3, 3],
  [5, 3],
];
const CRATES: readonly Cell[] = [
  [6, 4],
  [0, 4],
  [6, 0],
];
/** The crate the first blast breaks, hiding the power-up. */
const TARGET: Cell = [5, 2];

/** The first blast: from the middle, stopped by both pillars and the crate. */
const BLAST: readonly Flame[] = [
  [3, 2, 'center'],
  [2, 2, 'horizontal'],
  [1, 2, 'end-left'],
  [4, 2, 'horizontal'],
  [5, 2, 'end-right'],
];
/** The chain: the left bomb's row reaches the right bomb, which goes off too. */
const CHAIN_A: readonly Flame[] = [
  [1, 0, 'center'],
  [0, 0, 'end-left'],
  [2, 0, 'horizontal'],
  [3, 0, 'end-right'],
];
const CHAIN_B: readonly Flame[] = [
  [3, 0, 'center'],
  [4, 0, 'horizontal'],
  [5, 0, 'end-right'],
  [2, 0, 'end-left'],
];

interface Actor {
  slot: number;
  /** In cells, fractional while walking. */
  x: number;
  y: number;
  facing: Direction;
  frame: number;
  alpha?: number;
}

interface Frame {
  crate: boolean;
  powerUp: { x: number; y: number; scale: number; alpha: number } | null;
  bombs: { x: number; y: number }[];
  flames: { cells: readonly Flame[]; frame: number }[];
  actors: Actor[];
  /** A glow over the winner. */
  winner: Actor | null;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Where someone is along a path of cells at progress `p` (0–1), facing the way they go. */
function walk(
  path: readonly Cell[],
  p: number,
): Pick<Actor, 'x' | 'y' | 'facing' | 'frame'> {
  const legs = path.length - 1;
  const at = clamp(p) * legs;
  const i = Math.min(legs - 1, Math.floor(at));
  const f = at - i;
  const [x0, y0] = path[i] ?? [0, 0];
  const [x1, y1] = path[i + 1] ?? [x0, y0];
  const facing: Direction =
    x1 > x0 ? 'right' : x1 < x0 ? 'left' : y1 > y0 ? 'down' : 'up';
  const moving = p > 0 && p < 1;
  return {
    x: x0 + (x1 - x0) * f,
    y: y0 + (y1 - y0) * f,
    facing,
    frame: moving ? 1 + (Math.floor(at * 4) % 2) : 0,
  };
}

/** What the board shows at second `u` of rule `step`. Pure, so a held rule replays the same. */
export function ruleFrame(step: number, u: number): Frame {
  const flameFrame = (start: number, length: number) =>
    Math.min(
      FLAME_FRAMES - 1,
      Math.floor(((u - start) / length) * FLAME_FRAMES),
    );
  if (step === 0) {
    // Drop the bomb, step off it, and wait while it ticks.
    const placing = u < 0.6;
    const away = walk(
      [
        [3, 2],
        [2, 2],
        [2, 3],
      ],
      (u - 0.7) / 1.1,
    );
    return {
      crate: true,
      powerUp: null,
      bombs: u >= 0.45 ? [{ x: 3, y: 2 }] : [],
      flames: [],
      actors: [
        placing
          ? { slot: 0, x: 3, y: 2, facing: 'down', frame: u > 0.25 ? PLACE : 0 }
          : { slot: 0, ...away },
      ],
      winner: null,
    };
  }
  if (step === 1) {
    // The cross flares; stone holds, the crate breaks and shows what it hid.
    const burning = u < 1.3;
    return {
      crate: u < 0.55,
      powerUp:
        u >= 0.55
          ? { x: 5, y: 2, scale: clamp((u - 0.55) / 0.4), alpha: 1 }
          : null,
      bombs: [],
      flames: burning ? [{ cells: BLAST, frame: flameFrame(0, 1.3) }] : [],
      actors: [
        { slot: 0, x: 2, y: 3, facing: 'up', frame: burning ? SCARED : 0 },
      ],
      winner: null,
    };
  }
  if (step === 2) {
    // Walk over and pick the power-up up.
    const path: Cell[] = [
      [2, 3],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
    ];
    const me = walk(path, (u - 0.2) / 1.6);
    const got = u >= 1.8;
    return {
      crate: false,
      powerUp: got
        ? {
            x: 5,
            y: 2 - clamp((u - 1.8) / 0.6) * 0.6,
            scale: 1 + clamp((u - 1.8) / 0.6) * 0.4,
            alpha: 1 - clamp((u - 1.8) / 0.6),
          }
        : { x: 5, y: 2, scale: 1, alpha: 1 },
      bombs: [],
      flames: [],
      actors: [{ slot: 0, ...me, frame: got && u < 2.6 ? CHEER : me.frame }],
      winner: null,
    };
  }
  // A chain reaction catches the other player; the last one standing cheers.
  const caught = u >= 1.0;
  const rival: Actor = {
    slot: 2,
    x: 5,
    y: 0,
    facing: 'left',
    frame: u >= 0.7 ? SCARED : 0,
    alpha: caught ? 1 - clamp((u - 1.0) / 0.5) : 1,
  };
  const me: Actor = {
    slot: 0,
    x: 5,
    y: 2,
    facing: 'down',
    frame: u >= 1.6 ? CHEER : 0,
  };
  const flames: Frame['flames'] = [];
  if (u >= 0.6 && u < 1.6)
    flames.push({ cells: CHAIN_A, frame: flameFrame(0.6, 1.0) });
  if (u >= 0.85 && u < 1.85)
    flames.push({ cells: CHAIN_B, frame: flameFrame(0.85, 1.0) });
  return {
    crate: false,
    powerUp: null,
    bombs: [
      ...(u < 0.6 ? [{ x: 1, y: 0 }] : []),
      ...(u < 0.85 ? [{ x: 3, y: 0 }] : []),
    ],
    flames,
    actors: rival.alpha === 0 ? [me] : [rival, me],
    winner: u >= 1.6 ? me : null,
  };
}

/**
 * The four rules acted out on a slice of the arena, in the skin's own tiles:
 * drop a bomb, blow up a crate, grab what it hid, and win a chain reaction.
 * It plays them in turn and reports which one is on (`step`); setting
 * `active` holds the board on that rule.
 */
@Component({
  selector: 'app-rules-board',
  template: '<canvas #canvas></canvas>',
  styles: `
    :host {
      display: block;
    }
    canvas {
      display: block;
      width: 100%;
      aspect-ratio: 7 / 5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesBoardComponent {
  /** The rule to hold the board on, 0–3, or `null` to play them in turn. */
  readonly active = input<number | null>(null);
  /** The rule now playing. */
  readonly step = output<number>();

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);
    let repaint: (() => void) | null = null;
    // A still board (reduced motion) repaints only when the held rule changes.
    effect(() => {
      this.active();
      repaint?.();
    });

    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const view = canvas.ownerDocument.defaultView;
      const ctx = canvas.getContext('2d');
      if (!view || !ctx) return;
      const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tex = previewTextures(canvas.ownerDocument);

      const resize = () => {
        const dpr = Math.min(view.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
      };

      // The clock: free-running through the rules, or restarted on a held one.
      let clock = 0;
      let last = performance.now();
      let held: number | null = null;
      let shown = -1;
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const active = this.active();
        if (active !== held) {
          held = active;
          if (active !== null) clock = active * RULE_SECONDS;
        }
        if (!still) clock += dt;
        if (held !== null && clock >= (held + 1) * RULE_SECONDS)
          clock = held * RULE_SECONDS;
        clock %= RULES * RULE_SECONDS;
        const step = held ?? Math.floor(clock / RULE_SECONDS);
        const u = still ? RULE_SECONDS * 0.7 : clock - step * RULE_SECONDS;
        if (step !== shown) {
          shown = step;
          this.step.emit(step);
        }
        paint(
          ctx,
          canvas.width,
          canvas.height,
          tex,
          ruleFrame(step, u),
          now / 1000,
        );
      };

      let raf = 0;
      let onScreen = false;
      const loop = (now: number) => {
        raf = onScreen && !still ? view.requestAnimationFrame(loop) : 0;
        tick(now);
      };
      repaint = () => tick(performance.now());

      const sized = new ResizeObserver(() => {
        resize();
        tick(performance.now());
      });
      sized.observe(canvas);
      const seen = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        if (onScreen && !raf) {
          last = performance.now();
          raf = view.requestAnimationFrame(loop);
        }
      });
      seen.observe(canvas);
      destroyRef.onDestroy(() => {
        repaint = null;
        view.cancelAnimationFrame(raf);
        sized.disconnect();
        seen.disconnect();
      });
    });
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tex: TextureLookup,
  frame: Frame,
  t: number,
): void {
  if (!width || !height) return;
  const s = width / (COLS * TILE);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  const draw = (key: string, x: number, y: number, size = TILE, alpha = 1) => {
    const image = tex.get(key);
    if (!image) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      x * TILE + (TILE - size) / 2,
      y * TILE + (TILE - size) / 2,
      size,
      size,
    );
    ctx.globalAlpha = 1;
  };
  const solid = (c: number, r: number) =>
    PILLARS.some(([x, y]) => x === c && y === r) ||
    CRATES.some(([x, y]) => x === c && y === r) ||
    (frame.crate && TARGET[0] === c && TARGET[1] === r);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      draw(solid(c, r - 1) ? TEXTURE.floorShadow : TEXTURE.floor, c, r);
  for (const [c, r] of PILLARS) draw(TEXTURE.wall, c, r);
  for (const [c, r] of CRATES) draw(TEXTURE.block, c, r);
  if (frame.crate) draw(TEXTURE.block, TARGET[0], TARGET[1]);

  if (frame.powerUp) {
    const p = frame.powerUp;
    draw(TEXTURE.powerUp('fire'), p.x, p.y, TILE * 0.9 * p.scale, p.alpha);
  }
  const tickFrame = Math.floor(t * 4) % 2;
  for (const b of frame.bombs) {
    draw(TEXTURE.shadow, b.x, b.y + 0.3, TILE * 0.8, 0.6);
    draw(TEXTURE.bomb(tickFrame), b.x, b.y);
  }
  for (const flame of frame.flames)
    for (const [c, r, shape] of flame.cells)
      draw(TEXTURE.flame(shape, flame.frame), c, r);

  if (frame.winner) {
    const g = ctx.createRadialGradient(
      (frame.winner.x + 0.5) * TILE,
      (frame.winner.y + 0.5) * TILE,
      0,
      (frame.winner.x + 0.5) * TILE,
      (frame.winner.y + 0.5) * TILE,
      TILE * 1.4,
    );
    g.addColorStop(0, 'rgba(255,210,110,.55)');
    g.addColorStop(1, 'rgba(255,210,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
  }
  for (const a of frame.actors) {
    draw(TEXTURE.shadow, a.x, a.y + 0.35, TILE * 0.7, 0.5 * (a.alpha ?? 1));
    draw(
      TEXTURE.player(a.slot, a.facing, a.frame),
      a.x,
      a.y - 0.15,
      TILE,
      a.alpha ?? 1,
    );
  }
}
