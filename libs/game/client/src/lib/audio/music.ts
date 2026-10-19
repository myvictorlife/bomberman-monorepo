import {
  BASS,
  BPM,
  CHORDS,
  COUNTER,
  Drum,
  DRUMS,
  frequencyOf,
  LEAD,
  NoteEvent,
  STEPS_PER_BAR,
  TOTAL_STEPS,
} from './score';

const SECONDS_PER_STEP = 60 / BPM / 4;
/** How far ahead notes are queued; the scheduler wakes well within it. */
const LOOKAHEAD_S = 0.15;
const TICK_MS = 50;

/**
 * Plays the arena theme from `score.ts` with Web Audio oscillators — the
 * chiptune voices of the 16-bit era, with nothing to download or license.
 * Scheduling runs a little ahead of the clock, the standard Web Audio way,
 * so a busy frame never makes the beat stutter.
 */
export class Music {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextTime = 0;
  private step = 0;

  /** Overall loudness, 0–1; music sits under the effects. */
  volume = 0.22;

  get playing(): boolean {
    return this.timer !== null;
  }

  /** Starts the loop (resumed on the first key or tap if the browser holds it back). */
  start(): void {
    if (this.playing) return;
    const ctx = this.context();
    if (!ctx) return;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.master && this.ctx) {
      // Fade rather than cut, then drop the voices already queued.
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 0.12);
      const old = this.master;
      setTimeout(() => old.disconnect(), 200);
      this.master = null;
    }
  }

  /**
   * Renders `loops` passes of the theme into an offline context — for a
   * preview file or a test — and resolves with the audio.
   */
  render(ctx: OfflineAudioContext, loops = 1): Promise<AudioBuffer> {
    const out = ctx.createGain();
    out.gain.value = this.volume;
    out.connect(ctx.destination);
    for (let step = 0; step < TOTAL_STEPS * loops; step++) {
      this.playStep(ctx, out, step % TOTAL_STEPS, step * SECONDS_PER_STEP);
    }
    return ctx.startRendering();
  }

  close(): void {
    this.stop();
    if (this.ctx && 'close' in this.ctx)
      void (this.ctx as AudioContext).close();
    this.ctx = null;
  }

  private context(): BaseAudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const resume = () => void ctx.resume();
      for (const type of ['keydown', 'pointerdown']) {
        document.addEventListener(type, resume, { once: true, passive: true });
      }
    }
    if (this.ctx.state === 'suspended' && 'resume' in this.ctx)
      void (this.ctx as AudioContext).resume();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private schedule = (): void => {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(ctx, out, this.step, this.nextTime);
      this.step = (this.step + 1) % TOTAL_STEPS;
      this.nextTime += SECONDS_PER_STEP;
    }
    this.timer = setTimeout(this.schedule, TICK_MS);
  };

  private playStep(
    ctx: BaseAudioContext,
    out: GainNode,
    step: number,
    time: number,
  ): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;

    for (const note of notesAt(LEAD, step)) {
      this.voice(ctx, out, 'square', note, time, 0.11, {
        vibrato: true,
        decay: 0.9,
      });
    }
    for (const note of notesAt(COUNTER, step)) {
      this.voice(ctx, out, 'triangle', note, time, 0.14, { decay: 0.8 });
    }
    for (const note of notesAt(BASS, step)) {
      this.voice(ctx, out, 'triangle', note, time, 0.2, { decay: 0.6 });
    }
    // Chord stabs on the off-beats, short and soft.
    if (inBar % 4 === 2) {
      for (const midi of CHORDS[bar] ?? []) {
        this.voice(ctx, out, 'square', { step, midi, steps: 1 }, time, 0.025, {
          decay: 0.35,
        });
      }
    }
    for (const drum of DRUMS[inBar] ?? []) this.drum(ctx, out, drum, time);
  }

  private voice(
    ctx: BaseAudioContext,
    out: GainNode,
    type: OscillatorType,
    note: NoteEvent,
    time: number,
    volume: number,
    shape: { vibrato?: boolean; decay: number },
  ): void {
    const duration = note.steps * SECONDS_PER_STEP;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequencyOf(note.midi), time);
    if (shape.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = 4;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + duration);
    }
    // A quick attack, a hold, and a release that ends just before the next note.
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
    gain.gain.setValueAtTime(volume, time + duration * shape.decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration - 0.01);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + duration);
  }

  private drum(
    ctx: BaseAudioContext,
    out: GainNode,
    drum: Drum,
    time: number,
  ): void {
    if (drum === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      gain.gain.setValueAtTime(0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
      osc.connect(gain).connect(out);
      osc.start(time);
      osc.stop(time + 0.15);
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const [type, freq, volume, length] =
      drum === 'snare'
        ? (['bandpass', 1800, 0.22, 0.12] as const)
        : drum === 'hat-open'
          ? (['highpass', 7000, 0.07, 0.18] as const)
          : (['highpass', 8000, 0.05, 0.04] as const);
    filter.type = type;
    filter.frequency.value = freq;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    source.connect(filter).connect(gain).connect(out);
    source.start(time);
    source.stop(time + length + 0.02);
  }

  private noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.25);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}

/** The notes of `events` that start on `step`. */
export function notesAt(
  events: readonly NoteEvent[],
  step: number,
): NoteEvent[] {
  return events.filter((e) => e.step === step);
}
