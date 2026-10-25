import { TestBed } from '@angular/core/testing';
import { CharacterSelectionService } from '@libs/character-select';
import { CharactersStore, initialCharactersState } from './characters.store';

describe('CharactersStore', () => {
  beforeEach(() => localStorage.clear());

  const createStore = () => {
    TestBed.configureTestingModule({ providers: [CharactersStore] });
    return TestBed.inject(CharactersStore);
  };

  it('starts with the default character, standing, facing down, on foot', () => {
    const store = createStore();

    expect(store.selectedId()).toBe('novato');
    expect(store.characters().length).toBe(11);
    expect(store.mounts().length).toBe(5);
    expect(store.groups().map((g) => g.id)).toEqual([
      'starter',
      'demolition',
      'tech',
      'health',
      'delivery',
      'works',
    ]);
    expect(store.facing()).toBe(initialCharactersState.facing);
    expect(store.walking()).toBe(false);
    expect(store.mountId()).toBeNull();
    expect(store.frame()).toBe(0);
  });

  it('selects a character through the shared selection, so the game sees it', () => {
    const store = createStore();

    store.select('lia');

    expect(store.selected().id).toBe('lia');
    expect(TestBed.inject(CharacterSelectionService).selectedId()).toBe('lia');
  });

  it('turns a full circle, one side per click', () => {
    const store = createStore();

    store.turn();
    expect(store.facing()).toBe('left');
    store.turn();
    expect(store.facing()).toBe('up');
    store.turn();
    expect(store.facing()).toBe('right');
    store.turn();
    expect(store.facing()).toBe('down');
  });

  it('faces a given side directly and previews a mount', () => {
    const store = createStore();

    store.setFacing('up');
    store.setMount('pato');

    expect(store.facing()).toBe('up');
    expect(store.mountId()).toBe('pato');

    store.setMount(null);
    expect(store.mountId()).toBeNull();
  });

  it('walks through the step cycle and stands still again when stopped', () => {
    const store = createStore();

    store.stepWalk();
    expect(store.frame()).toBe(0);

    store.toggleWalking();
    expect(store.frame()).toBe(1);
    store.stepWalk();
    expect(store.frame()).toBe(0);
    store.stepWalk();
    expect(store.frame()).toBe(2);
    store.stepWalk();
    expect(store.frame()).toBe(0);
    store.stepWalk();
    expect(store.frame()).toBe(1);

    store.toggleWalking();
    expect(store.walking()).toBe(false);
    expect(store.frame()).toBe(0);
  });

  it('strikes a pose: the side, walking or standing, from the first step', () => {
    const store = createStore();

    expect(store.walkFrame()).toBe(1);

    store.pose('left', true);
    expect(store.facing()).toBe('left');
    expect(store.walking()).toBe(true);
    expect(store.frame()).toBe(1);
    store.stepWalk();
    expect(store.frame()).toBe(0);
    expect(store.walkFrame()).toBe(1);
    store.stepWalk();
    expect(store.walkFrame()).toBe(2);

    store.pose('up', false);
    expect(store.facing()).toBe('up');
    expect(store.walking()).toBe(false);
    expect(store.frame()).toBe(0);
    expect(store.walkFrame()).toBe(1);
  });
});
