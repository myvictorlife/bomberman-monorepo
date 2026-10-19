/**
 * Player colours: the suit panel, the light and the saddle — what tells the
 * players apart in the arena, the HUD and the ranking. The rules only know them
 * by id; the hex values belong to the client's painters. The first five are
 * the slot colours every round had before a player could pick one, in slot
 * order, so a player with no preference looks as they always did.
 */
export const PLAYER_COLOR_IDS = [
  'blue',
  'graphite',
  'red',
  'yellow',
  'green',
  'purple',
  'orange',
  'pink',
] as const;

export type PlayerColorId = (typeof PLAYER_COLOR_IDS)[number];

export function isPlayerColorId(value: unknown): value is PlayerColorId {
  return (PLAYER_COLOR_IDS as readonly unknown[]).includes(value);
}

/** The colour a slot gets when nobody asked for one. */
export function slotColor(slot: number): PlayerColorId {
  const n = PLAYER_COLOR_IDS.length;
  return PLAYER_COLOR_IDS[((slot % n) + n) % n] as PlayerColorId;
}

/**
 * The hues around the wheel, for "the closest free colour". Graphite has no
 * hue: it is not on the wheel, and whoever wanted it takes the first free slot
 * colour instead.
 */
const WHEEL: readonly PlayerColorId[] = [
  'blue',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'green',
];

/** Free colours, nearest first on the wheel to `wanted`. */
function nearest(
  wanted: PlayerColorId,
  free: readonly PlayerColorId[],
): PlayerColorId | undefined {
  const at = WHEEL.indexOf(wanted);
  if (at === -1) return free[0];
  const distance = (c: PlayerColorId) => {
    const i = WHEEL.indexOf(c);
    if (i === -1) return WHEEL.length;
    const d = Math.abs(i - at);
    return Math.min(d, WHEEL.length - d);
  };
  return [...free].sort((a, b) => distance(a) - distance(b))[0];
}

/**
 * Gives every player of a round a different colour. `wanted` is in seat order
 * — first in line first — so whoever is ahead keeps the colour they picked;
 * a later player who wanted the same one gets the closest free colour, and a
 * player with no preference gets their slot colour if it is free.
 */
export function assignColors(
  wanted: readonly (PlayerColorId | undefined)[],
): PlayerColorId[] {
  const taken = new Set<PlayerColorId>();
  const free = () => PLAYER_COLOR_IDS.filter((c) => !taken.has(c));
  // Explicit choices first, in order, so a later player's choice is not lost
  // to an earlier player with no preference.
  const chosen = wanted.map((color) => {
    if (!color || taken.has(color)) return undefined;
    taken.add(color);
    return color;
  });
  return wanted.map((color, slot) => {
    const got = chosen[slot];
    if (got) return got;
    const pick = color
      ? nearest(color, free())
      : !taken.has(slotColor(slot))
        ? slotColor(slot)
        : free()[0];
    // More players than colours: repeat the slot colour.
    const result = pick ?? slotColor(slot);
    taken.add(result);
    return result;
  });
}
