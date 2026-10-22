import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AUTH, AuthUser } from '@libs/auth';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  TranslateLoader,
  TranslationObject,
  provideTranslateService,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { App } from './app';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({ HEADER: { HOME: 'Home', START: 'Get started' } });
  }
}

describe('App', () => {
  let spectator: Spectator<App>;
  const createComponent = createComponentFactory({
    component: App,
    providers: [
      // The root component renders the header, so its dependencies have to be
      // satisfied here — that is the cost of the header being app chrome rather
      // than something each page repeats.
      provideRouter([]),
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    // ThemeService (via the header's theme toggle) reads matchMedia, absent in jsdom.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: false, addEventListener: () => undefined }),
    });
    spectator = createComponent();
  });

  it('should render router outlet', () => {
    expect(spectator.query('router-outlet')).toBeTruthy();
  });

  it('renders the header on every route', () => {
    expect(spectator.query('lib-header')).toBeTruthy();
    expect(spectator.query('header')).toBeTruthy();
  });
});

describe('App, the header account', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({ matches: false, addEventListener: () => undefined }),
    });
  });
  const user = signal<AuthUser | null>(null);
  const ready = signal(true);
  const auth = {
    available: true,
    user,
    ready,
    initialize: vi.fn(async () => undefined),
    takeRedirectError: vi.fn(() => null),
    signInWith: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
  const create = createComponentFactory({
    component: App,
    providers: [
      provideRouter([]),
      provideTranslateService({ lang: 'en' }),
      { provide: AUTH, useValue: auth },
    ],
  });

  it('maps the session onto the header: loading, signed out, signed in', () => {
    ready.set(false);
    const app = create();
    expect(app.query('[data-testid="account-menu-loading"]')).toBeTruthy();

    ready.set(true);
    app.detectChanges();
    app.click('[data-testid="account-menu-sign-in"]');
    app.click('[data-testid="account-menu-google"]');
    expect(auth.signInWith).toHaveBeenCalledWith('google');

    user.set({
      id: 'u1',
      email: 'ana@example.com',
      displayName: '',
      emailVerified: true,
    });
    app.detectChanges();
    expect(app.query('[data-testid="account-menu-trigger"]')).toHaveText('ana');
    app.click('[data-testid="account-menu-trigger"]');
    app.click('[data-testid="account-menu-sign-out"]');
    expect(auth.signOut).toHaveBeenCalled();
  });
});
