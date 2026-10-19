import { Routes } from '@angular/router';
import { MountsStore } from '../+state/mounts.store';
import { Mounts } from './mounts/mounts';

export const mountsRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [MountsStore],
    component: Mounts,
  },
];
