import { TestBed } from '@angular/core/testing';
import { AUTH, AuthError, NoopAuth } from './auth';

describe('AUTH', () => {
  it('resolves to NoopAuth when nothing provides it', () => {
    expect(TestBed.inject(AUTH)).toBeInstanceOf(NoopAuth);
  });

  it('is unavailable, ready, and signed out', async () => {
    const auth = TestBed.inject(AUTH);
    await auth.initialize();

    expect(auth.available).toBe(false);
    expect(auth.ready()).toBe(true);
    expect(auth.user()).toBeNull();
    await expect(auth.idToken()).resolves.toBeNull();
    await expect(auth.signOut()).resolves.toBeUndefined();
    await expect(auth.reload()).resolves.toBeUndefined();
  });

  it('refuses every account action with an "unavailable" error', async () => {
    const auth = TestBed.inject(AUTH);

    for (const action of [
      () => auth.signUp('a@b.c', 'secret1', 'A'),
      () => auth.signIn('a@b.c', 'secret1'),
      () => auth.signInWith('google'),
      () => auth.sendVerificationEmail(),
      () => auth.sendPasswordReset('a@b.c'),
    ]) {
      await expect(action()).rejects.toEqual(new AuthError('unavailable'));
    }
  });

  it('names its errors', () => {
    const error = new AuthError('weak-password');

    expect(error.name).toBe('AuthError');
    expect(error.code).toBe('weak-password');
  });
});
