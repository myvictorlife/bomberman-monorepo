import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHARACTER_TILE,
  characterPixelRatio,
  paintCharacterFrame,
  paintMountIcon,
} from './paint-character';

/**
 * A document whose canvases remember their size and the first scale the
 * painter applied, and otherwise accept any drawing call: jsdom has no 2D
 * context, and the pixels are not the point here — the sizes are.
 */
function fakeDocument(): {
  doc: Document;
  canvases: { width: number; height: number; scale: number[] }[];
} {
  const canvases: { width: number; height: number; scale: number[] }[] = [];
  const context = (canvas: { scale: number[] }): CanvasRenderingContext2D => {
    const anything: unknown = new Proxy(() => anything, {
      get: () => anything,
      apply: () => anything,
    });
    return new Proxy({} as CanvasRenderingContext2D, {
      get: (_, prop) =>
        prop === 'scale'
          ? (x: number, y: number) => canvas.scale.push(x, y)
          : anything,
      set: () => true,
    });
  };
  const doc = {
    createElement: () => {
      const canvas = { width: 0, height: 0, scale: [] as number[] };
      canvases.push(canvas);
      return Object.assign(canvas, { getContext: () => context(canvas) });
    },
  } as unknown as Document;
  return { doc, canvases };
}

describe('character frame resolution', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('paints one tile at one pixel per unit on a plain screen', () => {
    const { doc, canvases } = fakeDocument();
    const canvas = paintCharacterFrame(doc, {
      characterId: 'novato',
      facing: 'down',
      frame: 0,
    });
    expect(canvas).toMatchObject({ width: CHARACTER_TILE, height: 64 });
    expect(canvases[0]?.scale.slice(0, 2)).toEqual([1, 1]);
  });

  it('paints the size it is shown at, times the screen pixel ratio, the art still in 64 units', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { doc, canvases } = fakeDocument();
    const frame = paintCharacterFrame(doc, {
      characterId: 'lia',
      facing: 'left',
      frame: 2,
      mountId: 'tatu',
      size: 96,
    });
    expect(frame).toMatchObject({ width: 192, height: 192 });
    expect(canvases[0]?.scale.slice(0, 2)).toEqual([3, 3]);

    const icon = paintMountIcon(doc, 'pato', 1, 40);
    expect(icon).toMatchObject({ width: 80, height: 80 });
    expect(canvases[1]?.scale.slice(0, 2)).toEqual([1.25, 1.25]);
  });

  it('keeps the pixel ratio between 1 and 3', () => {
    vi.stubGlobal('devicePixelRatio', 0.5);
    expect(characterPixelRatio()).toBe(1);
    vi.stubGlobal('devicePixelRatio', 4);
    expect(characterPixelRatio()).toBe(3);
    vi.stubGlobal('devicePixelRatio', undefined);
    expect(characterPixelRatio()).toBe(1);
  });
});
