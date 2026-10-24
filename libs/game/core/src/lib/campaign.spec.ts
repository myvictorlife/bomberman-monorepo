import {
  afterClear,
  afterLoss,
  livesOf,
  MAX_LIVES,
  START_LIVES,
  AREAS,
  areaOfStage,
  areaStatus,
  BOSSES,
  bossOfArea,
  clearedInArea,
  creaturesOfArea,
  CREATURES,
  EMPTY_PROGRESS,
  findArea,
  findBoss,
  findCreature,
  isStageId,
  sanitizeProgress,
  stageCode,
  stagesInOrder,
  stageStatus,
  findStage,
  foesOf,
} from './campaign';
import { START_KIT } from './kit';
import { isMapId } from './maps';

describe('campaign catalogue', () => {
  it('gives every stage a unique id prefixed by its area', () => {
    const ids = stagesInOrder().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const area of AREAS) {
      for (const stage of area.stages) {
        expect(stage.id.startsWith(`${area.id}-`)).toBe(true);
      }
    }
  });

  it('plays every area on a known map', () => {
    for (const area of AREAS) expect(isMapId(area.mapId)).toBe(true);
  });

  it('only names known creatures and bosses', () => {
    for (const stage of stagesInOrder()) {
      for (const foe of stage.foes) {
        expect(CREATURES.some((c) => c.id === foe.creature)).toBe(true);
        expect(foe.count).toBeGreaterThan(0);
      }
      if (stage.boss) {
        expect(BOSSES.some((b) => b.id === stage.boss)).toBe(true);
      }
    }
  });

  it('puts the boss on the last stage of an area, and only there', () => {
    for (const area of AREAS) {
      area.stages.forEach((stage, i) => {
        if (stage.boss) expect(i).toBe(area.stages.length - 1);
      });
    }
  });

  it('finds by id and falls back to the first entry', () => {
    expect(findArea('subestacao').id).toBe('subestacao');
    expect(findCreature('pombo').id).toBe('pombo');
    expect(findBoss('rainha').hp).toBe(8);
    expect(findArea('nope' as never).id).toBe('gramado');
    expect(findCreature('nope' as never).id).toBe('sauva');
    expect(findBoss('nope' as never).id).toBe('rainha');
  });

  it('recognises stage ids', () => {
    expect(isStageId('gramado-1')).toBe(true);
    expect(isStageId('gramado-9')).toBe(false);
  });

  it('reads the stage code players see', () => {
    expect(stageCode('gramado-1')).toBe('1-1');
    expect(stageCode('gramado-5')).toBe('1-5');
    expect(stageCode('nope')).toBe('');
    expect(areaOfStage('gramado-3')?.id).toBe('gramado');
  });

  it('knows the boss and the creatures of an area', () => {
    expect(bossOfArea('gramado')).toBe('rainha');
    expect(bossOfArea('autodromo')).toBeNull();
    expect(creaturesOfArea('gramado')).toEqual([
      'sauva',
      'pombo',
      'caramujo',
      'queroquero',
    ]);
    // A long stage's creatures are its parts'.
    expect(bossOfArea('subestacao')).toBe('gato');
    expect(creaturesOfArea('subestacao')).toEqual([
      'faisca',
      'gamba',
      'marimbondo',
      'curto',
    ]);
    expect(creaturesOfArea('autodromo')).toEqual([]);
  });

  it('adds up the creatures of a stage, its parts and its boss', () => {
    const stage = (id: string) => {
      const found = findStage(id);
      if (!found) throw new Error(`no stage ${id}`);
      return found;
    };
    expect(foesOf(stage('subestacao-1'))).toEqual([
      { creature: 'faisca', count: 4 },
      { creature: 'gamba', count: 3 },
    ]);
    expect(foesOf(stage('subestacao-5'))).toEqual([
      { creature: 'faisca', count: 0 },
    ]);
  });
});

describe('campaign progress', () => {
  it('opens only the first stage of a fresh campaign', () => {
    expect(stageStatus(EMPTY_PROGRESS, 'gramado-1')).toBe('open');
    expect(stageStatus(EMPTY_PROGRESS, 'gramado-2')).toBe('locked');
    expect(stageStatus(EMPTY_PROGRESS, 'nope')).toBe('locked');
  });

  it('opens a stage once the one before it is cleared', () => {
    const progress = { cleared: ['gramado-1'] };
    expect(stageStatus(progress, 'gramado-1')).toBe('cleared');
    expect(stageStatus(progress, 'gramado-2')).toBe('open');
    expect(stageStatus(progress, 'gramado-3')).toBe('locked');
    expect(clearedInArea(progress, 'gramado')).toBe(1);
  });

  it('opens the first area and announces the ones without stages', () => {
    expect(areaStatus(EMPTY_PROGRESS, 'gramado')).toBe('open');
    expect(areaStatus(EMPTY_PROGRESS, 'autodromo')).toBe('soon');
  });

  it('keeps an area with stages locked until the previous one is cleared', () => {
    const original = AREAS[1];
    const withStages = {
      ...findArea('subestacao'),
      stages: [{ id: 'subestacao-1', foes: [], boss: null }],
    };
    (AREAS as unknown as (typeof withStages)[])[1] = withStages;
    try {
      expect(areaStatus(EMPTY_PROGRESS, 'subestacao')).toBe('locked');
      const all = { cleared: findArea('gramado').stages.map((s) => s.id) };
      expect(areaStatus(all, 'subestacao')).toBe('open');
    } finally {
      (AREAS as unknown as (typeof original)[])[1] = original;
    }
  });

  it('sanitizes whatever storage hands back', () => {
    expect(sanitizeProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(sanitizeProgress('x')).toEqual(EMPTY_PROGRESS);
    expect(sanitizeProgress({ cleared: 'x' })).toEqual(EMPTY_PROGRESS);
    expect(
      sanitizeProgress({ cleared: ['gramado-1', 'gramado-1', 'nope', 3] }),
    ).toEqual({ cleared: ['gramado-1'] });
  });
});

describe('lives and points', () => {
  const tally = (score = 0, livesGained = 0) => ({ score, livesGained });

  it('starts with three lives and no points', () => {
    expect(livesOf(EMPTY_PROGRESS)).toBe(START_LIVES);
  });

  it('adds a cleared stage, its points and its extra lives, and keeps the best', () => {
    const p = afterClear(
      { cleared: [], best: 50 },
      'gramado-1',
      undefined,
      tally(300, 1),
    );

    expect(p).toEqual({
      cleared: ['gramado-1'],
      lives: 4,
      score: 300,
      best: 300,
    });
    expect(
      afterClear(
        { cleared: [], lives: MAX_LIVES },
        'gramado-1',
        undefined,
        tally(0, 2),
      ).lives,
    ).toBe(MAX_LIVES);
  });

  it('a loss costs a life and the kit, and the same stage is tried again', () => {
    const before = {
      cleared: ['gramado-1', 'gramado-2'],
      lives: 3,
      score: 400,
      kit: { ...START_KIT, maxBombs: 5 },
    };

    const { progress, gameOver } = afterLoss(
      before,
      'gramado-3',
      tally(100, 0),
    );

    expect(gameOver).toBe(false);
    expect(progress).toEqual({
      cleared: ['gramado-1', 'gramado-2'],
      lives: 2,
      score: 500,
      best: 500,
    });
  });

  it('an extra life picked up in a lost stage still counts', () => {
    const { progress } = afterLoss(
      { cleared: [], lives: 1 },
      'gramado-1',
      tally(0, 1),
    );
    expect(progress.lives).toBe(1);
  });

  it('the last life lost is game over: back to the area start, points gone, best kept', () => {
    const { progress, gameOver } = afterLoss(
      { cleared: ['gramado-1', 'gramado-2'], lives: 1, score: 900, best: 700 },
      'gramado-3',
      tally(50, 0),
    );

    expect(gameOver).toBe(true);
    expect(progress).toEqual({ cleared: [], best: 950 });
    expect(livesOf(progress)).toBe(START_LIVES);
  });

  it('cleans lives and points from storage', () => {
    expect(
      sanitizeProgress({ cleared: [], lives: 99, score: -5, best: 'x' }),
    ).toEqual({
      cleared: [],
      lives: MAX_LIVES,
      score: 0,
    });
    expect(sanitizeProgress({ cleared: [], lives: 0 }).lives).toBe(1);
  });
});
