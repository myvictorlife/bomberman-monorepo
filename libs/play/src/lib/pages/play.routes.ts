import { Routes } from '@angular/router';
import { PlayStore } from '../+state/play.store';
import { Play } from './play/play';

export const playRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [PlayStore],
    component: Play,
  },
];
