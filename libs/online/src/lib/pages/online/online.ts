import { ANALYTICS } from '@libs/analytics';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudioSettingsService } from '@libs/audio-settings';
import { AUTH, AuthError, AuthErrorCode, AuthProvider } from '@libs/auth';
import { CharacterSelectionService } from '@libs/character-select';
import { environment } from '@libs/environment';
import {
  ARROW_KEYS,
  ArenaHandle,
  colorSlot,
  ControlScheme,
  formatClock,
  hdSkin,
  OnlineSession,
  paintCartoonCharacter,
  WASD_KEYS,
} from '@libs/game-client';
import {
  DEFAULT_CHARACTER_ID,
  GameState,
  isCharacterId,
  isPlayerColorId,
} from '@libs/game-core';
import {
  countsForRanking,
  FrameMessage,
  peopleNeeded,
  Reaction,
  RoomRules,
  secondsLeft,
} from '@libs/game-protocol';
import {
  AlertComponent,
  ButtonComponent,
  PodiumComponent,
  PodiumPainter,
  SpinnerComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { OnlineStore } from '../../+state/online.store';
import {
  AccountNotice,
  AccountPanelComponent,
  SignInRequest,
  SignUpRequest,
} from '../../molecules/account-panel/account-panel';
import { ChatPanelComponent } from '../../molecules/chat-panel/chat-panel';
import { PlayersPanelComponent } from '../../molecules/players-panel/players-panel';
import {
  JoinBlock,
  QueuePanelComponent,
} from '../../molecules/queue-panel/queue-panel';
import { RankingListComponent } from '../../molecules/ranking-list/ranking-list';
import { RulesPanelComponent } from '../../molecules/rules-panel/rules-panel';
import { ONLINE_ARENA_LAUNCHER } from '../../services/online.tokens';

/** Either hand drives your player online: both schemes map to you. */
export const ONLINE_CONTROLS: ControlScheme[] = [
  { playerId: 'wasd', keys: WASD_KEYS },
  { playerId: 'arrows', keys: ARROW_KEYS },
];

const GUEST_KEY = 'online.guest';

interface SavedGuest {
  name: string;
  token: string;
}

/**
 * The guest this tab played as, so a reload gets the same one back — and their
 * place, within the server's reconnect grace. Per tab, never shared; storage
 * may be off, and then a reload is a new guest.
 */
export function savedGuest(): SavedGuest | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(GUEST_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const { name, token } = (value ?? {}) as Partial<SavedGuest>;
    return typeof name === 'string' && typeof token === 'string'
      ? { name, token }
      : null;
  } catch {
    return null;
  }
}

function saveGuest(guest: SavedGuest | null): void {
  try {
    if (guest)
      globalThis.sessionStorage?.setItem(GUEST_KEY, JSON.stringify(guest));
    else globalThis.sessionStorage?.removeItem(GUEST_KEY);
  } catch {
    // Storage is off: the guest lasts as long as the connection.
  }
}

/**
 * A round is identified by the server's count and its arena; a new key means a
 * new round to draw. The players are not part of it: an outsider entering adds
 * one mid-round, and the arena must stay up.
 */
export function roundKey(frame: FrameMessage): string {
  return `${frame.round}|${frame.state.mapId}`;
}

/**
 * The public room: watch the round being played, queue for the next one, see
 * the ranking. A name is enough to play as a guest; signing in (e-mail
 * confirmed) is what lets the server count your wins, lets you write in the
 * chat, and notices when you come back.
 */
@Component({
  selector: 'lib-online',
  imports: [
    TranslatePipe,
    RouterLink,
    AlertComponent,
    ButtonComponent,
    SpinnerComponent,
    AccountPanelComponent,
    QueuePanelComponent,
    RankingListComponent,
    PlayersPanelComponent,
    RulesPanelComponent,
    ChatPanelComponent,
    PodiumComponent,
  ],
  templateUrl: './online.html',
  styleUrls: ['./online.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'collapse()',
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:visibilitychange)': 'onBackInView()',
    '(window:online)': 'onBackInView()',
  },
})
export class Online {
  private readonly store = inject(OnlineStore);
  private readonly launch = inject(ONLINE_ARENA_LAUNCHER);
  private readonly selection = inject(CharacterSelectionService);
  private readonly audio = inject(AudioSettingsService);
  private readonly arena = viewChild.required<ElementRef<HTMLElement>>('arena');
  private readonly layout =
    viewChild.required<ElementRef<HTMLElement>>('layout');
  readonly auth = inject(AUTH);

  readonly status = this.store.status;
  readonly lobby = this.store.lobby;
  readonly phase = this.store.phase;
  readonly reconnectAttempt = this.store.reconnectAttempt;
  readonly restarting = this.store.restarting;
  readonly queue = this.store.queue;
  readonly players = this.store.players;
  readonly ranking = this.store.ranking;
  readonly profile = this.store.profile;
  readonly guest = this.store.guest;
  readonly serverError = this.store.serverError;
  readonly watchers = this.store.watchers;
  readonly chat = this.store.chat;
  readonly chatError = this.store.chatError;
  readonly reactions = this.store.reactions;
  readonly rules = this.store.rules;
  readonly nextRules = this.store.nextRules;
  readonly admin = this.store.admin;
  /** Players of the round on screen, with what they picked up. */
  readonly hudPlayers = computed(() => this.store.hud()?.players ?? []);
  /** The round's clock as `m:ss`, or `null` with no round on. */
  readonly roundClock = computed(() => {
    const seconds = this.store.hud()?.secondsLeft;
    return seconds === null || seconds === undefined
      ? null
      : formatClock(seconds);
  });
  readonly roundClosing = computed(() => this.store.hud()?.closing ?? false);
  readonly colors = hdSkin.playerColors;
  /** A podium face: the player's character, in their colour or else the place's. */
  readonly paintFace: PodiumPainter = (ctx, characterId, place, color) =>
    paintCartoonCharacter(ctx, {
      characterId:
        characterId && isCharacterId(characterId)
          ? characterId
          : DEFAULT_CHARACTER_ID,
      facing: 'down',
      frame: 0,
      slot: isPlayerColorId(color) ? colorSlot(color) : place - 1,
    });
  readonly user = this.auth.user;
  readonly characterId = this.selection.selectedId;

  readonly authBusy = signal(false);
  readonly authError = signal<AuthErrorCode | null>(null);
  readonly notice = signal<AccountNotice | null>(null);
  /** Something is being drawn on the stage. */
  readonly watching = signal(false);
  /** The arena fills the screen with the chat docked beside it. */
  readonly expanded = signal(false);
  /** Ticks while the page is open, so the countdown re-renders each second. */
  private readonly clock = signal(Date.now());

  readonly myId = computed(() => this.user()?.id ?? this.guest()?.id ?? null);
  /** My name while I play as a guest; `null` with an account. */
  readonly guestName = computed(() =>
    this.user() ? null : (this.guest()?.name ?? null),
  );
  /** The round on screen counts for the ranking: two accounts or more in it. */
  readonly ranked = computed(() => countsForRanking(this.players()));
  /** I asked to leave when this round ends. */
  readonly leavingAfter = computed(() => {
    const id = this.myId();
    return id !== null && (this.lobby()?.leavingAfter ?? []).includes(id);
  });
  readonly secondsLeft = computed(() => {
    const lobby = this.lobby();
    const endsAt = lobby?.phase === 'countdown' ? lobby.countdownEndsAt : null;
    return secondsLeft(endsAt, this.clock(), this.store.clockOffset());
  });
  /** People needed for the countdown: one when bots fill the rest. */
  readonly minPlayers = computed(() => {
    const rules = this.lobby()?.rules;
    return rules ? peopleNeeded(rules) : 2;
  });
  readonly maxPlayers = computed(() => this.lobby()?.rules.maxPlayers ?? 5);
  /** How many of the queue stand on the border during a round; 0 when the room has none. */
  readonly outsiders = computed(() => this.lobby()?.rules.outsiders ?? 0);
  readonly winner = computed(() => {
    const lobby = this.lobby();
    return lobby?.players.find((p) => p.id === lobby.winnerId) ?? null;
  });
  /** I won the round just decided as a guest: an account would have counted it. */
  readonly guestWon = computed(() => {
    const id = this.guest()?.id;
    return !this.user() && id !== undefined && this.winner()?.id === id;
  });
  /** Why I cannot queue: without an account, until I play as a guest, the panel asks for a name. */
  readonly blocked = computed<JoinBlock>(() => {
    if (this.status() !== 'online') return 'offline';
    const user = this.user();
    if (!user) return this.guest() ? null : 'sign-in';
    if (!user.emailVerified || !this.profile()) return 'verify';
    return null;
  });
  /** Writing in the chat always takes a confirmed account. */
  readonly chatBlocked = computed<JoinBlock>(() => {
    if (this.status() !== 'online') return 'offline';
    const user = this.user();
    if (!user) return 'sign-in';
    if (!user.emailVerified || !this.profile()) return 'verify';
    return null;
  });

  private handle: ArenaHandle | null = null;
  private session: OnlineSession | null = null;
  private currentRound: string | null = null;
  private lastTick = 0;
  private destroyed = false;
  /** Which account (and verification state) the connection has been told about; `'guest'` when it was a guest. */
  private announced: string | null = null;
  /** Asked to play as a guest: queue as soon as the server says who we are. */
  private joinAsGuest = false;

  private readonly analytics = inject(ANALYTICS);

  constructor() {
    // One `round_end` per round the room decides, whether we played or watched.
    let lastPhase = this.phase();
    effect(() => {
      const phase = this.phase();
      if (phase === 'results' && lastPhase !== 'results') {
        const winner = this.winner();
        const me = this.myId();
        this.analytics.logEvent('round_end', {
          mode: 'online',
          winner: !winner ? 'draw' : winner.id === me ? 'me' : 'other',
          watching: !this.players().some((p) => p.id === me),
        });
      }
      lastPhase = phase;
    });
    const url = environment.gameServerUrl;
    if (url) void this.store.connect(url);
    else this.store.markUnavailable();
    void this.auth.initialize().then(() => {
      // Back from the provider's page: a failed sign-in is reported here.
      const code = this.auth.takeRedirectError();
      if (code && code !== 'cancelled') this.authError.set(code);
    });

    const stop = this.store.onFrame((frame) => this.onFrame(frame));
    const timer = setInterval(() => this.clock.set(Date.now()), 250);
    // Coming back from the confirmation e-mail in another tab.
    const onFocus = () => {
      if (this.user() && !this.user()?.emailVerified) void this.auth.reload();
    };
    globalThis.addEventListener?.('focus', onFocus);

    // Tell the server who is here whenever the account or its verification
    // changes — or, with no account, the guest this tab played as.
    effect(() => {
      const user = this.user();
      const online = this.status() === 'online';
      const resume = !user && online ? savedGuest() : null;
      const key = user
        ? `${user.id}:${user.emailVerified}`
        : resume
          ? 'guest'
          : null;
      if (!online) {
        this.announced = null;
        return;
      }
      if (key === this.announced) return;
      const wasSignedIn = this.announced !== null && this.announced !== 'guest';
      this.announced = key;
      // Signed in or out mid-round: hand the keys over without rebuilding the arena.
      this.session?.setControls(this.controlsFor(this.session.state));
      if (user) {
        // Signing in ends the guest: the server drops it on `hello`.
        saveGuest(null);
        untracked(() => this.store.forgetGuest());
        void this.sayHello();
      } else if (resume) this.store.playAsGuest(resume.name, resume.token);
      else if (wasSignedIn) this.store.signOut();
    });

    // The server said who we are as a guest: keep it for a reload, and queue if asked to.
    effect(() => {
      const guest = this.guest();
      if (!guest) return;
      saveGuest({ name: guest.name, token: guest.token });
      if (!this.joinAsGuest) return;
      this.joinAsGuest = false;
      untracked(() => this.join());
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      stop();
      clearInterval(timer);
      globalThis.removeEventListener?.('focus', onFocus);
      this.handle?.destroy();
      // Leave the room with the page: the store outlives it (route providers
      // are kept by the router), and a watcher who left should not count.
      this.store.disconnect();
    });
  }

  join(): void {
    this.store.joinQueue(this.characterId());
    this.analytics.logEvent('queue_join', { character: this.characterId() });
  }

  /** Plays without an account: the server names us, then we queue. */
  playAsGuest(name: string): void {
    this.joinAsGuest = true;
    const kept = savedGuest();
    this.store.playAsGuest(name, kept?.token);
    this.analytics.logEvent('guest_start');
  }

  leave(): void {
    this.store.leaveQueue();
  }

  leaveAfterRound(leave: boolean): void {
    this.store.leaveAfterRound(leave);
  }

  /** The room's admin changed a rule; it applies now or from the next round. */
  setRules(rules: Partial<RoomRules>): void {
    this.store.setRules(rules);
  }

  sendChat(text: string): void {
    this.store.sendChat(text);
  }

  react(emoji: Reaction): void {
    this.store.react(emoji);
  }

  /** Admin: removes a line from everyone's chat. */
  deleteChat(id: number): void {
    this.store.deleteChat(id);
  }

  /** Admin: silences an account in the chat until the server restarts. */
  muteChat(accountId: string): void {
    this.store.muteChat(accountId);
  }

  /** The button: try now rather than at the scheduled time. */
  retry(): void {
    this.store.reconnectNow();
  }

  /** The tab is visible again, or the network is back: no reason to wait out the pause. */
  onBackInView(): void {
    if (document.visibilityState === 'hidden') return;
    if (this.status() === 'reconnecting' || this.status() === 'offline')
      this.store.reconnectNow();
  }

  toggleExpanded(): void {
    if (this.expanded()) this.collapse();
    else this.expand();
  }

  /**
   * Fills the screen: the layout goes fixed over the page and, where the
   * browser allows it, the whole display. The canvas never remounts — Phaser
   * re-fits it to the stage on its own.
   */
  expand(): void {
    this.expanded.set(true);
    const element = this.layout().nativeElement;
    element.requestFullscreen?.()?.catch(() => undefined);
  }

  /** Back to the page. Also what Escape does — the browser's own exit is caught below. */
  collapse(): void {
    if (!this.expanded()) return;
    this.expanded.set(false);
    if (document.fullscreenElement)
      document.exitFullscreen?.()?.catch(() => undefined);
  }

  /** The browser left full screen on its own (Escape, or a tab switch): follow it. */
  onFullscreenChange(): void {
    if (!document.fullscreenElement) this.collapse();
  }

  characterKey(id: string): string {
    return `CHARACTERS.${id.toUpperCase()}.NAME`;
  }

  signIn(request: SignInRequest): Promise<void> {
    return this.authAction(() =>
      this.auth.signIn(request.email, request.password),
    );
  }

  signInWith(provider: AuthProvider): Promise<void> {
    return this.authAction(() => this.auth.signInWith(provider));
  }

  signUp(request: SignUpRequest): Promise<void> {
    return this.authAction(async () => {
      await this.auth.signUp(request.email, request.password, request.name);
      this.notice.set('verification-sent');
    });
  }

  signOut(): Promise<void> {
    return this.authAction(() => this.auth.signOut());
  }

  resendVerification(): Promise<void> {
    return this.authAction(async () => {
      await this.auth.sendVerificationEmail();
      this.notice.set('verification-sent');
    });
  }

  checkVerification(): Promise<void> {
    return this.authAction(() => this.auth.reload());
  }

  resetPassword(email: string): Promise<void> {
    return this.authAction(async () => {
      await this.auth.sendPasswordReset(email);
      this.notice.set('reset-sent');
    });
  }

  private async authAction(action: () => Promise<void>): Promise<void> {
    this.authBusy.set(true);
    this.authError.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'unknown';
      // Closing the provider's window is a choice, not a failure.
      if (code !== 'cancelled') this.authError.set(code);
    } finally {
      this.authBusy.set(false);
    }
  }

  private async sayHello(): Promise<void> {
    // A fresh token: right after the e-mail is confirmed, the cached one still says it is not.
    const token = await this.auth.idToken(true);
    if (token) this.store.hello(token);
  }

  /** Both schemes drive you when you are in the round or on its border; nothing otherwise. */
  private controlsFor(
    state: Pick<GameState, 'players' | 'outsiders'>,
  ): string[] {
    const me = this.myId();
    const mine =
      state.players.some((p) => p.id === me) ||
      state.outsiders.some((o) => o.id === me);
    return mine ? ONLINE_CONTROLS.map((c) => c.playerId) : [];
  }

  private onFrame(frame: FrameMessage): void {
    const key = roundKey(frame);
    const newRound =
      key !== this.currentRound || frame.state.tick < this.lastTick;
    this.lastTick = frame.state.tick;

    if (!newRound && this.session) {
      this.session.receive(frame);
      // Joining the queue mid-round puts you on the border: the keys are yours from this frame.
      this.session.setControls(this.controlsFor(frame.state));
      return;
    }

    this.currentRound = key;
    this.handle?.destroy();
    this.handle = null;
    const session = new OnlineSession(
      frame,
      this.controlsFor(frame.state),
      (input) => this.store.sendInput(input),
    );
    this.session = session;
    this.watching.set(true);
    this.store.applyHud(null);

    void this.launch(this.arena().nativeElement, {
      players: [],
      session,
      // Always bound: whether they drive anyone is the session's call, so
      // signing in mid-round never needs a second arena.
      controls: ONLINE_CONTROLS,
      muted: !this.audio.sfx(),
      music: false,
      onHud: (hud) => {
        if (this.session === session) this.store.applyHud(hud);
      },
    })
      .then((handle) => {
        // Left the page, or a newer round arrived, while Phaser was loading.
        if (this.destroyed || this.session !== session) handle.destroy();
        else this.handle = handle;
      })
      .catch(() => this.watching.set(false));
  }
}
