import { MapVote, Seat } from '@libs/game-protocol';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { MAP_THUMB_PAINTER } from '../../services/online.tokens';
import { mapNameKey, MapVoteComponent } from './map-vote';

const seat = (id: string): Seat => ({
  id,
  name: id.toUpperCase(),
  characterId: 'lia',
});

describe('MapVoteComponent', () => {
  let spectator: Spectator<MapVoteComponent>;
  const paint = vi.fn();
  const createComponent = createComponentFactory({
    component: MapVoteComponent,
    providers: [
      provideTranslateService(),
      { provide: MAP_THUMB_PAINTER, useValue: paint },
    ],
  });

  const vote = (picks: MapVote['picks']): MapVote => ({
    voters: ['me', 'b'],
    picks,
  });

  beforeEach(() => {
    paint.mockClear();
    spectator = createComponent({
      props: { queue: [seat('me'), seat('b'), seat('c')], myId: 'me' },
    });
  });

  const watchPick = () => {
    const spy = vi.fn();
    spectator.output('pick').subscribe(spy);
    return spy;
  };

  it('offers every arena and "any", painting each arena once', () => {
    spectator.setInput('vote', vote({}));

    expect(spectator.queryAll('.map-vote__card')).toHaveLength(6);
    expect(paint).toHaveBeenCalledTimes(5);
    expect(paint).toHaveBeenCalledWith(expect.anything(), 7, 'nucleo');

    spectator.setInput('vote', vote({ b: 'gramado' }));
    expect(paint).toHaveBeenCalledTimes(5);
  });

  it('votes for an arena, or for any', () => {
    const pick = watchPick();
    spectator.setInput('vote', vote({}));

    spectator.click('[data-testid="map-vote-nucleo"]');
    expect(pick).toHaveBeenLastCalledWith('nucleo');
    spectator.click('[data-testid="map-vote-any"]');
    expect(pick).toHaveBeenLastCalledWith(null);
  });

  it('marks my vote and the leader, and does not send my vote again', () => {
    const pick = watchPick();
    spectator.setInput('vote', vote({ me: 'nucleo', b: 'gramado' }));

    const cards = spectator.component.cards();
    expect(cards.find((c) => c.id === 'nucleo')).toMatchObject({
      votes: 1,
      mine: true,
      leading: true,
    });
    expect(cards.find((c) => c.id === 'autodromo')?.leading).toBe(false);
    expect(spectator.query('[data-testid="map-vote-nucleo"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    spectator.click('[data-testid="map-vote-nucleo"]');
    expect(pick).not.toHaveBeenCalled();
  });

  it('counts "any" apart and lists who is ready', () => {
    spectator.setInput('vote', vote({ b: null }));

    expect(spectator.component.cards().at(-1)).toMatchObject({
      id: null,
      votes: 1,
    });
    expect(spectator.component.voters()).toEqual([
      { id: 'me', name: 'ME', ready: false, pick: null },
      { id: 'b', name: 'B', ready: true, pick: null },
    ]);
    expect(spectator.component.readyCount()).toBe(1);
    expect(spectator.queryAll('.map-vote__chip--ready')).toHaveLength(1);
  });

  it('only shows the count to someone who does not play the next round', () => {
    const pick = watchPick();
    spectator.setInput({ myId: 'c', vote: vote({ b: 'gramado' }) });

    expect(spectator.component.canVote()).toBe(false);
    expect(spectator.query('[data-testid="map-vote-gramado"]')).toBeDisabled();
    spectator.component.choose(spectator.component.cards()[0]);
    expect(pick).not.toHaveBeenCalled();
  });

  it('names an arena by its i18n key', () => {
    expect(mapNameKey('subestacao')).toBe('MAPS.SUBESTACAO.NAME');
    expect(spectator.component.votesKey(0)).toBe('ONLINE.VOTE.NO_VOTES');
    expect(spectator.component.votesKey(1)).toBe('ONLINE.VOTE.ONE_VOTE');
    expect(spectator.component.votesKey(3)).toBe('ONLINE.VOTE.VOTES');
  });
});
