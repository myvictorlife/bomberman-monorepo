import { Routes } from '@angular/router';
import { ArenasStore } from '../+state/arenas.store';
import { knownMapGuard } from '../services/known-map.guard';
import { ArenaDetail } from './arena-detail/arena-detail';
import { Arenas } from './arenas/arenas';

export const arenasRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [ArenasStore],
    children: [
      { path: '', component: Arenas },
      { path: ':id', canActivate: [knownMapGuard], component: ArenaDetail },
    ],
  },
];
