import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BASE_SPEED,
  Direction,
  START_BOMBS,
  START_FIRE,
} from '@libs/game-core';
import { BadgeComponent, ButtonComponent, CardComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { CharactersStore } from '../../+state/characters.store';
import { CharacterSprite } from '../../molecules/character-sprite/character-sprite';
import { MountIcon } from '../../molecules/mount-icon/mount-icon';

/** How long each step of the walk preview lasts. */
export const WALK_STEP_MS = 140;

export interface Pose {
  facing: Direction;
  walking: boolean;
  /** Where it sits around the stage: a compass point. */
  cell: 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
}

/**
 * The eight poses around the stage, in reading order. The sides stand at the
 * compass points; each corner walks the side that follows it clockwise.
 */
export const POSE_RING: readonly Pose[] = [
  { facing: 'up', walking: true, cell: 'nw' },
  { facing: 'up', walking: false, cell: 'n' },
  { facing: 'right', walking: true, cell: 'ne' },
  { facing: 'left', walking: false, cell: 'w' },
  { facing: 'right', walking: false, cell: 'e' },
  { facing: 'left', walking: true, cell: 'sw' },
  { facing: 'down', walking: false, cell: 's' },
  { facing: 'down', walking: true, cell: 'se' },
];

@Component({
  selector: 'lib-characters',
  imports: [
    TranslatePipe,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CharacterSprite,
    MountIcon,
  ],
  templateUrl: './characters.html',
  styleUrls: ['./characters.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Characters {
  private readonly store = inject(CharactersStore);

  readonly groups = this.store.groups;
  readonly selected = this.store.selected;
  readonly facing = this.store.facing;
  readonly walking = this.store.walking;
  readonly mountId = this.store.mountId;
  readonly mounts = this.store.mounts;
  readonly frame = this.store.frame;
  readonly walkFrame = this.store.walkFrame;

  readonly poses = POSE_RING;
  /** Every character plays by the base numbers for now. */
  readonly stats = { bombs: START_BOMBS, fire: START_FIRE, speed: BASE_SPEED };

  readonly select = this.store.select;
  readonly turn = this.store.turn;
  readonly strike = this.store.pose;
  readonly toggleWalking = this.store.toggleWalking;
  readonly setMount = this.store.setMount;

  constructor() {
    // The walk preview ticks only while it is on; the effect clears the timer
    // when walking stops or the page is left.
    effect((onCleanup) => {
      if (!this.store.walking()) return;
      const timer = setInterval(() => this.store.stepWalk(), WALK_STEP_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  characterKey(id: string, field: 'NAME' | 'JOB' | 'STORY'): string {
    return `CHARACTERS.${id.toUpperCase()}.${field}`;
  }

  mountKey(
    id: string,
    field: 'NAME' | 'STORY' | 'ABILITY' | 'ABILITY_DESC',
  ): string {
    return `MOUNTS.${id.toUpperCase()}.${field}`;
  }

  groupKey(id: string): string {
    return `CHARACTER_GROUPS.${id.toUpperCase()}`;
  }

  facingKey(facing: Direction): string {
    return `CHARACTERS.FACING_${facing.toUpperCase()}`;
  }

  isActive(pose: Pose): boolean {
    return pose.facing === this.facing() && pose.walking === this.walking();
  }
}
