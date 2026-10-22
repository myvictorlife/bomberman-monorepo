import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Who is signed in, as the header shows it. Plain data, so this library never
 * depends on an auth library — the app maps its own account onto it.
 *
 * - `off`: no sign-in configured (a fork without Firebase): nothing is shown.
 * - `loading`: the saved session is still being restored.
 * - `signed-out`: may sign in; `errorKey` is the i18n key of the last failure.
 * - `signed-in`: `name` to show; `verified` false until the e-mail is confirmed.
 */
export type HeaderAccount =
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'signed-out'; busy?: boolean; errorKey?: string | null }
  | { state: 'signed-in'; name: string; verified: boolean };

/**
 * The header's account control: "Sign in" with Google in one click or by
 * e-mail on the profile page, or — signed in — the player's initial and name,
 * with the profile and "Sign out" a click away. `inline` lays the same
 * choices flat, for the mobile menu. Presentational: the app does the work.
 */
@Component({
  selector: 'lib-account-menu',
  imports: [NgTemplateOutlet, RouterLink, TranslatePipe],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class AccountMenuComponent {
  readonly account = input<HeaderAccount>({ state: 'off' });
  /** Laid flat, with no trigger: the mobile menu's version. */
  readonly inline = input(false);

  readonly signInWithGoogle = output<void>();
  readonly signOut = output<void>();
  /** The menu opened, so the header can close its other overlays. */
  readonly opened = output<void>();
  /** A choice was made: the mobile menu closes with it. */
  readonly done = output<void>();

  readonly open = signal(false);

  readonly signedIn = computed(() => {
    const a = this.account();
    return a.state === 'signed-in' ? a : null;
  });
  readonly signedOut = computed(() => {
    const a = this.account();
    return a.state === 'signed-out' ? a : null;
  });
  /** The first letter of the name, for the round badge. */
  readonly initial = computed(
    () => [...(this.signedIn()?.name.trim() ?? '?')][0]?.toUpperCase() ?? '?',
  );

  toggle(): void {
    this.open.update((open) => !open);
    if (this.open()) this.opened.emit();
  }

  close(): void {
    this.open.set(false);
  }

  google(): void {
    this.signInWithGoogle.emit();
    this.finish();
  }

  leave(): void {
    this.signOut.emit();
    this.finish();
  }

  /** A link or an action was chosen: the menu goes away. */
  finish(): void {
    this.close();
    this.done.emit();
  }
}
