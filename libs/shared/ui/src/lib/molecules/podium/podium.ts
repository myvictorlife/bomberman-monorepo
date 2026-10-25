import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChildren,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** One line of a ranking, as any page has it: who, how many wins, and the face they wear. */
export interface PodiumLine {
  id: string;
  name: string;
  wins: number;
  matches: number;
  characterId?: string;
  /** The colour they picked, by the game's id; absent paints the place's colour. */
  color?: string;
}

/**
 * Paints a character into a 64-unit square context. The podium knows nothing
 * of the game's art; the page hands it the painter.
 */
export type PodiumPainter = (
  ctx: CanvasRenderingContext2D,
  characterId: string | undefined,
  place: number,
  color?: string,
) => void;

export interface PodiumStep extends PodiumLine {
  /** 1, 2 or 3. */
  place: number;
  /** Wins over matches, 0–100. */
  rate: number;
  /** The joke title that comes with the place. */
  titleKey: string;
  /** A second line earned by the numbers. */
  tagKey: string;
}

/**
 * `card` frames each face in a medallion over themed steps, for any surface.
 * `stage` stands the characters on solid steps, for a dark scene painted
 * behind the podium (the title screen's): its colours are fixed, not themed.
 */
export type PodiumVariant = 'card' | 'stage';

/** The podium's own order: the winner in the middle, flanked by the other two. */
const DISPLAY_ORDER = [2, 1, 3];
/** Logical size of a character sprite; the canvas is drawn at a multiple of it. */
const SPRITE_UNITS = 64;

/** The top three of a ranking, with the titles their places and numbers earn them. */
export function toPodium(list: readonly PodiumLine[]): PodiumStep[] {
  return list.slice(0, 3).map((entry, i) => {
    const rate =
      entry.matches > 0 ? Math.round((entry.wins / entry.matches) * 100) : 0;
    return {
      ...entry,
      place: i + 1,
      rate,
      titleKey: `PODIUM.TITLE_${i + 1}`,
      tagKey:
        rate >= 70
          ? 'PODIUM.TAG_RUTHLESS'
          : rate >= 40
            ? 'PODIUM.TAG_DANGEROUS'
            : 'PODIUM.TAG_STUBBORN',
    };
  });
}

/**
 * A podium: the first three of a ranking on three steps, the winner's in the
 * middle and tallest, each with their character, a joke title by place and a
 * line earned by the win rate. Presentational — give it the lines and a
 * painter for the faces; it shows nothing with fewer than one.
 */
@Component({
  selector: 'lib-podium',
  imports: [TranslatePipe],
  templateUrl: './podium.html',
  styleUrls: ['./podium.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.podium--stage]': "variant() === 'stage'" },
})
export class PodiumComponent {
  private readonly sprites =
    viewChildren<ElementRef<HTMLCanvasElement>>('sprite');

  /** The ranking, best first; only the first three are shown. */
  readonly entries = input<readonly PodiumLine[]>([]);
  readonly paint = input.required<PodiumPainter>();
  /** Canvas side in device pixels; the CSS size comes from the layout. */
  readonly size = input(192);
  /** Highlights this player's step. */
  readonly myId = input<string | null>(null);
  readonly variant = input<PodiumVariant>('card');

  readonly steps = computed(() => {
    const top = toPodium(this.entries());
    return DISPLAY_ORDER.map(
      (place) => top.find((e) => e.place === place) ?? null,
    );
  });

  constructor() {
    // Paints each face once its canvas exists, again only when the face changes.
    afterRenderEffect(() => {
      const paint = this.paint();
      for (const sprite of this.sprites()) {
        const canvas = sprite.nativeElement;
        const key = `${canvas.dataset['character'] ?? ''}:${canvas.dataset['color'] ?? ''}@${canvas.dataset['place']}`;
        if (canvas.dataset['painted'] === key) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const size = canvas.width;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.scale(size / SPRITE_UNITS, size / SPRITE_UNITS);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        paint(
          ctx,
          canvas.dataset['character'] || undefined,
          Number(canvas.dataset['place'] ?? 1),
          canvas.dataset['color'] || undefined,
        );
        canvas.dataset['painted'] = key;
      }
    });
  }
}
