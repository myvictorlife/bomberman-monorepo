import { dragDirection, QUARTER_TURN, QUARTER_TURN_BACK } from './dpad';

const centre = { x: 100, y: 100 };

describe('dragDirection', () => {
  it('points nowhere inside the dead zone', () => {
    expect(dragDirection(centre, { x: 105, y: 108 }, null)).toBeNull();
    expect(dragDirection(centre, { x: 100, y: 100 }, 'up')).toBeNull();
  });

  it('takes the dominant axis, signed', () => {
    expect(dragDirection(centre, { x: 100, y: 60 }, null)).toBe('up');
    expect(dragDirection(centre, { x: 100, y: 140 }, null)).toBe('down');
    expect(dragDirection(centre, { x: 60, y: 100 }, null)).toBe('left');
    expect(dragDirection(centre, { x: 140, y: 110 }, null)).toBe('right');
  });

  it('keeps the held axis on the diagonal, and a bit beyond it', () => {
    // 40 right, 45 up: fresh it is up; a thumb already walking right stays right.
    expect(dragDirection(centre, { x: 140, y: 55 }, null)).toBe('up');
    expect(dragDirection(centre, { x: 140, y: 55 }, 'right')).toBe('right');
    // The other way round, held on the vertical axis.
    expect(dragDirection(centre, { x: 145, y: 60 }, null)).toBe('right');
    expect(dragDirection(centre, { x: 145, y: 60 }, 'up')).toBe('up');
  });

  it('switches axis once the finger goes clearly past the bias', () => {
    // 40 right, 60 up: 60 > 40 × 1.3, so a right-walker turns up.
    expect(dragDirection(centre, { x: 140, y: 40 }, 'right')).toBe('up');
    expect(dragDirection(centre, { x: 40, y: 140 }, 'up')).toBe('left');
  });

  it('flips sign on the held axis at once', () => {
    expect(dragDirection(centre, { x: 60, y: 100 }, 'right')).toBe('left');
    expect(dragDirection(centre, { x: 100, y: 140 }, 'up')).toBe('down');
  });

  it('honours custom options', () => {
    const options = { deadZone: 30, hysteresis: 0 };
    expect(dragDirection(centre, { x: 120, y: 100 }, null, options)).toBeNull();
    expect(dragDirection(centre, { x: 140, y: 55 }, 'right', options)).toBe(
      'up',
    );
  });
});

describe('QUARTER_TURN', () => {
  it('turns every direction a quarter clockwise, and back', () => {
    for (const d of ['up', 'right', 'down', 'left'] as const) {
      expect(QUARTER_TURN_BACK[QUARTER_TURN[d]]).toBe(d);
    }
    expect(QUARTER_TURN.right).toBe('up');
    expect(QUARTER_TURN_BACK.up).toBe('right');
  });
});
