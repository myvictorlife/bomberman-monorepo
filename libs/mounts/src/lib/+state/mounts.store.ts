import { computed, inject } from '@angular/core';
import { CharacterSelectionService } from '@libs/character-select';
import {
  CharacterId,
  Direction,
  findMount,
  Mount,
  MountAbility,
  MountId,
  MOUNTS,
  TICK_RATE,
} from '@libs/game-core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

/** The order a click on the preview turns the rider: a full spin. */
export const FACING_ORDER: readonly Direction[] = [
  'down',
  'left',
  'up',
  'right',
];

/** Standing, step, standing, other step — the same cycle the arena animates. */
export const WALK_CYCLE: readonly number[] = [1, 0, 2, 0];

/** One line of a mount's ability, as a number the page can show. */
export interface AbilityFact {
  key: 'duration' | 'count' | 'radius' | 'speed' | 'passive';
  /** The number for the translation; none for a passive ability. */
  n: number | null;
}

/** A mount as the page lists it: the id, the ability and its numbers. */
export interface MountCard {
  id: MountId;
  kind: MountAbility['kind'];
  /** The ability button does something; the passive one has nothing to press. */
  usesButton: boolean;
  facts: readonly AbilityFact[];
}

export interface MountsState {
  /** The mount on the stage. */
  selectedId: MountId;
  facing: Direction;
  walking: boolean;
  /** Index into {@link WALK_CYCLE} while walking. */
  step: number;
}

export const initialMountsState: MountsState = {
  selectedId: (MOUNTS[0] as Mount).id,
  facing: 'down',
  walking: false,
  step: 0,
};

/** The numbers behind an ability, in seconds and cells, straight from the rules. */
export function abilityFacts(ability: MountAbility): readonly AbilityFact[] {
  const seconds = (ticks: number) => Math.round((ticks / TICK_RATE) * 10) / 10;
  switch (ability.kind) {
    case 'dash':
      return [
        { key: 'duration', n: seconds(ability.durationTicks) },
        { key: 'speed', n: ability.speedBonus },
      ];
    case 'jump':
      return [{ key: 'duration', n: seconds(ability.durationTicks) }];
    case 'line-bombs':
      return [{ key: 'count', n: ability.count }];
    case 'short-circuit':
      return [{ key: 'radius', n: ability.radius }];
    case 'pass-bombs':
      return [{ key: 'passive', n: null }];
  }
}

export function mountCard(mount: Mount): MountCard {
  return {
    id: mount.id,
    kind: mount.ability.kind,
    usesButton: mount.ability.kind !== 'pass-bombs',
    facts: abilityFacts(mount.ability),
  };
}

/**
 * The mounts page: which mount is on the stage and how its rider is posed —
 * facing, standing or walking — the way the roster page previews a
 * character. The rider is the character the player chose, read from
 * {@link CharacterSelectionService}; the mounts themselves are the rules'
 * (`MOUNTS`), only shaped for the page here. Provided on the route.
 */
export const MountsStore = signalStore(
  withState(initialMountsState),
  withComputed(
    (
      { selectedId, walking, step },
      selection = inject(CharacterSelectionService),
    ) => ({
      mounts: computed((): readonly MountCard[] => MOUNTS.map(mountCard)),
      selected: computed((): MountCard => mountCard(findMount(selectedId()))),
      /** Who rides in the preview: the character chosen for the game. */
      riderId: computed((): CharacterId => selection.selectedId()),
      /** The sprite frame to draw: 0 when standing, the walk cycle otherwise. */
      frame: computed(() =>
        walking() ? (WALK_CYCLE[step() % WALK_CYCLE.length] ?? 0) : 0,
      ),
      /** The frame of the walking thumbnails: mid-step while standing, the cycle while walking. */
      walkFrame: computed(() => WALK_CYCLE[step() % WALK_CYCLE.length] || 1),
    }),
  ),
  withMethods((store) => ({
    select(id: MountId): void {
      patchState(store, { selectedId: id });
    },
    /** Turns the rider to the next side, like spinning a figure on a stand. */
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
    /** One beat of the walk animation; a no-op while standing. */
    stepWalk(): void {
      if (store.walking()) patchState(store, { step: store.step() + 1 });
    },
  })),
);
