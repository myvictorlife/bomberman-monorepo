import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { AuthErrorCode, AuthProvider, AuthUser } from '@libs/auth';
import { PlayerProfile } from '@libs/game-protocol';
import { ButtonComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest extends SignInRequest {
  name: string;
}

export type AccountNotice = 'verification-sent' | 'reset-sent';

export const MIN_PASSWORD = 6;
export const NAME_LENGTH = { min: 2, max: 20 };

/**
 * Sign in, create an account, confirm the e-mail, or — once in — who you are
 * and how you are doing. Presentational: the page performs every action.
 */
@Component({
  selector: 'lib-account-panel',
  imports: [TranslatePipe, ButtonComponent],
  templateUrl: './account-panel.html',
  styleUrls: ['./account-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPanelComponent {
  readonly available = input(true);
  readonly ready = input(true);
  readonly user = input<AuthUser | null>(null);
  readonly profile = input<PlayerProfile | null>(null);
  readonly busy = input(false);
  readonly error = input<AuthErrorCode | null>(null);
  readonly notice = input<AccountNotice | null>(null);

  readonly signIn = output<SignInRequest>();
  readonly signUp = output<SignUpRequest>();
  readonly signInWith = output<AuthProvider>();
  readonly signOut = output<void>();
  readonly resendVerification = output<void>();
  readonly checkVerification = output<void>();
  readonly resetPassword = output<string>();

  readonly mode = signal<'sign-in' | 'sign-up'>('sign-in');
  readonly email = signal('');
  readonly password = signal('');
  readonly name = signal('');
  readonly minPassword = MIN_PASSWORD;
  readonly nameLength = NAME_LENGTH;

  readonly valid = computed(() => {
    const emailOk = /^\S+@\S+\.\S+$/.test(this.email().trim());
    const passwordOk = this.password().length >= MIN_PASSWORD;
    if (this.mode() === 'sign-in') return emailOk && passwordOk;
    const name = this.name().trim().length;
    return (
      emailOk &&
      passwordOk &&
      name >= NAME_LENGTH.min &&
      name <= NAME_LENGTH.max
    );
  });

  toggleMode(): void {
    this.mode.update((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'));
  }

  read(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(event: Event): void {
    event.preventDefault();
    if (!this.valid() || this.busy()) return;
    const credentials = {
      email: this.email().trim(),
      password: this.password(),
    };
    if (this.mode() === 'sign-in') this.signIn.emit(credentials);
    else this.signUp.emit({ ...credentials, name: this.name().trim() });
  }

  forgot(): void {
    if (this.email().trim()) this.resetPassword.emit(this.email().trim());
  }
}
