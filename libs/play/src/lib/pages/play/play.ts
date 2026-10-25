import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BOT_LEVELS, BotLevel, isBotLevel } from '@libs/game-ai';
import {
  ARROW_KEYS,
  ArenaHandle,
  hdSkin,
  ControlScheme,
  KeyBindings,
  PlayerController,
  WASD_KEYS,
} from '@libs/game-client';
import { ANALYTICS } from '@libs/analytics';
import { CharacterSelectionService } from '@libs/character-select';
import { ControlsSettingsService, KeyScheme } from '@libs/controls-settings';
import { DEFAULT_MAP_ID, isMapId, MapId, PlayerSetup } from '@libs/game-core';
import {
  AlertComponent,
  ButtonComponent,
  holdZoom,
  PadDirection,
  PlayerBadgesComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
  SpinnerComponent,
  VirtualGamepadComponent,
  readStripHidden,
  writeStripHidden,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { PlayStore } from '../../+state/play.store';
import { ARENA_LAUNCHER } from '../../services/arena-launcher';
import {
  botNumber,
  isBotId,
  matchPlayers,
  MatchSetup,
  maxBots,
  setupFromQuery,
  setupToQuery,
} from '../../services/match-setup';

/**
 * Two players on one keyboard, no bots. Player 1 is whoever was chosen on the
 * roster; player 2 gets the next character, so the two are never the same figure.
 */
export function localPlayers(
  chosen: PlayerSetup['characterId'],
): PlayerSetup[] {
  return matchPlayers(chosen, { bots: 0, level: 'medium', secondHuman: true })
    .players;
}

/**
 * The arena and the seed come from the URL — `/play?map=autodromo&seed=42` —
 * so a link to a match carries them. Anything unknown falls back to the
 * defaults: the first map, a fresh arena.
 */
export function matchFromQuery(params: { get(name: string): string | null }): {
  mapId: MapId;
  seed: number | undefined;
} {
  const map = params.get('map') ?? '';
  const seed = Number(params.get('seed'));
  return {
    mapId: isMapId(map) ? map : DEFAULT_MAP_ID,
    seed: Number.isInteger(seed) && seed > 0 ? seed : undefined,
  };
}

const KEYS: Record<KeyScheme, KeyBindings> = {
  wasd: WASD_KEYS,
  arrows: ARROW_KEYS,
};

/** Which keys drive whom: player 1 the chosen hand, a second player the other — alone, both. */
export function keyboardControls(
  scheme: KeyScheme,
  secondHuman: boolean,
): ControlScheme[] {
  const other: KeyScheme = scheme === 'wasd' ? 'arrows' : 'wasd';
  return [
    { playerId: 'p1', keys: KEYS[scheme] },
    { playerId: secondHuman ? 'p2' : 'p1', keys: KEYS[other] },
  ];
}

const KEY_SCHEME_OPTIONS: readonly SegmentedControlOption<KeyScheme>[] = [
  { value: 'wasd', labelKey: 'PLAY.KEYS_WASD' },
  { value: 'arrows', labelKey: 'PLAY.KEYS_ARROWS' },
];
/** Where the "play upright" choice is kept. */
const UPRIGHT_KEY = 'play.upright';

function readUpright(): boolean {
  try {
    return localStorage.getItem(UPRIGHT_KEY) === '1';
  } catch {
    return false;
  }
}

/** The element's screen rectangle with width and height swapped: its own size, a quarter turn later. */
function turnedRect(element: HTMLElement): DOMRect {
  const rect = HTMLElement.prototype.getBoundingClientRect.call(element);
  return new DOMRect(rect.x, rect.y, rect.height, rect.width);
}

/** `screen.orientation.lock` where it exists; a refusal is nothing to report. */
function lockOrientation(orientation: 'landscape'): void {
  const screenOrientation = globalThis.screen?.orientation as
    | { lock?: (o: string) => Promise<void> }
    | undefined;
  try {
    screenOrientation?.lock?.(orientation).catch(() => undefined);
  } catch {
    // Not a thing on this browser.
  }
}

function unlockOrientation(): void {
  try {
    globalThis.screen?.orientation?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}

const LEVEL_OPTIONS: readonly SegmentedControlOption<BotLevel>[] =
  BOT_LEVELS.map((level) => ({
    value: level,
    labelKey: `PLAY.LEVEL_${level.toUpperCase()}`,
  }));

@Component({
  selector: 'lib-play',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    SpinnerComponent,
    AlertComponent,
    PlayerBadgesComponent,
    SegmentedControlComponent,
    VirtualGamepadComponent,
  ],
  templateUrl: './play.html',
  styleUrls: ['./play.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'leaveGame()',
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class Play {
  private readonly store = inject(PlayStore);
  private readonly launch = inject(ARENA_LAUNCHER);
  private readonly selection = inject(CharacterSelectionService);
  private readonly controls = inject(ControlsSettingsService);
  private readonly analytics = inject(ANALYTICS);
  /** When the current round began, for `round_end`'s length; `null` between matches. */
  private roundStartedAt: number | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly arena = viewChild.required<ElementRef<HTMLElement>>('arena');
  private handle: ArenaHandle | null = null;
  /** Player 1's hands on the arena for the on-screen controller; `null` until it is up. */
  private controller: PlayerController | null = null;
  /** What the pad holds, released before the next direction is pressed. */
  private padHeld: PadDirection | null = null;
  private destroyed = false;
  /** Bumped on every launch, so an arena that finishes loading after a newer one was asked for is dropped. */
  private launches = 0;

  /** Who plays: read from the URL, changed from the setup panel. */
  readonly setup = signal<MatchSetup>(
    setupFromQuery(this.route.snapshot.queryParamMap),
  );
  readonly levelOptions = LEVEL_OPTIONS;
  readonly keySchemeOptions = KEY_SCHEME_OPTIONS;
  /** The hand player 1 drives with, shared with the settings page. */
  readonly keyScheme = this.controls.scheme;
  readonly isBot = isBotId;
  readonly botNumber = botNumber;

  readonly status = this.store.status;
  readonly players = this.store.players;
  readonly isOver = this.store.isOver;
  readonly winner = this.store.winner;
  readonly clock = this.store.clock;
  readonly closing = this.store.closing;
  readonly muted = this.store.muted;
  readonly music = this.store.music;
  readonly colors = hdSkin.playerColors;
  /** The arena this match is on, for the label above the canvas. */
  readonly mapId = matchFromQuery(this.route.snapshot.queryParamMap).mapId;

  /**
   * Whether this is a touch screen: a coarse pointer at load, or the first
   * touch. Decides the on-screen controller and hides the second keyboard
   * player — one phone, one player. A phone (coarse pointer) also goes
   * straight to game mode; a touch on a laptop's screen only readies the
   * controller, since it may have been a tap on the setup.
   */
  readonly touch = signal(false);
  /** Game mode: the page steps aside and the arena fills the screen. */
  readonly game = signal(false);
  /** The on-screen controller, forced on or off from the game's own buttons; `null` follows `touch`. */
  private readonly padChoice = signal<boolean | null>(null);
  readonly pad = computed(() => this.padChoice() ?? this.touch());
  /**
   * On a touch screen the round waits behind "tap to play": that tap is the
   * gesture the browser wants before it plays sound or goes full screen.
   */
  readonly tapToPlay = signal(false);
  /** Player 1's stats, for which controller buttons are worth showing. */
  readonly me = computed(() => this.players().find((p) => p.id === 'p1'));
  /** The screen is taller than wide: a phone held upright. */
  readonly portrait = signal(false);
  /** The player asked to play upright; remembered on this browser. */
  readonly upright = signal(readUpright());
  /** The strip over the arena is hidden, for the room; remembered, shared by every game page. */
  readonly stripHidden = signal(readStripHidden());
  /**
   * A touch screen held upright turns the whole game a quarter clockwise,
   * so the arena sits between the thumbs as if the phone were sideways —
   * whatever the rotation lock says — unless the player chose upright.
   */
  readonly sideways = computed(
    () => this.game() && this.touch() && this.portrait() && !this.upright(),
  );

  constructor() {
    // No browser zoom while the arena fills the screen: two thumbs read as a pinch.
    effect((onCleanup) => {
      if (this.game()) onCleanup(holdZoom());
    });
    // Phaser fits the canvas to the host's `getBoundingClientRect`, which a
    // turned ancestor reports in screen terms — width and height swapped.
    // Give it the host's own terms back while the game is sideways.
    effect(() => {
      const host = this.arena().nativeElement;
      const own = host as { getBoundingClientRect?: () => DOMRect };
      if (this.sideways()) own.getBoundingClientRect = () => turnedRect(host);
      else delete own.getBoundingClientRect;
    });
    // One `round_end` per round: when the arena reports it over, and once a
    // restart has started a new one, the next.
    effect(() => {
      if (!this.isOver()) {
        if (this.status() === 'ready' && this.roundStartedAt === null)
          this.roundStartedAt = Date.now();
        return;
      }
      if (this.roundStartedAt === null) return;
      const winner = this.winner();
      this.analytics.logEvent('round_end', {
        mode: 'local',
        map: this.mapId,
        winner: winner ? (isBotId(winner.id) ? 'bot' : 'human') : 'draw',
        seconds: Math.round((Date.now() - this.roundStartedAt) / 1000),
      });
      this.roundStartedAt = null;
    });
    // The canvas needs a laid-out host element, and only exists in a browser.
    afterNextRender(() => {
      this.watchOrientation();
      if (window.matchMedia?.('(pointer: coarse)').matches) {
        this.touched();
        this.game.set(true);
        this.tapToPlay.set(true);
      }
      // Dropping the second player above already started the match.
      if (this.launches === 0) void this.start();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.handle?.destroy();
      this.unwatchOrientation?.();
      if (document.fullscreenElement)
        document.exitFullscreen?.()?.catch(() => undefined);
    });
  }

  private unwatchOrientation: (() => void) | null = null;

  private watchOrientation(): void {
    const query = window.matchMedia?.('(orientation: portrait)');
    if (!query) return;
    const sync = () => this.portrait.set(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    this.unwatchOrientation = () => query.removeEventListener?.('change', sync);
  }

  restart(): void {
    this.handle?.restart();
  }

  /** A finger on the page, anywhere: this is a touch screen after all. */
  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch' && !this.touch()) this.touched();
  }

  /**
   * Fills the screen: the page goes fixed over everything and, where the
   * browser allows, the whole display. The canvas never remounts — Phaser
   * re-fits it to the stage on its own.
   */
  enterGame(): void {
    this.game.set(true);
    // The document, not the page element: a full-screen element gets the
    // browser's own `transform: none !important`, which would undo the
    // sideways turn below.
    const fullscreen = document.documentElement.requestFullscreen?.();
    // In full screen a phone may let the page pick the orientation (Android
    // does; an iPhone has neither). Sideways is the game's shape.
    fullscreen?.then(() => lockOrientation('landscape')).catch(() => undefined);
  }

  /** Back to the page. Also what Escape does — the browser's own exit is caught below. */
  leaveGame(): void {
    if (!this.game()) return;
    this.game.set(false);
    unlockOrientation();
    if (document.fullscreenElement)
      document.exitFullscreen?.()?.catch(() => undefined);
  }

  /** Shows or hides the strip with the clock and the players; the choice sticks. */
  toggleStrip(): void {
    this.stripHidden.set(!this.stripHidden());
    writeStripHidden(this.stripHidden());
  }

  /** Upright or sideways on a phone held upright; the choice sticks. */
  toggleUpright(): void {
    this.upright.set(!this.upright());
    this.releasePad();
    try {
      localStorage.setItem(UPRIGHT_KEY, this.upright() ? '1' : '0');
    } catch {
      // Private mode, or storage blocked: the choice lasts the visit.
    }
  }

  toggleGame(): void {
    if (this.game()) this.leaveGame();
    else this.enterGame();
  }

  /** The browser left full screen on its own (Escape, or a tab switch): follow it. */
  onFullscreenChange(): void {
    if (!document.fullscreenElement) this.leaveGame();
  }

  togglePad(): void {
    this.padChoice.set(!this.pad());
    if (this.pad()) return;
    this.releasePad();
  }

  /** The tap the round waited for: sound and full screen are allowed now, and the round starts fresh. */
  tapPlay(): void {
    this.tapToPlay.set(false);
    this.enterGame();
    this.handle?.restart();
  }

  /** The pad points somewhere new: let go of the old direction, hold the new one. */
  onPadDirection(direction: PadDirection | null): void {
    this.releasePad();
    this.padHeld = direction;
    if (direction) this.controller?.press(direction);
  }

  padBomb(): void {
    this.controller?.bomb();
  }

  padAbility(): void {
    this.controller?.ability();
  }

  padDetonate(): void {
    this.controller?.detonate();
  }

  private releasePad(): void {
    if (this.padHeld) this.controller?.release(this.padHeld);
    this.padHeld = null;
  }

  private touched(): void {
    this.touch.set(true);
    if (this.setup().secondHuman) this.setSecondHuman(false);
  }

  /** `0 … maxBots`, as the segmented control's options. */
  botCountOptions(): SegmentedControlOption[] {
    return Array.from({ length: maxBots(this.setup()) + 1 }, (_, n) => ({
      value: String(n),
      label: String(n),
    }));
  }

  setBots(value: string): void {
    this.configure({ bots: Number(value) });
  }

  setLevel(value: string): void {
    if (isBotLevel(value)) this.configure({ level: value });
  }

  /** The keys are bound when the arena starts: a new hand is a new match. */
  setKeyScheme(value: string): void {
    if (value !== 'wasd' && value !== 'arrows') return;
    this.controls.setScheme(value);
    this.configure({});
  }

  /** The keys line under the arena, for whoever holds that hand. */
  keysHint(scheme: KeyScheme): string {
    return scheme === 'wasd' ? 'PLAY.KEYS_WASD_HINT' : 'PLAY.KEYS_ARROWS_HINT';
  }

  setSecondHuman(on: boolean): void {
    this.configure({
      secondHuman: on,
      bots: Math.min(this.setup().bots, maxBots({ secondHuman: on })),
    });
  }

  /** A new line-up is a new match: the URL follows it and the arena starts over. */
  private configure(change: Partial<MatchSetup>): void {
    const next = { ...this.setup(), ...change };
    this.setup.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: setupToQuery(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.handle?.destroy();
    this.handle = null;
    this.controller = null;
    this.padHeld = null;
    this.store.reload();
    void this.start();
  }

  mountKey(id: string): string {
    return `MOUNTS.${id.toUpperCase()}.NAME`;
  }

  mapKey(id: string): string {
    return `MAPS.${id.toUpperCase()}.NAME`;
  }

  toggleMusic(): void {
    this.store.setMusic(!this.store.music());
    this.handle?.setMusic(this.store.music());
  }

  toggleSound(): void {
    this.store.setMuted(!this.store.muted());
    this.handle?.setMuted(this.store.muted());
  }

  private async start(): Promise<void> {
    const launch = ++this.launches;
    try {
      const { mapId, seed } = matchFromQuery(this.route.snapshot.queryParamMap);
      const setup = this.setup();
      const { players, bots } = matchPlayers(
        this.selection.selectedId(),
        setup,
      );
      const handle = await this.launch(this.arena().nativeElement, {
        players,
        bots,
        controls: keyboardControls(this.controls.scheme(), setup.secondHuman),
        mapId,
        seed,
        muted: this.store.muted(),
        music: this.store.music(),
        onHud: (hud) => this.store.applyHud(hud),
      });
      // Left the page, or asked for another line-up, while Phaser was still downloading.
      if (this.destroyed || launch !== this.launches) {
        handle.destroy();
        return;
      }
      this.handle = handle;
      this.controller = handle.controller('p1');
      this.store.setStatus('ready');
      this.analytics.logEvent('match_start', {
        map: mapId,
        bots: bots.length,
        level: setup.level,
        second_human: setup.secondHuman,
        touch: this.touch(),
      });
    } catch {
      if (launch === this.launches) this.store.setStatus('error');
    }
  }
}
