import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { ArenasStore } from '../../+state/arenas.store';
import {
  ARENA_DEMO_VIDEOS,
  ARENA_TILE_PAINTER,
} from '../../services/arena-preview-painter';
import { ArenaDetail } from './arena-detail';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      ARENAS: {
        PIECES: 'Pieces',
        NOTES: 'Decisions',
        PLAY_HERE: 'Play here',
        PIECE_WALL: 'Pillar',
        SIZE_REAL: 'real',
      },
      MAPS: {
        AUTODROMO: {
          NAME: 'Race track',
          OWNER: 'Racing',
          DESC: 'Asphalt.',
          MOMENT: 'Rain',
        },
        SUBESTACAO: { NAME: 'Substation' },
      },
    });
  }
}

describe('ArenaDetail', () => {
  let spectator: Spectator<ArenaDetail>;
  const stop = vi.fn();
  const play = vi.fn<(canvases: HTMLCanvasElement[]) => { stop: () => void }>(
    () => ({ stop }),
  );
  const paintTile = vi.fn();

  const createComponent = createComponentFactory({
    component: ArenaDetail,
    providers: [
      ArenasStore,
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ id: 'autodromo' }) },
        },
      },
      { provide: ARENA_DEMO_VIDEOS, useValue: play },
      { provide: ARENA_TILE_PAINTER, useValue: paintTile },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    spectator = createComponent();
  });

  it('shows the arena from the URL, puts it in focus and plays its video', async () => {
    await spectator.fixture.whenStable();

    expect(spectator.query('h1')).toHaveText('Race track');
    expect(spectator.query('.showcase__eyebrow')).toHaveText('Racing');
    expect(spectator.inject(ArenasStore).selected()).toBe('autodromo');
    const canvases = play.mock.calls[0]?.[0] ?? [];
    expect(canvases.map((c) => c.dataset['video'])).toEqual([
      'arena:autodromo',
    ]);
    spectator.fixture.destroy();
    expect(stop).toHaveBeenCalled();
    expect(
      spectator
        .query('[data-testid="arena-detail-play"]')
        ?.getAttribute('href'),
    ).toBe('/play?map=autodromo');
  });

  it('links to the other arenas', () => {
    const others = spectator.queryAll('[data-testid="arena-detail-other"]');

    expect(others).toHaveLength(2);
    expect(others[0]?.getAttribute('href')).toBe('/arenas/subestacao');
    expect(others[0]).toHaveText('Substation');
    expect(others[1]?.getAttribute('href')).toBe('/arenas/gramado');
  });

  it('lays out every piece at two sizes and the notes', () => {
    expect(spectator.queryAll('lib-sprite-tile')).toHaveLength(
      spectator.component.pieces.length * 2,
    );
    expect(spectator.component.pieces.length).toBeGreaterThanOrEqual(5);
    expect(spectator.queryAll('lib-showcase-note')).toHaveLength(4);

    const ctx = {} as CanvasRenderingContext2D;
    spectator.component.tileOf('wall')(ctx);
    expect(paintTile).toHaveBeenCalledWith(ctx, 'autodromo', 'wall');
  });
});
