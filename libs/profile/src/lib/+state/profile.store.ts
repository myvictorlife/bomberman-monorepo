import { computed, inject } from '@angular/core';
import { CharacterSelectionService } from '@libs/character-select';
import { PlayerProfile, ProfileUpdate } from '@libs/game-protocol';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { concatMap, pipe, switchMap, tap } from 'rxjs';
import {
  ProfileFailure,
  ProfileService,
} from '../services/profile/profile.service';

export interface ProfileState {
  profile: PlayerProfile | null;
  loading: boolean;
  /** Why loading failed; the page offers to try again. */
  error: ProfileFailure | null;
  /** A change is on its way to the server. */
  saving: boolean;
  /** Why the last change was refused — a taken name, above all. */
  saveError: ProfileFailure | null;
}

export const initialProfileState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
  saving: false,
  saveError: null,
};

/**
 * Feature state for the profile page: the signed-in player's record on the
 * game server — the name on the ranking, the favourite character, the colour.
 *
 * Provided on the profile route (see `user.routes.ts`), never in root. The
 * favourite character also becomes the one this browser plays with, so the
 * account and the roster page never disagree.
 */
export const ProfileStore = signalStore(
  withState(initialProfileState),
  withComputed(({ profile }) => ({
    hasProfile: computed(() => profile() !== null),
  })),
  withMethods(
    (
      store,
      profileService = inject(ProfileService),
      selection = inject(CharacterSelectionService),
    ) => {
      const received = (profile: PlayerProfile) => {
        patchState(store, { profile });
        if (profile.favoriteCharacterId)
          selection.select(profile.favoriteCharacterId);
      };
      return {
        /**
         * `switchMap`: a newer load cancels a slower one. `tapResponse` keeps the
         * stream alive after a failure, so "try again" still works.
         */
        fetchProfile: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(() =>
              profileService.fetchProfile().pipe(
                tapResponse({
                  next: (profile) => {
                    received(profile);
                    patchState(store, { loading: false });
                  },
                  error: (error: ProfileFailure) =>
                    patchState(store, { error, loading: false }),
                }),
              ),
            ),
          ),
        ),
        /** `concatMap`: changes reach the server in the order they were made. */
        save: rxMethod<ProfileUpdate>(
          pipe(
            tap(() => patchState(store, { saving: true, saveError: null })),
            concatMap((update) =>
              profileService.updateProfile(update).pipe(
                tapResponse({
                  next: (profile) => {
                    received(profile);
                    patchState(store, { saving: false });
                  },
                  error: (saveError: ProfileFailure) =>
                    patchState(store, { saveError, saving: false }),
                }),
              ),
            ),
          ),
        ),
        /** Signed out: nothing of the last account stays on the page. */
        clear(): void {
          patchState(store, initialProfileState);
        },
      };
    },
  ),
);
