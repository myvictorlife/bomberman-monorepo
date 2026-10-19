import { Routes } from '@angular/router';
import { SoundsStore } from '../+state/sounds.store';
import { Sounds } from './sounds/sounds';

export const soundsRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [SoundsStore],
    component: Sounds,
  },
];
