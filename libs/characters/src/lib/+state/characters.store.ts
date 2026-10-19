import { computed, inject } from '@angular/core';
import { CharacterSelectionService } from '@libs/character-select';
import {
  Character,
  CharacterGroupWithMembers,
  CharacterId,
  CHARACTERS,
  charactersByGroup,
  Direction,
  findCharacter,
  Mount,
  MountId,
  MOUNTS,
} from '@libs/game-core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

/** The order a click on the preview turns the character: a full spin. */
export const FACING_ORDER: readonly Direction[] = [
  'down',
  'left',
  'up',
  'right',
];

/** Standing, step, standing, other step — the same cycle the arena animates. */
export const WALK_CYCLE: readonly number[] = [1, 0, 2, 0];

export interface CharactersState {
  facing: Direction;
  walking: boolean;
  /** Index into {@link WALK_CYCLE} while walking. */
  step: number;
  /** Preview the character riding this mount; `null` is on foot. */
  mountId: MountId | null;
}

export const initialCharactersState: CharactersState = {
  facing: 'down',
  walking: false,
  step: 0,
  mountId: null,
};

/**
 * The roster page: how the preview shows the chosen character — facing,
 * walking, on foot or on a mount. The choice itself lives in
 * {@link CharacterSelectionService}, because the game reads it too; the store
 * exposes it through `withComputed` and forwards writes. Provided on the route.
 */
export const CharactersStore = signalStore(
  withState(initialCharactersState),
  withComputed(
    ({ walking, step }, selection = inject(CharacterSelectionService)) => ({
      characters: computed((): readonly Character[] => CHARACTERS),
      /** The roster by profession, in catalogue order. */
      groups: computed((): readonly CharacterGroupWithMembers[] =>
        charactersByGroup(),
      ),
      mounts: computed((): readonly Mount[] => MOUNTS),
      selectedId: computed((): CharacterId => selection.selectedId()),
      selected: computed(
        (): Character => findCharacter(selection.selectedId()),
      ),
      /** The sprite frame to draw: 0 when standing, the walk cycle otherwise. */
      frame: computed(() =>
        walking() ? (WALK_CYCLE[step() % WALK_CYCLE.length] ?? 0) : 0,
      ),
      /** The frame of the walking thumbnails: mid-step while standing, the cycle while walking. */
      walkFrame: computed(() => WALK_CYCLE[step() % WALK_CYCLE.length] || 1),
    }),
  ),
  withMethods((store, selection = inject(CharacterSelectionService)) => ({
    select(id: CharacterId): void {
      selection.select(id);
    },
    setFacing(facing: Direction): void {
      patchState(store, { facing });
    },
    /** Turns the character to the next side, like spinning a figure on a stand. */
    turn(): void {
      const index = FACING_ORDER.indexOf(store.facing());
      patchState(store, {
        facing: FACING_ORDER[(index + 1) % FACING_ORDER.length] as Direction,
      });
    },
    toggleWalking(): void {
      patchState(store, { walking: !store.walking(), step: 0 });
    },
    /** Strike one of the poses around the stage: a side, standing or walking. */
    pose(facing: Direction, walking: boolean): void {
      patchState(store, { facing, walking, step: 0 });
    },
    /** Preview on a mount, or back on foot with `null`. */
    setMount(mountId: MountId | null): void {
      patchState(store, { mountId });
    },
    /** One beat of the walk animation; a no-op while standing. */
    stepWalk(): void {
      if (store.walking()) patchState(store, { step: store.step() + 1 });
    },
  })),
);
