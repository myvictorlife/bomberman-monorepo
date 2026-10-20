import { RoomRules, Seat } from '@libs/game-protocol';
import { BOT_NAMES, botId, isBotId, Lobby } from './lobby';

const RULES: RoomRules = {
  maxPlayers: 5,
  minPlayers: 2,
  countdownMs: 15_000,
  resultsMs: 5_000,
  outsiders: 2,
  roundTimerMs: 180_000,
  closingWalls: true,
  winnerStays: 0,
  bots: 0,
  botsFillTo: 5,
  idleMs: 0,
};
const seat = (id: string): Seat => ({
  id,
  name: id.toUpperCase(),
  characterId: 'faisca',
});

function lobbyWith(...ids: string[]): Lobby {
  const lobby = new Lobby(RULES);
  ids.forEach((id) => lobby.join(seat(id)));
  return lobby;
}

describe('Lobby', () => {
  it('waits while fewer than two are queued', () => {
    const lobby = lobbyWith('a');

    expect(lobby.update(0)).toBeNull();
    expect(lobby.phase).toBe('waiting');
    expect(lobby.snapshot(0).countdownEndsAt).toBeNull();
  });

  it('starts the countdown with two and the round when it runs out', () => {
    const lobby = lobbyWith('a', 'b');

    expect(lobby.update(1_000)).toBeNull();
    expect(lobby.phase).toBe('countdown');
    expect(lobby.snapshot(1_000).countdownEndsAt).toBe(16_000);

    expect(lobby.update(15_999)).toBeNull();
    const start = lobby.update(16_000);

    expect(start?.players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(lobby.phase).toBe('playing');
    expect(lobby.snapshot(16_000).queue).toEqual([]);
  });

  it('starts at once when the fifth player joins, mid-countdown', () => {
    const lobby = lobbyWith('a', 'b');
    lobby.update(0);
    ['c', 'd', 'e'].forEach((id) => lobby.join(seat(id)));

    const start = lobby.update(1_000);

    expect(start?.players).toHaveLength(5);
    expect(lobby.phase).toBe('playing');
  });

  it('starts at once when five are queued from the start', () => {
    const lobby = lobbyWith('a', 'b', 'c', 'd', 'e', 'f');

    const start = lobby.update(0);

    expect(start?.players.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(lobby.snapshot(0).queue.map((s) => s.id)).toEqual(['f']);
  });

  it('does not restart the countdown when someone joins', () => {
    const lobby = lobbyWith('a', 'b');
    lobby.update(0);
    lobby.join(seat('c'));
    lobby.update(10_000);

    expect(lobby.snapshot(10_000).countdownEndsAt).toBe(15_000);
  });

  it('cancels the countdown when the queue drops below two', () => {
    const lobby = lobbyWith('a', 'b');
    lobby.update(0);
    lobby.leave('b');

    expect(lobby.update(1_000)).toBeNull();
    expect(lobby.phase).toBe('waiting');
    expect(lobby.snapshot(1_000).countdownEndsAt).toBeNull();
  });

  it('holds one place per account', () => {
    const lobby = lobbyWith('a', 'b');

    expect(lobby.join(seat('a'))).toBe('already-queued');
    lobby.update(0);
    lobby.update(15_000);
    expect(lobby.isPlaying('a')).toBe(true);
    expect(lobby.join(seat('a'))).toBe('already-playing');
    expect(lobby.join(seat('c'))).toBe('queued');
  });

  it('queues newcomers during a round for the next one', () => {
    const lobby = lobbyWith('a', 'b');
    lobby.update(0);
    lobby.update(15_000);
    lobby.join(seat('c'));

    expect(lobby.update(16_000)).toBeNull();
    expect(lobby.phase).toBe('playing');
    expect(lobby.snapshot(16_000).queue.map((s) => s.id)).toEqual(['c']);
  });

  it('shows the result, then puts the waiting ones first and the round’s players behind, winner first', () => {
    const lobby = lobbyWith('a', 'b', 'c');
    lobby.update(0);
    lobby.update(15_000);
    lobby.join(seat('d'));

    lobby.finishRound('c', 20_000);
    expect(lobby.phase).toBe('results');
    expect(lobby.snapshot(20_000).winnerId).toBe('c');
    expect(lobby.update(24_999)).toBeNull();
    expect(lobby.phase).toBe('results');

    lobby.update(25_000);
    expect(lobby.snapshot(25_000).queue.map((s) => s.id)).toEqual([
      'd',
      'c',
      'a',
      'b',
    ]);
    expect(lobby.phase).toBe('countdown');
  });

  it('does not put back a player who left during the round', () => {
    const lobby = lobbyWith('a', 'b');
    lobby.update(0);
    lobby.update(15_000);
    lobby.leave('b');

    expect(lobby.isPlaying('b')).toBe(false);
    lobby.finishRound('a', 20_000);
    lobby.update(25_000);

    expect(lobby.snapshot(25_000).queue.map((s) => s.id)).toEqual(['a']);
    expect(lobby.phase).toBe('waiting');
  });

  it('ignores a result when no round is on', () => {
    const lobby = lobbyWith('a');

    lobby.finishRound('a', 0);

    expect(lobby.phase).toBe('waiting');
  });

  it('carries the watchers the room passes in, and none by default', () => {
    const lobby = lobbyWith('a');

    expect(lobby.snapshot(0).watchers).toEqual({ names: [], anonymous: 0 });
    expect(
      lobby.snapshot(0, { names: ['Bia'], anonymous: 2 }).watchers,
    ).toEqual({ names: ['Bia'], anonymous: 2 });
  });

  it('copies seats out, so a snapshot cannot change the lobby', () => {
    const lobby = lobbyWith('a');
    const snapshot = lobby.snapshot(0);
    (snapshot.queue[0] as Seat).name = 'changed';

    expect(lobby.snapshot(0).queue[0]?.name).toBe('A');
  });
});

describe('Lobby outsiders', () => {
  /** A five-player round in progress with `extra` more in line. */
  function playing(...extra: string[]): Lobby {
    const lobby = lobbyWith('a', 'b', 'c', 'd', 'e', ...extra);
    lobby.update(0);
    return lobby;
  }

  it('are the first in line, only while a round is played', () => {
    const lobby = lobbyWith('a', 'b', 'x');
    lobby.update(0);
    expect(lobby.outsiders()).toEqual([]);

    const playingLobby = playing('x', 'y', 'z');
    expect(playingLobby.outsiders().map((s) => s.id)).toEqual(['x', 'y']);
    expect(playingLobby.isOutsider('y')).toBe(true);
    expect(playingLobby.isOutsider('z')).toBe(false);

    playingLobby.finishRound('a', 1_000);
    expect(playingLobby.outsiders()).toEqual([]);
  });

  it('are nobody when the rule says none', () => {
    const lobby = new Lobby({ ...RULES, outsiders: 0 });
    ['a', 'b', 'x'].forEach((id) => lobby.join(seat(id)));
    lobby.update(0);
    lobby.update(RULES.countdownMs);

    expect(lobby.phase).toBe('playing');
    expect(lobby.outsiders()).toEqual([]);
  });

  it('move up as the line changes', () => {
    const lobby = playing('x', 'y', 'z');
    lobby.leave('x');
    expect(lobby.outsiders().map((s) => s.id)).toEqual(['y', 'z']);
  });

  it('enter the round on a kill, and go to the back with the players afterwards', () => {
    const lobby = playing('x', 'y', 'z');

    expect(lobby.enterRound('x')).toBe(true);
    expect(lobby.enterRound('nobody')).toBe(false);
    expect(lobby.isPlaying('x')).toBe(true);
    expect(lobby.isOutsider('x')).toBe(false);
    expect(lobby.outsiders().map((s) => s.id)).toEqual(['y', 'z']);
    expect(lobby.snapshot(0).players.map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'x',
    ]);
    expect(lobby.join(seat('x'))).toBe('already-playing');

    lobby.finishRound('x', 1_000);
    // Eight in line now: the next round starts at once with the first five.
    const start = lobby.update(1_000 + RULES.resultsMs);
    expect(start?.players.map((s) => s.id)).toEqual(['y', 'z', 'x', 'a', 'b']);
    expect(lobby.snapshot(0).queue.map((s) => s.id)).toEqual(['c', 'd', 'e']);
  });
});

describe('Lobby.setRules', () => {
  it('applies at once between rounds', () => {
    const lobby = lobbyWith('a');

    expect(lobby.setRules({ ...RULES, outsiders: 0 })).toBe('now');
    expect(lobby.rules.outsiders).toBe(0);
    expect(lobby.nextRules).toBeNull();
    expect(lobby.snapshot(0).nextRules).toBeNull();
  });

  it('waits for the round to end, then takes over for the next one', () => {
    const lobby = lobbyWith('a', 'b', 'c', 'd', 'e');
    expect(lobby.update(0)).not.toBeNull();
    expect(lobby.outsiders()).toHaveLength(0);
    lobby.join(seat('f'));
    expect(lobby.outsiders().map((s) => s.id)).toEqual(['f']);

    expect(lobby.setRules({ ...RULES, outsiders: 0, maxPlayers: 2 })).toBe(
      'next-round',
    );
    // Nothing moves mid-round: the border stays, the snapshot announces the change.
    expect(lobby.rules).toEqual(RULES);
    expect(lobby.outsiders().map((s) => s.id)).toEqual(['f']);
    expect(lobby.snapshot(0).nextRules?.outsiders).toBe(0);

    lobby.finishRound('a', 1_000);
    expect(lobby.rules).toEqual(RULES);
    // The results end: the new rules take over, and with six in line a room
    // of two is full, so the next round starts in the same breath — by them.
    const start = lobby.update(1_000 + RULES.resultsMs);
    expect(lobby.rules.outsiders).toBe(0);
    expect(lobby.rules.maxPlayers).toBe(2);
    expect(lobby.nextRules).toBeNull();
    expect(start?.players).toHaveLength(2);
    expect(lobby.outsiders()).toHaveLength(0);
  });

  it('keeps only the latest pending change', () => {
    const lobby = lobbyWith('a', 'b', 'c', 'd', 'e');
    lobby.update(0);
    lobby.setRules({ ...RULES, outsiders: 1 });
    lobby.setRules({ ...RULES, outsiders: 3 });
    expect(lobby.nextRules?.outsiders).toBe(3);
  });
});

describe('Lobby, winner stays', () => {
  /** A full room with `waiting` in line behind it, the rule set to `limit` wins in a row. */
  function fullRoom(limit: number, waiting: string[]): Lobby {
    const lobby = new Lobby({ ...RULES, outsiders: 0, winnerStays: limit });
    ['a', 'b', 'c', 'd', 'e', ...waiting].forEach((id) => lobby.join(seat(id)));
    lobby.update(0);
    return lobby;
  }
  const queue = (lobby: Lobby) => lobby.snapshot(0).queue.map((s) => s.id);

  it('keeps the winner for the next round with the next four in line; the losers go to the back, best placed first', () => {
    const lobby = fullRoom(5, ['f', 'g', 'h', 'i', 'j', 'k']);

    expect(lobby.finishRound('c', 1_000, ['c', 'e', 'a', 'd', 'b'])).toEqual({
      winnerId: 'c',
      streak: 1,
      stays: true,
    });
    expect(lobby.snapshot(1_000).champion).toEqual({ id: 'c', streak: 1 });
    const start = lobby.update(1_000 + RULES.resultsMs);

    expect(start?.players.map((s) => s.id)).toEqual(['c', 'f', 'g', 'h', 'i']);
    expect(queue(lobby)).toEqual(['j', 'k', 'e', 'a', 'd', 'b']);
    expect(lobby.champion).toEqual({ id: 'c', streak: 1 });
  });

  it('counts wins in a row, and sends the winner to the back at the limit', () => {
    const lobby = fullRoom(2, ['f', 'g', 'h', 'i']);
    lobby.finishRound('a', 1_000);
    lobby.update(1_000 + RULES.resultsMs);

    expect(lobby.finishRound('a', 10_000)).toEqual({
      winnerId: 'a',
      streak: 2,
      stays: false,
    });
    expect(lobby.champion).toBeNull();
    const start = lobby.update(10_000 + RULES.resultsMs);

    // The winner goes first among the round's players, but behind those waiting.
    expect(start?.players.map((s) => s.id)).toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('starts a new count when someone else wins', () => {
    const lobby = fullRoom(5, []);
    lobby.finishRound('a', 1_000);
    lobby.update(1_000 + RULES.resultsMs);

    expect(lobby.finishRound('b', 10_000)).toEqual({
      winnerId: 'b',
      streak: 1,
      stays: true,
    });
  });

  it('keeps nobody after a draw, with the rule off, or when the winner left', () => {
    const draw = fullRoom(5, ['f']);
    expect(draw.finishRound(null, 1_000)).toBeNull();
    expect(draw.champion).toBeNull();
    draw.update(1_000 + RULES.resultsMs);
    // Six in line: the next round starts at once, the one who was waiting first.
    expect(draw.snapshot(0).players.map((s) => s.id)).toEqual([
      'f',
      'a',
      'b',
      'c',
      'd',
    ]);

    const off = fullRoom(0, ['f']);
    expect(off.finishRound('a', 1_000)).toEqual({
      winnerId: 'a',
      streak: 1,
      stays: false,
    });
    off.update(1_000 + RULES.resultsMs);
    expect(off.snapshot(0).players[0]?.id).toBe('f');

    const left = fullRoom(5, ['f']);
    left.finishRound('a', 1_000);
    left.leave('a');
    expect(left.champion).toBeNull();
    left.update(1_000 + RULES.resultsMs);
    expect(left.snapshot(0).players.map((s) => s.id)).not.toContain('a');

    const goneBefore = fullRoom(5, []);
    goneBefore.leave('a');
    expect(goneBefore.finishRound('a', 1_000)).toBeNull();
  });

  it('lets an outsider who got in and won keep the seat', () => {
    const lobby = new Lobby({ ...RULES, winnerStays: 5 });
    ['a', 'b', 'c', 'd', 'e', 'x', 'y'].forEach((id) => lobby.join(seat(id)));
    lobby.update(0);
    lobby.enterRound('x');

    expect(lobby.finishRound('x', 1_000)).toEqual({
      winnerId: 'x',
      streak: 1,
      stays: true,
    });
    const start = lobby.update(1_000 + RULES.resultsMs);

    expect(start?.players.map((s) => s.id)).toEqual(['x', 'y', 'a', 'b', 'c']);
  });

  describe('leaving after the round', () => {
    const started = (rules: RoomRules = RULES) => {
      const lobby = new Lobby(rules);
      ['a', 'b', 'c'].forEach((id) => lobby.join(seat(id)));
      lobby.update(0);
      lobby.update(RULES.countdownMs);
      return lobby;
    };
    const queue = (lobby: Lobby) => lobby.snapshot(0).queue.map((s) => s.id);

    it('plays the round out, then is not put back in line', () => {
      const lobby = started();

      expect(lobby.leaveAfterRound('b', true)).toBe(true);
      expect(lobby.isPlaying('b')).toBe(true);
      expect(lobby.snapshot(0).leavingAfter).toEqual(['b']);
      lobby.finishRound('a', 20_000, ['a', 'c', 'b']);
      lobby.update(20_000 + RULES.resultsMs, false);

      expect(queue(lobby)).toEqual(['a', 'c']);
      expect(lobby.snapshot(0).leavingAfter).toEqual([]);
    });

    it('can change their mind, during the round or its results', () => {
      const lobby = started();
      lobby.leaveAfterRound('b', true);
      lobby.finishRound('a', 20_000, ['a', 'b', 'c']);

      expect(lobby.leaveAfterRound('b', false)).toBe(true);
      lobby.update(20_000 + RULES.resultsMs, false);

      expect(queue(lobby)).toEqual(['a', 'b', 'c']);
    });

    it("gives a winner's seat up", () => {
      const lobby = started({ ...RULES, winnerStays: 5 });
      lobby.leaveAfterRound('a', true);

      expect(lobby.finishRound('a', 20_000)?.stays).toBe(false);
      expect(lobby.champion).toBeNull();
    });

    it('only takes players of the round, and only while it is on', () => {
      const lobby = started();
      lobby.join(seat('z'));

      expect(lobby.leaveAfterRound('z', true)).toBe(false);
      expect(new Lobby(RULES).leaveAfterRound('a', true)).toBe(false);
    });
  });

  describe('with bots', () => {
    const BOTS: RoomRules = { ...RULES, bots: 5 };
    const ids = (seats: Seat[] | undefined) => seats?.map((s) => s.id);

    it('plays five bots by themselves while someone watches', () => {
      const lobby = new Lobby(BOTS);

      lobby.update(0);
      expect(lobby.phase).toBe('countdown');
      const start = lobby.update(RULES.countdownMs);

      expect(ids(start?.players)).toEqual([1, 2, 3, 4, 5].map(botId));
      expect(start?.players.every((s) => s.bot)).toBe(true);
      expect(lobby.people()).toEqual([]);
    });

    it('stays empty with nobody watching, and stops the countdown when the last one goes', () => {
      const lobby = new Lobby(BOTS);
      expect(lobby.update(0, false)).toBeNull();
      expect(lobby.phase).toBe('waiting');

      lobby.update(0);
      expect(lobby.update(1_000, false)).toBeNull();
      expect(lobby.phase).toBe('waiting');
    });

    it('starts with one person and fills the other seats with bots', () => {
      const lobby = new Lobby(BOTS);
      lobby.join(seat('a'));
      lobby.join(seat('b'));
      lobby.update(0);

      const start = lobby.update(RULES.countdownMs);

      expect(ids(start?.players)).toEqual(['a', 'b', 'cpu1', 'cpu2', 'cpu3']);
      expect(ids(lobby.people())).toEqual(['a', 'b']);
      // Nobody else in the round looks like the people.
      const bots = start?.players.filter((s) => s.bot) ?? [];
      expect(bots.map((s) => s.characterId)).not.toContain('faisca');
    });

    it('names the bots after people, never twice nor like a person in the round', () => {
      const lobby = new Lobby(BOTS, () => 0);
      lobby.join({ ...seat('a'), name: 'ana' });
      lobby.update(0);

      const names = lobby.update(RULES.countdownMs)?.players.map((s) => s.name);

      expect(names).toEqual(['ana', ...BOT_NAMES.slice(1, 5)]);
    });

    it('counts the people for the countdown, not the bots', () => {
      const lobby = new Lobby({ ...BOTS, minPlayers: 3 });
      lobby.join(seat('a'));

      lobby.update(0, false);

      expect(lobby.phase).toBe('countdown');
    });

    it('fills only as many seats as the rule allows', () => {
      const lobby = new Lobby({ ...BOTS, bots: 2 });
      lobby.join(seat('a'));
      lobby.update(0);

      const start = lobby.update(RULES.countdownMs);

      expect(ids(start?.players)).toEqual(['a', 'cpu1', 'cpu2']);
    });

    it('fills a round of people up to `botsFillTo`: two bots for one, one for two, none for three', () => {
      const FILL: RoomRules = { ...BOTS, botsFillTo: 3 };
      const round = (...people: string[]) => {
        const lobby = new Lobby(FILL);
        people.forEach((id) => lobby.join(seat(id)));
        lobby.update(0);
        return ids(lobby.update(RULES.countdownMs)?.players);
      };

      expect(round()).toEqual([1, 2, 3, 4, 5].map(botId));
      expect(round('a')).toEqual(['a', 'cpu1', 'cpu2']);
      expect(round('a', 'b')).toEqual(['a', 'b', 'cpu1']);
      expect(round('a', 'b', 'c')).toEqual(['a', 'b', 'c']);
    });

    it('with `botsFillTo` off, plays bots only in an empty room', () => {
      const lobby = new Lobby({ ...BOTS, botsFillTo: 0 });
      lobby.join(seat('a'));

      lobby.update(0);

      expect(lobby.phase).toBe('waiting');
      lobby.join(seat('b'));
      lobby.update(0);
      expect(ids(lobby.update(RULES.countdownMs)?.players)).toEqual(['a', 'b']);
    });

    it('ends a round of bots alone when someone queues, and counts down to theirs', () => {
      const lobby = new Lobby({ ...BOTS, botsFillTo: 3 });
      lobby.update(0);
      lobby.update(RULES.countdownMs);
      expect(lobby.phase).toBe('playing');

      lobby.join(seat('a'));
      lobby.update(20_000);

      expect(lobby.phase).toBe('countdown');
      expect(lobby.snapshot(20_000).players).toEqual([]);
      const start = lobby.update(20_000 + RULES.countdownMs);
      expect(ids(start?.players)).toEqual(['a', 'cpu1', 'cpu2']);
    });

    it('lets a round with people in it run its course when more queue', () => {
      const lobby = new Lobby(BOTS);
      lobby.join(seat('a'));
      lobby.update(0);
      lobby.update(RULES.countdownMs);
      lobby.join(seat('b'));

      lobby.update(20_000);

      expect(lobby.phase).toBe('playing');
      expect(ids(lobby.outsiders())).toEqual(['b']);
      expect(lobby.enterRound('b')).toBe(true);
      expect(ids(lobby.people())).toEqual(['a', 'b']);
    });

    it('never puts a bot in the queue, nor keeps its seat after a win', () => {
      const lobby = new Lobby({ ...BOTS, winnerStays: 5 });
      lobby.join(seat('a'));
      lobby.update(0);
      lobby.update(RULES.countdownMs);

      expect(lobby.finishRound('cpu1', 20_000)).toEqual({
        winnerId: 'cpu1',
        streak: 1,
        stays: false,
      });
      expect(lobby.champion).toBeNull();
      lobby.update(20_000 + RULES.resultsMs, false);

      expect(ids(lobby.snapshot(0).queue)).toEqual(['a']);
    });

    it('tells a bot id from an account id', () => {
      expect(isBotId(botId(3))).toBe(true);
      expect(isBotId('kq1Zr8cpu1')).toBe(false);
    });
  });
});
