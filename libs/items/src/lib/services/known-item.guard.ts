import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isItemId } from '../items';

/** `/items/:id` only for an item of the game; anything else goes back to the gallery. */
export const knownItemGuard: CanActivateFn = (route) =>
  isItemId(route.paramMap.get('id') ?? '') ||
  inject(Router).createUrlTree(['/items']);
