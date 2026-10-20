import {
  enterFullScreen,
  isTouchScreen,
  leaveFullScreen,
  lockOrientation,
  measureTurned,
  readUpright,
  turnedRect,
  unlockOrientation,
  UPRIGHT_KEY,
  watchPortrait,
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
});
