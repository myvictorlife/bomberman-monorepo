import {
  enterFullScreen,
  holdZoom,
  isTouchScreen,
  leaveFullScreen,
  lockOrientation,
  measureTurned,
  readUpright,
  turnedRect,
  unlockOrientation,
  UPRIGHT_KEY,
  watchPortrait,
  withoutZoom,
  writeUpright,
} from './game-screen';

describe('game screen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('remembers the upright choice, and survives blocked storage', () => {
    expect(readUpright()).toBe(false);
    writeUpright(true);
    expect(localStorage.getItem(UPRIGHT_KEY)).toBe('1');
    expect(readUpright()).toBe(true);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readUpright()).toBe(false);
    expect(() => writeUpright(false)).not.toThrow();
  });

  it('measures a turned host in its own terms, and gives the browser its rect back', () => {
    const host = document.createElement('div');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(1, 2, 300, 500),
    );

    expect(turnedRect(host)).toEqual(new DOMRect(1, 2, 500, 300));
    measureTurned(host, true);
    expect(host.getBoundingClientRect().width).toBe(500);
    measureTurned(host, false);
    expect(host.getBoundingClientRect().width).toBe(300);
  });

  it('locks and unlocks the orientation where the browser can, quietly where it cannot', () => {
    const lock = vi.fn(() => Promise.resolve());
    const unlock = vi.fn();
    vi.stubGlobal('screen', { orientation: { lock, unlock } });

    lockOrientation('landscape');
    unlockOrientation();
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(unlock).toHaveBeenCalled();

    vi.stubGlobal('screen', {
      orientation: {
        lock: () => {
          throw new Error('nope');
        },
        unlock: () => {
          throw new Error('nope');
        },
      },
    });
    expect(() => lockOrientation('landscape')).not.toThrow();
    expect(() => unlockOrientation()).not.toThrow();
  });

  it('goes full screen and back', async () => {
    const request = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: request,
      configurable: true,
    });
    enterFullScreen();
    expect(request).toHaveBeenCalled();
    await Promise.resolve();

    const exit = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      value: exit,
      configurable: true,
    });
    leaveFullScreen();
    expect(exit).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  });

  it('follows the screen turning, and knows a touch screen', () => {
    const listeners: (() => void)[] = [];
    const query = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => query);
    const seen: boolean[] = [];

    const stop = watchPortrait((p) => seen.push(p));
    query.matches = false;
    listeners.forEach((fn) => fn());
    stop();

    expect(seen).toEqual([true, false]);
    expect(query.removeEventListener).toHaveBeenCalled();
    expect(isTouchScreen()).toBe(false);

    vi.stubGlobal('matchMedia', undefined);
    expect(watchPortrait(() => undefined)()).toBeUndefined();
    expect(isTouchScreen()).toBe(false);
  });

  describe('zoom', () => {
    let meta: HTMLMetaElement;
    const viewport = 'width=device-width, initial-scale=1, viewport-fit=cover';

    beforeEach(() => {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = viewport;
      document.head.append(meta);
    });

    afterEach(() => meta.remove());

    /** A cancellable event, and whether a listener cancelled it. */
    function cancelled(type: string, touches = 1): boolean {
      const event = new Event(type, { cancelable: true, bubbles: true });
      Object.defineProperty(event, 'touches', { value: { length: touches } });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }

    it('turns zoom off in the viewport, keeping the rest of it', () => {
      expect(withoutZoom(viewport)).toBe(
        'width=device-width, viewport-fit=cover, initial-scale=1, maximum-scale=1, user-scalable=no',
      );
      expect(withoutZoom('width=device-width, maximum-scale=5')).toBe(
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      );
      expect(withoutZoom(null)).toContain('width=device-width');
    });

    it('holds the zoom while a game is on screen, and gives it back after', () => {
      const root = document.documentElement.style.touchAction;
      const body = document.body.style.touchAction;
      const release = holdZoom();
      expect(meta.content).toContain('user-scalable=no');
      expect(document.documentElement.style.touchAction).toBe('none');
      expect(document.body.style.touchAction).toBe('none');
      // Safari's pinch and double tap, and a two-finger move as a backstop.
      expect(cancelled('gesturestart')).toBe(true);
      expect(cancelled('gesturechange')).toBe(true);
      expect(cancelled('dblclick')).toBe(true);
      expect(cancelled('touchmove', 2)).toBe(true);
      // One thumb on the pad still moves freely.
      expect(cancelled('touchmove', 1)).toBe(false);

      release();
      expect(meta.content).toBe(viewport);
      expect(document.documentElement.style.touchAction).toBe(root);
      expect(document.body.style.touchAction).toBe(body);
      expect(cancelled('gesturestart')).toBe(false);
      expect(cancelled('touchmove', 2)).toBe(false);
    });

    it('lets go only with the last hold, and ignores a second release', () => {
      const first = holdZoom();
      const second = holdZoom();
      first();
      first();
      expect(meta.content).toContain('user-scalable=no');
      second();
      expect(meta.content).toBe(viewport);
    });
  });
});
