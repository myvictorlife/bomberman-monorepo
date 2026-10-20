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
import { CreatureSubject } from '@libs/game-client';
import { CREATURE_PAINTER } from '../../services/creature-painter';

/**
 * A creature or a boss, painted with the game's own art and scaled to `size`
 * CSS pixels. Painted at twice the size so it stays sharp on dense screens.
 */
@Component({
  selector: 'lib-creature-sprite',
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
export class CreatureSprite {
  private readonly document = inject(DOCUMENT);
  private readonly paint = inject(CREATURE_PAINTER);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly subject = input.required<CreatureSubject>();
  /** Rendered side, in CSS pixels. */
  readonly size = input(64);
  readonly flip = input(false);

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.paint(this.document, {
        subject: this.subject(),
        size: this.size() * 2,
        flip: this.flip(),
      });
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.host().nativeElement.replaceChildren(canvas);
    });
  }
}
