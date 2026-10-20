import { hatchStage, isItemId, ITEM_IDS } from './items';

describe('items', () => {
  it('knows every item', () => {
    expect(ITEM_IDS).toEqual([
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
    expect(isItemId('egg')).toBe(true);
    expect(isItemId('sword')).toBe(false);
  });

  it('opens the egg over two seconds and rests after', () => {
    expect(hatchStage(-1, 4)).toBe(0);
    expect(hatchStage(0, 4)).toBe(0);
    expect(hatchStage(600, 4)).toBe(1);
    expect(hatchStage(1100, 4)).toBe(2);
    expect(hatchStage(1900, 4)).toBe(3);
    expect(hatchStage(2300, 4)).toBe(3);
    expect(hatchStage(2400, 4)).toBe(0);
  });
});
