import { PlayerRecord } from '@libs/game-lobby';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { TokenVerifier } from './auth';
import { meHandler } from './me';

/** Tokens are `id:name:verified`, as in the room's spec. */
const fakeVerify: TokenVerifier = async (token) => {
  const [id, name, verified] = token.split(':');
  if (!id || token === 'bad') throw new Error('invalid');
  return {
    id,
    name: name ?? id,
    email: `${id}@test.dev`,
    emailVerified: verified === 'yes',
  };
};

function memoryRecords(initial: PlayerRecord[] = []) {
  const map = new Map(initial.map((r) => [r.id, r]));
  const changed: PlayerRecord[] = [];
  return {
    changed,
    get: (id: string) => map.get(id),
    all: () => map,
    put: (r: PlayerRecord) => void map.set(r.id, r),
    putProfile: (r: PlayerRecord) => {
      map.set(r.id, r);
      changed.push(r);
    },
  };
}

/** Sends one request through the handler and waits for the answer. */
async function call(
  handler: ReturnType<typeof meHandler>,
  method: string,
  options: {
    url?: string;
    token?: string;
    body?: string;
    origin?: string;
  } = {},
) {
  const req = Readable.from(
    options.body === undefined ? [] : [Buffer.from(options.body)],
  ) as unknown as IncomingMessage;
  Object.assign(req, {
    method,
    url: options.url ?? '/me',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
    },
  });
  let status = 0;
  let headers: Record<string, string> = {};
  let resolveBody: (body: string) => void = () => undefined;
  const body = new Promise<string>((resolve) => (resolveBody = resolve));
  const res = {
    headersSent: false,
    writeHead: (s: number, h: Record<string, string>) => {
      status = s;
      headers = h;
    },
    end: (chunk?: string) => resolveBody(chunk ?? ''),
  } as unknown as ServerResponse;

  const handled = handler(req, res);
  // Not ours: nothing will ever be written.
  const text = handled ? await body : '';
  return {
    handled,
    status,
    headers,
    json: text ? (JSON.parse(text) as Record<string, unknown>) : null,
  };
}

describe('meHandler', () => {
  it('claims /me only, and only the methods it serves', async () => {
    const handler = meHandler({ verify: fakeVerify, records: memoryRecords() });

    expect((await call(handler, 'GET', { url: '/ranking' })).handled).toBe(
      false,
    );
    expect((await call(handler, 'POST', { token: 'a:A:yes' })).handled).toBe(
      false,
    );
  });

  it('answers the CORS preflight, allowing the bearer token', async () => {
    const handler = meHandler({ verify: fakeVerify, records: memoryRecords() });
    const { status, headers } = await call(handler, 'OPTIONS');

    expect(status).toBe(204);
    expect(headers['Access-Control-Allow-Methods']).toContain('PUT');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('answers only the allowed pages once origins are set', async () => {
    const handler = meHandler({
      verify: fakeVerify,
      records: memoryRecords(),
      allowedOrigins: ['https://game.example'],
    });

    const allowed = await call(handler, 'GET', {
      token: 'a:A:yes',
      origin: 'https://game.example',
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers['Access-Control-Allow-Origin']).toBe(
      'https://game.example',
    );
    expect(
      (
        await call(handler, 'GET', {
          token: 'a:A:yes',
          origin: 'https://x.example',
        })
      ).status,
    ).toBe(403);
    expect((await call(handler, 'GET', { token: 'a:A:yes' })).status).toBe(403);
  });

  it('is unavailable without a Firebase project', async () => {
    const handler = meHandler({ verify: null, records: memoryRecords() });

    expect((await call(handler, 'GET', { token: 'a:A:yes' })).status).toBe(503);
  });

  it('wants a valid bearer token', async () => {
    const handler = meHandler({ verify: fakeVerify, records: memoryRecords() });

    expect(await call(handler, 'GET')).toMatchObject({
      status: 401,
      json: { error: 'auth-required' },
    });
    expect((await call(handler, 'GET', { token: 'bad' })).status).toBe(401);
  });

  it('answers the profile on GET, creating the record on a first visit', async () => {
    const records = memoryRecords();
    const handler = meHandler({ verify: fakeVerify, records, now: () => 5 });
    const { status, headers, json } = await call(handler, 'GET', {
      token: 'u1:Ana:yes',
    });

    expect(status).toBe(200);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(json).toMatchObject({ id: 'u1', name: 'Ana', nameChosen: false });
    expect(records.get('u1')?.firstSeenAt).toBe(5);
  });

  it('saves a change on PUT and tells the room', async () => {
    const records = memoryRecords();
    const handler = meHandler({ verify: fakeVerify, records });
    const { status, json } = await call(handler, 'PUT', {
      token: 'u1:Ana:yes',
      body: JSON.stringify({
        name: 'Dev Cansado',
        favoriteCharacterId: 'tiao',
        color: 'purple',
      }),
    });

    expect(status).toBe(200);
    expect(json).toMatchObject({
      name: 'Dev Cansado',
      nameChosen: true,
      favoriteCharacterId: 'tiao',
      color: 'purple',
    });
    expect(records.changed.map((r) => r.name)).toEqual(['Dev Cansado']);
  });

  it('refuses a bad body, a taken name and an unconfirmed e-mail', async () => {
    const bia: PlayerRecord = {
      id: 'b',
      name: 'Bia',
      wins: 0,
      matches: 0,
      visits: 1,
      firstSeenAt: 0,
      lastSeenAt: 0,
    };
    const records = memoryRecords([bia]);
    const handler = meHandler({ verify: fakeVerify, records });
    const put = (token: string, body: string) =>
      call(handler, 'PUT', { token, body });

    expect(await put('u1:Ana:yes', '{nope')).toMatchObject({
      status: 400,
      json: { error: 'bad-request' },
    });
    expect(await put('u1:Ana:yes', '{"color":"teal"}')).toMatchObject({
      status: 400,
    });
    expect(await put('u1:Ana:yes', '{"name":"BIA"}')).toMatchObject({
      status: 409,
      json: { error: 'name-taken' },
    });
    expect(await put('u1:Ana:no', '{"name":"Ana"}')).toMatchObject({
      status: 403,
      json: { error: 'email-not-verified' },
    });
    expect(
      await put('u1:Ana:yes', JSON.stringify({ name: 'x'.repeat(5000) })),
    ).toMatchObject({ status: 400 });
    expect(records.changed).toEqual([]);
  });
});
