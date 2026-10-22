import { provideRouter } from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { AccountMenuComponent } from './account-menu';

describe('AccountMenuComponent', () => {
  let spectator: Spectator<AccountMenuComponent>;
  const createComponent = createComponentFactory({
    component: AccountMenuComponent,
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideTranslateService({ lang: 'en' }),
    ],
  });
  const byId = (id: string) => spectator.query(`[data-testid="${id}"]`);

  beforeEach(() => (spectator = createComponent()));

  it('shows nothing with sign-in off, and a placeholder while the session loads', () => {
    expect(byId('account-menu')).toBeNull();

    spectator.setInput('account', { state: 'loading' });
    expect(byId('account-menu-loading')).not.toBeNull();
  });

  it('signed out: Google in one click, e-mail on the profile page, and the last failure', () => {
    spectator.setInput('account', {
      state: 'signed-out',
      errorKey: 'ONLINE.AUTH_ERROR.network',
    });
    const opened = vi.fn();
    spectator.output('opened').subscribe(opened);

    spectator.click('[data-testid="account-menu-sign-in"]');
    expect(opened).toHaveBeenCalled();
    expect(byId('account-menu-email')?.getAttribute('href')).toBe('/profile');
    expect(byId('account-menu-error')).toHaveText('ONLINE.AUTH_ERROR.network');

    const google = vi.fn();
    spectator.output('signInWithGoogle').subscribe(google);
    spectator.click('[data-testid="account-menu-google"]');
    expect(google).toHaveBeenCalled();
    expect(byId('account-menu-panel')).toBeNull();
  });

  it('signed in: the initial and name, a nudge to confirm the e-mail, the profile and sign out', () => {
    spectator.setInput('account', {
      state: 'signed-in',
      name: 'ana maria',
      verified: false,
    });

    expect(spectator.query('.account-menu__badge')).toHaveText('A');
    expect(spectator.query('.account-menu__dot')).not.toBeNull();
    spectator.click('[data-testid="account-menu-trigger"]');
    expect(byId('account-menu-name')).toHaveText('ana maria');
    expect(byId('account-menu-verify')?.getAttribute('href')).toBe('/profile');

    const done = vi.fn();
    spectator.output('done').subscribe(done);
    spectator.click('[data-testid="account-menu-profile"]');
    expect(done).toHaveBeenCalled();
    expect(byId('account-menu-panel')).toBeNull();

    const signOut = vi.fn();
    spectator.output('signOut').subscribe(signOut);
    spectator.click('[data-testid="account-menu-trigger"]');
    spectator.click('[data-testid="account-menu-sign-out"]');
    expect(signOut).toHaveBeenCalled();
  });

  it('closes on Escape and on a click outside', () => {
    spectator.setInput('account', { state: 'signed-out' });
    spectator.click('[data-testid="account-menu-sign-in"]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    spectator.detectChanges();
    expect(byId('account-menu-panel')).toBeNull();

    spectator.click('[data-testid="account-menu-sign-in"]');
    spectator.click('.account-menu__backdrop');
    expect(byId('account-menu-panel')).toBeNull();
  });

  it('lays the choices flat when inline', () => {
    spectator.setInput('account', {
      state: 'signed-in',
      name: 'Ana',
      verified: true,
    });
    spectator.setInput('inline', true);

    expect(byId('account-menu-inline')).not.toBeNull();
    expect(byId('account-menu-trigger')).toBeNull();
    expect(byId('account-menu-sign-out')).not.toBeNull();
  });
});
