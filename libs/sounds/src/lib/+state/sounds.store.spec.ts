import { TestBed } from '@angular/core/testing';
import { initialSoundsState, SoundsStore } from './sounds.store';

describe('SoundsStore', () => {
  const createStore = () => {
    TestBed.configureTestingModule({ providers: [SoundsStore] });
    return TestBed.inject(SoundsStore);
  };

  it('starts silent, with nothing played', () => {
    const store = createStore();

    expect(store.themePlaying()).toBe(initialSoundsState.themePlaying);
    expect(store.lastPlayed()).toBeNull();
  });

  it('tracks the theme and the last thing played', () => {
    const store = createStore();

    store.setThemePlaying(true);
    store.notePlayed('explode');

    expect(store.themePlaying()).toBe(true);
    expect(store.lastPlayed()).toBe('explode');

    store.setVoiceName('Luciana');
    expect(store.voiceName()).toBe('Luciana');
  });
});
