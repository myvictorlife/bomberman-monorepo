import {
  assignColors,
  isPlayerColorId,
  PLAYER_COLOR_IDS,
  slotColor,
} from './colors';

describe('player colours', () => {
  it('knows its ids and nothing else', () => {
    expect(isPlayerColorId('purple')).toBe(true);
    expect(isPlayerColorId('teal')).toBe(false);
    expect(isPlayerColorId(3)).toBe(false);
  });

  it('gives each slot its colour, wrapping past the palette', () => {
    expect(slotColor(0)).toBe('blue');
    expect(slotColor(4)).toBe('green');
    expect(slotColor(PLAYER_COLOR_IDS.length)).toBe('blue');
  });
});

describe('assignColors', () => {
  it('keeps the slot colours when nobody picked one', () => {
    expect(assignColors([undefined, undefined, undefined])).toEqual([
      'blue',
      'graphite',
      'red',
    ]);
  });

  it('honours every distinct choice', () => {
    expect(assignColors(['pink', 'orange'])).toEqual(['pink', 'orange']);
  });

  it('lets the first in line keep a contested colour and gives the next the closest free one', () => {
    // Orange and pink are equally close to red: palette order breaks the tie.
    expect(assignColors(['red', 'red'])).toEqual(['red', 'orange']);
    expect(assignColors(['red', 'red', 'red'])).toEqual([
      'red',
      'orange',
      'pink',
    ]);
  });

  it('does not let a player with no preference take a colour someone picked', () => {
    // Slot 0's colour is blue, but the second player chose it.
    expect(assignColors([undefined, 'blue'])).toEqual(['graphite', 'blue']);
  });

  it('sends a second graphite to the first free colour', () => {
    expect(assignColors(['graphite', 'graphite'])).toEqual([
      'graphite',
      'blue',
    ]);
  });

  it('never repeats a colour while there are free ones', () => {
    const colors = assignColors(['green', 'green', 'green', 'green', 'green']);
    expect(new Set(colors).size).toBe(5);
  });
});
