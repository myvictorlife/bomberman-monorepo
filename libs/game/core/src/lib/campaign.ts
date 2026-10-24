/**
 * The campaign: the city split into areas, each a run of stages played
 * together against creatures, the last one against the area's boss. This file
 * is the catalogue — which creatures and bosses exist, which stage holds what,
 * in what order the areas open — so the site, the client and the server read
 * one list. What they look like belongs to the client's painters, what they
 * are called to the i18n bundles (`CREATURES.<ID>`, `BOSSES.<ID>`,
 * `AREAS.<ID>`, `STAGES.<ID>`, ids upper-cased with `-` as `_`).
 *
 * An area with no stages yet is announced but not playable ("soon"); adding
 * its stages and boss here is what opens it.
 */
import type { ArenaLayout } from './arena';
import { ARENA_ROWS } from './constants';
import { PlayerKit, sanitizeKit } from './kit';
import { MapId } from './maps';
import type { PowerUpKind } from './types';

export type CreatureId =
  | 'sauva'
  | 'pombo'
  | 'caramujo'
  | 'queroquero'
  | 'faisca'
  | 'gamba'
  | 'marimbondo'
  | 'curto';
export type BossId = 'rainha' | 'gato';
export type AreaId = 'gramado' | 'subestacao' | 'autodromo';

/**
 * How a creature walks. `wander`: straight on, turns at random when blocked.
 * `roam`: picks a new way at every crossing. `crawl`: slow and leaves slime.
 * `charge`: patrols, and dashes at a player in line of sight.
 * `playdead`: walks like `wander`; the first flame lays it on its back,
 * harmless, for a while — then it is up and running faster.
 * `fly`: over the crates (not the pillars), always towards the nearest player.
 * `volatile`: walks like `wander`, and bursts like a bomb when it falls.
 */
export type CreatureMove =
  | 'wander'
  | 'roam'
  | 'crawl'
  | 'charge'
  | 'playdead'
  | 'fly'
  | 'volatile';

export interface Creature {
  readonly id: CreatureId;
  /** Cells per second. */
  readonly speed: number;
  /** Explosions it takes. */
  readonly hp: number;
  readonly points: number;
  readonly move: CreatureMove;
}

export interface Boss {
  readonly id: BossId;
  /** Hits it takes. */
  readonly hp: number;
  /** The creature it brings along. */
  readonly minion: CreatureId;
  /** Its hits by the size of the team, 1 player first; `hp` beyond the list. */
  readonly hpByTeam?: readonly number[];
  /** How many lairs it brings — anthills, generators — that send its creatures out. */
  readonly lairs?: number;
}

export interface StageFoe {
  readonly creature: CreatureId;
  readonly count: number;
}

export interface Stage {
  /** `<area>-<n>`, n from 1, or `<area>-bonus`. */
  readonly id: string;
  readonly foes: readonly StageFoe[];
  /** Set on the area's last stage only. */
  readonly boss: BossId | null;
  /** Extra items hidden under its blocks, on top of the usual ones. */
  readonly items?: readonly PowerUpKind[];
  /**
   * A bonus stage: no creatures, an item under every block, the gate open
   * from the start, and only `seconds` to grab what you can.
   */
  readonly bonus?: boolean;
  /** Its clock, when not the usual one. */
  readonly seconds?: number;
  /**
   * The arena's shape, when not the classic 15 × 13 with a player in each
   * corner — a long stage the team crosses from one end to the other.
   */
  readonly layout?: ArenaLayout;
  /**
   * A long stage split into parts, one screen each, crossed in order. Its
   * creatures are the parts' (`foes` stays empty); a fallen player comes back
   * on the screen's left edge for a life (see `parts.ts`).
   */
  readonly parts?: readonly StagePart[];
}

/**
 * What opens a part's gate. `creatures`: none of the part's creatures is
 * left. `key`: one of them carries the key; it drops where that one falls,
 * and the gate opens when a player picks it up. `breakers`: every breaker
 * of the part blown up — each switches its arc line off. `generators`: every
 * generator blown up. `survive`: the screen runs on by itself, its left edge
 * burning, and the part is over when it reaches the end.
 */
export type PartGoal =
  | 'creatures'
  | 'key'
  | 'breakers'
  | 'generators'
  | 'survive';

/**
 * A screen of a long stage. The team crosses them in order: each part's gate
 * — the column just past its last one — is a wall until its goal is met; the
 * last part ends at the stage's gate, which opens when it is met.
 */
export interface StagePart {
  /** Its last column; the next part starts past its gate, one further. */
  readonly until: number;
  readonly goal: PartGoal;
  readonly foes: readonly StageFoe[];
  /** Its clock, started when the gate before it opens. Run out, the stage is lost. */
  readonly seconds: number;
  /**
   * Arc lines: a stretch of a row that shocks on and off, `from` to `to`, its
   * breaker standing just past `to`. Blowing up the breaker switches it off.
   */
  readonly arcs?: readonly StageLine[];
  /** Conductor cables: a bomb on one goes off at the cable's other end. */
  readonly cables?: readonly StageLine[];
  /** Generators, as `[col, row]`: they send out a creature every few seconds. */
  readonly generators?: readonly (readonly [number, number])[];
}

/** A stretch of a row, `from` to `to`. */
export interface StageLine {
  readonly row: number;
  readonly from: number;
  readonly to: number;
}

export interface Area {
  readonly id: AreaId;
  /** The arena its stages are played on. */
  readonly mapId: MapId;
  readonly stages: readonly Stage[];
}

export const CREATURES: readonly Creature[] = [
  { id: 'sauva', speed: 1.8, hp: 1, points: 100, move: 'wander' },
  { id: 'pombo', speed: 3.4, hp: 1, points: 200, move: 'roam' },
  { id: 'caramujo', speed: 1.2, hp: 2, points: 300, move: 'crawl' },
  { id: 'queroquero', speed: 2.6, hp: 1, points: 400, move: 'charge' },
  { id: 'faisca', speed: 3.4, hp: 1, points: 100, move: 'roam' },
  { id: 'gamba', speed: 1.8, hp: 2, points: 200, move: 'playdead' },
  { id: 'marimbondo', speed: 1.6, hp: 1, points: 300, move: 'fly' },
  { id: 'curto', speed: 2.6, hp: 1, points: 400, move: 'volatile' },
];

export const BOSSES: readonly Boss[] = [
  { id: 'rainha', hp: 8, minion: 'sauva' },
  { id: 'gato', hp: 10, minion: 'faisca', hpByTeam: [7, 10, 14, 14], lairs: 2 },
];

/** A long stage's shape: `cols` wide, the players down the left edge. */
function longLayout(cols: number): ArenaLayout {
  return {
    cols,
    rows: ARENA_ROWS,
    spawns: [
      [1, 1],
      [1, ARENA_ROWS - 2],
      [1, 5],
      [1, 7],
    ],
  };
}

/** A screen of a long stage, on the usual clock. */
function part(
  until: number,
  goal: PartGoal,
  foes: readonly StageFoe[],
): StagePart {
  return { until, goal, foes, seconds: PART_SECONDS };
}

/** A part's clock. */
export const PART_SECONDS = 90;

/** In the order they open: an area opens when the one before it is cleared. */
export const AREAS: readonly Area[] = [
  {
    id: 'gramado',
    mapId: 'gramado',
    stages: [
      { id: 'gramado-1', foes: [{ creature: 'sauva', count: 6 }], boss: null },
      {
        id: 'gramado-2',
        foes: [
          { creature: 'sauva', count: 4 },
          { creature: 'pombo', count: 3 },
        ],
        boss: null,
        items: ['clock', 'wallpass'],
      },
      {
        id: 'gramado-3',
        foes: [
          { creature: 'pombo', count: 4 },
          { creature: 'caramujo', count: 3 },
        ],
        boss: null,
        items: ['oneup', 'skull', 'fullfire'],
      },
      {
        id: 'gramado-4',
        foes: [
          { creature: 'queroquero', count: 3 },
          { creature: 'sauva', count: 2 },
          { creature: 'pombo', count: 2 },
          { creature: 'caramujo', count: 1 },
        ],
        boss: null,
        items: ['clock', 'skull', 'powerbomb'],
      },
      {
        id: 'gramado-bonus',
        foes: [],
        boss: null,
        bonus: true,
        seconds: 30,
        items: ['oneup', 'fullfire', 'powerbomb', 'wallpass'],
      },
      { id: 'gramado-5', foes: [], boss: 'rainha' },
    ],
  },
  {
    id: 'subestacao',
    mapId: 'subestacao',
    // Long stages: a few screens each, crossed left to right (see `parts.ts`).
    stages: [
      {
        id: 'subestacao-1',
        foes: [],
        boss: null,
        items: ['oneup'],
        layout: longLayout(31),
        parts: [
          part(14, 'creatures', [
            { creature: 'faisca', count: 2 },
            { creature: 'gamba', count: 1 },
          ]),
          part(29, 'key', [
            { creature: 'gamba', count: 2 },
            { creature: 'faisca', count: 2 },
          ]),
        ],
      },
      {
        // Arc lines: blow up their breakers to switch them off. A cable on the
        // first screen teaches what one does with a bomb.
        id: 'subestacao-2',
        foes: [],
        boss: null,
        items: ['clock', 'wallpass'],
        layout: longLayout(31),
        parts: [
          {
            ...part(14, 'creatures', [
              { creature: 'gamba', count: 2 },
              { creature: 'marimbondo', count: 1 },
            ]),
            cables: [{ row: 7, from: 3, to: 13 }],
          },
          {
            ...part(29, 'breakers', [
              { creature: 'marimbondo', count: 2 },
              { creature: 'faisca', count: 2 },
            ]),
            arcs: [
              { row: 3, from: 17, to: 26 },
              { row: 9, from: 17, to: 26 },
            ],
          },
        ],
      },
      {
        // Generators: they keep the faíscas coming until they are blown up.
        id: 'subestacao-3',
        foes: [],
        boss: null,
        items: ['fullfire', 'oneup'],
        layout: longLayout(31),
        parts: [
          part(14, 'creatures', [
            { creature: 'faisca', count: 3 },
            { creature: 'curto', count: 1 },
          ]),
          {
            ...part(29, 'generators', [{ creature: 'curto', count: 2 }]),
            generators: [
              [21, 3],
              [25, 9],
              [23, 7],
            ],
          },
        ],
      },
      {
        // The escape: the last part's screen runs on by itself, its edge
        // burning, to the floor that gives way into the boss's cellar.
        id: 'subestacao-4',
        foes: [],
        boss: null,
        items: ['clock', 'powerbomb', 'oneup'],
        layout: longLayout(61),
        parts: [
          part(14, 'creatures', [
            { creature: 'marimbondo', count: 2 },
            { creature: 'curto', count: 1 },
          ]),
          part(29, 'key', [
            { creature: 'gamba', count: 2 },
            { creature: 'faisca', count: 2 },
          ]),
          {
            ...part(59, 'survive', [
              { creature: 'marimbondo', count: 2 },
              { creature: 'curto', count: 2 },
              { creature: 'faisca', count: 2 },
            ]),
            cables: [{ row: 5, from: 33, to: 44 }],
          },
        ],
      },
      { id: 'subestacao-5', foes: [], boss: 'gato' },
    ],
  },
  { id: 'autodromo', mapId: 'autodromo', stages: [] },
];

/**
 * What a player has done in the campaign: the stages cleared, any order, and
 * the kit the last one was cleared with — what the next stage starts with.
 */
export interface CampaignProgress {
  readonly cleared: readonly string[];
  /** Absent until a stage is cleared: the campaign starts with the starting kit. */
  readonly kit?: PlayerKit;
  /** Lives left; absent is {@link START_LIVES}. */
  readonly lives?: number;
  /** Points of the run so far; back to 0 on a game over. */
  readonly score?: number;
  /** The best run's points on this device: kept through game overs. */
  readonly best?: number;
}

/** Lives a campaign starts with, and the most it can hold. */
export const START_LIVES = 3;
export const MAX_LIVES = 9;

export function livesOf(progress: CampaignProgress): number {
  return progress.lives ?? START_LIVES;
}

/** What a finished stage adds up to: its points, and the extra lives picked up. */
export interface StageTally {
  score: number;
  livesGained: number;
}

/** A cleared stage: it counts, its kit goes on, its points and lives are added. */
export function afterClear(
  progress: CampaignProgress,
  stageId: string,
  kit: PlayerKit | undefined,
  tally: StageTally,
): CampaignProgress {
  const score = (progress.score ?? 0) + tally.score;
  return sanitizeProgress({
    cleared: [...progress.cleared, stageId],
    kit: kit ?? progress.kit,
    lives: livesOf(progress) + tally.livesGained,
    score,
    best: Math.max(progress.best ?? 0, score),
  });
}

/**
 * A lost stage costs a life and everything carried: the next go at it starts
 * with the starting kit. With no life left it is game over — back to the
 * area's first stage, the run's points gone, the lives full again; only the
 * best score stays.
 */
export function afterLoss(
  progress: CampaignProgress,
  stageId: string,
  tally: StageTally,
): { progress: CampaignProgress; gameOver: boolean } {
  const score = (progress.score ?? 0) + tally.score;
  const best = Math.max(progress.best ?? 0, score);
  const lives = livesOf(progress) - 1 + tally.livesGained;
  if (lives > 0)
    return {
      gameOver: false,
      progress: sanitizeProgress({
        cleared: progress.cleared,
        lives,
        score,
        best,
      }),
    };
  const lost = new Set(
    areaOfStage(stageId)?.stages.map((s) => s.id) ?? [stageId],
  );
  return {
    gameOver: true,
    progress: sanitizeProgress({
      cleared: progress.cleared.filter((id) => !lost.has(id)),
      best,
    }),
  };
}

export const EMPTY_PROGRESS: CampaignProgress = { cleared: [] };

export type StageStatus = 'cleared' | 'open' | 'locked';
/** `soon`: announced, no stages yet. */
export type AreaStatus = 'open' | 'locked' | 'soon';

/** Every stage of every area, in the order they are played. */
export function stagesInOrder(): readonly Stage[] {
  return AREAS.flatMap((a) => a.stages);
}

export function isStageId(value: string): boolean {
  return stagesInOrder().some((s) => s.id === value);
}

export function findArea(id: AreaId): Area {
  return AREAS.find((a) => a.id === id) ?? (AREAS[0] as Area);
}

export function findCreature(id: CreatureId): Creature {
  return CREATURES.find((c) => c.id === id) ?? (CREATURES[0] as Creature);
}

export function findBoss(id: BossId): Boss {
  return BOSSES.find((b) => b.id === id) ?? (BOSSES[0] as Boss);
}

/** The area a stage belongs to, or `undefined` for an unknown id. */
export function areaOfStage(stageId: string): Area | undefined {
  return AREAS.find((a) => a.stages.some((s) => s.id === stageId));
}

/**
 * The number players read: `1-3` is the third stage of the first area. A
 * bonus stage is not counted: it reads `1-B`.
 */
export function stageCode(stageId: string): string {
  const area = areaOfStage(stageId);
  if (!area) return '';
  const index = area.stages.findIndex((s) => s.id === stageId);
  const prefix = `${AREAS.indexOf(area) + 1}-`;
  if (area.stages[index]?.bonus) return `${prefix}B`;
  const n = area.stages.slice(0, index + 1).filter((s) => !s.bonus).length;
  return `${prefix}${n}`;
}

export function findStage(stageId: string): Stage | undefined {
  return areaOfStage(stageId)?.stages.find((s) => s.id === stageId);
}

/** A stage opens once the one before it — across areas — is cleared. */
export function stageStatus(
  progress: CampaignProgress,
  stageId: string,
): StageStatus {
  if (progress.cleared.includes(stageId)) return 'cleared';
  const order = stagesInOrder();
  const index = order.findIndex((s) => s.id === stageId);
  if (index < 0) return 'locked';
  if (index === 0) return 'open';
  const previous = order[index - 1] as Stage;
  return progress.cleared.includes(previous.id) ? 'open' : 'locked';
}

export function areaStatus(
  progress: CampaignProgress,
  areaId: AreaId,
): AreaStatus {
  const first = findArea(areaId).stages[0];
  if (!first) return 'soon';
  return stageStatus(progress, first.id) === 'locked' ? 'locked' : 'open';
}

/** How many of an area's stages are cleared. */
export function clearedInArea(
  progress: CampaignProgress,
  areaId: AreaId,
): number {
  return findArea(areaId).stages.filter((s) => progress.cleared.includes(s.id))
    .length;
}

/** The area's boss, from its last stage; `null` while it has none. */
export function bossOfArea(areaId: AreaId): BossId | null {
  return findArea(areaId).stages.find((s) => s.boss)?.boss ?? null;
}

/**
 * Every creature a stage brings, each kind once with its total: its own
 * foes, its parts' on a long stage, and its boss's minion on a boss stage.
 */
export function foesOf(stage: Stage): readonly StageFoe[] {
  const all = [
    ...stage.foes,
    ...(stage.parts ?? []).flatMap((p) => p.foes),
    ...(stage.boss
      ? [{ creature: findBoss(stage.boss).minion, count: 0 }]
      : []),
  ];
  const foes: StageFoe[] = [];
  for (const foe of all) {
    const i = foes.findIndex((f) => f.creature === foe.creature);
    const known = foes[i];
    if (known) foes[i] = { ...known, count: known.count + foe.count };
    else foes.push(foe);
  }
  return foes;
}

/** The creatures an area's stages bring, each once, in order of appearance. */
export function creaturesOfArea(areaId: AreaId): readonly CreatureId[] {
  const seen: CreatureId[] = [];
  for (const stage of findArea(areaId).stages) {
    for (const foe of foesOf(stage)) {
      if (!seen.includes(foe.creature)) seen.push(foe.creature);
    }
  }
  return seen;
}

/** The progress kept only as known, de-duplicated stage ids and a kit within the limits. */
export function sanitizeProgress(value: unknown): CampaignProgress {
  if (!value || typeof value !== 'object') return EMPTY_PROGRESS;
  const { cleared, kit, lives, score, best } = value as Record<string, unknown>;
  if (!Array.isArray(cleared)) return EMPTY_PROGRESS;
  const ids = cleared.filter(
    (id): id is string => typeof id === 'string' && isStageId(id),
  );
  const count = (n: unknown, max = Number.MAX_SAFE_INTEGER) =>
    typeof n === 'number' && Number.isFinite(n)
      ? Math.min(max, Math.max(0, Math.floor(n)))
      : undefined;
  const result: {
    cleared: string[];
    kit?: PlayerKit;
    lives?: number;
    score?: number;
    best?: number;
  } = { cleared: [...new Set(ids)] };
  if (kit !== undefined) result.kit = sanitizeKit(kit);
  const l = count(lives, MAX_LIVES);
  if (l !== undefined) result.lives = Math.max(1, l);
  const s = count(score);
  if (s !== undefined) result.score = s;
  const b = count(best);
  if (b !== undefined) result.best = b;
  return result;
}
