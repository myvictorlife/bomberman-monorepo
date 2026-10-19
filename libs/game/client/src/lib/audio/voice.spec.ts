import { itemMoments, mountMoment, powerUpMoment, QUIPS } from './quips';
import { portugueseVoices, Voice, VOICE_STORAGE_KEY } from './voice';

class FakeSynth {
  readonly spoken: SpeechSynthesisUtterance[] = [];
  cancelled = 0;
  speak(u: SpeechSynthesisUtterance): void {
    this.spoken.push(u);
  }
  cancel(): void {
    this.cancelled++;
  }
  getVoices(): SpeechSynthesisVoice[] {
    return [
      { lang: 'pt-BR', name: 'Eddy (Portuguese (Brazil))' },
      { lang: 'pt-PT', name: 'Joana' },
      { lang: 'pt_BR', name: 'Luciana' },
      { lang: 'pt-BR', name: 'Reed (Portuguese (Brazil))' },
      { lang: 'en-US', name: 'Alex' },
    ] as SpeechSynthesisVoice[];
  }
}

describe('quips', () => {
  it('has lines for every moment, in Portuguese and short', () => {
    for (const lines of Object.values(QUIPS)) {
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.length).toBeLessThan(40);
    }
    expect(powerUpMoment('fire')).toBe('power-fire');
    expect(powerUpMoment('vest')).toBe('power-vest');
    expect(powerUpMoment('egg')).toBeNull();
    expect(mountMoment('pato')).toBe('mount-pato');
    expect(itemMoments('egg')).toHaveLength(6);
    expect(itemMoments('speed')).toEqual(['power-speed']);
    expect(itemMoments('bomb')).toEqual(['power-bomb']);
  });
});

describe('Voice', () => {
  let synth: FakeSynth;
  let clock: number;
  let dice: number;
  const voice = () =>
    new Voice({
      synth,
      now: () => clock,
      random: () => dice,
      cooldownS: 2,
      blockChance: 0.2,
    });

  beforeEach(() => {
    localStorage.clear();
    synth = new FakeSynth();
    clock = 0;
    dice = 0;
    globalThis.SpeechSynthesisUtterance ??= class {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: SpeechSynthesisVoice | null = null;
      constructor(text: string) {
        this.text = text;
      }
    } as unknown as typeof SpeechSynthesisUtterance;
  });

  it('ranks the voices: Brazilian and natural first, novelty last, no English', () => {
    expect(portugueseVoices(synth).map((v) => v.name)).toEqual([
      'Luciana',
      'Eddy (Portuguese (Brazil))',
      'Reed (Portuguese (Brazil))',
      'Joana',
    ]);
    expect(portugueseVoices(null)).toEqual([]);
    // With no `speechSynthesis` in this test DOM, the default is silence.
    expect(portugueseVoices()).toEqual([]);
    expect(new Voice().say('win')).toBe(false);
  });

  it('survives a browser that refuses storage', () => {
    const broken = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const v = new Voice({ synth });
    expect(v.current()?.name).toBe('Luciana');
    v.choose('Joana');
    expect(v.current()?.name).toBe('Joana');
    broken.mockRestore();
    setItem.mockRestore();
  });

  it('uses the chosen voice when the browser has it, remembering it for later', () => {
    const v = voice();
    v.choose('Joana');
    expect(v.current()?.name).toBe('Joana');
    expect(localStorage.getItem(VOICE_STORAGE_KEY)).toBe('Joana');

    expect(new Voice({ synth }).current()?.name).toBe('Joana');

    v.choose('Nobody');
    expect(v.current()?.name).toBe('Luciana');
    v.choose(null);
    expect(localStorage.getItem(VOICE_STORAGE_KEY)).toBeNull();
  });

  it('speaks a line in Brazilian Portuguese with the pt-BR voice', () => {
    expect(voice().say('win')).toBe(true);

    const said = synth.spoken[0] as SpeechSynthesisUtterance;
    expect(QUIPS.win).toContain(said.text);
    expect(said.lang).toBe('pt-BR');
    expect(said.voice?.name).toBe('Luciana');
  });

  it('waits out the cooldown and never repeats the same line twice running', () => {
    const v = voice();
    expect(v.say('died')).toBe(true);
    expect(v.say('died')).toBe(false);
    clock = 3;
    expect(v.say('died')).toBe(true);

    const [a, b] = synth.spoken.map((u) => u.text);
    expect(a).not.toBe(b);
  });

  it('comments on only some crates, and on none when muted or voiceless', () => {
    const v = voice();
    dice = 0.9;
    expect(v.say('block')).toBe(false);
    dice = 0.1;
    expect(v.say('block')).toBe(true);

    v.muted = true;
    clock = 10;
    expect(v.say('win')).toBe(false);

    const silent = new Voice({ synth: null });
    expect(silent.say('win')).toBe(false);
    silent.close();
  });

  it('stops talking when closed, and cuts a running line before a new one', () => {
    const v = voice();
    v.speak('Olá');
    expect(synth.cancelled).toBe(1);
    v.close();
    expect(synth.cancelled).toBe(2);
  });
});
