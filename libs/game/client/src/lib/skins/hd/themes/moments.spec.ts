import {
  BLACKOUT,
  blackoutAt,
  quickened,
  RAIN,
  SWEEP,
  sweepAt,
} from './moments';

describe('blackoutAt', () => {
  it('is dark for the moment at the end of every period, lights on otherwise', () => {
    const every = BLACKOUT.everyTicks;
    const dark = BLACKOUT.forTicks;
    expect(blackoutAt(BLACKOUT, 0)).toBe(0);
    expect(blackoutAt(BLACKOUT, every - dark - 1)).toBe(0);
    // Halfway through the dark: fully out.
    expect(blackoutAt(BLACKOUT, every - dark / 2)).toBe(1);
    // The boundary: lights back on, and again a period later.
    expect(blackoutAt(BLACKOUT, every)).toBe(0);
    expect(blackoutAt(BLACKOUT, 2 * every - dark / 2)).toBe(1);
  });

  it('fades in and out instead of switching', () => {
    const every = BLACKOUT.everyTicks;
    const dark = BLACKOUT.forTicks;
    const start = every - dark;
    expect(blackoutAt(BLACKOUT, start + 1)).toBeGreaterThan(0);
    expect(blackoutAt(BLACKOUT, start + 1)).toBeLessThan(0.5);
    expect(blackoutAt(BLACKOUT, every - 1)).toBeGreaterThan(0);
    expect(blackoutAt(BLACKOUT, every - 1)).toBeLessThan(0.5);
  });

  it('never darkens without a blackout moment', () => {
    expect(blackoutAt(null, 1_799)).toBe(0);
    expect(blackoutAt(RAIN, 1_799)).toBe(0);
    expect(
      blackoutAt({ kind: 'blackout', everyTicks: 0, forTicks: 10 }, 5),
    ).toBe(0);
  });
});

describe('sweepAt', () => {
  it('runs top to bottom at the end of every period, and is off otherwise', () => {
    const every = SWEEP.everyTicks;
    const run = SWEEP.forTicks;
    expect(sweepAt(SWEEP, 0)).toBeNull();
    expect(sweepAt(SWEEP, every - run - 1)).toBeNull();
    expect(sweepAt(SWEEP, every - run)).toBe(0);
    expect(sweepAt(SWEEP, every - run / 2)).toBe(0.5);
    expect(sweepAt(SWEEP, every)).toBeNull();
    expect(sweepAt(SWEEP, 2 * every - run / 2)).toBe(0.5);
  });

  it('never sweeps without a sweep moment', () => {
    expect(sweepAt(null, 1_799)).toBeNull();
    expect(sweepAt(BLACKOUT, 1_799)).toBeNull();
    expect(sweepAt(RAIN, 1_799)).toBeNull();
  });

  it('does not darken the arena', () => {
    expect(blackoutAt(SWEEP, SWEEP.everyTicks - 1)).toBe(0);
  });
});

describe('quickened', () => {
  it('shortens a blackout’s or a sweep’s wait and leaves rain alone', () => {
    expect(quickened(SWEEP, 480)).toEqual({
      kind: 'sweep',
      everyTicks: 480,
      forTicks: 120,
    });
    expect(quickened(BLACKOUT, 480)).toEqual({
      kind: 'blackout',
      everyTicks: 480,
      forTicks: 120,
    });
    expect(quickened(RAIN, 480)).toBe(RAIN);
    expect(quickened(null, 480)).toBeNull();
  });
});
