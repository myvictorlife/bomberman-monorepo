import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { MapId, MAPS } from '@libs/game-core';
import { MapVote, Seat, voteCounts } from '@libs/game-protocol';
import { TranslatePipe } from '@ngx-translate/core';
import { MAP_THUMB_PAINTER } from '../../services/online.tokens';

/** An arena's i18n name key: `nucleo` → `MAPS.NUCLEO.NAME`. */
export function mapNameKey(id: MapId): string {
  return `MAPS.${id.toUpperCase()}.NAME`;
}

/** One card of the vote: an arena, or `null` for "any of them". */
export interface VoteCard {
  id: MapId | null;
  votes: number;
  /** My vote is on it. */
  mine: boolean;
  /** Among the most voted, with a vote at least. */
  leading: boolean;
}

/** One person of the next round, ready or not. */
export interface VoterRow {
  id: string;
  name: string;
  ready: boolean;
  /** What they voted for, once ready; `null` is any. */
  pick: MapId | null;
}

/**
 * The arena vote of a countdown: a card per arena and one for "any", each
 * with its votes, and who of the next round is ready. Clicking a card votes
 * and is ready — the round starts when everyone is. Only the next round's
 * people may vote; everyone else sees the count. Presentational.
 */
@Component({
  selector: 'lib-map-vote',
  imports: [TranslatePipe],
  templateUrl: './map-vote.html',
  styleUrls: ['./map-vote.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapVoteComponent {
  readonly vote = input<MapVote | null>(null);
  /** The line, for the voters' names. */
  readonly queue = input<Seat[]>([]);
  readonly myId = input<string | null>(null);

  /** I voted for this arena, or `null` for any. */
  readonly pick = output<MapId | null>();

  private readonly paint = inject(MAP_THUMB_PAINTER);
  private readonly thumbs =
    viewChildren<ElementRef<HTMLCanvasElement>>('thumb');

  readonly canVote = computed(() => {
    const me = this.myId();
    return me !== null && (this.vote()?.voters ?? []).includes(me);
  });
  private readonly myPick = computed(() => {
    const me = this.myId();
    const picks = this.vote()?.picks ?? {};
    return me !== null && me in picks ? (picks[me] ?? null) : undefined;
  });
  readonly cards = computed((): VoteCard[] => {
    const picks = this.vote()?.picks ?? {};
    const counts = voteCounts(picks);
    const top = Math.max(...Object.values(counts));
    const mine = this.myPick();
    const any = Object.values(picks).filter((p) => p === null).length;
    return [
      ...MAPS.map(({ id }) => ({
        id,
        votes: counts[id],
        mine: mine === id,
        leading: top > 0 && counts[id] === top,
      })),
      { id: null, votes: any, mine: mine === null, leading: false },
    ];
  });
  readonly voters = computed((): VoterRow[] => {
    const vote = this.vote();
    if (!vote) return [];
    return vote.voters.map((id) => ({
      id,
      name: this.queue().find((s) => s.id === id)?.name ?? '?',
      ready: id in vote.picks,
      pick: vote.picks[id] ?? null,
    }));
  });
  readonly readyCount = computed(
    () => this.voters().filter((v) => v.ready).length,
  );

  constructor() {
    // Each arena's picture, painted once its canvas is on the page.
    afterRenderEffect(() => {
      for (const ref of this.thumbs()) {
        const canvas = ref.nativeElement;
        const id = canvas.dataset['mapId'] as MapId | undefined;
        if (!id || canvas.dataset['painted']) continue;
        canvas.dataset['painted'] = 'yes';
        this.paint(canvas, 7, id);
      }
    });
  }

  nameKey(id: MapId): string {
    return mapNameKey(id);
  }

  votesKey(votes: number): string {
    if (votes === 0) return 'ONLINE.VOTE.NO_VOTES';
    return votes === 1 ? 'ONLINE.VOTE.ONE_VOTE' : 'ONLINE.VOTE.VOTES';
  }

  choose(card: VoteCard): void {
    if (this.canVote() && !card.mine) this.pick.emit(card.id);
  }
}
