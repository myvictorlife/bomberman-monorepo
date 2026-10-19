import { TestBed } from '@angular/core/testing';
import { ItemsStore } from './items.store';

describe('ItemsStore', () => {
  const createStore = () => {
    TestBed.configureTestingModule({ providers: [ItemsStore] });
    return TestBed.inject(ItemsStore);
  };

  it('lists every item with the egg in focus', () => {
    const store = createStore();

    expect(store.items()).toEqual([
      'egg',
      'bomb',
      'fire',
      'speed',
      'pierce',
      'remote',
      'vest',
      'glove',
      'kick',
    ]);
    expect(store.selected()).toBe('egg');
  });

  it('moves the focus', () => {
    const store = createStore();

    store.select('fire');

    expect(store.selected()).toBe('fire');
  });
});
