import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoVideos, paintSprites, TEXTURE } from '@libs/game-client';
import { PowerUpKind } from '@libs/game-core';
import { ANALYTICS } from '@libs/analytics';
import { ButtonComponent, VirtualGamepadComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { IntroComponent } from './intro/intro';
import { CampaignTeaserComponent } from './campaign-teaser/campaign-teaser';
import { PodiumComponent } from './podium/podium';
import { RulesBoardComponent } from './rules-board/rules-board';
import { PodiumSceneComponent } from './podium-scene/podium-scene';
import { PowerUpOrbitComponent } from './power-up-orbit/power-up-orbit';
import { PresenceComponent } from './presence/presence';

interface GameMode {
  titleKey: string;
  descKey: string;
  /** Who plays and how, in a line above the title. */
  metaKey: string;
  /** The card's call to action, which says where it leads. */
  ctaKey: string;
  /** What the card's picture shows: a key of `demoScene`, or the campaign's painting. */
  video: 'local' | 'online' | 'campaign';
  link: string;
  /** The mode the page leads with: a larger card. */
  featured?: boolean;
}

interface Rule {
  step: number;
  titleKey: string;
  descKey: string;
}

interface PowerUpInfo {
  kind: PowerUpKind;
  titleKey: string;
  descKey: string;
}

/** A keyboard cluster as rows of keycaps; `null` is an empty slot. */
interface ControlScheme {
  player: number;
  /** The movement cluster as rows of keycaps; `null` is an empty slot. */
  rows: (string | null)[][];
  /** The other keys, as i18n keys of their caps: bomb, detonate, mount ability. */
  bombKey: string;
  detonateKey: string;
  abilityKey: string;
}

@Component({
  selector: 'app-home',
  imports: [
    ButtonComponent,
    RouterLink,
    TranslatePipe,
    IntroComponent,
    CampaignTeaserComponent,
    RulesBoardComponent,
    PodiumComponent,
    PodiumSceneComponent,
    PresenceComponent,
    PowerUpOrbitComponent,
    VirtualGamepadComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly analytics = inject(ANALYTICS);
  private readonly sprites =
    viewChildren<ElementRef<HTMLCanvasElement>>('sprite');
  private readonly videos =
    viewChildren<ElementRef<HTMLCanvasElement>>('modeVideo');
  private readonly podium = viewChild.required(PodiumComponent);
  /** Whether the podium has something to show; `off` hides its section. */
  readonly podiumStatus = computed(() => this.podium().status());

  readonly facts = ['HOME.FACT_1', 'HOME.FACT_2', 'HOME.FACT_3'];

  /** A mode card was opened. */
  trackMode(mode: GameMode['video']): void {
    this.analytics.logEvent('play_click', { mode, from: 'modes' });
  }

  /** A "play" button was pressed: which mode, and which of the page's buttons. */
  trackPlay(mode: 'online', from: 'hero' | 'band'): void {
    this.analytics.logEvent('play_click', { mode, from });
  }
  readonly ticker = [
    'HOME.TICKER_1',
    'HOME.TICKER_2',
    'HOME.TICKER_3',
    'HOME.TICKER_4',
  ];

  /** Sprites drifting around the hero stage. */
  readonly floaters = [
    TEXTURE.bomb(1),
    TEXTURE.powerUp('fire'),
    TEXTURE.powerUp('speed'),
  ];

  readonly modes: GameMode[] = [
    {
      titleKey: 'HOME.MODE_ONLINE_TITLE',
      descKey: 'HOME.MODE_ONLINE_DESC',
      metaKey: 'HOME.MODE_ONLINE_META',
      ctaKey: 'HOME.MODE_ONLINE_CTA',
      video: 'online',
      link: '/online',
      featured: true,
    },
    {
      titleKey: 'HOME.MODE_LOCAL_TITLE',
      descKey: 'HOME.MODE_LOCAL_DESC',
      metaKey: 'HOME.MODE_LOCAL_META',
      ctaKey: 'HOME.MODE_LOCAL_CTA',
      video: 'local',
      link: '/play',
    },
    {
      titleKey: 'HOME.MODE_CAMPAIGN_TITLE',
      descKey: 'HOME.MODE_CAMPAIGN_DESC',
      metaKey: 'HOME.MODE_CAMPAIGN_META',
      ctaKey: 'HOME.MODE_CAMPAIGN_CTA',
      video: 'campaign',
      link: '/campaign',
    },
  ];

  readonly rules: Rule[] = [1, 2, 3, 4].map((step) => ({
    step,
    titleKey: `HOME.HOW_${step}_TITLE`,
    descKey: `HOME.HOW_${step}_DESC`,
  }));
  /** The rule the board is acting out now. */
  readonly playingRule = signal(0);
  /** The rule pointed at, which holds the board on it. */
  readonly heldRule = signal<number | null>(null);

  readonly powerUps: PowerUpInfo[] = [
    {
      kind: 'bomb',
      titleKey: 'HOME.POWERUP_BOMB_TITLE',
      descKey: 'HOME.POWERUP_BOMB_DESC',
    },
    {
      kind: 'fire',
      titleKey: 'HOME.POWERUP_FIRE_TITLE',
      descKey: 'HOME.POWERUP_FIRE_DESC',
    },
    {
      kind: 'speed',
      titleKey: 'HOME.POWERUP_SPEED_TITLE',
      descKey: 'HOME.POWERUP_SPEED_DESC',
    },
    {
      kind: 'pierce',
      titleKey: 'HOME.POWERUP_PIERCE_TITLE',
      descKey: 'HOME.POWERUP_PIERCE_DESC',
    },
    {
      kind: 'remote',
      titleKey: 'HOME.POWERUP_REMOTE_TITLE',
      descKey: 'HOME.POWERUP_REMOTE_DESC',
    },
    {
      kind: 'vest',
      titleKey: 'HOME.POWERUP_VEST_TITLE',
      descKey: 'HOME.POWERUP_VEST_DESC',
    },
    {
      kind: 'glove',
      titleKey: 'HOME.POWERUP_GLOVE_TITLE',
      descKey: 'HOME.POWERUP_GLOVE_DESC',
    },
    {
      kind: 'kick',
      titleKey: 'HOME.POWERUP_KICK_TITLE',
      descKey: 'HOME.POWERUP_KICK_DESC',
    },
  ];

  readonly controls: ControlScheme[] = [
    {
      player: 1,
      rows: [
        [null, 'W', null],
        ['A', 'S', 'D'],
      ],
      bombKey: 'HOME.KEY_SPACE',
      detonateKey: 'HOME.KEY_E',
      abilityKey: 'HOME.KEY_SHIFT',
    },
    {
      player: 2,
      rows: [
        [null, '↑', null],
        ['←', '↓', '→'],
      ],
      bombKey: 'HOME.KEY_ENTER',
      detonateKey: 'HOME.KEY_SLASH',
      abilityKey: 'HOME.KEY_CTRL',
    },
  ];

  readonly powerUpTexture = (kind: PowerUpKind) => TEXTURE.powerUp(kind);
  readonly powerUpKinds = this.powerUps.map((p) => p.kind);
  /** The power-up whose card is pointed at; the orbit turns it to the front. */
  readonly activePowerUp = signal<PowerUpKind | null>(null);

  constructor() {
    // Canvas only exists in a browser; every paint is synchronous and the
    // textures are painted once, then shared by all the small canvases.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      for (const sprite of this.sprites()) {
        const keys = sprite.nativeElement.dataset['sprites']?.split(',') ?? [];
        paintSprites(sprite.nativeElement, keys);
      }
      // The hero's stage and the mode cards play little matches, run by the rules themselves.
      const videos = new DemoVideos(this.videos().map((v) => v.nativeElement));
      destroyRef.onDestroy(() => videos.stop());
    });
  }
}
