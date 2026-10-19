import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AUTH, AuthUser } from '@libs/auth';
import { CharacterSelectionService } from '@libs/character-select';
import { PlayerProfile } from '@libs/game-protocol';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { ProfileStore } from '../../+state/profile.store';
import { ProfileService } from '../../services/profile/profile.service';
import { Profile } from './profile';

const ana: AuthUser = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  emailVerified: true,
};

const profile: PlayerProfile = {
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

describe('Profile', () => {
  let spectator: Spectator<Profile>;
  const user = signal<AuthUser | null>(ana);
  const ready = signal(true);
  const auth = {
    available: true,
    user,
    ready,
    initialize: vi.fn(async () => undefined),
  };
  const service: {
    available: boolean;
    fetchProfile: Mock;
    updateProfile: Mock;
  } = { available: true, fetchProfile: vi.fn(), updateProfile: vi.fn() };

  const createComponent = createComponentFactory({
    component: Profile,
    detectChanges: false,
    providers: [
      provideRouter([]),
      { provide: AUTH, useValue: auth },
      { provide: ProfileService, useValue: service },
      { provide: CharacterSelectionService, useValue: { select: vi.fn() } },
      ProfileStore,
      // No bundles: the page shows keys, and the tests find things by test id.
      provideTranslateService({ lang: 'en' }),
    ],
  });

  const render = () => {
    spectator = createComponent();
    spectator.detectChanges();
    return spectator;
  };
  const byId = (id: string) => spectator.query(`[data-testid="${id}"]`);

  beforeEach(() => {
    user.set(ana);
    ready.set(true);
    service.available = true;
    service.fetchProfile.mockReset().mockReturnValue(of(profile));
    service.updateProfile.mockReset();
  });

  it('says so when there is no game server, and never asks for a profile', () => {
    service.available = false;
    render();

    expect(byId('profile-unavailable')).toBeTruthy();
    expect(service.fetchProfile).not.toHaveBeenCalled();
  });

  it('waits for the sign-in to settle, then loads the profile', () => {
    ready.set(false);
    service.fetchProfile.mockReturnValue(new Subject());
    render();

    expect(auth.initialize).toHaveBeenCalled();
    expect(spectator.query('[role="status"]')).toBeTruthy();
  });

  it('sends a signed-out visitor to sign in', () => {
    user.set(null);
    render();

    expect(
      byId('profile-signed-out')?.querySelector('a')?.getAttribute('href'),
    ).toBe('/online');
    expect(service.fetchProfile).not.toHaveBeenCalled();
  });

  it('shows the name, the numbers and a hint to choose a name', () => {
    render();

    expect(byId('profile-name')?.textContent).toContain('Ana');
    expect(byId('profile-wins')?.textContent).toContain('3');
    expect(byId('profile-rank')?.textContent).toContain('#2');
    expect(byId('profile-name-suggest')).toBeTruthy();
  });

  it('offers a retry when loading fails', () => {
    service.fetchProfile.mockReturnValueOnce(throwError(() => 'network'));
    render();
    expect(byId('profile-error')).toBeTruthy();

    spectator.click('[data-testid="profile-error"] button');
    spectator.detectChanges();
    expect(byId('profile-summary')).toBeTruthy();
  });

  it('saves a new name, and only a valid, changed one', () => {
    service.updateProfile.mockReturnValue(
      of({ ...profile, name: 'Dev Cansado', nameChosen: true }),
    );
    render();
    const save = () => byId('profile-name-save') as HTMLButtonElement | null;

    expect(save()?.disabled).toBe(true);
    spectator.typeInElement('x', '[data-testid="profile-name-input"]');
    expect(save()?.disabled).toBe(true);

    spectator.typeInElement(
      '  Dev   Cansado ',
      '[data-testid="profile-name-input"]',
    );
    spectator.click('[data-testid="profile-name-save"]');
    spectator.detectChanges();

    expect(service.updateProfile).toHaveBeenCalledWith({ name: 'Dev Cansado' });
    expect(byId('profile-name')?.textContent).toContain('Dev Cansado');
    expect(byId('profile-name-suggest')).toBeFalsy();
  });

  it('shows why a name was refused', () => {
    service.updateProfile.mockReturnValue(throwError(() => 'name-taken'));
    render();

    spectator.typeInElement('Bia', '[data-testid="profile-name-input"]');
    spectator.component.saveName();
    spectator.detectChanges();

    expect(byId('profile-save-error')?.textContent).toContain(
      'PROFILE.SAVE_ERROR.name-taken',
    );
  });

  it('saves the favourite character and the colour when picked', () => {
    service.updateProfile.mockImplementation((update) =>
      of({ ...profile, ...update }),
    );
    render();

    spectator.click('[data-testid="profile-character-tiao"]');
    spectator.click('[data-testid="profile-color-purple"]');
    spectator.detectChanges();

    expect(service.updateProfile).toHaveBeenCalledWith({
      favoriteCharacterId: 'tiao',
    });
    expect(service.updateProfile).toHaveBeenCalledWith({ color: 'purple' });
    expect(byId('profile-color-purple')?.getAttribute('aria-checked')).toBe(
      'true',
    );

    spectator.click('[data-testid="profile-color-auto"]');
    expect(service.updateProfile).toHaveBeenLastCalledWith({ color: null });
  });

  it('forgets the profile when the player signs out', () => {
    render();
    user.set(null);
    spectator.detectChanges();

    expect(byId('profile-signed-out')).toBeTruthy();
  });
});
