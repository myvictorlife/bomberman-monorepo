import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Champion, LobbyPhase, Seat } from '@libs/game-protocol';
import { ButtonComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/** Why the join button is off, as an i18n key under `ONLINE.QUEUE.BLOCKED`; `null` when it is on. */
export type JoinBlock = 'sign-in' | 'verify' | 'offline' | null;

/**
 * Who plays next, in order, and the button to get in line. While a round is
 * played, the first `outsiders` in line are on its border throwing bombs in.
 * Presentational.
 */
@Component({
  selector: 'lib-queue-panel',
  imports: [TranslatePipe, ButtonComponent],
  templateUrl: './queue-panel.html',
  styleUrls: ['./queue-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueuePanelComponent {
  readonly phase = input<LobbyPhase>('waiting');
  readonly queue = input<Seat[]>([]);
  readonly players = input<Seat[]>([]);
  readonly maxPlayers = input(5);
  /** How many of the queue stand outside the arena during a round; 0 for none. */
  readonly outsiders = input(0);
  readonly myId = input<string | null>(null);
  readonly blocked = input<JoinBlock>(null);
  /** The last round's winner, keeping a seat for the next: crowned, with their wins in a row. */
  readonly champion = input<Champion | null>(null);

  readonly join = output<void>();
  readonly leave = output<void>();

  readonly position = computed(() => {
    const index = this.queue().findIndex((s) => s.id === this.myId());
    return index === -1 ? null : index + 1;
  });
  readonly inRound = computed(
    () =>
      this.phase() === 'playing' &&
      this.players().some((s) => s.id === this.myId()),
  );
  /** Queued within the first `maxPlayers`: plays the next round. */
  readonly nextUp = computed(() => {
    const position = this.position();
    return position !== null && position <= this.maxPlayers();
  });
  /** On the border of the round in progress, throwing bombs in. */
  readonly outside = computed(() => this.isOutside(this.position()));

  /** Whether the `position`-th in line (1-based) is on the border right now. */
  isOutside(position: number | null): boolean {
    return (
      this.phase() === 'playing' &&
      position !== null &&
      position <= this.outsiders()
    );
  }

  characterKey(seat: Seat): string {
    return `CHARACTERS.${seat.characterId.toUpperCase()}.NAME`;
  }
}
