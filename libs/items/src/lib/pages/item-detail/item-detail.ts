import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ARROW_KEYS,
  EGG_STAGES,
  itemMoments,
  KeyBindings,
  QuipMoment,
  QUIPS,
  SoundEffect,
  WASD_KEYS,
} from '@libs/game-client';
import { MOUNTS, PowerUpKind } from '@libs/game-core';
import {
  ButtonComponent,
  ShowcaseComponent,
  ShowcaseNoteComponent,
  ShowcaseSectionComponent,
  SpritePainter,
  SpriteTileComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { ItemsStore } from '../../+state/items.store';
import { hatchStage } from '../../items';
import { ITEM_AUDIO, itemEffects } from '../../services/item-audio';
import { ITEM_PAINTER } from '../../services/item-painter';

/** How a Phaser key name reads on a keycap. */
const KEY_CAPS: Record<string, string> = {
  SPACE: 'Space',
  ENTER: 'Enter',
  SHIFT: 'Shift',
  CTRL: 'Ctrl',
  FORWARD_SLASH: '/',
};

export function keyCap(code: string): string {
  return KEY_CAPS[code] ?? code;
}

/** The keys an item needs, by player: the remote's detonate button, the egg's mount ability. */
export function itemKeys(
  kind: PowerUpKind,
): { labelKey: string; caps: string[]; hintKey?: string }[] {
  const binding = (key: keyof KeyBindings) =>
    [WASD_KEYS, ARROW_KEYS].map((k) => keyCap(k[key]));
  if (kind === 'remote')
    return [
      {
        labelKey: 'ITEMS.KEY_DETONATE',
        caps: binding('detonate'),
        hintKey: 'ITEMS.KEYS_HINT',
      },
    ];
  if (kind === 'egg')
    return [{ labelKey: 'ITEMS.KEY_ABILITY', caps: binding('ability') }];
  if (kind === 'glove')
    return [
      {
        labelKey: 'ITEMS.KEY_GLOVE',
        caps: binding('bomb'),
        hintKey: 'ITEMS.KEY_GLOVE_HINT',
      },
    ];
  return [];
}

/**
 * One item up close: the big picture (the egg wobbles, and hatches on
 * request), what it does, the sprite at the arena's size and zoomed, the
 * egg's crack stages, and the decisions behind it.
 */
@Component({
  selector: 'lib-item-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    ShowcaseComponent,
    ShowcaseSectionComponent,
    ShowcaseNoteComponent,
    SpriteTileComponent,
  ],
  templateUrl: './item-detail.html',
  styleUrls: ['./item-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetail {
  private readonly store = inject(ItemsStore);
  private readonly paint = inject(ITEM_PAINTER);
  private readonly audio = inject(ITEM_AUDIO);
  private readonly hatchStartedAt = signal<number | null>(null);
  /** Milliseconds of animation; only the egg's stage advances it. */
  private readonly clock = signal(0);

  /** The guard on the route guarantees a known id. */
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get(
    'id',
  ) as PowerUpKind;
  readonly isEgg = this.id === 'egg';
  readonly others = this.store.items().filter((i) => i !== this.id);
  readonly mounts = MOUNTS.map((m) => m.id);
  readonly stages = Array.from({ length: EGG_STAGES }, (_, i) => i);
  readonly notes = [1, 2, 3].map(
    (n) => `ITEMS.${this.id.toUpperCase()}.NOTE_${n}`,
  );
  readonly effects = itemEffects(this.id);
  readonly keys = itemKeys(this.id);
  readonly moments = itemMoments(this.id);
  readonly quips = QUIPS;
  readonly sizes = [
    { px: 64, labelKey: 'ITEMS.SIZE_REAL' },
    { px: 128, labelKey: 'ITEMS.SIZE_2X' },
    { px: 192, labelKey: 'ITEMS.SIZE_3X' },
  ];

  /** How cracked the egg on the stage is right now. */
  readonly stage = computed(() => {
    const started = this.hatchStartedAt();
    return started === null
      ? 0
      : hatchStage(this.clock() - started, EGG_STAGES);
  });

  /** The stage painter: the egg wobbles with the clock, the others hold still. */
  readonly stagePainter = computed<SpritePainter>(() => {
    const stage = this.stage();
    const tilt = this.isEgg
      ? Math.sin(((this.clock() / 1000) * Math.PI * 2) / 1.1) *
        (0.06 + stage * 0.03)
      : 0;
    return (ctx) => this.paint(ctx, this.id, { stage, tilt });
  });

  constructor() {
    this.store.select(this.id);
    inject(DestroyRef).onDestroy(() => {
      this.audio.voice.close();
      this.audio.sfx.close();
    });
    if (this.isEgg && typeof requestAnimationFrame === 'function') {
      // The egg is alive: a frame loop drives its wobble and its hatching.
      let frame = 0;
      const step = (now: number) => {
        this.tick(now);
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      inject(DestroyRef).onDestroy(() => cancelAnimationFrame(frame));
    }
  }

  /** Advances the animation clock to `now` (milliseconds). */
  tick(now: number): void {
    this.clock.set(now);
  }

  playEffect(effect: SoundEffect): void {
    this.audio.sfx.play(effect);
  }

  say(line: string): void {
    this.audio.voice.speak(line);
  }

  effectKey(effect: SoundEffect): string {
    return `ITEMS.EFFECT_${effect.toUpperCase().replace(/-/g, '_')}`;
  }

  momentKey(moment: QuipMoment): string {
    return `SOUNDS.MOMENT_${moment.toUpperCase().replace(/-/g, '_')}`;
  }

  hatch(): void {
    this.hatchStartedAt.set(this.clock());
  }

  itemKey(
    field: 'NAME' | 'EFFECT' | 'DESC',
    id: PowerUpKind = this.id,
  ): string {
    return `ITEMS.${id.toUpperCase()}.${field}`;
  }

  mountKey(id: string): string {
    return `MOUNTS.${id.toUpperCase()}.NAME`;
  }

  /** A still of this item, or of the egg at a crack stage. */
  still(stage = 0): SpritePainter {
    return (ctx) => this.paint(ctx, this.id, { stage });
  }
}
