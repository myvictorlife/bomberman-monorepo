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
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CharacterSelectionService } from '@libs/character-select';
import {
  ARROW_KEYS,
  ArenaHandle,
  formatClock,
  HudSnapshot,
  PlayerController,
  WASD_KEYS,
} from '@libs/game-client';
import { areaOfStage, bossOfArea, livesOf, stageCode } from '@libs/game-core';
import {
  AlertComponent,
  ButtonComponent,
  enterFullScreen,
  isTouchScreen,
  leaveFullScreen,
  measureTurned,
  PadDirection,
  PlayerBadgesComponent,
  readUpright,
  SpinnerComponent,
  VirtualGamepadComponent,
  watchPortrait,
  writeUpright,
  readStripHidden,
  writeStripHidden,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { CampaignProgressService } from '../../services/campaign-progress.service';
import { stageKey } from '../../services/i18n-keys';
import { bossKey } from '../../services/i18n-keys';
import { kitFromHud } from '../../services/kit-view';
import { areaStartId, canPlay, nextStageId } from '../../services/stage-access';
import { STAGE_LAUNCHER } from '../../services/stage-launcher';

export type StageStatus = 'loading' | 'ready' | 'error';

/** How long the title card stays up. */
export const INTRO_MS = 1800;

/**
 * One stage, played in this tab: the arena with the stage's creatures and
 * gate, the stage's own HUD, and what comes after — the next stage when it
 * is cleared, another go when it is not. A stage starts with the kit the last
 * one was cleared with; clearing it saves the stage and the kit, so the
 * player grows stronger stage after stage. Losing one costs a life and the
 * kit; the last life sends the player back to the area's first stage.
 *
 * Either hand of the keyboard drives the one player. On a phone the page
 * goes into game mode like `/play`: the arena fills the screen with the
 * on-screen controller over it, and a phone held upright turns the whole
 * game a quarter so it plays sideways — unless the player chose upright.
 */
@Component({
  selector: 'lib-campaign-stage',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    SpinnerComponent,
    AlertComponent,
    PlayerBadgesComponent,
    VirtualGamepadComponent,
  ],
  templateUrl: './stage.html',
  styleUrls: ['./stage.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'leaveGame()',
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class Stage {
  private readonly launch = inject(STAGE_LAUNCHER);
  private readonly selection = inject(CharacterSelectionService);
  private readonly progress = inject(CampaignProgressService);
  private readonly router = inject(Router);
  private readonly arena = viewChild.required<ElementRef<HTMLElement>>('arena');
  private handle: ArenaHandle | null = null;
  private controller: PlayerController | null = null;
  private padHeld: PadDirection | null = null;
  private destroyed = false;
  /** Bumped on every launch: an arena that loads after a newer one was asked for is dropped. */
  private launches = 0;

  readonly stageId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('stageId') ?? '')),
    { initialValue: '' },
  );
  readonly code = computed(() => stageCode(this.stageId()));
  readonly status = signal<StageStatus>('loading');
  readonly hud = signal<HudSnapshot | null>(null);
  readonly result = computed(() => this.hud()?.stage?.result ?? null);
  /** The player's HUD line: what they carry right now. */
  readonly me = computed(
    () => this.hud()?.players.find((p) => p.id === 'p1') ?? null,
  );
  readonly over = computed(() => this.hud()?.phase === 'over');
  readonly creaturesLeft = computed(
    () => this.hud()?.stage?.creaturesLeft ?? 0,
  );
  readonly exitOpen = computed(() => this.hud()?.stage?.exitOpen ?? false);
  /** The boss's health, one segment per hit, on a boss stage. */
  readonly boss = computed(() => {
    const boss = this.hud()?.stage?.boss;
    if (!boss) return null;
    return {
      ...boss,
      segments: Array.from({ length: boss.maxHp }, (_, i) => i < boss.hp),
    };
  });
  readonly bossId = computed(() =>
    bossOfArea(areaOfStage(this.stageId())?.id ?? 'gramado'),
  );
  readonly clock = computed(() => {
    const seconds = this.hud()?.secondsLeft;
    return seconds === null || seconds === undefined
      ? null
      : formatClock(seconds);
  });
  /** The stage after this one, when the player may go on to it once this is cleared. */
  readonly next = computed(() => {
    const id = nextStageId(this.stageId());
    if (!id) return null;
    const after = {
      cleared: [...this.progress.progress().cleared, this.stageId()],
    };
    return canPlay(after, id) ? id : null;
  });
  /** What the end of the stage did to the run, once it is saved. */
  readonly outcome = signal<'cleared' | 'retry' | 'game-over' | null>(null);
  /** The stage's points and extra lives so far. */
  readonly tally = computed(() => ({
    score: this.hud()?.stage?.score ?? 0,
    livesGained: this.hud()?.stage?.livesGained ?? 0,
  }));
  /** Lives and points as they stand: the run's, plus this stage's until it is saved. */
  readonly lives = computed(
    () =>
      livesOf(this.progress.progress()) +
      (this.outcome() ? 0 : this.tally().livesGained),
  );
  readonly score = computed(
    () =>
      (this.progress.progress().score ?? 0) +
      (this.outcome() ? 0 : this.tally().score),
  );
  readonly best = computed(() => this.progress.progress().best ?? 0);
  readonly bonus = computed(() => this.hud()?.stage?.bonus ?? false);
  /** The stage's title card, shown a moment as it starts. */
  readonly intro = signal(false);
  /** Where a lost stage sends the player: the first stage of its area. */
  readonly startId = computed(() => areaStartId(this.stageId()));
  readonly startCode = computed(() => stageCode(this.startId()));
  /** A touch screen: a coarse pointer at load, or the first touch. */
  readonly touch = signal(false);
  /** Game mode: the page steps aside and the arena fills the screen. */
  readonly game = signal(false);
  /** The on-screen controller, forced on or off from the game's buttons; `null` follows `touch`. */
  private readonly padChoice = signal<boolean | null>(null);
  readonly pad = computed(() => this.padChoice() ?? this.touch());
  /** On a phone the stage waits behind "tap to play": the gesture full screen and sound need. */
  readonly tapToPlay = signal(false);
  /** The screen is taller than wide: a phone held upright. */
  readonly portrait = signal(false);
  /** The player asked to play upright; shared with `/play`. */
  readonly upright = signal(readUpright());
  /** The strip over the arena is hidden, for the room; remembered, shared by every game page. */
  readonly stripHidden = signal(readStripHidden());
  /** A phone held upright plays the game turned a quarter, unless the player chose upright. */
  readonly sideways = computed(
    () => this.game() && this.touch() && this.portrait() && !this.upright(),
  );
  readonly stageKey = stageKey;
  readonly bossKey = bossKey;

  constructor() {
    // A cleared stage counts once, the moment the rules say so, and the kit
    // the player cleared it with goes on to the next stage.
    // A lost one costs everything: the kit and the area's stages.
    effect(() => {
      if (this.result() !== 'failed') return;
      untracked(() => {
        const over = this.progress.markFailed(this.stageId(), this.tally());
        this.outcome.set(over ? 'game-over' : 'retry');
      });
    });
    effect(() => {
      if (this.result() !== 'cleared') return;
      untracked(() => {
        const me = this.me();
        this.progress.markCleared(
          this.stageId(),
          me ? kitFromHud(me) : undefined,
          this.tally(),
        );
        this.outcome.set('cleared');
      });
    });
    // Phaser measures its host on screen; turned, it needs the host's own terms.
    effect(() => measureTurned(this.arena().nativeElement, this.sideways()));
    // The canvas needs a laid-out host; a new stage id (the "next" link) starts a new arena.
    let ready = false;
    effect(() => {
      const id = this.stageId();
      if (ready) untracked(() => void this.start(id));
    });
    let unwatch: (() => void) | null = null;
    afterNextRender(() => {
      ready = true;
      unwatch = watchPortrait((portrait) => this.portrait.set(portrait));
      if (isTouchScreen()) {
        this.touch.set(true);
        this.game.set(true);
        this.tapToPlay.set(true);
      }
      void this.start(this.stageId());
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.introTimer) clearTimeout(this.introTimer);
      this.handle?.destroy();
      unwatch?.();
      if (this.game()) leaveFullScreen();
    });
  }

  /**
   * After a lost stage: back to the first stage of the area, empty-handed.
   * Already there, a new arena starts at once; the kit is read again, so it
   * is the starting one.
   */
  startOver(): void {
    const id = this.outcome() === 'game-over' ? this.startId() : this.stageId();
    if (id === this.stageId()) void this.start(id);
    else void this.router.navigate(['/campaign/play', id]);
  }

  private introTimer: ReturnType<typeof setTimeout> | null = null;

  /** The title card: "Fase 1-2 · Coreto", for a moment over the arena. */
  private showIntro(): void {
    this.intro.set(true);
    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => this.intro.set(false), INTRO_MS);
  }

  /** Fills the screen; the canvas stays, Phaser re-fits it. */
  enterGame(): void {
    this.game.set(true);
    enterFullScreen();
  }

  /** Back to the page. Also what Escape does. */
  leaveGame(): void {
    if (!this.game()) return;
    this.game.set(false);
    leaveFullScreen();
  }

  toggleGame(): void {
    if (this.game()) this.leaveGame();
    else this.enterGame();
  }

  /** The browser left full screen on its own (Escape, a tab switch): follow it. */
  onFullscreenChange(): void {
    if (!document.fullscreenElement) this.leaveGame();
  }

  /** Shows or hides the strip with the clock and the players; the choice sticks. */
  toggleStrip(): void {
    this.stripHidden.set(!this.stripHidden());
    writeStripHidden(this.stripHidden());
  }

  /** Upright or sideways on a phone held upright; the choice sticks. */
  toggleUpright(): void {
    this.upright.set(!this.upright());
    writeUpright(this.upright());
    this.releasePad();
  }

  togglePad(): void {
    this.padChoice.set(!this.pad());
    if (!this.pad()) this.releasePad();
  }

  /** A finger on the page: this is a touch screen after all. */
  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') this.touch.set(true);
  }

  /** The tap the stage waited for: full screen and sound are allowed now, and the stage starts fresh. */
  tapPlay(): void {
    this.tapToPlay.set(false);
    this.enterGame();
    void this.start(this.stageId());
  }

  onPadDirection(direction: PadDirection | null): void {
    this.releasePad();
    this.padHeld = direction;
    if (direction) this.controller?.press(direction);
  }

  private releasePad(): void {
    if (this.padHeld) this.controller?.release(this.padHeld);
    this.padHeld = null;
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

  private async start(stageId: string): Promise<void> {
    const launch = ++this.launches;
    this.handle?.destroy();
    this.handle = null;
    this.controller = null;
    this.hud.set(null);
    this.outcome.set(null);
    this.status.set('loading');
    const kit = this.progress.progress().kit;
    try {
      const handle = await this.launch(this.arena().nativeElement, {
        stageId,
        players: [
          {
            id: 'p1',
            name: 'P1',
            characterId: this.selection.selectedId(),
            // What the last cleared stage left them with; nothing after a loss.
            ...(kit ? { kit } : {}),
          },
        ],
        // Alone at the keyboard: either hand plays.
        controls: [
          { playerId: 'p1', keys: WASD_KEYS },
          { playerId: 'p1', keys: ARROW_KEYS },
        ],
        onHud: (hud) => this.hud.set(hud),
      });
      if (this.destroyed || launch !== this.launches) {
        handle.destroy();
        return;
      }
      this.handle = handle;
      this.controller = handle.controller('p1');
      this.status.set('ready');
      this.showIntro();
    } catch {
      if (launch === this.launches) this.status.set('error');
    }
  }
}
