import { TEXTURE } from '../texture-keys';
import {
  paintCharacterTextures,
  paintHdTextures,
  paintMountTextures,
} from './hd-painter';
import { HD_RESOLUTION, hdSkin } from './hd-skin';
import { themeTextures } from './themes';

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

describe('HD skin resolution', () => {
  it('paints at one pixel per art unit unless asked for more', () => {
    const { doc, canvases } = fakeDocument();
    const textures = paintHdTextures(doc);
    expect(textures.get(TEXTURE.floor)).toMatchObject({
      width: 64,
      height: 64,
    });
    expect(canvases.every((c) => c.scale[0] === 1)).toBe(true);
  });

  it('paints every tile twice as fine at resolution 2, the art still in 64 units', () => {
    const { doc, canvases } = fakeDocument();
    const textures = paintHdTextures(doc, ['novato'], undefined, 2);
    expect(textures.get(TEXTURE.floor)).toMatchObject({
      width: 128,
      height: 128,
    });
    // A mounted rider is painted on demand, with headroom that grows with the rest.
    const riding = paintMountTextures(
      doc,
      'novato',
      0,
      'tatu',
      undefined,
      undefined,
      2,
    );
    const mounted = riding.get(TEXTURE.playerMounted(0, 'tatu', 'down', 0));
    expect(mounted?.width).toBe(128);
    expect(mounted?.height).toBeGreaterThan(128);
    // The scared frame is the mount's idle too: it shares the cheer frame's canvas.
    expect(riding.get(TEXTURE.playerMounted(0, 'tatu', 'down', 5))).toBe(
      riding.get(TEXTURE.playerMounted(0, 'tatu', 'down', 4)),
    );
    expect(canvases.every((c) => c.scale[0] === 2 && c.scale[1] === 2)).toBe(
      true,
    );

    const one = paintCharacterTextures(
      doc,
      'byte',
      'outsider',
      undefined,
      undefined,
      2,
    );
    const outsider = one.get(TEXTURE.outsider('byte', 'left', 1));
    expect(outsider?.width).toBe(128);
    expect(outsider?.height).toBeGreaterThan(128);
  });

  it('keeps a theme per resolution', () => {
    const { doc } = fakeDocument();
    const fine = themeTextures(doc, 'subestacao', 2);
    expect(fine.get(TEXTURE.floor)).toMatchObject({ width: 128, height: 128 });
    expect(themeTextures(doc, 'subestacao', 2)).toBe(fine);
    expect(themeTextures(doc, 'subestacao', 1)).not.toBe(fine);
    expect(
      themeTextures(doc, 'subestacao', 1).get(TEXTURE.floor),
    ).toMatchObject({ width: 64 });
  });

  it('sizes the skin by the screen: whole pixels per CSS pixel, 1 to 2', () => {
    // jsdom reports a plain screen.
    expect(HD_RESOLUTION).toBe(1);
    expect(hdSkin.tileSize).toBe(64 * HD_RESOLUTION);
    expect(hdSkin.resolution).toBe(HD_RESOLUTION);
  });
});
