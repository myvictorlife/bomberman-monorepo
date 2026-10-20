import { provideRouter } from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { ItemsStore } from '../../+state/items.store';
import { ITEM_AUDIO, ItemAudio } from '../../services/item-audio';
import { ITEM_PAINTER } from '../../services/item-painter';
import { Items } from './items';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      ITEMS: { TITLE: 'Items', EGG: { NAME: 'Egg' }, FIRE: { NAME: 'Fire' } },
    });
  }
}

describe('Items', () => {
  let spectator: Spectator<Items>;
  const paint = vi.fn();
  const audio = {
    sfx: { play: vi.fn(), close: vi.fn() },
    voice: { speak: vi.fn(), close: vi.fn() },
  } as unknown as ItemAudio;

  const createComponent = createComponentFactory({
    component: Items,
    providers: [
      ItemsStore,
      // The card is a link: give the test router somewhere to go.
      provideRouter([{ path: '**', children: [] }]),
      { provide: ITEM_PAINTER, useValue: paint },
      { provide: ITEM_AUDIO, useValue: audio },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    paint.mockClear();
    spectator = createComponent();
  });

  it('shows one card per item, each linking to its page', () => {
    const cards = spectator.queryAll('[data-testid="item-card"]');

    expect(spectator.query('[data-testid="items-title"]')).toHaveText('Items');
    expect(cards.map((c) => c.getAttribute('data-item'))).toEqual([
      'egg',
      'bomb',
      'fire',
      'speed',
      'pierce',
      'remote',
      'vest',
      'glove',
      'kick',
      'wallpass',
      'fullfire',
      'powerbomb',
      'skull',
      'clock',
      'oneup',
    ]);
    expect(cards[0]).toHaveText('Egg');
    expect(
      spectator
        .queryAll('[data-testid="item-detail-link"]')[2]
        ?.getAttribute('href'),
    ).toBe('/items/fire');
  });

  it('paints each card with the item painter and tracks the one clicked', () => {
    const ctx = {} as CanvasRenderingContext2D;
    spectator.component.sprite('fire')(ctx);
    expect(paint).toHaveBeenCalledWith(ctx, 'fire');

    spectator.click('[data-item="speed"] .item__stage');
    expect(spectator.inject(ItemsStore).selected()).toBe('speed');
  });

  it('plays an item’s pick-up from its card', () => {
    spectator.click('[data-item="egg"] [data-testid="item-hear"]');
    expect(audio.sfx.play).toHaveBeenCalledWith('hatch');

    spectator.click('[data-item="fire"] [data-testid="item-hear"]');
    expect(audio.sfx.play).toHaveBeenCalledWith('power-up');
  });
});
