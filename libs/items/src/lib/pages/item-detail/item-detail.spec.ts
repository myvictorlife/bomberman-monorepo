import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { EGG_STAGES } from '@libs/game-client';
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
import { ItemDetail, itemKeys, keyCap } from './item-detail';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      ITEMS: {
        EGG: { NAME: 'Egg', EFFECT: 'Hatches a mount' },
        BOMB: { NAME: 'Bomb' },
        FIRE: { NAME: 'Fire' },
        SPEED: { NAME: 'Skates' },
      },
      MOUNTS: { TATU: { NAME: 'Armadillo' } },
    });
  }
}

const fakeAudio = (): ItemAudio =>
  ({
    sfx: { play: vi.fn(), close: vi.fn() },
    voice: { speak: vi.fn(), close: vi.fn() },
  }) as unknown as ItemAudio;
const audio = fakeAudio();

const factoryFor = (id: string, paint: ReturnType<typeof vi.fn>) =>
  createComponentFactory({
    component: ItemDetail,
    providers: [
      ItemsStore,
      { provide: ITEM_AUDIO, useValue: audio },
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
      },
      { provide: ITEM_PAINTER, useValue: paint },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

describe('ItemDetail', () => {
  const paint = vi.fn();
  let raf: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    paint.mockClear();
    // No real frames in tests: the clock is driven by hand below.
    raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  });

  afterEach(() => raf.mockRestore());

  describe('the egg', () => {
    let spectator: Spectator<ItemDetail>;
    const createComponent = factoryFor('egg', paint);

    beforeEach(() => {
      spectator = createComponent();
    });

    it('shows the egg, its mounts, the crack stages and three sizes', () => {
      expect(spectator.query('h1')).toHaveText('Egg');
      expect(spectator.inject(ItemsStore).selected()).toBe('egg');
      expect(spectator.query('.detail__mounts')).toHaveText('Armadillo');
      expect(
        spectator
          .queryAll('[data-testid="item-other"]')
          .map((a) => a.getAttribute('href')),
      ).toEqual([
        '/items/bomb',
        '/items/fire',
        '/items/speed',
        '/items/pierce',
        '/items/remote',
        '/items/vest',
        '/items/glove',
        '/items/kick',
        '/items/wallpass',
        '/items/fullfire',
        '/items/powerbomb',
        '/items/skull',
        '/items/clock',
        '/items/oneup',
      ]);
      // 1 stage + 3 sizes + EGG_STAGES crack stages.
      expect(spectator.queryAll('lib-sprite-tile')).toHaveLength(
        1 + 3 + EGG_STAGES,
      );
    });

    it('hatches on request: the crack grows with the clock, then rests', () => {
      const ctx = {} as CanvasRenderingContext2D;
      expect(spectator.component.stage()).toBe(0);

      spectator.click('[data-testid="item-hatch"]');
      spectator.component.tick(1100);
      expect(spectator.component.stage()).toBe(2);
      spectator.component.stagePainter()(ctx);
      expect(paint).toHaveBeenLastCalledWith(
        ctx,
        'egg',
        expect.objectContaining({ stage: 2 }),
      );

      spectator.component.tick(5000);
      expect(spectator.component.stage()).toBe(0);
      spectator.component.still(3)(ctx);
      expect(paint).toHaveBeenLastCalledWith(ctx, 'egg', { stage: 3 });
    });

    it('plays the egg’s sounds and says the announcer’s lines for it', () => {
      expect(
        spectator.queryAll('[data-testid="item-effect"]').length,
      ).toBeGreaterThan(5);
      spectator.click('[data-effect="mount-pato"]');
      expect(audio.sfx.play).toHaveBeenCalledWith('mount-pato');

      spectator.click('[data-testid="item-line"]');
      expect(audio.voice.speak).toHaveBeenCalledWith(expect.any(String));
      expect(spectator.component.effectKey('mount-lost')).toBe(
        'ITEMS.EFFECT_MOUNT_LOST',
      );
      expect(spectator.component.momentKey('mount-pato')).toBe(
        'SOUNDS.MOMENT_MOUNT_PATO',
      );

      spectator.fixture.destroy();
      expect(audio.voice.close).toHaveBeenCalled();
      expect(audio.sfx.close).toHaveBeenCalled();
    });

    it('also hatches from the stage itself', () => {
      spectator.click('[data-testid="item-stage"]');
      spectator.component.tick(700);

      expect(spectator.component.stage()).toBe(1);
    });
  });

  describe('the remote', () => {
    const createRemote = factoryFor('remote', paint);

    it('shows the detonate key of each player as keycaps', () => {
      const spectator = createRemote();

      const caps = spectator
        .queryAll('[data-testid="item-keys"] kbd')
        .map((k) => k.textContent?.trim());
      expect(caps).toEqual(['E', '/']);
      expect(itemKeys('egg')[0]?.caps).toEqual(['Shift', 'Ctrl']);
      expect(itemKeys('fire')).toEqual([]);
      expect(keyCap('SPACE')).toBe('Space');
      expect(keyCap('Q')).toBe('Q');
    });
  });

  describe('the glove', () => {
    it('shows the bomb key, with a hint of its own', () => {
      expect(itemKeys('glove')).toEqual([
        {
          labelKey: 'ITEMS.KEY_GLOVE',
          caps: ['Space', 'Enter'],
          hintKey: 'ITEMS.KEY_GLOVE_HINT',
        },
      ]);
      expect(itemKeys('kick')).toEqual([]);
      // The detonate hint belongs to the remote alone.
      expect(itemKeys('egg')[0]?.hintKey).toBeUndefined();
    });
  });

  describe('a power-up', () => {
    const createFire = factoryFor('fire', paint);

    it('holds still, with no hatch controls or stages', () => {
      const spectator = createFire();
      const ctx = {} as CanvasRenderingContext2D;

      expect(spectator.query('h1')).toHaveText('Fire');
      expect(spectator.query('[data-testid="item-hatch"]')).not.toExist();
      expect(spectator.query('[data-testid="item-keys"]')).not.toExist();
      expect(spectator.queryAll('lib-sprite-tile')).toHaveLength(1 + 3);
      expect(
        spectator
          .queryAll('[data-testid="item-effect"]')
          .map((b) => b.getAttribute('data-effect')),
      ).toEqual(['power-up']);
      expect(spectator.queryAll('[data-testid="item-line"]')).toHaveLength(3);

      spectator.click('[data-testid="item-stage"]');
      spectator.component.stagePainter()(ctx);
      expect(paint).toHaveBeenLastCalledWith(ctx, 'fire', {
        stage: 0,
        tilt: 0,
      });
    });
  });
});
