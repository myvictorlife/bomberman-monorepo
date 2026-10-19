import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
  WASD_KEYS,
} from '@libs/game-client';
import { CharacterSelectionService } from '@libs/character-select';
import { DEFAULT_MAP_ID, isMapId, MapId, PlayerSetup } from '@libs/game-core';
import {
  AlertComponent,
  ButtonComponent,
  PlayerBadgesComponent,
  SegmentedControlComponent,
  SegmentedControlOption,
  SpinnerComponent,
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

const P1_CONTROLS: ControlScheme = { playerId: 'p1', keys: WASD_KEYS };
const P2_CONTROLS: ControlScheme = { playerId: 'p2', keys: ARROW_KEYS };

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
  ],
  templateUrl: './play.html',
  styleUrls: ['./play.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Play {
  private readonly store = inject(PlayStore);
  private readonly launch = inject(ARENA_LAUNCHER);
  private readonly selection = inject(CharacterSelectionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly arena = viewChild.required<ElementRef<HTMLElement>>('arena');
  private handle: ArenaHandle | null = null;
  private destroyed = false;
  /** Bumped on every launch, so an arena that finishes loading after a newer one was asked for is dropped. */
  private launches = 0;

  /** Who plays: read from the URL, changed from the setup panel. */
  readonly setup = signal<MatchSetup>(
    setupFromQuery(this.route.snapshot.queryParamMap),
  );
  readonly levelOptions = LEVEL_OPTIONS;
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

  constructor() {
    // The canvas needs a laid-out host element, and only exists in a browser.
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.handle?.destroy();
    });
  }

  restart(): void {
    this.handle?.restart();
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
        controls: setup.secondHuman
          ? [P1_CONTROLS, P2_CONTROLS]
          : [P1_CONTROLS],
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
      this.store.setStatus('ready');
    } catch {
      if (launch === this.launches) this.store.setStatus('error');
    }
  }
}
