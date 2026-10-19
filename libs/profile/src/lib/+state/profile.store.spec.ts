import { TestBed } from '@angular/core/testing';
import { CharacterSelectionService } from '@libs/character-select';
import { PlayerProfile } from '@libs/game-protocol';
import { Subject, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { ProfileService } from '../services/profile/profile.service';
import { ProfileStore, initialProfileState } from './profile.store';

const profile: PlayerProfile = {
  id: 'u1',
  name: 'Ana',
  nameChosen: false,
  wins: 2,
  matches: 3,
  visits: 1,
  firstSeenAt: 0,
  lastSeenAt: 0,
  returning: false,
  rank: 4,
};

describe('ProfileStore', () => {
  let profileService: { fetchProfile: Mock; updateProfile: Mock };
  let selection: { select: Mock };

  const setup = () => {
    profileService = {
      fetchProfile: vi.fn().mockReturnValue(of(profile)),
      updateProfile: vi.fn(),
    };
    selection = { select: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        { provide: ProfileService, useValue: profileService },
        { provide: CharacterSelectionService, useValue: selection },
      ],
    });
    return TestBed.inject(ProfileStore);
  };

  it('starts empty, idle and without an error', () => {
    const store = setup();

    expect(store.profile()).toBe(initialProfileState.profile);
    expect(store.loading()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.hasProfile()).toBe(false);
  });

  it('loads the profile, flagging loading while it is on its way', () => {
    const store = setup();
    const response = new Subject<PlayerProfile>();
    profileService.fetchProfile.mockReturnValue(response);

    store.fetchProfile();
    expect(store.loading()).toBe(true);

    response.next(profile);
    expect(store.profile()).toEqual(profile);
    expect(store.hasProfile()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('keeps the failure, and loads again after one', () => {
    const store = setup();
    profileService.fetchProfile.mockReturnValueOnce(
      throwError(() => 'network'),
    );

    store.fetchProfile();
    expect(store.error()).toBe('network');
    expect(store.loading()).toBe(false);

    store.fetchProfile();
    expect(store.error()).toBeNull();
    expect(store.profile()).toEqual(profile);
  });

  it('plays the favourite character in this browser too', () => {
    const store = setup();
    profileService.fetchProfile.mockReturnValue(
      of({ ...profile, favoriteCharacterId: 'lia' }),
    );

    store.fetchProfile();
    expect(selection.select).toHaveBeenCalledWith('lia');
  });

  it('saves a change and takes the answer as the profile', () => {
    const store = setup();
    const saved = { ...profile, favoriteCharacterId: 'tiao' as const };
    profileService.updateProfile.mockReturnValue(of(saved));

    store.save({ favoriteCharacterId: 'tiao' });

    expect(profileService.updateProfile).toHaveBeenCalledWith({
      favoriteCharacterId: 'tiao',
    });
    expect(store.profile()).toEqual(saved);
    expect(store.saving()).toBe(false);
    expect(selection.select).toHaveBeenCalledWith('tiao');
  });

  it('keeps why a change was refused, until the next one', () => {
    const store = setup();
    profileService.updateProfile.mockReturnValueOnce(
      throwError(() => 'name-taken'),
    );
    store.fetchProfile();

    store.save({ name: 'Bia' });
    expect(store.saveError()).toBe('name-taken');
    expect(store.profile()?.name).toBe('Ana');

    profileService.updateProfile.mockReturnValue(of(profile));
    store.save({ color: 'pink' });
    expect(store.saveError()).toBeNull();
  });

  it('forgets everything on clear', () => {
    const store = setup();
    store.fetchProfile();

    store.clear();
    expect(store.profile()).toBeNull();
  });
});
