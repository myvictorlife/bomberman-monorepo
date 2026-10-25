import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { paintPowerUpIcon } from '@libs/game-client';
import { PowerUpKind } from '@libs/game-core';

const TAU = Math.PI * 2;
/** Radians per second the ring turns while nothing is pointed at. */
const SPIN = 0.45;
/** The angle at the front of the ring, nearest the viewer. */
const FRONT = Math.PI / 2;

/**
 * Every power-up circling an open crate, under a beam of light. Pointing at a
 * power-up's card (`active`) turns the ring until that one is at the front.
 * Decorative: the cards beside it carry the names and the rules.
 */
@Component({
  selector: 'app-power-up-orbit',
  template: '<canvas #canvas class="orbit" aria-hidden="true"></canvas>',
  styleUrl: './power-up-orbit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerUpOrbitComponent {
  readonly kinds = input.required<readonly PowerUpKind[]>();
  /** The power-up to bring to the front, or `null` to let the ring turn. */
  readonly active = input<PowerUpKind | null>(null);

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const view = canvas.ownerDocument.defaultView;
      const ctx = canvas.getContext('2d');
      if (!view || !ctx) return;
      const reduce = view.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const icons = this.kinds().map((kind) => {
        const icon = canvas.ownerDocument.createElement('canvas');
        paintPowerUpIcon(icon, kind);
        return icon;
      });

      let w = 0;
      let h = 0;
      const resize = () => {
        const dpr = Math.min(view.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      let rotation = 0;
      let last = performance.now();
      let raf = 0;
      let onScreen = false;
      const frame = (now: number) => {
        raf = onScreen ? view.requestAnimationFrame(frame) : 0;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const active = this.active();
        const index = active ? this.kinds().indexOf(active) : -1;
        if (index >= 0) {
          // Turn the short way round until the chosen icon is at the front.
          const target = FRONT - (index / icons.length) * TAU;
          const delta = Math.atan2(
            Math.sin(target - rotation),
            Math.cos(target - rotation),
          );
          rotation += delta * Math.min(1, dt * 8);
        } else if (!reduce) {
          rotation += dt * SPIN;
        }
        paint(ctx, w, h, now / 1000, rotation, icons, index, reduce);
      };

      const sized = new ResizeObserver(() => resize());
      sized.observe(canvas);
      // Only animate while the ring is on screen.
      const seen = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        if (onScreen && !raf) {
          last = performance.now();
          raf = view.requestAnimationFrame(frame);
        }
      });
      seen.observe(canvas);
      resize();
      destroyRef.onDestroy(() => {
        view.cancelAnimationFrame(raf);
        sized.disconnect();
        seen.disconnect();
      });
    });
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  rotation: number,
  icons: readonly HTMLCanvasElement[],
  active: number,
  still: boolean,
): void {
  ctx.clearRect(0, 0, w, h);
  if (!w || !h) return;
  const cx = w / 2;
  const cy = h * 0.58;
  const R = Math.min(w * 0.42, h * 0.75);
  const s = Math.min(R * 0.36, h * 0.3);

  // The beam the crate is lit by, then the rings of the orbit.
  const beam = ctx.createLinearGradient(0, 0, 0, cy);
  beam.addColorStop(0, 'rgba(60,200,180,0)');
  beam.addColorStop(1, 'rgba(60,200,180,.22)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.45, cy);
  ctx.lineTo(cx + s * 0.45, cy);
  ctx.lineTo(cx + s * 1.4, 0);
  ctx.lineTo(cx - s * 1.4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,200,180,.35)';
  ctx.lineWidth = 1;
  for (let k = 1; k <= 3; k++) {
    const r = R * (0.55 + k * 0.15);
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.3, r, r * 0.3, 0, 0, TAU);
    ctx.stroke();
  }

  const items = icons.map((icon, i) => {
    const a = rotation + (i / icons.length) * TAU;
    return { icon, i, a, depth: Math.sin(a) };
  });
  const front = items.filter((it) => it.depth >= 0);
  const back = items.filter((it) => it.depth < 0);
  const draw = (list: typeof items) => {
    for (const { icon, i, a, depth } of list.sort(
      (p, q) => p.depth - q.depth,
    )) {
      const lit = i === active;
      const size = s * (0.62 + depth * 0.22) * (lit ? 1.2 : 1);
      const bob = still ? 0 : Math.sin(t * 2 + a * 3) * s * 0.05;
      const x = cx + Math.cos(a) * R;
      const y = cy + depth * R * 0.3 + bob;
      ctx.globalAlpha = active >= 0 && !lit ? 0.45 : 0.7 + depth * 0.3;
      ctx.shadowColor = lit ? 'rgba(255,200,90,.9)' : 'rgba(60,200,180,.6)';
      ctx.shadowBlur = lit ? size * 0.6 : size * 0.3;
      ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };
  // Back half behind the crate, front half in front of it.
  draw(back);
  crate(ctx, cx - s / 2, cy - s * 0.55, s);
  draw(front);
}

function crate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.08);
  const wood = ctx.createLinearGradient(0, y, 0, y + s);
  wood.addColorStop(0, '#b0703f');
  wood.addColorStop(1, '#5a3220');
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,10,.55)';
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.06, y + (s * k) / 3);
    ctx.lineTo(x + s * 0.94, y + (s * k) / 3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x + s * 0.1, y + s * 0.1);
  ctx.lineTo(x + s * 0.9, y + s * 0.9);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,140,.25)';
  ctx.fillRect(x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.05);
}
