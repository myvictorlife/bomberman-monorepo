import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUTH } from '@libs/auth';
import { PlayerProfile } from '@libs/game-protocol';
import { firstValueFrom } from 'rxjs';
import {
  PROFILE_SERVER_URL,
  ProfileFailure,
  ProfileService,
} from './profile.service';

const profile: PlayerProfile = {
  id: 'u1',
  name: 'Ana',
  nameChosen: false,
  wins: 0,
  matches: 0,
  visits: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
  returning: false,
  rank: null,
};

describe('ProfileService', () => {
  const setup = (
    options: {
      url?: string | null;
      token?: string | null;
      auth?: boolean;
    } = {},
  ) => {
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PROFILE_SERVER_URL,
          useValue:
            options.url === undefined ? 'https://api.test/' : options.url,
        },
        {
          provide: AUTH,
          useValue: {
            available: options.auth ?? true,
            idToken: async () =>
              options.token === undefined ? 'tok' : options.token,
          },
        },
      ],
    });
    return {
      service: TestBed.inject(ProfileService),
      http: TestBed.inject(HttpTestingController),
    };
  };

  /** Lets the token promise settle so the request goes out. */
  const tick = () => new Promise((r) => setTimeout(r));

  const failure = async (call: Promise<unknown>) =>
    call.then(
      () => null,
      (e: ProfileFailure) => e,
    );

  it('is available only with a server and a way to sign in', () => {
    expect(setup().service.available).toBe(true);
    TestBed.resetTestingModule();
    expect(setup({ url: null }).service.available).toBe(false);
    TestBed.resetTestingModule();
    expect(setup({ auth: false }).service.available).toBe(false);
  });

  it('reads /me with the ID token as the bearer', async () => {
    const { service, http } = setup();
    const result = firstValueFrom(service.fetchProfile());
    await tick();

    const req = http.expectOne('https://api.test/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush(profile);
    expect(await result).toEqual(profile);
  });

  it('sends a change with PUT', async () => {
    const { service, http } = setup();
    const result = firstValueFrom(service.updateProfile({ color: 'pink' }));
    await tick();

    const req = http.expectOne('https://api.test/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ color: 'pink' });
    req.flush({ ...profile, color: 'pink' });
    expect((await result).color).toBe('pink');
  });

  it("turns the server's refusal into its code", async () => {
    const { service, http } = setup();
    const result = failure(
      firstValueFrom(service.updateProfile({ name: 'Bia' })),
    );
    await tick();

    http
      .expectOne('https://api.test/me')
      .flush({ error: 'name-taken' }, { status: 409, statusText: 'Conflict' });
    expect(await result).toBe('name-taken');
  });

  it('calls anything else a network failure', async () => {
    const { service, http } = setup();
    const result = failure(firstValueFrom(service.fetchProfile()));
    await tick();

    http
      .expectOne('https://api.test/me')
      .flush('oops', { status: 502, statusText: 'Bad Gateway' });
    expect(await result).toBe('network');
  });

  it('asks for a sign-in when there is no token, and fails without a server', async () => {
    expect(
      await failure(
        firstValueFrom(setup({ token: null }).service.fetchProfile()),
      ),
    ).toBe('auth-required');
    TestBed.resetTestingModule();
    expect(
      await failure(
        firstValueFrom(setup({ url: null }).service.fetchProfile()),
      ),
    ).toBe('network');
  });
});
