import { TestBed } from '@angular/core/testing';
import { Music, Sfx, Voice } from '@libs/game-client';
import { AUDIO_PLAYERS } from './audio-players';

describe('AUDIO_PLAYERS', () => {
  it('builds the real players unless a test overrides them', () => {
    const players = TestBed.inject(AUDIO_PLAYERS);

    expect(players.music).toBeInstanceOf(Music);
    expect(players.sfx).toBeInstanceOf(Sfx);
    expect(players.voice).toBeInstanceOf(Voice);
  });
});
