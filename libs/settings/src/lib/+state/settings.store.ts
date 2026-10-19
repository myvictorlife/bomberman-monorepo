import { DOCUMENT } from '@angular/common';
import { computed, inject } from '@angular/core';
import { AudioSettingsService } from '@libs/audio-settings';
import { ControlsSettingsService, KeyScheme } from '@libs/controls-settings';
import { Language } from '@libs/entity';
import { ThemePreference, ThemeService } from '@libs/theme';
import { UpdateLanguageService } from '@libs/translation';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

/** localStorage key holding the reduced-motion choice across sessions. */
export const REDUCE_MOTION_STORAGE_KEY = 'reduce-motion';

export interface SettingsState {
  reduceMotion: boolean;
}

export const initialSettingsState: SettingsState = {
  reduceMotion: false,
};

/**
 * Feature state for the settings page.
 *
 * The counterpart to `ProfileStore`, and deliberately a different shape: no HTTP,
 * no `rxMethod`, no loading/error triad. Everything here is synchronous and
 * locally persisted, which is the other half of what a `signalStore` is for.
 *
 * Theme and language are *not* duplicated into `withState`. They already live in
 * `ThemeService` and `UpdateLanguageService` as signals, so the store exposes them
 * through `withComputed` and forwards writes. Copying them into state would create
 * a second source of truth that drifts the moment the header changes the language.
 */
export const SettingsStore = signalStore(
  withState(initialSettingsState),

  withComputed(
    (
      _,
      theme = inject(ThemeService),
      language = inject(UpdateLanguageService),
      audio = inject(AudioSettingsService),
      controls = inject(ControlsSettingsService),
    ) => ({
      themePreference: computed(() => theme.preference()),
      isDarkActive: computed(() => theme.isDark()),
      currentLanguage: computed(() => language.currentLanguage() as Language),
      // Audio lives in AudioSettingsService, shared with the game page.
      music: computed(() => audio.music()),
      sfx: computed(() => audio.sfx()),
      // The keyboard hand lives in ControlsSettingsService, shared with the play page.
      keyScheme: computed(() => controls.scheme()),
    }),
  ),

  withMethods(
    (
      store,
      theme = inject(ThemeService),
      language = inject(UpdateLanguageService),
      audio = inject(AudioSettingsService),
      controls = inject(ControlsSettingsService),
      document = inject(DOCUMENT),
    ) => {
      const applyReduceMotion = (enabled: boolean): void => {
        document.documentElement.classList.toggle('reduce-motion', enabled);
      };

      return {
        setThemePreference(preference: ThemePreference): void {
          theme.setPreference(preference);
        },

        setLanguage(next: Language): void {
          language.changeLanguage(next);
        },

        setMusic(on: boolean): void {
          audio.setMusic(on);
        },

        setSfx(on: boolean): void {
          audio.setSfx(on);
        },

        setKeyScheme(scheme: KeyScheme): void {
          controls.setScheme(scheme);
        },

        setReduceMotion(enabled: boolean): void {
          patchState(store, { reduceMotion: enabled });
          applyReduceMotion(enabled);
          try {
            localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(enabled));
          } catch {
            // Private browsing or a full quota must not break the setting.
          }
        },

        /** Restores the persisted value. Called from `onInit`, and by tests directly. */
        restore(): void {
          let enabled = false;
          try {
            enabled =
              localStorage.getItem(REDUCE_MOTION_STORAGE_KEY) === 'true';
          } catch {
            // Storage unavailable — fall through to the default.
          }
          patchState(store, { reduceMotion: enabled });
          applyReduceMotion(enabled);
        },
      };
    },
  ),

  withHooks({
    // The store is provided on the route, so this runs when the feature is entered
    // rather than at app bootstrap — the reason the setting belongs here and not in
    // a root service.
    onInit: (store) => store.restore(),
  }),
);
