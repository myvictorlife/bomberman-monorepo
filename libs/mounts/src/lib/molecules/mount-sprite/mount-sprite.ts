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
import { MOUNT_SPRITE_PAINTER } from '../../services/mount-painter';

/**
 * One frame of a character riding a mount, painted with the game's own
 * painter and scaled to `size` CSS pixels. Repaints whenever an input changes.
 */
@Component({
  selector: 'lib-mount-sprite',
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
export class MountSprite {
  private readonly document = inject(DOCUMENT);
  private readonly paint = inject(MOUNT_SPRITE_PAINTER);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly mountId = input.required<MountId>();
  readonly riderId = input.required<CharacterId>();
  readonly facing = input<Direction>('down');
  readonly frame = input(0);
  /** Rendered side, in CSS pixels. */
  readonly size = input(64);

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.paint(this.document, {
        characterId: this.riderId(),
        facing: this.facing(),
        frame: this.frame(),
        mountId: this.mountId(),
        slot: 0,
        size: this.size(),
      });
      canvas.setAttribute('aria-hidden', 'true');
      canvas.dataset['mount'] = this.mountId();
      canvas.dataset['character'] = this.riderId();
      canvas.dataset['facing'] = this.facing();
      canvas.dataset['frame'] = String(this.frame());
      // Inserted at runtime, so the component's scoped styles never reach it.
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.host().nativeElement.replaceChildren(canvas);
    });
  }
}
