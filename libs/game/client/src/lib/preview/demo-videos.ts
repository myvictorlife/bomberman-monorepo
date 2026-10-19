import { TICK_RATE } from '@libs/game-core';
import { demoScene, ModeDemo } from './demo-scenes';
import { FramePainter, paintRankingDemo } from './frame-painter';

/** Half the skin's tile: a card's picture needs no more, and paints four times cheaper. */
const SCALE = 0.5;
const TILE = 64 * SCALE;
/** A frame never catches up more than this: a tab coming back does not fast-forward. */
const MAX_TICKS_PER_FRAME = 4;
interface Video {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  demo: ModeDemo | null;
  painter: FramePainter | null;
  visible: boolean;
}

/**
 * The little videos of the pages around the game. Each canvas carries
 * `data-video`: a key of {@link demoScene} (`local`, `online`, `arena:<id>`),
 * played by the rules at the tick rate and painted with the skin, or
 * `ranking`, a picture of the leaderboard moving. Only the canvases on screen
 * are painted; with reduced motion each shows one still.
 */
export class DemoVideos {
  private readonly videos: Video[] = [];
  private frame = 0;
  private last = 0;
  private carry = 0;
  private readonly observer: IntersectionObserver | null;
  private readonly still: boolean;

  constructor(
    canvases: readonly HTMLCanvasElement[],
    private readonly now = () => performance.now(),
  ) {
    this.still =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    this.observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            for (const entry of entries) {
              const video = this.videos.find((v) => v.canvas === entry.target);
              if (video) video.visible = entry.isIntersecting;
            }
          })
        : null;
    for (const canvas of canvases) {
      const video = this.setUp(canvas);
      if (!video) continue;
      this.videos.push(video);
      this.observer?.observe(canvas);
    }
    if (this.still) {
      for (const video of this.videos) this.paintStill(video);
      return;
    }
    this.last = this.now();
    this.frame = requestAnimationFrame(() => this.tick());
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
  }

  private setUp(canvas: HTMLCanvasElement): Video | null {
    const id = canvas.dataset['video'] ?? '';
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scene = id === 'ranking' ? null : demoScene(id);
    if (scene) {
      const demo = new ModeDemo(scene);
      canvas.width = demo.state.cols * TILE;
      canvas.height = demo.state.rows * TILE;
      return {
        canvas,
        ctx,
        demo,
        painter: new FramePainter(canvas.ownerDocument, scene.mapId, {
          quickMoments: true,
        }),
        visible: true,
      };
    }
    canvas.width = 15 * TILE;
    canvas.height = 13 * TILE;
    return { canvas, ctx, demo: null, painter: null, visible: true };
  }

  private paintStill(video: Video): void {
    if (video.demo) {
      const at = video.demo.scene.stillAt ?? 0;
      while (video.demo.state.tick < at) video.demo.step();
    }
    this.paint(video, 7);
  }

  private tick(): void {
    const now = this.now();
    this.carry += ((now - this.last) / 1000) * TICK_RATE;
    this.last = now;
    const ticks = Math.min(MAX_TICKS_PER_FRAME, Math.floor(this.carry));
    this.carry -= ticks;
    for (const video of this.videos) {
      if (!video.visible) continue;
      for (let i = 0; i < ticks; i++) video.demo?.step();
      if (ticks > 0 || !video.demo) this.paint(video, now / 1000);
    }
    this.frame = requestAnimationFrame(() => this.tick());
  }

  private paint(video: Video, seconds: number): void {
    const { ctx, canvas } = video;
    if (video.demo && video.painter) {
      ctx.save();
      ctx.scale(SCALE, SCALE);
      video.painter.paint(ctx, video.demo.state);
      ctx.restore();
    } else {
      paintRankingDemo(ctx, canvas.width, canvas.height, seconds);
    }
  }
}
