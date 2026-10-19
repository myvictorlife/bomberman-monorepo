import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { AUTH } from '@libs/auth';
import { environment, FirebaseConfig } from '@libs/environment';
import { FirebaseAuth } from './firebase-auth';

type PageLocation = Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'>;

/**
 * Where to send a page served from a Firebase Hosting domain that is not the
 * `authDomain`, or `null` to stay. Hosting answers on `<projectId>.web.app`,
 * `<projectId>.firebaseapp.com` and any custom domain, but sign-in only
 * completes on the `authDomain`: elsewhere the auth iframe is third-party, its
 * storage is partitioned, and the result is lost. The default domains are sent
 * to the `authDomain`, custom or not; custom domains and `localhost` are never
 * redirected.
 */
export function authDomainRedirect(
  page: PageLocation,
  config: Pick<FirebaseConfig, 'authDomain' | 'projectId'>,
): string | null {
  const { authDomain, projectId } = config;
  if (!authDomain || !projectId || page.hostname === authDomain) return null;
  const hostingDomains = [
    `${projectId}.web.app`,
    `${projectId}.firebaseapp.com`,
  ];
  if (!hostingDomains.includes(page.hostname)) return null;
  return `https://${authDomain}${page.pathname}${page.search}${page.hash}`;
}

/**
 * Opt-in. Call it in `app.config.ts` to point `AUTH` at Firebase Authentication.
 * Leave it out and `AUTH` stays on `NoopAuth`. With it in and no Firebase
 * project configured, `available` is `false` and no SDK is ever fetched.
 */
export function provideFirebaseAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AUTH, useClass: FirebaseAuth },
    provideEnvironmentInitializer(() => {
      if (!environment.authEnabled || typeof location === 'undefined') return;
      const target = authDomainRedirect(location, environment.firebaseConfig);
      if (target) location.replace(target);
    }),
  ]);
}
