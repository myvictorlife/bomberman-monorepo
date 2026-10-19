import { InjectionToken, Signal, signal } from '@angular/core';

/** The signed-in account, as the rest of the workspace sees it — no vendor type. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  /** `false` until the link in the confirmation e-mail is opened. */
  emailVerified: boolean;
}

/** Accounts from an identity provider, signed in through its own window. */
export type AuthProvider = 'google';

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'too-many-requests'
  | 'network'
  | 'popup-blocked'
  /** The player closed the provider's window: not a failure worth showing. */
  | 'cancelled'
  | 'unavailable'
  | 'unknown';

/** Every failure of an {@link Auth} method, with a code the UI can translate. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

/**
 * E-mail and password accounts with a confirmed address, or an identity
 * provider's account (which arrives already confirmed).
 *
 * Vendor-neutral, like `ANALYTICS`: callers never learn that Firebase is behind
 * it, so replacing the provider is a change to one function in `app.config.ts`.
 */
export interface Auth {
  /** `false` when no provider is configured: the UI hides sign-in instead of failing. */
  readonly available: boolean;
  readonly user: Signal<AuthUser | null>;
  /** `true` once the session saved in the browser has been restored (or there is none). */
  readonly ready: Signal<boolean>;
  /** Loads the SDK and restores the session. Idempotent; resolves even when unavailable. */
  initialize(): Promise<void>;
  /** Creates the account and sends the confirmation e-mail. */
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  /**
   * Signs in, creating the account on first use. Rejects with `cancelled` when
   * the window is closed. An implementation may leave the page for the
   * provider instead (a redirect): the promise then never settles, and a
   * failure comes back through {@link takeRedirectError} once the page is back.
   */
  signInWith(provider: AuthProvider): Promise<void>;
  /** The failure of a sign-in that left the page, once; `null` when there is none. Read it after {@link initialize}. */
  takeRedirectError(): AuthErrorCode | null;
  signOut(): Promise<void>;
  sendVerificationEmail(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Re-reads the account, e.g. after the e-mail was confirmed in another tab. */
  reload(): Promise<void>;
  /** A token a backend can verify; `null` when signed out. */
  idToken(forceRefresh?: boolean): Promise<string | null>;
}

/** No provider: nobody can sign in, and nothing throws until someone tries. */
export class NoopAuth implements Auth {
  readonly available = false;
  readonly user = signal<AuthUser | null>(null).asReadonly();
  readonly ready = signal(true).asReadonly();

  async initialize(): Promise<void> {
    // Intentionally empty.
  }

  signUp(): Promise<void> {
    return Promise.reject(new AuthError('unavailable'));
  }

  signIn(): Promise<void> {
    return Promise.reject(new AuthError('unavailable'));
  }

  signInWith(): Promise<void> {
    return Promise.reject(new AuthError('unavailable'));
  }

  takeRedirectError(): AuthErrorCode | null {
    return null;
  }

  async signOut(): Promise<void> {
    // Nobody is signed in.
  }

  sendVerificationEmail(): Promise<void> {
    return Promise.reject(new AuthError('unavailable'));
  }

  sendPasswordReset(): Promise<void> {
    return Promise.reject(new AuthError('unavailable'));
  }

  async reload(): Promise<void> {
    // Nothing to re-read.
  }

  async idToken(): Promise<string | null> {
    return null;
  }
}

/** Injected by consumers; provided by an implementation library. Defaults to {@link NoopAuth}. */
export const AUTH = new InjectionToken<Auth>('AUTH', {
  providedIn: 'root',
  factory: () => new NoopAuth(),
});
