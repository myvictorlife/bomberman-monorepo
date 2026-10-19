import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  Champion,
  isGuestId,
  LobbyPhase,
  PLAYER_NAME_LENGTH,
  Seat,
} from '@libs/game-protocol';
import { ButtonComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/** Why the join button is off, as an i18n key under `ONLINE.QUEUE.BLOCKED`; `null` when it is on. */
export type JoinBlock = 'sign-in' | 'verify' | 'offline' | null;

/**
 * Who plays next, in order, and the button to get in line. While a round is
 * played, the first `outsiders` in line are on its border throwing bombs in.
 * Without an account, a name is enough to play as a guest — outside the
 * ranking. Presentational.
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
  /** I play this round out and then leave, instead of going back in line. */
  readonly leavingAfter = input(false);
  /** My name when I play as a guest; `null` with an account, or before choosing one. */
  readonly guest = input<string | null>(null);
  /** The round on screen counts for the ranking: two accounts or more in it. */
  readonly ranked = input(false);

  readonly join = output<void>();
  readonly leave = output<void>();
  /** `true`: leave when this round ends; `false`: stay after all. */
  readonly leaveAfterRound = output<boolean>();
  /** Play without an account, under this name. */
  readonly playAsGuest = output<string>();

  readonly guestName = signal('');
  readonly nameLength = PLAYER_NAME_LENGTH;
  readonly guestNameValid = computed(() => {
    const length = [...this.guestName().trim()].length;
    return length >= PLAYER_NAME_LENGTH.min && length <= PLAYER_NAME_LENGTH.max;
  });

  readonly position = computed(() => {
    const index = this.queue().findIndex((s) => s.id === this.myId());
    return index === -1 ? null : index + 1;
  });
  readonly inRound = computed(
    () =>
      this.phase() === 'playing' &&
      this.players().some((s) => s.id === this.myId()),
  );
  /** A player of the round being played or just decided: may leave once it ends. */
  readonly ofThisRound = computed(
    () =>
      (this.phase() === 'playing' || this.phase() === 'results') &&
      this.players().some((s) => s.id === this.myId()) &&
      this.position() === null,
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

  isGuest(seat: Seat): boolean {
    return isGuestId(seat.id);
  }

  read(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submitGuest(event: Event): void {
    event.preventDefault();
    if (this.guestNameValid()) this.playAsGuest.emit(this.guestName().trim());
  }

  characterKey(seat: Seat): string {
    return `CHARACTERS.${seat.characterId.toUpperCase()}.NAME`;
  }
}
