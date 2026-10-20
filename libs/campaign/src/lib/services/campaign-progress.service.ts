import { Injectable, signal } from '@angular/core';
import {
  afterClear,
  afterLoss,
  CampaignProgress,
  EMPTY_PROGRESS,
  PlayerKit,
  sanitizeProgress,
  StageTally,
} from '@libs/game-core';

const NO_TALLY: StageTally = { score: 0, livesGained: 0 };

/** localStorage key holding the stages a player has cleared. */
export const CAMPAIGN_PROGRESS_KEY = 'campaign-progress';

/**
 * The player's campaign progress, kept in this browser: the stages cleared,
 * the kit carried between them, the lives, the run's points and the best.
 * The rules are `afterClear` and `afterLoss` in `@libs/game-core`. Moving it to the server record
 * (like the favourite character) changes this class, not its readers.
 * Provided on the route.
 */
@Injectable()
export class CampaignProgressService {
  readonly progress = signal<CampaignProgress>(
    CampaignProgressService.restore(),
  );

  /**
   * A stage is cleared: it counts, the kit it was cleared with goes on to the
   * next, and its points and extra lives are added to the run.
   */
  markCleared(
    stageId: string,
    kit?: PlayerKit,
    tally: StageTally = NO_TALLY,
  ): void {
    this.save(afterClear(this.progress(), stageId, kit, tally));
  }

  /**
   * A stage is lost: a life and the kit go. Returns whether that was the
   * last life — game over, back to the area's first stage.
   */
  markFailed(stageId: string, tally: StageTally = NO_TALLY): boolean {
    const { progress, gameOver } = afterLoss(this.progress(), stageId, tally);
    this.save(progress);
    return gameOver;
  }

  private save(next: CampaignProgress): void {
    this.progress.set(next);
    try {
      localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(next));
    } catch {
      // Private browsing or a full quota must not break the game.
    }
  }

  private static restore(): CampaignProgress {
    try {
      const saved = localStorage.getItem(CAMPAIGN_PROGRESS_KEY);
      return saved ? sanitizeProgress(JSON.parse(saved)) : EMPTY_PROGRESS;
    } catch {
      return EMPTY_PROGRESS;
    }
  }
}
