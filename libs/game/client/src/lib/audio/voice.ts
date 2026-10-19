import { QuipMoment, QUIPS } from './quips';

type Synth = Pick<SpeechSynthesis, 'speak' | 'cancel' | 'getVoices'>;

/** Where the chosen voice's name is kept between visits. */
export const VOICE_STORAGE_KEY = 'detona-voice';

/** Apple's character voices: fun once, wrong for an announcer. Listed last. */
const NOVELTY =
  /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bells|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|bad news|good news|bahh|boing)\b/i;
/** The natural Brazilian voices browsers ship, best first. */
const PREFERRED =
  /luciana|francisca|camila|thiago|antonio|vitoria|vitória|google português do brasil|microsoft/i;

/**
 * The Portuguese voices this browser has, best first: Brazilian before
 * European, natural before novelty, the well-known names at the top.
 */
export function portugueseVoices(
  synth: Synth | null = defaultSynth(),
): SpeechSynthesisVoice[] {
  if (!synth) return [];
  const lang = (v: SpeechSynthesisVoice) =>
    v.lang.replace('_', '-').toLowerCase();
  const rank = (v: SpeechSynthesisVoice) =>
    (lang(v).startsWith('pt-br') ? 0 : 10) +
    (NOVELTY.test(v.name) ? 5 : 0) +
    (PREFERRED.test(v.name) ? 0 : 2);
  return synth
    .getVoices()
    .filter((v) => lang(v).startsWith('pt'))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

function defaultSynth(): Synth | null {
  return typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
}

/** A short, cheerful announcer for the browser's speech voice. */
export interface VoiceOptions {
  /** Seconds between two lines; a line asked for sooner is dropped. */
  cooldownS?: number;
  /** Chance a broken crate gets a line — most should pass in silence. */
  blockChance?: number;
  random?: () => number;
  now?: () => number;
  /** `speechSynthesis` (or a stand-in for tests); `null` keeps the voice silent. */
  synth?: Synth | null;
  /** The voice to use, by name; defaults to the one saved in this browser, else the best Portuguese one. */
  voiceName?: string | null;
}

/**
 * The announcer: says one of the lines in `quips.ts` at the game's moments,
 * through the browser's own speech synthesis in Brazilian Portuguese. No
 * recordings, nothing to license. Lines never pile up: one at a time, with
 * a cooldown, and only a few crates out of many get a comment.
 */
export class Voice {
  muted = false;
  private readonly cooldownS: number;
  private readonly blockChance: number;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly synth: Synth | null;
  private voiceName: string | null;
  private lastAt = -Infinity;
  private lastLine = '';

  constructor(options: VoiceOptions = {}) {
    this.cooldownS = options.cooldownS ?? 2.5;
    this.blockChance = options.blockChance ?? 0.18;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => performance.now() / 1000);
    this.synth = options.synth !== undefined ? options.synth : defaultSynth();
    this.voiceName =
      options.voiceName !== undefined ? options.voiceName : readVoiceName();
  }

  /** The voices to choose from, best first. */
  available(): SpeechSynthesisVoice[] {
    return portugueseVoices(this.synth);
  }

  /** The voice in use: the chosen one when the browser has it, else the best available. */
  current(): SpeechSynthesisVoice | null {
    const voices = this.available();
    return voices.find((v) => v.name === this.voiceName) ?? voices[0] ?? null;
  }

  /** Picks a voice by name for this and later visits; `null` goes back to the best one. */
  choose(name: string | null): void {
    this.voiceName = name;
    try {
      if (name) localStorage.setItem(VOICE_STORAGE_KEY, name);
      else localStorage.removeItem(VOICE_STORAGE_KEY);
    } catch {
      // Private mode or a full store: the choice lasts for this page only.
    }
  }

  /** Says a line for `moment`, unless muted, too soon, or (for crates) not this time. */
  say(moment: QuipMoment): boolean {
    if (this.muted || !this.synth) return false;
    if (moment === 'block' && this.random() >= this.blockChance) return false;
    const t = this.now();
    if (t - this.lastAt < this.cooldownS) return false;

    const lines = QUIPS[moment];
    let line =
      lines[Math.floor(this.random() * lines.length)] ?? lines[0] ?? '';
    // Not the same line twice in a row, when there is a choice.
    if (line === this.lastLine && lines.length > 1)
      line = lines[(lines.indexOf(line) + 1) % lines.length] ?? line;

    this.speak(line);
    this.lastAt = t;
    this.lastLine = line;
    return true;
  }

  /** Says exactly `line`, now, in the announcer's voice — for the audio gallery. */
  speak(line: string): boolean {
    if (!this.synth) return false;
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.15;
    utterance.pitch = 1.1;
    const voice = this.current();
    if (voice) utterance.voice = voice;
    this.synth.cancel();
    this.synth.speak(utterance);
    return true;
  }

  close(): void {
    this.synth?.cancel();
  }
}

function readVoiceName(): string | null {
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}
