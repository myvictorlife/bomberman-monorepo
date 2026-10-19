import { provideRouter } from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { ArenasStore } from '../../+state/arenas.store';
import { ARENA_DEMO_VIDEOS } from '../../services/arena-preview-painter';
import { Arenas } from './arenas';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      ARENAS: {
        TITLE: 'Arenas',
        PLAY_HERE: 'Play here',
        PLAY_SELECTED: 'Play',
      },
      MAPS: {
        SUBESTACAO: { NAME: 'Substation' },
        AUTODROMO: { NAME: 'Race track' },
      },
    });
  }
}

describe('Arenas', () => {
  let spectator: Spectator<Arenas>;
  const stop = vi.fn();
  const play = vi.fn<(canvases: HTMLCanvasElement[]) => { stop: () => void }>(
    () => ({ stop }),
  );

  const createComponent = createComponentFactory({
    component: Arenas,
    providers: [
      ArenasStore,
      provideRouter([]),
      { provide: ARENA_DEMO_VIDEOS, useValue: play },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    play.mockClear();
    stop.mockClear();
    spectator = createComponent();
  });

  it('shows one card per arena, each playing its own video, stopped when the page is left', async () => {
    await spectator.fixture.whenStable();

    const cards = spectator.queryAll('[data-testid="arena-card"]');
    expect(cards.map((c) => c.getAttribute('data-map'))).toEqual([
      'subestacao',
      'autodromo',
      'gramado',
    ]);
    expect(cards[0]).toHaveText('Substation');
    expect(play).toHaveBeenCalledTimes(1);
    const canvases = play.mock.calls[0]?.[0] ?? [];
    expect(canvases.map((c) => c.dataset['video'])).toEqual([
      'arena:subestacao',
      'arena:autodromo',
      'arena:gramado',
    ]);

    spectator.detectChanges();
    await spectator.fixture.whenStable();
    expect(play).toHaveBeenCalledTimes(1);
    spectator.fixture.destroy();
    expect(stop).toHaveBeenCalled();
  });

  it('links each arena to a match on it', () => {
    const links = spectator.queryAll('[data-testid="arena-play"]');

    expect(links[1]?.getAttribute('href')).toBe('/play?map=autodromo');
  });

  it('puts the clicked arena in focus and the header link follows it', () => {
    expect(
      spectator.query('[data-testid="arenas-play"]')?.getAttribute('href'),
    ).toBe('/play?map=subestacao');

    spectator.click('[data-map="autodromo"] .arena__stage');

    expect(spectator.query('[data-map="autodromo"]')).toHaveClass(
      'arena--selected',
    );
    expect(spectator.query('[data-map="subestacao"]')).not.toHaveClass(
      'arena--selected',
    );
    expect(
      spectator.query('[data-testid="arenas-play"]')?.getAttribute('href'),
    ).toBe('/play?map=autodromo');
  });

  it('colours each card with its theme accent', () => {
    expect(spectator.component.accent('autodromo')).toMatch(/^#/);
    expect(spectator.component.mapKey('autodromo', 'MOMENT')).toBe(
      'MAPS.AUTODROMO.MOMENT',
    );
  });
});
