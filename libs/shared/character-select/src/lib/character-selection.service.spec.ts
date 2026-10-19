import { TestBed } from '@angular/core/testing';
import { DEFAULT_CHARACTER_ID } from '@libs/game-core';
import {
  CHARACTER_STORAGE_KEY,
  CharacterSelectionService,
} from './character-selection.service';

describe('CharacterSelectionService', () => {
  beforeEach(() => localStorage.clear());

  const create = () => TestBed.inject(CharacterSelectionService);

  it('starts with the default character', () => {
    expect(create().selectedId()).toBe(DEFAULT_CHARACTER_ID);
  });

  it('remembers the choice across sessions', () => {
    const service = create();

    service.select('lia');
    TestBed.flushEffects();

    expect(service.selectedId()).toBe('lia');
    expect(localStorage.getItem(CHARACTER_STORAGE_KEY)).toBe('lia');
  });

  it('restores a saved choice and ignores one that is not in the roster', () => {
    localStorage.setItem(CHARACTER_STORAGE_KEY, 'byte');
    expect(create().selectedId()).toBe('byte');

    TestBed.resetTestingModule();
    localStorage.setItem(CHARACTER_STORAGE_KEY, 'bomberman');
    expect(create().selectedId()).toBe(DEFAULT_CHARACTER_ID);
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

    const service = create();
    expect(service.selectedId()).toBe(DEFAULT_CHARACTER_ID);
    service.select('byte');
    expect(() => TestBed.flushEffects()).not.toThrow();
    expect(service.selectedId()).toBe('byte');

    setItem.mockRestore();
    getItem.mockRestore();
  });
});
