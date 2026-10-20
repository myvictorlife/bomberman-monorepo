import { inject, InjectionToken } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AUTH } from '@libs/auth';
import { ArenaLauncher, mountArena } from '@libs/game-client';
import { CampaignProgressService } from './campaign-progress.service';
import { canEnterStages, canPlay } from './stage-access';

/**
 * How the stage page starts its arena. A token so unit tests can swap in a
 * fake — Phaser needs a real canvas the test DOM lacks.
 */
export const STAGE_LAUNCHER = new InjectionToken<ArenaLauncher>(
  'STAGE_LAUNCHER',
  { factory: () => mountArena },
);

/**
 * Only a stage the player may play opens, and only for a signed-in player;
 * anything else goes back to the map, where the sign-in is offered.
 */
export const playableStageGuard: CanActivateFn = async (route) => {
  const auth = inject(AUTH);
  const progress = inject(CampaignProgressService);
  const map = inject(Router).createUrlTree(['/campaign']);
  await auth.initialize();
  if (!canEnterStages(auth)) return map;
  return (
    canPlay(progress.progress(), route.paramMap.get('stageId') ?? '') || map
  );
};
