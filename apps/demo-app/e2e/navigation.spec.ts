import { expect, test } from '@playwright/test';

/**
 * Routing, lazy loading and the 404 fallback.
 *
 * These are the parts a unit test can only assert trivially: `pages.routes.ts`
 * declares a `loadChildren`, and whether that chunk actually resolves depends on
 * the build, not on the declaration.
 */
test.describe('navigation', () => {
  test('renders the home page', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/.+/);
  });

  test('lazy-loads the profile feature', async ({ page }) => {
    await page.goto('/profile');

    await expect(page).toHaveURL(/\/profile$/);
    // Either the loaded profile or its error state — the API is not running in CI.
    // Both prove the lazy chunk resolved and the route's providers were created.
    await expect(page.locator('lib-profile')).toBeVisible();
  });

  test('lazy-loads the game and starts a match', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto('/play');

    // Phaser arrives in its own lazy chunk and draws into the arena host.
    await expect(
      page.locator('[data-testid="play-arena"] canvas'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="play-hud-player"]')).toHaveCount(
      2,
    );

    // Player 1 drops a bomb: the round keeps running and nothing throws.
    await page.keyboard.press('Space');
    await expect(
      page.locator('[data-testid="play-hud-player"]').first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('lazy-loads the roster, picks a character and takes it into the game', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto('/characters');

    // The sprite is painted on a real canvas by the game's own painter.
    const stage = page.locator('[data-testid="characters-stage"] canvas');
    await expect(stage).toBeVisible();
    await expect(stage).toHaveAttribute('data-facing', 'down');
    await expect(page.locator('[data-testid="characters-card"]')).toHaveCount(
      6,
    );

    await page.locator('[data-testid="characters-stage"]').click();
    await expect(stage).toHaveAttribute('data-facing', 'left');

    await page
      .locator('[data-testid="characters-card"][data-character="lia"]')
      .click();
    await expect(stage).toHaveAttribute('data-character', 'lia');
    await page
      .locator('[data-testid="characters-mount"][data-mount="pato"]')
      .click();
    await expect(stage).toHaveAttribute('data-mount', 'pato');

    // The choice survives navigation: the arena starts with it.
    await page.locator('[data-testid="characters-play"]').click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(
      page.locator('[data-testid="play-arena"] canvas'),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('puts each mount on a stage ridden by your character, with a video of its ability', async ({
    page,
  }) => {
    await page.goto('/mounts');
    await expect(page.locator('[data-testid="mounts-card"]')).toHaveCount(5);
    const stage = page.locator('[data-testid="mounts-stage"] canvas');
    await expect(stage).toHaveAttribute('data-mount', 'tatu');

    await page
      .locator('[data-testid="mounts-card"][data-mount="galinha"]')
      .click();
    await expect(stage).toHaveAttribute('data-mount', 'galinha');
    await page.locator('[data-testid="mounts-stage"]').click();
    await expect(stage).toHaveAttribute('data-facing', 'left');

    // Only the chosen mount's video shows, painted by the rules at the arena's size.
    // (`visible=true` as a child locator, not `:visible` in the string: Tailwind scans this file and chokes on it.)
    const video = page
      .locator('[data-testid="mounts-video"]')
      .locator('visible=true');
    await expect(video).toHaveAttribute('data-video', 'mount:galinha');
    await expect
      .poll(async () =>
        video.evaluate((c: HTMLCanvasElement) => [c.width, c.height]),
      )
      .toEqual([480, 416]);
    await expect(page.locator('[data-testid="mounts-story"]')).toBeVisible();
  });

  test('lists the arenas and starts a match on the chosen one', async ({
    page,
  }) => {
    await page.goto('/arenas');

    await expect(page.locator('[data-testid="arena-card"]')).toHaveCount(2);
    await page
      .locator('[data-map="autodromo"] [data-testid="arena-play"]')
      .click();

    await expect(page).toHaveURL(/\/play\?map=autodromo$/);
    await expect(
      page.locator('[data-testid="play-arena"] canvas'),
    ).toBeVisible();
  });

  test('opens an arena and an item up close', async ({ page }) => {
    await page.goto('/arenas');
    await page
      .locator('[data-map="subestacao"] [data-testid="arena-detail-link"]')
      .click();
    await expect(page).toHaveURL(/\/arenas\/subestacao$/);
    await expect(
      page.locator('[data-testid="arena-detail-preview"]'),
    ).toBeVisible();
    await expect(page.locator('lib-sprite-tile').first()).toBeVisible();

    await page.goto('/items/egg');
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('[data-testid="item-hatch"]').click();
    await expect(
      page.locator('[data-testid="item-stage"] canvas'),
    ).toBeVisible();

    await page.goto('/items/sword');
    await expect(page).toHaveURL(/\/items$/);
  });

  test('opens the audio gallery from the settings and plays from it', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('/settings');
    await page.locator('[data-testid="settings-sounds"]').click();
    await expect(page).toHaveURL(/\/settings\/audio$/);

    await page.locator('[data-effect="explode"]').click();
    await page.locator('[data-testid="sounds-theme"]').click();
    await expect(page.locator('[data-testid="sounds-theme"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.locator('[data-testid="sounds-line"]').first().click();
    expect(errors).toEqual([]);
  });

  test('sends the old audio address to the settings', async ({ page }) => {
    await page.goto('/sounds');
    await expect(page).toHaveURL(/\/settings\/audio$/);
    await expect(page.locator('[data-testid="sounds-theme"]')).toBeVisible();
  });

  test('lazy-loads the online room, whether or not a game server answers', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto('/online');

    await expect(page.locator('[data-testid="online-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="queue-panel"]')).toBeVisible();
    // Signed out, nobody can queue — with a server, without one, or in a build with none.
    await expect(page.locator('[data-testid="queue-join"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('lazy-loads the settings feature', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('lib-settings')).toBeVisible();
    await expect(page.getByRole('radiogroup')).toHaveCount(2);
  });

  test('renders the design system page', async ({ page }) => {
    await page.goto('/design');

    await expect(page.locator('h1')).toBeVisible();
  });

  test('falls back to the not-found page for an unknown route', async ({
    page,
  }) => {
    await page.goto('/this-route-does-not-exist');

    // A hosting rewrite that is misconfigured returns the raw 404 of the host
    // instead of the app — which is exactly what this catches on a deployed run.
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });

  test('plays a live preview on each mode card', async ({ page }) => {
    await page.goto('/');
    const videos = page.locator('[data-testid="home-mode-video"]');
    await expect(videos).toHaveCount(3);
    // Painted by the rules and the skin on a plain canvas: sized once set up.
    for (const video of await videos.all()) {
      await expect
        .poll(() => video.evaluate((c) => (c as HTMLCanvasElement).width))
        .toBeGreaterThan(0);
    }
    await expect(videos.nth(0)).toHaveAttribute('data-video', 'local');
    await expect(videos.nth(2)).toHaveAttribute('data-video', 'ranking');
  });

  test('sets a translated document title per route', async ({ page }) => {
    // The translated title lands once the i18n bundle has loaded; until then the
    // document still carries index.html's <title>. Wait for the strategy's
    // "Page · App" form instead of reading whatever is there at `load`.
    await page.goto('/');
    await expect(page).toHaveTitle(/ · /);
    const home = await page.title();

    await page.goto('/settings');
    await expect(page).toHaveTitle(/ · /);
    const settings = await page.title();

    expect(home).not.toBe(settings);
    // An untranslated title leaks the i18n key itself.
    expect(settings).not.toMatch(/^[A-Z_.]+$/);
  });
});
