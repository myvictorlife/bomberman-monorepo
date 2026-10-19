import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CharacterSelectionService } from '@libs/character-select';
import { CharacterId, findMount } from '@libs/game-core';
import { abilityFacts, initialMountsState, MountsStore } from './mounts.store';

describe('MountsStore', () => {
  const selectedId = signal<CharacterId>('lia');
  const createStore = () => {
    TestBed.configureTestingModule({
      providers: [
        MountsStore,
        { provide: CharacterSelectionService, useValue: { selectedId } },
      ],
    });
    return TestBed.inject(MountsStore);
  };

  it('lists every mount with its ability, and starts with the first on the stage, facing front', () => {
    const store = createStore();

    expect(store.selectedId()).toBe(initialMountsState.selectedId);
    expect(store.selected().id).toBe('tatu');
    expect(store.mounts().map((m) => m.id)).toEqual([
      'tatu',
      'pato',
      'bernardo',
      'capivara',
      'galinha',
    ]);
    expect(store.mounts().find((m) => m.id === 'capivara')?.usesButton).toBe(
      false,
    );
    expect(store.mounts().find((m) => m.id === 'pato')?.usesButton).toBe(true);
    expect(store.facing()).toBe('down');
    expect(store.walking()).toBe(false);
    expect(store.frame()).toBe(0);
    expect(store.walkFrame()).toBe(1);
  });

  it('puts the chosen mount on the stage, ridden by the character chosen for the game', () => {
    const store = createStore();

    expect(store.riderId()).toBe('lia');
    selectedId.set('tiao');
    expect(store.riderId()).toBe('tiao');

    store.select('galinha');
    expect(store.selected()).toMatchObject({
      id: 'galinha',
      kind: 'short-circuit',
      usesButton: true,
    });
  });

  it('turns a full circle, strikes a pose, and walks in the arena’s cycle', () => {
    const store = createStore();

    store.turn();
    expect(store.facing()).toBe('left');
    store.turn();
    store.turn();
    store.turn();
    expect(store.facing()).toBe('down');

    store.pose('up', true);
    expect(store.facing()).toBe('up');
    expect(store.walking()).toBe(true);
    expect(store.frame()).toBe(1);
    store.stepWalk();
    expect(store.frame()).toBe(0);
    store.stepWalk();
    expect(store.frame()).toBe(2);
    expect(store.walkFrame()).toBe(2);

    store.toggleWalking();
    expect(store.walking()).toBe(false);
    expect(store.frame()).toBe(0);
    store.stepWalk();
    expect(store.step()).toBe(0);
  });

  it('turns each ability into its numbers, in seconds and cells', () => {
    expect(abilityFacts(findMount('tatu').ability)).toEqual([
      { key: 'duration', n: 4 },
      { key: 'speed', n: 3 },
    ]);
    expect(abilityFacts(findMount('pato').ability)).toEqual([
      { key: 'duration', n: 0.4 },
    ]);
    expect(abilityFacts(findMount('bernardo').ability)).toEqual([
      { key: 'count', n: 3 },
    ]);
    expect(abilityFacts(findMount('galinha').ability)).toEqual([
      { key: 'radius', n: 2 },
    ]);
    expect(abilityFacts(findMount('capivara').ability)).toEqual([
      { key: 'passive', n: null },
    ]);
  });
});
