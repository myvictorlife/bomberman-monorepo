import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AccountPanelComponent } from './account-panel';

const user = {
  id: 'u1',
  email: 'ana@x.dev',
  displayName: 'Ana',
  emailVerified: true,
};
const profile = {
  id: 'u1',
  name: 'Ana',
  nameChosen: false,
  wins: 3,
  matches: 5,
  visits: 2,
  firstSeenAt: 0,
  lastSeenAt: 0,
  returning: true,
  rank: 2,
};

describe('AccountPanelComponent', () => {
  let spectator: Spectator<AccountPanelComponent>;
  const createComponent = createComponentFactory({
    component: AccountPanelComponent,
    providers: [provideTranslateService(), provideRouter([])],
  });

  const type = (testId: string, value: string) =>
    spectator.typeInElement(value, `[data-testid="${testId}"]`);

  beforeEach(() => (spectator = createComponent()));

  /** `output()` is an emitter, not a spy: subscribe a spy to it. */
  const watch = (name: string) => {
    const spy = vi.fn();
    (
      spectator.component[
        name as keyof typeof spectator.component
      ] as unknown as { subscribe(fn: (v: unknown) => void): void }
    ).subscribe(spy);
    return spy;
  };

  it('explains when accounts are unavailable, and while the session loads', () => {
    spectator.setInput('available', false);
    expect(spectator.query('[data-testid="account-unavailable"]')).toExist();

    spectator.setInput('available', true);
    spectator.setInput('ready', false);
    expect(spectator.query('[data-testid="account-form"]')).not.toExist();
  });

  it('signs in only with a valid e-mail and password', () => {
    const emitted = watch('signIn');
    const submit = spectator.query<HTMLButtonElement>(
      '[data-testid="account-submit"]',
    );

    type('account-email', 'ana@x.dev');
    type('account-password', '123');
    expect(submit?.disabled).toBe(true);

    type('account-password', 'secret1');
    spectator.detectChanges();
    expect(submit?.disabled).toBe(false);
    spectator.dispatchFakeEvent('[data-testid="account-form"]', 'submit');

    expect(emitted).toHaveBeenCalledWith({
      email: 'ana@x.dev',
      password: 'secret1',
    });
  });

  it('offers Google sign-in, except while busy', () => {
    const emitted = watch('signInWith');
    spectator.click('[data-testid="account-google"]');
    expect(emitted).toHaveBeenCalledWith('google');

    spectator.setInput('busy', true);
    expect(
      spectator.query<HTMLButtonElement>('[data-testid="account-google"]')
        ?.disabled,
    ).toBe(true);
  });

  it('creates an account with a player name', () => {
    const emitted = watch('signUp');
    spectator.click('[data-testid="account-toggle"]');

    type('account-email', 'ana@x.dev');
    type('account-password', 'secret1');
    type('account-name', 'A');
    spectator.dispatchFakeEvent('[data-testid="account-form"]', 'submit');
    expect(emitted).not.toHaveBeenCalled();

    type('account-name', ' Ana ');
    spectator.dispatchFakeEvent('[data-testid="account-form"]', 'submit');
    expect(emitted).toHaveBeenCalledWith({
      email: 'ana@x.dev',
      password: 'secret1',
      name: 'Ana',
    });

    spectator.click('[data-testid="account-toggle"]');
    expect(spectator.component.mode()).toBe('sign-in');
  });

  it('does not submit while busy', () => {
    const emitted = watch('signIn');
    type('account-email', 'ana@x.dev');
    type('account-password', 'secret1');
    spectator.setInput('busy', true);

    spectator.dispatchFakeEvent('[data-testid="account-form"]', 'submit');

    expect(emitted).not.toHaveBeenCalled();
  });

  it('asks for a password reset only with an e-mail typed', () => {
    const emitted = watch('resetPassword');
    spectator.click('[data-testid="account-forgot"]');
    expect(emitted).not.toHaveBeenCalled();

    type('account-email', ' ana@x.dev ');
    spectator.click('[data-testid="account-forgot"]');
    expect(emitted).toHaveBeenCalledWith('ana@x.dev');
  });

  it('asks an unconfirmed account to open the e-mail', () => {
    const check = watch('checkVerification');
    const resend = watch('resendVerification');
    spectator.setInput('user', { ...user, emailVerified: false });

    expect(spectator.query('[data-testid="account-verify"]')).toExist();
    spectator.click('[data-testid="account-verify-check"]');
    spectator.click('[data-testid="account-verify-resend"]');
    expect(check).toHaveBeenCalled();
    expect(resend).toHaveBeenCalled();
  });

  it('greets a signed-in player with their numbers, and signs out', () => {
    const signOut = watch('signOut');
    spectator.setInput('user', user);
    spectator.setInput('profile', profile);

    expect(spectator.query('[data-testid="account-welcome"]')).toHaveText(
      'ONLINE.ACCOUNT.WELCOME_BACK',
    );
    expect(spectator.query('[data-testid="account-stats"]')).toHaveText(
      'ONLINE.ACCOUNT.RANK',
    );
    spectator.click('[data-testid="account-sign-out"]');
    expect(signOut).toHaveBeenCalled();

    spectator.setInput('profile', { ...profile, returning: false, rank: null });
    expect(spectator.query('[data-testid="account-welcome"]')).toHaveText(
      'ONLINE.ACCOUNT.WELCOME_NEW',
    );
    expect(spectator.query('[data-testid="account-stats"]')).not.toHaveText(
      'ONLINE.ACCOUNT.RANK',
    );
  });

  it('links to the profile, inviting a player on their account name to choose one', () => {
    spectator.setInput('user', user);
    spectator.setInput('profile', profile);

    const link = spectator.query('[data-testid="account-profile"]');
    expect(link?.getAttribute('href')).toBe('/profile');
    expect(link).toHaveText('ONLINE.ACCOUNT.CHOOSE_NAME');

    spectator.setInput('profile', { ...profile, nameChosen: true });
    expect(spectator.query('[data-testid="account-profile"]')).toHaveText(
      'ONLINE.ACCOUNT.EDIT_PROFILE',
    );
  });

  it('shows errors and notices', () => {
    spectator.setInput('error', 'invalid-credentials');
    spectator.setInput('notice', 'reset-sent');

    expect(spectator.query('[data-testid="account-error"]')).toHaveText(
      'ONLINE.AUTH_ERROR.invalid-credentials',
    );
    expect(spectator.query('[data-testid="account-notice"]')).toHaveText(
      'ONLINE.ACCOUNT.NOTICE.reset-sent',
    );
  });
});
