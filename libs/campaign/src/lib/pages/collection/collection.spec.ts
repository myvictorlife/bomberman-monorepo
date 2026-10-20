import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EMPTY_PROGRESS } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { CampaignStore } from '../../+state/campaign.store';
import { CampaignProgressService } from '../../services/campaign-progress.service';
import { CREATURE_PAINTER } from '../../services/creature-painter';
import { Collection } from './collection';

describe('Collection', () => {
  let spectator: Spectator<Collection>;

  const createComponent = createComponentFactory({
    component: Collection,
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
      provideRouter([]),
      provideTranslateService({ lang: 'en' }),
    ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('shows one boss card per area: the known one painted, the rest hidden', () => {
    const cards = spectator.queryAll('[data-testid="collection-boss"]');

    expect(cards.map((c) => c.getAttribute('data-status'))).toEqual([
      'known',
      'soon',
      'soon',
    ]);
    expect(cards[0]?.querySelector('lib-creature-sprite')).toExist();
    expect(cards[1]?.querySelector('.collection__mystery')).toExist();
  });

  it('switches to the creatures', () => {
    spectator.inject(CampaignStore).setTab('creatures');
    spectator.detectChanges();

    const cards = spectator.queryAll('[data-testid="collection-creature"]');
    expect(cards).toHaveLength(6);
    expect(
      cards.filter((c) =>
        c.classList.contains('collection__creature--unknown'),
      ),
    ).toHaveLength(2);
    expect(spectator.query('[data-testid="collection-boss"]')).not.toExist();
  });
});
