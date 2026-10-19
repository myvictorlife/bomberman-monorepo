import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { ArenaHandle, ArenaOptions, HudSnapshot } from '@libs/game-client';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { PlayStore } from '../../+state/play.store';
import { ARENA_LAUNCHER } from '../../services/arena-launcher';
import { keyboardControls, matchFromQuery, localPlayers, Play } from './play';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      PLAY: {
        TITLE: 'Battle',
        PLAYER: 'Player {{n}}',
        WINNER: 'Player {{n}} wins!',
        DRAW: 'Draw!',
        RESTART: 'Play again',
        SOUND_ON: 'Sound on',
        SOUND_OFF: 'Sound off',
        ERROR: 'Could not start',
        MOUNT: 'Mount',
        ABILITY: 'Ability',
        ABILITY_READY: 'Ready',
        ABILITY_IN: '{{s}} s',
        ABILITY_ACTIVE: 'Go!',
        PIERCE: 'Pierce',
        GLOVE: 'Glove',
        REMOTE: 'Remote',
        VEST: 'Vest',
        BOT: 'CPU {{n}}',
        BOT_WINS: 'CPU {{n}} wins!',
        TAP_TO_PLAY: 'Tap to play',
        EXPAND: 'Full screen',
        COLLAPSE: 'Leave full screen',
      },
      MOUNTS: { TATU: { NAME: 'Tatu' } },
    });
  }
}

/** Stands in for Phaser: records what the page asked for, resolves on demand. */
class FakeLauncher {
  options: ArenaOptions | null = null;
  host: HTMLElement | null = null;
  /** Player 1's hands, as the page gets them from `controller('p1')`. */
  readonly controller = {
    press: vi.fn(),
    release: vi.fn(),
    clear: vi.fn(),
    bomb: vi.fn(),
    ability: vi.fn(),
    detonate: vi.fn(),
  };
  readonly handle = {
    restart: vi.fn(),
    setMuted: vi.fn(),
    setMusic: vi.fn(),
    controller: vi.fn(() => this.controller),
    destroy: vi.fn(),
  } satisfies ArenaHandle;
  private resolve!: (handle: ArenaHandle) => void;
  private reject!: (error: unknown) => void;

  readonly launch = (host: HTMLElement, options: ArenaOptions) => {
    this.host = host;
    this.options = options;
    return new Promise<ArenaHandle>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  };

  succeed(): Promise<void> {
    this.resolve(this.handle);
    return Promise.resolve();
  }

  fail(): Promise<void> {
    this.reject(new Error('no webgl'));
    return Promise.resolve();
  }

  hud(over: Partial<HudSnapshot> = {}): void {
    this.options?.onHud?.({
      phase: 'playing',
      winnerId: null,
      secondsLeft: 161,
      closing: false,
      players: [
        {
          id: 'p1',
          slot: 0,
          colorSlot: 0,
          name: 'P1',
          alive: true,
          bombs: 1,
          fire: 2,
          speed: 0,
          mount: null,
          abilityReadyIn: 0,
          abilityActive: false,
          pierce: false,
          remote: false,
          glove: false,
          kick: false,
          vestSeconds: 0,
        },
        {
          id: 'p2',
          slot: 1,
          colorSlot: 1,
          name: 'P2',
          alive: false,
          bombs: 3,
          fire: 4,
          speed: 1,
          mount: null,
          abilityReadyIn: 0,
          abilityActive: false,
          pierce: false,
          remote: false,
          glove: false,
          kick: false,
          vestSeconds: 0,
        },
      ],
      ...over,
    });
  }
}

describe('Play', () => {
  let spectator: Spectator<Play>;
  let launcher: FakeLauncher;

  const createComponent = createComponentFactory({
    component: Play,
    providers: [
      PlayStore,
      provideRouter([]),
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
    detectChanges: false,
  });

  beforeEach(() => {
    localStorage.clear();
    launcher = new FakeLauncher();
    spectator = createComponent({
      providers: [{ provide: ARENA_LAUNCHER, useValue: launcher.launch }],
    });
    spectator.detectChanges();
  });

  const settle = async () => {
    await spectator.fixture.whenStable();
    spectator.detectChanges();
  };

  it('renders the title and starts a match against one medium bot in the arena host', async () => {
    await settle();

    expect(spectator.query('[data-testid="play-title"]')).toHaveText('Battle');
    expect(launcher.host).toBe(spectator.query('[data-testid="play-arena"]'));
    expect(launcher.options?.players.map((p) => p.id)).toEqual(['p1', 'cpu1']);
    expect(launcher.options?.players.map((p) => p.characterId)).toEqual([
      'novato',
      'faisca',
    ]);
    expect(launcher.options?.bots).toEqual([{ id: 'cpu1', level: 'medium' }]);
    // Alone, both hands drive player 1.
    expect(launcher.options?.controls.map((c) => c.playerId)).toEqual([
      'p1',
      'p1',
    ]);
    expect(launcher.options?.controls.map((c) => c.keys.up)).toEqual([
      'W',
      'UP',
    ]);
    expect(spectator.query('lib-spinner')).toExist();
  });

  it('starts a new match when the line-up changes, the URL following it', async () => {
    await settle();
    await launcher.succeed();
    await settle();

    spectator.component.setBots('3');
    spectator.component.setLevel('hard');
    await settle();
    expect(launcher.handle.destroy).toHaveBeenCalled();
    expect(launcher.options?.bots).toEqual([
      { id: 'cpu1', level: 'hard' },
      { id: 'cpu2', level: 'hard' },
      { id: 'cpu3', level: 'hard' },
    ]);
    expect(spectator.component.setup()).toEqual({
      bots: 3,
      level: 'hard',
      secondHuman: false,
    });

    spectator.component.setSecondHuman(true);
    await settle();
    expect(launcher.options?.players.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'cpu1',
      'cpu2',
      'cpu3',
    ]);
    expect(launcher.options?.controls.map((c) => c.playerId)).toEqual([
      'p1',
      'p2',
    ]);
    // Five spawn points: with two people, four bots would not fit.
    expect(spectator.component.botCountOptions().map((o) => o.value)).toEqual([
      '0',
      '1',
      '2',
      '3',
    ]);
    spectator.component.setLevel('impossible');
    expect(spectator.component.setup().level).toBe('hard');
  });

  it('seats player 1 on the chosen hand and player 2 on the other', async () => {
    await settle();
    await launcher.succeed();
    await settle();
    expect(spectator.query('[data-testid="play-setup-keys"]')).toExist();

    spectator.component.setKeyScheme('arrows');
    await settle();
    expect(localStorage.getItem('detona-controls')).toContain('arrows');
    expect(launcher.handle.destroy).toHaveBeenCalled();
    expect(launcher.options?.controls.map((c) => c.keys.up)).toEqual([
      'UP',
      'W',
    ]);

    spectator.component.setSecondHuman(true);
    await settle();
    expect(
      launcher.options?.controls.map((c) => [c.playerId, c.keys.bomb]),
    ).toEqual([
      ['p1', 'ENTER'],
      ['p2', 'SPACE'],
    ]);
    // Anything else is ignored.
    spectator.component.setKeyScheme('joystick');
    expect(spectator.component.keyScheme()).toBe('arrows');
  });

  it('names the bots, and announces a bot that wins', async () => {
    await settle();
    await launcher.succeed();
    const cpu = {
      id: 'cpu1',
      slot: 1,
      colorSlot: 1,
      name: 'CPU 1',
      alive: true,
      bombs: 1,
      fire: 2,
      speed: 0,
      mount: null,
      abilityReadyIn: 0,
      abilityActive: false,
      pierce: false,
      remote: false,
      glove: false,
      kick: false,
      vestSeconds: 0,
    };
    launcher.hud({ players: [cpu], phase: 'over', winnerId: 'cpu1' });
    await settle();
    expect(spectator.query('[data-testid="play-hud-player"]')).toHaveText(
      'CPU 1',
    );
    expect(spectator.query('[data-testid="play-result"]')).toHaveText(
      'CPU 1 wins!',
    );
  });

  it('gives player 1 the chosen character and player 2 the next one, wrapping around', () => {
    expect(localPlayers('faisca').map((p) => p.characterId)).toEqual([
      'faisca',
      'byte',
    ]);
    expect(localPlayers('lia').map((p) => p.characterId)).toEqual([
      'lia',
      'motoca',
    ]);
    expect(localPlayers('motoca').map((p) => p.characterId)).toEqual([
      'motoca',
      'tiao',
    ]);
    expect(localPlayers('tiao').map((p) => p.characterId)).toEqual([
      'tiao',
      'novato',
    ]);
  });

  it('hides the spinner once the arena is running', async () => {
    await settle();
    await launcher.succeed();
    await settle();

    expect(spectator.inject(PlayStore).status()).toBe('ready');
    expect(spectator.query('lib-spinner')).not.toExist();
  });

  it('shows an error when the arena cannot start', async () => {
    await settle();
    await launcher.fail();
    await settle();

    expect(spectator.query('[data-testid="play-error"]')).toHaveText(
      'Could not start',
    );
  });

  it('shows each player stats from the HUD, greying out the eliminated', async () => {
    await settle();
    await launcher.succeed();
    launcher.hud();
    await settle();

    const rows = spectator.queryAll('[data-testid="play-hud-player"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveText('Player 1');
    expect(rows[1]).toHaveText('3');
    expect(rows[1]).toHaveClass('play__player--out');
    expect(rows[0]).not.toHaveClass('play__player--out');
    expect(spectator.query('[data-testid="play-hud-mount"]')).not.toExist();
  });

  it('shows the mount a player is riding', async () => {
    await settle();
    await launcher.succeed();
    launcher.hud({
      players: [
        {
          id: 'p1',
          slot: 0,
          colorSlot: 0,
          name: 'P1',
          alive: true,
          bombs: 1,
          fire: 2,
          speed: 0,
          mount: 'tatu',
          abilityReadyIn: 4,
          abilityActive: false,
          pierce: true,
          remote: false,
          glove: true,
          kick: false,
          vestSeconds: 3,
        },
      ],
    });
    await settle();

    expect(spectator.query('[data-testid="play-hud-mount"]')).toHaveAttribute(
      'data-tip',
      'Mount: Tatu',
    );
    expect(spectator.query('[data-testid="play-hud-ability"]')).toHaveText(
      '4 s',
    );
    expect(spectator.query('[data-testid="play-hud-pierce"]')).toHaveAttribute(
      'aria-label',
      'Pierce',
    );
    expect(spectator.query('[data-testid="play-hud-remote"]')).not.toExist();
    expect(spectator.query('[data-testid="play-hud-glove"]')).toHaveAttribute(
      'aria-label',
      'Glove',
    );
    expect(spectator.query('[data-testid="play-hud-kick"]')).not.toExist();
    expect(spectator.query('[data-testid="play-hud-vest"]')).toHaveText('3 s');
  });

  it('shows the round clock, then that the arena is closing', async () => {
    await settle();
    await launcher.succeed();
    launcher.hud();
    await settle();
    expect(spectator.query('[data-testid="play-clock"]')).toHaveText('2:41');

    launcher.hud({ secondsLeft: 0, closing: true });
    await settle();
    expect(spectator.query('[data-testid="play-clock"]')).toHaveText(
      'PLAY.CLOSING',
    );
  });

  it('announces the winner and restarts the round', async () => {
    await settle();
    await launcher.succeed();
    await settle();
    launcher.hud({ phase: 'over', winnerId: 'p2' });
    await settle();

    expect(spectator.query('[data-testid="play-result"]')).toHaveText(
      'Player 2 wins!',
    );

    spectator.click('[data-testid="play-restart"]');
    expect(launcher.handle.restart).toHaveBeenCalled();
  });

  it('announces a draw', async () => {
    await settle();
    await launcher.succeed();
    await settle();
    launcher.hud({ phase: 'over', winnerId: null });
    await settle();

    expect(spectator.query('[data-testid="play-result"]')).toHaveText('Draw!');
  });

  it('stops the game when the page is left', async () => {
    await settle();
    await launcher.succeed();
    await settle();

    spectator.fixture.destroy();

    expect(launcher.handle.destroy).toHaveBeenCalled();
  });

  it('stops a game that finished loading after the page was left', async () => {
    await settle();
    spectator.fixture.destroy();

    await launcher.succeed();
    await Promise.resolve();

    expect(launcher.handle.destroy).toHaveBeenCalled();
  });

  it('toggles the sound, starting new arenas with the current setting', async () => {
    await settle();
    expect(launcher.options?.muted).toBe(false);
    await launcher.succeed();
    await settle();

    spectator.click('[data-testid="play-sound"]');

    expect(launcher.handle.setMuted).toHaveBeenCalledWith(true);
    expect(spectator.query('[data-testid="play-sound"]')).toHaveText(
      'Sound off',
    );
    expect(spectator.query('[data-testid="play-sound"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    spectator.click('[data-testid="play-sound"]');
    expect(launcher.handle.setMuted).toHaveBeenLastCalledWith(false);
  });

  it('falls back to the first arena and a fresh seed', async () => {
    await settle();

    expect(launcher.options?.mapId).toBe('subestacao');
    expect(launcher.options?.seed).toBeUndefined();
  });

  it('toggles the music, starting new arenas with the current setting', async () => {
    await settle();
    expect(launcher.options?.music).toBe(false);
    await launcher.succeed();
    await settle();

    spectator.click('[data-testid="play-music"]');

    expect(launcher.handle.setMusic).toHaveBeenCalledWith(true);
    expect(spectator.query('[data-testid="play-music"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    spectator.click('[data-testid="play-music"]');
    expect(launcher.handle.setMusic).toHaveBeenLastCalledWith(false);
  });

  it('ignores restart before the arena is running', () => {
    spectator.component.restart();

    expect(launcher.handle.restart).not.toHaveBeenCalled();
  });
  describe('on a touch screen', () => {
    /** Touch and full screen, in a DOM that has neither. */
    const touchDown = () =>
      document.dispatchEvent(
        Object.assign(new MouseEvent('pointerdown', { bubbles: true }), {
          pointerType: 'touch',
        }),
      );
    const fullscreen = (element: Element | null) =>
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => element,
      });

    afterEach(() => {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    });

    it('is a keyboard page until a finger touches it', async () => {
      await settle();
      expect(spectator.component.touch()).toBe(false);
      expect(spectator.query('[data-testid="play-setup-p2"]')).toExist();
      expect(spectator.query('[data-testid="play-tap"]')).toBeNull();
      expect(spectator.query('[data-testid="play-gamepad"]')).toBeNull();
    });

    it('readies the controller and drops the second player once touched', async () => {
      await settle();
      spectator.component.setSecondHuman(true);
      await settle();

      touchDown();
      await settle();
      expect(spectator.component.touch()).toBe(true);
      // A touch on a laptop's screen is not a phone: the page stays.
      expect(spectator.component.game()).toBe(false);
      expect(spectator.component.setup().secondHuman).toBe(false);
      expect(spectator.query('[data-testid="play-setup-p2"]')).toBeNull();
      expect(launcher.options?.controls.map((c) => c.playerId)).toEqual([
        'p1',
        'p1',
      ]);
      expect(spectator.query('[data-testid="play-gamepad"]')).toBeNull();

      spectator.click('[data-testid="play-enter"]');
      await settle();
      expect(spectator.query('[data-testid="play-page"]')).toHaveClass(
        'play--game',
      );
      expect(spectator.query('[data-testid="play-gamepad"]')).toExist();
      expect(spectator.query('[data-testid="play-tap"]')).toBeNull();
    });

    it('drives player 1 from the on-screen controller', async () => {
      await settle();
      touchDown();
      spectator.component.enterGame();
      await launcher.succeed();
      await settle();
      expect(launcher.handle.controller).toHaveBeenCalledWith('p1');

      spectator.component.onPadDirection('up');
      expect(launcher.controller.press).toHaveBeenCalledWith('up');
      spectator.component.onPadDirection('left');
      expect(launcher.controller.release).toHaveBeenCalledWith('up');
      expect(launcher.controller.press).toHaveBeenLastCalledWith('left');
      spectator.component.onPadDirection(null);
      expect(launcher.controller.release).toHaveBeenLastCalledWith('left');
      expect(launcher.controller.press).toHaveBeenCalledTimes(2);

      spectator.component.padBomb();
      spectator.component.padAbility();
      spectator.component.padDetonate();
      expect(launcher.controller.bomb).toHaveBeenCalledTimes(1);
      expect(launcher.controller.ability).toHaveBeenCalledTimes(1);
      expect(launcher.controller.detonate).toHaveBeenCalledTimes(1);

      // Hiding the controller lets go of whatever it held.
      spectator.component.onPadDirection('down');
      spectator.component.togglePad();
      await settle();
      expect(launcher.controller.release).toHaveBeenLastCalledWith('down');
      expect(spectator.query('[data-testid="play-gamepad"]')).toBeNull();
      spectator.component.togglePad();
      await settle();
      expect(spectator.query('[data-testid="play-gamepad"]')).toExist();
    });

    it('shows the ability and detonate buttons only when player 1 can use them', async () => {
      await settle();
      touchDown();
      spectator.component.enterGame();
      await launcher.succeed();
      await settle();
      expect(spectator.query('[data-testid="gamepad-bomb"]')).toExist();
      expect(spectator.query('[data-testid="gamepad-ability"]')).toBeNull();
      expect(spectator.query('[data-testid="gamepad-detonate"]')).toBeNull();

      launcher.hud();
      await settle();
      const me = spectator.component.players()[0];
      launcher.hud({
        players: [
          { ...me, mount: 'tatu', remote: true },
          ...spectator.component.players().slice(1),
        ],
      });
      await settle();
      expect(spectator.query('[data-testid="gamepad-ability"]')).toExist();
      expect(spectator.query('[data-testid="gamepad-detonate"]')).toExist();
    });

    it('shows a HUD strip over the arena in game mode, and leaves it on Escape', async () => {
      await settle();
      await launcher.succeed();
      launcher.hud();
      await settle();
      expect(spectator.query('[data-testid="play-strip"]')).toBeNull();

      const requestFullscreen = vi.fn().mockResolvedValue(undefined);
      document.documentElement.requestFullscreen = requestFullscreen;
      spectator.click('[data-testid="play-expand"]');
      await settle();
      expect(spectator.component.game()).toBe(true);
      expect(requestFullscreen).toHaveBeenCalled();
      expect(
        spectator.queryAll('[data-testid="play-strip-player"]'),
      ).toHaveLength(2);
      // A mouse page: no controller unless asked for.
      expect(spectator.query('[data-testid="play-gamepad"]')).toBeNull();
      spectator.click('[data-testid="play-pad"]');
      await settle();
      expect(spectator.query('[data-testid="play-gamepad"]')).toExist();

      fullscreen(spectator.element);
      const exitFullscreen = vi.fn().mockResolvedValue(undefined);
      document.exitFullscreen = exitFullscreen;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(spectator.component.game()).toBe(false);
      expect(exitFullscreen).toHaveBeenCalled();
      expect(spectator.query('[data-testid="play-strip"]')).toBeNull();

      // The browser left full screen by itself: the page follows.
      spectator.click('[data-testid="play-expand"]');
      await settle();
      expect(spectator.component.game()).toBe(true);
      fullscreen(null);
      document.dispatchEvent(new Event('fullscreenchange'));
      await settle();
      expect(spectator.component.game()).toBe(false);
    });
  });
});

describe('Play on a phone', () => {
  let spectator: Spectator<Play>;
  let launcher: FakeLauncher;
  /** How the phone is held when the page opens; `listeners` hear it turn. */
  let portrait = false;
  const listeners: (() => void)[] = [];

  const createComponent = createComponentFactory({
    component: Play,
    providers: [
      PlayStore,
      provideRouter([]),
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
    detectChanges: false,
  });

  beforeEach(() => {
    // A coarse pointer: what a phone's screen reports (jsdom has no matchMedia).
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) =>
        ({
          // Read on every check, like the real thing: the phone can turn.
          get matches() {
            return (
              query === '(pointer: coarse)' ||
              (query === '(orientation: portrait)' && portrait)
            );
          },
          media: query,
          addEventListener: (_: string, listener: () => void) => {
            listeners.push(listener);
          },
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    });
    launcher = new FakeLauncher();
  });

  /** Opens the page — after the test has set how the phone is held and what it remembers. */
  const open = () => {
    spectator = createComponent({
      providers: [{ provide: ARENA_LAUNCHER, useValue: launcher.launch }],
    });
    spectator.detectChanges();
  };

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    localStorage.clear();
    portrait = false;
    listeners.length = 0;
  });

  const settle = async () => {
    await spectator.fixture.whenStable();
    spectator.detectChanges();
  };

  it('turns the game sideways when held upright, unless told to play upright', async () => {
    open();
    await settle();
    expect(spectator.component.sideways()).toBe(false);
    expect(spectator.query('[data-testid="play-turn"]')).toBeNull();

    // The phone turns upright: the whole game goes a quarter clockwise.
    portrait = true;
    for (const listener of listeners) listener();
    await settle();
    expect(spectator.component.sideways()).toBe(true);
    expect(spectator.query('[data-testid="play-page"]')).toHaveClass(
      'play--sideways',
    );
    expect(spectator.query('[data-testid="play-turn"]')).toExist();
    // Phaser measures the host through the turn: its width is the screen's height.
    const host = spectator.query<HTMLElement>('[data-testid="play-arena"]')!;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 400, 800),
    );
    expect(host.getBoundingClientRect().width).toBe(800);
    expect(host.getBoundingClientRect().height).toBe(400);

    spectator.click('[data-testid="play-turn"]');
    await settle();
    expect(spectator.component.sideways()).toBe(false);
    expect(spectator.query('[data-testid="play-page"]')).not.toHaveClass(
      'play--sideways',
    );
    expect(localStorage.getItem('play.upright')).toBe('1');
    expect(host.getBoundingClientRect().width).toBe(400);
    vi.restoreAllMocks();

    spectator.click('[data-testid="play-turn"]');
    await settle();
    expect(spectator.component.sideways()).toBe(true);
    expect(localStorage.getItem('play.upright')).toBe('0');
  });

  it('remembers the choice to play upright', async () => {
    localStorage.setItem('play.upright', '1');
    portrait = true;
    open();
    await settle();
    expect(spectator.component.portrait()).toBe(true);
    expect(spectator.component.sideways()).toBe(false);
  });

  it('goes straight to game mode behind "tap to play", and starts fresh on the tap', async () => {
    open();
    await spectator.fixture.whenStable();
    spectator.detectChanges();
    expect(spectator.component.touch()).toBe(true);
    expect(spectator.component.game()).toBe(true);
    expect(spectator.query('[data-testid="play-page"]')).toHaveClass(
      'play--game',
    );
    expect(spectator.query('[data-testid="play-gamepad"]')).toExist();
    expect(launcher.options?.controls.map((c) => c.playerId)).toEqual([
      'p1',
      'p1',
    ]);

    await launcher.succeed();
    await spectator.fixture.whenStable();
    spectator.detectChanges();
    expect(spectator.query('[data-testid="play-tap"]')).toHaveText(
      'Tap to play',
    );

    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreen;
    spectator.click('[data-testid="play-tap"]');
    await spectator.fixture.whenStable();
    spectator.detectChanges();
    expect(spectator.query('[data-testid="play-tap"]')).toBeNull();
    expect(requestFullscreen).toHaveBeenCalled();
    expect(launcher.handle.restart).toHaveBeenCalled();
  });
});

describe('Play from a match link', () => {
  const launcher = new FakeLauncher();
  const createComponent = createComponentFactory({
    component: Play,
    providers: [
      PlayStore,
      provideRouter([]),
      { provide: ARENA_LAUNCHER, useValue: launcher.launch },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap({
              map: 'autodromo',
              seed: '42',
              bots: '2',
              level: 'easy',
              p2: '1',
            }),
          },
        },
      },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  it('plays on the arena and seed the URL asks for', async () => {
    const spectator = createComponent();
    await spectator.fixture.whenStable();
    spectator.detectChanges();

    expect(launcher.options?.mapId).toBe('autodromo');
    expect(launcher.options?.seed).toBe(42);
    expect(launcher.options?.players.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'cpu1',
      'cpu2',
    ]);
    expect(launcher.options?.bots?.map((b) => b.level)).toEqual([
      'easy',
      'easy',
    ]);
    expect(spectator.query('[data-testid="play-arena-name"]')).toHaveText(
      'MAPS.AUTODROMO.NAME',
    );
  });
});

describe('keyboardControls', () => {
  it('gives both hands to a lone player, and splits them between two', () => {
    expect(keyboardControls('wasd', false).map((c) => c.playerId)).toEqual([
      'p1',
      'p1',
    ]);
    expect(
      keyboardControls('arrows', true).map((c) => [c.playerId, c.keys.up]),
    ).toEqual([
      ['p1', 'UP'],
      ['p2', 'W'],
    ]);
  });
});

describe('matchFromQuery', () => {
  const q = (o: Record<string, string>) => convertToParamMap(o);

  it('reads a known map and a positive integer seed', () => {
    expect(matchFromQuery(q({ map: 'autodromo', seed: '1234' }))).toEqual({
      mapId: 'autodromo',
      seed: 1234,
    });
  });

  it('rejects an unknown map and a bad seed', () => {
    expect(matchFromQuery(q({ map: 'lua', seed: 'abc' }))).toEqual({
      mapId: 'subestacao',
      seed: undefined,
    });
    expect(matchFromQuery(q({ seed: '-3' })).seed).toBeUndefined();
    expect(matchFromQuery(q({ seed: '1.5' })).seed).toBeUndefined();
  });
});
