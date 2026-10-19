import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { RankingListComponent } from './ranking-list';

describe('RankingListComponent', () => {
  let spectator: Spectator<RankingListComponent>;
  const createComponent = createComponentFactory({
    component: RankingListComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(() => (spectator = createComponent()));

  it('says when nobody has won yet', () => {
    expect(spectator.query('[data-testid="ranking-empty"]')).toExist();
  });

  it('lists the top players and highlights you', () => {
    spectator.setInput('entries', [
      { id: 'a', name: 'Ana', wins: 3, matches: 4 },
      { id: 'b', name: 'Bia', wins: 1, matches: 1 },
    ]);
    spectator.setInput('myId', 'b');

    const items = spectator.queryAll('[data-testid="ranking-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveText('Ana');
    expect(items[1]).toHaveClass('ranking__item--me');
    expect(items[0]).toHaveText('1');
    expect(spectator.query('.ranking__title')).toExist();
  });

  it('carries on from a later place, without a title, under a podium', () => {
    spectator.setInput('entries', [
      { id: 'd', name: 'Dan', wins: 1, matches: 3 },
    ]);
    spectator.setInput('start', 4);
    spectator.setInput('titled', false);

    expect(
      spectator.query('[data-testid="ranking-item"] .ranking__place'),
    ).toHaveText('4');
    expect(spectator.query('.ranking__title')).not.toExist();
  });
});
