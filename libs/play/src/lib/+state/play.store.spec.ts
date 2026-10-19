import { TestBed } from '@angular/core/testing';
import { AudioSettingsService } from '@libs/audio-settings';
import { HudSnapshot } from '@libs/game-client';
import { PlayStore, initialPlayState } from './play.store';

const hud = (over: Partial<HudSnapshot> = {}): HudSnapshot => ({
  phase: 'playing',
  winnerId: null,
  secondsLeft: 180,
  closing: false,
  players: [
    {
      id: 'p1',
      slot: 0,
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
      name: 'P2',
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
  ],
  ...over,
});

describe('PlayStore', () => {
  beforeEach(() => localStorage.clear());

  const createStore = () => {
    TestBed.configureTestingModule({ providers: [PlayStore] });
    return TestBed.inject(PlayStore);
  };

  it('starts loading, with no players', () => {
    const store = createStore();

    expect(store.status()).toBe(initialPlayState.status);
    expect(store.players()).toEqual([]);
    expect(store.isOver()).toBe(false);
    expect(store.winner()).toBeNull();
  });

  it('tracks the arena status', () => {
    const store = createStore();

    store.setStatus('ready');

    expect(store.status()).toBe('ready');
  });

  it('reads and writes the audio choices through AudioSettingsService', () => {
    const store = createStore();
    const audio = TestBed.inject(AudioSettingsService);
    expect(store.muted()).toBe(false);
    expect(store.music()).toBe(false);

    store.setMuted(true);
    store.setMusic(true);

    expect(audio.sfx()).toBe(false);
    expect(audio.music()).toBe(true);
    expect(store.muted()).toBe(true);
    expect(store.music()).toBe(true);
  });

  it('mirrors the HUD snapshot', () => {
    const store = createStore();

    store.applyHud(hud());

    expect(store.players().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(store.isOver()).toBe(false);
  });

  it('exposes the winner once the round is over', () => {
    const store = createStore();

    store.applyHud(hud({ phase: 'over', winnerId: 'p2' }));

    expect(store.isOver()).toBe(true);
    expect(store.winner()?.id).toBe('p2');
  });

  it('has no winner on a draw', () => {
    const store = createStore();

    store.applyHud(hud({ phase: 'over', winnerId: null }));

    expect(store.isOver()).toBe(true);
    expect(store.winner()).toBeNull();
  });
});
