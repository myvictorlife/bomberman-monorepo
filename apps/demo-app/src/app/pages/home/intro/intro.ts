import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ANALYTICS } from '@libs/analytics';
import { paintCharacterFrame } from '@libs/game-client';
import { TranslatePipe } from '@ngx-translate/core';
import { NARROW_WIDTH, paintIntro } from './intro-scene';

/** Side of the painted Novato, in CSS pixels; the scene scales it down. */
const SPRITE_SIZE = 220;
/** How much the copy lags the scroll, for depth; phones keep it still, low on the screen. */
const COPY_DRIFT = 0.15;

/**
 * The first screen of the title page: a painted dusk scene that fills the
 * window, the name and the way in. Scrolling away drifts the far layers
 * slower than the near ones. The text is ordinary HTML over the canvas.
 */
@Component({
  selector: 'app-intro',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './intro.html',
  styleUrl: './intro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntroComponent {
  private readonly analytics = inject(ANALYTICS);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly copy = viewChild.required<ElementRef<HTMLElement>>('copy');

  trackPlay(): void {
    this.analytics.logEvent('play_click', { mode: 'online', from: 'intro' });
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const doc = canvas.ownerDocument;
      const view = doc.defaultView;
      const ctx = canvas.getContext('2d');
      if (!view || !ctx) return;
      const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const hero = paintCharacterFrame(doc, {
        characterId: 'novato',
        facing: 'down',
        frame: 0,
        size: SPRITE_SIZE,
      });

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
      let rest: number | null = null;
      const frame = (now: number) => {
        raf = onScreen && !still ? view.requestAnimationFrame(frame) : 0;
        // How far the section has scrolled up since it was first seen at rest.
        const top = this.host.nativeElement.getBoundingClientRect().top;
        rest ??= top;
        const off = still ? 0 : Math.min(0, top - rest);
        const drift = w < NARROW_WIDTH ? 0 : -off * COPY_DRIFT;
        this.copy().nativeElement.style.transform = `translate3d(0, ${drift}px, 0)`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        paintIntro({
          ctx,
          w,
          h,
          t: still ? 3.2 : (now - t0) / 1000,
          off,
          hero,
        });
      };

      const sized = new ResizeObserver(() => {
        resize();
        if (still) frame(performance.now());
      });
      sized.observe(canvas);
      const seen = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? false;
        if (onScreen && !raf) raf = view.requestAnimationFrame(frame);
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
