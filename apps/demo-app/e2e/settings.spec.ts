import { expect, test } from '@playwright/test';

/**
 * The settings feature end to end.
 *
 * The unit tests assert that the store forwards to `ThemeService` and
 * `UpdateLanguageService`. What they cannot assert is that the result reaches the
 * DOM and survives a reload — which is the entire point of these preferences.
 */
test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('lib-settings')).toBeVisible();
  });

  test('applies a theme choice to the document and persists it', async ({
    page,
  }) => {
    await page.getByRole('radio', { name: /dark/i }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('switching language re-renders the page in that language', async ({
    page,
  }) => {
    const heading = page.locator('lib-settings .page-header__title');
    const before = await heading.textContent();

    await page.getByRole('radio', { name: /portuguese|português/i }).click();

    await expect(heading).not.toHaveText(before ?? '');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  });

  test('language survives a reload', async ({ page }) => {
    await page.getByRole('radio', { name: /portuguese|português/i }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  });

  test('reduce motion toggles the document class and persists', async ({
    page,
  }) => {
    // Settings now has several switches; this test is about the motion one.
    const toggle = page.getByRole('switch', { name: /reduce motion/i });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  });
});
