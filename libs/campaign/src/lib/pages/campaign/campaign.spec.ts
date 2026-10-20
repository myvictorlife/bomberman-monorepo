import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AUTH, AuthUser } from '@libs/auth';
import { CampaignProgress, EMPTY_PROGRESS, START_KIT } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { CampaignStore } from '../../+state/campaign.store';
import { CampaignProgressService } from '../../services/campaign-progress.service';
import { CREATURE_PAINTER } from '../../services/creature-painter';
import { Campaign } from './campaign';

describe('Campaign', () => {
  let spectator: Spectator<Campaign>;
  const progress = signal<CampaignProgress>(EMPTY_PROGRESS);

  const createComponent = createComponentFactory({
    component: Campaign,
    providers: [
      CampaignStore,
      { provide: CampaignProgressService, useValue: { progress } },
      {
        provide: CREATURE_PAINTER,
        useValue: (doc: Document) => doc.createElement('canvas'),
      },
      provideRouter([]),
      provideTranslateService({ lang: 'en' }),
    ],
  });

  beforeEach(() => {
    progress.set(EMPTY_PROGRESS);
    spectator = createComponent();
  });

  it('lists the areas, the first one open and in focus', () => {
    const areas = spectator.queryAll('[data-testid="campaign-area"]');

    expect(areas.map((a) => a.getAttribute('data-status'))).toEqual([
      'open',
      'soon',
      'soon',
    ]);
    expect(areas[0]).toHaveAttribute('aria-pressed', 'true');
    expect(spectator.queryAll('.campaign__bar')).toHaveLength(6);
  });

  it('shows the next stage to play, with its creatures and a way in', () => {
    const panel = spectator.query('[data-testid="campaign-stage"]');

    expect(panel).toHaveAttribute('data-stage', 'gramado-1');
    expect(spectator.queryAll('.campaign__foe')).toHaveLength(1);
    const play = spectator.query('[data-testid="campaign-play"]');
    expect(play?.tagName).toBe('A');
    expect(play).toHaveAttribute('href', '/play/gramado-1');
  });

  it('keeps a locked stage shut', () => {
    spectator.click(
      spectator.queryAll('[data-testid="area-map-stop"]')[2] as Element,
    );

    expect(spectator.query('[data-testid="campaign-play"]')).toBeDisabled();
    expect(spectator.query('[data-testid="campaign-play"]')).toHaveText(
      'CAMPAIGN.PLAY_LOCKED',
    );
  });

  it('shows the boss stage when its stop is picked', () => {
    const stops = spectator.queryAll('[data-testid="area-map-stop"]');
    spectator.click(stops[5] as Element);

    expect(spectator.query('[data-testid="campaign-stage"]')).toHaveAttribute(
      'data-stage',
      'gramado-5',
    );
    expect(spectator.query('.campaign__foe--boss')).toExist();
    expect(spectator.query('[data-testid="campaign-play"]')).toHaveText(
      'CAMPAIGN.PLAY_LOCKED',
    );
  });

  it('marks cleared stages on the area card', () => {
    progress.set({ cleared: ['gramado-1'] });
    spectator.detectChanges();

    expect(spectator.queryAll('.campaign__bar--done')).toHaveLength(1);
  });

  it('shows how strong the player is, from the start to the limits', () => {
    progress.set({
      cleared: ['gramado-1'],
      kit: { ...START_KIT, maxBombs: 8, speedLevel: 2 },
    });
    spectator.detectChanges();

    const panel = spectator.query('[data-testid="campaign-kit"]');
    expect(panel).toContainText('8/8');
    expect(panel).toContainText('2/8');
    expect(panel).toContainText('2/4');
  });

  it('switches to an area that is not ready yet', () => {
    spectator.click(
      spectator.queryAll('[data-testid="campaign-area"]')[1] as Element,
    );

    expect(spectator.query('[data-testid="campaign-stage-none"]')).toExist();
    expect(spectator.query('[data-testid="area-map-soon"]')).toExist();
  });
});

describe('Campaign, signed out with sign-in configured', () => {
  const signInWith = vi.fn();
  const account = signal<AuthUser | null>(null);
  const createSignedOut = createComponentFactory({
    component: Campaign,
    providers: [
      CampaignStore,
      {
        provide: CampaignProgressService,
        useValue: { progress: signal(EMPTY_PROGRESS) },
      },
      {
        provide: CREATURE_PAINTER,
        useValue: (doc: Document) => doc.createElement('canvas'),
      },
      {
        provide: AUTH,
        useValue: {
          available: true,
          user: account,
          ready: signal(true),
          initialize: () => Promise.resolve(),
          signInWith,
        },
      },
      provideRouter([]),
      provideTranslateService({ lang: 'en' }),
    ],
  });
  let page: Spectator<Campaign>;

  beforeEach(() => {
    signInWith.mockReset();
    account.set(null);
    page = createSignedOut();
  });

  it('offers the sign-in in place of the play button', () => {
    expect(page.query('[data-testid="campaign-play"]')).not.toExist();
    expect(page.query('[data-testid="campaign-signin"]')).toExist();
    expect(page.query('[data-testid="campaign-signin-email"]')).toHaveAttribute(
      'href',
      '/online',
    );
  });

  it('signs in with Google, quietly when the window is closed', async () => {
    signInWith.mockRejectedValueOnce({ code: 'cancelled' });
    page.click('[data-testid="campaign-signin-google"]');
    await page.fixture.whenStable();
    page.detectChanges();
    expect(signInWith).toHaveBeenCalledWith('google');
    expect(page.query('.campaign__signin-error')).not.toExist();

    signInWith.mockRejectedValueOnce({ code: 'network' });
    await page.component.signInWithGoogle();
    page.detectChanges();
    expect(page.query('.campaign__signin-error')).toExist();

    signInWith.mockResolvedValueOnce(undefined);
    await page.component.signInWithGoogle();
    page.detectChanges();
    expect(page.query('.campaign__signin-error')).not.toExist();
  });

  it('asks to confirm the address first', () => {
    account.set({
      id: 'u',
      email: 'a@b.c',
      displayName: 'A',
      emailVerified: false,
    });
    page.detectChanges();
    expect(page.query('[data-testid="campaign-signin"]')).toContainText(
      'CAMPAIGN.SIGNIN.VERIFY',
    );
  });

  it('shows the play button once signed in', () => {
    account.set({
      id: 'u',
      email: 'a@b.c',
      displayName: 'A',
      emailVerified: true,
    });
    page.detectChanges();
    expect(page.query('[data-testid="campaign-play"]')).toExist();
  });
});
