import { Component, signal } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { SpritePainter, SpriteTileComponent } from './sprite-tile';

@Component({
  imports: [SpriteTileComponent],
  template: `<lib-sprite-tile
    [paint]="paint"
    [size]="size()"
    [units]="units()"
    [label]="label()"
  />`,
})
class HostComponent {
  readonly paint: SpritePainter = vi.fn();
  readonly size = signal(64);
  readonly units = signal(64);
  readonly label = signal<string | null>('64 px');
}

describe('SpriteTileComponent', () => {
  let spectator: Spectator<HostComponent>;
  const createComponent = createComponentFactory({
    component: HostComponent,
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

  const settle = async () => {
    spectator.detectChanges();
    await spectator.fixture.whenStable();
  };

  it('paints into a canvas scaled from the logical space to the size', async () => {
    await settle();

    const canvas = spectator.query('canvas') as HTMLCanvasElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    expect(canvas.width).toBe(Math.round(64 * dpr));
    expect(canvas.style.width).toBe('64px');
    expect(fakeCtx.scale).toHaveBeenCalledWith(
      canvas.width / 64,
      canvas.height / 64,
    );
    expect(spectator.component.paint).toHaveBeenCalledWith(fakeCtx);
    expect(spectator.query('figcaption')).toHaveText('64 px');
  });

  it('repaints when the size or the logical space changes, and drops an empty label', async () => {
    await settle();
    spectator.component.size.set(128);
    spectator.component.units.set(32);
    spectator.component.label.set(null);
    await settle();

    const canvas = spectator.query('canvas') as HTMLCanvasElement;
    expect(canvas.style.width).toBe('128px');
    expect(fakeCtx.scale).toHaveBeenLastCalledWith(
      canvas.width / 32,
      canvas.height / 32,
    );
    expect(spectator.component.paint).toHaveBeenCalledTimes(2);
    expect(spectator.query('figcaption')).not.toExist();
  });

  it('does nothing without a 2D context', async () => {
    getContext.mockReturnValue(null);
    await settle();

    expect(spectator.component.paint).not.toHaveBeenCalled();
  });
});
