import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { livesOf, stageCode } from '@libs/game-core';
import { LobbyPhase, Seat, StageLobby } from '@libs/game-protocol';
import { ButtonComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/** A stage's i18n name key, as the campaign's catalogue names it: `gramado-1` → `STAGES.GRAMADO_1.NAME`. */
export function stageNameKey(stageId: string): string {
  return `STAGES.${stageId.toUpperCase().replace(/-/g, '_')}.NAME`;
}

/** One player of the team, as the panel lists them. */
export interface TeamRow {
  id: string;
  name: string;
  lives: number;
  score: number;
  host: boolean;
}

/**
 * The stages room's own card: which stage the team plays, who hosts, and —
 * for the host — the stage picker and the button that starts at once
 * instead of waiting for more people. Below, the team with each one's lives
 * and points. Presentational.
 */
@Component({
  selector: 'lib-stage-panel',
  imports: [TranslatePipe, ButtonComponent],
  templateUrl: './stage-panel.html',
  styleUrls: ['./stage-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StagePanelComponent {
  readonly stage = input<StageLobby | null>(null);
  readonly phase = input<LobbyPhase>('waiting');
  readonly queue = input<Seat[]>([]);
  readonly players = input<Seat[]>([]);
  readonly maxPlayers = input(4);
  readonly myId = input<string | null>(null);

  /** The host picked another stage. */
  readonly pick = output<string>();
  /** The host starts now, with whoever is in line. */
  readonly start = output<void>();

  readonly code = computed(() => stageCode(this.stage()?.id ?? ''));
  readonly nameKey = computed(() => stageNameKey(this.stage()?.id ?? ''));
  readonly amHost = computed(() => {
    const me = this.myId();
    return me !== null && this.stage()?.hostId === me;
  });
  /** In line and first: the host may start now. */
  readonly canStart = computed(
    () =>
      this.amHost() &&
      (this.phase() === 'waiting' || this.phase() === 'countdown') &&
      this.queue()[0]?.id === this.myId(),
  );
  /** The host may change the stage between rounds. */
  readonly canPick = computed(
    () => this.amHost() && this.phase() !== 'playing',
  );
  readonly hostName = computed(() => {
    const id = this.stage()?.hostId;
    return (
      [...this.players(), ...this.queue()].find((s) => s.id === id)?.name ??
      null
    );
  });
  /** The team: the round's players while one is on, the next ones in line otherwise. */
  readonly team = computed((): TeamRow[] => {
    const stage = this.stage();
    const live = this.phase() === 'playing' || this.phase() === 'results';
    const seats = live
      ? this.players()
      : this.queue().slice(0, this.maxPlayers());
    return seats.map((s) => {
      const progress = stage?.progress[s.id];
      return {
        id: s.id,
        name: s.name,
        lives: progress ? livesOf(progress) : 0,
        score: progress?.score ?? 0,
        host: s.id === stage?.hostId,
      };
    });
  });

  codeOf(id: string): string {
    return stageCode(id);
  }

  nameOf(id: string): string {
    return stageNameKey(id);
  }

  onPick(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value && value !== this.stage()?.id) this.pick.emit(value);
  }
}
