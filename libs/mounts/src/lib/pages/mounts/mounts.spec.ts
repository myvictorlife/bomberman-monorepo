import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CharacterSelectionService } from '@libs/character-select';
import { CharacterFrame } from '@libs/game-client';
import { CharacterId, MountId } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { MountsStore } from '../../+state/mounts.store';
import {
  MOUNT_PORTRAIT_PAINTER,
  MOUNT_SPRITE_PAINTER,
} from '../../services/mount-painter';
import { MOUNT_VIDEOS } from '../../services/mount-videos';
import { Mounts, WALK_STEP_MS } from './mounts';

describe('Mounts', () => {
  let spectator: Spectator<Mounts>;
  let played: HTMLCanvasElement[] = [];
  const stop = vi.fn();
  const riderId = signal<CharacterId>('lia');

  const createComponent = createComponentFactory({
    component: Mounts,
    providers: [
      MountsStore,
      provideRouter([]),
      provideTranslateService(),
      { provide: CharacterSelectionService, useValue: { selectedId: riderId } },
      {
        provide: MOUNT_PORTRAIT_PAINTER,
        useValue: (doc: Document, mountId: MountId) => {
          const canvas = doc.createElement('canvas');
          canvas.dataset['mount'] = mountId;
          return canvas;
        },
      },
      {
        provide: MOUNT_SPRITE_PAINTER,
        useValue: (doc: Document, frame: CharacterFrame) => {
          const canvas = doc.createElement('canvas');
          canvas.dataset['pose'] =
            `${frame.characterId}/${frame.mountId}/${frame.facing}/${frame.frame}`;
          return canvas;
        },
      },
      {
        provide: MOUNT_VIDEOS,
        useValue: (canvases: readonly HTMLCanvasElement[]) => {
          played = [...canvases];
          return { stop };
        },
      },
    ],
  });

  const stage = () =>
    spectator.query('[data-testid="mounts-stage"] canvas') as HTMLCanvasElement;

  beforeEach(() => {
    played = [];
    stop.mockClear();
    riderId.set('lia');
    spectator = createComponent();
  });

  it('lists every mount, with the first on the stage ridden by your character, and every ability video ready', () => {
    expect(spectator.query('[data-testid="mounts-title"]')).toHaveText(
      'MOUNTS.TITLE',
    );
    const cards = spectator.queryAll('[data-testid="mounts-card"]');
    expect(cards.map((c) => c.getAttribute('data-mount'))).toEqual([
      'tatu',
      'pato',
      'bernardo',
      'capivara',
      'galinha',
    ]);
    expect(cards[0]).toHaveClass('mounts__card--selected');
    expect(cards[0]).toHaveText('MOUNTS.ON_STAGE');
    expect(
      spectator.query(
        '[data-testid="mounts-list"] canvas[data-mount="bernardo"]',
      ),
    ).toExist();

    expect(spectator.query('[data-testid="mounts-selected-name"]')).toHaveText(
      'MOUNTS.TATU.NAME',
    );
    // The rider line is the key with your character's name folded in; the stub translator shows the key.
    expect(spectator.query('[data-testid="mounts-rider"]')).toHaveText(
      'MOUNTS.RIDER',
    );
    expect(stage().dataset['pose']).toBe('lia/tatu/down/0');
    expect(spectator.queryAll('[data-testid="mounts-pose"]')).toHaveLength(8);

    const videos = spectator.queryAll<HTMLCanvasElement>(
      '[data-testid="mounts-video"]',
    );
    expect(videos.map((v) => v.dataset['video'])).toEqual([
      'mount:tatu',
      'mount:pato',
      'mount:bernardo',
      'mount:capivara',
      'mount:galinha',
    ]);
    expect(videos.map((v) => v.hidden)).toEqual([
      false,
      true,
      true,
      true,
      true,
    ]);
    expect(played).toEqual(videos);
    expect(spectator.query('[data-testid="mounts-facts"]')).toHaveText(
      'MOUNTS.FACT.duration',
    );
    expect(spectator.query('[data-testid="mounts-story"]')).toHaveText(
      'MOUNTS.TATU.STORY',
    );
    expect(
      spectator.query('[data-testid="mounts-characters"]'),
    ).toHaveAttribute('href', '/characters');
  });

  it('puts the chosen mount on the stage with its own video, ability and story', () => {
    spectator.click('[data-testid="mounts-card"][data-mount="capivara"]');

    expect(spectator.query('[data-testid="mounts-selected-name"]')).toHaveText(
      'MOUNTS.CAPIVARA.NAME',
    );
    expect(stage().dataset['pose']).toBe('lia/capivara/down/0');
    const videos = spectator.queryAll<HTMLCanvasElement>(
      '[data-testid="mounts-video"]',
    );
    expect(videos.map((v) => v.hidden)).toEqual([
      true,
      true,
      true,
      false,
      true,
    ]);
    expect(spectator.query('[data-testid="mounts-ability"]')).toHaveText(
      'MOUNTS.PASSIVE',
    );
    expect(spectator.query('[data-testid="mounts-facts"]')).toHaveText(
      'MOUNTS.FACT.passive',
    );
    expect(spectator.query('[data-testid="mounts-story"]')).toHaveText(
      'MOUNTS.CAPIVARA.STORY',
    );

    riderId.set('tiao');
    spectator.detectChanges();
    expect(stage().dataset['pose']).toBe('tiao/capivara/down/0');
  });

  it('turns on a click, strikes the poses around the stage, and walks on a timer', () => {
    vi.useFakeTimers();
    try {
      spectator.click('[data-testid="mounts-stage"]');
      expect(stage().dataset['pose']).toBe('lia/tatu/left/0');

      spectator.click(
        '[data-testid="mounts-pose"][data-facing="up"][data-walking="true"]',
      );
      expect(stage().dataset['pose']).toBe('lia/tatu/up/1');
      expect(
        spectator.query(
          '[data-testid="mounts-pose"][data-facing="up"][data-walking="true"]',
        ),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(spectator.query('[data-testid="mounts-walk"]')).toHaveText(
        'MOUNTS.STAND',
      );

      vi.advanceTimersByTime(WALK_STEP_MS);
      spectator.detectChanges();
      expect(stage().dataset['pose']).toBe('lia/tatu/up/0');
      vi.advanceTimersByTime(WALK_STEP_MS);
      spectator.detectChanges();
      expect(stage().dataset['pose']).toBe('lia/tatu/up/2');

      spectator.click('[data-testid="mounts-walk"]');
      expect(stage().dataset['pose']).toBe('lia/tatu/up/0');
      vi.advanceTimersByTime(WALK_STEP_MS * 3);
      spectator.detectChanges();
      expect(stage().dataset['pose']).toBe('lia/tatu/up/0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops the videos when the page is left', () => {
    spectator.fixture.destroy();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
