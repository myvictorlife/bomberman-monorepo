import { TestBed } from '@angular/core/testing';
import { START_KIT } from '@libs/game-core';
import {
  CAMPAIGN_PROGRESS_KEY,
  CampaignProgressService,
} from './campaign-progress.service';

describe('CampaignProgressService', () => {
  const create = () => {
    TestBed.configureTestingModule({ providers: [CampaignProgressService] });
    return TestBed.inject(CampaignProgressService);
  };
  const saved = () =>
    JSON.parse(localStorage.getItem(CAMPAIGN_PROGRESS_KEY) ?? '');

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('starts empty when nothing is saved', () => {
    expect(create().progress()).toEqual({ cleared: [] });
  });

  it('restores saved progress, dropping what it does not know', () => {
    localStorage.setItem(
      CAMPAIGN_PROGRESS_KEY,
      JSON.stringify({ cleared: ['gramado-1', 'nope'], lives: 2 }),
    );

    expect(create().progress()).toEqual({ cleared: ['gramado-1'], lives: 2 });
  });

  it('starts empty when the saved value is not JSON', () => {
    localStorage.setItem(CAMPAIGN_PROGRESS_KEY, '{oops');

    expect(create().progress()).toEqual({ cleared: [] });
  });

  it('saves a cleared stage with its kit, points and extra lives', () => {
    const service = create();
    const kit = { ...START_KIT, fireRange: 6 };

    service.markCleared('gramado-1', kit, { score: 300, livesGained: 1 });
    service.markCleared('gramado-2');

    const expected = {
      cleared: ['gramado-1', 'gramado-2'],
      kit,
      lives: 4,
      score: 300,
      best: 300,
    };
    expect(service.progress()).toEqual(expected);
    expect(saved()).toEqual(expected);
  });

  it('a lost stage costs a life and the kit; the last one is game over', () => {
    const service = create();
    service.markCleared('gramado-1', { ...START_KIT, maxBombs: 4 });

    expect(
      service.markFailed('gramado-2', { score: 100, livesGained: 0 }),
    ).toBe(false);
    expect(service.progress()).toEqual({
      cleared: ['gramado-1'],
      lives: 2,
      score: 100,
      best: 100,
    });

    service.markFailed('gramado-2');
    expect(service.markFailed('gramado-2')).toBe(true);
    expect(service.progress()).toEqual({ cleared: [], best: 100 });
  });

  it('keeps going when storage refuses to save', () => {
    const service = create();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    service.markCleared('gramado-1');

    expect(service.progress().cleared).toEqual(['gramado-1']);
  });
});
