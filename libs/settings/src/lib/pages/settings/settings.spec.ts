import { TestBed } from '@angular/core/testing';
import { AudioSettingsService } from '@libs/audio-settings';
import { ControlsSettingsService } from '@libs/controls-settings';
import { provideRouter } from '@angular/router';
import { Language } from '@libs/entity';
import { ThemeService } from '@libs/theme';
import { UpdateLanguageService } from '@libs/translation';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  TranslateLoader,
  TranslationObject,
  provideTranslateService,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { SettingsStore } from '../../+state/settings.store';
import { Settings } from './settings';

/** Serves the strings the template needs without touching HTTP. */
class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      SETTINGS: {
        TITLE: 'Settings',
        LEAD: 'Preferences are stored on this device.',
        THEME: 'Theme',
        THEME_DESC: 'System follows your operating system setting.',
        THEME_LIGHT: 'Light',
        THEME_DARK: 'Dark',
        THEME_SYSTEM: 'System',
        LANGUAGE: 'Language',
        LANGUAGE_DESC: 'Applies immediately.',
        REDUCE_MOTION: 'Reduce motion',
        REDUCE_MOTION_DESC: 'Minimises transitions.',
        MUSIC: 'Arena music',
        MUSIC_DESC: 'The theme that loops during a match.',
        SFX: 'Sound effects',
        SFX_DESC: 'Bombs, pickups, mounts.',
        SECTION_GENERAL: 'General',
        SECTION_AUDIO: 'Audio',
        SOUNDS: 'Sounds and announcer',
        SOUNDS_DESC: 'Hear every sound.',
        SOUNDS_OPEN: 'Open',
        SECTION_CONTROLS: 'Controls',
        KEYS: 'Keyboard',
        KEYS_DESC: 'The hand player 1 drives with.',
        KEYS_WASD: 'W A S D',
        KEYS_ARROWS: 'Arrow keys',
        KEYS_PLAYER_1: 'Player 1:',
        KEYS_PLAYER_2: 'Player 2:',
        KEYS_WASD_HINT: 'WASD walks · Space bombs',
        KEYS_ARROWS_HINT: 'Arrows walk · Enter bombs',
      },
    });
  }
}

describe('Settings', () => {
  let spectator: Spectator<Settings>;

  const themeService = {
    setPreference: vi.fn(),
    preference: () => 'system',
    isDark: () => false,
  };
  const languageService = {
    changeLanguage: vi.fn(),
    currentLanguage: () => Language.English,
  };

  const createComponent = createComponentFactory({
    component: Settings,
    providers: [
      { provide: ThemeService, useValue: themeService },
      { provide: UpdateLanguageService, useValue: languageService },
      // Normally provided by the settings route, so a component-level test has to
      // register it explicitly.
      SettingsStore,
      provideRouter([]),
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('reduce-motion');
    themeService.setPreference.mockReset();
    languageService.changeLanguage.mockReset();
    spectator = createComponent();
    spectator.detectChanges();
  });

  it('renders one row per setting', () => {
    expect(spectator.queryAll('lib-setting-row')).toHaveLength(7);
  });

  it('renders the translated labels rather than raw keys', () => {
    expect(spectator.query('.page-header__title')?.textContent).toContain(
      'Settings',
    );
    expect(spectator.element.textContent).toContain('Reduce motion');
  });

  it('marks the active theme segment, reading it from ThemeService', () => {
    const active = spectator.query('.segmented__segment--active');
    expect(active?.textContent).toContain('System');
  });

  it('forwards a theme click to ThemeService', () => {
    spectator.click(
      spectator
        .queryAll('[role="radiogroup"]')[0]
        .querySelectorAll('button')[1],
    );

    expect(themeService.setPreference).toHaveBeenCalledWith('dark');
  });

  it('forwards a language click to UpdateLanguageService', () => {
    spectator.click(
      spectator
        .queryAll('[role="radiogroup"]')[1]
        .querySelectorAll('button')[1],
    );

    expect(languageService.changeLanguage).toHaveBeenCalledWith(
      Language.Portuguese,
    );
  });

  it('toggles reduce motion and reflects it on the switch', () => {
    expect(
      spectator.query('[role="switch"]')?.getAttribute('aria-checked'),
    ).toBe('false');

    spectator.click('[role="switch"]');
    spectator.detectChanges();

    expect(
      spectator.query('[role="switch"]')?.getAttribute('aria-checked'),
    ).toBe('true');
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(
      true,
    );
  });

  it('turns the arena music on and the effects off through AudioSettingsService', () => {
    const audio = spectator.inject(AudioSettingsService);
    const music = () =>
      spectator.query('[data-testid="settings-music"] [role="switch"]');
    const sfx = () =>
      spectator.query('[data-testid="settings-sfx"] [role="switch"]');
    expect(music()).toHaveAttribute('aria-checked', 'false');
    expect(sfx()).toHaveAttribute('aria-checked', 'true');

    spectator.click(music() as Element);
    spectator.click(sfx() as Element);
    spectator.detectChanges();

    expect(audio.music()).toBe(true);
    expect(audio.sfx()).toBe(false);
    expect(music()).toHaveAttribute('aria-checked', 'true');
    expect(sfx()).toHaveAttribute('aria-checked', 'false');
  });

  it('lets player 1 pick a hand on the keyboard, and says what each one does', () => {
    expect(spectator.query('[data-testid="settings-controls"]')).toHaveText(
      'Controls',
    );
    const hint = spectator.query('[data-testid="settings-keys-hint"]');
    expect(hint).toHaveText('Player 1: WASD walks · Space bombs');
    expect(hint).toHaveText('Player 2: Arrows walk · Enter bombs');

    const arrows = spectator
      .queryAll('[data-testid="settings-keys"] .segmented__segment')
      .find((el) => el.textContent?.includes('Arrow keys'));
    spectator.click(arrows!);
    expect(TestBed.inject(ControlsSettingsService).scheme()).toBe('arrows');
    expect(hint).toHaveText('Player 1: Arrows walk · Enter bombs');
  });

  it('groups audio in its own section, with the way to every sound', () => {
    expect(spectator.query('[data-testid="settings-audio"]')).toHaveText(
      'Audio',
    );
    const link = spectator.query('[data-testid="settings-sounds"]');
    expect(link).toHaveText('Open');
    expect(link).toHaveAttribute('href', '/settings/audio');
  });
});
