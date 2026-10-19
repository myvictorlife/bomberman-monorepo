import { withNodeSignature } from './connect';

describe('withNodeSignature', () => {
  class Recorder {
    static OPEN = 1;
    readonly args: unknown[];
    constructor(...args: unknown[]) {
      this.args = args;
    }
  }
  const Shim = withNodeSignature(Recorder as unknown as typeof WebSocket);
  const make = (...args: unknown[]) =>
    new (Shim as unknown as new (...a: unknown[]) => Recorder)(...args).args;

  it('turns Node’s options object into the browser’s protocols argument', () => {
    expect(make('ws://x', { headers: {}, protocols: ['a'] })).toEqual([
      'ws://x',
      ['a'],
    ]);
    expect(make('ws://x', { headers: {} })).toEqual(['ws://x', undefined]);
  });

  it('passes the browser forms through', () => {
    expect(make('ws://x', 'a')).toEqual(['ws://x', 'a']);
    expect(make('ws://x', ['a', 'b'])).toEqual(['ws://x', ['a', 'b']]);
    expect(make('ws://x')).toEqual(['ws://x', undefined]);
  });

  it('keeps the static constants', () => {
    expect((Shim as unknown as typeof Recorder).OPEN).toBe(1);
  });
});
