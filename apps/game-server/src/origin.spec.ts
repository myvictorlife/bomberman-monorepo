import { corsOrigin, normalizeOrigin, originAllowed } from './origin';

describe('origin', () => {
  const SITE = ['https://game.example'];

  it('normalizes a configured origin, dropping what is not one', () => {
    expect(normalizeOrigin(' HTTPS://Game.Example/ ')).toBe(
      'https://game.example',
    );
    expect(normalizeOrigin('https://game.example/play?x=1')).toBe(
      'https://game.example',
    );
    expect(normalizeOrigin('game.example')).toBeNull();
    expect(normalizeOrigin('null')).toBeNull();
  });

  it('lets every origin in when none is configured', () => {
    expect(originAllowed('https://other.example', [])).toBe(true);
    expect(originAllowed(undefined, [])).toBe(true);
  });

  it('lets only the listed pages in, and this machine for development', () => {
    expect(originAllowed('https://game.example', SITE)).toBe(true);
    expect(originAllowed('http://localhost:4201', SITE)).toBe(true);
    expect(originAllowed('http://127.0.0.1:4200', SITE)).toBe(true);
    expect(originAllowed('http://[::1]:4200', SITE)).toBe(true);
    expect(originAllowed('http://game.example', SITE)).toBe(false);
    expect(originAllowed('https://www.game.example', SITE)).toBe(false);
    expect(originAllowed('https://game.example.evil.test', SITE)).toBe(false);
    expect(originAllowed('null', SITE)).toBe(false);
  });

  it('refuses a request from no page at all once origins are set', () => {
    expect(originAllowed(undefined, SITE)).toBe(false);
    expect(originAllowed(null, SITE)).toBe(false);
    expect(originAllowed('', SITE)).toBe(false);
  });

  it('answers CORS with *, the allowed origin itself, or nothing', () => {
    expect(corsOrigin('https://x.example', [])).toEqual({
      'Access-Control-Allow-Origin': '*',
    });
    expect(corsOrigin('https://game.example', SITE)).toEqual({
      'Access-Control-Allow-Origin': 'https://game.example',
      Vary: 'Origin',
    });
    expect(corsOrigin('https://x.example', SITE)).toBeNull();
    expect(corsOrigin(undefined, SITE)).toBeNull();
  });
});
