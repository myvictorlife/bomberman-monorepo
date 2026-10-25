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

/**
 * The viewport with zoom turned off. `initial-scale=1` stays: on iOS,
 * swapping this in also brings a page that was already zoomed back to 1.
 */
export function withoutZoom(content: string | null): string {
  const kept = (content ?? 'width=device-width, initial-scale=1')
    .split(',')
    .map((part) => part.trim())
    .filter(
      (part) =>
        part && !/^(initial-scale|maximum-scale|user-scalable)\s*=/.test(part),
    );
  return [
    ...kept,
    'initial-scale=1',
    'maximum-scale=1',
    'user-scalable=no',
  ].join(', ');
}

let zoomHolds = 0;
let releaseZoom: () => void = () => undefined;

/**
 * Keeps the browser from zooming while a game is on screen, and returns the
 * release. Two thumbs moving apart, one on the pad and one on the bomb,
 * read as a pinch; a quick double tap on the bomb, as a double-tap zoom.
 * And `touch-action: none`, which stops a zoom, stops the pinch back out
 * too, so a player who got zoomed in was stuck there.
 *
 * No one switch does it in every browser, so it takes layers:
 * - the viewport says `user-scalable=no`, which Chrome obeys and which
 *   brings an already-zoomed iOS page back to scale 1 (Safari ignores it
 *   for the pinch itself);
 * - `touch-action: none` on the whole document, which Chrome obeys
 *   everywhere, not only over the game;
 * - Safari's own `gesturestart`/`gesturechange` cancelled, the one thing
 *   that reliably stops its pinch, a two-finger `touchmove` cancelled as a
 *   backstop, and `dblclick` against its double-tap zoom.
 *
 * `preventDefault()` on a `pointerdown` stops none of this: it only cancels
 * the mouse events a touch would fake. Holds count, so two holders never
 * release each other's; the page gets its zoom back with the last release,
 * the rest of the site keeping it for whoever needs it.
 */
export function holdZoom(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (zoomHolds++ === 0) releaseZoom = lockZoom(document);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--zoomHolds === 0) releaseZoom();
  };
}

function lockZoom(doc: Document): () => void {
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const viewport = meta?.getAttribute('content') ?? null;
  meta?.setAttribute('content', withoutZoom(viewport));

  const styled = [doc.documentElement, doc.body]
    .filter(Boolean)
    .map((element) => ({ element, before: element.style.touchAction }));
  for (const { element } of styled) element.style.touchAction = 'none';

  const cancel = (event: Event) => event.preventDefault();
  const pinch = (event: Event) => {
    if ((event as TouchEvent).touches?.length > 1) event.preventDefault();
  };
  // Not passive, or the browser ignores `preventDefault()`.
  const active = { passive: false } as const;
  const listeners: [string, (event: Event) => void][] = [
    ['gesturestart', cancel],
    ['gesturechange', cancel],
    ['gestureend', cancel],
    ['dblclick', cancel],
    ['touchmove', pinch],
  ];
  for (const [type, listener] of listeners)
    doc.addEventListener(type, listener, active);

  return () => {
    for (const [type, listener] of listeners)
      doc.removeEventListener(type, listener);
    for (const { element, before } of styled)
      element.style.touchAction = before;
    if (viewport === null) meta?.removeAttribute('content');
    else meta?.setAttribute('content', viewport);
  };
}
