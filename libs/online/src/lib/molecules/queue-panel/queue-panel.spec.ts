import { Seat } from '@libs/game-protocol';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { QueuePanelComponent } from './queue-panel';

const seat = (id: string): Seat => ({
  id,
  name: id.toUpperCase(),
  characterId: 'lia',
});

describe('QueuePanelComponent', () => {
  let spectator: Spectator<QueuePanelComponent>;
  const createComponent = createComponentFactory({
    component: QueuePanelComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(() => (spectator = createComponent()));

  /** `output()` is an emitter, not a spy: subscribe a spy to it. */
  const watch = (name: string) => {
    const spy = vi.fn();
    (
      spectator.component[
        name as keyof typeof spectator.component
      ] as unknown as { subscribe(fn: (v: unknown) => void): void }
    ).subscribe(spy);
    return spy;
  };

  it('lets a player of the round leave once it ends, and change their mind', () => {
    const leaveAfter = watch('leaveAfterRound');
    spectator.setInput({
      phase: 'playing',
      players: [seat('me'), seat('b')],
      myId: 'me',
    });
    expect(spectator.query('[data-testid="queue-join"]')).not.toExist();

    spectator.click('[data-testid="queue-leave-after"]');
    expect(leaveAfter).toHaveBeenLastCalledWith(true);

    spectator.setInput('leavingAfter', true);
    expect(spectator.query('[data-testid="queue-leaving-after"]')).toExist();
    spectator.click('[data-testid="queue-stay"]');
    expect(leaveAfter).toHaveBeenLastCalledWith(false);

    // Still offered while the result is on screen.
    spectator.setInput({ phase: 'results', leavingAfter: false });
    expect(spectator.query('[data-testid="queue-leave-after"]')).toExist();
  });

  it('offers the queue, and says why when it cannot', () => {
    const join = watch('join');
    expect(spectator.query('[data-testid="queue-empty"]')).toExist();

    spectator.click('[data-testid="queue-join"]');
    expect(join).toHaveBeenCalled();

    spectator.setInput('blocked', 'verify');
    expect(
      spectator.query<HTMLButtonElement>('[data-testid="queue-join"]')
        ?.disabled,
    ).toBe(true);
    expect(spectator.query('[data-testid="queue-blocked"]')).toHaveText(
      'ONLINE.QUEUE.BLOCKED.verify',
    );
  });

  it('shows your place and lets you leave', () => {
    const leave = watch('leave');
    spectator.setInput('queue', [seat('a'), seat('b'), seat('me')]);
    spectator.setInput('myId', 'me');

    expect(spectator.component.position()).toBe(3);
    expect(spectator.component.nextUp()).toBe(true);
    expect(spectator.query('[data-testid="queue-position"]')).toHaveText(
      'ONLINE.QUEUE.NEXT_UP',
    );
    spectator.click('[data-testid="queue-leave"]');
    expect(leave).toHaveBeenCalled();

    spectator.setInput('maxPlayers', 2);
    expect(spectator.query('[data-testid="queue-position"]')).toHaveText(
      'ONLINE.QUEUE.POSITION',
    );
  });

  it('shows who is playing, and tells you when you are in the round', () => {
    spectator.setInput('phase', 'playing');
    spectator.setInput('players', [seat('a'), seat('me')]);

    expect(spectator.query('[data-testid="queue-live"]')).toHaveText('A');
    expect(spectator.component.inRound()).toBe(false);

    spectator.setInput('myId', 'me');
    expect(spectator.query('[data-testid="queue-in-round"]')).toExist();
  });

  it('names the character of each seat', () => {
    expect(spectator.component.characterKey(seat('a'))).toBe(
      'CHARACTERS.LIA.NAME',
    );
  });
});

describe('QueuePanelComponent outsiders', () => {
  let spectator: Spectator<QueuePanelComponent>;
  const createComponent = createComponentFactory({
    component: QueuePanelComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(() => {
    spectator = createComponent();
    spectator.setInput('queue', [seat('a'), seat('b'), seat('me')]);
    spectator.setInput('myId', 'me');
    spectator.setInput('outsiders', 2);
  });

  it('tags the first in line as outside while a round is played', () => {
    spectator.setInput('phase', 'playing');
    expect(
      spectator.queryAll('[data-testid="queue-outside-tag"]'),
    ).toHaveLength(2);
    expect(spectator.query('[data-testid="queue-outside"]')).not.toExist();

    spectator.setInput('outsiders', 3);
    expect(spectator.query('[data-testid="queue-outside"]')).toHaveText(
      'ONLINE.QUEUE.OUTSIDE',
    );
    expect(spectator.query('[data-testid="queue-position"]')).toExist();
  });

  it('tags nobody between rounds, or when the room has no outsiders', () => {
    spectator.setInput('phase', 'countdown');
    expect(
      spectator.queryAll('[data-testid="queue-outside-tag"]'),
    ).toHaveLength(0);

    spectator.setInput('phase', 'playing');
    spectator.setInput('outsiders', 0);
    expect(
      spectator.queryAll('[data-testid="queue-outside-tag"]'),
    ).toHaveLength(0);
  });

  it('crowns the winner who keeps a seat, in line and on the court', () => {
    spectator.setInput('queue', [seat('champ'), seat('b')]);
    expect(spectator.query('[data-testid="queue-crown"]')).not.toExist();

    spectator.setInput('champion', { id: 'champ', streak: 3 });
    const crowns = spectator.queryAll('[data-testid="queue-crown"]');
    expect(crowns).toHaveLength(1);
    expect(crowns[0]).toHaveText('👑 3');

    spectator.setInput('phase', 'playing');
    spectator.setInput('queue', [seat('b')]);
    spectator.setInput('players', [seat('champ'), seat('c')]);
    expect(spectator.queryAll('[data-testid="queue-live-crown"]')).toHaveLength(
      1,
    );
  });
});
