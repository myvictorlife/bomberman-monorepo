import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { signal } from '@angular/core';
import { AUTH, AuthUser } from '@libs/auth';
import { EMPTY_PROGRESS } from '@libs/game-core';
import { CampaignProgressService } from './campaign-progress.service';
import {
  areaStartId,
  canEnterStages,
  canPlay,
  nextStageId,
} from './stage-access';
import { playableStageGuard } from './stage-launcher';

describe('stage access', () => {
  it('lets the first stage be played, and no locked one', () => {
    expect(canPlay(EMPTY_PROGRESS, 'gramado-1')).toBe(true);
    expect(canPlay(EMPTY_PROGRESS, 'gramado-2')).toBe(false);
    expect(canPlay({ cleared: ['gramado-1'] }, 'gramado-2')).toBe(true);
    const four = {
      cleared: ['gramado-1', 'gramado-2', 'gramado-3', 'gramado-4'],
    };
    expect(canPlay(four, 'gramado-bonus')).toBe(true);
    expect(canPlay(four, 'gramado-5')).toBe(false);
    expect(
      canPlay({ cleared: [...four.cleared, 'gramado-bonus'] }, 'gramado-5'),
    ).toBe(true);
    expect(canPlay(EMPTY_PROGRESS, 'gramado-5')).toBe(false);
    expect(canPlay(EMPTY_PROGRESS, 'nope')).toBe(false);
  });

  it('knows where a lost stage sends the player back to', () => {
    expect(areaStartId('gramado-4')).toBe('gramado-1');
    expect(areaStartId('nope')).toBe('nope');
  });

  it('knows the stage that comes next', () => {
    expect(nextStageId('gramado-1')).toBe('gramado-2');
    expect(nextStageId('gramado-4')).toBe('gramado-bonus');
    expect(nextStageId('gramado-5')).toBeNull();
    expect(nextStageId('nope')).toBeNull();
  });
});

const user = (emailVerified: boolean): AuthUser => ({
  id: 'u1',
  email: 'a@b.c',
  displayName: 'A',
  emailVerified,
});

describe('canEnterStages', () => {
  it('lets a signed-in player with a confirmed address in', () => {
    expect(canEnterStages({ available: true, user: signal(user(true)) })).toBe(
      true,
    );
    expect(canEnterStages({ available: true, user: signal(user(false)) })).toBe(
      false,
    );
    expect(canEnterStages({ available: true, user: signal(null) })).toBe(false);
  });

  it('lets everyone in where no sign-in is configured', () => {
    expect(canEnterStages({ available: false, user: signal(null) })).toBe(true);
  });
});

describe('playableStageGuard', () => {
  let signedIn: AuthUser | null = user(true);

  const guard = (stageId: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CampaignProgressService,
          useValue: { progress: () => EMPTY_PROGRESS },
        },
        {
          provide: AUTH,
          useValue: {
            available: true,
            user: signal(signedIn),
            initialize: () => Promise.resolve(),
          },
        },
      ],
    });
    const route = {
      paramMap: convertToParamMap({ stageId }),
    } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() =>
      playableStageGuard(route, {} as RouterStateSnapshot),
    );
  };

  beforeEach(() => (signedIn = user(true)));

  it('opens a stage that can be played', async () => {
    expect(await guard('gramado-1')).toBe(true);
  });

  it('sends anything else back to the map', async () => {
    const result = await guard('gramado-3');
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/campaign');
  });

  it('sends a signed-out player back to the map, where the sign-in is', async () => {
    signedIn = null;
    expect(String(await guard('gramado-1'))).toBe('/campaign');
  });
});
