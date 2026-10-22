/**
 * The cast: playable characters, grouped by profession, and the mounts. The
 * rules only know them by id — what they look like belongs to the client's
 * painters, and what they are called belongs to the i18n bundles
 * (`CHARACTERS.<ID>.NAME`, `CHARACTER_GROUPS.<ID>`, `MOUNTS.<ID>.NAME`).
 * Every character plays by the same numbers for now; a per-character stat
 * would be added here, next to the id, so the server and every client agree.
 *
 * Mounts belong to nobody: an egg hidden under a soft block hatches into a
 * random one for whoever picks it up.
 */
import { TICK_RATE } from './constants';

export type CharacterId =
  | 'novato'
  | 'faisca'
  | 'byte'
  | 'gestora'
  | 'lia'
  | 'motoca'
  | 'tiao';
export type MountId = 'tatu' | 'pato' | 'bernardo' | 'capivara' | 'galinha';

/**
 * A profession, the way the roster is organised. A group may hold several
 * characters (every IT job under `tech`, say); the order here is the order on
 * the roster page. `starter` is the one group that is not a job: the plain
 * player everyone begins as.
 */
export type CharacterGroupId =
  | 'starter'
  | 'demolition'
  | 'tech'
  | 'health'
  | 'delivery'
  | 'works';

export interface CharacterGroup {
  readonly id: CharacterGroupId;
}

export interface Character {
  readonly id: CharacterId;
  readonly group: CharacterGroupId;
}

/**
 * What riding a mount lets you do, on top of the speed and the one absorbed
 * hit every mount gives. `pass-bombs` is passive; the others are used with the
 * ability button and then cool down. Times are in ticks.
 */
export type MountAbility =
  | { readonly kind: 'pass-bombs' }
  /** A roll: straight ahead, `speedBonus` more cells per second, no steering, until stopped or `durationTicks` run out. */
  | {
      readonly kind: 'dash';
      readonly durationTicks: number;
      readonly cooldownTicks: number;
      readonly speedBonus: number;
    }
  | {
      readonly kind: 'jump';
      readonly durationTicks: number;
      readonly cooldownTicks: number;
    }
  /** Drops up to `count` bombs at once, in a line ahead, whatever the bomb limit. */
  | {
      readonly kind: 'line-bombs';
      readonly count: number;
      readonly cooldownTicks: number;
    }
  /** Sets off every bomb within `radius` cells (walking distance), anyone's, at once. */
  | {
      readonly kind: 'short-circuit';
      readonly durationTicks: number;
      readonly cooldownTicks: number;
      readonly radius: number;
    };

export interface Mount {
  readonly id: MountId;
  readonly ability: MountAbility;
}

export const CHARACTER_GROUPS: readonly CharacterGroup[] = [
  { id: 'starter' },
  { id: 'demolition' },
  { id: 'tech' },
  { id: 'health' },
  { id: 'delivery' },
  { id: 'works' },
];

/** Novato first: the plain player a new player starts as. */
export const CHARACTERS: readonly Character[] = [
  { id: 'novato', group: 'starter' },
  { id: 'faisca', group: 'demolition' },
  { id: 'byte', group: 'tech' },
  { id: 'gestora', group: 'tech' },
  { id: 'lia', group: 'health' },
  { id: 'motoca', group: 'delivery' },
  { id: 'tiao', group: 'works' },
];

export const MOUNTS: readonly Mount[] = [
  // No cooldown on any mount: an ability can be used again as soon as it ends.
  // Rolls straight ahead at nearly double speed until something stops it — a
  // second press, a wall, a crate, a bomb — or the arena runs out (4 s).
  {
    id: 'tatu',
    ability: {
      kind: 'dash',
      durationTicks: 4 * TICK_RATE,
      cooldownTicks: 0,
      speedBonus: 3,
    },
  },
  // Hops over the cell ahead, bomb or crate, landing on the next one.
  {
    id: 'pato',
    ability: {
      kind: 'jump',
      durationTicks: Math.round(0.4 * TICK_RATE),
      cooldownTicks: 0,
    },
  },
  // Drops three bombs at once, in a line ahead, over the bomb limit.
  {
    id: 'bernardo',
    ability: { kind: 'line-bombs', count: 3, cooldownTicks: 0 },
  },
  // Walks over bombs, anyone's. No button, no cooldown.
  { id: 'capivara', ability: { kind: 'pass-bombs' } },
  // An electric hen: a jolt that sets off every bomb close by.
  {
    id: 'galinha',
    ability: {
      kind: 'short-circuit',
      durationTicks: Math.round(0.3 * TICK_RATE),
      cooldownTicks: 0,
      radius: 2,
    },
  },
];

export function findMount(id: MountId): Mount {
  return MOUNTS.find((m) => m.id === id) ?? (MOUNTS[0] as Mount);
}

export const DEFAULT_CHARACTER_ID: CharacterId = 'novato';

export function isMountId(value: string): value is MountId {
  return MOUNTS.some((m) => m.id === value);
}

export function isCharacterId(value: string): value is CharacterId {
  return CHARACTERS.some((c) => c.id === value);
}

export function findCharacter(id: CharacterId): Character {
  return CHARACTERS.find((c) => c.id === id) ?? (CHARACTERS[0] as Character);
}

export interface CharacterGroupWithMembers extends CharacterGroup {
  readonly characters: readonly Character[];
}

/** The roster as the page shows it: every group, in order, with its characters. Empty groups are left out. */
export function charactersByGroup(): readonly CharacterGroupWithMembers[] {
  return CHARACTER_GROUPS.map((group) => ({
    ...group,
    characters: CHARACTERS.filter((c) => c.group === group.id),
  })).filter((group) => group.characters.length > 0);
}

/**
 * Which mount an egg hatches into. Deterministic from a number the rules
 * derive from the game state, so a server and every client hatch the same one.
 */
export function hatchMount(seed: number): MountId {
  const index =
    ((Math.floor(seed) % MOUNTS.length) + MOUNTS.length) % MOUNTS.length;
  return (MOUNTS[index] as Mount).id;
}
