import { Auth } from '@libs/auth';
import {
  areaOfStage,
  CampaignProgress,
  isStageId,
  stagesInOrder,
  stageStatus,
} from '@libs/game-core';

/** Whether a stage can be played now: it exists and it is not locked. */
export function canPlay(progress: CampaignProgress, stageId: string): boolean {
  return isStageId(stageId) && stageStatus(progress, stageId) !== 'locked';
}

/** The stage after this one, in play order; `null` after the last. */
export function nextStageId(stageId: string): string | null {
  const order = stagesInOrder();
  const index = order.findIndex((s) => s.id === stageId);
  return index < 0 ? null : (order[index + 1]?.id ?? null);
}

/** The first stage of a stage's area: where a lost stage sends the player back to. */
export function areaStartId(stageId: string): string {
  return areaOfStage(stageId)?.stages[0]?.id ?? stageId;
}

/**
 * Whether this player may start a stage: signed in with a confirmed address.
 * Where no sign-in is configured (a fork without Firebase) everyone may — the
 * game must never need credentials to run.
 */
export function canEnterStages(
  auth: Pick<Auth, 'available' | 'user'>,
): boolean {
  return !auth.available || !!auth.user()?.emailVerified;
}
