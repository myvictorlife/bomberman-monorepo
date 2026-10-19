import { notesAt } from './music';
import {
  BASS,
  CHORDS,
  COUNTER,
  DRUMS,
  frequencyOf,
  LEAD,
  midiOf,
  parseScore,
  STEPS_PER_BAR,
  TOTAL_STEPS,
} from './score';

describe('score', () => {
  it('reads note names, sharps and flats', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
    expect(() => midiOf('H2')).toThrow();
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(57)).toBeCloseTo(220);
  });

  it('turns bars of tokens into notes with lengths', () => {
    const notes = parseScore(['C4 . . - E4 - - - - - - - - - - G4']);

    expect(notes).toEqual([
      { step: 0, midi: 60, steps: 3 },
      { step: 4, midi: 64, steps: 1 },
      { step: 15, midi: 67, steps: 1 },
    ]);
    expect(() => parseScore(['C4 . .'])).toThrow(/Bar 1/);
  });

  it('writes every part over the same eight bars', () => {
    for (const part of [LEAD, COUNTER, BASS]) {
      for (const note of part) {
        expect(note.step + note.steps).toBeLessThanOrEqual(TOTAL_STEPS);
        expect(note.midi).toBeGreaterThan(30);
        expect(note.midi).toBeLessThan(100);
      }
    }
    expect(CHORDS).toHaveLength(TOTAL_STEPS / STEPS_PER_BAR);
    expect(DRUMS).toHaveLength(STEPS_PER_BAR);
    expect(DRUMS[0]).toContain('kick');
    expect(DRUMS[4]).toContain('snare');
    expect(DRUMS[14]).toContain('hat-open');
    expect(DRUMS[1]).toEqual([]);
  });

  it('finds the notes that start on a step', () => {
    expect(notesAt(LEAD, 0).map((n) => n.midi)).toEqual([72]);
    expect(notesAt(LEAD, 1)).toEqual([]);
  });
});
