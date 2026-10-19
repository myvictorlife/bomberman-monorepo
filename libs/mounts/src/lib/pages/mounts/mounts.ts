import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Direction, MountId } from '@libs/game-core';
import { BadgeComponent, ButtonComponent, CardComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { MountsStore } from '../../+state/mounts.store';
import { MountPortrait } from '../../molecules/mount-portrait/mount-portrait';
import { MountSprite } from '../../molecules/mount-sprite/mount-sprite';
import { MOUNT_VIDEOS } from '../../services/mount-videos';

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

/**
 * The mounts, the way the roster page shows the characters: the list on one
 * side, and on the other the chosen mount on a stage — ridden by your
 * character, turned by a click, the eight poses around it — with a little
 * video of its ability played by the rules themselves (`mount:<id>` scenes),
 * the ability's numbers, and the story.
 */
@Component({
  selector: 'lib-mounts',
  imports: [
    TranslatePipe,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    MountPortrait,
    MountSprite,
  ],
  templateUrl: './mounts.html',
  styleUrls: ['./mounts.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Mounts {
  private readonly store = inject(MountsStore);
  private readonly play = inject(MOUNT_VIDEOS);
  private readonly videos =
    viewChildren<ElementRef<HTMLCanvasElement>>('video');

  readonly mounts = this.store.mounts;
  readonly selected = this.store.selected;
  readonly riderId = this.store.riderId;
  readonly facing = this.store.facing;
  readonly walking = this.store.walking;
  readonly frame = this.store.frame;
  readonly walkFrame = this.store.walkFrame;

  readonly poses = POSE_RING;

  readonly select = this.store.select;
  readonly turn = this.store.turn;
  readonly strike = this.store.pose;
  readonly toggleWalking = this.store.toggleWalking;

  constructor() {
    // The walk preview ticks only while it is on; the effect clears the timer
    // when walking stops or the page is left.
    effect((onCleanup) => {
      if (!this.store.walking()) return;
      const timer = setInterval(() => this.store.stepWalk(), WALK_STEP_MS);
      onCleanup(() => clearInterval(timer));
    });
    // Canvas only exists in a browser: every mount's video is in the page and
    // only the one on show is painted; they start after the first paint and
    // stop with the page.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const videos = this.play(this.videos().map((v) => v.nativeElement));
      destroyRef.onDestroy(() => videos.stop());
    });
  }

  key(
    id: MountId,
    field: 'NAME' | 'STORY' | 'ABILITY' | 'ABILITY_DESC',
  ): string {
    return `MOUNTS.${id.toUpperCase()}.${field}`;
  }

  characterKey(id: string): string {
    return `CHARACTERS.${id.toUpperCase()}.NAME`;
  }

  facingKey(facing: Direction): string {
    return `MOUNTS.FACING_${facing.toUpperCase()}`;
  }

  isActive(pose: Pose): boolean {
    return pose.facing === this.facing() && pose.walking === this.walking();
  }
}
