import {
  BLOCK_BURN_TICKS,
  BOMB_FUSE_TICKS,
  DEATH_TICKS,
  Direction,
  flightPosition,
  GameEvent,
  GameState,
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
import { ArenaMoment, blackoutAt } from '../skins/hd/themes/moments';
import { ArenaSession } from '../session/arena-session';
import { EGG_STAGES } from '../skins/hd/egg';
import { loadArenaTheme, tileTextureKey } from '../skins/hd/themes';
import { ArenaSkin } from '../skins/skin';
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
  powerUp: 3,
  dark: 3.5,
  bomb: 4,
  flame: 5,
  player: 10,
  thrown: 40,
  fx: 100,
};
/** Players under a blackout: a silhouette, not gone. */
const DARK_TINT = 0x1c2130;
/** Outsiders are drawn a shade paler: outside, not on a team yet. */
const OUTSIDER_TINT = 0xd4d9e2;
/** Alternate floor cells are slightly darker — the arena's checkerboard. */
const CHECKER_TINT = 0xe6e6e6;
/** Standing, step, standing, other step — four ticks-of-8 per cycle. */
const WALK_CYCLE = [1, 0, 2, 0];

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
  private readonly bombs = new Map<number, Image>();
  private readonly flames = new Map<string, Image>();
  private readonly players = new Map<string, Image>();
  private readonly outsiders = new Map<string, Image>();
  private readonly thrown = new Map<number, Image>();
  /** Bombs held overhead with the glove, by holder. */
  private readonly held = new Map<string, Image>();
  /** Characters whose border textures the skin has painted so far. */
  private readonly outsiderLooks = new Set<string>();
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

  override update(_time: number, delta: number): void {
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
    const later = () => setTimeout(sync);
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
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', later);
      canvas?.removeEventListener('pointerdown', takeBack);
    });
    sync();
  }

  private render(): void {
    const state = this.config.session.state;
    if (state !== this.renderedState) this.resetArena(state);

    this.renderMoment(state);
    this.renderTiles(state);
    this.renderBurningBlocks(state);
    this.renderPowerUps(state);
    this.renderBombs(state);
    this.tintBombs(state);
    this.renderFlames(state);
    this.renderPlayers(state);
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
    if (!this.vignette && !this.config.skin.pixelArt)
      this.vignette = this.addVignette();
    if (this.moment?.kind === 'rain' && !this.rain) this.rain = this.addRain();
    if (this.moment?.kind === 'blackout' && !this.darkness) {
      this.darkness = this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x02030a)
        .setOrigin(0, 0)
        .setDepth(DEPTH.dark)
        .setAlpha(0);
    }
  }

  /** The blackout, from the tick: a dark sheet over the arena, bombs and flames above it. */
  private renderMoment(state: GameState): void {
    this.dark = blackoutAt(this.moment, state.tick);
    this.darkness?.setAlpha(0.86 * this.dark);
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
    emitter.setDepth(DEPTH.fx);
    // A wet sheen over the asphalt: the floor catches the sky.
    this.add
      .rectangle(0, 0, width, height, 0x9ac7ff)
      .setOrigin(0, 0)
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
        // Pulses, faster as the fuse burns down.
        const rate = b.fuse < BOMB_FUSE_TICKS / 3 ? 0.5 : 0.25;
        const pulse = 0.08 * Math.sin(elapsed * rate);
        image.setScale(1 + pulse, 1 - pulse); // squash and stretch
        image.setTexture(TEXTURE.bomb(Math.floor(elapsed / 6) % 2));
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
      (o) =>
        this.add.image(0, 0, this.outsiderTexture(o, 0)).setTint(OUTSIDER_TINT),
      (image, o) => {
        const [x, y] = this.cellToPixel(o.x, o.y);
        const frame = o.moving
          ? (WALK_CYCLE[Math.floor(state.tick / 8) % 4] ?? 0)
          : 0;
        image
          .setPosition(x, y - this.tile * 0.12)
          .setDepth(DEPTH.player + o.y)
          .setTexture(this.outsiderTexture(o, frame));
      },
    );
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
          break;
        case 'block-destroyed':
          this.burst(event.col, event.row, TEXTURE.debris, 7, false);
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
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + (glow ? 0 : this.tile * 0.3),
        angle: particle.angle + (Math.random() - 0.5) * 540,
        alpha: 0,
        scale: glow ? 0.1 : 0.3,
        duration: 450 + Math.random() * 250,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
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
      const frame = player.moving
        ? (WALK_CYCLE[Math.floor(tick / 8) % 4] ?? 0)
        : 0;
      image.setTexture(
        player.mountId
          ? TEXTURE.playerMounted(
              player.slot,
              player.mountId,
              player.facing,
              frame,
            )
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
      image.setRotation(0).setScale(1);
      // The vest: a cool flicker while it lasts.
      if (tick < player.vestUntilTick)
        image.setTint(Math.floor(tick / 4) % 2 === 0 ? 0xffffff : 0x9ff0e0);
      else if (this.dark > 0.5) image.setTint(DARK_TINT);
      else image.clearTint();
      return;
    }
    // Death: flash, spin and fade out.
    const elapsed = tick - (player.diedAtTick ?? tick);
    const t = elapsed / DEATH_TICKS;
    image
      .setTexture(TEXTURE.player(player.slot, 'down', 0))
      .setTint(Math.floor(elapsed / 4) % 2 === 0 ? 0xffffff : 0xff6060)
      .setAlpha(1 - t)
      .setAngle(t * 360)
      .setScale(1 + t * 0.5);
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
