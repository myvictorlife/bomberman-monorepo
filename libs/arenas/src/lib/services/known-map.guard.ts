import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isMapId } from '@libs/game-core';

/** `/arenas/:id` only for an arena of the roster; anything else goes back to the gallery. */
export const knownMapGuard: CanActivateFn = (route) =>
  isMapId(route.paramMap.get('id') ?? '') ||
  inject(Router).createUrlTree(['/arenas']);
