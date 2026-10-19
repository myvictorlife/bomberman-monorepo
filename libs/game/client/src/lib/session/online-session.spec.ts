import { addOutsider, createGame, GameState, Outsider } from '@libs/game-core';
import {
  FRAME_INTERVAL_MS,
  FrameMessage,
  InputMessage,
} from '@libs/game-protocol';
import { OnlineSession } from './online-session';

function frame(
  mutate: (s: GameState) => void = () => undefined,
  events: FrameMessage['events'] = [],
): FrameMessage {
  const state = createGame({
    seed: 1,
    players: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
  });
  mutate(state);
  return { round: 1, state, events };
}

describe('OnlineSession', () => {
  let clock = 0;
  let sent: InputMessage[] = [];
  const create = (controls: string[] = ['wasd', 'arrows']) =>
    new OnlineSession(
      frame(),
      controls,
      (m) => sent.push(m),
      () => clock,
    );

  beforeEach(() => {
    clock = 0;
    sent = [];
  });

  it('starts from the first frame, as its own copy', () => {
    const first = frame();
    const session = new OnlineSession(
      first,
      [],
      () => undefined,
      () => 0,
    );

    expect(session.state).toEqual(first.state);
    expect(session.state).not.toBe(first.state);
  });

  it('keeps one state object for the whole round, so the scene never rebuilds the arena', () => {
    const session = create();
    const state = session.state;

    session.receive(frame((s) => (s.tick = 10)));

    expect(session.state).toBe(state);
    expect(session.state.tick).toBe(10);
  });

  it('glides players between two frames', () => {
    const session = create();
    session.receive(
      frame((s) => {
        (s.players[0] as { x: number }).x = 2;
        s.players.push({
          ...(s.players[1] as GameState['players'][number]),
          id: 'late',
        });
      }),
    );

    clock = FRAME_INTERVAL_MS / 2;
    session.advance(16, {});
    expect(session.state.players[0]?.x).toBeCloseTo(1.5);

    clock = FRAME_INTERVAL_MS * 3;
    session.advance(16, {});
    expect(session.state.players[0]?.x).toBe(2);
  });

  it('hands the events over once', () => {
    const session = new OnlineSession(
      frame(undefined, [{ type: 'explosion', col: 1, row: 1 }]),
      [],
      () => undefined,
      () => 0,
    );
    session.receive(
      frame(undefined, [
        { type: 'player-died', playerId: 'b', killerId: null },
      ]),
    );

    expect(session.advance(16, {}).map((e) => e.type)).toEqual([
      'explosion',
      'player-died',
    ]);
    expect(session.advance(16, {})).toEqual([]);
  });

  it('sends the direction only when it changes, from either control scheme', () => {
    const session = create();

    session.advance(16, { wasd: 'left' });
    session.advance(16, { wasd: 'left' });
    session.advance(16, { arrows: 'up' });
    session.advance(16, { wasd: null, arrows: null });

    expect(sent).toEqual([
      { direction: 'left' },
      { direction: 'up' },
      { direction: null },
    ]);
  });

  it('sends bomb and ability presses from this tab’s schemes only', () => {
    const session = create(['wasd']);
    session.advance(16, { wasd: 'right' });
    sent = [];

    session.pressBomb('wasd');
    session.pressAbility('wasd');
    session.pressDetonate('wasd');
    session.pressBomb('someone-else');
    session.pressDetonate('someone-else');

    expect(sent).toEqual([
      { direction: 'right', bomb: true },
      { direction: 'right', ability: true },
      { direction: 'right', detonate: true },
    ]);
  });

  it('sends nothing for a spectator', () => {
    const session = create([]);

    session.advance(16, { wasd: 'left' });
    session.pressBomb('wasd');

    expect(sent).toEqual([]);
  });

  it('takes and gives the keys without a new session, stopping the player when it lets go', () => {
    const session = create([]);
    session.advance(16, { wasd: 'left' });
    expect(sent).toEqual([]);

    session.setControls(['wasd']);
    session.advance(16, { wasd: 'left' });
    session.setControls([]);
    session.advance(16, { wasd: 'up' });
    session.setControls([]);

    expect(sent).toEqual([{ direction: 'left' }, { direction: null }]);
  });

  it('defaults to the page clock', () => {
    expect(() =>
      new OnlineSession(frame(), [], () => undefined).advance(16, {}),
    ).not.toThrow();
  });
});

describe('OnlineSession outsiders', () => {
  it('glides outsiders between frames like players', () => {
    let clock = 0;
    const first = frame((s) => addOutsider(s, { id: 'x', name: 'X' }));
    const session = new OnlineSession(
      first,
      [],
      () => undefined,
      () => clock,
    );
    const start = session.state.outsiders[0] as Outsider;
    const next = frame((s) => {
      const x = addOutsider(s, { id: 'x', name: 'X' }) as Outsider;
      x.x = start.x;
      x.y = start.y + 1;
    });

    session.receive(next);
    clock = FRAME_INTERVAL_MS / 2;
    session.advance(16, {});

    expect(session.state.outsiders[0]?.y).toBeCloseTo(start.y + 0.5);
  });

  it('ignores a control hand-over that changes nothing', () => {
    const sent: InputMessage[] = [];
    const session = new OnlineSession(
      frame(),
      ['wasd'],
      (m) => sent.push(m),
      () => 0,
    );
    session.advance(16, { wasd: 'up' });
    session.setControls(['wasd']);
    session.advance(16, { wasd: 'up' });

    expect(sent).toEqual([{ direction: 'up' }]);
  });
});
