import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoVideos, paintSprites, TEXTURE } from '@libs/game-client';
import { PowerUpKind } from '@libs/game-core';
import { ANALYTICS } from '@libs/analytics';
import { ButtonComponent, VirtualGamepadComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { PodiumComponent } from './podium/podium';
import { PresenceComponent } from './presence/presence';

type ModeIcon = 'keyboard' | 'globe' | 'trophy';

interface GameMode {
  icon: ModeIcon;
  titleKey: string;
  descKey: string;
  /** What the card's little video shows: a key of `demoScene`, or the ranking. */
  video: 'local' | 'online' | 'ranking';
  /** Where the card leads, or `null` while the mode is not built yet. */
  link: string | null;
}

interface Rule {
  step: number;
  titleKey: string;
  descKey: string;
  /** Sprites from the game's skin that illustrate the rule. */
  sprites: string[];
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
    PodiumComponent,
    PresenceComponent,
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
      icon: 'keyboard',
      titleKey: 'HOME.MODE_LOCAL_TITLE',
      descKey: 'HOME.MODE_LOCAL_DESC',
      video: 'local',
      link: '/play',
    },
    {
      icon: 'globe',
      titleKey: 'HOME.MODE_ONLINE_TITLE',
      descKey: 'HOME.MODE_ONLINE_DESC',
      video: 'online',
      link: '/online',
    },
    {
      icon: 'trophy',
      titleKey: 'HOME.MODE_RANKING_TITLE',
      descKey: 'HOME.MODE_RANKING_DESC',
      video: 'ranking',
      link: '/online',
    },
  ];

  readonly rules: Rule[] = [
    [TEXTURE.bomb(1), TEXTURE.flame('center', 0)],
    [TEXTURE.flame('end-right', 0), TEXTURE.block],
    [
      TEXTURE.powerUp('bomb'),
      TEXTURE.powerUp('fire'),
      TEXTURE.powerUp('speed'),
    ],
    [TEXTURE.player(0, 'down', 0), TEXTURE.player(2, 'left', 0)],
  ].map((sprites, i) => ({
    step: i + 1,
    titleKey: `HOME.HOW_${i + 1}_TITLE`,
    descKey: `HOME.HOW_${i + 1}_DESC`,
    sprites,
  }));

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
