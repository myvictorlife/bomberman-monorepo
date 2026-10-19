import { computed } from '@angular/core';
import { DEFAULT_MAP_ID, MapId, MAPS } from '@libs/game-core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export interface ArenasState {
  /** The arena in focus on the page; the "play here" link follows it. */
  selectedId: MapId;
}

export const initialArenasState: ArenasState = {
  selectedId: DEFAULT_MAP_ID,
};

/**
 * The arena gallery: every map of the roster, one in focus. Provided on the
 * route; the choice travels to the match through the `/play?map=` link, not
 * through shared state, so a link to a match is enough to reproduce it.
 */
export const ArenasStore = signalStore(
  withState(initialArenasState),
  withComputed(({ selectedId }) => ({
    maps: computed(() => MAPS.map((m) => m.id)),
    selected: computed(() => selectedId()),
  })),
  withMethods((store) => ({
    select(id: MapId): void {
      patchState(store, { selectedId: id });
    },
  })),
);
