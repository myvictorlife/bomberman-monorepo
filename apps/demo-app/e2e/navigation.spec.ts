import { devices, expect, test } from '@playwright/test';

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

  test('lazy-loads the game and starts a match', async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto('/play');

    // Phaser arrives in its own lazy chunk and draws into the arena host.
    await expect(
      page.locator('[data-testid="play-arena"] canvas'),
    ).toBeVisible();
    // A phone goes straight to game mode, where the HUD is a strip over the
    // arena behind "tap to play"; a desktop keeps the page's HUD list.
    if (isMobile) await page.locator('[data-testid="play-tap"]').tap();
    const hud = isMobile ? 'play-strip-player' : 'play-hud-player';
    await expect(page.locator(`[data-testid="${hud}"]`)).toHaveCount(2);

    // Player 1 drops a bomb: the round keeps running and nothing throws.
    await page.keyboard.press('Space');
    await expect(page.locator(`[data-testid="${hud}"]`).first()).toBeVisible();
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
      7,
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

    await expect(page.locator('[data-testid="arena-card"]')).toHaveCount(3);
    await page
      .locator('[data-map="autodromo"] [data-testid="arena-play"]')
      .click();

    await expect(page).toHaveURL(/\/play\?map=autodromo$/);
    await expect(
      page.locator('[data-testid="play-arena"] canvas'),
    ).toBeVisible();
  });

  test('shows the campaign map and the collection of bosses', async ({
    page,
  }) => {
    await page.goto('/campaign');

    await expect(page.locator('[data-testid="campaign-area"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="area-map-stop"]')).toHaveCount(6);
    await page.locator('[data-testid="area-map-stop"]').nth(5).click();
    await expect(
      page.locator('[data-testid="campaign-stage"]'),
    ).toHaveAttribute('data-stage', 'gramado-5');

    await page.locator('[data-testid="campaign-collection-link"]').click();
    await expect(page).toHaveURL(/\/campaign\/collection$/);
    await expect(page.locator('[data-testid="collection-boss"]')).toHaveCount(
      3,
    );
    await expect(
      page.locator('[data-testid="collection-boss"] canvas'),
    ).toHaveCount(1);
  });

  test('the stages are played signed in', async ({ page }) => {
    await page.goto('/campaign');

    // With sign-in configured, a signed-out player is offered it in place of
    // "play"; a build without it lets everyone play. Either way one shows.
    await expect(
      page
        .locator(
          '[data-testid="campaign-signin"], [data-testid="campaign-play"]:not([disabled])',
        )
        .first(),
    ).toBeVisible();

    // A direct link to a stage the player may not open goes back to the map.
    await page.goto('/campaign/play/gramado-3');
    await expect(page).toHaveURL(/\/campaign$/);
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
    // Theme, language and the keyboard hand.
    await expect(page.getByRole('radiogroup')).toHaveCount(3);
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

  test.describe('on a touch screen', () => {
    // A phone's screen with touch, on every project's browser: `isMobile`
    // (Chromium and WebKit only) would skip Firefox, and the device's
    // `defaultBrowserType` would force a worker of another kind.
    const { viewport, deviceScaleFactor } = devices['Pixel 7'];
    test.use({ viewport, deviceScaleFactor, hasTouch: true });

    test('plays from an on-screen controller in a full-screen game mode', async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));

      await page.goto('/play');
      await expect(
        page.locator('[data-testid="play-arena"] canvas'),
      ).toBeVisible();

      // A touch screen reports a coarse pointer: the page goes straight to
      // game mode, one player only, and waits for the tap that lets the
      // browser play sound.
      const layout = page.locator('[data-testid="play-page"]');
      await expect(layout).toHaveClass(/play--game/);
      await page.locator('[data-testid="play-tap"]').tap();
      await expect(page.locator('[data-testid="play-tap"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="play-setup-p2"]')).toHaveCount(
        0,
      );

      // Held upright, the game turns sideways: a quarter clockwise, so a push
      // towards the screen's right is the pad's "up". (Firefox's full screen
      // makes the window landscape instead, and then right is right.)
      const sideways = await page.evaluate(
        () => matchMedia('(orientation: portrait)').matches,
      );
      if (sideways) await expect(layout).toHaveClass(/play--sideways/);
      const pad = page.locator('[data-testid="gamepad-pad"]');
      await expect(pad).toBeVisible();
      const box = (await pad.boundingBox())!;
      const press = {
        clientX: box.x + box.width * 0.9,
        clientY: box.y + box.height / 2,
        pointerId: 1,
        pointerType: 'touch',
        bubbles: true,
      };
      await pad.dispatchEvent('pointerdown', press);
      await expect(pad).toHaveAttribute(
        'data-direction',
        sideways ? 'up' : 'right',
      );
      await pad.dispatchEvent('pointerup', press);
      await expect(pad).not.toHaveAttribute('data-direction', /./);

      // A bomb from the button: the round keeps running and nothing throws.
      await page.locator('[data-testid="gamepad-bomb"]').tap();
      await expect(
        page.locator('[data-testid="play-strip-player"]').first(),
      ).toBeVisible();

      // Leaving game mode brings the page back.
      await page.locator('[data-testid="play-expand"]').tap();
      await expect(layout).not.toHaveClass(/play--game/);
      await expect(page.locator('[data-testid="play-setup"]')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
});
