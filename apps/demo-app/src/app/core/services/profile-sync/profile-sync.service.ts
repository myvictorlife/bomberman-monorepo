import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  InjectionToken,
  untracked,
} from '@angular/core';
import { AUTH } from '@libs/auth';
import { CharacterSelectionService } from '@libs/character-select';
import { environment } from '@libs/environment';
import { CharacterId } from '@libs/game-core';
import { PlayerProfile } from '@libs/game-protocol';
import { firstValueFrom } from 'rxjs';

/** The game server's origin; `null` when this build has none. Tests provide their own. */
export const SYNC_SERVER_URL = new InjectionToken<string | null>(
  'SYNC_SERVER_URL',
  { providedIn: 'root', factory: () => environment.gameServerUrl },
);

/**
 * Keeps the character this browser plays with and the favourite on the
 * player's account in step, so the account's character follows them to any
 * device. Composed here, in the app: the roster, the game and the profile are
 * features that never import each other.
 *
 * - Signed in: the account's favourite becomes this browser's character. An
 *   account with no favourite yet takes this browser's.
 * - Signed in and picking another character (the roster page): the account's
 *   favourite follows.
 *
 * It never signs anyone in or loads the auth SDK itself: it acts once a page
 * that does (`/online`, `/profile`) has a signed-in player. Every failure is
 * quiet — the local choice still works without the server.
 */
@Injectable({ providedIn: 'root' })
export class ProfileSyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AUTH);
  private readonly selection = inject(CharacterSelectionService);
  private readonly base = inject(SYNC_SERVER_URL);

  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  /** The account's favourite as last agreed with the server; changes from it are sent. */
  private synced: { userId: string; favorite: CharacterId | null } | null =
    null;
  private started = false;

  /** Call once, in an injection context (the app initializer). */
  start(): void {
    if (this.started || !this.base || !this.auth.available) return;
    this.started = true;
    effect(() => {
      const id = this.userId();
      untracked(() => void this.signedIn(id));
    });
    effect(() => {
      const picked = this.selection.selectedId();
      untracked(() => this.picked(picked));
    });
  }

  private async signedIn(userId: string | null): Promise<void> {
    this.synced = null;
    if (!userId) return;
    const profile = await this.request('GET');
    // Signed out or switched account while the answer was on its way.
    if (!profile || this.userId() !== userId) return;
    const favorite = profile.favoriteCharacterId ?? null;
    this.synced = { userId, favorite };
    if (favorite) this.selection.select(favorite);
    else this.picked(this.selection.selectedId());
  }

  private picked(characterId: CharacterId): void {
    const synced = this.synced;
    if (!synced || synced.favorite === characterId) return;
    if (synced.userId !== this.userId()) return;
    synced.favorite = characterId;
    void this.request('PUT', { favoriteCharacterId: characterId });
  }

  private async request(
    method: 'GET' | 'PUT',
    body?: { favoriteCharacterId: CharacterId },
  ): Promise<PlayerProfile | null> {
    try {
      const token = await this.auth.idToken();
      if (!token || !this.base) return null;
      const url = `${this.base.replace(/\/$/, '')}/me`;
      const headers = { Authorization: `Bearer ${token}` };
      return await firstValueFrom(
        method === 'GET'
          ? this.http.get<PlayerProfile>(url, { headers })
          : this.http.put<PlayerProfile>(url, body, { headers }),
      );
    } catch {
      return null;
    }
  }
}
