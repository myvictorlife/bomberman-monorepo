import { computed, inject } from '@angular/core';
import {
  AreaId,
  AREAS,
  AreaStatus,
  areaStatus,
  BossId,
  bossOfArea,
  clearedInArea,
  CreatureId,
  creaturesOfArea,
  foesOf,
  findArea,
  KIT_LIMITS,
  livesOf,
  PlayerKit,
  StageFoe,
  START_KIT,
  stageCode,
  StageStatus,
  stageStatus,
} from '@libs/game-core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { CampaignProgressService } from '../services/campaign-progress.service';
import { canPlay } from '../services/stage-access';

export type CollectionTab = 'bosses' | 'creatures';

export interface CampaignState {
  areaId: AreaId;
  /** The stage in focus on the map; `null` follows the next one to play. */
  stageId: string | null;
  tab: CollectionTab;
}

export const initialCampaignState: CampaignState = {
  areaId: AREAS[0]?.id ?? 'gramado',
  stageId: null,
  tab: 'bosses',
};

export interface AreaView {
  id: AreaId;
  /** 1-based, as players count them. */
  number: number;
  status: AreaStatus;
  cleared: number;
  total: number;
}

export interface StageView {
  id: string;
  code: string;
  status: StageStatus;
  foes: readonly StageFoe[];
  boss: BossId | null;
  bonus: boolean;
  /** Open to play now: unlocked. */
  playable: boolean;
}

/** One card of the collection: known, or a silhouette for its area. */
export interface BossView {
  areaId: AreaId;
  areaNumber: number;
  bossId: BossId | null;
  status: 'defeated' | 'known' | 'locked' | 'soon';
}

export interface CreatureView {
  areaId: AreaId;
  areaNumber: number;
  /** `null`: an area still hidden — its creatures are not shown. */
  creatureId: CreatureId | null;
}

/**
 * The campaign pages: the areas and their stages on the map, and the
 * collection of bosses and creatures. Statuses come from the rules in
 * `@libs/game-core` applied to the player's progress, so this store only
 * picks what is in focus. Provided on the route.
 */
export const CampaignStore = signalStore(
  withState(initialCampaignState),
  withComputed(
    ({ areaId, stageId }, progress = inject(CampaignProgressService)) => {
      const areas = computed((): readonly AreaView[] =>
        AREAS.map((a, i) => ({
          id: a.id,
          number: i + 1,
          status: areaStatus(progress.progress(), a.id),
          cleared: clearedInArea(progress.progress(), a.id),
          total: a.stages.length,
        })),
      );
      const area = computed(
        () => areas().find((a) => a.id === areaId()) as AreaView,
      );
      const stages = computed((): readonly StageView[] =>
        findArea(areaId()).stages.map((s) => ({
          id: s.id,
          code: stageCode(s.id),
          status: stageStatus(progress.progress(), s.id),
          foes: foesOf(s),
          boss: s.boss,
          bonus: !!s.bonus,
          playable: canPlay(progress.progress(), s.id),
        })),
      );
      const stage = computed((): StageView | null => {
        const list = stages();
        return (
          list.find((s) => s.id === stageId()) ??
          list.find((s) => s.status === 'open') ??
          list[0] ??
          null
        );
      });
      const bosses = computed((): readonly BossView[] =>
        areas().map((a) => {
          const bossId = bossOfArea(a.id);
          const stage = findArea(a.id).stages.find((s) => s.boss);
          const beaten =
            !!stage && stageStatus(progress.progress(), stage.id) === 'cleared';
          return {
            areaId: a.id,
            areaNumber: a.number,
            bossId,
            status: !bossId
              ? 'soon'
              : beaten
                ? 'defeated'
                : a.status === 'open'
                  ? 'known'
                  : 'locked',
          };
        }),
      );
      const creatures = computed((): readonly CreatureView[] =>
        areas().flatMap((a): CreatureView[] =>
          a.status === 'open'
            ? creaturesOfArea(a.id).map((creatureId) => ({
                areaId: a.id,
                areaNumber: a.number,
                creatureId,
              }))
            : [{ areaId: a.id, areaNumber: a.number, creatureId: null }],
        ),
      );
      return {
        /** What the next stage starts with. */
        kit: computed((): PlayerKit => progress.progress().kit ?? START_KIT),
        lives: computed(() => livesOf(progress.progress())),
        score: computed(() => progress.progress().score ?? 0),
        best: computed(() => progress.progress().best ?? 0),
        limits: computed(() => KIT_LIMITS),
        areas,
        area,
        stages,
        stage,
        bosses,
        creatures,
        bossesKnown: computed(
          () =>
            bosses().filter(
              (b) => b.status === 'known' || b.status === 'defeated',
            ).length,
        ),
        creaturesKnown: computed(
          () => creatures().filter((c) => c.creatureId).length,
        ),
      };
    },
  ),
  withMethods((store) => ({
    selectArea(areaId: AreaId): void {
      patchState(store, { areaId, stageId: null });
    },
    selectStage(stageId: string): void {
      patchState(store, { stageId });
    },
    setTab(tab: CollectionTab): void {
      patchState(store, { tab });
    },
  })),
);
