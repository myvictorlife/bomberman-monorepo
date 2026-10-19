import { createRemoteJWKSet, JWTVerifyGetKey, jwtVerify } from 'jose';

/** Who a valid Firebase ID token says the caller is. */
export interface VerifiedAccount {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export type TokenVerifier = (token: string) => Promise<VerifiedAccount>;

/** Google's public keys for Firebase ID tokens. Fetched and cached by `jose`. */
const FIREBASE_JWKS = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
);

const MAX_NAME = 20;

/**
 * Checks a Firebase ID token the way the Admin SDK does — signature, issuer,
 * audience, expiry — with nothing but the project id. No service account: the
 * server never holds a credential to verify a sign-in.
 */
export function firebaseTokenVerifier(
  projectId: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(FIREBASE_JWKS),
): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('Token has no subject.');

    const email = typeof payload['email'] === 'string' ? payload['email'] : '';
    const display =
      typeof payload['name'] === 'string' ? payload['name'].trim() : '';
    return {
      id: payload.sub,
      email,
      name: (display || email.split('@')[0] || 'Jogador').slice(0, MAX_NAME),
      emailVerified: payload['email_verified'] === true,
    };
  };
}
