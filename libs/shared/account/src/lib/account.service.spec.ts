import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AUTH, AuthError, AuthErrorCode, AuthUser } from '@libs/auth';
import { AccountService } from './account.service';

function fakeAuth() {
  return {
    available: true,
    user: signal<AuthUser | null>(null),
    ready: signal(true),
    initialize: vi.fn(async () => undefined),
    takeRedirectError: vi.fn((): AuthErrorCode | null => null),
    signIn: vi.fn(async () => undefined),
    signInWith: vi.fn(async () => undefined),
    signUp: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    sendVerificationEmail: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
    idToken: vi.fn(async () => null),
  };
}

describe('AccountService', () => {
  let auth: ReturnType<typeof fakeAuth>;
  let service: AccountService;

  beforeEach(() => {
    auth = fakeAuth();
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH, useValue: auth }],
    });
    service = TestBed.inject(AccountService);
  });

  it('starts once, and keeps the failure of a sign-in that came back from the provider', async () => {
    auth.takeRedirectError.mockReturnValueOnce(
      'popup-blocked' as AuthErrorCode,
    );

    await Promise.all([service.start(), service.start()]);

    expect(auth.initialize).toHaveBeenCalledTimes(1);
    expect(auth.takeRedirectError).toHaveBeenCalledTimes(1);
    expect(service.error()).toBe('popup-blocked');
  });

  it('says nothing when the redirect was cancelled', async () => {
    auth.takeRedirectError.mockReturnValueOnce('cancelled');
    await service.start();

    expect(service.error()).toBeNull();
  });

  it('signs in and out through the contract, busy meanwhile', async () => {
    const pending = service.signInWith('google');
    expect(service.busy()).toBe(true);
    await pending;
    expect(service.busy()).toBe(false);
    await service.signIn('a@b.co', 'secret');
    await service.signOut();
    await service.checkVerification();

    expect(auth.signInWith).toHaveBeenCalledWith('google');
    expect(auth.signIn).toHaveBeenCalledWith('a@b.co', 'secret');
    expect(auth.signOut).toHaveBeenCalled();
    expect(auth.reload).toHaveBeenCalled();
  });

  it('tells when an e-mail went out', async () => {
    await service.signUp('a@b.co', 'secret', 'Ana');
    expect(auth.signUp).toHaveBeenCalledWith('a@b.co', 'secret', 'Ana');
    expect(service.notice()).toBe('verification-sent');

    await service.resetPassword('a@b.co');
    expect(service.notice()).toBe('reset-sent');

    await service.resendVerification();
    expect(service.notice()).toBe('verification-sent');

    service.clearMessages();
    expect(service.notice()).toBeNull();
  });

  it('keeps the failure code, unknown for anything else, and none for a closed window', async () => {
    auth.signIn.mockRejectedValueOnce(new AuthError('invalid-credentials'));
    await service.signIn('a@b.co', 'nope');
    expect(service.error()).toBe('invalid-credentials');

    auth.signOut.mockRejectedValueOnce(new Error('boom'));
    await service.signOut();
    expect(service.error()).toBe('unknown');

    auth.signInWith.mockRejectedValueOnce(new AuthError('cancelled'));
    await service.signInWith('google');
    expect(service.error()).toBeNull();
  });
});
