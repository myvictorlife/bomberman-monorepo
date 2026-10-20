import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AUTH } from '@libs/auth';
import { RouterLink } from '@angular/router';
import { START_KIT } from '@libs/game-core';
import {
  BadgeComponent,
  ButtonComponent,
  PlayerBadgesComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { CampaignStore } from '../../+state/campaign.store';
import { AreaMap } from '../../molecules/area-map/area-map';
import { CreatureSprite } from '../../molecules/creature-sprite/creature-sprite';
import { kitBadges } from '../../services/kit-view';
import { canEnterStages } from '../../services/stage-access';
import {
  areaKey,
  bossKey,
  creatureKey,
  stageKey,
} from '../../services/i18n-keys';

/** The campaign's front page: the areas, the map of one, the stage in focus. */
@Component({
  selector: 'lib-campaign',
  imports: [
    TranslatePipe,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    PlayerBadgesComponent,
    AreaMap,
    CreatureSprite,
  ],
  templateUrl: './campaign.html',
  styleUrls: ['./campaign.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Campaign {
  private readonly store = inject(CampaignStore);
  private readonly auth = inject(AUTH);

  /** Stages are played signed in: the map offers the sign-in in place of "play". */
  readonly canEnter = computed(() => canEnterStages(this.auth));
  readonly authReady = this.auth.ready;
  readonly authAvailable = this.auth.available;
  /** Signed in, but the address is not confirmed yet. */
  readonly unverified = computed(
    () => !!this.auth.user() && !this.auth.user()?.emailVerified,
  );
  readonly signingIn = signal(false);
  readonly signInFailed = signal(false);

  constructor() {
    void this.auth.initialize();
  }

  /** Google's window (or page): the account comes back signed in. */
  async signInWithGoogle(): Promise<void> {
    this.signingIn.set(true);
    this.signInFailed.set(false);
    try {
      await this.auth.signInWith('google');
    } catch (error) {
      if ((error as { code?: string }).code !== 'cancelled')
        this.signInFailed.set(true);
    } finally {
      this.signingIn.set(false);
    }
  }

  readonly areas = this.store.areas;
  readonly area = this.store.area;
  readonly stages = this.store.stages;
  readonly stage = this.store.stage;
  readonly selectArea = this.store.selectArea;
  readonly selectStage = this.store.selectStage;
  readonly kit = this.store.kit;
  readonly limits = this.store.limits;
  readonly lives = this.store.lives;
  readonly score = this.store.score;
  readonly best = this.store.best;
  readonly kitBadges = kitBadges;
  /** Where every stat starts: the left end of its meter. */
  readonly start = START_KIT;

  /** The four steps of "how it works", in order. */
  readonly how = [1, 2, 3, 4];

  readonly areaKey = areaKey;
  readonly stageKey = stageKey;
  readonly creatureKey = creatureKey;
  readonly bossKey = bossKey;

  /** How far a stat has grown, 0–100, from where everyone starts to its limit. */
  percent(value: number, start: number, limit: number): number {
    return Math.round(((value - start) / (limit - start)) * 100);
  }

  /** One bar per stage of an area: filled when cleared. */
  segments(total: number, cleared: number): boolean[] {
    return Array.from({ length: total }, (_, i) => i < cleared);
  }
}
