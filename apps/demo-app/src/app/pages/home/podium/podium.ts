import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '@libs/environment';
import { colorSlot, paintCartoonCharacter } from '@libs/game-client';
import {
  DEFAULT_CHARACTER_ID,
  isCharacterId,
  isPlayerColorId,
} from '@libs/game-core';
import {
  ButtonComponent,
  PodiumComponent as PodiumBoard,
  PodiumLine,
  PodiumPainter,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/** How long the title screen waits for the leaderboard before giving up quietly. */
const FETCH_TIMEOUT_MS = 4_000;

export type PodiumStatus = 'off' | 'loading' | 'ready' | 'empty';

/** The game's own faces on the podium: their character, in their colour or else the place's. */
export const paintPodiumFace: PodiumPainter = (
  ctx,
  characterId,
  place,
  color,
) => {
  paintCartoonCharacter(ctx, {
    characterId:
      characterId && isCharacterId(characterId)
        ? characterId
        : DEFAULT_CHARACTER_ID,
    facing: 'down',
    frame: 0,
    slot: isPlayerColorId(color) ? colorSlot(color) : place - 1,
  });
};

/**
 * The top three of the online ranking, read from the game server's
 * `/ranking` so the title screen never joins the room. The page wraps it in a
 * section and hides that while `status` is `off` (no server, or none
 * reachable); an empty board invites the first win.
 */
@Component({
  selector: 'app-podium',
  imports: [RouterLink, ButtonComponent, TranslatePipe, PodiumBoard],
  templateUrl: './podium.html',
  styleUrl: './podium.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PodiumComponent {
  /** Where the ranking is read from; `null` hides the podium. Defaults to the build's server. */
  readonly serverUrl = input<string | null>(environment.gameServerUrl);

  readonly status = signal<PodiumStatus>('loading');
  readonly entries = signal<PodiumLine[]>([]);
  readonly paint = paintPodiumFace;

  constructor() {
    const controller = new AbortController();
    inject(DestroyRef).onDestroy(() => controller.abort());
    void this.load(controller.signal);
  }

  private async load(signal: AbortSignal): Promise<void> {
    const url = this.serverUrl();
    if (!url) {
      this.status.set('off');
      return;
    }
    const timeout = setTimeout(
      () => this.status.update((s) => (s === 'loading' ? 'off' : s)),
      FETCH_TIMEOUT_MS,
    );
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/ranking`, {
        signal,
      });
      const list: unknown = response.ok ? await response.json() : null;
      const entries = Array.isArray(list)
        ? (list as PodiumLine[]).slice(0, 3)
        : [];
      this.entries.set(entries);
      this.status.set(entries.length ? 'ready' : 'empty');
    } catch {
      // No server, or not reachable: the title screen simply has no podium today.
      this.status.set('off');
    } finally {
      clearTimeout(timeout);
    }
  }
}
