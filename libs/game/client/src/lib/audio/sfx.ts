export type SoundEffect =
  | 'place'
  | 'explode'
  | 'power-up'
  | 'hatch'
  | 'mount-lost'
  | 'ability'
  | 'die'
  | 'round-over'
  | 'mount-tatu'
  | 'mount-pato'
  | 'mount-bernardo'
  | 'mount-capivara'
  | 'mount-galinha'
  | 'throw'
  | 'kick'
  | 'alarm'
  | 'wall'
  | 'tick';

/**
 * Sound effects synthesised with Web Audio — no files to download or license.
 * Placeholder sounds, like the art: a sound pack can replace this class later.
 *
 * The AudioContext is created on the first sound, which always follows a key
 * press, so the browser's autoplay policy is already satisfied.
 */
/** Every effect, in the order the audio gallery lists them. */
export const SOUND_EFFECTS: readonly SoundEffect[] = [
  'place',
  'explode',
  'power-up',
  'hatch',
  'mount-tatu',
  'mount-pato',
  'mount-bernardo',
  'mount-capivara',
  'mount-galinha',
  'mount-lost',
  'ability',
  'die',
  'round-over',
  'throw',
  'kick',
  'alarm',
  'wall',
  'tick',
];

export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  play(effect: SoundEffect, volume = 1): void {
    if (this.muted) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime;
    // A little drift in pitch, so the same sound twice is never quite the same.
    const drift = 1 + (Math.random() - 0.5) * 0.14;
    switch (effect) {
      case 'place':
        this.tone(ctx, 'sine', 220 * drift, 90 * drift, t, 0.09, 0.25 * volume);
        break;
      case 'explode':
        this.boom(ctx, t, Math.min(1, 0.55 * volume), drift);
        break;
      case 'tick':
        // The fuse: a short, dry click.
        this.tone(
          ctx,
          'square',
          1500 * drift,
          900 * drift,
          t,
          0.025,
          0.05 * volume,
        );
        break;
      case 'throw':
        // A rising whoosh: the bomb leaves the hand.
        this.tone(ctx, 'triangle', 260, 760, t, 0.18, 0.12 * volume);
        break;
      case 'alarm':
        // Two-tone siren, twice: the clock ran out.
        [0, 0.36].forEach((d) => {
          this.tone(ctx, 'square', 880, 880, t + d, 0.16, 0.08 * volume);
          this.tone(ctx, 'square', 660, 660, t + d + 0.18, 0.16, 0.08 * volume);
        });
        break;
      case 'wall':
        // A heavy block landing: a low thud.
        this.tone(ctx, 'sine', 120, 45, t, 0.16, 0.3 * volume);
        break;
      case 'kick':
        // A thud, then a short hop up.
        this.tone(
          ctx,
          'square',
          140 * drift,
          70 * drift,
          t,
          0.06,
          0.16 * volume,
        );
        this.tone(ctx, 'sine', 420, 640, t + 0.05, 0.08, 0.08 * volume);
        break;
      case 'power-up':
        [660, 880, 1320].forEach((f, i) =>
          this.tone(ctx, 'square', f, f, t + i * 0.06, 0.06, 0.06),
        );
        break;
      case 'hatch':
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          this.tone(ctx, 'triangle', f, f, t + i * 0.05, 0.08, 0.08),
        );
        break;
      case 'mount-lost':
        this.tone(ctx, 'square', 440, 180, t, 0.25, 0.08);
        break;
      case 'ability':
        this.tone(ctx, 'triangle', 330, 660, t, 0.14, 0.1);
        break;
      case 'mount-tatu':
        // A scratchy dig: two short noisy rasps.
        [0, 0.12].forEach((d) =>
          this.tone(ctx, 'sawtooth', 160, 90, t + d, 0.09, 0.07),
        );
        break;
      case 'mount-pato':
        // Quack, quack: a nasal square that drops at the end.
        [0, 0.16].forEach((d) =>
          this.tone(ctx, 'square', 520, 300, t + d, 0.12, 0.07),
        );
        break;
      case 'mount-bernardo':
        // Woof: a low bark with a quick rise.
        this.tone(ctx, 'sawtooth', 180, 320, t, 0.06, 0.1);
        this.tone(ctx, 'sawtooth', 320, 140, t + 0.06, 0.14, 0.1);
        break;
      case 'mount-capivara':
        // A calm, low grunt — the least impressed animal in the arena.
        this.tone(ctx, 'triangle', 110, 95, t, 0.28, 0.12);
        break;
      case 'mount-galinha':
        // Bok-bok-BAWK, then the crackle: two short clucks, a long one that
        // rises, and the zap of three quick buzzing sweeps.
        [0, 0.1].forEach((d) =>
          this.tone(ctx, 'square', 700, 560, t + d, 0.05, 0.06),
        );
        this.tone(ctx, 'square', 620, 980, t + 0.2, 0.14, 0.07);
        [0.36, 0.42, 0.48].forEach((d, i) =>
          this.tone(ctx, 'sawtooth', 90 + i * 40, 1400, t + d, 0.06, 0.06),
        );
        break;
      case 'die':
        this.tone(ctx, 'sawtooth', 520 * drift, 90 * drift, t, 0.55, 0.12);
        break;
      case 'round-over':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(ctx, 'triangle', f, f, t + i * 0.11, 0.16, 0.15),
        );
        break;
    }
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  private context(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    from: number,
    to: number,
    start: number,
    duration: number,
    volume: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(to, 1),
      start + duration,
    );
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Filtered noise for the blast plus a low sine for the thump. */
  private boom(
    ctx: AudioContext,
    start: number,
    volume: number,
    drift = 1,
  ): void {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.8);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800 * drift, start);
    filter.frequency.exponentialRampToValueAtTime(120 * drift, start + 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
    source.stop(start + 0.8);

    this.tone(ctx, 'sine', 110, 40, start, 0.4, volume * 0.9);
  }
}
