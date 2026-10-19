import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AUTH, AuthUser } from '@libs/auth';
import { CharacterSelectionService } from '@libs/character-select';
import { CharacterId } from '@libs/game-core';
import { PlayerProfile } from '@libs/game-protocol';
import { ProfileSyncService, SYNC_SERVER_URL } from './profile-sync.service';

const ana: AuthUser = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  emailVerified: true,
};

const profile = (favorite?: CharacterId): PlayerProfile => ({
  id: 'u1',
  name: 'Ana',
  nameChosen: true,
  wins: 0,
  matches: 0,
  visits: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
  returning: false,
  rank: null,
  ...(favorite ? { favoriteCharacterId: favorite } : {}),
});

describe('ProfileSyncService', () => {
  const user = signal<AuthUser | null>(null);
  const selected = signal<CharacterId>('novato');
  const selection = {
    selectedId: selected,
    select: (id: CharacterId) => selected.set(id),
  };

  const setup = (url: string | null = 'https://api.test') => {
    user.set(null);
    selected.set('novato');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SYNC_SERVER_URL, useValue: url },
        {
          provide: AUTH,
          useValue: { available: true, user, idToken: async () => 'tok' },
        },
        { provide: CharacterSelectionService, useValue: selection },
      ],
    });
    const service = TestBed.inject(ProfileSyncService);
    runInInjectionContext(TestBed.inject(Injector), () => service.start());
    TestBed.tick();
    return TestBed.inject(HttpTestingController);
  };

  /** Lets effects run and the token promise settle. */
  const settle = async () => {
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    TestBed.tick();
  };

  it('asks nothing while nobody is signed in, or without a server', async () => {
    const http = setup();
    await settle();
    http.expectNone('https://api.test/me');

    TestBed.resetTestingModule();
    const offline = setup(null);
    user.set(ana);
    await settle();
    offline.expectNone(() => true);
  });

  it("plays the account's favourite once someone signs in", async () => {
    const http = setup();
    user.set(ana);
    await settle();

    const req = http.expectOne('https://api.test/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush(profile('lia'));
    await settle();

    expect(selected()).toBe('lia');
    // Taking the server's choice is not a change to send back.
    http.expectNone({ method: 'PUT' });
  });

  it('gives an account with no favourite this browser’s character', async () => {
    const http = setup();
    selected.set('byte');
    user.set(ana);
    await settle();
    http.expectOne('https://api.test/me').flush(profile());
    await settle();

    const put = http.expectOne({ method: 'PUT' });
    expect(put.request.body).toEqual({ favoriteCharacterId: 'byte' });
  });

  it('sends a new pick to the account, once', async () => {
    const http = setup();
    user.set(ana);
    await settle();
    http.expectOne('https://api.test/me').flush(profile('lia'));
    await settle();

    selection.select('tiao');
    await settle();
    expect(http.expectOne({ method: 'PUT' }).request.body).toEqual({
      favoriteCharacterId: 'tiao',
    });

    selection.select('tiao');
    await settle();
    http.expectNone({ method: 'PUT' });
  });

  it('stops sending once signed out, and stays quiet when the server fails', async () => {
    const http = setup();
    user.set(ana);
    await settle();
    http
      .expectOne('https://api.test/me')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    await settle();

    selection.select('faisca');
    await settle();
    http.expectNone({ method: 'PUT' });

    user.set(null);
    await settle();
    selection.select('motoca');
    await settle();
    http.expectNone(() => true);
  });
});
