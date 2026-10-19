import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { AUTH } from '@libs/auth';
import { environment } from '@libs/environment';
import {
  PlayerProfile,
  ProfileUpdate,
  ProfileUpdateError,
} from '@libs/game-protocol';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';

/** The game server's origin; `null` when this build has none. Tests provide their own. */
export const PROFILE_SERVER_URL = new InjectionToken<string | null>(
  'PROFILE_SERVER_URL',
  { providedIn: 'root', factory: () => environment.gameServerUrl },
);

/** Why a profile call failed: what the server said, or that it could not be reached. */
export type ProfileFailure = ProfileUpdateError | 'network';

/**
 * The signed-in player's profile on the game server: `GET /me` and `PUT /me`,
 * with a fresh Firebase ID token as the bearer. Fails with a
 * {@link ProfileFailure} code, never a raw HTTP error.
 */
@Injectable()
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AUTH);
  private readonly base = inject(PROFILE_SERVER_URL);

  /** A game server to ask and a way to sign in; without both there is no profile. */
  readonly available = this.base !== null && this.auth.available;

  fetchProfile(): Observable<PlayerProfile> {
    return this.call((url, headers) =>
      this.http.get<PlayerProfile>(url, { headers }),
    );
  }

  updateProfile(update: ProfileUpdate): Observable<PlayerProfile> {
    return this.call((url, headers) =>
      this.http.put<PlayerProfile>(url, update, { headers }),
    );
  }

  private call(
    request: (
      url: string,
      headers: Record<string, string>,
    ) => Observable<PlayerProfile>,
  ): Observable<PlayerProfile> {
    const base = this.base;
    if (!base) return throwError(() => 'network' satisfies ProfileFailure);
    return from(this.auth.idToken()).pipe(
      switchMap((token) => {
        if (!token)
          return throwError(() => 'auth-required' satisfies ProfileFailure);
        return request(`${base.replace(/\/$/, '')}/me`, {
          Authorization: `Bearer ${token}`,
        });
      }),
      catchError((error: unknown) => throwError(() => toFailure(error))),
    );
  }
}

const SERVER_CODES: readonly ProfileUpdateError[] = [
  'auth-required',
  'email-not-verified',
  'bad-request',
  'name-taken',
];

function toFailure(error: unknown): ProfileFailure {
  if (typeof error === 'string' && (SERVER_CODES as string[]).includes(error))
    return error as ProfileFailure;
  if (error instanceof HttpErrorResponse) {
    const code = (error.error as { error?: unknown } | null)?.error;
    if (SERVER_CODES.includes(code as ProfileUpdateError))
      return code as ProfileUpdateError;
  }
  return 'network';
}
