import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';

/** Draws one picture into a context whose unit square is the tile's logical space. */
export type SpritePainter = (ctx: CanvasRenderingContext2D) => void;

/**
 * A square canvas at a chosen size with a caption under it — "64 px · real",
 * "2×" — for showing the same sprite at several sizes. The painter draws in a
 * logical space of `units` per side; the tile scales it to `size` CSS pixels
 * at the device's pixel ratio, so the picture stays crisp. Repaints whenever
 * an input changes.
 */
@Component({
  selector: 'lib-sprite-tile',
  template: `
    <figure class="tile">
      <canvas
        #canvas
        class="tile__canvas"
        [style.width.px]="size()"
        [style.height.px]="size()"
        aria-hidden="true"
      ></canvas>
      @if (label(); as text) {
        <figcaption class="tile__label">{{ text }}</figcaption>
      }
    </figure>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .tile {
      display: grid;
      gap: var(--space-1);
      justify-items: center;
      margin: 0;
    }
    .tile__canvas {
      display: block;
      border-radius: var(--radius-sm);
      background: #1b1f2a; /* the arena floor */
    }
    .tile__label {
      font-size: var(--font-size-xs);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpriteTileComponent {
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly paint = input.required<SpritePainter>();
  /** Rendered side, in CSS pixels. */
  readonly size = input(64);
  /** Side of the painter's logical space. */
  readonly units = input(64);
  readonly label = input<string | null>(null);

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.canvas().nativeElement;
      const size = this.size();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(canvas.width / this.units(), canvas.height / this.units());
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      this.paint()(ctx);
    });
  }
}
