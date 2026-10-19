import { Routes } from '@angular/router';
import { ItemsStore } from '../+state/items.store';
import { knownItemGuard } from '../services/known-item.guard';
import { ItemDetail } from './item-detail/item-detail';
import { Items } from './items/items';

export const itemsRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [ItemsStore],
    children: [
      { path: '', component: Items },
      { path: ':id', canActivate: [knownItemGuard], component: ItemDetail },
    ],
  },
];
