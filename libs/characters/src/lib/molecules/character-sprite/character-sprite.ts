import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { CharacterId, Direction, MountId } from '@libs/game-core';
import { CHARACTER_PAINTER } from '../../services/character-painter';

/**
 * One frame of a character, painted with the game's own painter and scaled to
 * `size` CSS pixels. Repaints whenever an input changes.
 */
@Component({
  selector: 'lib-character-sprite',
  template:
    '<div #host class="sprite" [style.width.px]="size()" [style.height.px]="size()"></div>',
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterSprite {
  private readonly document = inject(DOCUMENT);
  private readonly paint = inject(CHARACTER_PAINTER);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly characterId = input.required<CharacterId>();
  readonly facing = input<Direction>('down');
  readonly frame = input(0);
  /** Riding this mount; `null` is on foot. */
  readonly mountId = input<MountId | null>(null);
  /** Player slot, 0–3: picks the team colour. */
  readonly slot = input(0);
  /** Rendered side, in CSS pixels. */
  readonly size = input(64);

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.paint(this.document, {
        characterId: this.characterId(),
        facing: this.facing(),
        frame: this.frame(),
        mountId: this.mountId(),
        slot: this.slot(),
        size: this.size(),
      });
      canvas.setAttribute('aria-hidden', 'true');
      canvas.dataset['character'] = this.characterId();
      canvas.dataset['facing'] = this.facing();
      canvas.dataset['frame'] = String(this.frame());
      canvas.dataset['mount'] = this.mountId() ?? 'none';
      // Inserted at runtime, so the component's scoped styles never reach it.
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.host().nativeElement.replaceChildren(canvas);
    });
  }
}
