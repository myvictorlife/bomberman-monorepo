import { TestBed } from '@angular/core/testing';
import {
  AUDIO_STORAGE_KEY,
  AudioSettingsService,
} from './audio-settings.service';

describe('AudioSettingsService', () => {
  beforeEach(() => localStorage.clear());

  const create = () => TestBed.inject(AudioSettingsService);

  it('starts with the music off and the effects on', () => {
    const audio = create();
    expect(audio.music()).toBe(false);
    expect(audio.sfx()).toBe(true);
  });

  it('remembers both choices across sessions', () => {
    const audio = create();

    audio.setMusic(true);
    audio.setSfx(false);
    TestBed.flushEffects();

    expect(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? '{}')).toEqual(
      { music: true, muted: true },
    );

    TestBed.resetTestingModule();
    const again = create();
    expect(again.music()).toBe(true);
    expect(again.sfx()).toBe(false);
  });

  it('falls back to the defaults when the saved value is not usable', () => {
    localStorage.setItem(AUDIO_STORAGE_KEY, '{not json');
    expect(create().music()).toBe(false);

    TestBed.resetTestingModule();
    localStorage.setItem(AUDIO_STORAGE_KEY, '"a string"');
    expect(create().sfx()).toBe(true);
  });

  it('survives a storage that throws', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    const audio = create();
    audio.setMusic(true);
    expect(() => TestBed.flushEffects()).not.toThrow();
    expect(audio.music()).toBe(true);

    setItem.mockRestore();
    getItem.mockRestore();
  });
});
