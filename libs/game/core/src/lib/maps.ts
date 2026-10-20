/**
 * The arenas: where a round is played. The rules know a map only by its id and
 * by the hard walls it adds to the classic grid; what it looks like belongs to
 * the client's themes, and what it is called to the i18n bundles
 * (`MAPS.<ID>.NAME`). A feature in the middle — the substation's generator,
 * the track's start-light gantry — is one of those extra walls.
 */
export type MapId = 'subestacao' | 'autodromo' | 'gramado';

export interface MapDefinition {
  readonly id: MapId;
  /** Hard walls beyond the border and the even pillars, as `[col, row]`. */
  readonly extraWalls: readonly (readonly [number, number])[];
}

/**
 * Gramado first: the plain one — a lawn, stone and brick, nothing happening —
 * leads every list. A round still plays on {@link DEFAULT_MAP_ID} unless
 * another is asked for.
 *
 * No map adds walls today: the centre cell, where the generator and the
 * start-light gantry used to stand, is the fifth player's spawn.
 */
export const MAPS: readonly MapDefinition[] = [
  { id: 'gramado', extraWalls: [] },
  { id: 'subestacao', extraWalls: [] },
  { id: 'autodromo', extraWalls: [] },
];

export const DEFAULT_MAP_ID: MapId = 'subestacao';

export function isMapId(value: string): value is MapId {
  return MAPS.some((m) => m.id === value);
}

export function findMap(id: MapId): MapDefinition {
  return MAPS.find((m) => m.id === id) ?? (MAPS[0] as MapDefinition);
}

export function isExtraWall(
  map: MapDefinition,
  col: number,
  row: number,
): boolean {
  return map.extraWalls.some(([c, r]) => c === col && r === row);
}
