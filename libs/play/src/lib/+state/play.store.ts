import { computed, inject } from '@angular/core';
import { AudioSettingsService } from '@libs/audio-settings';
import { formatClock, HudSnapshot } from '@libs/game-client';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export type ArenaStatus = 'loading' | 'ready' | 'error';

export interface PlayState {
  status: ArenaStatus;
  /** The latest snapshot the arena reported; `null` until the first frame. */
  hud: HudSnapshot | null;
}

export const initialPlayState: PlayState = {
  status: 'loading',
  hud: null,
};

/**
 * What the page around the canvas shows. The game itself lives in the arena —
 * this store only mirrors the HUD snapshot it reports, so Angular re-renders
 * when a stat changes, never once per frame. Provided on the route.
 */
export const PlayStore = signalStore(
  withState(initialPlayState),
  withComputed(({ hud }, audio = inject(AudioSettingsService)) => ({
    /** Audio lives in `AudioSettingsService`, shared with the settings page; read, never copied. */
    muted: computed(() => !audio.sfx()),
    music: computed(() => audio.music()),
    players: computed(() => hud()?.players ?? []),
    isOver: computed(() => hud()?.phase === 'over'),
    /** The round's clock as `m:ss`; `null` before the first frame or with no clock. */
    clock: computed(() => {
      const seconds = hud()?.secondsLeft;
      return seconds === null || seconds === undefined
        ? null
        : formatClock(seconds);
    }),
    closing: computed(() => hud()?.closing ?? false),
    winner: computed(() => {
      const snapshot = hud();
      return snapshot?.players.find((p) => p.id === snapshot.winnerId) ?? null;
    }),
  })),
  withMethods((store, audio = inject(AudioSettingsService)) => ({
    setStatus(status: ArenaStatus): void {
      patchState(store, { status });
    },
    applyHud(hud: HudSnapshot): void {
      patchState(store, { hud });
    },
    /** A new arena is on its way: nothing to show until its first frame. */
    reload(): void {
      patchState(store, { status: 'loading', hud: null });
    },
    setMuted(muted: boolean): void {
      audio.setSfx(!muted);
    },
    setMusic(music: boolean): void {
      audio.setMusic(music);
    },
  })),
);
