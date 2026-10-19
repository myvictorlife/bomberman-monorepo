import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { environment } from '@libs/environment';
import { TranslatePipe } from '@ngx-translate/core';

/** How often the title screen asks who is around, while it is on screen. */
const POLL_MS = 30_000;
const FETCH_TIMEOUT_MS = 4_000;

/** The server's `GET /status`, by shape (the protocol's `RoomStatus`). */
export interface RoomPresence {
  online: number;
  phase: 'waiting' | 'countdown' | 'playing' | 'results';
  playing: number;
  queued: number;
}

/**
 * Who is in the online room right now — a live pill under the hero's buttons,
 * read from the game server's `/status` and refreshed while the tab is
 * visible. Shows nothing without a server, or when it cannot be reached.
 */
@Component({
  selector: 'app-presence',
  imports: [TranslatePipe],
  templateUrl: './presence.html',
  styleUrl: './presence.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenceComponent {
  /** Where the status is read from; `null` shows nothing. Defaults to the build's server. */
  readonly serverUrl = input<string | null>(environment.gameServerUrl);

  readonly presence = signal<RoomPresence | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const controller = new AbortController();
    const tick = () => {
      if (globalThis.document?.visibilityState === 'hidden') return;
      void this.load(controller.signal);
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    globalThis.document?.addEventListener('visibilitychange', tick);
    destroyRef.onDestroy(() => {
      controller.abort();
      clearInterval(timer);
      globalThis.document?.removeEventListener('visibilitychange', tick);
    });
  }

  /** The second line: what the room is doing. */
  stateKey(p: RoomPresence): string {
    if (p.phase === 'playing' || p.phase === 'results')
      return 'HOME.PRESENCE_PLAYING';
    if (p.phase === 'countdown') return 'HOME.PRESENCE_COUNTDOWN';
    return p.queued > 0 ? 'HOME.PRESENCE_QUEUED' : 'HOME.PRESENCE_WAITING';
  }

  private async load(signal: AbortSignal): Promise<void> {
    const url = this.serverUrl();
    if (!url) return;
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/status`, {
        signal: AbortSignal.any([signal, timeout]),
      });
      const value: unknown = response.ok ? await response.json() : null;
      this.presence.set(isPresence(value) ? value : null);
    } catch {
      // Unreachable: the pill simply is not there until the next try.
      this.presence.set(null);
    }
  }
}

function isPresence(value: unknown): value is RoomPresence {
  const v = value as Partial<RoomPresence> | null;
  return (
    !!v &&
    typeof v.online === 'number' &&
    typeof v.phase === 'string' &&
    typeof v.playing === 'number' &&
    typeof v.queued === 'number'
  );
}
