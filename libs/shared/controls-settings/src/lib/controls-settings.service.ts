import { computed, effect, Injectable, signal } from '@angular/core';

/** localStorage key holding the keyboard choice across sessions. */
export const CONTROLS_STORAGE_KEY = 'detona-controls';

/** The two hands a keyboard offers: letters on the left, arrows on the right. */
export type KeyScheme = 'wasd' | 'arrows';
export const KEY_SCHEMES: readonly KeyScheme[] = ['wasd', 'arrows'];
export const DEFAULT_KEY_SCHEME: KeyScheme = 'wasd';

export function isKeyScheme(value: unknown): value is KeyScheme {
  return (KEY_SCHEMES as readonly unknown[]).includes(value);
}

interface StoredControls {
  scheme?: unknown;
}

/**
 * The player's keyboard choice, shared by the settings page and the game.
 *
 * Some people never use the letters: on a laptop, with one hand, or because
 * the arrows are what every game taught them. `scheme` is the hand player 1
 * drives with; `other` is what a second player on the same keyboard gets.
 * Survives a reload.
 */
@Injectable({ providedIn: 'root' })
export class ControlsSettingsService {
  readonly scheme = signal<KeyScheme>(ControlsSettingsService.restore());
  /** The hand left over for a second player. */
  readonly other = computed<KeyScheme>(() =>
    this.scheme() === 'wasd' ? 'arrows' : 'wasd',
  );

  constructor() {
    effect(() => this.persist(this.scheme()));
  }

  setScheme(scheme: KeyScheme): void {
    this.scheme.set(scheme);
  }

  private persist(scheme: KeyScheme): void {
    try {
      localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify({ scheme }));
    } catch {
      // Private browsing or a full quota: the choice lasts for this page only.
    }
  }

  private static restore(): KeyScheme {
    try {
      const raw = localStorage.getItem(CONTROLS_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      const scheme =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as StoredControls).scheme
          : undefined;
      return isKeyScheme(scheme) ? scheme : DEFAULT_KEY_SCHEME;
    } catch {
      return DEFAULT_KEY_SCHEME;
    }
  }
}
