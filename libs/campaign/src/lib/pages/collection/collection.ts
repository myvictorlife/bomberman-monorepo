import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { findBoss, findCreature } from '@libs/game-core';
import {
  BadgeComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { CampaignStore, CollectionTab } from '../../+state/campaign.store';
import { CreatureSprite } from '../../molecules/creature-sprite/creature-sprite';
import { areaKey, bossKey, creatureKey } from '../../services/i18n-keys';

/**
 * Every boss and creature of the campaign. What the player has not reached
 * yet stays a silhouette with its area's name, so the page also says what is
 * still to come.
 */
@Component({
  selector: 'lib-campaign-collection',
  imports: [
    TranslatePipe,
    RouterLink,
    BadgeComponent,
    SegmentedControlComponent,
    CreatureSprite,
  ],
  templateUrl: './collection.html',
  styleUrls: ['./collection.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Collection {
  private readonly store = inject(CampaignStore);

  readonly tab = this.store.tab;
  readonly setTab = this.store.setTab;
  readonly bosses = this.store.bosses;
  readonly creatures = this.store.creatures;
  readonly bossesKnown = this.store.bossesKnown;
  readonly creaturesKnown = this.store.creaturesKnown;

  readonly tabs: readonly SegmentedControlOption<CollectionTab>[] = [
    { value: 'bosses', labelKey: 'COLLECTION.BOSSES' },
    { value: 'creatures', labelKey: 'COLLECTION.CREATURES' },
  ];

  readonly areaKey = areaKey;
  readonly bossKey = bossKey;
  readonly creatureKey = creatureKey;

  readonly boss = findBoss;
  readonly creature = findCreature;
}
