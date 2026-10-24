import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CampaignProgress, EMPTY_PROGRESS } from '@libs/game-core';
import { CampaignProgressService } from '../services/campaign-progress.service';
import { CampaignStore } from './campaign.store';

describe('CampaignStore', () => {
  const createStore = (start: CampaignProgress = EMPTY_PROGRESS) => {
    const progress = signal(start);
    TestBed.configureTestingModule({
      providers: [
        CampaignStore,
        { provide: CampaignProgressService, useValue: { progress } },
      ],
    });
    return { store: TestBed.inject(CampaignStore), progress };
  };

  it('lists the areas in order with their status and progress', () => {
    const { store } = createStore({ cleared: ['gramado-1', 'gramado-2'] });

    expect(store.areas()).toEqual([
      { id: 'gramado', number: 1, status: 'open', cleared: 2, total: 6 },
      { id: 'subestacao', number: 2, status: 'locked', cleared: 0, total: 5 },
      { id: 'autodromo', number: 3, status: 'soon', cleared: 0, total: 0 },
    ]);
    expect(store.area().id).toBe('gramado');
  });

  it('focuses the next stage to play until another is picked', () => {
    const { store, progress } = createStore();

    expect(store.stage()?.id).toBe('gramado-1');
    expect(store.stages().map((s) => s.code)).toEqual([
      '1-1',
      '1-2',
      '1-3',
      '1-4',
      '1-B',
      '1-5',
    ]);

    progress.set({ cleared: ['gramado-1'] });
    expect(store.stage()?.id).toBe('gramado-2');

    store.selectStage('gramado-5');
    expect(store.stage()).toEqual(
      expect.objectContaining({
        id: 'gramado-5',
        status: 'locked',
        boss: 'rainha',
      }),
    );
  });

  it('shows no stage for an area that has none, and resets the pick on switching', () => {
    const { store } = createStore();
    store.selectStage('gramado-3');

    store.selectArea('autodromo');

    expect(store.stages()).toEqual([]);
    expect(store.stage()).toBeNull();
    store.selectArea('gramado');
    expect(store.stage()?.id).toBe('gramado-1');
  });

  it('knows the bosses of open areas and keeps the rest as silhouettes', () => {
    const { store } = createStore();

    expect(store.bosses()).toEqual([
      { areaId: 'gramado', areaNumber: 1, bossId: 'rainha', status: 'known' },
      { areaId: 'subestacao', areaNumber: 2, bossId: 'gato', status: 'locked' },
      { areaId: 'autodromo', areaNumber: 3, bossId: null, status: 'soon' },
    ]);
    expect(store.bossesKnown()).toBe(1);
  });

  it('marks a boss defeated once its stage is cleared', () => {
    const { store } = createStore({
      cleared: [
        'gramado-1',
        'gramado-2',
        'gramado-3',
        'gramado-4',
        'gramado-5',
      ],
    });

    expect(store.bosses()[0]?.status).toBe('defeated');
    // Beating it opens the next area: its boss is known now, not yet beaten.
    expect(store.bosses()[1]?.status).toBe('known');
    expect(store.bossesKnown()).toBe(2);
  });

  it('shows the creatures of open areas and one silhouette per hidden area', () => {
    const { store } = createStore();

    expect(store.creatures().map((c) => c.creatureId)).toEqual([
      'sauva',
      'pombo',
      'caramujo',
      'queroquero',
      null,
      null,
    ]);
    expect(store.creaturesKnown()).toBe(4);
  });

  it('switches the collection tab', () => {
    const { store } = createStore();
    expect(store.tab()).toBe('bosses');

    store.setTab('creatures');

    expect(store.tab()).toBe('creatures');
  });
});
