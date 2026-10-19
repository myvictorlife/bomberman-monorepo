import { effect, Injectable, signal } from '@angular/core';

/** localStorage key holding the audio choices across sessions. */
export const AUDIO_STORAGE_KEY = 'detona-audio';

interface StoredAudio {
  muted?: boolean;
  music?: boolean;
}

/**
 * The player's audio choices, shared by the settings page and the game.
 *
 * The arena theme loops for a whole match, so it starts **off** and stays off
 * until the player asks for it; the short effects (bombs, pickups, mounts)
 * start on. Both survive a reload.
 */
@Injectable({ providedIn: 'root' })
export class AudioSettingsService {
  private readonly saved = AudioSettingsService.restore();

  /** The looping arena theme. */
  readonly music = signal<boolean>(this.saved.music === true);
  /** Bombs, pickups, mounts, the announcer. */
  readonly sfx = signal<boolean>(this.saved.muted !== true);

  constructor() {
    effect(() => this.persist({ music: this.music(), muted: !this.sfx() }));
  }

  setMusic(on: boolean): void {
    this.music.set(on);
  }

  setSfx(on: boolean): void {
    this.sfx.set(on);
  }

  private persist(value: Required<StoredAudio>): void {
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Private browsing or a full quota: the choice lasts for this page only.
    }
  }

  private static restore(): StoredAudio {
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as StoredAudio)
        : {};
    } catch {
      return {};
    }
  }
}
