import { HudPlayer } from '@libs/game-client';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { PlayersPanelComponent } from './players-panel';

const player = (over: Partial<HudPlayer> = {}): HudPlayer => ({
  id: 'a',
  slot: 0,
  name: 'Ana',
  alive: true,
  bombs: 1,
  fire: 2,
  speed: 0,
  mount: null,
  abilityReadyIn: 0,
  abilityActive: false,
  pierce: false,
  remote: false,
  glove: false,
  kick: false,
  vestSeconds: 0,
  ...over,
});

describe('PlayersPanelComponent', () => {
  let spectator: Spectator<PlayersPanelComponent>;
  const createComponent = createComponentFactory({
    component: PlayersPanelComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(() => (spectator = createComponent()));

  it('shows the counted stats of every player', () => {
    spectator.setInput('players', [
      player({ bombs: 3, fire: 5, speed: 2 }),
      player({ id: 'b', slot: 1, name: 'Bia' }),
    ]);

    const items = spectator.queryAll('[data-testid="players-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveText('3');
    expect(items[0]).toHaveText('5');
    expect(spectator.query('[data-testid="players-remote"]')).not.toExist();
  });

  it('shows the items picked up, the mount, and who is out', () => {
    spectator.setInput('players', [
      player({
        pierce: true,
        remote: true,
        glove: true,
        kick: true,
        vestSeconds: 4,
        mount: 'pato',
        alive: false,
      }),
    ]);
    spectator.setInput('myId', 'a');
    spectator.setInput('colors', ['#fff']);

    expect(spectator.query('[data-testid="players-pierce"]')).toExist();
    expect(spectator.query('[data-testid="players-remote"]')).toExist();
    expect(spectator.query('[data-testid="players-glove"]')).toExist();
    expect(spectator.query('[data-testid="players-kick"]')).toExist();
    expect(spectator.query('[data-testid="players-vest"]')).toHaveText(
      'PLAY.ABILITY_IN',
    );
    expect(spectator.query('[data-testid="players-mount"]')).toHaveAttribute(
      'data-tip',
      'PLAY.MOUNT: MOUNTS.PATO.NAME',
    );
    expect(spectator.query('[data-testid="players-out"]')).toExist();
    expect(spectator.query('[data-testid="players-item"]')).toHaveClass(
      'players__item--me',
    );
  });
});
