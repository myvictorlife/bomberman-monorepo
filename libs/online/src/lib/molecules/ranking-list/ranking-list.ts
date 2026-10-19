import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RankingEntry } from '@libs/game-protocol';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The ranking as a list, with the signed-in player highlighted. Presentational.
 * Under a podium it carries on from fourth place (`start`) without a title
 * of its own (`titled`).
 */
@Component({
  selector: 'lib-ranking-list',
  imports: [TranslatePipe],
  templateUrl: './ranking-list.html',
  styleUrls: ['./ranking-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingListComponent {
  readonly entries = input<RankingEntry[]>([]);
  readonly myId = input<string | null>(null);
  /** The place of the first line. */
  readonly start = input(1);
  readonly titled = input(true);
}
