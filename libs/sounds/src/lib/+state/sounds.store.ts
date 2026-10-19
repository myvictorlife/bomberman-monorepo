import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export interface SoundsState {
  /** Whether the theme is playing on the gallery page. */
  themePlaying: boolean;
  /** The last thing played, named for the status line. */
  lastPlayed: string | null;
  /** The announcer's voice, by name; `null` lets the browser's best Portuguese one speak. */
  voiceName: string | null;
}

export const initialSoundsState: SoundsState = {
  themePlaying: false,
  lastPlayed: null,
  voiceName: null,
};

/** What the audio gallery shows: the theme's state and what was played last. */
export const SoundsStore = signalStore(
  withState(initialSoundsState),
  withMethods((store) => ({
    setThemePlaying(themePlaying: boolean): void {
      patchState(store, { themePlaying });
    },
    notePlayed(lastPlayed: string): void {
      patchState(store, { lastPlayed });
    },
    setVoiceName(voiceName: string | null): void {
      patchState(store, { voiceName });
    },
  })),
);
