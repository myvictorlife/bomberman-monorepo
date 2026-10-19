import {
  BASE_SPEED,
  MOUNT_SPEED_BONUS,
  SPEED_PER_LEVEL,
  TICK_RATE,
} from './constants';
import {
  isBlockedFor,
  movePlayer,
  overlapsCell,
  playerCell,
  speedOf,
} from './movement';
import { input, openArena, player, run, setBlock } from './testing.spec-helper';

describe('movement', () => {
  it('walks along an open corridor at the base speed', () => {
    const state = openArena();
    const p1 = player(state, 'p1');

    movePlayer(state, p1, 'right');

    expect(p1.x).toBeCloseTo(1 + BASE_SPEED / TICK_RATE);
    expect(p1.y).toBe(1);
    expect(p1.moving).toBe(true);
    expect(p1.facing).toBe('right');
  });

  it('stops flush against a wall and does not move into it', () => {
    const state = openArena();
    const p1 = player(state, 'p1');

    movePlayer(state, p1, 'up'); // row 0 is the outer wall

    expect(p1.y).toBe(1);
    expect(p1.moving).toBe(false);
    expect(p1.facing).toBe('up');
  });

  it('stops exactly on the last free cell before a soft block', () => {
    const state = openArena();
    setBlock(state, 4, 1);

    run(state, 120, { p1: input('right') });

    expect(player(state, 'p1').x).toBe(3);
  });

  it('cannot leave a lane sideways into a pillar', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.x = 2; // (2, 2) is a pillar

    movePlayer(state, p1, 'down');

    expect(p1.y).toBe(1);
  });

  it('slides around a corner onto the nearest open lane', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    // Slightly past column 1 while heading down column 1 → (1, 2) is open.
    p1.x = 1.2;

    movePlayer(state, p1, 'down');

    expect(p1.x).toBeLessThan(1.2);
    expect(p1.y).toBe(1);
    run(state, 10, { p1: input('down') });
    expect(p1.x).toBe(1);
    expect(p1.y).toBeGreaterThan(1);
  });

  it('slides towards the other lane when the nearest one is blocked', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    // Between columns 2 and 3, nearer 2; below column 2 is a pillar, below 3 is open.
    p1.x = 2.4;

    run(state, 30, { p1: input('down') });

    expect(p1.x).toBe(3);
    expect(p1.y).toBeGreaterThan(1);
  });

  it('does not move at all when both lanes ahead are blocked', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.x = 1.5;
    setBlock(state, 1, 2);
    setBlock(state, 2, 2); // a pillar anyway

    movePlayer(state, p1, 'down');

    expect(p1.x).toBe(1.5);
    expect(p1.moving).toBe(false);
  });

  it('moves left and up symmetrically', () => {
    const state = openArena();
    const p2 = player(state, 'p2'); // bottom-right corner (13, 11)

    run(state, 30, { p2: input('left') });
    expect(p2.x).toBeLessThan(13);

    const fresh = openArena();
    const q = player(fresh, 'p2');
    run(fresh, 30, { p2: input('up') });
    expect(q.y).toBeLessThan(11);
  });

  it('gets faster with every speed level', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.speedLevel = 2;

    expect(speedOf(p1)).toBeCloseTo(BASE_SPEED + 2 * SPEED_PER_LEVEL);

    p1.mountId = 'bernardo';
    expect(speedOf(p1)).toBeCloseTo(
      BASE_SPEED + 2 * SPEED_PER_LEVEL + MOUNT_SPEED_BONUS,
    );
  });

  it('reports the cell under the centre and the cells it overlaps', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    p1.x = 1.6;

    expect(playerCell(p1)).toEqual([2, 1]);
    expect(overlapsCell(p1, 1, 1)).toBe(true);
    expect(overlapsCell(p1, 2, 1)).toBe(true);
    expect(overlapsCell(p1, 3, 1)).toBe(false);
  });

  it('treats bombs as solid except for players allowed to pass', () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    state.bombs.push({
      id: 1,
      col: 2,
      row: 1,
      ownerId: 'p2',
      fuse: 99,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    expect(isBlockedFor(state, p1, 2, 1)).toBe(true);
    state.bombs[0]?.passThrough.push('p1');
    expect(isBlockedFor(state, p1, 2, 1)).toBe(false);
  });
});

describe('mount passives', () => {
  it("lets a Capivara rider walk over anyone's bomb", () => {
    const state = openArena();
    const p1 = player(state, 'p1');
    state.bombs.push({
      id: 300,
      col: 2,
      row: 1,
      ownerId: 'p2',
      fuse: 100,
      range: 1,
      passThrough: [],
      pierce: false,
      remote: false,
    });

    expect(isBlockedFor(state, p1, 2, 1)).toBe(true);
    p1.mountId = 'capivara';
    expect(isBlockedFor(state, p1, 2, 1)).toBe(false);
    p1.mountId = 'tatu';
    expect(isBlockedFor(state, p1, 2, 1)).toBe(true);
  });
});
