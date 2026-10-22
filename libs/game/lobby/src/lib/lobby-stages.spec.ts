import { CampaignProgress, START_KIT } from '@libs/game-core';
import { Seat, STAGES_ROOM_RULES } from '@libs/game-protocol';
import { Lobby, STAGE_CONTINUE_MS } from './lobby';
import {
  areaStart,
  currentStage,
  mergeProgress,
  nextStageFor,
  progressAfterStage,
  stageAfter,
  stageChoices,
} from './stage-run';

const seat = (id: string): Seat => ({
  id,
  name: id.toUpperCase(),
  characterId: 'faisca',
});
const cleared = (...ids: string[]): CampaignProgress => ({ cleared: ids });
const outcome = (maxBombs = 1) => ({
  kit: { ...START_KIT, maxBombs },
  tally: { score: 100, livesGained: 0 },
});

describe('stage-run', () => {
  it('offers the stages a player has open, and puts them at the first open one', () => {
    expect(stageChoices(cleared())).toEqual(['gramado-1']);
    expect(stageChoices(cleared('gramado-1'))).toEqual([
      'gramado-1',
      'gramado-2',
    ]);
    expect(currentStage(cleared())).toBe('gramado-1');
    expect(currentStage(cleared('gramado-1', 'gramado-2'))).toBe(
      stageAfter('gramado-2'),
    );
  });

  it('goes on after a clear the host has open, repeats after a loss, starts over after a game over', () => {
    const host = cleared('gramado-1');
    expect(nextStageFor(host, 'gramado-1', 'cleared', false)).toBe('gramado-2');
    expect(nextStageFor(cleared(), 'gramado-1', 'cleared', false)).toBe(
      'gramado-1',
    );
    expect(nextStageFor(host, 'gramado-2', 'failed', false)).toBe('gramado-2');
    expect(nextStageFor(host, 'gramado-2', 'failed', true)).toBe(
      areaStart('gramado-2'),
    );
    expect(stageAfter('nowhere')).toBeNull();
  });

  it('counts a clear for the player, kit and points; a loss costs a life', () => {
    const won = progressAfterStage(
      undefined,
      'gramado-1',
      'cleared',
      outcome(3),
    );
    expect(won.progress.cleared).toEqual(['gramado-1']);
    expect(won.progress.kit?.maxBombs).toBe(3);
    expect(won.progress.score).toBe(100);

    const lost = progressAfterStage(
      won.progress,
      'gramado-2',
      'failed',
      outcome(),
    );
    expect(lost.gameOver).toBe(false);
    expect(lost.progress.lives).toBe(2);
    expect(lost.progress.kit).toBeUndefined();
  });
});

describe('Lobby, stages room', () => {
  const lobbyWith = (...entries: [string, CampaignProgress?][]) => {
    const lobby = new Lobby(STAGES_ROOM_RULES);
    for (const [id, progress] of entries) lobby.join(seat(id), progress);
    return lobby;
  };

  it('starts the countdown with one person, who hosts and plays where they are', () => {
    const lobby = lobbyWith(['a', cleared('gramado-1')]);
    lobby.update(0);

    expect(lobby.phase).toBe('countdown');
    expect(lobby.hostId()).toBe('a');
    const stage = lobby.snapshot(0).stage;
    expect(stage?.id).toBe('gramado-2');
    expect(stage?.choices).toEqual(['gramado-1', 'gramado-2']);
    expect(stage?.progress['a']?.cleared).toEqual(['gramado-1']);
  });

  it('lets only the host pick a stage, and only one they have open', () => {
    const lobby = lobbyWith(['a', cleared('gramado-1')], ['b']);

    expect(lobby.pickStage('b', 'gramado-1')).toBe('not-host');
    expect(lobby.pickStage('a', 'gramado-4')).toBe('stage-locked');
    expect(lobby.pickStage('a', 'gramado-1')).toBe('ok');
    expect(lobby.stageId()).toBe('gramado-1');
  });

  it('starts at once when the host says so, with whoever is in line, on the picked stage', () => {
    const lobby = lobbyWith(['a'], ['b']);
    lobby.update(0);

    expect(lobby.startNow('b', 1_000)).toBe('not-host');
    expect(lobby.startNow('a', 1_000)).toBe('ok');
    const start = lobby.update(1_000);

    expect(start?.players.map((s) => s.id)).toEqual(['a', 'b']);
    expect(start?.stageId).toBe('gramado-1');
    expect(lobby.startNow('a', 2_000)).toBe('not-host');
  });

  it('never fills seats with bots and seats four at most', () => {
    const lobby = lobbyWith(['a'], ['b'], ['c'], ['d'], ['e']);
    const start = lobby.update(0);

    expect(start?.players.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(lobby.snapshot(0).queue.map((s) => s.id)).toEqual(['e']);
  });

  it('after a cleared stage keeps the team first in line and goes on to the next stage soon', () => {
    const lobby = lobbyWith(['a'], ['b']);
    lobby.startNow('a', 0);
    lobby.update(0);
    lobby.join(seat('c'));

    const changed = lobby.finishStage(
      'cleared',
      { a: outcome(2), b: outcome() },
      10,
    );

    expect([...changed.keys()]).toEqual(['a', 'b']);
    expect(lobby.phase).toBe('results');
    expect(lobby.snapshot(10).winnerId).toBeNull();
    expect(lobby.stageId()).toBe('gramado-2');

    const resultsEnd = 10 + STAGES_ROOM_RULES.resultsMs;
    lobby.update(resultsEnd);
    const snapshot = lobby.snapshot(resultsEnd);
    expect(snapshot.queue.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(snapshot.phase).toBe('countdown');
    expect(snapshot.countdownEndsAt).toBe(resultsEnd + STAGE_CONTINUE_MS);
    expect(lobby.progressOf('a')?.kit?.maxBombs).toBe(2);
  });

  it('repeats a lost stage, and the host leaving hands the pick to the next in line', () => {
    const lobby = lobbyWith(['a', cleared('gramado-1')], ['b']);
    lobby.startNow('a', 0);
    const start = lobby.update(0);
    expect(start?.stageId).toBe('gramado-2');

    // The host drops mid-stage: the stage played stays the one that started.
    lobby.leave('a');
    expect(lobby.snapshot(1).stage?.id).toBe('gramado-2');
    lobby.finishStage('failed', { b: outcome() }, 5);

    expect(lobby.progressOf('b')?.lives).toBe(2);
    lobby.update(5 + STAGES_ROOM_RULES.resultsMs);
    expect(lobby.hostId()).toBe('b');
    expect(lobby.progressOf('a')).toBeUndefined();
    // b has nothing open past the first stage.
    expect(lobby.stageId()).toBe('gramado-1');
  });

  it('refuses the host tools in a versus room', () => {
    const lobby = new Lobby({ ...STAGES_ROOM_RULES, mode: 'versus' });
    lobby.join(seat('a'));

    expect(lobby.pickStage('a', 'gramado-1')).toBe('not-host');
    expect(lobby.startNow('a', 0)).toBe('not-host');
    expect(lobby.snapshot(0).stage).toBeNull();
    expect(lobby.finishStage('cleared', {}, 0).size).toBe(0);
  });
});

describe('Lobby, stages room, a new host', () => {
  it('starts from where the new host is, not from the last pick', () => {
    const lobby = new Lobby(STAGES_ROOM_RULES);
    // Asked with nobody in line: the first stage.
    expect(lobby.stageId()).toBe('gramado-1');
    lobby.join(seat('a'), cleared('gramado-1'));

    expect(lobby.stageId()).toBe('gramado-2');
  });
});

describe('mergeProgress', () => {
  it('keeps the record and adds the stages the browser cleared alone', () => {
    expect(
      mergeProgress(
        { cleared: ['gramado-1'], lives: 2 },
        { cleared: ['gramado-1', 'gramado-2'], lives: 3 },
      ),
    ).toEqual({ cleared: ['gramado-1', 'gramado-2'], lives: 2 });
    expect(mergeProgress(undefined, cleared('gramado-1'))).toEqual(
      cleared('gramado-1'),
    );
    expect(mergeProgress(cleared(), undefined)).toEqual(cleared());
  });
});
