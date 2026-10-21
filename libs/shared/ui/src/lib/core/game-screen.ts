/**
 * The pieces of "game mode" a page needs on a phone: the arena fills the
 * screen and, with the phone held upright, the whole game turns a quarter so
 * it sits between the thumbs as if the phone were sideways. The page owns
 * its layout; these are the browser chores around it, shared so every game
 * page behaves the same.
 */

/** Where the "play upright" choice is kept — one choice for every game page. */
export const UPRIGHT_KEY = 'play.upright';

export function readUpright(): boolean {
  try {
    return localStorage.getItem(UPRIGHT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeUpright(upright: boolean): void {
  try {
    localStorage.setItem(UPRIGHT_KEY, upright ? '1' : '0');
  } catch {
    // Private mode, or storage blocked: the choice lasts the visit.
  }
}

/**
 * Where the "hide the strip" choice is kept — one choice for every game page.
 * In game mode the clock and the players sit on a strip over the arena; a
 * phone has little room, and some would rather have it all for the arena.
 */
export const STRIP_KEY = 'play.strip-hidden';

export function readStripHidden(): boolean {
  try {
    return localStorage.getItem(STRIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeStripHidden(hidden: boolean): void {
  try {
    localStorage.setItem(STRIP_KEY, hidden ? '1' : '0');
  } catch {
    // Private mode, or storage blocked: the choice lasts the visit.
  }
}

/**
 * The element's screen rectangle with width and height swapped: its own
 * size, a quarter turn later. Phaser measures its host with
 * `getBoundingClientRect`, which a turned ancestor reports in screen terms.
 */
export function turnedRect(element: HTMLElement): DOMRect {
  const rect = HTMLElement.prototype.getBoundingClientRect.call(element);
  return new DOMRect(rect.x, rect.y, rect.height, rect.width);
}

/** Gives a host its own terms back while the game is turned; restores it otherwise. */
export function measureTurned(host: HTMLElement, turned: boolean): void {
  const own = host as { getBoundingClientRect?: () => DOMRect };
  if (turned) own.getBoundingClientRect = () => turnedRect(host);
  else delete own.getBoundingClientRect;
}

/** `screen.orientation.lock` where it exists; a refusal is nothing to report. */
export function lockOrientation(orientation: 'landscape'): void {
  const screenOrientation = globalThis.screen?.orientation as
    | { lock?: (o: string) => Promise<void> }
    | undefined;
  try {
    screenOrientation?.lock?.(orientation).catch(() => undefined);
  } catch {
    // Not a thing on this browser.
  }
}

export function unlockOrientation(): void {
  try {
    globalThis.screen?.orientation?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}

/**
 * Fills the screen: the document goes full screen where the browser allows
 * (not the page element — a full-screen element gets the browser's own
 * `transform: none !important`, which would undo the quarter turn), then
 * asks for landscape, which Android grants in full screen.
 */
export function enterFullScreen(): void {
  const fullscreen = document.documentElement.requestFullscreen?.();
  fullscreen?.then(() => lockOrientation('landscape')).catch(() => undefined);
}

export function leaveFullScreen(): void {
  unlockOrientation();
  if (document.fullscreenElement)
    document.exitFullscreen?.()?.catch(() => undefined);
}

/** Calls `onChange` with whether the screen is upright, now and on every turn; returns the unsubscribe. */
export function watchPortrait(
  onChange: (portrait: boolean) => void,
): () => void {
  const query = globalThis.matchMedia?.('(orientation: portrait)');
  if (!query) return () => undefined;
  const sync = () => onChange(query.matches);
  sync();
  query.addEventListener?.('change', sync);
  return () => query.removeEventListener?.('change', sync);
}

/** A coarse pointer: a phone or a tablet, where the game starts in game mode. */
export function isTouchScreen(): boolean {
  return !!globalThis.matchMedia?.('(pointer: coarse)').matches;
}
