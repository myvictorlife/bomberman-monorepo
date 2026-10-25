import { PlayerRecord } from '@libs/game-lobby';
import { IncomingMessage, ServerResponse } from 'node:http';
import { httpHandler } from './http';

const record = (
  id: string,
  wins: number,
  matches: number,
  characterId?: PlayerRecord['characterId'],
): PlayerRecord => ({
  id,
  name: id.toUpperCase(),
  wins,
  matches,
  visits: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
  characterId,
});

/** Calls the handler with a bare request and reads back what it wrote. */
function call(
  handler: ReturnType<typeof httpHandler>,
  method: string,
  url: string,
  origin?: string,
) {
  let status = 0;
  let headers: Record<string, string> = {};
  let body = '';
  const res = {
    writeHead: (s: number, h: Record<string, string>) => {
      status = s;
      headers = h;
    },
    end: (chunk?: string) => {
      body = chunk ?? '';
    },
  } as unknown as ServerResponse;
  const handled = handler(
    { method, url, headers: origin ? { origin } : {} } as IncomingMessage,
    res,
  );
  return { status, headers, body, handled };
}

describe('httpHandler', () => {
  const handler = httpHandler(() => [
    record('a', 3, 4, 'lia'),
    record('b', 0, 2),
    record('c', 5, 9, 'faisca'),
  ]);

  it('serves the ranking as JSON, open to any origin and cached briefly', () => {
    const { status, headers, body } = call(handler, 'GET', '/ranking?x=1');

    expect(status).toBe(200);
    expect(headers['Content-Type']).toContain('application/json');
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Cache-Control']).toContain('max-age=');
    expect(JSON.parse(body)).toEqual([
      { id: 'c', name: 'C', wins: 5, matches: 9, characterId: 'faisca' },
      { id: 'a', name: 'A', wins: 3, matches: 4, characterId: 'lia' },
    ]);
  });

  it('answers a preflight, a HEAD and the root, and leaves everything else to Colyseus untouched', () => {
    expect(call(handler, 'OPTIONS', '/ranking')).toMatchObject({
      status: 204,
      handled: true,
    });
    const head = call(handler, 'HEAD', '/ranking');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
    expect(call(handler, 'GET', '/')).toMatchObject({
      status: 200,
      handled: true,
    });
    // Nothing written: a second answer on a request Colyseus owns would crash the server.
    expect(call(handler, 'GET', '/nope')).toMatchObject({
      status: 0,
      handled: false,
    });
    expect(call(handler, 'POST', '/ranking')).toMatchObject({
      status: 0,
      handled: false,
    });
    expect(
      call(handler, 'POST', '/matchmake/joinOrCreate/arena'),
    ).toMatchObject({ status: 0, handled: false });
  });

  it('answers /status from the room, and leaves it to Colyseus when there is no room summary', async () => {
    const withStatus = httpHandler(
      () => [],
      async () => ({ online: 3, phase: 'playing', playing: 2, queued: 1 }),
    );
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    expect(
      withStatus({ method: 'GET', url: '/status' } as IncomingMessage, res),
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Cache-Control': 'public, max-age=5' }),
    );
    expect(res.end).toHaveBeenCalledWith(
      JSON.stringify({ online: 3, phase: 'playing', playing: 2, queued: 1 }),
    );

    expect(call(withStatus, 'OPTIONS', '/status').status).toBe(204);
    expect(call(withStatus, 'POST', '/status').handled).toBe(false);
    expect(call(handler, 'GET', '/status').handled).toBe(false);

    const failing = httpHandler(
      () => [],
      async () => {
        throw new Error('down');
      },
    );
    const res2 = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
    failing({ method: 'GET', url: '/status' } as IncomingMessage, res2);
    await new Promise((r) => setTimeout(r, 0));
    expect(res2.writeHead).toHaveBeenCalledWith(503, expect.anything());
  });

  describe('with allowed origins', () => {
    const strict = httpHandler(
      () => [record('a', 1, 1)],
      () => Promise.resolve(null),
      ['https://game.example'],
    );

    it('answers the allowed page, naming it rather than *', () => {
      const { status, headers } = call(
        strict,
        'GET',
        '/ranking',
        'https://game.example',
      );
      expect(status).toBe(200);
      expect(headers['Access-Control-Allow-Origin']).toBe(
        'https://game.example',
      );
      expect(headers['Vary']).toBe('Origin');
    });

    it('turns away another site, and a request from no page at all', () => {
      for (const path of ['/ranking', '/status']) {
        const other = call(strict, 'GET', path, 'https://evil.example');
        expect(other).toMatchObject({ status: 403, handled: true });
        expect(other.headers['Access-Control-Allow-Origin']).toBeUndefined();
        expect(call(strict, 'GET', path).status).toBe(403);
      }
    });

    it('keeps the root open for the health check', () => {
      expect(call(strict, 'GET', '/').status).toBe(200);
    });
  });
});
