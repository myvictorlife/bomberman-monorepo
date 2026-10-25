import {
  isDecided,
  MountId,
  BLOCK_BURN_TICKS,
  BOMB_FUSE_TICKS,
  BossBody,
  CreatureBody,
  isBossExposed,
  isExitOpen,
  isExitRevealed,
  DEATH_TICKS,
  Direction,
  findCreature,
  isArcLive,
  isBlackout,
  flightPosition,
  GameEvent,
  GameState,
  hasBombOut,
  isDashing,
  Outsider,
  Player,
  playerColor,
  ThrownBomb,
} from '@libs/game-core';
import * as Phaser from 'phaser';
import { mountMoment, powerUpMoment } from '../audio/quips';
import { Sfx } from '../audio/sfx';
import { Voice } from '../audio/voice';
import { ControlScheme, DirectionTracker, PlayerController } from '../controls';
import { HudSnapshot, sameHud, toHud } from '../hud';
import { flameFrame } from '../skins/flame-frame';
import { ARENA_THEMES } from '../skins/hd/themes';
import {
  ArenaMoment,
  blackoutAt,
  ALARM_SUFFIX,
  paintSweep,
  sweepAt,
} from '../skins/hd/themes/moments';
import type { BossPose } from '../creatures/creature-art';
import { ArenaSession } from '../session/arena-session';
import {
  FRAME_CHEER,
  FRAME_PLACE,
  FRAME_SCARED,
} from '../characters/cartoon/ink';
import { EGG_STAGES } from '../skins/hd/egg';
import { loadArenaTheme, tileTextureKey } from '../skins/hd/themes';
import { ArenaSkin } from '../skins/skin';
import { paintCreatureFrame } from '../creatures/paint-creature';
import { FACINGS, TEXTURE } from '../skins/texture-keys';

export interface ArenaSceneConfig {
  session: ArenaSession;
  controls: readonly ControlScheme[];
  skin: ArenaSkin;
  sfx: Sfx;
  voice: Voice;
  onHud?: (hud: HudSnapshot) => void;
}

const DEPTH = {
  tile: 0,
  burning: 1,
  shadow: 2,
  exit: 2.5,
  powerUp: 3,
  dark: 3.5,
  bomb: 4,
  flame: 5,
  player: 10,
  thrown: 40,
  // Above the vignette (fx - 1): it darkens the border wall they stand on.
  outsider: 99.5,
  fx: 100,
};
/** Players under a blackout: a silhouette, not gone. */
const DARK_TINT = 0x1c2130;
/** A pale rim marks an outsider as outside the round and lifts them off the dark wall. */
const OUTSIDER_GLOW = 0xf2f5ff;
/** Alternate floor cells are slightly darker — the arena's checkerboard. */
const CHECKER_TINT = 0xe6e6e6;
/** Standing, step, standing, other step — four ticks-of-8 per cycle. */
const WALK_CYCLE = [1, 0, 2, 0];
/** Standing, then the two idle moments, for a mount: the frames are the pose slots. */
const MOUNT_IDLE = [0, 3, 4, 3];
/** After this long standing still, in ticks, a player starts to fidget. */
const FIDGET_AFTER = 120;
/** One fidget, a frame every 10 ticks: weight onto one foot, back, onto the other, back. */
const FIDGET = [1, 1, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0];
/** How long a player holds the bomb-setting pose after placing one, in ticks. */
const PLACE_TICKS = 14;
/** The hit-stop: how long the arena freezes on an explosion, in ms (two frames). */
const FREEZE_MS = 34;
/** Share of the way to the view the camera covers each frame: a column takes a few frames. */
const VIEW_GLIDE = 0.18;
/** A bomb this close, with this much fuse left, is worth a scare. */
const SCARE_FUSE = Math.round(BOMB_FUSE_TICKS * 0.55);

type Image = Phaser.GameObjects.Image;

/**
 * Draws a {@link GameState} and feeds keyboard input into the session. It holds
 * no game logic: every frame it reads the state and makes the sprites match.
 */
export class ArenaScene extends Phaser.Scene {
  private tileImages: Image[] = [];
  private tileKeys: string[] = [];
  private readonly burning = new Map<string, Image>();
  private readonly powerUps = new Map<string, Image>();
  /** A soft pulsing glow under each power-up: pick me. */
  private readonly itemGlows = new Map<string, Image>();
  private readonly bombs = new Map<number, Image>();
  private readonly flames = new Map<string, Image>();
  private readonly players = new Map<string, Image>();
  /** When each player last set a bomb down: the crouch and the squash follow. */
  private readonly placedAt = new Map<string, number>();
  /** Until when the arena holds still after an explosion. */
  private freezeUntil = 0;
  /** The tick last rendered, to notice a restart. */
  private lastTick = -1;
  /** When each player last moved, for the fidget. */
  private readonly movedAt = new Map<string, number>();
  /** The fuse value at which each bomb last ticked, so a tick plays once. */
  private readonly ticked = new Map<number, number>();
  private readonly outsiders = new Map<string, Image>();
  private readonly thrown = new Map<number, Image>();
  /** Stage mode: the creatures, by id, and the gate once it is in the open. */
  private readonly creatures = new Map<number, Image>();
  private readonly exits = new Map<string, Image>();
  /** A boss stage: the boss (or the mound of earth it moves under), its cracks, its anthills. */
  private readonly bosses = new Map<string, Image>();
  private readonly cracks = new Map<string, Image>();
  private readonly shocks = new Map<string, Image>();
  private readonly lines = new Map<string, Image>();
  private readonly outsiderBombs = new Map<string, Image>();
  private readonly sparks = new Map<number, Image>();
  private readonly eyes = new Map<string, Image>();
  private readonly mounds = new Map<number, Image>();
  /** Snail slime on the floor, and the skull over a cursed player's head. */
  private readonly slime = new Map<string, Image>();
  private readonly gates = new Map<string, Image>();
  private readonly keys = new Map<string, Image>();
  private readonly helmets = new Map<string, Image>();
  private readonly skulls = new Map<string, Image>();
  /** Bombs held overhead with the glove, by holder. */
  private readonly held = new Map<string, Image>();
  /** Characters whose border textures the skin has painted so far. */
  private readonly outsiderLooks = new Set<string>();
  /** Slot and mount pairs whose riding textures the skin has painted so far. */
  private readonly mountLooks = new Set<string>();
  /** What the crates hide, shown while a Bernardo rider sniffs. */
  private readonly shadows = new Map<string, Image>();
  private readonly trackers = new Map<string, DirectionTracker>();
  private renderedState: GameState | null = null;
  private vignette: Image | null = null;
  /** The arena's special moment, from its theme; `null` on pixel skins. */
  private moment: ArenaMoment | null = null;
  /** How dark it is this frame, 0–1, under a blackout. */
  private dark = 0;
  private darkness: Phaser.GameObjects.Rectangle | null = null;
  /** The sweep's red line, under way or hidden. */
  private sweep: Image | null = null;
  /** Whether the eye is red this frame: a sweep is under way. */
  private sweeping = false;
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private lastHud: HudSnapshot | null = null;

  constructor(private readonly config: ArenaSceneConfig) {
    super('arena');
  }

  preload(): void {
    this.config.skin.load(
      this,
      this.config.session.state.players.map((p) => p.characterId),
      this.config.session.state.players.map(playerColor),
    );
    // The arena's look comes from the map's theme; pixel skins keep their own tiles.
    if (!this.config.skin.pixelArt)
      loadArenaTheme(
        this,
        this.config.session.state.mapId,
        this.config.skin.resolution ?? 1,
      );
  }

  create(): void {
    this.bindControls();
    if (!this.config.skin.pixelArt)
      this.moment =
        ARENA_THEMES[this.config.session.state.mapId]?.moment ?? null;
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      // A key released while the tab was hidden never sends its keyup.
      for (const tracker of this.trackers.values()) tracker.clear();
    });
    this.render();
  }

  override update(time: number, delta: number): void {
    // The hit-stop: a blast holds everything for two frames.
    if (time < this.freezeUntil) return;
    const directions: Record<string, Direction | null> = {};
    for (const [id, tracker] of this.trackers) directions[id] = tracker.current;
    const events = this.config.session.advance(delta, directions);
    this.render();
    this.playEffects(events);
  }

  private bindControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.yieldToTextFields(keyboard);
    const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<
      string,
      number
    >;

    for (const scheme of this.config.controls) {
      const tracker = this.trackerFor(scheme.playerId);
      for (const direction of FACINGS) {
        const key = keyboard.addKey(codes[scheme.keys[direction]] as number);
        key.on('down', () => tracker.press(direction));
        key.on('up', () => tracker.release(direction));
      }
      keyboard
        .addKey(codes[scheme.keys.bomb] as number)
        .on('down', () => this.config.session.pressBomb(scheme.playerId));
      keyboard
        .addKey(codes[scheme.keys.ability] as number)
        .on('down', () => this.config.session.pressAbility(scheme.playerId));
      keyboard
        .addKey(codes[scheme.keys.detonate] as number)
        .on('down', () => this.config.session.pressDetonate(scheme.playerId));
    }
  }

  /**
   * Hands on `playerId` that are not keys: a touch controller's. Safe to ask
   * for before the scene has booted — the tracker is made on first use and
   * the keys, bound later, share it.
   */
  controller(playerId: string): PlayerController {
    const tracker = this.trackerFor(playerId);
    const session = this.config.session;
    return {
      press: (direction) => tracker.press(direction),
      release: (direction) => tracker.release(direction),
      clear: () => tracker.clear(),
      bomb: () => session.pressBomb(playerId),
      ability: () => session.pressAbility(playerId),
      detonate: () => session.pressDetonate(playerId),
    };
  }

  /** One tracker per player, whoever asks first — keys and touch feed the same one. */
  private trackerFor(playerId: string): DirectionTracker {
    let tracker = this.trackers.get(playerId);
    if (!tracker) {
      tracker = new DirectionTracker();
      this.trackers.set(playerId, tracker);
    }
    return tracker;
  }

  /**
   * The keys are the page's while someone types — in the online chat, the
   * sign-in form: the arena stops reading them and stops swallowing them
   * (Phaser calls `preventDefault` on every bound key), and lets go of
   * whatever direction was held.
   */
  private yieldToTextFields(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
  ): void {
    if (typeof document === 'undefined') return;
    const sync = () => {
      // A focus change can land after the game is gone: nothing to sync then.
      if (!keyboard.manager) return;
      const typing = isTextField(document.activeElement);
      keyboard.enabled = !typing;
      if (typing) {
        keyboard.disableGlobalCapture();
        keyboard.resetKeys();
        for (const tracker of this.trackers.values()) tracker.clear();
      } else {
        keyboard.enableGlobalCapture();
      }
    };
    // `focusout` fires before the next element has focus: check once it has.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      pending = setTimeout(() => {
        pending = null;
        sync();
      });
    };
    // A click or tap on the arena takes the keys back. Phaser cancels the
    // pointer's default action on its canvas, which is what would have moved
    // focus off the text field — so do that part here.
    const takeBack = () => {
      const active = document.activeElement;
      if (isTextField(active)) (active as HTMLElement).blur();
    };
    const canvas = this.game.canvas;
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', later);
    canvas?.addEventListener('pointerdown', takeBack);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      if (pending !== null) clearTimeout(pending);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', later);
      canvas?.removeEventListener('pointerdown', takeBack);
    });
    sync();
  }

  private render(): void {
    const state = this.config.session.state;
    if (state !== this.renderedState) this.resetArena(state);

    this.renderView(state);
    this.renderMoment(state);
    this.renderTiles(state);
    this.renderBurningBlocks(state);
    this.renderExit(state);
    this.renderParts(state);
    this.renderFixtures(state);
    this.renderSlime(state);
    this.renderPowerUps(state);
    this.renderBombs(state);
    this.tintBombs(state);
    this.renderFlames(state);
    this.renderPlayers(state);
    this.renderCreatures(state);
    this.renderBoss(state);
    this.renderSkulls(state);
    this.renderOutsiders(state);
    this.renderThrownBombs(state);
    this.renderHeldBombs(state);

    const hud = toHud(state);
    if (!sameHud(this.lastHud, hud)) {
      this.lastHud = hud;
      this.config.onHud?.(hud);
    }
  }

  /** A new round is a new state object: drop every sprite of the old one. */
  private resetArena(state: GameState): void {
    for (const pool of [
      this.burning,
      this.powerUps,
      this.bombs,
      this.flames,
      this.players,
      this.outsiders,
      this.thrown,
      this.held,
      this.shadows,
      this.creatures,
      this.exits,
      this.bosses,
      this.cracks,
      this.mounds,
      this.slime,
      this.skulls,
      this.gates,
      this.keys,
      this.helmets,
      this.shocks,
      this.eyes,
      this.lines,
      this.sparks,
      this.outsiderBombs,
    ]) {
      for (const image of pool.values()) image.destroy();
      pool.clear();
    }
    for (const image of this.tileImages) image.destroy();
    this.tileImages = state.tiles.map((_, i) =>
      this.add
        .image(
          ...this.cellToPixel(i % state.cols, Math.floor(i / state.cols)),
          TEXTURE.floor,
        )
        .setDepth(DEPTH.tile),
    );
    this.tileKeys = state.tiles.map(() => '');
    this.renderedState = state;
    // The world is the whole arena; on a long stage the camera shows a screen of it.
    const size = this.config.skin.tileSize;
    this.cameras.main
      .setBounds(0, 0, state.cols * size, state.rows * size)
      .setScroll(this.viewX(state), 0);
    if (!this.vignette && !this.config.skin.pixelArt)
      this.vignette = this.addVignette();
    if (this.moment?.kind === 'rain' && !this.rain) this.rain = this.addRain();
    if (this.moment?.kind === 'blackout' && !this.darkness) {
      this.darkness = this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x02030a)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.dark)
        .setAlpha(0);
    }
    if (this.moment?.kind === 'sweep' && !this.sweep)
      this.sweep = this.addSweep();
  }

  /** Where the camera's left edge belongs: the first column in play, in pixels. */
  private viewX(state: GameState): number {
    return (state.stage?.view ?? 0) * this.config.skin.tileSize;
  }

  /** Glides the camera to the view: the rules move it a column at a time, the eye follows smoothly. */
  private renderView(state: GameState): void {
    const camera = this.cameras.main;
    const gap = this.viewX(state) - camera.scrollX;
    camera.scrollX += Math.abs(gap) < 1 ? gap : gap * VIEW_GLIDE;
  }

  /** The blackout, from the tick: a dark sheet over the arena, bombs and flames above it. */
  private renderMoment(state: GameState): void {
    // The Gato's blackouts come on top of the theme's own.
    const boss = state.stage?.boss ?? null;
    this.dark = Math.max(
      blackoutAt(this.moment, state.tick),
      isBlackout(state, boss) ? 1 : 0,
    );
    this.darkness?.setAlpha(0.86 * this.dark);
    const sweep = sweepAt(this.moment, state.tick);
    this.sweeping = sweep !== null;
    this.sweep
      ?.setVisible(sweep !== null)
      .setY((sweep ?? 0) * state.rows * this.config.skin.tileSize);
  }

  /** The sweep's band, painted once and moved down the arena while one is under way. */
  private addSweep(): Image | null {
    const key = 'sweep-band';
    const tile = this.config.skin.tileSize;
    const width = this.scale.width;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, width, 3 * tile);
      const ctx = texture?.getContext();
      if (!texture || !ctx) return null;
      paintSweep(ctx, width, 2.5 * tile, tile);
      texture.refresh();
    }
    return this.add
      .image(0, 0, key)
      .setOrigin(0, 2.5 / 3)
      .setScrollFactor(0)
      .setDepth(DEPTH.fx - 2)
      .setVisible(false);
  }

  /** Rain over the track: thin streaks falling across, lit by what is under them. */
  private addRain(): Phaser.GameObjects.Particles.ParticleEmitter | null {
    const key = 'rain-drop';
    // Everything here is in pixels, so the skin's resolution scales it all.
    const r = this.config.skin.resolution ?? 1;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, 4 * r, 28 * r);
      const ctx = texture?.getContext();
      if (!texture || !ctx) return null;
      ctx.scale(r, r);
      const g = ctx.createLinearGradient(0, 0, 0, 28);
      g.addColorStop(0, 'rgba(210, 230, 255, 0)');
      g.addColorStop(0.7, 'rgba(210, 230, 255, 0.9)');
      g.addColorStop(1, 'rgba(255, 255, 255, 1)');
      ctx.fillStyle = g;
      ctx.fillRect(1, 0, 2, 28);
      texture.refresh();
    }
    const width = this.scale.width;
    const height = this.scale.height;
    const emitter = this.add.particles(0, 0, key, {
      x: { min: -width * 0.15, max: width },
      y: -30 * r,
      lifespan: { min: 650, max: 900 },
      speedY: { min: 900 * r, max: 1200 * r },
      speedX: { min: 180 * r, max: 260 * r },
      rotate: -12,
      scaleY: { min: 0.7, max: 1.2 },
      alpha: { start: 0.55, end: 0.25 },
      quantity: 2,
      frequency: 24,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(DEPTH.fx).setScrollFactor(0);
    // A wet sheen over the asphalt: the floor catches the sky.
    this.add
      .rectangle(0, 0, width, height, 0x9ac7ff)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0.06)
      .setDepth(DEPTH.dark);
    return emitter;
  }

  /** Darkens the edges of the arena so the eye settles in the middle. */
  private addVignette(): Image {
    const width = this.scale.width;
    const height = this.scale.height;
    const texture = this.textures.createCanvas('vignette', width, height);
    const ctx = texture?.getContext();
    if (!texture || !ctx)
      return this.add.image(0, 0, TEXTURE.shadow).setVisible(false);
    const g = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    texture.refresh();
    return this.add
      .image(width / 2, height / 2, 'vignette')
      .setScrollFactor(0)
      .setDepth(DEPTH.fx - 1);
  }

  private cellToPixel(col: number, row: number): [number, number] {
    const size = this.config.skin.tileSize;
    return [col * size + size / 2, row * size + size / 2];
  }

  private renderTiles(state: GameState): void {
    const burning = new Set(
      state.burningBlocks.map((b) => b.row * state.cols + b.col),
    );
    const solid = (i: number) => state.tiles[i] !== 'empty' && !burning.has(i);

    state.tiles.forEach((tile, i) => {
      const col = i % state.cols;
      const row = Math.floor(i / state.cols);
      let key = tileTextureKey(state, col, row, tile, (c, r) =>
        solid(r * state.cols + c),
      );
      // A skin without theme tiles (the classic one) draws every wall alike.
      if (!this.textures.exists(key)) key = TEXTURE.wall;
      // The eye goes red while it sweeps, on a theme that paints it so.
      const alarm = `${key}${ALARM_SUFFIX}`;
      if (this.sweeping && this.textures.exists(alarm)) key = alarm;
      if (this.tileKeys[i] !== key) {
        const image = this.tileImages[i];
        image?.setTexture(key);
        const floor = key === TEXTURE.floor || key === TEXTURE.floorShadow;
        if (floor && (col + row) % 2 === 1) image?.setTint(CHECKER_TINT);
        else image?.clearTint();
        this.tileKeys[i] = key;
      }
    });
  }

  /** Keeps `pool` in step with `items`: creates, updates and removes images by key. */
  private sync<T, K>(
    pool: Map<K, Image>,
    items: readonly T[],
    keyOf: (item: T) => K,
    create: (item: T) => Image,
    update: (image: Image, item: T) => void,
  ): void {
    const seen = new Set<K>();
    for (const item of items) {
      const key = keyOf(item);
      seen.add(key);
      let image = pool.get(key);
      if (!image) {
        image = create(item);
        pool.set(key, image);
      }
      update(image, item);
    }
    for (const [key, image] of pool) {
      if (!seen.has(key)) {
        image.destroy();
        pool.delete(key);
      }
    }
  }

  private renderBurningBlocks(state: GameState): void {
    this.sync(
      this.burning,
      state.burningBlocks,
      (b) => `${b.col},${b.row}`,
      (b) =>
        this.add
          .image(...this.cellToPixel(b.col, b.row), TEXTURE.block)
          .setDepth(DEPTH.burning)
          .setTint(0xff9050),
      (image, b) => {
        // Glows, then crumbles: shrinks and fades while darkening to embers.
        const life = b.ticksLeft / BLOCK_BURN_TICKS;
        image.setAlpha(Math.min(1, life * 1.4)).setScale(0.55 + 0.45 * life);
        image.setTint(life > 0.5 ? 0xffa060 : 0x8a3a20);
      },
    );
  }

  private renderPowerUps(state: GameState): void {
    if (!this.config.skin.pixelArt) {
      this.sync(
        this.itemGlows,
        state.powerUps,
        (p) => `${p.col},${p.row}`,
        (p) =>
          this.add
            .image(...this.cellToPixel(p.col, p.row), TEXTURE.spark)
            .setDepth(DEPTH.powerUp - 0.5)
            .setBlendMode(Phaser.BlendModes.ADD),
        (image, p) => {
          const phase = state.tick / 10 + p.col * 0.7 + p.row * 1.3;
          image
            .setScale(1.15 + Math.sin(phase) * 0.12)
            .setAlpha(0.22 + (Math.sin(phase) + 1) * 0.12);
        },
      );
    }
    this.sync(
      this.powerUps,
      state.powerUps,
      (p) => `${p.col},${p.row}`,
      (p) =>
        this.add
          .image(...this.cellToPixel(p.col, p.row), TEXTURE.powerUp(p.kind))
          .setDepth(DEPTH.powerUp),
      (image, p) => {
        const [, y] = this.cellToPixel(p.col, p.row);
        const phase = state.tick / 12 + p.col + p.row;
        if (p.kind === 'egg') {
          // The egg sits on the floor, wobbles, and cracks as someone comes near.
          const stage = eggStage(state, p.col, p.row);
          image
            .setY(y)
            .setScale(1)
            .setAngle(Math.sin(phase * 1.6) * (3 + stage * 2));
          image.setTexture(
            stage === 0 ? TEXTURE.powerUp('egg') : TEXTURE.egg(stage),
          );
          return;
        }
        // Floats gently, each item slightly out of phase with the others.
        image.setY(y - this.tile * 0.04 + Math.sin(phase) * this.tile * 0.04);
        image.setScale(0.92 + Math.sin(phase) * 0.03);
      },
    );
  }

  private renderBombs(state: GameState): void {
    this.sync(
      this.bombs,
      state.bombs,
      (b) => b.id,
      (b) =>
        this.add
          .image(...this.cellToPixel(b.col, b.row), TEXTURE.bomb(0))
          .setDepth(DEPTH.bomb),
      (image, b) => {
        const elapsed = BOMB_FUSE_TICKS - b.fuse;
        const burnt = elapsed / BOMB_FUSE_TICKS;
        // Pulses harder and faster as the fuse burns down.
        const rate = 0.2 + burnt * burnt * 0.9;
        const pulse = (0.06 + burnt * 0.08) * Math.sin(elapsed * rate);
        image.setScale(1 + pulse, 1 - pulse); // squash and stretch
        image.setTexture(TEXTURE.bomb(Math.floor(elapsed / 6) % 2));
        // Sparks off the fuse, more often near the end.
        if (
          elapsed % (burnt > 0.6 ? 4 : 9) === 0 &&
          this.ticked.get(b.id) !== b.fuse
        ) {
          this.fuseSpark(
            image.x + this.tile * 0.28,
            image.y - this.tile * 0.42,
          );
        }
        // The last second ticks, quickening.
        const interval = b.fuse < 30 ? 6 : b.fuse < 60 ? 12 : 0;
        if (
          interval &&
          b.fuse % interval === 0 &&
          this.ticked.get(b.id) !== b.fuse
        ) {
          this.config.sfx.play('tick');
        }
        this.ticked.set(b.id, b.fuse);
      },
    );
  }

  private renderFlames(state: GameState): void {
    this.sync(
      this.flames,
      state.flames,
      (f) => `${f.col},${f.row}`,
      (f) => {
        const image = this.add
          .image(...this.cellToPixel(f.col, f.row), TEXTURE.flame(f.shape, 2))
          .setDepth(DEPTH.flame);
        // On the dark arena the blast is light, not paint: it adds to what is under it.
        if (!this.config.skin.pixelArt)
          image.setBlendMode(Phaser.BlendModes.ADD);
        return image;
      },
      (image, f) =>
        image.setTexture(TEXTURE.flame(f.shape, flameFrame(f.ticksLeft))),
    );
  }

  private renderPlayers(state: GameState): void {
    this.forgetRound(state.tick);
    const visible = state.players.filter(
      (p) =>
        p.alive ||
        (p.diedAtTick !== null && state.tick - p.diedAtTick < DEATH_TICKS),
    );
    this.sync(
      this.players,
      visible,
      (p) => p.id,
      (p) => this.add.image(0, 0, TEXTURE.player(p.slot, p.facing, 0)),
      (image, p) => this.updatePlayer(image, p, state.tick),
    );

    // Contact shadows under everyone standing, and under every bomb — in the air too.
    const casters = [
      ...state.players
        .filter((p) => p.alive && !p.carriedBy)
        .map((p) => {
          if (!p.flight) return { key: `p:${p.id}`, x: p.x, y: p.y, size: 0.9 };
          const [x, y, arc] = flightPosition(state, p.flight, state.tick);
          return { key: `p:${p.id}`, x, y, size: 0.9 - arc * 0.35 };
        }),
      ...(state.stage?.creatures ?? [])
        .filter((c) => c.alive)
        .map((c) => ({ key: `c:${c.id}`, x: c.x, y: c.y, size: 0.8 })),
      ...(state.stage?.boss && isBossExposed(state.stage.boss)
        ? [
            {
              key: 'boss',
              x: state.stage.boss.x,
              y: state.stage.boss.y,
              size: 1.3,
            },
          ]
        : []),
      ...state.outsiders.map((o) => ({
        key: `o:${o.id}`,
        x: o.x,
        y: o.y,
        size: 0.8,
      })),
      ...state.bombs.map((b) => ({
        key: `b:${b.id}`,
        x: b.col,
        y: b.row,
        size: 0.8,
      })),
      ...state.thrownBombs.map((b) => {
        const [x, y, arc] = this.flightOf(b, state.tick);
        return { key: `t:${b.id}`, x, y, size: 0.8 - arc * 0.3 };
      }),
    ];
    this.sync(
      this.shadows,
      casters,
      (c) => c.key,
      () => this.add.image(0, 0, TEXTURE.shadow).setDepth(DEPTH.shadow),
      (image, c) => {
        const [x, y] = this.cellToPixel(c.x, c.y);
        image.setPosition(x, y + this.tile * 0.36).setScale(c.size);
      },
    );
  }

  /**
   * Stage mode: the gate, once its block has burnt — a grate in the floor
   * that lights up when the last creature falls.
   */
  private renderExit(state: GameState): void {
    const run = state.stage;
    const shown = run && isExitRevealed(state, run) ? [run.exit] : [];
    const open = !!run && isExitOpen(run);
    this.sync(
      this.exits,
      shown,
      (e) => `${e.col},${e.row}`,
      (e) =>
        this.add
          .image(...this.cellToPixel(e.col, e.row), this.exitTexture(false))
          .setDepth(DEPTH.exit),
      (image) => {
        // The escape ends on a floor that gives way: a cracked grate, not a gate.
        if (run?.parts.at(-1)?.goal === 'survive') {
          image.setTexture(
            this.paintedTexture(
              open ? 'stage-collapse-open' : 'stage-collapse',
              open ? paintCollapseOpen : paintCollapse,
            ),
          );
          image.setScale(open ? 1 + Math.sin(state.tick * 0.3) * 0.04 : 1);
          return;
        }
        image.setTexture(this.exitTexture(open));
        image.setScale(open ? 1 + Math.sin(state.tick * 0.15) * 0.05 : 1);
      },
    );
  }

  /** The gate's two looks, painted once: shut, and open with a warm glow. */
  private exitTexture(open: boolean): string {
    const key = open ? 'stage-exit-open' : 'stage-exit-shut';
    if (this.textures.exists(key)) return key;
    const size = this.tile;
    const texture = this.textures.createCanvas(key, size, size);
    const ctx = texture?.getContext();
    if (!texture || !ctx) return TEXTURE.floor;
    const c = size / 2;
    if (open) {
      const glow = ctx.createRadialGradient(c, c, size * 0.2, c, c, size * 0.5);
      glow.addColorStop(0, 'rgba(255, 211, 110, 0.9)');
      glow.addColorStop(1, 'rgba(255, 211, 110, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.beginPath();
    ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = '#2b3036';
    ctx.fill();
    ctx.lineWidth = size * 0.06;
    ctx.strokeStyle = '#1d1a17';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = open ? '#ffd36e' : '#5a6069';
    for (let x = c - size * 0.3; x < c + size * 0.36; x += size * 0.14)
      ctx.fillRect(x, 0, size * 0.06, size);
    ctx.restore();
    texture.refresh();
    return key;
  }

  /** Stage mode: the creatures, painted from the campaign art, walking and falling. */
  private renderCreatures(state: GameState): void {
    const visible = (state.stage?.creatures ?? []).filter(
      (c) =>
        c.alive ||
        (c.diedAtTick !== null && state.tick - c.diedAtTick < DEATH_TICKS),
    );
    this.sync(
      this.creatures,
      visible,
      (c) => c.id,
      (c) => this.add.image(0, 0, this.creatureTexture(c)),
      (image, c) => this.updateCreature(image, c, state.tick),
    );
  }

  private creatureTexture(creature: CreatureBody): string {
    const key = `creature:${creature.creatureId}`;
    if (!this.textures.exists(key)) {
      const canvas = paintCreatureFrame(document, {
        subject: { creature: creature.creatureId },
        size: Math.round(this.tile * 1.1),
      });
      this.textures.addCanvas(key, canvas);
    }
    return key;
  }

  private updateCreature(image: Image, c: CreatureBody, tick: number): void {
    const [x, y] = this.cellToPixel(c.x, c.y);
    if (!c.alive) {
      // Falls over and fades, like a player.
      const t = Math.min(1, (tick - (c.diedAtTick ?? tick)) / DEATH_TICKS);
      image
        .setPosition(x, y - this.tile * 0.1)
        .setAngle(90 * t)
        .setAlpha(1 - t)
        .setScale(1 - t * 0.4)
        .setTint(0xff9050);
      return;
    }
    // Playing dead: on its back, still, with a twitch now and then.
    if (tick < (c.downUntilTick ?? 0)) {
      const twitch = Math.floor(tick / 20) % 5 === 0 ? 3 : 0;
      image
        .setPosition(x, y)
        .setAngle(180 + twitch)
        .setFlipX(c.facing === 'left')
        .setDepth(DEPTH.player + c.y);
      return;
    }
    // A little hop on every step, out of phase from one creature to the next;
    // a flyer bobs higher, its shadow left on the floor in its art.
    const fly = findCreature(c.creatureId).move === 'fly';
    const hop =
      Math.abs(Math.sin((tick + c.id * 7) * (fly ? 0.12 : 0.35))) *
      this.tile *
      (fly ? 0.12 : 0.06);
    image
      .setPosition(x, y - this.tile * (fly ? 0.25 : 0.1) - hop)
      .setAngle(0)
      .setFlipX(c.facing === 'left')
      .setDepth(DEPTH.player + c.y + (fly ? 1 : 0));
    if (tick < c.hurtUntilTick && Math.floor(tick / 4) % 2 === 0)
      image.setTint(0xff6b57);
    else if (this.dark > 0.5) image.setTint(DARK_TINT);
    else image.clearTint();
  }

  /**
   * A boss stage: the anthills, the cracks where the boss will come up (a
   * feint among them from half health on), the mound of earth it moves under,
   * and the boss itself — sinking, coming up, dizzy, falling.
   */
  private renderBoss(state: GameState): void {
    const run = state.stage;
    const boss = run?.boss ?? null;
    this.sync(
      this.mounds,
      (run?.mounds ?? []).filter((m) => m.alive),
      (m) => m.id,
      (m) =>
        this.add
          .image(
            ...this.cellToPixel(m.col, m.row),
            m.kind === 'breaker'
              ? this.paintedTexture('stage-breaker', paintBreaker)
              : m.kind === 'generator' || boss?.bossId === 'gato'
                ? this.paintedTexture('stage-generator', paintGenerator)
                : this.paintedTexture('stage-mound', paintMound),
          )
          .setDepth(DEPTH.player + m.row - 0.2),
      (image, m) => {
        if (
          state.tick < m.hurtUntilTick &&
          Math.floor(state.tick / 4) % 2 === 0
        )
          image.setTint(0xff9050);
        else image.clearTint();
      },
    );

    const cracks =
      boss?.alive && boss.phase === 'crack' ? [boss.target, ...boss.fakes] : [];
    this.sync(
      this.cracks,
      cracks,
      (c) => `${c.col},${c.row}`,
      (c) =>
        this.add
          .image(
            ...this.cellToPixel(c.col, c.row),
            this.paintedTexture('stage-crack', paintCrack),
          )
          .setDepth(DEPTH.exit),
      (image) => image.setAlpha(Math.floor(state.tick / 6) % 2 ? 1 : 0.45),
    );

    // The Gato's shock: its row and column blink while it charges, burn while it zaps.
    const shock =
      boss?.alive && (boss.phase === 'charge' || boss.phase === 'zap')
        ? (boss.zap ?? []).map((c) => ({ ...c, live: boss.phase === 'zap' }))
        : [];
    this.sync(
      this.shocks,
      shock,
      (c) => `${c.col},${c.row}`,
      (c) =>
        this.add
          .image(...this.cellToPixel(c.col, c.row), TEXTURE.floor)
          .setDepth(DEPTH.flame),
      (image, c) => {
        image.setTexture(
          c.live
            ? this.paintedTexture('gato-zap', paintZap)
            : this.paintedTexture('gato-warn', paintZapWarning),
        );
        image.setAlpha(
          c.live
            ? 0.8 + 0.2 * Math.sin(state.tick * 1.7 + c.col)
            : Math.floor(state.tick / 6) % 2
              ? 0.9
              : 0.35,
        );
      },
    );
    // In the dark only its eyes show, above the dark sheet.
    const lookout = boss?.alive && this.dark > 0.5 ? [boss] : [];
    this.sync(
      this.eyes,
      lookout,
      (b) => b.bossId,
      () =>
        this.add
          .image(0, 0, this.paintedTexture('gato-eyes', paintEyes))
          .setDepth(DEPTH.dark + 0.5),
      (image, b) => {
        const [x, y] = this.cellToPixel(b.x, b.y);
        image.setPosition(x, y - this.tile * 0.55);
      },
    );

    const shown: BossBody[] =
      boss &&
      (boss.alive ||
        (boss.diedAtTick !== null &&
          state.tick - boss.diedAtTick < DEATH_TICKS * 2))
        ? [boss]
        : [];
    this.sync(
      this.bosses,
      shown,
      (b) => b.bossId,
      (b) => this.add.image(0, 0, this.bossTexture(b)),
      (image, b) => this.updateBoss(image, b, state.tick),
    );
  }

  private bossTexture(boss: BossBody, pose?: BossPose): string {
    const key = `boss:${boss.bossId}${pose ? `:${pose}` : ''}`;
    if (!this.textures.exists(key)) {
      const canvas = paintCreatureFrame(document, {
        subject: { boss: boss.bossId, ...(pose ? { pose } : {}) },
        size: Math.round(this.tile * 1.7),
      });
      this.textures.addCanvas(key, canvas);
    }
    return key;
  }

  private updateBoss(image: Image, b: BossBody, tick: number): void {
    const [x, y] = this.cellToPixel(b.x, b.y);
    const lift = this.tile * 0.3;
    image
      .setDepth(DEPTH.player + b.y)
      .setAngle(0)
      .setAlpha(1)
      .setScale(1);
    if (!b.alive) {
      const t = Math.min(
        1,
        (tick - (b.diedAtTick ?? tick)) / (DEATH_TICKS * 2),
      );
      image
        .setTexture(this.bossTexture(b))
        .setPosition(x, y - lift)
        .setAngle(-90 * t)
        .setAlpha(1 - t)
        .setTint(0xff9050);
      return;
    }
    if (b.bossId === 'gato') {
      this.updateGato(image, b, tick, x, y - lift);
      return;
    }
    if (b.phase === 'under' || b.phase === 'crack') {
      // Underground: only the mound of earth shows, running along.
      const wobble = 1 + Math.sin(tick * 0.6) * 0.12;
      image
        .setTexture(this.paintedTexture('stage-burrow', paintBurrow))
        .setPosition(x, y + this.tile * 0.15)
        .setScale(wobble, 1 / wobble)
        .setDepth(DEPTH.exit + 0.1)
        .clearTint();
      if (b.phase === 'crack') image.setAlpha(0);
      return;
    }
    image.setTexture(this.bossTexture(b)).setPosition(x, y - lift);
    const span = Math.max(1, b.phaseEndsAtTick - b.phaseStartedAtTick);
    const t = Math.min(1, (tick - b.phaseStartedAtTick) / span);
    if (b.phase === 'sinking') {
      image
        .setScale(1 - t * 0.6)
        .setAlpha(1 - t)
        .setY(y - lift * (1 - t));
    } else if (b.phase === 'stunned') {
      // Pops out of the ground, then sways, dizzy.
      const pop = Math.min(1, (tick - b.phaseStartedAtTick) / 8);
      image.setScale(0.5 + pop * 0.5).setAngle(Math.sin(tick * 0.25) * 8);
    }
    if (tick < b.hurtUntilTick && Math.floor(tick / 4) % 2 === 0)
      image.setTint(0xff6b57);
    else if (this.dark > 0.5) image.setTint(DARK_TINT);
    else image.clearTint();
  }

  /**
   * A long stage's floor: cables, and arc lines — crackling while live, a dead
   * wire once their breaker is gone; sparks running along the cables.
   */
  private renderFixtures(state: GameState): void {
    const run = state.stage;
    const cells: { key: string; col: number; row: number; texture: string }[] =
      [];
    for (const cable of run?.cables ?? [])
      for (let col = cable.from; col <= cable.to; col++)
        cells.push({
          key: `c${col},${cable.row}`,
          col,
          row: cable.row,
          texture: this.paintedTexture('stage-cable', paintCable),
        });
    for (const arc of run?.arcs ?? []) {
      const live = !!run && isArcLive(state, run, arc);
      const alive = run?.mounds.find((m) => m.id === arc.breakerId)?.alive;
      for (let col = arc.from; col <= arc.to; col++)
        cells.push({
          key: `a${col},${arc.row}`,
          col,
          row: arc.row,
          texture: live
            ? this.paintedTexture('stage-arc-live', paintArcLive)
            : alive
              ? this.paintedTexture('stage-arc-idle', paintArcIdle)
              : this.paintedTexture('stage-arc-dead', paintArcDead),
        });
    }
    this.sync(
      this.lines,
      cells,
      (c) => c.key,
      (c) =>
        this.add
          .image(...this.cellToPixel(c.col, c.row), c.texture)
          .setDepth(DEPTH.exit - 0.1),
      (image, c) => {
        image.setTexture(c.texture);
        image.setAlpha(
          c.key.startsWith('a') && c.texture === 'stage-arc-live'
            ? 0.75 + 0.25 * Math.sin(state.tick * 1.3 + c.col)
            : 1,
        );
      },
    );
    this.sync(
      this.sparks,
      (run?.sparks ?? []).map((s, i) => ({ ...s, i })),
      (s) => s.i,
      () =>
        this.add
          .image(0, 0, this.paintedTexture('gato-zap', paintZap))
          .setDepth(DEPTH.flame),
      (image, s) =>
        image
          .setPosition(...this.cellToPixel(s.x, s.row))
          .setScale(0.6 + 0.15 * Math.sin(state.tick * 0.9)),
    );
  }

  /** The Gato de Fios: its pose tells its mood — glowing to zap, grey and still when drained. */
  private updateGato(
    image: Image,
    b: BossBody,
    tick: number,
    x: number,
    y: number,
  ): void {
    const pose: BossPose | undefined =
      b.phase === 'charge'
        ? 'charge'
        : b.phase === 'drained' || b.phase === 'stunned'
          ? 'drained'
          : undefined;
    image.setTexture(this.bossTexture(b, pose)).setPosition(x, y);
    const span = Math.max(1, b.phaseEndsAtTick - b.phaseStartedAtTick);
    const t = Math.min(1, (tick - b.phaseStartedAtTick) / span);
    if (b.phase === 'charge')
      image.setPosition(x + Math.sin(tick * 2.3) * this.tile * 0.04, y);
    else if (b.phase === 'crouch')
      image.setScale(1.2, 0.8).setY(y + this.tile * 0.15);
    else if (b.phase === 'pounce')
      image.setY(y - Math.sin(Math.PI * t) * this.tile * 0.7);
    else if (b.phase === 'stunned') image.setAngle(Math.sin(tick * 0.25) * 8);
    else if (b.phase === 'walk')
      image.setY(y - Math.abs(Math.sin(tick * 0.3)) * this.tile * 0.05);
    if (tick < b.hurtUntilTick && Math.floor(tick / 4) % 2 === 0)
      image.setTint(0xff6b57);
    else if (this.dark > 0.5) image.setTint(DARK_TINT);
    else image.clearTint();
  }

  /**
   * A stage in parts: the gate of the part being played, a charged barrier
   * along the screen's right edge; the key, on its carrier or on the floor;
   * the helmets of whoever is waiting for a teammate.
   */
  private renderParts(state: GameState): void {
    const run = state.stage;
    const part = run?.parts[run.part];
    // The last part has no gate: the far wall ends it.
    const last = !!run && run.part === run.parts.length - 1;
    const bars =
      run && part && !part.done && !last
        ? Array.from({ length: state.rows - 2 }, (_, i) => ({
            col: part.gate - 1,
            row: i + 1,
          }))
        : [];
    this.sync(
      this.gates,
      bars,
      (b) => `${b.col},${b.row}`,
      (b) =>
        this.add
          .image(
            ...this.cellToPixel(b.col, b.row),
            this.paintedTexture('stage-gate-bar', paintGateBar),
          )
          .setDepth(DEPTH.exit),
      (image, b) =>
        image.setAlpha(0.75 + 0.25 * Math.sin(state.tick * 0.2 + b.row)),
    );

    const key = run?.key;
    const carrier =
      key?.carrierId != null
        ? run?.creatures.find((c) => c.id === key.carrierId)
        : undefined;
    this.sync(
      this.keys,
      key ? [key] : [],
      () => 'key',
      () =>
        this.add
          .image(0, 0, this.paintedTexture('stage-key', paintKey))
          .setDepth(DEPTH.fx - 2),
      (image, k) => {
        const [x, y] = carrier
          ? this.cellToPixel(carrier.x, carrier.y - 0.55)
          : this.cellToPixel(k.col, k.row);
        image.setPosition(
          x,
          y + Math.sin(state.tick * 0.12) * this.tile * 0.04,
        );
        image.setScale(carrier ? 0.6 : 1);
      },
    );

    this.sync(
      this.helmets,
      run?.helmets ?? [],
      (h) => h.playerId,
      (h) =>
        this.add
          .image(
            ...this.cellToPixel(h.col, h.row),
            this.paintedTexture('stage-helmet', paintHelmet),
          )
          .setDepth(DEPTH.exit),
      (image, h) => {
        image.setPosition(...this.cellToPixel(h.col, h.row));
        image.setScale(1 + Math.sin(state.tick * 0.1) * 0.06);
      },
    );
  }

  /** Snail slime: a glossy green smear that fades as it dries. */
  private renderSlime(state: GameState): void {
    this.sync(
      this.slime,
      state.stage?.slime ?? [],
      (s) => `${s.col},${s.row}`,
      (s) =>
        this.add
          .image(
            ...this.cellToPixel(s.col, s.row),
            this.paintedTexture('stage-slime', paintSlime),
          )
          .setDepth(DEPTH.exit),
      (image, s) =>
        image.setAlpha(Math.min(1, (s.untilTick - state.tick) / 60) * 0.85),
    );
  }

  /** The skull's curse: a little skull bobbing over the head of whoever has it. */
  private renderSkulls(state: GameState): void {
    const cursed = state.players.filter(
      (p) => p.alive && p.curse && state.tick < p.curse.untilTick,
    );
    this.sync(
      this.skulls,
      cursed,
      (p) => p.id,
      () =>
        this.add
          .image(0, 0, TEXTURE.powerUp('skull'))
          .setScale(0.45)
          .setDepth(DEPTH.thrown),
      (image, p) => {
        const [x, y] = this.cellToPixel(p.x, p.y);
        image.setPosition(
          x,
          y - this.tile * (0.85 + Math.sin(state.tick * 0.2) * 0.05),
        );
      },
    );
  }

  /** Points scored: a number floating up from where they were earned. */
  private floatPoints(col: number, row: number, points: number): void {
    const [x, y] = this.cellToPixel(col, row);
    const text = this.add
      .text(x, y, `+${points}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.round(this.tile * 0.34)}px`,
        fontStyle: 'bold',
        color: '#fff3c4',
        stroke: '#1d1a17',
        strokeThickness: Math.max(2, Math.round(this.tile * 0.06)),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.fx);
    this.tweens.add({
      targets: text,
      y: y - this.tile * 0.9,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** A texture painted once on a canvas the size of a tile. */
  private paintedTexture(
    key: string,
    paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  ): string {
    if (this.textures.exists(key)) return key;
    const texture = this.textures.createCanvas(key, this.tile, this.tile);
    const ctx = texture?.getContext();
    if (!texture || !ctx) return TEXTURE.floor;
    paint(ctx, this.tile);
    texture.refresh();
    return key;
  }

  /** The next in line, on the border wall, with their own character's look. */
  private renderOutsiders(state: GameState): void {
    for (const outsider of state.outsiders) {
      if (this.outsiderLooks.has(outsider.characterId)) continue;
      this.outsiderLooks.add(outsider.characterId);
      this.config.skin.loadCharacter?.(this, outsider.characterId, 'outsider');
    }
    this.sync(
      this.outsiders,
      state.outsiders,
      (o) => o.id,
      (o) => {
        const image = this.add.image(0, 0, this.outsiderTexture(o, 0));
        // Filters exist on the WebGL renderer only; the canvas one draws no rim.
        image.enableFilters?.();
        image.filters?.internal.addGlow(OUTSIDER_GLOW, 3, 0, 1, false, 8, 6);
        return image;
      },
      (image, o) => {
        const [x, y] = this.cellToPixel(o.x, o.y);
        const frame = o.moving
          ? (WALK_CYCLE[Math.floor(state.tick / 8) % 4] ?? 0)
          : 0;
        // Waiting outsiders bob a little, so the eye finds them on the wall.
        const bob = o.moving ? 0 : Math.sin(state.tick * 0.12) * 0.03;
        image
          .setDepth(DEPTH.outsider + o.y / 100)
          .setTexture(this.outsiderTexture(o, frame));
        // Taller than the cell, like a player's frame: stand it on the cell.
        const { width, height } = image.frame;
        image.setOrigin(0.5, 1 - width / 2 / height);
        // On the top wall the usual lift would cut their head off at the canvas edge.
        const top = image.displayHeight * image.originY;
        image.setPosition(x, Math.max(y - this.tile * (0.12 + bob), top));
        if (this.dark > 0.5) image.setTint(DARK_TINT);
        else image.clearTint();
      },
    );

    // Ready to throw — no bomb of theirs out yet — they hold one up, fuse lit,
    // the way a player holds one with the glove. It goes when they throw.
    const ready = state.outsiders.filter((o) => !hasBombOut(state, o.id));
    this.sync(
      this.outsiderBombs,
      ready,
      (o) => o.id,
      () => this.add.image(0, 0, TEXTURE.bomb(0)),
      (image, o) => {
        const [x, y] = this.cellToPixel(o.x, o.y);
        const outsider = this.outsiders.get(o.id);
        const head = outsider
          ? outsider.y - outsider.displayHeight * outsider.originY
          : y - this.tile;
        const sway = Math.sin(state.tick * 0.15) * this.tile * 0.03;
        // Held up over the head; on the top wall, with no room above, in hand at the side.
        const above = head - this.tile * 0.22;
        const [bx, by] =
          above > this.tile * 0.3
            ? [x + sway, above]
            : [
                x + this.tile * 0.42,
                head + (outsider?.displayHeight ?? this.tile) * 0.6 + sway,
              ];
        image
          .setPosition(bx, by)
          .setScale(0.7)
          .setDepth(DEPTH.outsider + o.y / 100 + 0.01)
          .setTexture(TEXTURE.bomb(Math.floor(state.tick / 10) % 2));
      },
    );
  }

  /** The rider on its mount: painted by the skin the first time this slot climbs on; on foot until then. */
  private mountedTexture(player: Player, frame: number): string {
    const mountId = player.mountId as MountId;
    const look = `${player.slot}:${mountId}`;
    if (!this.mountLooks.has(look)) {
      this.mountLooks.add(look);
      this.config.skin.loadMount?.(
        this,
        player.characterId,
        player.slot,
        mountId,
        playerColor(player),
      );
    }
    const key = TEXTURE.playerMounted(
      player.slot,
      mountId,
      player.facing,
      frame,
    );
    return this.textures.exists(key)
      ? key
      : TEXTURE.player(player.slot, player.facing, Math.min(frame, 2));
  }

  /** The character's own border look when the skin paints one, else the first slot's player. */
  private outsiderTexture(outsider: Outsider, frame: number): string {
    const own = TEXTURE.outsider(outsider.characterId, outsider.facing, frame);
    return this.textures.exists(own)
      ? own
      : TEXTURE.player(0, outsider.facing, frame);
  }

  /** Bombs in the air: an arc from the wall to the cell they land on. */
  private renderThrownBombs(state: GameState): void {
    this.sync(
      this.thrown,
      state.thrownBombs,
      (b) => b.id,
      () => this.add.image(0, 0, TEXTURE.bomb(0)).setDepth(DEPTH.thrown),
      (image, b) => {
        const [col, row, arc] = this.flightOf(b, state.tick);
        const [x, y] = this.cellToPixel(col, row);
        image
          .setPosition(x, y - arc * this.tile * 0.9)
          .setScale(1 + arc * 0.25)
          .setAngle(((state.tick - b.startTick) * 12) % 360);
      },
    );
  }

  /** Where a thrown bomb is at `tick`, in tiles, and how high (0–1) it is on its arc. */
  private flightOf(bomb: ThrownBomb, tick: number): [number, number, number] {
    return flightPosition(this.config.session.state, bomb, tick);
  }

  /** The glove: the bomb held up over the holder's head, pulsing as its fuse burns. */
  private renderHeldBombs(state: GameState): void {
    const holders = state.players.filter((p) => p.alive && p.heldBomb);
    this.sync(
      this.held,
      holders,
      (p) => p.id,
      () => this.add.image(0, 0, TEXTURE.bomb(0)),
      (image, p) => {
        const fuse = p.heldBomb?.fuse ?? 0;
        const elapsed = BOMB_FUSE_TICKS - fuse;
        const pulse =
          0.08 * Math.sin(elapsed * (fuse < BOMB_FUSE_TICKS / 3 ? 0.5 : 0.25));
        const [x, y] = this.cellToPixel(p.x, p.y);
        image
          .setPosition(x, y - this.tile * 0.78)
          .setScale(0.8 + pulse, 0.8 - pulse)
          .setDepth(DEPTH.player + p.y + 0.5)
          .setTexture(TEXTURE.bomb(Math.floor(elapsed / 6) % 2));
      },
    );
  }

  private get tile(): number {
    return this.config.skin.tileSize;
  }

  /** Sound, camera shake and particles, driven by what the rules report. */
  private playEffects(events: readonly GameEvent[]): void {
    const { sfx, voice } = this.config;
    const explosions = events.filter((e) => e.type === 'explosion').length;
    if (explosions > 0) {
      this.freezeUntil = this.time.now + FREEZE_MS;
      sfx.play('explode', 1 + (explosions - 1) * 0.3);
      this.cameras.main.shake(
        140 + explosions * 40,
        0.004 + explosions * 0.0015,
      );
    }
    for (const event of events) {
      switch (event.type) {
        case 'bomb-placed':
          sfx.play('place');
          this.placedAt.set(event.playerId, this.config.session.state.tick);
          break;
        case 'block-destroyed':
          this.burst(event.col, event.row, TEXTURE.debris, 10, false);
          voice.say('block');
          break;
        case 'power-up-burned':
          this.burst(event.col, event.row, TEXTURE.spark, 6, true);
          break;
        case 'power-up-collected': {
          sfx.play('power-up');
          const moment = powerUpMoment(event.kind);
          if (moment) voice.say(moment);
          const player = this.config.session.state.players.find(
            (p) => p.id === event.playerId,
          );
          if (player) this.burst(player.x, player.y, TEXTURE.spark, 10, true);
          break;
        }
        case 'mount-gained': {
          sfx.play('hatch');
          sfx.play(`mount-${event.mountId}`);
          voice.say(mountMoment(event.mountId));
          const player = this.config.session.state.players.find(
            (p) => p.id === event.playerId,
          );
          if (player) this.burst(player.x, player.y, TEXTURE.spark, 16, true);
          break;
        }
        case 'ability-used': {
          sfx.play('ability');
          if (event.mountId === 'galinha') {
            // The jolt: a crackle and a ring of sparks round the rider.
            sfx.play('mount-galinha');
            const player = this.config.session.state.players.find(
              (p) => p.id === event.playerId,
            );
            if (player) this.burst(player.x, player.y, TEXTURE.spark, 24, true);
          }
          break;
        }
        case 'mount-lost': {
          sfx.play('mount-lost');
          voice.say('mount-lost');
          const player = this.config.session.state.players.find(
            (p) => p.id === event.playerId,
          );
          if (player) this.burst(player.x, player.y, TEXTURE.debris, 8, false);
          break;
        }
        case 'player-died':
          sfx.play('die');
          voice.say('died');
          {
            const fallen = this.config.session.state.players.find(
              (p) => p.id === event.playerId,
            );
            if (fallen) this.dizzy(fallen.x, fallen.y);
          }
          break;
        case 'bomb-thrown':
          sfx.play('throw');
          break;
        case 'bomb-picked-up':
          sfx.play('place', 0.6);
          break;
        case 'bomb-kicked':
          sfx.play('kick');
          break;
        case 'player-grabbed':
          sfx.play('ability');
          voice.say('grab');
          break;
        case 'player-thrown':
          sfx.play('throw');
          break;
        case 'player-landed': {
          const landed = this.config.session.state.players.find(
            (p) => p.id === event.playerId,
          );
          sfx.play('wall', 0.5);
          if (landed) this.burst(landed.x, landed.y, TEXTURE.spark, 8, true);
          break;
        }
        case 'player-bonked': {
          const bonked = this.config.session.state.players.find(
            (p) => p.id === event.playerId,
          );
          sfx.play('kick', 0.8);
          if (bonked) this.burst(bonked.x, bonked.y, TEXTURE.spark, 6, true);
          break;
        }
        case 'power-up-dropped':
          sfx.play('place', 0.5);
          break;
        case 'arena-closing':
          sfx.play('alarm');
          voice.say('hurry');
          break;
        case 'wall-dropped':
          sfx.play('wall', 0.8);
          this.burst(event.col, event.row, TEXTURE.debris, 6, false);
          this.cameras.main.shake(90, 0.003);
          break;
        case 'outsider-entered': {
          // Their look takes over the slot they fill: the skin repaints it.
          const entrant = this.config.session.state.players.find(
            (p) => p.id === event.playerId,
          );
          if (entrant) {
            this.config.skin.loadCharacter?.(
              this,
              entrant.characterId,
              entrant.slot,
              playerColor(entrant),
            );
            this.burst(entrant.x, entrant.y, TEXTURE.spark, 16, true);
          }
          sfx.play('hatch');
          break;
        }
        case 'round-over':
          sfx.play('round-over');
          voice.say(event.winnerId ? 'win' : 'draw');
          break;
        case 'creature-hurt':
          sfx.play('kick', 0.8);
          this.burst(event.col, event.row, TEXTURE.spark, 6, true);
          break;
        case 'creature-died':
          sfx.play('kick');
          this.burst(event.col, event.row, TEXTURE.spark, 12, true);
          break;
        case 'exit-opened':
          sfx.play('hatch');
          this.burst(event.col, event.row, TEXTURE.spark, 20, true);
          break;
        case 'player-exited':
          sfx.play('power-up');
          break;
        case 'boss-dug':
          sfx.play('wall', 0.7);
          this.burst(event.col, event.row, TEXTURE.debris, 10, false);
          break;
        case 'boss-crack':
        case 'boss-charge':
          sfx.play('alarm');
          break;
        case 'boss-zap':
          sfx.play('explode', 0.8);
          this.cameras.main.shake(140, 0.005);
          this.burst(event.col, event.row, TEXTURE.spark, 18, true);
          break;
        case 'boss-emerged':
          sfx.play('wall');
          this.cameras.main.shake(180, 0.006);
          this.burst(event.col, event.row, TEXTURE.debris, 14, false);
          break;
        case 'boss-hurt':
          sfx.play('mount-lost');
          this.burst(event.col, event.row, TEXTURE.spark, 14, true);
          break;
        case 'boss-died':
          sfx.play('explode', 1.4);
          this.cameras.main.shake(400, 0.01);
          this.burst(event.col, event.row, TEXTURE.spark, 30, true);
          break;
        case 'cursed':
          sfx.play('mount-lost');
          break;
        case 'curse-passed':
          sfx.play('kick', 0.7);
          break;
        case 'time-added':
          sfx.play('power-up');
          break;
        case 'life-gained':
          sfx.play('hatch');
          break;
        case 'exit-bombed':
          sfx.play('alarm');
          this.burst(event.col, event.row, TEXTURE.debris, 10, false);
          break;
        case 'points':
          this.floatPoints(event.col, event.row, event.points);
          break;
        case 'mound-hurt':
          this.burst(event.col, event.row, TEXTURE.debris, 6, false);
          break;
        case 'mound-destroyed':
          sfx.play('wall', 0.8);
          this.burst(event.col, event.row, TEXTURE.debris, 12, false);
          break;
        case 'stage-over':
          sfx.play('round-over');
          voice.say(event.result === 'cleared' ? 'win' : 'draw');
          break;
      }
    }
  }

  /** Throws `count` short-lived particles out of a cell. */
  private burst(
    col: number,
    row: number,
    texture: string,
    count: number,
    glow: boolean,
  ): void {
    const [x, y] = this.cellToPixel(col, row);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const distance = this.tile * (0.4 + Math.random() * 0.5);
      const particle = this.add
        .image(x, y, texture)
        .setDepth(DEPTH.fx)
        .setScale(glow ? 0.45 : 0.6 + Math.random() * 0.4)
        .setAngle(Math.random() * 360);
      if (glow && !this.config.skin.pixelArt)
        particle.setBlendMode(Phaser.BlendModes.ADD);
      if (glow) {
        this.tweens.add({
          targets: particle,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          angle: particle.angle + (Math.random() - 0.5) * 540,
          alpha: 0,
          scale: 0.1,
          duration: 450 + Math.random() * 250,
          ease: 'Quad.easeOut',
          onComplete: () => particle.destroy(),
        });
        continue;
      }
      // Debris: thrown out, then it drops and bounces on the floor.
      const duration = 550 + Math.random() * 300;
      this.tweens.add({
        targets: particle,
        x: { value: x + Math.cos(angle) * distance, ease: 'Quad.easeOut' },
        y: {
          value:
            y + Math.abs(Math.sin(angle)) * distance * 0.4 + this.tile * 0.35,
          ease: 'Bounce.easeOut',
        },
        angle: particle.angle + (Math.random() - 0.5) * 720,
        scale: { value: 0.3, ease: 'Quad.easeIn' },
        duration,
        onComplete: () => particle.destroy(),
      });
      this.tweens.add({
        targets: particle,
        alpha: 0,
        delay: duration * 0.6,
        duration: duration * 0.4,
      });
    }
  }

  /** One spark leaving a fuse: up a little, gone fast. */
  private fuseSpark(x: number, y: number): void {
    const spark = this.add
      .image(x, y, TEXTURE.spark)
      .setDepth(DEPTH.fx)
      .setScale(0.12 + Math.random() * 0.1);
    if (!this.config.skin.pixelArt) spark.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: spark,
      x: x + (Math.random() - 0.5) * this.tile * 0.3,
      y: y - this.tile * (0.15 + Math.random() * 0.2),
      alpha: 0,
      duration: 220 + Math.random() * 120,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  /** Three sparks circling a fallen player's head while the fall lasts. */
  private dizzy(col: number, row: number): void {
    const [x, y] = this.cellToPixel(col, row);
    const stars = [0, 1, 2].map((i) =>
      this.add
        .image(x, y, TEXTURE.spark)
        .setDepth(DEPTH.fx)
        .setScale(0.3)
        .setBlendMode(
          this.config.skin.pixelArt
            ? Phaser.BlendModes.NORMAL
            : Phaser.BlendModes.ADD,
        )
        .setData('phase', (i / 3) * Math.PI * 2),
    );
    const orbit = { t: 0 };
    this.tweens.add({
      targets: orbit,
      t: 1,
      duration: (DEATH_TICKS / 60) * 1000,
      onUpdate: () => {
        for (const star of stars) {
          const a = (star.getData('phase') as number) + orbit.t * Math.PI * 5;
          star
            .setPosition(
              x + Math.cos(a) * this.tile * 0.42,
              y - this.tile * 0.25 + Math.sin(a) * this.tile * 0.12,
            )
            .setAlpha(orbit.t < 0.8 ? 1 : 1 - (orbit.t - 0.8) / 0.2);
        }
      },
      onComplete: () => stars.forEach((star) => star.destroy()),
    });
  }

  /** Remote bombs read blue, piercing ones red, so what is coming is visible. */
  private tintBombs(state: GameState): void {
    for (const bomb of state.bombs) {
      const image = this.bombs.get(bomb.id);
      if (!image) continue;
      if (bomb.remote) image.setTint(0x9ab8ff);
      else if (bomb.pierce) image.setTint(0xff8a7a);
      else image.clearTint();
    }
  }

  /** The round restarted (the clock went back): what the last one remembered is stale. */
  private forgetRound(tick: number): void {
    if (tick < this.lastTick) {
      this.placedAt.clear();
      this.ticked.clear();
      this.movedAt.clear();
    }
    this.lastTick = tick;
  }

  private updatePlayer(image: Image, player: Player, tick: number): void {
    this.posePlayer(image, player, tick);
    // A mounted frame is taller than the cell, with the rider's head above it:
    // stand every frame on the cell's centre line, whatever its height.
    const { width, height } = image.frame;
    image.setOrigin(0.5, 1 - width / 2 / height);
  }

  private posePlayer(image: Image, player: Player, tick: number): void {
    const [x, y] = this.cellToPixel(player.x, player.y);
    // Drawn a little high so the head overlaps the cell above, as in 3/4 view.
    image
      .setPosition(x, y - this.tile * 0.12)
      .setDepth(DEPTH.player + player.y);

    // Held, flying or dizzy: drawn below without the vest flicker, but dark in a blackout like everyone.
    if (
      player.alive &&
      (player.flight || player.carriedBy || tick < player.stunnedUntilTick)
    ) {
      if (this.dark > 0.5) image.setTint(DARK_TINT);
      else image.clearTint();
    }
    if (player.alive && player.flight) {
      // Thrown: an arc along the flight, round the edge of the arena, spinning.
      const [fx, fy, arc] = flightPosition(
        this.config.session.state,
        player.flight,
        tick,
      );
      const [px, py] = this.cellToPixel(fx, fy);
      image
        .setPosition(px, py - this.tile * 0.12 - arc * this.tile * 0.9)
        .setDepth(DEPTH.thrown)
        .setScale(1 + arc * 0.2)
        .setAngle(((tick - player.flight.startTick) * 14) % 360)
        .setTexture(TEXTURE.player(player.slot, player.facing, 0));
      return;
    }
    if (player.alive && player.carriedBy) {
      // Held overhead, kicking their legs.
      image
        .setPosition(x, y - this.tile * 0.95)
        .setDepth(DEPTH.player + player.y + 0.6)
        .setScale(0.9)
        .setRotation(Math.sin(tick * 0.6) * 0.18)
        .setTexture(
          TEXTURE.player(
            player.slot,
            player.facing,
            WALK_CYCLE[Math.floor(tick / 5) % 4] ?? 0,
          ),
        );
      return;
    }
    if (player.alive && tick < player.stunnedUntilTick) {
      // Dizzy after the landing: a wobble.
      image
        .setTexture(TEXTURE.player(player.slot, player.facing, 0))
        .setScale(1)
        .setRotation(Math.sin(tick * 0.5) * 0.25);
      return;
    }

    if (player.alive) {
      const state = this.config.session.state;
      // A new round starts the clock over: a bomb set in the last one is no pose.
      const sincePlaced = tick - (this.placedAt.get(player.id) ?? -PLACE_TICKS);
      const placing =
        !player.mountId && sincePlaced >= 0 && sincePlaced < PLACE_TICKS;
      // The round is decided and this is the last one standing: the cheer starts
      // before the round is declared over, as soon as the arena knows.
      const cheering =
        !player.mountId &&
        isDecided(state) &&
        state.players.filter((p) => p.alive).length === 1;
      // Standing next to a bomb about to go: the scare.
      const scared =
        !player.mountId &&
        !player.moving &&
        !placing &&
        !cheering &&
        state.bombs.some(
          (b) =>
            b.fuse < SCARE_FUSE &&
            Math.abs(b.col - Math.round(player.x)) <= 1 &&
            Math.abs(b.row - Math.round(player.y)) <= 1,
        );
      if (player.moving) this.movedAt.set(player.id, tick);
      const idleFor = tick - (this.movedAt.get(player.id) ?? tick);
      const fidgeting = !player.mountId && idleFor > FIDGET_AFTER;
      const fidget = fidgeting
        ? (FIDGET[Math.floor(((idleFor - FIDGET_AFTER) % 150) / 10)] ?? 0)
        : 0;
      const frame = cheering
        ? FRAME_CHEER
        : placing
          ? FRAME_PLACE
          : scared
            ? FRAME_SCARED
            : player.moving
              ? (WALK_CYCLE[Math.floor(tick / 8) % 4] ?? 0)
              : player.mountId
                ? // A mount waiting: its idle frames, slowly.
                  (MOUNT_IDLE[Math.floor(tick / 20) % 4] ?? 0)
                : fidget;
      image.setTexture(
        player.mountId
          ? this.mountedTexture(player, frame)
          : TEXTURE.player(player.slot, player.facing, frame),
      );
      // In the air: an arc up and a little bigger at the top.
      if (player.jump) {
        const progress =
          (tick - player.jump.startTick) /
          (player.jump.endTick - player.jump.startTick);
        const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
        image
          .setY(y - this.tile * 0.12 - arc * this.tile * 0.55)
          .setScale(1 + arc * 0.15)
          .setRotation(0);
        return;
      }
      // Sprinting: leans into the run and shakes a little.
      if (isDashing(this.config.session.state, player)) {
        const lean =
          player.facing === 'left'
            ? -0.12
            : player.facing === 'right'
              ? 0.12
              : 0;
        image
          .setRotation(lean + Math.sin(tick * 1.3) * 0.04)
          .setScale(1.05, 0.97);
        return;
      }
      if (cheering) {
        // The winner hops on the spot.
        const hop = Math.abs(Math.sin(tick * 0.28));
        image
          .setY(y - this.tile * 0.12 - hop * this.tile * 0.14)
          .setRotation(0)
          .setScale(1 + hop * 0.04, 1 + hop * 0.06);
      } else if (placing) {
        // Setting it down: a squash that springs back.
        const t = sincePlaced / PLACE_TICKS;
        const squash = (1 - t) * 0.14;
        image.setRotation(0).setScale(1 + squash, 1 - squash);
      } else if (scared) {
        // Trembling.
        image.setRotation(Math.sin(tick * 1.6) * 0.05).setScale(1.03, 0.98);
      } else if (!player.moving) {
        // Standing: breathing; and, after a while, a sway from foot to foot.
        const breath = Math.sin(tick * 0.16) * 0.012;
        const sway = fidgeting ? Math.sin(idleFor * 0.1) * 0.035 : 0;
        image.setRotation(sway).setScale(1 - breath, 1 + breath);
      } else image.setRotation(0).setScale(1);
      // The vest: a cool flicker while it lasts.
      if (tick < player.vestUntilTick)
        image.setTint(Math.floor(tick / 4) % 2 === 0 ? 0xffffff : 0x9ff0e0);
      else if (this.dark > 0.5) image.setTint(DARK_TINT);
      else image.clearTint();
      return;
    }
    // Death: a white flash, then the fall onto the back, then gone.
    const elapsed = tick - (player.diedAtTick ?? tick);
    const t = elapsed / DEATH_TICKS;
    const fall = Math.min(1, t * 2.2);
    const ease = 1 - (1 - fall) * (1 - fall);
    image
      .setTexture(TEXTURE.player(player.slot, 'down', FRAME_SCARED))
      .setAngle(-88 * ease)
      .setY(y - this.tile * 0.12 + ease * this.tile * 0.18)
      .setScale(1 - ease * 0.08, 1)
      .setAlpha(t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3));
    if (elapsed < 5) {
      // Phaser 4 split fill out of the tint: set the colour, then the mode.
      image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else image.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }
}

/** How cracked an egg is: the nearer the closest living player, the further along. */
export function eggStage(state: GameState, col: number, row: number): number {
  let nearest = Infinity;
  for (const player of state.players) {
    if (!player.alive) continue;
    nearest = Math.min(nearest, Math.hypot(player.x - col, player.y - row));
  }
  if (nearest < 1.2) return EGG_STAGES - 1;
  if (nearest < 2) return 2;
  if (nearest < 3) return 1;
  return 0;
}

export { flameFrame };

function isTextField(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return ![
      'button',
      'checkbox',
      'radio',
      'range',
      'submit',
      'reset',
      'color',
      'file',
    ].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** An anthill: a cone of red earth with a dark hole on top. */
function paintMound(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 100;
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(50, 86, 42, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 84);
  ctx.quadraticCurveTo(50, -0, 92, 84);
  ctx.closePath();
  ctx.fillStyle = '#8a5a34';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1d1a17';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, 60);
  ctx.quadraticCurveTo(50, 50, 70, 60);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#b07a4a';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(50, 40, 11, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2a1a10';
  ctx.fill();
}

/** Where the boss will come up: a dark, broken patch with a red ring. */
function paintCrack(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60, 34, 18, 0.75)';
  ctx.fill();
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = '#ff6b57';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c, size * 0.1);
  ctx.lineTo(c - size * 0.08, c - size * 0.15);
  ctx.lineTo(c + size * 0.08, c);
  ctx.lineTo(c - size * 0.05, c + size * 0.15);
  ctx.lineTo(c + size * 0.05, size * 0.9);
  ctx.moveTo(size * 0.15, c - size * 0.05);
  ctx.lineTo(c - size * 0.1, c);
  ctx.moveTo(size * 0.85, c + size * 0.05);
  ctx.lineTo(c + size * 0.1, c + size * 0.05);
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = '#1d1a17';
  ctx.stroke();
}

/** The mound of earth a boss pushes up as it moves underground. */
function paintBurrow(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.beginPath();
  ctx.ellipse(c, c + size * 0.1, size * 0.36, size * 0.22, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#7a5030';
  ctx.fill();
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = '#1d1a17';
  ctx.stroke();
  ctx.fillStyle = '#5a3a1e';
  for (const [dx, dy] of [
    [-0.3, 0.18],
    [0.32, 0.2],
    [0.05, 0.24],
  ] as const) {
    ctx.beginPath();
    ctx.arc(c + dx * size, c + dy * size, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Snail slime: a wet, glossy green smear. */
function paintSlime(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.fillStyle = 'rgba(150, 220, 170, 0.55)';
  ctx.beginPath();
  ctx.ellipse(c, c, size * 0.42, size * 0.3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 255, 230, 0.6)';
  ctx.beginPath();
  ctx.ellipse(
    c - size * 0.12,
    c - size * 0.08,
    size * 0.12,
    size * 0.05,
    0.3,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

/** A part's gate: a charged barrier hugging the right side of the cell. */
function paintGateBar(ctx: CanvasRenderingContext2D, size: number): void {
  const x = size * 0.72;
  const glow = ctx.createLinearGradient(x - size * 0.2, 0, size, 0);
  glow.addColorStop(0, 'rgba(255, 74, 61, 0)');
  glow.addColorStop(1, 'rgba(255, 74, 61, 0.45)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - size * 0.2, 0, size * 0.48, size);
  for (let y = 0; y < size; y += size / 4) {
    ctx.fillStyle = '#ff4a3d';
    ctx.fillRect(x, y, size * 0.28, size / 8);
    ctx.fillStyle = '#1b1d24';
    ctx.fillRect(x, y + size / 8, size * 0.28, size / 8);
  }
}

/** The key of a `key` part: brass, a round bow and two teeth. */
function paintKey(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 64;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.6);
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = '#1d1a17';
  ctx.fillStyle = '#ffcf4a';
  ctx.beginPath();
  ctx.arc(-12 * s, 0, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-3 * s, -3.5 * s, 26 * s, 7 * s);
  ctx.rect(14 * s, 3 * s, 4 * s, 7 * s);
  ctx.rect(20 * s, 3 * s, 4 * s, 5 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1d1a17';
  ctx.beginPath();
  ctx.arc(-12 * s, 0, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(0, -2 * s, 16 * s, 2 * s);
  ctx.restore();
}

/** Left by a player with no life to spend: a hard hat a teammate can pick up. */
function paintHelmet(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 64;
  const c = size / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(c, c + 16 * s, 22 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = '#1d1a17';
  ctx.fillStyle = '#f2c230';
  ctx.beginPath();
  ctx.arc(c, c + 8 * s, 18 * s, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(c - 24 * s, c + 7 * s, 48 * s, 6 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(c - 10 * s, c - 6 * s, 6 * s, 10 * s);
  ctx.fillStyle = '#d99a1c';
  ctx.fillRect(c - 2 * s, c - 10 * s, 4 * s, 18 * s);
}

/** One of the Gato's generators: a squat box with a humming violet core. */
function paintGenerator(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 64;
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = '#0b0d12';
  ctx.fillStyle = '#4b5160';
  ctx.beginPath();
  ctx.roundRect(8 * s, 12 * s, 48 * s, 44 * s, 6 * s);
  ctx.fill();
  ctx.stroke();
  const core = ctx.createRadialGradient(
    32 * s,
    34 * s,
    2 * s,
    32 * s,
    34 * s,
    16 * s,
  );
  core.addColorStop(0, '#f1dcff');
  core.addColorStop(0.5, '#c78bff');
  core.addColorStop(1, '#6b3fa8');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(32 * s, 34 * s, 13 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e9b83a';
  ctx.fillRect(12 * s, 14 * s, 40 * s, 4 * s);
}

/** A cell of the Gato's line while it charges: a cyan warning on the floor. */
function paintZapWarning(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = 'rgba(155, 228, 255, 0.28)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(155, 228, 255, 0.85)';
  ctx.lineWidth = size * 0.05;
  ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);
}

/** A cell of the zap itself: a crackling bolt across a white-hot glow. */
function paintZap(ctx: CanvasRenderingContext2D, size: number): void {
  const glow = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size * 0.7,
  );
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  glow.addColorStop(0.4, 'rgba(155, 228, 255, 0.8)');
  glow.addColorStop(1, 'rgba(95, 211, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.06;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(size * 0.3, size * 0.35);
  ctx.lineTo(size * 0.5, size * 0.62);
  ctx.lineTo(size * 0.72, size * 0.4);
  ctx.lineTo(size, size * 0.52);
  ctx.stroke();
}

/** The Gato in the dark: two cyan slits, all that shows. */
function paintEyes(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 64;
  for (const cx of [22, 42]) {
    ctx.fillStyle = 'rgba(155, 228, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx * s, 32 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9be4ff';
    ctx.beginPath();
    ctx.ellipse(cx * s, 32 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b1420';
    ctx.fillRect((cx - 1) * s, 27 * s, 2 * s, 10 * s);
  }
}

/** A breaker: a red switch box that holds an arc line on. */
function paintBreaker(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 64;
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = '#0b0d12';
  ctx.fillStyle = '#c4382e';
  ctx.beginPath();
  ctx.roundRect(12 * s, 8 * s, 40 * s, 48 * s, 6 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b1d24';
  ctx.fillRect(22 * s, 16 * s, 20 * s, 24 * s);
  ctx.fillStyle = '#ffd36e';
  ctx.fillRect(28 * s, 18 * s, 8 * s, 12 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(15 * s, 11 * s, 4 * s, 40 * s);
  ctx.fillStyle = '#ffd36e';
  ctx.beginPath();
  ctx.moveTo(34 * s, 44 * s);
  ctx.lineTo(28 * s, 52 * s);
  ctx.lineTo(33 * s, 52 * s);
  ctx.lineTo(29 * s, 60 * s);
  ctx.lineTo(38 * s, 50 * s);
  ctx.lineTo(33 * s, 50 * s);
  ctx.closePath();
  ctx.fill();
}

/** A conductor cable across the floor: dark, rimmed in hazard yellow. */
function paintCable(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#e9b83a';
  ctx.fillRect(0, size * 0.42, size, size * 0.16);
  ctx.fillStyle = '#1b1d24';
  ctx.fillRect(0, size * 0.45, size, size * 0.1);
}

function arcWire(
  ctx: CanvasRenderingContext2D,
  size: number,
  colour: string,
): void {
  ctx.fillStyle = '#2f3a4a';
  ctx.fillRect(0, size * 0.44, size, size * 0.12);
  ctx.fillStyle = colour;
  ctx.fillRect(0, size * 0.47, size, size * 0.06);
}

/** An arc line between shocks: the wire hums, faintly lit. */
function paintArcIdle(ctx: CanvasRenderingContext2D, size: number): void {
  arcWire(ctx, size, '#3c6f86');
}

/** An arc line switched off for good: a dead grey wire. */
function paintArcDead(ctx: CanvasRenderingContext2D, size: number): void {
  arcWire(ctx, size, '#4b5160');
}

/** An arc line shocking: a white-hot crackle with a cyan glow. */
function paintArcLive(ctx: CanvasRenderingContext2D, size: number): void {
  const glow = ctx.createLinearGradient(0, 0, 0, size);
  glow.addColorStop(0.2, 'rgba(95, 211, 255, 0)');
  glow.addColorStop(0.5, 'rgba(155, 228, 255, 0.75)');
  glow.addColorStop(0.8, 'rgba(95, 211, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.06;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(size * 0.25, size * 0.38);
  ctx.lineTo(size * 0.5, size * 0.6);
  ctx.lineTo(size * 0.75, size * 0.4);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();
}

/** The escape's last cell: an inspection grate, cracked. */
function paintCollapse(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = '#1b1d24';
  ctx.fillRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  ctx.strokeStyle = '#4b5160';
  ctx.lineWidth = size * 0.05;
  for (let x = size * 0.2; x < size * 0.9; x += size * 0.16) {
    ctx.beginPath();
    ctx.moveTo(x, size * 0.12);
    ctx.lineTo(x, size * 0.88);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ff8a3d';
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.moveTo(size * 0.15, size * 0.3);
  ctx.lineTo(size * 0.45, size * 0.52);
  ctx.lineTo(size * 0.38, size * 0.7);
  ctx.lineTo(size * 0.82, size * 0.86);
  ctx.stroke();
}

/** The grate gone: a hole down into the cellar, lit from below. */
function paintCollapseOpen(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  const glow = ctx.createRadialGradient(c, c, size * 0.05, c, c, size * 0.5);
  glow.addColorStop(0, 'rgba(155, 228, 255, 0.9)');
  glow.addColorStop(0.35, 'rgba(11, 20, 32, 1)');
  glow.addColorStop(1, 'rgba(11, 20, 32, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(c, c, size * 0.42, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff8a3d';
  ctx.lineWidth = size * 0.04;
  ctx.stroke();
}
