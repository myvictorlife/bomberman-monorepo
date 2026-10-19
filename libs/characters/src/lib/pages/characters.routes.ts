import { Routes } from '@angular/router';
import { CharactersStore } from '../+state/characters.store';
import { Characters } from './characters/characters';

export const charactersRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [CharactersStore],
    component: Characters,
  },
];
