import { Routes } from '@angular/router';
import { OnlineStore } from '../+state/online.store';
import { Online } from './online/online';

export const onlineRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [OnlineStore],
    component: Online,
  },
];
