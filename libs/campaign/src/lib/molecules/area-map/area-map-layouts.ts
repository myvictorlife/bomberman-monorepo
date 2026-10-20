import { AreaId } from '@libs/game-core';

/** Where a stage sits on its area's map, in percent of the map's box. */
export interface MapSpot {
  x: number;
  y: number;
}

/**
 * The spots of each area's stages, in play order, along the path its map art
 * draws. An area missing here shows the "soon" placeholder instead of a map —
 * a new area needs its art in `area-map.html` and its spots here.
 */
export const AREA_MAP_SPOTS: Partial<Record<AreaId, readonly MapSpot[]>> = {
  gramado: [
    { x: 17, y: 77 },
    { x: 29, y: 43 },
    { x: 55, y: 41 },
    { x: 84, y: 39 },
    { x: 88, y: 58 },
    { x: 85.5, y: 77 },
  ],
};
