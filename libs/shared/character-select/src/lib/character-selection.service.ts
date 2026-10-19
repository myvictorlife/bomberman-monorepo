import { effect, Injectable, signal } from '@angular/core';
import {
  CharacterId,
  DEFAULT_CHARACTER_ID,
  isCharacterId,
} from '@libs/game-core';

/** localStorage key holding the chosen character across sessions. */
export const CHARACTER_STORAGE_KEY = 'character';

/**
 * The player's chosen character. Chosen on the roster page, read by the game:
 * two features that never import each other, so the choice lives here, in
 * root, like the theme. New players start as the roster's first character.
 */
@Injectable({ providedIn: 'root' })
export class CharacterSelectionService {
  readonly selectedId = signal<CharacterId>(
    CharacterSelectionService.restore(),
  );

  constructor() {
    effect(() => this.persist(this.selectedId()));
  }

  select(id: CharacterId): void {
    this.selectedId.set(id);
  }

  private persist(id: CharacterId): void {
    try {
      localStorage.setItem(CHARACTER_STORAGE_KEY, id);
    } catch {
      // Private browsing or a full quota must not break choosing.
    }
  }

  private static restore(): CharacterId {
    try {
      const saved = localStorage.getItem(CHARACTER_STORAGE_KEY);
      if (saved && isCharacterId(saved)) return saved;
    } catch {
      // Storage unavailable — start with the default.
    }
    return DEFAULT_CHARACTER_ID;
  }
}
