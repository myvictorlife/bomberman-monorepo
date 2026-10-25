import { DEMO_LOOP_MS, demoPose } from './gamepad-demo';

describe('demoPose', () => {
  it('starts with the thumb away, and lands it beside the pad', () => {
    expect(demoPose(0).down).toBe(false);
    expect(demoPose(700)).toEqual({ x: 1.2, y: -0.7, down: true });
  });

  it('slides the thumb between two keys it is down for', () => {
    // Halfway from (1.2, -0.7) at 700 to (1.2, -1.05) at 1000.
    const pose = demoPose(850);
    expect(pose.down).toBe(true);
    expect(pose.x).toBeCloseTo(1.2);
    expect(pose.y).toBeCloseTo(-0.875);
  });

  it('lifts, then lands on the pad itself', () => {
    expect(demoPose(3500).down).toBe(false);
    expect(demoPose(4400)).toEqual({ x: 0, y: 0.38, down: true });
    expect(demoPose(5000).down).toBe(false);
  });

  it('loops', () => {
    expect(demoPose(DEMO_LOOP_MS + 850)).toEqual(demoPose(850));
  });
});
