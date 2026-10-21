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
import { MountId } from '@libs/game-core';
import { MOUNT_PORTRAIT_PAINTER } from '../../services/mount-painter';

/** The framed portrait of a mount, painted with the skin, for a card's head. */
@Component({
  selector: 'lib-mount-portrait',
  template:
    '<div #host class="portrait" [style.width.px]="size()" [style.height.px]="size()"></div>',
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MountPortrait {
  private readonly document = inject(DOCUMENT);
  private readonly paint = inject(MOUNT_PORTRAIT_PAINTER);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly mountId = input.required<MountId>();
  readonly size = input(48);

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.paint(this.document, this.mountId(), 0, this.size());
      canvas.setAttribute('aria-hidden', 'true');
      canvas.dataset['mount'] = this.mountId();
      // Inserted at runtime, so the component's scoped styles never reach it.
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.host().nativeElement.replaceChildren(canvas);
    });
  }
}
