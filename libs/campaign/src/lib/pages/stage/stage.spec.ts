import { signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { CharacterSelectionService } from '@libs/character-select';
import {
  ArenaHandle,
  ArenaOptions,
  HudSnapshot,
  HudStage,
  PlayerController,
} from '@libs/game-client';
import { CampaignProgress, EMPTY_PROGRESS, START_KIT } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { CampaignProgressService } from '../../services/campaign-progress.service';
import { STAGE_LAUNCHER } from '../../services/stage-launcher';
import { Stage } from './stage';

const me = {
  id: 'p1',
  slot: 0,
  colorSlot: 0,
  name: 'P1',
  alive: false,
  bombs: 3,
  fire: 4,
  speed: 1,
  mount: 'tatu' as const,
  abilityReadyIn: 0,
  abilityActive: false,
  pierce: true,
  remote: false,
  glove: false,
  kick: true,
  vestSeconds: 0,
};

const hud = (
  stage: Pick<HudStage, 'creaturesLeft' | 'exitOpen' | 'result'> &
    Partial<HudStage>,
  phase: HudSnapshot['phase'] = 'playing',
): HudSnapshot => ({
  phase,
  winnerId: null,
  players: [me],
  secondsLeft: 125,
  closing: false,
  stage: { boss: null, score: 0, livesGained: 0, bonus: false, ...stage },
});

describe('Stage', () => {
  let spectator: Spectator<Stage>;
  let launched: ArenaOptions[];
  let handles: {
    restart: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }[];
  let controller: Record<keyof PlayerController, ReturnType<typeof vi.fn>>;
  let fail: boolean;
  const params = new BehaviorSubject(
    convertToParamMap({ stageId: 'gramado-1' }),
  );
  const progress = signal<CampaignProgress>(EMPTY_PROGRESS);
  const markCleared = vi.fn<
    (id: string, kit?: unknown, tally?: unknown) => void
  >((id) => progress.set({ cleared: [...progress().cleared, id] }));
  let gameOver = false;
  const markFailed = vi.fn(() => {
    progress.set(EMPTY_PROGRESS);
    return gameOver;
  });

  const createComponent = createComponentFactory({
    component: Stage,
    detectChanges: false,
    providers: [
      provideRouter([]),
      provideTranslateService({ lang: 'en' }),
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      {
        provide: CharacterSelectionService,
        useValue: { selectedId: () => 'lia' },
      },
      {
        provide: CampaignProgressService,
        useValue: { progress, markCleared, markFailed },
      },
      {
        provide: STAGE_LAUNCHER,
        useValue: async (_host: HTMLElement, options: ArenaOptions) => {
          if (fail) throw new Error('no canvas');
          launched.push(options);
          const handle = { restart: vi.fn(), destroy: vi.fn() };
          handles.push(handle);
          return {
            ...handle,
            setMuted: vi.fn(),
            setMusic: vi.fn(),
            controller: () => controller as unknown as PlayerController,
          } as unknown as ArenaHandle;
        },
      },
    ],
  });

  const settle = async () => {
    await new Promise((r) => setTimeout(r));
    spectator.detectChanges();
  };

  beforeEach(async () => {
    launched = [];
    handles = [];
    fail = false;
    controller = {
      press: vi.fn(),
      release: vi.fn(),
      bomb: vi.fn(),
      ability: vi.fn(),
      detonate: vi.fn(),
    } as never;
    progress.set(EMPTY_PROGRESS);
    markCleared.mockClear();
    params.next(convertToParamMap({ stageId: 'gramado-1' }));
    spectator = createComponent();
    spectator.detectChanges();
    await settle();
  });

  it('starts the stage with the chosen character, on either hand of the keyboard', () => {
    expect(launched).toHaveLength(1);
    expect(launched[0]).toEqual(
      expect.objectContaining({
        stageId: 'gramado-1',
        players: [{ id: 'p1', name: 'P1', characterId: 'lia' }],
      }),
    );
    expect(launched[0]?.controls.map((c) => c.playerId)).toEqual(['p1', 'p1']);
    expect(spectator.query('[data-testid="stage-title"]')).toHaveText(
      'STAGES.GRAMADO_1.NAME',
    );
  });

  it('shows the clock, the creatures left and the gate', () => {
    launched[0]?.onHud?.(
      hud({ creaturesLeft: 4, exitOpen: false, result: null }),
    );
    spectator.detectChanges();

    expect(spectator.query('[data-testid="stage-hud"]')).toContainText('2:05');
    expect(spectator.query('[data-testid="stage-creatures"]')).toContainText(
      '4',
    );
    expect(spectator.query('[data-testid="stage-exit"]')).toHaveText(
      'STAGE_PLAY.EXIT_SHUT',
    );

    launched[0]?.onHud?.(
      hud({ creaturesLeft: 0, exitOpen: true, result: null }),
    );
    spectator.detectChanges();
    expect(spectator.query('[data-testid="stage-exit"]')).toHaveClass(
      'stage__pill--open',
    );
  });

  it('saves a cleared stage once, with the kit it was cleared with, and offers the next one', () => {
    launched[0]?.onHud?.(
      hud({ creaturesLeft: 0, exitOpen: true, result: 'cleared' }, 'over'),
    );
    spectator.detectChanges();

    expect(markCleared).toHaveBeenCalledTimes(1);
    expect(markCleared).toHaveBeenCalledWith(
      'gramado-1',
      expect.objectContaining({ maxBombs: 3 }),
      { score: 0, livesGained: 0 },
    );
    expect(markCleared.mock.calls[0]?.[1]).toEqual({
      maxBombs: 3,
      fireRange: 4,
      speedLevel: 1,
      pierce: true,
      remote: false,
      glove: false,
      kick: true,
      wallPass: false,
      powerBomb: false,
      mountId: 'tatu',
    });
    expect(spectator.query('[data-testid="stage-result"]')).toHaveAttribute(
      'data-result',
      'cleared',
    );
    expect(spectator.query('[data-testid="stage-next"]')).toHaveAttribute(
      'href',
      '/campaign/play/gramado-2',
    );
  });

  it('starts the next stage with the kit the last one left', async () => {
    const kit = { ...START_KIT, maxBombs: 5 };
    progress.set({ cleared: ['gramado-1'], kit });
    params.next(convertToParamMap({ stageId: 'gramado-2' }));
    spectator.detectChanges();
    await settle();

    expect(launched.at(-1)?.players[0]?.kit).toEqual(kit);
  });

  it('shows the boss health on a boss stage, and a word for beating it', () => {
    launched[0]?.onHud?.(
      hud({
        creaturesLeft: 2,
        exitOpen: false,
        result: null,
        boss: { hp: 5, maxHp: 8 },
      }),
    );
    spectator.detectChanges();

    expect(spectator.query('[data-testid="stage-boss"]')).toContainText('5/8');
    expect(spectator.queryAll('.stage__boss-hp--gone')).toHaveLength(3);

    launched[0]?.onHud?.(
      hud(
        {
          creaturesLeft: 0,
          exitOpen: true,
          result: 'cleared',
          boss: { hp: 0, maxHp: 8 },
        },
        'over',
      ),
    );
    spectator.detectChanges();
    expect(spectator.query('[data-testid="stage-result"]')).toContainText(
      'STAGE_PLAY.BOSS_CLEARED_TEXT',
    );
  });

  it('shows what the player carries during the stage', () => {
    launched[0]?.onHud?.(
      hud({ creaturesLeft: 2, exitOpen: false, result: null }),
    );
    spectator.detectChanges();

    expect(spectator.query('[data-testid="stage-kit"]')).toExist();
  });

  it('a loss costs a life: the same stage again, empty-handed', async () => {
    launched[0]?.onHud?.(
      hud(
        { creaturesLeft: 3, exitOpen: false, result: 'failed', score: 200 },
        'over',
      ),
    );
    spectator.detectChanges();

    expect(markCleared).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith('gramado-1', {
      score: 200,
      livesGained: 0,
    });
    expect(spectator.query('[data-testid="stage-result"]')).toHaveAttribute(
      'data-outcome',
      'retry',
    );
    expect(spectator.query('[data-testid="stage-tally"]')).toContainText('200');
    expect(spectator.query('[data-testid="stage-retry"]')).toHaveText(
      'STAGE_PLAY.RETRY',
    );

    spectator.click('[data-testid="stage-retry"]');
    await settle();
    expect(handles[0]?.destroy).toHaveBeenCalled();
    expect(launched).toHaveLength(2);
    expect(launched[1]?.stageId).toBe('gramado-1');
    expect(launched[1]?.players[0]?.kit).toBeUndefined();
  });

  it('the last life lost is game over: back to the area start', async () => {
    gameOver = true;
    const router = spectator.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    params.next(convertToParamMap({ stageId: 'gramado-3' }));
    spectator.detectChanges();
    await settle();
    launched
      .at(-1)
      ?.onHud?.(
        hud({ creaturesLeft: 3, exitOpen: false, result: 'failed' }, 'over'),
      );
    spectator.detectChanges();

    expect(spectator.query('[data-testid="stage-retry"]')).toHaveText(
      'STAGE_PLAY.START_OVER',
    );
    spectator.click('[data-testid="stage-retry"]');

    expect(navigate).toHaveBeenCalledWith(['/campaign/play', 'gramado-1']);
    gameOver = false;
  });

  it('shows the title card as the stage starts, and lives and points', () => {
    expect(spectator.query('[data-testid="stage-intro"]')).toExist();
    expect(spectator.query('[data-testid="stage-lives"]')).toContainText('3');
    launched[0]?.onHud?.(
      hud({
        creaturesLeft: 3,
        exitOpen: false,
        result: null,
        score: 150,
        livesGained: 1,
      }),
    );
    spectator.detectChanges();
    expect(spectator.query('[data-testid="stage-lives"]')).toContainText('4');
    expect(spectator.query('[data-testid="stage-score"]')).toContainText('150');
  });

  it('hides the creature count on a bonus stage', () => {
    launched[0]?.onHud?.(
      hud({ creaturesLeft: 0, exitOpen: true, result: null, bonus: true }),
    );
    spectator.detectChanges();
    expect(spectator.query('[data-testid="stage-creatures"]')).not.toExist();
  });

  it('starts a new arena when the stage changes', async () => {
    params.next(convertToParamMap({ stageId: 'gramado-2' }));
    spectator.detectChanges();
    await settle();

    expect(handles[0]?.destroy).toHaveBeenCalled();
    expect(launched.at(-1)?.stageId).toBe('gramado-2');
  });

  it('goes into game mode and back, from the button and from the browser', () => {
    expect(spectator.query('[data-testid="stage-strip"]')).not.toExist();

    spectator.click('[data-testid="stage-expand"]');
    expect(spectator.component.game()).toBe(true);
    expect(spectator.query('[data-testid="stage-page"]')).toHaveClass(
      'stage--game',
    );
    expect(spectator.query('[data-testid="stage-strip"]')).toExist();

    spectator.component.onFullscreenChange();
    spectator.detectChanges();
    expect(spectator.component.game()).toBe(false);

    spectator.component.toggleGame();
    spectator.component.toggleGame();
    expect(spectator.component.game()).toBe(false);
    spectator.component.leaveGame();
    expect(spectator.component.game()).toBe(false);
  });

  it('turns sideways on a phone held upright, unless asked to stay upright', () => {
    spectator.component.onPointerDown({ pointerType: 'touch' } as PointerEvent);
    spectator.component.portrait.set(true);
    spectator.component.enterGame();
    spectator.detectChanges();

    expect(spectator.component.sideways()).toBe(true);
    expect(spectator.query('[data-testid="stage-page"]')).toHaveClass(
      'stage--sideways',
    );
    expect(spectator.query('[data-testid="stage-gamepad"]')).toExist();

    spectator.click('[data-testid="stage-turn"]');
    expect(spectator.component.upright()).toBe(true);
    expect(spectator.component.sideways()).toBe(false);
    spectator.component.toggleUpright();
    expect(spectator.component.sideways()).toBe(true);

    spectator.click('[data-testid="stage-pad"]');
    expect(spectator.query('[data-testid="stage-gamepad"]')).not.toExist();
    spectator.component.togglePad();
    spectator.detectChanges();
    expect(spectator.query('[data-testid="stage-gamepad"]')).toExist();
  });

  it('waits behind "tap to play" on a phone, then starts fresh in game mode', async () => {
    spectator.component.tapToPlay.set(true);
    spectator.detectChanges();
    expect(spectator.query('[data-testid="stage-tap"]')).toExist();

    spectator.click('[data-testid="stage-tap"]');
    await settle();

    expect(spectator.component.tapToPlay()).toBe(false);
    expect(spectator.component.game()).toBe(true);
    expect(launched).toHaveLength(2);
  });

  it('forwards the on-screen controller to the player', () => {
    spectator.component.onPadDirection('up');
    spectator.component.onPadDirection('left');
    spectator.component.onPadDirection(null);
    spectator.component.padBomb();
    spectator.component.padAbility();
    spectator.component.padDetonate();

    expect(controller.press).toHaveBeenCalledWith('up');
    expect(controller.release).toHaveBeenCalledWith('up');
    expect(controller.release).toHaveBeenCalledWith('left');
    expect(controller.bomb).toHaveBeenCalled();
    expect(controller.ability).toHaveBeenCalled();
    expect(controller.detonate).toHaveBeenCalled();
  });

  it('tears the arena down when the page is left', () => {
    spectator.fixture.destroy();
    expect(handles[0]?.destroy).toHaveBeenCalled();
  });

  it('says so when the arena cannot start', async () => {
    fail = true;
    params.next(convertToParamMap({ stageId: 'gramado-2' }));
    spectator.detectChanges();
    await settle();

    expect(spectator.component.status()).toBe('error');
  });
});
