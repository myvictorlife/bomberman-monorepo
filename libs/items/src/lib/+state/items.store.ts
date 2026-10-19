import { computed } from '@angular/core';
import { PowerUpKind } from '@libs/game-core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ITEM_IDS } from '../items';

export interface ItemsState {
  /** The item in focus on the pages. */
  selectedId: PowerUpKind;
}

export const initialItemsState: ItemsState = {
  selectedId: 'egg',
};

/** The item gallery: every item a round can hand out, one in focus. Provided on the route. */
export const ItemsStore = signalStore(
  withState(initialItemsState),
  withComputed(({ selectedId }) => ({
    items: computed(() => ITEM_IDS),
    selected: computed(() => selectedId()),
  })),
  withMethods((store) => ({
    select(id: PowerUpKind): void {
      patchState(store, { selectedId: id });
    },
  })),
);
