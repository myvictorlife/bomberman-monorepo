import { CHARACTERS, DEFAULT_CHARACTER_ID } from '@libs/game-core';
import {
  botsFor,
  Champion,
  LobbyPhase,
  LobbySnapshot,
  NO_WATCHERS,
  peopleNeeded,
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

/** A bot's id. Account ids are Firebase uids, so they never look like this. */
export function botId(n: number): string {
  return `cpu${n}`;
}

export function isBotId(id: string): boolean {
  return /^cpu\d+$/.test(id);
}

/** What the bots are called: people's names, so a round of bots looks like a room of players. */
export const BOT_NAMES: readonly string[] = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Duda',
  'Fábio',
  'Fernanda',
  'Gabi',
  'Gui',
  'Helena',
  'Igor',
  'Jéssica',
  'João',
  'Júlia',
  'Kaique',
  'Larissa',
  'Léo',
  'Lucas',
  'Luana',
  'Marcos',
  'Mari',
  'Mateus',
  'Nina',
  'Paulo',
  'Pedro',
  'Rafa',
  'Renata',
  'Rodrigo',
  'Sofia',
  'Thiago',
  'Vini',
  'Yasmin',
];

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
 * - With `rules.bots`, one person is enough for the countdown and bots take
 *   the seats left; with nobody queued, the bots play by themselves as long
 *   as someone is watching. Bots never queue: each round makes its own.
 */
export class Lobby {
  private phaseValue: LobbyPhase = 'waiting';
  private queue: Seat[] = [];
  private players: Seat[] = [];
  /** Players of the current round who disconnected — not put back in the queue. */
  private readonly gone = new Set<string>();
  /** Players of the current round who asked to leave when it ends. */
  private readonly leavingAfter = new Set<string>();
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
  /** Rounds started, so each round's bots look a little different. */
  private rounds = 0;

  /** `random` picks the bots' names; tests pass a fixed one. */
  constructor(
    rules: RoomRules,
    private readonly random: () => number = Math.random,
  ) {
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

  /**
   * A player of the round in progress (or of the one just decided) leaves
   * when it ends instead of going back in line — or, with `leave` false,
   * stays after all. A winner who leaves gives the seat up. Returns whether
   * the id is a player of that round.
   */
  leaveAfterRound(id: string, leave: boolean): boolean {
    if (this.phaseValue !== 'playing' && this.phaseValue !== 'results')
      return false;
    if (!this.players.some((s) => s.id === id && !s.bot)) return false;
    if (leave) {
      this.leavingAfter.add(id);
      if (this.championValue?.id === id) this.championValue = null;
    } else {
      this.leavingAfter.delete(id);
    }
    return true;
  }

  isLeavingAfterRound(id: string): boolean {
    return this.leavingAfter.has(id);
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

  /**
   * Runs every transition that is due. Call it after any change and on a
   * timer. `watched`: someone is connected — bots only play for an audience.
   */
  update(now: number, watched = true): StartRound | null {
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

    const enough = this.enoughToPlay(watched);
    if (this.phaseValue === 'waiting' && enough) {
      this.phaseValue = 'countdown';
      this.countdownEndsAt = now + this.rules.countdownMs;
    }

    if (this.phaseValue === 'countdown') {
      if (!enough) {
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
      leavingAfter: [...this.leavingAfter],
    };
  }

  /** People in the round being played (or just decided), bots left out. */
  people(): Seat[] {
    return this.players.filter((s) => !s.bot).map((s) => ({ ...s }));
  }

  private enoughToPlay(watched: boolean): boolean {
    if (this.queue.length >= peopleNeeded(this.rules)) return true;
    // A round of bots alone, for whoever watches, only while nobody is waiting.
    return this.queue.length === 0 && this.rules.bots > 0 && watched;
  }

  private startRound(): StartRound {
    const people = this.queue.splice(0, this.rules.maxPlayers);
    this.players = [...people, ...this.bots(people)];
    this.rounds++;
    this.gone.clear();
    this.leavingAfter.clear();
    this.phaseValue = 'playing';
    this.countdownEndsAt = null;
    this.winnerId = null;
    return { players: this.players.map((s) => ({ ...s })) };
  }

  /**
   * The bots of a new round: as many as {@link botsFor} says,
   * each with a name drawn from {@link BOT_NAMES} that nobody in the round
   * has, and a character no person in the round has, where one is left.
   */
  private bots(people: Seat[]): Seat[] {
    const count = botsFor(this.rules, people.length);
    const taken = new Set(people.map((s) => s.characterId));
    const free = CHARACTERS.filter((c) => !taken.has(c.id));
    const pool = free.length ? free : CHARACTERS;
    const names = BOT_NAMES.filter(
      (n) => !people.some((s) => s.name.toLowerCase() === n.toLowerCase()),
    );
    const name = (i: number) => {
      const index = Math.floor(this.random() * names.length);
      // Five seats never run through the list; a number only as a last resort.
      return names.splice(index, 1)[0] ?? `${BOT_NAMES[i]} ${i + 1}`;
    };
    return Array.from({ length: Math.max(0, count) }, (_, i) => ({
      id: botId(i + 1),
      name: name(i),
      characterId:
        pool[(this.rounds + i) % pool.length]?.id ?? DEFAULT_CHARACTER_ID,
      bot: true,
    }));
  }

  /** Decides whether the winner keeps a seat, counting their wins in a row. */
  private crown(winnerId: string | null): RoundOutcome | null {
    const previous = this.championValue;
    this.championValue = null;
    if (!winnerId || this.gone.has(winnerId)) return null;
    // A bot's win is a win, but its seat is never kept.
    if (isBotId(winnerId)) return { winnerId, streak: 1, stays: false };
    const streak = (previous?.id === winnerId ? previous.streak : 0) + 1;
    const limit = this.rules.winnerStays;
    const stays =
      limit > 0 && streak < limit && !this.leavingAfter.has(winnerId);
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
      .filter(
        (s) =>
          !s.bot &&
          !this.gone.has(s.id) &&
          !this.leavingAfter.has(s.id) &&
          !this.isQueued(s.id),
      )
      .sort((a, b) => place(a.id) - place(b.id));
    const champion = back.find((s) => s.id === this.championValue?.id);
    if (champion) this.queue.unshift(champion);
    this.queue.push(...back.filter((s) => s !== champion));
    this.players = [];
    this.standings = [];
    this.gone.clear();
    this.leavingAfter.clear();
  }
}
