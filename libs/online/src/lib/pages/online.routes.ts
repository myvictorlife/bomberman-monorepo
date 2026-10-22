import { Routes } from '@angular/router';
import { STAGES_ROOM } from '@libs/game-protocol';
import { OnlineStore } from '../+state/online.store';
import { ONLINE_ROOM } from '../services/online.tokens';
import { Online } from './online/online';

export const onlineRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [OnlineStore],
    children: [
      { path: '', component: Online },
      // The stages room: the campaign as a team. Same page, other room.
      {
        path: 'stages',
        title: 'ONLINE.STAGES.TITLE',
        component: Online,
        providers: [{ provide: ONLINE_ROOM, useValue: STAGES_ROOM }],
      },
    ],
  },
];
