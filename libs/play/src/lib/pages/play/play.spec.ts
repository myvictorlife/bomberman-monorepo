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
import { matchFromQuery, localPlayers, Play } from './play';

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
      },
      MOUNTS: { TATU: { NAME: 'Tatu' } },
    });
  }
}

/** Stands in for Phaser: records what the page asked for, resolves on demand. */
class FakeLauncher {
  options: ArenaOptions | null = null;
  host: HTMLElement | null = null;
  readonly handle = {
    restart: vi.fn(),
    setMuted: vi.fn(),
    setMusic: vi.fn(),
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
    expect(launcher.options?.controls.map((c) => c.playerId)).toEqual(['p1']);
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
