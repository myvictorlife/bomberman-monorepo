import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { firebaseTokenVerifier } from './auth';

const PROJECT = 'demo-project';

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const verify = firebaseTokenVerifier(
    PROJECT,
    createLocalJWKSet({ keys: [jwk] }),
  );
  const sign = (
    claims: Record<string, unknown>,
    options: { project?: string; subject?: string | null } = {},
  ) => {
    const project = options.project ?? PROJECT;
    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(`https://securetoken.google.com/${project}`)
      .setAudience(project)
      .setIssuedAt()
      .setExpirationTime('1h');
    if (options.subject !== null) jwt.setSubject(options.subject ?? 'uid-1');
    return jwt.sign(privateKey);
  };
  return { verify, sign };
}

describe('firebaseTokenVerifier', () => {
  it('reads the account from a valid token', async () => {
    const { verify, sign } = await setup();

    await expect(
      verify(
        await sign({ email: 'ana@x.dev', email_verified: true, name: ' Ana ' }),
      ),
    ).resolves.toEqual({
      id: 'uid-1',
      email: 'ana@x.dev',
      name: 'Ana',
      emailVerified: true,
    });
  });

  it('falls back to the e-mail name, then to a generic one, and caps the length', async () => {
    const { verify, sign } = await setup();

    expect((await verify(await sign({ email: 'bia@x.dev' }))).name).toBe('bia');
    expect((await verify(await sign({}))).name).toBe('Jogador');
    expect(
      (await verify(await sign({ name: 'x'.repeat(40) }))).name,
    ).toHaveLength(20);
    expect(
      (await verify(await sign({ email: 'bia@x.dev' }))).emailVerified,
    ).toBe(false);
  });

  it('rejects a token for another project', async () => {
    const { verify, sign } = await setup();

    await expect(
      verify(await sign({}, { project: 'someone-else' })),
    ).rejects.toThrow();
  });

  it('rejects a token without a subject', async () => {
    const { verify, sign } = await setup();

    await expect(verify(await sign({}, { subject: null }))).rejects.toThrow();
  });

  it('rejects garbage', async () => {
    const { verify } = await setup();

    await expect(verify('not-a-jwt')).rejects.toThrow();
  });
});
