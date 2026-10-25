import { tileVariantKey } from './index';

describe('tileVariantKey', () => {
  const all = () => true;

  it('keeps the plain tile on a theme without variants', () => {
    expect(tileVariantKey('nucleo', 'wall', 3, 4, all)).toBe('wall');
  });

  it('picks the same look for a cell every time, and mixes them across the arena', () => {
    expect(tileVariantKey('programador', 'wall', 2, 2, all)).toBe(
      tileVariantKey('programador', 'wall', 2, 2, all),
    );
    const looks = new Set<string>();
    for (let col = 2; col < 14; col += 2)
      for (let row = 2; row < 12; row += 2)
        looks.add(tileVariantKey('programador', 'wall', col, row, all));
    expect(looks).toEqual(new Set(['wall', 'wall#1', 'wall#2']));
  });

  it('falls back to the plain tile when the look was not painted', () => {
    for (let col = 0; col < 15; col++)
      expect(tileVariantKey('programador', 'floor', col, 3, () => false)).toBe(
        'floor',
      );
  });
});
