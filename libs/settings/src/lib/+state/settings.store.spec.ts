import { TestBed } from '@angular/core/testing';
import { AudioSettingsService } from '@libs/audio-settings';
import { ControlsSettingsService } from '@libs/controls-settings';
import { Language } from '@libs/entity';
import { ThemeService } from '@libs/theme';
import { UpdateLanguageService } from '@libs/translation';
import type { Mocked } from 'vitest';
import { REDUCE_MOTION_STORAGE_KEY, SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let themeService: Mocked<Pick<ThemeService, 'setPreference'>>;
  let languageService: Mocked<Pick<UpdateLanguageService, 'changeLanguage'>>;

  const createStore = () => {
    TestBed.configureTestingModule({
      providers: [
        SettingsStore,
        {
          provide: ThemeService,
          useValue: {
            ...themeService,
            preference: () => 'system',
            isDark: () => false,
          },
        },
        {
          provide: UpdateLanguageService,
          useValue: {
            ...languageService,
            currentLanguage: () => Language.English,
          },
        },
      ],
    });
    return TestBed.inject(SettingsStore);
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('reduce-motion');
    themeService = { setPreference: vi.fn() };
    languageService = { changeLanguage: vi.fn() };
  });

  it('reads theme and language through the owning services rather than copying them', () => {
    const store = createStore();

    expect(store.themePreference()).toBe('system');
    expect(store.currentLanguage()).toBe(Language.English);
  });

  it('forwards a theme change to ThemeService', () => {
    createStore().setThemePreference('dark');

    expect(themeService.setPreference).toHaveBeenCalledWith('dark');
  });

  it('reads and forwards the audio choices through AudioSettingsService', () => {
    const store = createStore();
    const audio = TestBed.inject(AudioSettingsService);
    expect(store.music()).toBe(false);
    expect(store.sfx()).toBe(true);

    store.setMusic(true);
    store.setSfx(false);

    expect(audio.music()).toBe(true);
    expect(audio.sfx()).toBe(false);
    expect(store.music()).toBe(true);
    expect(store.sfx()).toBe(false);
  });

  it('reads and forwards the keyboard hand through ControlsSettingsService', () => {
    const store = createStore();
    const controls = TestBed.inject(ControlsSettingsService);
    expect(store.keyScheme()).toBe('wasd');
    store.setKeyScheme('arrows');
    expect(controls.scheme()).toBe('arrows');
    expect(store.keyScheme()).toBe('arrows');
  });

  it('forwards a language change to UpdateLanguageService', () => {
    createStore().setLanguage(Language.Portuguese);

    expect(languageService.changeLanguage).toHaveBeenCalledWith(
      Language.Portuguese,
    );
  });

  it('persists reduce-motion and reflects it on the document', () => {
    createStore().setReduceMotion(true);

    expect(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe('true');
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(
      true,
    );
  });

  it('restores the persisted reduce-motion value on init', () => {
    localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, 'true');

    const store = createStore();
    // `onInit` runs on first injection, so reading the signal is enough.
    expect(store.reduceMotion()).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(
      true,
    );
  });

  it('defaults to off when nothing is persisted', () => {
    expect(createStore().reduceMotion()).toBe(false);
  });
});
