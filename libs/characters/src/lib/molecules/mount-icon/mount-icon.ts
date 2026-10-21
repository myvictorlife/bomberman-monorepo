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
import { MOUNT_ICON_PAINTER } from '../../services/character-painter';

/** The framed portrait of a mount, for a roster card. */
@Component({
  selector: 'lib-mount-icon',
  template:
    '<div #host class="icon" [style.width.px]="size()" [style.height.px]="size()"></div>',
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MountIcon {
  private readonly document = inject(DOCUMENT);
  private readonly paint = inject(MOUNT_ICON_PAINTER);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly mountId = input.required<MountId>();
  readonly slot = input(0);
  readonly size = input(40);

  constructor() {
    afterRenderEffect(() => {
      const canvas = this.paint(
        this.document,
        this.mountId(),
        this.slot(),
        this.size(),
      );
      canvas.setAttribute('aria-hidden', 'true');
      canvas.dataset['mount'] = this.mountId();
      // Inserted at runtime, so the component's scoped styles never reach it.
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.host().nativeElement.replaceChildren(canvas);
    });
  }
}
