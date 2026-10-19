import { TestBed } from '@angular/core/testing';
import { DEFAULT_MAP_ID } from '@libs/game-core';
import { ArenasStore } from './arenas.store';

describe('ArenasStore', () => {
  const createStore = () => {
    TestBed.configureTestingModule({ providers: [ArenasStore] });
    return TestBed.inject(ArenasStore);
  };

  it('lists every arena with the first one in focus', () => {
    const store = createStore();

    expect(store.maps()).toEqual(['subestacao', 'autodromo', 'gramado']);
    expect(store.selected()).toBe(DEFAULT_MAP_ID);
  });

  it('moves the focus', () => {
    const store = createStore();

    store.select('autodromo');

    expect(store.selected()).toBe('autodromo');
  });
});
