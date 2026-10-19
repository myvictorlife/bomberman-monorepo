import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HudPlayer } from '@libs/game-client';
import { PlayerBadgesComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Who is in the round and what each one has picked up so far: bombs, fire,
 * speed, the one-off items and the mount. Presentational — fed the arena's HUD
 * snapshot, which only changes when a number does.
 */
@Component({
  selector: 'lib-players-panel',
  imports: [TranslatePipe, PlayerBadgesComponent],
  templateUrl: './players-panel.html',
  styleUrls: ['./players-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.compact]': 'compact()' },
})
export class PlayersPanelComponent {
  readonly players = input<HudPlayer[]>([]);
  /** One colour per slot, from the skin. */
  readonly colors = input<readonly string[]>([]);
  readonly myId = input<string | null>(null);
  /** One row of small pills over the arena instead of a titled card. */
  readonly compact = input(false);
}
