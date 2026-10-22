import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AccountPanelComponent,
  AccountService,
  SignInRequest,
  SignUpRequest,
} from '@libs/account';
import { AUTH, AuthProvider } from '@libs/auth';
import {
  CharacterId,
  DEFAULT_CHARACTER_ID,
  PlayerColorId,
} from '@libs/game-core';
import { colorSlot, paintCartoonCharacter } from '@libs/game-client';
import { parsePlayerName, PLAYER_NAME_LENGTH } from '@libs/game-protocol';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  IconComponent,
  SpinnerComponent,
  SpritePainter,
  SpriteTileComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { ProfileStore } from '../../+state/profile.store';
import { CharacterPickerComponent } from '../../molecules/character-picker/character-picker';
import { ColorPickerComponent } from '../../molecules/color-picker/color-picker';
import { ProfileService } from '../../services/profile/profile.service';

/** What the page shows: one of these at a time. */
export type ProfileView =
  | 'unavailable'
  | 'starting'
  | 'signed-out'
  /** Signed in, but the e-mail is not confirmed yet: the server will not keep a profile. */
  | 'verify'
  | 'loading'
  | 'error'
  | 'ready';

/**
 * The signed-in player's profile: the name on the ranking, the favourite
 * character and the colour, saved on the game server so they follow the
 * account to any device. Signed out, the page is where one signs in.
 */
@Component({
  selector: 'lib-profile',
  imports: [
    AccountPanelComponent,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    CharacterPickerComponent,
    ColorPickerComponent,
    IconComponent,
    NgTemplateOutlet,
    RouterLink,
    SpinnerComponent,
    SpriteTileComponent,
    TranslatePipe,
  ],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly store = inject(ProfileStore);
  private readonly auth = inject(AUTH);
  private readonly available = inject(ProfileService).available;
  /** Signing in happens here too: the header's "sign in with e-mail" lands on this page. */
  readonly account = inject(AccountService);

  readonly profile = this.store.profile;
  readonly saving = this.store.saving;
  readonly saveError = this.store.saveError;
  readonly nameLength = PLAYER_NAME_LENGTH;

  /** Signed-in account id, so a token refresh does not reload the page. */
  private readonly userId = computed(() => this.auth.user()?.id ?? null);

  readonly view = computed<ProfileView>(() => {
    if (!this.account.available) return 'unavailable';
    if (!this.auth.ready()) return 'starting';
    if (!this.userId()) return 'signed-out';
    if (!this.auth.user()?.emailVerified) return 'verify';
    if (!this.available) return 'unavailable';
    if (this.store.error()) return 'error';
    if (!this.profile()) return 'loading';
    return 'ready';
  });

  /** What is typed in the name field; follows the saved name until edited. */
  readonly nameDraft = linkedSignal(() => this.profile()?.name ?? '');
  /** The draft as the server would keep it, or `null` when it would refuse it. */
  readonly cleanName = computed(() => parsePlayerName(this.nameDraft()));
  readonly nameChanged = computed(
    () =>
      this.cleanName() !== null && this.cleanName() !== this.profile()?.name,
  );

  readonly character = computed<CharacterId>(
    () => this.profile()?.favoriteCharacterId ?? DEFAULT_CHARACTER_ID,
  );
  readonly color = computed<PlayerColorId | null>(
    () => this.profile()?.color ?? null,
  );
  readonly paintFace = computed<SpritePainter>(() => {
    const characterId = this.character();
    const color = this.color();
    return (ctx) =>
      paintCartoonCharacter(ctx, {
        characterId,
        facing: 'down',
        frame: 0,
        slot: color ? colorSlot(color) : 0,
      });
  });

  constructor() {
    void this.account.start();
    if (!this.available) return;
    effect(() => {
      const id = this.userId();
      untracked(() => (id ? this.store.fetchProfile() : this.store.clear()));
    });
  }

  signIn(request: SignInRequest): Promise<void> {
    return this.account.signIn(request.email, request.password);
  }

  signInWith(provider: AuthProvider): Promise<void> {
    return this.account.signInWith(provider);
  }

  signUp(request: SignUpRequest): Promise<void> {
    return this.account.signUp(request.email, request.password, request.name);
  }

  retry(): void {
    this.store.fetchProfile();
  }

  setName(value: string): void {
    this.nameDraft.set(value);
  }

  saveName(): void {
    const name = this.cleanName();
    if (name !== null && this.nameChanged()) this.store.save({ name });
  }

  pickCharacter(favoriteCharacterId: CharacterId): void {
    this.store.save({ favoriteCharacterId });
  }

  pickColor(color: PlayerColorId | null): void {
    this.store.save({ color });
  }
}
