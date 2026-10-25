import { TestBed } from '@angular/core/testing';
import { AUTH, AuthError } from '@libs/auth';
import { environment } from '@libs/environment';
import { FirebaseAuth, toAuthError } from './firebase-auth';
import {
  authDomainRedirect,
  provideFirebaseAuth,
} from './firebase-auth.providers';

// The SDK is mocked, never reached: the suite must pass on a fresh clone with no
// Firebase project. Everything a `vi.mock` factory closes over comes from `vi.hoisted`.
const sdk = vi.hoisted(() => {
  const user = {
    uid: 'u1',
    email: 'ana@x.dev',
    displayName: 'Ana',
    emailVerified: false,
    reload: vi.fn(async () => undefined),
    getIdToken: vi.fn(async (force?: boolean) =>
      force ? 'fresh-token' : 'token',
    ),
  };
  const auth = { currentUser: null as typeof user | null };
  let listener: ((u: typeof user | null) => void) | null = null;
  return {
    user,
    auth,
    emit: (u: typeof user | null) => listener?.(u),
    getApps: vi.fn(() => [] as unknown[]),
    initializeApp: vi.fn((config?: unknown) => ({ name: 'app', config })),
    getAuth: vi.fn((app?: unknown) => (app ? auth : auth)),
    initializeAuth: vi.fn((app?: unknown, options?: unknown) =>
      app && options ? auth : auth,
    ),
    onAuthStateChanged: vi.fn(
      (_auth: unknown, cb: (u: typeof user | null) => void) => {
        listener = cb;
        cb(auth.currentUser);
      },
    ),
    createUserWithEmailAndPassword: vi.fn(async () => {
      auth.currentUser = user;
      return { user };
    }),
    signInWithEmailAndPassword: vi.fn(async () => {
      auth.currentUser = user;
      return { user };
    }),
    signInWithPopup: vi.fn(async () => {
      auth.currentUser = user;
      return { user };
    }),
    signInWithRedirect: vi.fn(async () => undefined),
    getRedirectResult: vi.fn(async () => null as unknown),
    updateProfile: vi.fn(async () => undefined),
    sendEmailVerification: vi.fn(async () => undefined),
    sendPasswordResetEmail: vi.fn(async () => undefined),
    signOut: vi.fn(async () => {
      auth.currentUser = null;
    }),
    initializeAppCheck: vi.fn(() => ({})),
    ReCaptchaEnterpriseProvider: vi.fn(function (this: unknown, key: string) {
      (this as { key: string }).key = key;
    }),
  };
});

vi.mock('firebase/app', () => ({
  getApps: () => sdk.getApps(),
  initializeApp: (config: unknown) => sdk.initializeApp(config),
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (app: unknown, options: unknown) =>
    (sdk.initializeAppCheck as (...a: unknown[]) => unknown)(app, options),
  ReCaptchaEnterpriseProvider: sdk.ReCaptchaEnterpriseProvider,
}));

vi.mock('firebase/auth', () => ({
  getAuth: (app: unknown) => sdk.getAuth(app),
  initializeAuth: (app: unknown, options: unknown) =>
    sdk.initializeAuth(app, options),
  indexedDBLocalPersistence: 'indexeddb',
  browserLocalPersistence: 'local',
  onAuthStateChanged: (auth: unknown, cb: never) =>
    sdk.onAuthStateChanged(auth, cb),
  createUserWithEmailAndPassword: (...a: unknown[]) =>
    sdk.createUserWithEmailAndPassword(...(a as [])),
  signInWithEmailAndPassword: (...a: unknown[]) =>
    sdk.signInWithEmailAndPassword(...(a as [])),
  signInWithPopup: (...a: unknown[]) => sdk.signInWithPopup(...(a as [])),
  signInWithRedirect: (...a: unknown[]) => sdk.signInWithRedirect(...(a as [])),
  getRedirectResult: (...a: unknown[]) => sdk.getRedirectResult(...(a as [])),
  browserPopupRedirectResolver: 'popup-resolver',
  GoogleAuthProvider: class {
    readonly providerId = 'google.com';
    params: Record<string, string> = {};
    setCustomParameters(params: Record<string, string>) {
      this.params = params;
    }
  },
  updateProfile: (...a: unknown[]) => sdk.updateProfile(...(a as [])),
  sendEmailVerification: (...a: unknown[]) =>
    sdk.sendEmailVerification(...(a as [])),
  sendPasswordResetEmail: (...a: unknown[]) =>
    sdk.sendPasswordResetEmail(...(a as [])),
  signOut: (...a: unknown[]) => sdk.signOut(...(a as [])),
}));

// `@libs/environment` cannot be module-mocked; flip the real, mutable instance.
const originalAuthEnabled = environment.authEnabled;
afterAll(() => {
  environment.authEnabled = originalAuthEnabled;
});

function create(enabled: boolean): FirebaseAuth {
  environment.authEnabled = enabled;
  TestBed.configureTestingModule({ providers: [provideFirebaseAuth()] });
  return TestBed.inject(AUTH) as FirebaseAuth;
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.auth.currentUser = null;
  sdk.user.emailVerified = false;
  sdk.getApps.mockReturnValue([]);
});

describe('provideFirebaseAuth', () => {
  it('points AUTH at the Firebase implementation', () => {
    expect(create(false)).toBeInstanceOf(FirebaseAuth);
  });
});

describe('FirebaseAuth without a Firebase project', () => {
  it('is unavailable and ready without loading the SDK', async () => {
    const auth = create(false);
    await auth.initialize();

    expect(auth.available).toBe(false);
    expect(auth.ready()).toBe(true);
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
    await expect(auth.idToken()).resolves.toBeNull();
    await expect(auth.signOut()).resolves.toBeUndefined();
    await expect(auth.reload()).resolves.toBeUndefined();
    await expect(auth.signIn('a@b.c', 'x')).rejects.toEqual(
      new AuthError('unavailable'),
    );
  });
});

describe('FirebaseAuth with a Firebase project', () => {
  it('restores the saved session once, then reports ready', async () => {
    sdk.auth.currentUser = sdk.user;
    const auth = create(true);
    expect(auth.ready()).toBe(false);

    await Promise.all([auth.initialize(), auth.initialize()]);

    expect(sdk.initializeAuth).toHaveBeenCalledTimes(1);
    expect(sdk.initializeAuth.mock.calls[0]?.[1]).toEqual({
      persistence: ['indexeddb', 'local'],
    });
    expect(sdk.getAuth).not.toHaveBeenCalled();
    expect(auth.ready()).toBe(true);
    expect(auth.user()).toEqual({
      id: 'u1',
      email: 'ana@x.dev',
      displayName: 'Ana',
      emailVerified: false,
    });
  });

  it('reuses the Auth instance when the app already has one', async () => {
    sdk.initializeAuth.mockImplementationOnce(() => {
      throw new Error('auth/already-initialized');
    });
    await create(true).initialize();

    expect(sdk.getAuth).toHaveBeenCalledTimes(1);
  });

  it('reuses an app another integration already started', async () => {
    sdk.getApps.mockReturnValue([{ name: 'existing' }]);
    await create(true).initialize();

    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  describe('App Check', () => {
    const originalSiteKey = environment.firebaseConfig.appCheckSiteKey;
    afterEach(() => {
      environment.firebaseConfig.appCheckSiteKey = originalSiteKey;
    });

    it('starts App Check with the reCAPTCHA site key when one is configured', async () => {
      environment.firebaseConfig.appCheckSiteKey = 'site-key-123';
      await create(true).initialize();

      expect(sdk.ReCaptchaEnterpriseProvider).toHaveBeenCalledWith(
        'site-key-123',
      );
      expect(sdk.initializeAppCheck).toHaveBeenCalledTimes(1);
      expect(sdk.initializeAppCheck).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
      );
    });

    it('leaves App Check off when no site key is configured', async () => {
      environment.firebaseConfig.appCheckSiteKey = '';
      await create(true).initialize();

      expect(sdk.initializeAppCheck).not.toHaveBeenCalled();
    });
  });

  it('signs up with a display name and sends the confirmation e-mail back to the room', async () => {
    const auth = create(true);
    await auth.signUp(' ana@x.dev ', 'secret1', ' Ana ');

    expect(sdk.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      sdk.auth,
      'ana@x.dev',
      'secret1',
    );
    expect(sdk.updateProfile).toHaveBeenCalledWith(sdk.user, {
      displayName: 'Ana',
    });
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(sdk.user, {
      url: `${location.origin}/online`,
    });
    expect(auth.user()?.id).toBe('u1');
  });

  it('signs in, refreshes after the e-mail is confirmed, hands out tokens and signs out', async () => {
    const auth = create(true);
    await auth.signIn('ana@x.dev', 'secret1');
    expect(auth.user()?.emailVerified).toBe(false);

    sdk.user.emailVerified = true;
    await auth.reload();
    expect(auth.user()?.emailVerified).toBe(true);

    await expect(auth.idToken()).resolves.toBe('token');
    await expect(auth.idToken(true)).resolves.toBe('fresh-token');

    await auth.signOut();
    expect(auth.user()).toBeNull();
    await expect(auth.idToken()).resolves.toBeNull();
    await expect(auth.reload()).resolves.toBeUndefined();
  });

  it('signs in with Google in a popup, always offering the account picker', async () => {
    const auth = create(true);
    await auth.signInWith('google');

    const [instance, provider, resolver] = sdk.signInWithPopup.mock
      .calls[0] as unknown as [
      unknown,
      { providerId: string; params: unknown },
      unknown,
    ];
    expect(instance).toBe(sdk.auth);
    expect(provider).toMatchObject({
      providerId: 'google.com',
      params: { prompt: 'select_account' },
    });
    expect(resolver).toBe('popup-resolver');
    expect(auth.user()?.id).toBe('u1');
  });

  it('tells a closed or blocked popup apart from a failure', async () => {
    const auth = create(true);
    sdk.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
    });
    sdk.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-blocked' });
    sdk.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/unauthorized-domain',
    });

    await expect(auth.signInWith('google')).rejects.toEqual(
      new AuthError('cancelled'),
    );
    await expect(auth.signInWith('google')).rejects.toEqual(
      new AuthError('popup-blocked'),
    );
    await expect(auth.signInWith('google')).rejects.toEqual(
      new AuthError('unavailable'),
    );
  });

  describe('on the authDomain', () => {
    const originalAuthDomain = environment.firebaseConfig.authDomain;
    beforeEach(() => {
      environment.firebaseConfig.authDomain = location.hostname;
      sessionStorage.clear();
    });
    afterEach(() => {
      environment.firebaseConfig.authDomain = originalAuthDomain;
      sessionStorage.clear();
    });

    it('leaves for Google instead of opening a popup', async () => {
      const auth = create(true);
      await auth.signInWith('google');

      expect(sdk.signInWithPopup).not.toHaveBeenCalled();
      const [instance, provider, resolver] = sdk.signInWithRedirect.mock
        .calls[0] as unknown as [unknown, { providerId: string }, unknown];
      expect(instance).toBe(sdk.auth);
      expect(provider.providerId).toBe('google.com');
      expect(resolver).toBe('popup-resolver');
      expect(sessionStorage.getItem('auth:redirect-pending')).toBe('1');
    });

    it('forgets the pending redirect when it cannot start', async () => {
      const auth = create(true);
      sdk.signInWithRedirect.mockRejectedValueOnce({
        code: 'auth/unauthorized-domain',
      });

      await expect(auth.signInWith('google')).rejects.toEqual(
        new AuthError('unavailable'),
      );
      expect(sessionStorage.getItem('auth:redirect-pending')).toBeNull();
    });

    it('finishes the redirect on the way back, and only then', async () => {
      await create(true).initialize();
      expect(sdk.getRedirectResult).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      sessionStorage.setItem('auth:redirect-pending', '1');
      const auth = create(true);
      await auth.initialize();

      expect(sdk.getRedirectResult).toHaveBeenCalledWith(
        sdk.auth,
        'popup-resolver',
      );
      expect(sessionStorage.getItem('auth:redirect-pending')).toBeNull();
      expect(auth.takeRedirectError()).toBeNull();
    });

    it('hands a failed redirect to the page once', async () => {
      sessionStorage.setItem('auth:redirect-pending', '1');
      sdk.getRedirectResult.mockRejectedValueOnce({
        code: 'auth/network-request-failed',
      });
      const auth = create(true);
      await auth.initialize();

      expect(auth.takeRedirectError()).toBe('network');
      expect(auth.takeRedirectError()).toBeNull();
    });
  });

  it('follows sign-outs that happen elsewhere', async () => {
    sdk.auth.currentUser = sdk.user;
    const auth = create(true);
    await auth.initialize();

    sdk.emit(null);

    expect(auth.user()).toBeNull();
  });

  it('resends the confirmation and sends a password reset', async () => {
    const auth = create(true);
    await expect(auth.sendVerificationEmail()).rejects.toEqual(
      new AuthError('invalid-credentials'),
    );

    await auth.signIn('ana@x.dev', 'secret1');
    await auth.sendVerificationEmail();
    await auth.sendPasswordReset(' ana@x.dev ');

    expect(sdk.sendEmailVerification).toHaveBeenCalledTimes(1);
    expect(sdk.sendPasswordResetEmail).toHaveBeenCalledWith(
      sdk.auth,
      'ana@x.dev',
    );
  });

  it('turns Firebase errors into neutral ones', async () => {
    const auth = create(true);
    sdk.signInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
    });
    sdk.createUserWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/email-already-in-use',
    });
    sdk.sendEmailVerification.mockRejectedValueOnce({
      code: 'auth/too-many-requests',
    });
    sdk.sendPasswordResetEmail.mockRejectedValueOnce({
      code: 'auth/invalid-email',
    });

    await expect(auth.signIn('a@b.c', 'x')).rejects.toEqual(
      new AuthError('invalid-credentials'),
    );
    await expect(auth.signUp('a@b.c', 'x', 'A')).rejects.toEqual(
      new AuthError('email-in-use'),
    );
    sdk.auth.currentUser = sdk.user;
    await expect(auth.sendVerificationEmail()).rejects.toEqual(
      new AuthError('too-many-requests'),
    );
    await expect(auth.sendPasswordReset('x')).rejects.toEqual(
      new AuthError('invalid-email'),
    );
  });
});

describe('toAuthError', () => {
  it('keeps neutral errors and maps unknown ones', () => {
    const neutral = new AuthError('network');

    expect(toAuthError(neutral)).toBe(neutral);
    expect(toAuthError({ code: 'auth/weird' }).code).toBe('unknown');
    expect(toAuthError(null).code).toBe('unknown');
    expect(toAuthError({ code: 'auth/weak-password' }).code).toBe(
      'weak-password',
    );
  });

  it('logs the raw error only when it is unmapped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const raw = { code: 'auth/weird' };

    toAuthError({ code: 'auth/weak-password' });
    expect(warn).not.toHaveBeenCalled();
    toAuthError(raw);
    expect(warn).toHaveBeenCalledWith('[auth] unmapped error', raw);

    warn.mockRestore();
  });
});

describe('authDomainRedirect', () => {
  const config = { authDomain: 'game.web.app', projectId: 'game' };
  const at = (hostname: string) => ({
    hostname,
    pathname: '/online',
    search: '?x=1',
    hash: '#top',
  });

  it('sends the other Hosting domain to the authDomain, keeping the path', () => {
    expect(authDomainRedirect(at('game.firebaseapp.com'), config)).toBe(
      'https://game.web.app/online?x=1#top',
    );
  });

  it('stays on the authDomain, localhost and custom domains', () => {
    expect(authDomainRedirect(at('game.web.app'), config)).toBeNull();
    expect(authDomainRedirect(at('localhost'), config)).toBeNull();
    expect(authDomainRedirect(at('play.example.com'), config)).toBeNull();
  });

  it('sends both default domains to a custom authDomain', () => {
    const custom = { authDomain: 'play.example.com', projectId: 'game' };
    expect(authDomainRedirect(at('game.web.app'), custom)).toBe(
      'https://play.example.com/online?x=1#top',
    );
    expect(authDomainRedirect(at('game.firebaseapp.com'), custom)).toBe(
      'https://play.example.com/online?x=1#top',
    );
    expect(authDomainRedirect(at('play.example.com'), custom)).toBeNull();
  });

  it('stays put with a missing config', () => {
    expect(
      authDomainRedirect(at('game.web.app'), { authDomain: '', projectId: '' }),
    ).toBeNull();
  });
});
