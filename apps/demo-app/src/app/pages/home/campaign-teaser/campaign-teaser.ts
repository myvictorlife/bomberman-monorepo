import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { paintCharacterFrame, paintCreatureFrame } from '@libs/game-client';
import { CreatureId } from '@libs/game-core';

/** The first area's crowd, marching in from the right. */
const MARCH: readonly CreatureId[] = [
  'sauva',
  'pombo',
  'sauva',
  'caramujo',
  'sauva',
  'pombo',
];
/** Texture side the sprites are painted at; drawn smaller. */
const SPRITE = 160;

/**
 * The campaign's card picture: the first area's lawn, its creatures marching
 * in, the queen ant waiting at the end and two friends holding the line.
 * A painting with the game's own sprites, not a recorded match.
 */
@Component({
  selector: 'app-campaign-teaser',
  template: '<canvas #canvas></canvas>',
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
export class CampaignTeaserComponent {
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const doc = canvas.ownerDocument;
      const view = doc.defaultView;
      const ctx = canvas.getContext('2d');
      if (!view || !ctx) return;
      const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const creature = (id: CreatureId) =>
        paintCreatureFrame(doc, {
          subject: { creature: id },
          size: SPRITE,
          flip: true,
        });
      const cast = {
        march: MARCH.map(creature),
        queen: paintCreatureFrame(doc, {
          subject: { boss: 'rainha' },
          size: SPRITE * 2,
          flip: true,
        }),
        friends: [
          paintCharacterFrame(doc, {
            characterId: 'novato',
            facing: 'right',
            frame: 0,
            size: SPRITE,
          }),
          paintCharacterFrame(doc, {
            characterId: 'faisca',
            facing: 'right',
            frame: 0,
            slot: 1,
            size: SPRITE,
          }),
        ],
      };

      let w = 0;
      let h = 0;
      let dpr = 1;
      const resize = () => {
        dpr = Math.min(view.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      };

      const t0 = performance.now();
      let raf = 0;
      let onScreen = false;
      const frame = (now: number) => {
        raf = onScreen && !still ? view.requestAnimationFrame(frame) : 0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paint(ctx, w, h, still ? 1.5 : (now - t0) / 1000, cast);
      };

      const sized = new ResizeObserver(() => {
        resize();
        frame(performance.now());
      });
      sized.observe(canvas);
      const seen = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        if (onScreen && !raf) raf = view.requestAnimationFrame(frame);
      });
      seen.observe(canvas);
      destroyRef.onDestroy(() => {
        view.cancelAnimationFrame(raf);
        sized.disconnect();
        seen.disconnect();
      });
    });
  }
}

interface Cast {
  march: readonly HTMLCanvasElement[];
  queen: HTMLCanvasElement;
  friends: readonly HTMLCanvasElement[];
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  cast: Cast,
): void {
  if (!w || !h) return;
  const ground = h * 0.78;
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#163a63');
  sky.addColorStop(1, '#7fb7c9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, ground);
  // Far hedge, then the lawn in mown stripes.
  ctx.fillStyle = '#2f6b5c';
  ctx.beginPath();
  ctx.moveTo(0, ground);
  for (let x = 0; x <= w; x += 6) {
    ctx.lineTo(x, ground - h * 0.1 - Math.sin(x * 0.03) * h * 0.025);
  }
  ctx.lineTo(w, ground);
  ctx.closePath();
  ctx.fill();
  const stripe = w / 10;
  for (let k = 0; k < 10; k++) {
    ctx.fillStyle = k % 2 ? '#4f9a4a' : '#5aa852';
    ctx.fillRect(k * stripe, ground, stripe + 1, h - ground);
  }

  const s = h * 0.26;
  const stand = (
    image: HTMLCanvasElement,
    x: number,
    size: number,
    hop: number,
  ) => {
    ctx.fillStyle = 'rgba(20,40,20,.3)';
    ctx.beginPath();
    ctx.ellipse(
      x,
      ground + size * 0.06,
      size * 0.32,
      size * 0.08,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.drawImage(
      image,
      x - size / 2,
      ground - size + size * 0.08 - hop,
      size,
      size,
    );
  };

  // The queen waits at the far right, breathing.
  const breathe = Math.sin(t * 2) * s * 0.03;
  stand(cast.queen, w * 0.86, s * 2.1 + breathe, 0);
  // The march loops from the queen towards the friends.
  const span = w * 0.62;
  cast.march.forEach((image, i) => {
    const p = (t * 0.06 + i / cast.march.length) % 1;
    const x = w * 0.74 - p * span;
    const hop = Math.abs(Math.sin(t * 6 + i * 1.7)) * s * 0.12;
    ctx.globalAlpha = Math.min(1, p * 6, (1 - p) * 6);
    stand(image, x, s * 0.85, hop);
  });
  ctx.globalAlpha = 1;
  cast.friends.forEach((image, i) => {
    const hop = Math.abs(Math.sin(t * 3 + i * 2)) * s * 0.06;
    stand(image, w * (0.08 + i * 0.08), s * 1.15, hop);
  });
}
