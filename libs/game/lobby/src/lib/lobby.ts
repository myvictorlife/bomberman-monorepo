import {
  CampaignProgress,
  CHARACTERS,
  DEFAULT_CHARACTER_ID,
  EMPTY_PROGRESS,
  StageResult,
} from '@libs/game-core';
import {
  botsFor,
  Champion,
  LobbyPhase,
  LobbySnapshot,
  NO_WATCHERS,
  peopleNeeded,
  RoomRules,
  Seat,
  StageLobby,
  Watchers,
} from '@libs/game-protocol';
import {
  currentStage,
  nextStageFor,
  progressAfterStage,
  stageChoices,
  StageOutcome,
} from './stage-run';

/** Between two stages, the team's countdown: short, since they are all there already. */
export const STAGE_CONTINUE_MS = 10_000;

/** Why the host's request was refused; `ok` when it went through. */
export type HostResult =
  | 'ok'
  | 'not-host'
  | 'stage-locked'
  | 'nothing-to-start';

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
  /** Stages room: the stage this round plays. */
  stageId?: string;
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
 *   as someone is watching — until someone queues, which ends that round
 *   and counts down to theirs. Bots never queue: each round makes its own.
 */
export class Lobby {
  private phaseValue: LobbyPhase = 'waiting';
  private queue: Seat[] = [];
  private players: Seat[] = [];
  /** Players of the current round who disconnected — not put back in the queue. */
  private readonly gone = new Set<string>();
  /**
   * People of the current round who fell, in the order they fell: they may
   * stand on the border too, in the places the queue leaves free.
   */
  private fallenIds: string[] = [];
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
  /** Stages room: each player's campaign, while they hold a place. */
  private readonly progress = new Map<string, CampaignProgress>();
  /** Stages room: what the next round plays — the host's pick. */
  private stagePick: string | null = null;
  /** Whose pick `stagePick` is: a new host starts from where they are in the campaign. */
  private pickHost: string | null = null;
  /** Stages room: the team just finished a stage and goes on together, on a short countdown. */
  private continuing = false;
  /** Stages room: the stage of the round being played — fixed when it starts, whoever hosts after. */
  private roundStage: string | null = null;

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

  /**
   * Who stands on the border of the round in progress: the next in line
   * first, then — in the places they leave free — the people of the round
   * who fell, in the order they fell. Someone joining the line takes the
   * place of whoever fell last. Empty between rounds.
   */
  outsiders(): Seat[] {
    if (this.phaseValue !== 'playing') return [];
    const places = Math.max(0, this.rules.outsiders);
    const fallen = this.fallenIds
      .map((id) => this.players.find((s) => s.id === id))
      .filter((s): s is Seat => !!s && !this.gone.has(s.id));
    return [...this.queue, ...fallen].slice(0, places).map((s) => ({ ...s }));
  }

  /**
   * A person of the round fell: they may go to the border and win their way
   * back in. Bots stay down — they do not play from the border.
   */
  fell(id: string): boolean {
    if (
      this.phaseValue !== 'playing' ||
      this.rulesValue.mode === 'stages' ||
      !this.rulesValue.fallenOutside
    )
      return false;
    const seat = this.players.find((s) => s.id === id);
    if (!seat || seat.bot || this.gone.has(id) || this.fallenIds.includes(id))
      return false;
    this.fallenIds.push(id);
    return true;
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
    // One who fell is a player of the round already: they are just back.
    if (this.fallenIds.includes(id)) {
      this.fallenIds = this.fallenIds.filter((f) => f !== id);
      return true;
    }
    this.queue = this.queue.filter((s) => s.id !== id);
    this.players.push(seat);
    return true;
  }

  /**
   * Gets in line. In the stages room `progress` is how far they are in the
   * campaign — the host's decides which stages the team may play.
   */
  join(seat: Seat, progress?: CampaignProgress): JoinResult {
    if (this.isQueued(seat.id)) return 'already-queued';
    if (this.isPlaying(seat.id)) return 'already-playing';
    this.queue.push({ ...seat });
    if (this.isStages) this.progress.set(seat.id, progress ?? EMPTY_PROGRESS);
    return 'queued';
  }

  private get isStages(): boolean {
    return this.rulesValue.mode === 'stages';
  }

  /** A player's campaign as the room knows it; `undefined` without a place. */
  progressOf(id: string): CampaignProgress | undefined {
    return this.progress.get(id);
  }

  /**
   * The stages room's host: the first of the round being played (or just
   * decided), else the first in line. Picks the stage and may start early.
   */
  hostId(): string | null {
    if (this.phaseValue === 'playing' || this.phaseValue === 'results') {
      const first = this.players.find((s) => !s.bot && !this.gone.has(s.id));
      if (first) return first.id;
    }
    return this.queue[0]?.id ?? null;
  }

  /** The stage the next round plays: the host's pick, kept among the host's choices. */
  stageId(): string | null {
    if (!this.isStages) return null;
    const host = this.hostId();
    const progress = (host && this.progress.get(host)) || EMPTY_PROGRESS;
    const choices = stageChoices(progress);
    if (
      host !== this.pickHost ||
      !this.stagePick ||
      !choices.includes(this.stagePick)
    )
      this.stagePick = currentStage(progress);
    this.pickHost = host;
    return this.stagePick;
  }

  /** The host picks the stage of the next round, among those they have open. */
  pickStage(id: string, stageId: string): HostResult {
    if (!this.isStages || id !== this.hostId()) return 'not-host';
    if (this.phaseValue === 'playing') return 'not-host';
    const progress = this.progress.get(id) ?? EMPTY_PROGRESS;
    if (!stageChoices(progress).includes(stageId)) return 'stage-locked';
    this.stagePick = stageId;
    this.pickHost = id;
    return 'ok';
  }

  /**
   * The host starts the round now with whoever is in line, rather than
   * waiting the countdown out. Call {@link update} after it: the round
   * starts there.
   */
  startNow(id: string, now: number): HostResult {
    if (!this.isStages || id !== this.hostId() || !this.isQueued(id))
      return 'not-host';
    if (this.phaseValue !== 'waiting' && this.phaseValue !== 'countdown')
      return 'nothing-to-start';
    if (this.queue.length < peopleNeeded(this.rules)) return 'nothing-to-start';
    this.phaseValue = 'countdown';
    this.countdownEndsAt = now;
    return 'ok';
  }

  /**
   * The stage is over. Each player's campaign moves on — cleared, it counts
   * for everyone who played it; lost, it costs each a life — and the next
   * stage is the host's next. Returns the players' new progress, by id, for
   * the room to keep.
   */
  finishStage(
    result: StageResult,
    outcomes: Record<string, StageOutcome>,
    now: number,
  ): Map<string, CampaignProgress> {
    const changed = new Map<string, CampaignProgress>();
    if (this.phaseValue !== 'playing' || !this.isStages) return changed;
    const stageId = this.roundStage ?? this.stageId() ?? '';
    const host = this.hostId();
    let hostGameOver = false;
    for (const seat of this.players) {
      const outcome = outcomes[seat.id];
      if (seat.bot || !outcome) continue;
      const next = progressAfterStage(
        this.progress.get(seat.id),
        stageId,
        result,
        outcome,
      );
      this.progress.set(seat.id, next.progress);
      changed.set(seat.id, next.progress);
      if (seat.id === host) hostGameOver = next.gameOver;
    }
    const hostProgress = (host && this.progress.get(host)) || EMPTY_PROGRESS;
    this.stagePick = nextStageFor(hostProgress, stageId, result, hostGameOver);
    this.pickHost = host;
    this.phaseValue = 'results';
    this.resultsEndsAt = now + this.rules.resultsMs;
    this.winnerId = null;
    this.championValue = null;
    return changed;
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
    else this.progress.delete(id);
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
    // A round of bots alone, played for an audience, gives way the moment
    // people can play: they get a round of their own instead of the border.
    if (
      this.phaseValue === 'playing' &&
      this.players.length > 0 &&
      this.players.every((s) => s.bot) &&
      this.queue.length >= peopleNeeded(this.rules)
    ) {
      this.players = [];
      this.phaseValue = 'waiting';
      this.winnerId = null;
    }
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
      // A team that just finished a stage goes on together, soon.
      const wait = this.continuing
        ? Math.min(this.rules.countdownMs, STAGE_CONTINUE_MS)
        : this.rules.countdownMs;
      this.countdownEndsAt = now + wait;
    }
    this.continuing = false;

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
      stage: this.stageSnapshot(),
    };
  }

  private stageSnapshot(): StageLobby | null {
    const pick = this.stageId();
    // During the round, the stage on screen; otherwise the next one.
    const id =
      this.phaseValue === 'playing' && this.roundStage ? this.roundStage : pick;
    if (id === null) return null;
    const hostId = this.hostId();
    const progress: Record<string, CampaignProgress> = {};
    for (const seat of [...this.players, ...this.queue])
      if (!seat.bot && this.progress.has(seat.id))
        progress[seat.id] = this.progress.get(seat.id) as CampaignProgress;
    return {
      id,
      hostId,
      choices: stageChoices(
        (hostId && this.progress.get(hostId)) || EMPTY_PROGRESS,
      ),
      progress,
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
    // The host's pick, read while the host is still first in line.
    const stageId = this.stageId();
    this.roundStage = stageId;
    const people = this.queue.splice(0, this.rules.maxPlayers);
    this.players = [...people, ...this.bots(people)];
    this.rounds++;
    this.gone.clear();
    this.fallenIds = [];
    this.leavingAfter.clear();
    this.phaseValue = 'playing';
    this.countdownEndsAt = null;
    this.winnerId = null;
    return {
      players: this.players.map((s) => ({ ...s })),
      ...(stageId ? { stageId } : {}),
    };
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
    if (this.isStages) return this.requeueTeam();
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

  /**
   * The stages room: the team stays together at the front of the line, host
   * first, so it plays the next stage with those already waiting filling the
   * seats left. Whoever left gives their place — and their progress — up.
   */
  private requeueTeam(): void {
    const team = this.players.filter(
      (s) =>
        !s.bot &&
        !this.gone.has(s.id) &&
        !this.leavingAfter.has(s.id) &&
        !this.isQueued(s.id),
    );
    for (const seat of this.players)
      if (!team.includes(seat)) this.progress.delete(seat.id);
    this.queue.unshift(...team);
    this.continuing = team.length > 0;
    this.players = [];
    this.standings = [];
    this.gone.clear();
    this.leavingAfter.clear();
  }
}
