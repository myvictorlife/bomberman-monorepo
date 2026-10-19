import { QUIPS, SOUND_EFFECTS } from '@libs/game-client';
import { provideRouter } from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { SoundsStore } from '../../+state/sounds.store';
import { AUDIO_PLAYERS, AudioPlayers } from '../../services/audio-players';
import { QUIP_MOMENTS, Sounds } from './sounds';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      SOUNDS: {
        TITLE: 'Sounds',
        THEME: 'Arena theme',
        EFFECT_EXPLODE: 'Explosion',
      },
    });
  }
}

let voiceList = [
  { name: 'Luciana', lang: 'pt-BR' },
  { name: 'Joana', lang: 'pt-PT' },
];
let chosenName: string | null = null;
const fakePlayers = (): AudioPlayers =>
  ({
    music: { start: vi.fn(), stop: vi.fn(), close: vi.fn() },
    sfx: { play: vi.fn(), close: vi.fn() },
    voice: {
      speak: vi.fn(),
      close: vi.fn(),
      choose: vi.fn((name: string | null) => (chosenName = name)),
      available: () => voiceList,
      current: () =>
        voiceList.find((v) => v.name === chosenName) ?? voiceList[0] ?? null,
    },
  }) as unknown as AudioPlayers;

/** A stand-in for the browser's `speechSynthesis`, which only matters here for its events. */
const listeners: (() => void)[] = [];
const fakeSynth = {
  addEventListener: vi.fn((_: string, cb: () => void) => listeners.push(cb)),
  removeEventListener: vi.fn(),
};

describe('Sounds', () => {
  let spectator: Spectator<Sounds>;
  let players: AudioPlayers;

  const createComponent = createComponentFactory({
    component: Sounds,
    providers: [
      SoundsStore,
      provideRouter([]),
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    voiceList = [
      { name: 'Luciana', lang: 'pt-BR' },
      { name: 'Joana', lang: 'pt-PT' },
    ];
    chosenName = null;
    listeners.length = 0;
    (globalThis as { speechSynthesis?: unknown }).speechSynthesis = fakeSynth;
    players = fakePlayers();
    spectator = createComponent({
      providers: [{ provide: AUDIO_PLAYERS, useValue: players }],
    });
  });

  afterEach(() => {
    delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
  });

  it('lists every effect and every line the announcer knows', () => {
    expect(spectator.query('h1')).toHaveText('Sounds');
    expect(spectator.queryAll('[data-testid="sounds-effect"]')).toHaveLength(
      SOUND_EFFECTS.length,
    );
    const lines = QUIP_MOMENTS.reduce((n, m) => n + QUIPS[m].length, 0);
    expect(spectator.queryAll('[data-testid="sounds-line"]')).toHaveLength(
      lines,
    );
    expect(spectator.component.effectKey('mount-pato')).toBe(
      'SOUNDS.EFFECT_MOUNT_PATO',
    );
    expect(spectator.component.momentKey('power-fire')).toBe(
      'SOUNDS.MOMENT_POWER_FIRE',
    );
  });

  it('starts and stops the theme', () => {
    spectator.click('[data-testid="sounds-theme"]');
    expect(players.music.start).toHaveBeenCalled();
    expect(spectator.query('[data-testid="sounds-theme"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(spectator.query('[data-testid="sounds-last"]')).toHaveText('theme');

    spectator.click('[data-testid="sounds-theme"]');
    expect(players.music.stop).toHaveBeenCalled();
    expect(spectator.query('[data-testid="sounds-theme"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('plays an effect and says a line, noting what was played', () => {
    spectator.click('[data-effect="explode"]');
    expect(players.sfx.play).toHaveBeenCalledWith('explode');
    expect(spectator.query('[data-testid="sounds-last"]')).toHaveText(
      'explode',
    );

    spectator.click('[data-testid="sounds-line"]');
    expect(players.voice.speak).toHaveBeenCalledWith(QUIPS.block[0]);
    expect(spectator.query('[data-testid="sounds-last"]')).toHaveText(
      QUIPS.block[0] as string,
    );
  });

  it('lists the Portuguese voices with the current one picked, and switches on choice', () => {
    const select = spectator.query(
      '[data-testid="sounds-voice"]',
    ) as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('Luciana');

    spectator.selectOption(select, 'Joana');

    expect(players.voice.choose).toHaveBeenCalledWith('Joana');
    expect(players.voice.speak).toHaveBeenCalledWith(QUIPS.win[0]);
    expect(spectator.inject(SoundsStore).voiceName()).toBe('Joana');
  });

  it('refreshes the list when the browser announces its voices, and lets go on leaving', () => {
    expect(fakeSynth.addEventListener).toHaveBeenCalledWith(
      'voiceschanged',
      expect.any(Function),
    );
    voiceList = [{ name: 'Francisca', lang: 'pt-BR' }];
    listeners.forEach((cb) => cb());

    expect(spectator.component.voices()).toEqual([
      { name: 'Francisca', lang: 'pt-BR' },
    ]);
    expect(spectator.inject(SoundsStore).voiceName()).toBe('Francisca');

    spectator.fixture.destroy();
    expect(fakeSynth.removeEventListener).toHaveBeenCalledWith(
      'voiceschanged',
      expect.any(Function),
    );
  });

  it('goes back to the best voice on an empty choice, even with none to pick', () => {
    spectator.component.chooseVoice('');
    spectator.detectChanges();
    expect(players.voice.choose).toHaveBeenCalledWith(null);
    expect(spectator.query('[data-testid="sounds-last"]')).toHaveText(
      'Luciana',
    );

    voiceList = [];
    spectator.component.chooseVoice('');
    spectator.detectChanges();
    expect(spectator.query('[data-testid="sounds-last"]')).toHaveText('voice');
  });

  it('silences everything when the page is left', () => {
    spectator.fixture.destroy();

    expect(players.music.close).toHaveBeenCalled();
    expect(players.voice.close).toHaveBeenCalled();
    expect(players.sfx.close).toHaveBeenCalled();
  });
});

describe('Sounds without a Portuguese voice', () => {
  const mute = fakePlayers();
  (mute.voice as unknown as { available: () => unknown[] }).available =
    () => [];
  (mute.voice as unknown as { current: () => null }).current = () => null;
  const createComponent = createComponentFactory({
    component: Sounds,
    providers: [
      SoundsStore,
      provideRouter([]),
      { provide: AUDIO_PLAYERS, useValue: mute },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  it('says so, and offers no picker', () => {
    const s = createComponent();

    expect(s.query('[data-testid="sounds-voice-none"]')).toExist();
    expect(s.query('[data-testid="sounds-voice"]')).not.toExist();
  });
});
