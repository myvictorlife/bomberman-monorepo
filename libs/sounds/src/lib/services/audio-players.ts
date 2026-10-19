import { InjectionToken } from '@angular/core';
import { Music, Sfx, Voice } from '@libs/game-client';

/** The three players the gallery drives: the theme, the effects, the announcer. */
export interface AudioPlayers {
  music: Music;
  sfx: Sfx;
  voice: Voice;
}

/**
 * Made once per visit to the gallery (provided on the route). A token so unit
 * tests can swap in fakes — the real ones need Web Audio and speech the test
 * DOM lacks.
 */
export const AUDIO_PLAYERS = new InjectionToken<AudioPlayers>('AUDIO_PLAYERS', {
  factory: () => ({ music: new Music(), sfx: new Sfx(), voice: new Voice() }),
});
