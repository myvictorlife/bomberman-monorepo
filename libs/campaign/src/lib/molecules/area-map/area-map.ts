import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AreaId } from '@libs/game-core';
import { TranslatePipe } from '@ngx-translate/core';
import { StageView } from '../../+state/campaign.store';
import { stageKey } from '../../services/i18n-keys';
import { AREA_MAP_SPOTS } from './area-map-layouts';

/**
 * An area drawn as a little park map, its stages as stops along a path. The
 * art is per area (a `@case` in the template), the stops' places come from
 * {@link AREA_MAP_SPOTS}; the statuses come in with the stages.
 */
@Component({
  selector: 'lib-area-map',
  imports: [TranslatePipe],
  templateUrl: './area-map.html',
  styleUrls: ['./area-map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaMap {
  readonly areaId = input.required<AreaId>();
  readonly stages = input.required<readonly StageView[]>();
  readonly selectedId = input<string | null>(null);

  readonly picked = output<string>();

  /** The stages with their spot; empty when the area has no map yet. */
  readonly stops = computed(() => {
    const spots = AREA_MAP_SPOTS[this.areaId()];
    if (!spots) return [];
    return this.stages().flatMap((stage, i) => {
      const spot = spots[i];
      return spot ? [{ stage, spot }] : [];
    });
  });

  readonly stageKey = stageKey;
}
