import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BARS,
  BPM,
  QuipMoment,
  QUIPS,
  SOUND_EFFECTS,
  SoundEffect,
} from '@libs/game-client';
import {
  ButtonComponent,
  ShowcaseComponent,
  ShowcaseNoteComponent,
  ShowcaseSectionComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { SoundsStore } from '../../+state/sounds.store';
import { AUDIO_PLAYERS } from '../../services/audio-players';

/** The announcer's moments, grouped as the gallery lists them. */
export const QUIP_MOMENTS: readonly QuipMoment[] = [
  'block',
  'power-bomb',
  'power-fire',
  'power-speed',
  'power-pierce',
  'power-remote',
  'power-vest',
  'power-glove',
  'power-kick',
  'hurry',
  'grab',
  'mount-tatu',
  'mount-pato',
  'mount-bernardo',
  'mount-capivara',
  'mount-galinha',
  'mount-lost',
  'died',
  'win',
  'draw',
];

/**
 * The audio gallery: the arena theme, every sound effect and every line the
 * announcer can say — each a button, played with the game's own synthesis
 * and the browser's speech voice. Everything stops when the page is left.
 */
@Component({
  selector: 'lib-sounds',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    ShowcaseComponent,
    ShowcaseSectionComponent,
    ShowcaseNoteComponent,
  ],
  templateUrl: './sounds.html',
  styleUrls: ['./sounds.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sounds {
  private readonly store = inject(SoundsStore);
  private readonly players = inject(AUDIO_PLAYERS);

  readonly themePlaying = this.store.themePlaying;
  readonly lastPlayed = this.store.lastPlayed;
  readonly theme = { bpm: BPM, bars: BARS };
  readonly effects = SOUND_EFFECTS;
  readonly moments = QUIP_MOMENTS;
  readonly quips = QUIPS;
  /** The Portuguese voices this browser offers, best first; browsers load them late. */
  readonly voices = signal<{ name: string; lang: string }[]>([]);
  readonly voiceName = this.store.voiceName;

  constructor() {
    this.refreshVoices();
    const synth =
      typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
    const refresh = () => this.refreshVoices();
    synth?.addEventListener('voiceschanged', refresh);
    inject(DestroyRef).onDestroy(() => {
      synth?.removeEventListener('voiceschanged', refresh);
      this.players.music.close();
      this.players.voice.close();
      this.players.sfx.close();
    });
  }

  chooseVoice(name: string): void {
    this.players.voice.choose(name || null);
    this.refreshVoices();
    this.players.voice.speak(QUIPS.win[0] as string);
    this.store.notePlayed(this.store.voiceName() ?? 'voice');
  }

  private refreshVoices(): void {
    this.voices.set(
      this.players.voice
        .available()
        .map((v) => ({ name: v.name, lang: v.lang })),
    );
    this.store.setVoiceName(this.players.voice.current()?.name ?? null);
  }

  toggleTheme(): void {
    const on = !this.store.themePlaying();
    if (on) this.players.music.start();
    else this.players.music.stop();
    this.store.setThemePlaying(on);
    this.store.notePlayed(on ? 'theme' : 'theme-stopped');
  }

  playEffect(effect: SoundEffect): void {
    this.players.sfx.play(effect);
    this.store.notePlayed(effect);
  }

  say(line: string): void {
    this.players.voice.speak(line);
    this.store.notePlayed(line);
  }

  effectKey(effect: SoundEffect): string {
    return `SOUNDS.EFFECT_${effect.toUpperCase().replace(/-/g, '_')}`;
  }

  momentKey(moment: QuipMoment): string {
    return `SOUNDS.MOMENT_${moment.toUpperCase().replace(/-/g, '_')}`;
  }
}
