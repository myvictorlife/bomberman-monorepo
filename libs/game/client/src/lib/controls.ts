import { Direction } from '@libs/game-core';

/** Phaser key names (`Phaser.Input.Keyboard.KeyCodes`), e.g. `'W'`, `'SPACE'`, `'UP'`. */
export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  bomb: string;
  /** Uses the mount's ability, when the mount has one. */
  ability: string;
  /** Sets off the oldest remote bomb. */
  detonate: string;
}

export interface ControlScheme {
  playerId: string;
  keys: KeyBindings;
}

export const WASD_KEYS: KeyBindings = {
  up: 'W',
  down: 'S',
  left: 'A',
  right: 'D',
  bomb: 'SPACE',
  ability: 'SHIFT',
  detonate: 'E',
};

export const ARROW_KEYS: KeyBindings = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  bomb: 'ENTER',
  ability: 'CTRL',
  detonate: 'FORWARD_SLASH',
};

/**
 * Tracks which direction keys are held and in what order, so holding two at
 * once means "the one pressed last" — turning a corner without releasing the
 * first key, like the original.
 */
export class DirectionTracker {
  private readonly held: Direction[] = [];

  press(direction: Direction): void {
    this.release(direction);
    this.held.push(direction);
  }

  release(direction: Direction): void {
    const index = this.held.indexOf(direction);
    if (index !== -1) this.held.splice(index, 1);
  }

  clear(): void {
    this.held.length = 0;
  }

  get current(): Direction | null {
    return this.held[this.held.length - 1] ?? null;
  }
}

/**
 * One player's hands on the game, whatever drives them: the keyboard binds
 * keys to these, a touch controller calls them from pointer events. Directions
 * are held and released like keys — `press('up')` walks until `release('up')`
 * — and the actions fire once per call.
 */
export interface PlayerController {
  press(direction: Direction): void;
  release(direction: Direction): void;
  /** Lets go of every held direction: the finger left the pad. */
  clear(): void;
  bomb(): void;
  ability(): void;
  detonate(): void;
}
