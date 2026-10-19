import { Component, signal } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { PodiumComponent, PodiumLine, PodiumPainter, toPodium } from './podium';

const line = (
  id: string,
  wins: number,
  matches: number,
  characterId?: string,
): PodiumLine => ({
  id,
  name: id.toUpperCase(),
  wins,
  matches,
  characterId,
});

@Component({
  imports: [PodiumComponent],
  template: `<lib-podium
    [entries]="entries()"
    [paint]="paint"
    [myId]="myId()"
    [size]="64"
  />`,
})
class HostComponent {
  readonly entries = signal<PodiumLine[]>([]);
  readonly myId = signal<string | null>(null);
  readonly paint: PodiumPainter = vi.fn();
}

describe('toPodium', () => {
  it('keeps the first three, with their place, rate and the titles they earn', () => {
    const steps = toPodium([
      line('a', 7, 10),
      line('b', 4, 10),
      line('c', 1, 10),
      line('d', 1, 1),
    ]);

    expect(steps.map((s) => [s.place, s.rate, s.titleKey, s.tagKey])).toEqual([
      [1, 70, 'PODIUM.TITLE_1', 'PODIUM.TAG_RUTHLESS'],
      [2, 40, 'PODIUM.TITLE_2', 'PODIUM.TAG_DANGEROUS'],
      [3, 10, 'PODIUM.TITLE_3', 'PODIUM.TAG_STUBBORN'],
    ]);
    expect(toPodium([line('x', 0, 0)])[0]?.rate).toBe(0);
  });
});

describe('PodiumComponent', () => {
  let spectator: Spectator<HostComponent>;
  const createComponent = createComponentFactory({
    component: HostComponent,
    providers: [provideTranslateService()],
    detectChanges: false,
  });
  const fakeCtx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    lineJoin: '',
    lineCap: '',
  };
  let getContext: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
    spectator = createComponent();
  });

  afterEach(() => getContext.mockRestore());

  it('puts the winner in the middle and paints each face once, with its place', async () => {
    spectator.component.entries.set([
      line('a', 5, 6, 'faisca'),
      line('b', 2, 6, 'lia'),
      line('c', 1, 6),
    ]);
    spectator.detectChanges();
    await spectator.fixture.whenStable();

    const steps = spectator.queryAll('[data-testid="podium-step"]');
    expect(steps.map((s) => s.getAttribute('data-place'))).toEqual([
      '2',
      '1',
      '3',
    ]);
    expect(
      spectator
        .queryAll('[data-testid="podium-name"]')
        .map((n) => n.textContent?.trim()),
    ).toEqual(['B', 'A', 'C']);
    expect(spectator.query('.podium__crown')).toExist();
    expect(spectator.component.paint).toHaveBeenCalledTimes(3);
    expect(spectator.component.paint).toHaveBeenCalledWith(
      fakeCtx,
      'faisca',
      1,
    );
    expect(spectator.component.paint).toHaveBeenCalledWith(
      fakeCtx,
      undefined,
      3,
    );
    expect(fakeCtx.scale).toHaveBeenCalledWith(1, 1);

    spectator.detectChanges();
    await spectator.fixture.whenStable();
    expect(spectator.component.paint).toHaveBeenCalledTimes(3);
  });

  it('leaves an empty step for a place nobody holds, and marks mine', async () => {
    spectator.component.entries.set([line('solo', 1, 1)]);
    spectator.component.myId.set('solo');
    spectator.detectChanges();
    await spectator.fixture.whenStable();

    expect(spectator.queryAll('[data-testid="podium-step"]')).toHaveLength(1);
    expect(spectator.queryAll('.podium__step--empty')).toHaveLength(2);
    expect(spectator.query('[data-testid="podium-step"]')).toHaveClass(
      'podium__step--me',
    );
  });
});
