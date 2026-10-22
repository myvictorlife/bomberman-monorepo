import { inject, Injectable, signal } from '@angular/core';
import { AUTH, AuthError, AuthErrorCode, AuthProvider } from '@libs/auth';
import { AccountNotice } from './account-panel/account-panel';

/**
 * Signing in and out, wherever the site offers it — the header, the profile
 * page, the online room. One place keeps the state those share: an action in
 * flight, the last failure, the last notice. A root service, so the header's
 * menu and a page agree on what is going on.
 *
 * It also finishes a sign-in that left the page for the provider (a
 * redirect): {@link start} reads that failure once, for everyone.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly auth = inject(AUTH);
  private starting: Promise<void> | null = null;

  /** `false` with no provider configured: nothing to sign in to, and nothing is shown. */
  readonly available = this.auth.available;
  readonly user = this.auth.user;
  readonly ready = this.auth.ready;
  readonly busy = signal(false);
  readonly error = signal<AuthErrorCode | null>(null);
  readonly notice = signal<AccountNotice | null>(null);

  /**
   * Restores the session and takes the result of a sign-in that came back
   * from the provider. Idempotent: every caller gets the same promise.
   */
  start(): Promise<void> {
    this.starting ??= this.auth.initialize().then(() => {
      const code = this.auth.takeRedirectError();
      if (code && code !== 'cancelled') this.error.set(code);
    });
    return this.starting;
  }

  signIn(email: string, password: string): Promise<void> {
    return this.run(() => this.auth.signIn(email, password));
  }

  signInWith(provider: AuthProvider): Promise<void> {
    return this.run(() => this.auth.signInWith(provider));
  }

  signUp(email: string, password: string, name: string): Promise<void> {
    return this.run(async () => {
      await this.auth.signUp(email, password, name);
      this.notice.set('verification-sent');
    });
  }

  signOut(): Promise<void> {
    return this.run(() => this.auth.signOut());
  }

  resendVerification(): Promise<void> {
    return this.run(async () => {
      await this.auth.sendVerificationEmail();
      this.notice.set('verification-sent');
    });
  }

  checkVerification(): Promise<void> {
    return this.run(() => this.auth.reload());
  }

  resetPassword(email: string): Promise<void> {
    return this.run(async () => {
      await this.auth.sendPasswordReset(email);
      this.notice.set('reset-sent');
    });
  }

  /** Forgets the last failure and notice, e.g. when the menu that showed them closes. */
  clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'unknown';
      // Closing the provider's window is a choice, not a failure.
      if (code !== 'cancelled') this.error.set(code);
    } finally {
      this.busy.set(false);
    }
  }
}
