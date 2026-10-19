/**
 * The arena theme, as data: an original 8-bar loop in the spirit of the
 * 16-bit battle games — bouncy, major, a square lead over a jumping bass —
 * written note by note for this game. Sixteen steps per bar.
 */
export const BPM = 152;
export const STEPS_PER_BAR = 16;

/** One sounding note: step index (from 0), MIDI pitch, length in steps. */
export interface NoteEvent {
  step: number;
  midi: number;
  steps: number;
}

const NOTE_NAMES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** `'C5'`, `'F#4'`, `'Bb3'` → MIDI number. */
export function midiOf(name: string): number {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a note: ${name}`);
  const [, letter, accidental, octave] = match;
  const semitone =
    (NOTE_NAMES[letter as string] as number) +
    (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  return 12 * (Number(octave) + 1) + semitone;
}

export function frequencyOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Reads bars written as sixteen tokens each: a note name starts a note, `.`
 * holds the previous one, `-` is a rest. Bars are laid end to end.
 */
export function parseScore(bars: readonly string[]): NoteEvent[] {
  const events: NoteEvent[] = [];
  let open: NoteEvent | null = null;
  bars.forEach((bar, barIndex) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== STEPS_PER_BAR)
      throw new Error(`Bar ${barIndex + 1} has ${tokens.length} steps`);
    tokens.forEach((token, i) => {
      const step = barIndex * STEPS_PER_BAR + i;
      if (token === '.') {
        if (open) open.steps++;
      } else if (token === '-') {
        open = null;
      } else {
        open = { step, midi: midiOf(token), steps: 1 };
        events.push(open);
      }
    });
  });
  return events;
}

/** The square lead: a tune that climbs, turns on itself and lands home. */
export const LEAD = parseScore([
  'C5 . E5 . G5 . E5 . A5 . G5 . E5 . D5 .',
  'C5 . E5 . G5 . A5 . B5 . . . G5 . E5 .',
  'F5 . A5 . C6 . A5 . G5 . E5 . C5 . D5 .',
  'E5 . D5 . C5 . D5 . E5 . . . - - - -',
  'G5 . E5 . C5 . E5 . G5 . A5 . B5 . A5 .',
  'G5 . . . E5 . G5 . C6 . B5 . A5 . G5 .',
  'F5 . E5 . D5 . F5 . A5 . G5 . F5 . E5 .',
  'D5 . C5 . B4 . D5 . C5 . . . - - - -',
]);

/** The answer in the second half: a triangle voice a third below, sparser. */
export const COUNTER = parseScore([
  '- - - - - - - - - - - - - - - -',
  '- - - - - - - - - - - - - - - -',
  '- - - - - - - - - - - - - - - -',
  '- - - - - - - - - - G4 . A4 . B4 .',
  'E5 . . . - - - - E5 . . . - - - -',
  'E5 . . . - - - - G5 . . . - - - -',
  'D5 . . . - - - - F5 . . . - - - -',
  'B4 . . . G4 . . . E4 . . . . . . .',
]);

/** The bass: root on the beat, the octave answering, a fifth to turn the bar. */
export const BASS = parseScore([
  'C3 . - C4 . - C3 . C3 . - C4 . - G3 .',
  'C3 . - C4 . - C3 . C3 . - C4 . - E3 .',
  'F3 . - F4 . - F3 . F3 . - F4 . - C4 .',
  'G3 . - G4 . - G3 . G3 . - G4 . - B3 .',
  'C3 . - C4 . - C3 . C3 . - C4 . - G3 .',
  'A2 . - A3 . - A2 . A2 . - A3 . - E3 .',
  'F3 . - F4 . - F3 . F3 . - F4 . - D3 .',
  'G3 . - G4 . - G3 . G3 . - B3 . - D4 .',
]);

/** Off-beat chord stabs: C, C, F, G, C, Am, F, G — one chord per bar. */
export const CHORDS: readonly (readonly number[])[] = [
  ['E4', 'G4', 'C5'],
  ['E4', 'G4', 'C5'],
  ['F4', 'A4', 'C5'],
  ['G4', 'B4', 'D5'],
  ['E4', 'G4', 'C5'],
  ['E4', 'A4', 'C5'],
  ['F4', 'A4', 'C5'],
  ['G4', 'B4', 'D5'],
].map((chord) => chord.map(midiOf));

export type Drum = 'kick' | 'snare' | 'hat' | 'hat-open';

/** One bar of drums, repeated: the kick pushes, the hat keeps eighths. */
export const DRUMS: readonly (readonly Drum[])[] = Array.from(
  { length: STEPS_PER_BAR },
  (_, step) => {
    const hits: Drum[] = [];
    if (step === 0 || step === 6 || step === 10) hits.push('kick');
    if (step === 4 || step === 12) hits.push('snare');
    if (step % 2 === 0) hits.push(step === 14 ? 'hat-open' : 'hat');
    return hits;
  },
);

export const BARS = 8;
export const TOTAL_STEPS = BARS * STEPS_PER_BAR;
