import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { AccountService } from '@libs/account';
import { environment } from '@libs/environment';
import { HeaderAccount, HeaderComponent } from '@libs/ui';

/** Waits for the browser to be idle — `requestIdleCallback` where there is one. */
function whenIdle(run: () => void): void {
  const idle = (
    globalThis as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
    }
  ).requestIdleCallback;
  if (idle) idle(run, { timeout: 2_000 });
  else setTimeout(run, 200);
}

@Component({
  imports: [RouterModule, HeaderComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App {
  protected title = 'demo-app';
  protected readonly repoUrl = environment.repoUrl;
  private readonly account = inject(AccountService);

  /**
   * The header's account menu, from the shared account state. Sign-in is
   * composed here, in the app: the header stays presentational and the UI
   * library never sees an auth library.
   */
  protected readonly headerAccount = computed((): HeaderAccount => {
    const account = this.account;
    if (!account.available) return { state: 'off' };
    if (!account.ready()) return { state: 'loading' };
    const user = account.user();
    if (!user) {
      const code = account.error();
      return {
        state: 'signed-out',
        busy: account.busy(),
        errorKey: code ? `ONLINE.AUTH_ERROR.${code}` : null,
      };
    }
    return {
      state: 'signed-in',
      name: user.displayName || user.email.split('@')[0] || user.email,
      verified: user.emailVerified,
    };
  });

  constructor() {
    // The header shows who is signed in on every page, so the session is
    // restored here — once the page has painted and the browser is idle, so
    // the sign-in SDK never delays the first screen. Pages that need it
    // sooner start it themselves; it runs once either way.
    afterNextRender(() => whenIdle(() => void this.account.start()));
  }

  protected signInWithGoogle(): void {
    void this.account.signInWith('google');
  }

  protected signOut(): void {
    void this.account.signOut();
  }
}
