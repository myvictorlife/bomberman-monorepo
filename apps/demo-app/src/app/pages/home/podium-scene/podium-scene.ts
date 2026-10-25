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

const CONFETTI = ['#ffd36b', '#ff7aa8', '#7ad7ff', '#b38bff', '#ffffff'];

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The scene behind the podium: dusk, beams of light swinging down on the
 * winner, a ridge on the horizon and confetti falling. Decorative, and it
 * only animates while on screen.
 */
@Component({
  selector: 'app-podium-scene',
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: `
    :host {
      display: block;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PodiumSceneComponent {
  /** Whether confetti falls: on when someone is on the podium. */
  readonly celebrate = input(true);

  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const view = canvas.ownerDocument.defaultView;
      const ctx = canvas.getContext('2d');
      if (!view || !ctx) return;
      const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let w = 0;
      let h = 0;
      const resize = () => {
        const dpr = Math.min(view.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (still) paint(ctx, w, h, 3.2, this.celebrate());
      };

      const t0 = performance.now();
      let raf = 0;
      let onScreen = false;
      const frame = (now: number) => {
        raf = onScreen ? view.requestAnimationFrame(frame) : 0;
        paint(ctx, w, h, (now - t0) / 1000, this.celebrate());
      };

      const sized = new ResizeObserver(() => resize());
      sized.observe(canvas);
      const seen = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        if (onScreen && !raf && !still) raf = view.requestAnimationFrame(frame);
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
  celebrate: boolean,
): void {
  if (!w || !h) return;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1d1036');
  sky.addColorStop(0.55, '#4a2348');
  sky.addColorStop(1, '#a8582f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Beams from above the winner's step, swaying slowly.
  const cx = w / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,210,140,.06)';
  for (let k = 0; k < 7; k++) {
    const spread = (k - 3) * h * 0.32 + Math.sin(t * 0.4 + k) * h * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx, -h * 0.05);
    ctx.lineTo(cx + spread - 50, h * 1.1);
    ctx.lineTo(cx + spread + 90, h * 1.1);
    ctx.closePath();
    ctx.fill();
  }
  const halo = ctx.createRadialGradient(cx, h * 0.5, 0, cx, h * 0.5, h * 0.55);
  halo.addColorStop(0, 'rgba(255,200,120,.22)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // A low ridge on the horizon, behind the steps.
  ctx.fillStyle = '#2e1534';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) {
    const u = x / Math.max(w, 900);
    ctx.lineTo(
      x,
      h * 0.8 -
        h * 0.03 * (Math.sin(u * 5.3 + 5.5) + 0.5 * Math.sin(u * 13 + 2)),
    );
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  if (!celebrate) return;
  ctx.globalAlpha = 0.85;
  for (let k = 0; k < 70; k++) {
    const speed = 0.35 + hash(k) * 0.5;
    const y = ((t * speed * 80 + hash(k * 3) * h * 1.2) % (h * 1.2)) - h * 0.1;
    const x = hash(k * 9.1) * w + Math.sin(t + k) * 25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (1 + hash(k) * 3) + k);
    ctx.fillStyle = CONFETTI[k % CONFETTI.length] ?? '#fff';
    ctx.fillRect(-4, -2, 8, 4 * Math.abs(Math.cos(t * 3 + k)) + 1);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
