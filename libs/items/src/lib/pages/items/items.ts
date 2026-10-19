import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PowerUpKind } from '@libs/game-core';
import { ButtonComponent, SpritePainter, SpriteTileComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { ItemsStore } from '../../+state/items.store';
import { ITEM_AUDIO, itemEffects } from '../../services/item-audio';
import { ITEM_PAINTER } from '../../services/item-painter';

/** The item gallery: one card per item, each a door to its detail page. */
@Component({
  selector: 'lib-items',
  imports: [TranslatePipe, RouterLink, ButtonComponent, SpriteTileComponent],
  templateUrl: './items.html',
  styleUrls: ['./items.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Items {
  private readonly store = inject(ItemsStore);
  private readonly paint = inject(ITEM_PAINTER);
  private readonly audio = inject(ITEM_AUDIO);

  readonly items = this.store.items;
  readonly selected = this.store.selected;
  readonly select = this.store.select;

  /** The item's pick-up sound — the egg's is its hatch. */
  hear(id: PowerUpKind): void {
    const effect = itemEffects(id)[0];
    if (effect) this.audio.sfx.play(effect);
  }

  itemKey(id: string, field: 'NAME' | 'EFFECT'): string {
    return `ITEMS.${id.toUpperCase()}.${field}`;
  }

  sprite(id: PowerUpKind): SpritePainter {
    return (ctx) => this.paint(ctx, id);
  }
}
