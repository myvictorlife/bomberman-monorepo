import { ANALYTICS } from '@libs/analytics';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../atoms/icon/icon';
import { ThemeToggleComponent } from '../../atoms/theme-toggle/theme-toggle';
import { LanguageSelectComponent } from '../../molecules/language-select/language-select';
import {
  AccountMenuComponent,
  HeaderAccount,
} from '../../molecules/account-menu/account-menu';

@Component({
  selector: 'lib-header',
  imports: [
    RouterLink,
    TranslatePipe,
    IconComponent,
    ThemeToggleComponent,
    LanguageSelectComponent,
    AccountMenuComponent,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Escape closes the menu. Bound on the document because the backdrop
    // swallows clicks but never receives keyboard focus.
    '(document:keydown.escape)': 'closeMobileMenu()',
  },
})
export class HeaderComponent {
  private readonly analytics = inject(ANALYTICS);

  /** The header's "play now" was pressed. */
  trackPlay(): void {
    this.analytics.logEvent('play_click', { mode: 'online', from: 'header' });
  }

  /**
   * URL of the repository this deployment was built from. `null` — the default,
   * and the state of any clone without `config/site.json` — renders no GitHub
   * link at all. An input rather than a read of `@libs/environment` so the
   * organism stays presentational; the app decides what, if anything, to link.
   */
  readonly repoUrl = input<string | null>(null);

  /**
   * Who is signed in. `off` — the default, and a fork without sign-in —
   * keeps the "play" button and the profile link; otherwise the account menu
   * takes the button's place. An input so the organism stays presentational.
   */
  readonly account = input<HeaderAccount>({ state: 'off' });
  /** "Continue with Google" was chosen in the account menu. */
  readonly signInWithGoogle = output<void>();
  readonly signOut = output<void>();

  readonly mobileMenuOpen = signal(false);

  private readonly languageSelect = viewChild(LanguageSelectComponent);
  private readonly accountMenu = viewChild(AccountMenuComponent);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
    // Two overlays open at once would overlap; the one just asked for wins.
    if (this.mobileMenuOpen()) {
      this.languageSelect()?.close();
      this.accountMenu()?.close();
    }
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  /** The language dropdown opened — same exclusivity rule, other direction. */
  onLanguageOpened(): void {
    this.closeMobileMenu();
    this.accountMenu()?.close();
  }

  /** The account menu opened — the other overlays close. */
  onAccountOpened(): void {
    this.closeMobileMenu();
    this.languageSelect()?.close();
  }
}
