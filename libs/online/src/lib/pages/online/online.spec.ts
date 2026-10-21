import { ANALYTICS } from '@libs/analytics';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AUTH, AuthError, AuthErrorCode, AuthUser } from '@libs/auth';
import { environment } from '@libs/environment';
import { addOutsider, createGame, GameState } from '@libs/game-core';
import { ArenaHandle, ArenaOptions } from '@libs/game-client';
import {
  CLIENT_MESSAGE,
  FrameMessage,
  LobbySnapshot,
  PUBLIC_ROOM_RULES,
  SERVER_MESSAGE,
} from '@libs/game-protocol';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { OnlineStore } from '../../+state/online.store';
import {
  ARENA_CONNECTOR,
  ONLINE_ARENA_LAUNCHER,
} from '../../services/online.tokens';
import { FakeConnection } from '../../testing/fake-connection';
import { Online, roundKey, savedGuest } from './online';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** My hands on the round, as the arena hands them out for the on-screen controller. */
const padController = {
  press: vi.fn(),
  release: vi.fn(),
  clear: vi.fn(),
  bomb: vi.fn(),
  ability: vi.fn(),
  detonate: vi.fn(),
};

/** What the page tells analytics. */
const analytics = {
  initialize: vi.fn(),
  logEvent: vi.fn(),
  logPageView: vi.fn(),
};

function lobby(over: Partial<LobbySnapshot> = {}): LobbySnapshot {
  return {
    phase: 'waiting',
    queue: [],
    players: [],
    countdownEndsAt: null,
    resultsEndsAt: null,
    winnerId: null,
    now: Date.now(),
    rules: PUBLIC_ROOM_RULES,
    watchers: { names: [], anonymous: 0 },
    ...over,
  };
}

/** A frame of a round; the same ids mean the same round unless `round` says otherwise. */
function frame(
  ids: string[],
  mutate: (s: GameState) => void = () => undefined,
  round = roundOf(ids),
): FrameMessage {
  const state = createGame({
    seed: 1,
    players: ids.map((id) => ({ id, name: id })),
  });
  mutate(state);
  return { round, state, events: [] };
}

const roundOf = (ids: string[]) =>
  [...ids.join(',')].reduce((n, c) => n * 31 + c.charCodeAt(0), 0);

describe('Online', () => {
  let spectator: Spectator<Online>;
  let connection: FakeConnection;
  let launched: ArenaOptions[];
  let handles: {
    destroy: ReturnType<typeof vi.fn>;
    setMuted: ReturnType<typeof vi.fn>;
  }[];
  const user = signal<AuthUser | null>(null);
  const auth = {
    available: true,
    user,
    ready: signal(true),
    initialize: vi.fn(async () => undefined),
    signIn: vi.fn(async () => undefined),
    signInWith: vi.fn(async () => undefined),
    takeRedirectError: vi.fn((): AuthErrorCode | null => null),
    signUp: vi.fn(async () => undefined),
    signOut: vi.fn(async () => user.set(null)),
    sendVerificationEmail: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
    idToken: vi.fn(async () => 'token-1'),
  };
  const originalUrl = environment.gameServerUrl;

  const createComponent = createComponentFactory({
    component: Online,
    detectChanges: false,
    providers: [
      OnlineStore,
      provideRouter([]),
      provideTranslateService(),
      { provide: AUTH, useValue: auth },
      { provide: ANALYTICS, useValue: analytics },
      {
        provide: ARENA_CONNECTOR,
        useValue: async () => {
          connection = new FakeConnection();
          return connection;
        },
      },
      {
        provide: ONLINE_ARENA_LAUNCHER,
        useValue: async (
          _host: HTMLElement,
          options: ArenaOptions,
        ): Promise<ArenaHandle> => {
          launched.push(options);
          const handle = {
            destroy: vi.fn(),
            restart: vi.fn(),
            setMuted: vi.fn(),
            setMusic: vi.fn(),
            controller: vi.fn(() => padController),
          };
          handles.push(handle);
          return handle;
        },
      },
    ],
  });

  const render = async () => {
    spectator = createComponent();
    spectator.detectChanges();
    await flush();
    spectator.detectChanges();
  };

  beforeEach(() => {
    launched = [];
    handles = [];
    user.set(null);
    sessionStorage.clear();
    vi.clearAllMocks();
    environment.gameServerUrl = 'http://localhost:8086';
  });

  afterAll(() => {
    environment.gameServerUrl = originalUrl;
  });

  it('explains when this build has no game server', async () => {
    environment.gameServerUrl = null;
    await render();

    expect(spectator.query('[data-testid="online-unavailable"]')).toExist();
  });

  it('connects, shows the waiting room and asks a visitor to sign in to play', async () => {
    await render();
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ queue: [{ id: 'x', name: 'X', characterId: 'lia' }] }),
    );
    spectator.detectChanges();

    expect(auth.initialize).toHaveBeenCalled();
    expect(spectator.query('[data-testid="online-waiting"]')).toExist();
    expect(spectator.component.blocked()).toBe('sign-in');
  });

  describe('guests', () => {
    const identity = {
      id: 'guest:1',
      name: 'Visita',
      token: 'tok-1234567890abcdef',
    };

    it('plays as a guest: names itself, queues once the server answers, and comes back after a drop', async () => {
      await render();
      spectator.component.playAsGuest('Visita');
      expect(connection.sent).toContainEqual({
        type: CLIENT_MESSAGE.guest,
        payload: { name: 'Visita' },
      });
      expect(analytics.logEvent).toHaveBeenCalledWith('guest_start');

      connection.push(SERVER_MESSAGE.guest, identity);
      spectator.detectChanges();
      expect(connection.sent).toContainEqual({
        type: CLIENT_MESSAGE.joinQueue,
        payload: { characterId: spectator.component.characterId() },
      });
      expect(spectator.component.myId()).toBe('guest:1');
      expect(spectator.component.blocked()).toBeNull();
      expect(spectator.component.chatBlocked()).toBe('sign-in');
      expect(spectator.component.guestName()).toBe('Visita');
      expect(savedGuest()).toEqual({ name: 'Visita', token: identity.token });

      // The socket drops; the fresh one is the same guest, without queuing twice.
      connection.close();
      spectator.detectChanges();
      spectator.click('[data-testid="online-retry-now"]');
      await flush();
      spectator.detectChanges();
      expect(connection.sent).toEqual([
        {
          type: CLIENT_MESSAGE.guest,
          payload: { name: 'Visita', token: identity.token },
        },
      ]);
    });

    it('ends the guest when the player signs in', async () => {
      sessionStorage.setItem(
        'online.guest',
        JSON.stringify({ name: 'Visita', token: identity.token }),
      );
      await render();
      connection.push(SERVER_MESSAGE.guest, identity);
      spectator.detectChanges();

      user.set({
        id: 'me',
        email: 'me@x.dev',
        displayName: 'Me',
        emailVerified: true,
      });
      spectator.detectChanges();
      await flush();

      expect(connection.sent).toContainEqual({
        type: CLIENT_MESSAGE.hello,
        payload: { token: 'token-1' },
      });
      expect(spectator.component.guest()).toBeNull();
      expect(spectator.component.myId()).toBe('me');
      expect(savedGuest()).toBeNull();
    });

    it('says whether the round is ranked, and what a guest’s win would have been worth', async () => {
      await render();
      connection.push(SERVER_MESSAGE.guest, identity);
      const seat = (id: string) => ({
        id,
        name: id,
        characterId: 'lia' as const,
      });
      connection.push(
        SERVER_MESSAGE.lobby,
        lobby({ phase: 'playing', players: [seat('a'), seat('b')] }),
      );
      expect(spectator.component.ranked()).toBe(true);

      connection.push(
        SERVER_MESSAGE.lobby,
        lobby({
          phase: 'results',
          players: [seat('guest:1'), seat('a')],
          winnerId: 'guest:1',
        }),
      );
      spectator.detectChanges();
      expect(spectator.component.ranked()).toBe(false);
      expect(spectator.query('[data-testid="online-guest-won"]')).toExist();
    });
  });

  it('on a touch screen, joining fills the screen with the controller, which drives my hands', async () => {
    await render();
    expect(spectator.query('[data-testid="online-gamepad"]')).toBeNull();
    document.dispatchEvent(
      Object.assign(new MouseEvent('pointerdown', { bubbles: true }), {
        pointerType: 'touch',
      }),
    );
    spectator.detectChanges();
    expect(spectator.component.touch()).toBe(true);
    expect(spectator.component.expanded()).toBe(false);

    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreen;
    spectator.component.join();
    spectator.detectChanges();
    expect(spectator.component.expanded()).toBe(true);
    expect(requestFullscreen).toHaveBeenCalled();
    expect(spectator.query('[data-testid="online-layout"]')).toHaveClass(
      'online__layout--touch',
    );
    expect(spectator.query('[data-testid="online-gamepad"]')).toExist();

    // A round on: the pad presses go to my first keyboard scheme's tracker.
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();
    spectator.component.onPadDirection('up');
    expect(padController.press).toHaveBeenCalledWith('up');
    spectator.component.onPadDirection(null);
    expect(padController.release).toHaveBeenCalledWith('up');
    spectator.component.padBomb();
    expect(padController.bomb).toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    spectator.detectChanges();
    expect(spectator.component.expanded()).toBe(false);
    expect(spectator.query('[data-testid="online-gamepad"]')).toBeNull();
  });

  it('reconnects on its own when the server drops, sooner when the tab comes back or the button is pressed', async () => {
    await render();
    connection.close();
    spectator.detectChanges();
    expect(spectator.component.status()).toBe('reconnecting');
    expect(spectator.query('[data-testid="online-reconnecting"]')).toExist();

    spectator.click('[data-testid="online-retry-now"]');
    await flush();
    expect(spectator.component.status()).toBe('online');

    connection.close();
    spectator.detectChanges();
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(spectator.component.status()).toBe('online');
  });

  it('introduces a signed-in player to the server and lets them queue with their character', async () => {
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: false,
    });
    await render();
    await flush();

    expect(auth.idToken).toHaveBeenCalledWith(true);
    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.hello,
      payload: { token: 'token-1' },
    });
    expect(spectator.component.blocked()).toBe('verify');

    // Confirmed in another tab: a fresh hello goes out.
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: true,
    });
    spectator.detectChanges();
    await flush();
    connection.push(SERVER_MESSAGE.profile, {
      id: 'me',
      name: 'Me',
      wins: 0,
      matches: 0,
      visits: 1,
      firstSeenAt: 0,
      lastSeenAt: 0,
      returning: false,
      rank: null,
    });
    spectator.detectChanges();
    expect(
      connection.sent.filter((m) => m.type === CLIENT_MESSAGE.hello),
    ).toHaveLength(2);
    expect(spectator.component.blocked()).toBeNull();

    spectator.component.join();
    spectator.component.leave();
    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.joinQueue,
      payload: { characterId: spectator.component.characterId() },
    });
    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.leaveQueue,
      payload: undefined,
    });
  });

  it('gives up the place at once when the player signs out', async () => {
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: true,
    });
    await render();
    await flush();

    await spectator.component.signOut();
    spectator.detectChanges();
    await flush();

    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.signOut,
      payload: undefined,
    });
    expect(connection.left).toBe(false);
  });

  it('leaves the room when the page is destroyed, so coming back opens a fresh connection', async () => {
    await render();
    expect(connection.left).toBe(false);
    spectator.fixture.destroy();
    expect(connection.left).toBe(true);
  });

  it('hands the keys back to a reloaded page once it signs in, without a second arena', async () => {
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['me', 'b']));
    await flush();

    // Firebase restores the session after the first frame arrived.
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: true,
    });
    spectator.detectChanges();
    await flush();
    connection.push(
      SERVER_MESSAGE.frame,
      frame(['me', 'b'], (s) => (s.tick = 5)),
    );
    await flush();
    launched[0]?.session?.advance(16, { arrows: 'left' });

    expect(launched).toHaveLength(1);
    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.input,
      payload: { direction: 'left' },
    });
  });

  it('tells analytics about a queue join, and one round end per round', async () => {
    analytics.logEvent.mockClear();
    await render();
    spectator.component.join();
    expect(analytics.logEvent).toHaveBeenCalledWith('queue_join', {
      character: spectator.component.characterId(),
    });

    const players = [{ id: 'a', name: 'Ana', characterId: 'lia' as const }];
    connection.push(SERVER_MESSAGE.lobby, lobby({ phase: 'playing', players }));
    spectator.detectChanges();
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ phase: 'results', players, winnerId: 'a' }),
    );
    spectator.detectChanges();
    expect(analytics.logEvent).toHaveBeenCalledWith('round_end', {
      mode: 'online',
      winner: 'other',
      watching: true,
    });
    // The same results again is the same round; a draw after a new round is another.
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ phase: 'results', players, winnerId: 'a' }),
    );
    spectator.detectChanges();
    expect(
      analytics.logEvent.mock.calls.filter(([name]) => name === 'round_end'),
    ).toHaveLength(1);
    connection.push(SERVER_MESSAGE.lobby, lobby({ phase: 'playing', players }));
    spectator.detectChanges();
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ phase: 'results', players, winnerId: null }),
    );
    spectator.detectChanges();
    expect(analytics.logEvent).toHaveBeenLastCalledWith('round_end', {
      mode: 'online',
      winner: 'draw',
      watching: true,
    });
  });

  it('counts down and announces the winner', async () => {
    await render();
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ phase: 'countdown', countdownEndsAt: Date.now() + 9_500 }),
    );
    spectator.detectChanges();
    expect(spectator.component.secondsLeft()).toBe(10);
    expect(spectator.query('[data-testid="online-countdown"]')).toExist();

    const players = [{ id: 'a', name: 'Ana', characterId: 'lia' as const }];
    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ phase: 'results', players, winnerId: 'a' }),
    );
    spectator.detectChanges();
    expect(spectator.component.winner()?.name).toBe('Ana');
    expect(spectator.query('[data-testid="online-results"]')).toHaveText(
      'ONLINE.STAGE.WINNER',
    );

    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ phase: 'results', players, winnerId: null }),
    );
    spectator.detectChanges();
    expect(spectator.query('[data-testid="online-results"]')).toHaveText(
      'ONLINE.STAGE.DRAW',
    );
  });

  it('shows server errors, except the e-mail one the account panel already explains', async () => {
    await render();
    connection.push(SERVER_MESSAGE.error, { code: 'email-not-verified' });
    spectator.detectChanges();
    expect(
      spectator.query('[data-testid="online-server-error"]'),
    ).not.toExist();

    connection.push(SERVER_MESSAGE.error, { code: 'already-queued' });
    spectator.detectChanges();
    expect(spectator.query('[data-testid="online-server-error"]')).toHaveText(
      'ONLINE.SERVER_ERROR.already-queued',
    );
  });

  it('lets a spectator watch: the round is drawn without controls', async () => {
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();

    expect(launched).toHaveLength(1);
    expect(launched[0]?.session?.state.players.map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
    // The keys are bound but drive nobody.
    launched[0]?.session?.advance(16, { wasd: 'left' });
    expect(connection.sent.some((m) => m.type === CLIENT_MESSAGE.input)).toBe(
      false,
    );
    expect(spectator.component.watching()).toBe(true);
  });

  it('hides the clock and the players in full screen on a touch screen when asked, and remembers it', async () => {
    localStorage.removeItem('play.strip-hidden');
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();
    spectator.detectChanges();
    // Not in full screen, nor on a mouse: the bar stays and there is no button.
    expect(spectator.query('[data-testid="online-hud-bar"]')).toExist();
    expect(spectator.query('[data-testid="online-strip-toggle"]')).toBeNull();

    spectator.component.touch.set(true);
    spectator.component.expanded.set(true);
    spectator.detectChanges();
    expect(spectator.query('[data-testid="online-strip-toggle"]')).toExist();

    spectator.click('[data-testid="online-strip-toggle"]');
    expect(spectator.query('[data-testid="online-hud-bar"]')).toBeNull();
    expect(localStorage.getItem('play.strip-hidden')).toBe('1');

    // Out of full screen the bar is back whatever the choice.
    spectator.component.expanded.set(false);
    spectator.detectChanges();
    expect(spectator.query('[data-testid="online-hud-bar"]')).toExist();

    spectator.component.expanded.set(true);
    spectator.detectChanges();
    spectator.click('[data-testid="online-strip-toggle"]');
    expect(spectator.query('[data-testid="online-hud-bar"]')).toExist();
    expect(localStorage.getItem('play.strip-hidden')).toBe('0');
  });

  it('switches the sound off and on, for the arena on screen and for the next round', async () => {
    localStorage.removeItem('detona-audio');
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();
    spectator.detectChanges();
    expect(launched[0]?.muted).toBe(false);
    expect(spectator.query('[data-testid="online-sound"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    spectator.click('[data-testid="online-sound"]');
    expect(handles[0]?.setMuted).toHaveBeenCalledWith(true);
    expect(spectator.query('[data-testid="online-sound"]')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(spectator.query('[data-testid="online-sound"]')).toHaveAttribute(
      'aria-label',
      'PLAY.SOUND_OFF',
    );

    // The next round starts with the choice.
    connection.push(SERVER_MESSAGE.frame, frame(['c', 'd']));
    await flush();
    expect(launched[1]?.muted).toBe(true);

    spectator.click('[data-testid="online-sound"]');
    expect(handles[1]?.setMuted).toHaveBeenCalledWith(false);
  });

  it('gives a player both control schemes, feeds frames to the same round and remounts on a new one', async () => {
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: true,
    });
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['me', 'b']));
    await flush();
    expect(launched[0]?.controls.map((c) => c.playerId)).toEqual([
      'wasd',
      'arrows',
    ]);

    connection.push(
      SERVER_MESSAGE.frame,
      frame(['me', 'b'], (s) => (s.tick = 30)),
    );
    await flush();
    expect(launched).toHaveLength(1);
    expect(launched[0]?.session?.state.tick).toBe(30);

    // Same players, but the clock went back: a new round.
    connection.push(
      SERVER_MESSAGE.frame,
      frame(['me', 'b'], (s) => (s.tick = 1)),
    );
    await flush();
    expect(launched).toHaveLength(2);
    expect(handles[0]?.destroy).toHaveBeenCalled();

    launched[1]?.session?.advance(16, { wasd: 'left' });
    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.input,
      payload: { direction: 'left' },
    });
  });

  it('drops an arena that finishes loading after a newer round arrived', async () => {
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    connection.push(SERVER_MESSAGE.frame, frame(['c', 'd']));
    await flush();

    expect(handles[0]?.destroy).toHaveBeenCalled();
    expect(handles[1]?.destroy).not.toHaveBeenCalled();
  });

  it('runs the account actions and reports their errors', async () => {
    await render();

    await spectator.component.signUp({
      email: 'a@b.c',
      password: 'secret1',
      name: 'Ana',
    });
    expect(auth.signUp).toHaveBeenCalledWith('a@b.c', 'secret1', 'Ana');
    expect(spectator.component.notice()).toBe('verification-sent');

    auth.signIn.mockRejectedValueOnce(new AuthError('invalid-credentials'));
    await spectator.component.signIn({ email: 'a@b.c', password: 'bad' });
    expect(spectator.component.authError()).toBe('invalid-credentials');

    auth.sendPasswordReset.mockRejectedValueOnce(new Error('boom'));
    await spectator.component.resetPassword('a@b.c');
    expect(spectator.component.authError()).toBe('unknown');

    await spectator.component.resetPassword('a@b.c');
    expect(spectator.component.notice()).toBe('reset-sent');
    await spectator.component.resendVerification();
    expect(spectator.component.notice()).toBe('verification-sent');
    await spectator.component.checkVerification();
    expect(auth.reload).toHaveBeenCalled();
    expect(spectator.component.authBusy()).toBe(false);
  });

  it('signs in with Google, and keeps quiet when the popup is closed', async () => {
    await render();

    await spectator.component.signInWith('google');
    expect(auth.signInWith).toHaveBeenCalledWith('google');

    auth.signInWith.mockRejectedValueOnce(new AuthError('cancelled'));
    await spectator.component.signInWith('google');
    expect(spectator.component.authError()).toBeNull();

    auth.signInWith.mockRejectedValueOnce(new AuthError('popup-blocked'));
    await spectator.component.signInWith('google');
    expect(spectator.component.authError()).toBe('popup-blocked');
  });

  it('shows a sign-in that failed on the provider page, once back', async () => {
    auth.takeRedirectError.mockReturnValueOnce('network');
    await render();
    await Promise.resolve();

    expect(spectator.component.authError()).toBe('network');
  });

  it('keeps quiet when the provider page was left without signing in', async () => {
    auth.takeRedirectError.mockReturnValueOnce('cancelled');
    await render();
    await Promise.resolve();

    expect(spectator.component.authError()).toBeNull();
  });

  it('re-reads an unconfirmed account when the tab regains focus', async () => {
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: false,
    });
    await render();

    window.dispatchEvent(new Event('focus'));

    expect(auth.reload).toHaveBeenCalled();
  });

  it('cleans up the arena when the page is left', async () => {
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();

    spectator.fixture.destroy();

    expect(handles[0]?.destroy).toHaveBeenCalled();
  });

  it('lists who is watching', async () => {
    await render();
    expect(spectator.query('[data-testid="online-watchers"]')).toHaveText(
      'ONLINE.WATCHERS.NONE',
    );

    connection.push(
      SERVER_MESSAGE.lobby,
      lobby({ watchers: { names: ['Bia', 'Caio'], anonymous: 2 } }),
    );
    spectator.detectChanges();

    expect(spectator.query('[data-testid="online-watchers"]')).toHaveText(
      'Bia',
    );
    expect(spectator.query('[data-testid="online-watchers"]')).toHaveText(
      'Caio',
    );
    expect(
      spectator.query('[data-testid="online-watchers-anonymous"]'),
    ).toExist();
  });

  it('shows what each player picked up, from the arena HUD of the current round only', async () => {
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();
    const hud = (remote: boolean) => ({
      phase: 'playing' as const,
      winnerId: null,
      secondsLeft: 95,
      closing: false,
      players: [
        {
          id: 'a',
          slot: 0,
          colorSlot: 0,
          name: 'Ana',
          alive: true,
          bombs: 3,
          fire: 4,
          speed: 1,
          mount: 'tatu' as const,
          abilityReadyIn: 0,
          abilityActive: false,
          pierce: true,
          remote,
          glove: false,
          kick: false,
          vestSeconds: 5,
        },
      ],
    });

    launched[0]?.onHud?.(hud(true));
    spectator.detectChanges();
    expect(spectator.query('[data-testid="players-panel"]')).toHaveText('Ana');
    expect(spectator.query('[data-testid="online-clock"]')).toHaveText('1:35');
    expect(spectator.query('[data-testid="players-remote"]')).toExist();

    // A new round clears it, and the old arena can no longer write.
    connection.push(SERVER_MESSAGE.frame, frame(['c', 'd']));
    await flush();
    launched[0]?.onHud?.(hud(false));
    spectator.detectChanges();
    expect(spectator.query('[data-testid="players-panel"]')).not.toExist();
  });

  it('keys a round by its count and arena, not by its players', () => {
    const first = frame(['a', 'b'], undefined, 7);
    expect(roundKey(first)).toBe(`7|${first.state.mapId}`);
    expect(roundKey(frame(['a', 'b', 'x'], undefined, 7))).toBe(
      roundKey(first),
    );
  });

  it('hands you the keys when you step onto the border mid-round, in the same arena', async () => {
    user.set({
      id: 'me',
      email: 'me@x.dev',
      displayName: 'Me',
      emailVerified: true,
    });
    await render();
    connection.push(SERVER_MESSAGE.frame, frame(['a', 'b']));
    await flush();
    launched[0]?.session?.advance(16, { wasd: 'left' });
    expect(connection.sent.some((m) => m.type === CLIENT_MESSAGE.input)).toBe(
      false,
    );

    connection.push(
      SERVER_MESSAGE.frame,
      frame(['a', 'b'], (s) => {
        s.tick = 9;
        addOutsider(s, { id: 'me', name: 'Me' });
      }),
    );
    await flush();
    launched[0]?.session?.advance(16, { wasd: 'left' });

    expect(launched).toHaveLength(1);
    expect(connection.sent).toContainEqual({
      type: CLIENT_MESSAGE.input,
      payload: { direction: 'left' },
    });
  });

  it('expands the arena to the screen with the chat docked beside it, and comes back', async () => {
    await render();
    const layout = spectator.query<HTMLElement>(
      '[data-testid="online-layout"]',
    ) as HTMLElement;
    const request = vi.fn(async () => undefined);
    // Full screen is asked of the document, so a sideways turn of the layout survives it.
    document.documentElement.requestFullscreen = request;
    const exit = vi.fn(async () => undefined);
    document.exitFullscreen = exit;
    // jsdom has no Fullscreen API: stand one in for the test.
    let fullscreen: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreen,
    });

    spectator.click('[data-testid="online-expand"]');
    expect(layout).toHaveClass('online__layout--expanded');
    expect(spectator.query('[data-testid="chat-panel"]')).toHaveClass(
      'chat--dock',
    );
    expect(request).toHaveBeenCalledTimes(1);
    fullscreen = layout;

    // The button leaves full screen too.
    spectator.click('[data-testid="online-expand"]');
    expect(layout).not.toHaveClass('online__layout--expanded');
    expect(spectator.query('[data-testid="chat-panel"]')).not.toHaveClass(
      'chat--dock',
    );
    expect(exit).toHaveBeenCalledTimes(1);
    fullscreen = null;

    // Escape, or the browser dropping full screen on its own, both come back.
    spectator.click('[data-testid="online-expand"]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    spectator.detectChanges();
    expect(layout).not.toHaveClass('online__layout--expanded');

    spectator.click('[data-testid="online-expand"]');
    document.dispatchEvent(new Event('fullscreenchange'));
    spectator.detectChanges();
    expect(layout).not.toHaveClass('online__layout--expanded');
    // Nothing to exit when the browser already left; Escape outside does nothing.
    expect(exit).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spectator.component.expanded()).toBe(false);
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  });

  it('puts the top three on a podium and the rest of the ranking under it, from fourth place', async () => {
    await render();
    expect(
      spectator.query(
        '[data-testid="online-ranking"] [data-testid="ranking-empty"]',
      ),
    ).toExist();

    connection.push(SERVER_MESSAGE.ranking, [
      { id: 'a', name: 'Ana', wins: 9, matches: 10, characterId: 'lia' },
      { id: 'b', name: 'Bia', wins: 5, matches: 10 },
      { id: 'c', name: 'Caio', wins: 2, matches: 10 },
      { id: 'd', name: 'Dan', wins: 1, matches: 10 },
    ]);
    spectator.detectChanges();

    expect(spectator.queryAll('[data-testid="podium-step"]')).toHaveLength(3);
    expect(
      spectator.query('[data-testid="podium-step"][data-place="1"]'),
    ).toHaveText('Ana');
    const rest = spectator.queryAll(
      '[data-testid="online-ranking"] [data-testid="ranking-item"]',
    );
    expect(rest).toHaveLength(1);
    expect(rest[0]).toHaveText('4');
    expect(rest[0]).toHaveText('Dan');

    // The faces: the last character played, in the colour of the place; a face nobody told us wears the default.
    // No canvas in this DOM: a context that takes any call and any property,
    // and whose calls (a gradient, say) take any call in turn.
    const anything: unknown = new Proxy(() => anything, {
      get: () => anything,
      apply: () => anything,
      set: () => true,
    });
    const ctx = anything as CanvasRenderingContext2D;
    expect(() => spectator.component.paintFace(ctx, 'lia', 1)).not.toThrow();
    expect(() =>
      spectator.component.paintFace(ctx, undefined, 2),
    ).not.toThrow();
    expect(() =>
      spectator.component.paintFace(ctx, 'tiao', 3, 'pink'),
    ).not.toThrow();
  });

  it('names the chosen character', async () => {
    await render();
    expect(spectator.component.characterKey('lia')).toBe('CHARACTERS.LIA.NAME');
  });
});
