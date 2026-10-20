import { Routes } from '@angular/router';
import { CampaignStore } from '../+state/campaign.store';
import { CampaignProgressService } from '../services/campaign-progress.service';
import { Campaign } from './campaign/campaign';
import { Collection } from './collection/collection';
import { Stage } from './stage/stage';
import { playableStageGuard } from '../services/stage-launcher';

export const campaignRoutes: Routes = [
  {
    path: '',
    // Feature state lives on the route: the store is created when the feature is
    // entered and torn down when it is left.
    providers: [CampaignProgressService, CampaignStore],
    children: [
      { path: '', component: Campaign },
      { path: 'collection', title: 'COLLECTION.TITLE', component: Collection },
      {
        path: 'play/:stageId',
        title: 'STAGE_PLAY.TITLE',
        canActivate: [playableStageGuard],
        component: Stage,
      },
    ],
  },
];
