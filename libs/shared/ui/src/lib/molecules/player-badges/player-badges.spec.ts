import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { PlayerBadgesComponent, PlayerBadgeStats } from './player-badges';

const stats = (over: Partial<PlayerBadgeStats> = {}): PlayerBadgeStats => ({
  bombs: 1,
  fire: 2,
  speed: 0,
  pierce: false,
  remote: false,
  glove: false,
  kick: false,
  vestSeconds: 0,
  mount: null,
  abilityReadyIn: 0,
  abilityActive: false,
  ...over,
});

describe('PlayerBadgesComponent', () => {
  let spectator: Spectator<PlayerBadgesComponent>;
  const createComponent = createComponentFactory({
    component: PlayerBadgesComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(
    () =>
      (spectator = createComponent({
        props: { stats: stats(), testId: 'hud' },
      })),
  );

  it('always shows the three counts, with the name on hover and for the screen reader', () => {
    const badges = spectator.queryAll('.badge');
    expect(badges).toHaveLength(3);
    expect(spectator.query('[data-testid="hud-bombs"]')).toHaveText('1');
    expect(spectator.query('[data-testid="hud-bombs"]')).toHaveAttribute(
      'data-tip',
      'PLAY.BOMBS',
    );
    expect(spectator.query('[data-testid="hud-bombs"]')).toHaveAttribute(
      'aria-label',
      'PLAY.BOMBS: 1',
    );
    expect(spectator.query('[data-testid="hud-fire"]')).toHaveText('2');
    expect(spectator.query('[data-testid="hud-pierce"]')).not.toExist();
  });

  it('adds an icon-only badge per item picked up, and the vest with its seconds', () => {
    spectator.setInput(
      'stats',
      stats({
        pierce: true,
        remote: true,
        glove: true,
        kick: true,
        vestSeconds: 3,
      }),
    );

    for (const key of ['pierce', 'remote', 'glove', 'kick']) {
      const badge = spectator.query(`[data-testid="hud-${key}"]`);
      expect(badge).toExist();
      expect(badge?.querySelector('.badge__value')).toBeNull();
    }
    expect(spectator.query('[data-testid="hud-vest"]')).toHaveText(
      'PLAY.ABILITY_IN',
    );
    expect(spectator.query('[data-testid="hud-vest"]')).toHaveAttribute(
      'data-tip',
      'PLAY.VEST',
    );
  });

  it('names the mount in the tip and shows the ability as ready, counting down, or active', () => {
    spectator.setInput('stats', stats({ mount: 'pato' }));
    expect(spectator.query('[data-testid="hud-mount"]')).toHaveAttribute(
      'data-tip',
      'PLAY.MOUNT: MOUNTS.PATO.NAME',
    );
    expect(spectator.query('[data-testid="hud-ability"]')).toHaveClass(
      'badge--ready',
    );
    expect(spectator.query('[data-testid="hud-ability"]')).toHaveAttribute(
      'data-tip',
      'PLAY.ABILITY: PLAY.ABILITY_READY',
    );

    spectator.setInput('stats', stats({ mount: 'pato', abilityReadyIn: 4 }));
    expect(spectator.query('[data-testid="hud-ability"]')).toHaveText(
      'PLAY.ABILITY_IN',
    );
    expect(spectator.query('[data-testid="hud-ability"]')).not.toHaveClass(
      'badge--ready',
    );

    spectator.setInput('stats', stats({ mount: 'pato', abilityActive: true }));
    expect(spectator.query('[data-testid="hud-ability"]')).toHaveClass(
      'badge--active',
    );
    expect(spectator.query('[data-testid="hud-ability"]')).toHaveAttribute(
      'data-tip',
      'PLAY.ABILITY: PLAY.ABILITY_ACTIVE',
    );
  });
});
