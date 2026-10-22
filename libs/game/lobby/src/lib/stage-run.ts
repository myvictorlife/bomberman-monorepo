import {
  afterClear,
  afterLoss,
  areaOfStage,
  CampaignProgress,
  EMPTY_PROGRESS,
  PlayerKit,
  sanitizeProgress,
  StageResult,
  StageTally,
  stagesInOrder,
  stageStatus,
} from '@libs/game-core';

/**
 * The campaign's rules as the stages room needs them: which stages a player
 * may pick, where they are, and what a finished stage does to each player's
 * progress. Pure, like the rest of the lobby.
 */

/**
 * The campaign of an account that also plays alone in its browser: the
 * record's lives, kit and points, with every stage either side has cleared.
 * A guest has no record; their browser's campaign is all there is.
 */
export function mergeProgress(
  record: CampaignProgress | undefined,
  browser: CampaignProgress | undefined,
): CampaignProgress | undefined {
  if (!record || !browser) return record ?? browser;
  return sanitizeProgress({
    ...record,
    cleared: [...record.cleared, ...browser.cleared],
  });
}

/** The stages a player may play: those open or already cleared, in play order. */
export function stageChoices(progress: CampaignProgress): string[] {
  return stagesInOrder()
    .filter((s) => stageStatus(progress, s.id) !== 'locked')
    .map((s) => s.id);
}

/** Where a player is: the first stage still open, or the last one when all are cleared. */
export function currentStage(progress: CampaignProgress): string {
  const order = stagesInOrder();
  const open = order.find((s) => stageStatus(progress, s.id) === 'open');
  return (open ?? order[order.length - 1] ?? order[0])?.id ?? '';
}

/** The stage after `stageId` in play order; `null` after the last. */
export function stageAfter(stageId: string): string | null {
  const order = stagesInOrder();
  const index = order.findIndex((s) => s.id === stageId);
  return index < 0 ? null : (order[index + 1]?.id ?? null);
}

/** The first stage of `stageId`'s area: where a game over sends the team back to. */
export function areaStart(stageId: string): string {
  return areaOfStage(stageId)?.stages[0]?.id ?? stageId;
}

/** How one player of the team came out of a stage. */
export interface StageOutcome {
  /** What they carry on: their kit if they got through the gate, the starting one otherwise. */
  kit: PlayerKit;
  tally: StageTally;
}

/**
 * A stage is over for one player. Cleared, it counts for everyone who played
 * it — even one who fell, who goes on with the starting kit; lost, it costs
 * each of them a life and their kit, and the last life is game over.
 */
export function progressAfterStage(
  progress: CampaignProgress | undefined,
  stageId: string,
  result: StageResult,
  outcome: StageOutcome,
): { progress: CampaignProgress; gameOver: boolean } {
  const before = progress ?? EMPTY_PROGRESS;
  if (result === 'cleared')
    return {
      progress: afterClear(before, stageId, outcome.kit, outcome.tally),
      gameOver: false,
    };
  return afterLoss(before, stageId, outcome.tally);
}

/**
 * The stage the team plays next, from the host's point of view: the next one
 * after a clear when the host has it open, the same one after a loss, the
 * area's first after the host's game over.
 */
export function nextStageFor(
  hostProgress: CampaignProgress,
  stageId: string,
  result: StageResult,
  hostGameOver: boolean,
): string {
  if (result === 'failed') return hostGameOver ? areaStart(stageId) : stageId;
  const next = stageAfter(stageId);
  return next && stageStatus(hostProgress, next) !== 'locked' ? next : stageId;
}
