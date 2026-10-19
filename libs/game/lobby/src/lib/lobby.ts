import {
  Champion,
  LobbyPhase,
  LobbySnapshot,
  NO_WATCHERS,
  RoomRules,
  Seat,
  Watchers,
} from '@libs/game-protocol';

export type JoinResult = 'queued' | 'already-queued' | 'already-playing';

/** How a round ended for its winner: whether they keep a seat, and their wins in a row. */
export interface RoundOutcome {
  winnerId: string;
  streak: number;
  /** Plays the next round too. `false` when the rule is off or this was the last win in a row allowed. */
  stays: boolean;
}

/** What the room has to do after {@link Lobby.update}: start a round with these seats. */
export interface StartRound {
  players: Seat[];
}

/**
 * The rules of a room's queue, with no network and no clock of its own — the
 * caller passes `now` in, so every transition is testable in a plain unit test.
 *
 * - Two or more queued start a countdown; the round starts when it runs out.
 * - A full room (`maxPlayers` queued) starts at once, countdown or not.
 * - The countdown never restarts when someone joins, so a steady trickle of
 *   newcomers cannot hold a round back forever. It is cancelled if the queue
 *   drops below `minPlayers`.
 * - During a round, newcomers queue for the next one. When it ends, the
 *   winner keeps a seat — first in line, so they play the next round with the
 *   next `maxPlayers - 1` — until `rules.winnerStays` wins in a row; whoever
 *   was already waiting keeps their place, and the round's other players go
 *   to the back, best placed first. A draw sends everyone to the back.
 * - The first `rules.outsiders` in line stand outside the arena while a round
 *   is played; one who gets a kill enters it ({@link enterRound}) and is a
 *   player of that round from then on.
 */
export class Lobby {
  private phaseValue: LobbyPhase = 'waiting';
  private queue: Seat[] = [];
  private players: Seat[] = [];
  /** Players of the current round who disconnected — not put back in the queue. */
  private readonly gone = new Set<string>();
  private countdownEndsAt: number | null = null;
  private resultsEndsAt: number | null = null;
  private winnerId: string | null = null;
  /** The last round's winner while they keep their seat. */
  private championValue: Champion | null = null;
  /** The last round's players, best first, as the room reported them. */
  private standings: string[] = [];
  private rulesValue: RoomRules;
  /** Rules changed during a round, waiting for it to end. */
  private pendingRules: RoomRules | null = null;

  constructor(rules: RoomRules) {
    this.rulesValue = { ...rules };
  }

  get phase(): LobbyPhase {
    return this.phaseValue;
  }

  get rules(): RoomRules {
    return this.rulesValue;
  }

  /** What the next round will play by: the pending change, or the rules as they are. */
  get nextRules(): RoomRules | null {
    return this.pendingRules;
  }

  get champion(): Champion | null {
    return this.championValue ? { ...this.championValue } : null;
  }

  /**
   * Changes the rules. Between rounds they apply at once; during a round (or
   * its results) they wait, so the border is never reseated mid-round and a
   * round never changes length under the players. Returns when they apply.
   */
  setRules(rules: RoomRules): 'now' | 'next-round' {
    if (this.phaseValue === 'playing' || this.phaseValue === 'results') {
      this.pendingRules = { ...rules };
      return 'next-round';
    }
    this.rulesValue = { ...rules };
    this.pendingRules = null;
    return 'now';
  }

  isQueued(id: string): boolean {
    return this.queue.some((s) => s.id === id);
  }

  isPlaying(id: string): boolean {
    return (
      this.phaseValue === 'playing' &&
      this.players.some((s) => s.id === id) &&
      !this.gone.has(id)
    );
  }

  /** The next in line, on the border of the round in progress. Empty between rounds. */
  outsiders(): Seat[] {
    if (this.phaseValue !== 'playing') return [];
    return this.queue
      .slice(0, Math.max(0, this.rules.outsiders))
      .map((s) => ({ ...s }));
  }

  isOutsider(id: string): boolean {
    return this.outsiders().some((s) => s.id === id);
  }

  /**
   * An outsider got a kill and is in the arena now: out of the queue, into
   * the round. Afterwards they go to the back with the other players.
   */
  enterRound(id: string): boolean {
    const seat = this.outsiders().find((s) => s.id === id);
    if (!seat) return false;
    this.queue = this.queue.filter((s) => s.id !== id);
    this.players.push(seat);
    return true;
  }

  join(seat: Seat): JoinResult {
    if (this.isQueued(seat.id)) return 'already-queued';
    if (this.isPlaying(seat.id)) return 'already-playing';
    this.queue.push({ ...seat });
    return 'queued';
  }

  /** Leaves the queue; a player of the round in progress is marked gone instead. */
  leave(id: string): void {
    this.queue = this.queue.filter((s) => s.id !== id);
    if (this.championValue?.id === id) this.championValue = null;
    if (this.players.some((s) => s.id === id)) this.gone.add(id);
  }

  /**
   * The round reported its result. `standings` lists its players best first
   * (the winner, then whoever lasted longest); the losers go back in that
   * order. Returns what happens to the winner, or `null` for a draw.
   */
  finishRound(
    winnerId: string | null,
    now: number,
    standings: string[] = [],
  ): RoundOutcome | null {
    if (this.phaseValue !== 'playing') return null;
    this.phaseValue = 'results';
    this.winnerId = winnerId;
    this.resultsEndsAt = now + this.rules.resultsMs;
    this.standings = [...standings];
    return this.crown(winnerId);
  }

  /** Runs every transition that is due. Call it after any change and on a timer. */
  update(now: number): StartRound | null {
    if (
      this.phaseValue === 'results' &&
      this.resultsEndsAt !== null &&
      now >= this.resultsEndsAt
    ) {
      this.requeuePlayers();
      this.phaseValue = 'waiting';
      this.resultsEndsAt = null;
    }
    if (this.phaseValue === 'waiting' && this.pendingRules) {
      this.rulesValue = this.pendingRules;
      this.pendingRules = null;
    }

    if (
      this.phaseValue === 'waiting' &&
      this.queue.length >= this.rules.minPlayers
    ) {
      this.phaseValue = 'countdown';
      this.countdownEndsAt = now + this.rules.countdownMs;
    }

    if (this.phaseValue === 'countdown') {
      if (this.queue.length < this.rules.minPlayers) {
        this.phaseValue = 'waiting';
        this.countdownEndsAt = null;
      } else if (
        this.queue.length >= this.rules.maxPlayers ||
        (this.countdownEndsAt !== null && now >= this.countdownEndsAt)
      ) {
        return this.startRound();
      }
    }
    return null;
  }

  /** `watchers` comes from the room, which knows the connections; the queue does not. */
  snapshot(now: number, watchers: Watchers = NO_WATCHERS): LobbySnapshot {
    return {
      phase: this.phaseValue,
      queue: this.queue.map((s) => ({ ...s })),
      players: this.players.map((s) => ({ ...s })),
      countdownEndsAt: this.countdownEndsAt,
      resultsEndsAt: this.resultsEndsAt,
      winnerId: this.winnerId,
      champion: this.champion,
      now,
      rules: { ...this.rulesValue },
      nextRules: this.pendingRules ? { ...this.pendingRules } : null,
      watchers: { names: [...watchers.names], anonymous: watchers.anonymous },
    };
  }

  private startRound(): StartRound {
    this.players = this.queue.splice(0, this.rules.maxPlayers);
    this.gone.clear();
    this.phaseValue = 'playing';
    this.countdownEndsAt = null;
    this.winnerId = null;
    return { players: this.players.map((s) => ({ ...s })) };
  }

  /** Decides whether the winner keeps a seat, counting their wins in a row. */
  private crown(winnerId: string | null): RoundOutcome | null {
    const previous = this.championValue;
    this.championValue = null;
    if (!winnerId || this.gone.has(winnerId)) return null;
    const streak = (previous?.id === winnerId ? previous.streak : 0) + 1;
    const limit = this.rules.winnerStays;
    const stays = limit > 0 && streak < limit;
    if (stays) this.championValue = { id: winnerId, streak };
    return { winnerId, streak, stays };
  }

  private requeuePlayers(): void {
    const place = (id: string) => {
      if (id === this.winnerId) return -1;
      const index = this.standings.indexOf(id);
      return index === -1 ? this.standings.length : index;
    };
    const back = this.players
      .filter((s) => !this.gone.has(s.id) && !this.isQueued(s.id))
      .sort((a, b) => place(a.id) - place(b.id));
    const champion = back.find((s) => s.id === this.championValue?.id);
    if (champion) this.queue.unshift(champion);
    this.queue.push(...back.filter((s) => s !== champion));
    this.players = [];
    this.standings = [];
    this.gone.clear();
  }
}
