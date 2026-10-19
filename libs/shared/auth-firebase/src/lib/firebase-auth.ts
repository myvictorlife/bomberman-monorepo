import { Injectable, signal } from '@angular/core';
import {
  Auth,
  AuthError,
  AuthErrorCode,
  AuthProvider,
  AuthUser,
} from '@libs/auth';
import { environment } from '@libs/environment';
import type { FirebaseApp } from 'firebase/app';
import type { Auth as FirebaseAuthInstance, User } from 'firebase/auth';

type AuthSdk = typeof import('firebase/auth');

/** Set before leaving for the provider, so only a page coming back loads the resolver. */
const REDIRECT_PENDING = 'auth:redirect-pending';

const ERROR_CODES: Record<string, AuthErrorCode> = {
  'auth/invalid-credential': 'invalid-credentials',
  'auth/invalid-login-credentials': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/user-not-found': 'invalid-credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/weak-password': 'weak-password',
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
  'auth/account-exists-with-different-credential': 'email-in-use',
  'auth/popup-blocked': 'popup-blocked',
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  'auth/operation-not-allowed': 'unavailable',
  // Authentication was never switched on in the Firebase console.
  'auth/configuration-not-found': 'unavailable',
  // The page's domain is not in Authentication → Settings → Authorized domains.
  'auth/unauthorized-domain': 'unavailable',
};

/** Firebase's error codes, folded into the vendor-neutral ones. */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const code = (error as { code?: unknown } | null)?.code;
  const known = typeof code === 'string' && ERROR_CODES[code];
  // The UI only says "something went wrong"; the console keeps the cause.
  if (!known) console.warn('[auth] unmapped error', error);
  return new AuthError(known || 'unknown');
}

function toUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    emailVerified: user.emailVerified,
  };
}

/**
 * Firebase Authentication behind the `AUTH` contract. The SDK is imported
 * dynamically on the first {@link initialize}, so it is fetched only by the
 * pages that need an account — never on first paint.
 *
 * With `onAuthStateChanged` the session survives a reload: Firebase keeps it in
 * IndexedDB and restores it before `ready` turns `true`.
 */
@Injectable()
export class FirebaseAuth implements Auth {
  readonly available = environment.authEnabled;
  private readonly userState = signal<AuthUser | null>(null);
  private readonly readyState = signal(!environment.authEnabled);
  readonly user = this.userState.asReadonly();
  readonly ready = this.readyState.asReadonly();

  private redirectError: AuthErrorCode | null = null;
  private sdk: AuthSdk | null = null;
  private auth: FirebaseAuthInstance | null = null;
  private starting: Promise<void> | null = null;

  initialize(): Promise<void> {
    if (!this.available) return Promise.resolve();
    this.starting ??= this.start();
    return this.starting;
  }

  async signUp(
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> {
    const { sdk, auth } = await this.ready$();
    try {
      const { user } = await sdk.createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      await sdk.updateProfile(user, { displayName: displayName.trim() });
      await sdk.sendEmailVerification(user, this.continueUrl());
      this.userState.set(toUser(user));
    } catch (error) {
      throw toAuthError(error);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { sdk, auth } = await this.ready$();
    try {
      const { user } = await sdk.signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      this.userState.set(toUser(user));
    } catch (error) {
      throw toAuthError(error);
    }
  }

  /**
   * On the `authDomain` itself — the site's own domain, as the `firebase-deploy`
   * skill sets it up — the page leaves for the provider and comes back
   * (a redirect), entirely first-party. A popup there loses its result: the
   * provider's page cuts the popup off from its opener, and the hand-back
   * through the auth iframe does not always arrive. Anywhere else (`localhost`
   * in development) a redirect would come back without its result, so a popup
   * it is. The resolver — and the `apis.google.com` script it injects — is
   * passed here only, so e-mail sign-in never loads it (see {@link createAuth}).
   */
  async signInWith(provider: AuthProvider): Promise<void> {
    const { sdk, auth } = await this.ready$();
    const authProvider = this.providerFor(sdk, provider);
    try {
      if (this.onAuthDomain()) {
        sessionStorage.setItem(REDIRECT_PENDING, '1');
        await sdk.signInWithRedirect(
          auth,
          authProvider,
          sdk.browserPopupRedirectResolver,
        );
        return;
      }
      const { user } = await sdk.signInWithPopup(
        auth,
        authProvider,
        sdk.browserPopupRedirectResolver,
      );
      this.userState.set(toUser(user));
    } catch (error) {
      sessionStorage.removeItem(REDIRECT_PENDING);
      throw toAuthError(error);
    }
  }

  takeRedirectError(): AuthErrorCode | null {
    const code = this.redirectError;
    this.redirectError = null;
    return code;
  }

  async signOut(): Promise<void> {
    if (!this.available) return;
    const { sdk, auth } = await this.ready$();
    await sdk.signOut(auth);
    this.userState.set(null);
  }

  async sendVerificationEmail(): Promise<void> {
    const { sdk, auth } = await this.ready$();
    if (!auth.currentUser) throw new AuthError('invalid-credentials');
    try {
      await sdk.sendEmailVerification(auth.currentUser, this.continueUrl());
    } catch (error) {
      throw toAuthError(error);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { sdk, auth } = await this.ready$();
    try {
      await sdk.sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      throw toAuthError(error);
    }
  }

  async reload(): Promise<void> {
    if (!this.available) return;
    const { auth } = await this.ready$();
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    // `reload` mutates the same object; a copy is what makes the signal notify.
    this.userState.set(toUser(auth.currentUser));
  }

  async idToken(forceRefresh = false): Promise<string | null> {
    if (!this.available) return null;
    const { auth } = await this.ready$();
    return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
  }

  private async start(): Promise<void> {
    const [appSdk, sdk] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app =
      appSdk.getApps()[0] ?? appSdk.initializeApp(environment.firebaseConfig);
    const auth = this.createAuth(sdk, app);
    this.sdk = sdk;
    this.auth = auth;
    await this.finishRedirect(sdk, auth);
    await new Promise<void>((resolve) => {
      sdk.onAuthStateChanged(auth, (user) => {
        this.userState.set(toUser(user));
        this.readyState.set(true);
        resolve();
      });
    });
  }

  /**
   * `getAuth()` also wires the popup/redirect resolver, which injects
   * `apis.google.com/js/api.js` — useless for e-mail and password, so it is
   * handed to {@link signInWith} alone. `initializeAuth` with persistence only
   * skips it. It throws if this app already has an Auth instance (a dev-server
   * reload), and then the existing one is reused.
   */
  private createAuth(sdk: AuthSdk, app: FirebaseApp): FirebaseAuthInstance {
    try {
      return sdk.initializeAuth(app, {
        persistence: [
          sdk.indexedDBLocalPersistence,
          sdk.browserLocalPersistence,
        ],
      });
    } catch {
      return sdk.getAuth(app);
    }
  }

  /** Completes a sign-in that left for the provider; the session itself arrives through `onAuthStateChanged`. */
  private async finishRedirect(
    sdk: AuthSdk,
    auth: FirebaseAuthInstance,
  ): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;
    if (!sessionStorage.getItem(REDIRECT_PENDING)) return;
    sessionStorage.removeItem(REDIRECT_PENDING);
    try {
      await sdk.getRedirectResult(auth, sdk.browserPopupRedirectResolver);
    } catch (error) {
      this.redirectError = toAuthError(error).code;
    }
  }

  private onAuthDomain(): boolean {
    return (
      typeof location !== 'undefined' &&
      location.hostname === environment.firebaseConfig.authDomain
    );
  }

  private providerFor(sdk: AuthSdk, provider: AuthProvider) {
    switch (provider) {
      case 'google': {
        const google = new sdk.GoogleAuthProvider();
        // Otherwise, after a sign-out, the last account is picked without asking.
        google.setCustomParameters({ prompt: 'select_account' });
        return google;
      }
    }
  }

  private async ready$(): Promise<{
    sdk: AuthSdk;
    auth: FirebaseAuthInstance;
  }> {
    if (!this.available) throw new AuthError('unavailable');
    await this.initialize();
    return {
      sdk: this.sdk as AuthSdk,
      auth: this.auth as FirebaseAuthInstance,
    };
  }

  /** The confirmation link brings the player back to the online room. */
  private continueUrl(): { url: string } | undefined {
    return typeof location === 'undefined'
      ? undefined
      : { url: `${location.origin}/online` };
  }
}
