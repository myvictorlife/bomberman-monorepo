import {
  CharacterId,
  createRng,
  DEFAULT_CHARACTER_ID,
  Direction,
  FlameShape,
  PowerUpKind,
} from '@libs/game-core';
import { paintCartoonCharacter } from '../../characters/cartoon/cartoon';
import { MOUNTED_HEADROOM } from '../../characters/cartoon/ink';
import {
  BOMB_FRAMES,
  FACINGS,
  FLAME_FRAMES,
  FLAME_SHAPES,
  MOUNT_IDS,
  PLAYER_FRAMES,
  PLAYER_SLOTS,
  POWER_UP_KINDS,
  TEXTURE,
} from '../texture-keys';
import { EGG_STAGES, paintEgg } from './egg';
import {
  HD,
  HD_PLAYER_COLORS,
  HD_TILE as S,
  HdPlayerColors,
} from './hd-palette';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * Paints every texture of the HD skin: 64 px tiles drawn with gradients, soft
 * shadows and rim light instead of pixels. Deterministic — the same seeds give
 * the same grain on every machine.
 */
export function paintHdTextures(
  doc: Document,
  characters: readonly CharacterId[] = [],
): Map<string, HTMLCanvasElement> {
  const textures = new Map<string, HTMLCanvasElement>();
  const paint = painter(doc, textures);

  paint(TEXTURE.floor, (ctx) => paintFloor(ctx, false));
  paint(TEXTURE.floorShadow, (ctx) => paintFloor(ctx, true));
  paint(TEXTURE.wall, paintWall);
  paint(TEXTURE.block, paintCrate);
  paint(TEXTURE.shadow, paintShadow);
  paint(TEXTURE.debris, paintDebris);
  paint(TEXTURE.spark, paintSpark);
  for (let f = 0; f < BOMB_FRAMES; f++)
    paint(TEXTURE.bomb(f), (ctx) => paintBomb(ctx, f));
  for (const shape of FLAME_SHAPES) {
    for (let f = 0; f < FLAME_FRAMES; f++) {
      paint(TEXTURE.flame(shape, f), (ctx) => paintFlame(ctx, shape, f));
    }
  }
  for (const kind of POWER_UP_KINDS)
    paint(TEXTURE.powerUp(kind), (ctx) => paintPowerUp(ctx, kind));
  for (let stage = 1; stage < EGG_STAGES; stage++)
    paint(TEXTURE.egg(stage), (ctx) => paintEgg(ctx, { stage }));
  for (let slot = 0; slot < PLAYER_SLOTS; slot++) {
    paintCharacterTextures(doc, characters[slot] ?? null, slot, textures);
  }
  return textures;
}

/** The team colour of someone on the border: the charcoal suit, no team's own. */
const OUTSIDER_TEAM_SLOT = 1;

/**
 * One character's frames: a player slot's textures (standing, walking,
 * riding every mount), or the border textures of `TEXTURE.outsider` when
 * `slot` is `'outsider'`. A slot nobody sits in (`characterId` null) keeps
 * the old helmet, so the texture set stays complete.
 */
export function paintCharacterTextures(
  doc: Document,
  characterId: CharacterId | null,
  slot: number | 'outsider',
  textures = new Map<string, HTMLCanvasElement>(),
): Map<string, HTMLCanvasElement> {
  const paint = painter(doc, textures);
  if (slot === 'outsider') {
    const id = characterId ?? DEFAULT_CHARACTER_ID;
    for (const facing of FACINGS) {
      for (let f = 0; f < PLAYER_FRAMES; f++) {
        paint(TEXTURE.outsider(id, facing, f), (ctx) =>
          paintCartoonCharacter(ctx, {
            characterId: id,
            facing,
            frame: f,
            slot: OUTSIDER_TEAM_SLOT,
          }),
        );
      }
    }
    return textures;
  }
  const colors = HD_PLAYER_COLORS[slot] as HdPlayerColors;
  for (const facing of FACINGS) {
    for (let f = 0; f < PLAYER_FRAMES; f++) {
      paint(TEXTURE.player(slot, facing, f), (ctx) =>
        characterId
          ? paintCartoonCharacter(ctx, { characterId, facing, frame: f, slot })
          : paintHdPlayer(ctx, colors, facing, f),
      );
      for (const mountId of MOUNT_IDS) {
        paint(
          TEXTURE.playerMounted(slot, mountId, facing, f),
          (ctx) =>
            paintCartoonCharacter(ctx, {
              characterId: characterId ?? DEFAULT_CHARACTER_ID,
              facing,
              frame: f,
              slot,
              mountId,
            }),
          MOUNTED_HEADROOM,
        );
      }
    }
  }
  return textures;
}

/**
 * Paints a texture of one tile. `headroom` (in the 64-unit space) makes it
 * taller at the top and moves the drawing down, so the bottom 64 × 64 is
 * still the cell — the arena stands tall textures on their feet.
 */
function painter(doc: Document, textures: Map<string, HTMLCanvasElement>) {
  return (key: string, draw: (ctx: Ctx) => void, headroom = 0) => {
    const canvas = doc.createElement('canvas');
    const extra = Math.round((headroom * S) / 64);
    canvas.width = S;
    canvas.height = S + extra;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(0, extra);
    draw(ctx);
    textures.set(key, canvas);
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

function linear(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: string[],
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** A sphere lit from the upper left. */
function sphere(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  light: string,
  mid: string,
  dark: string,
) {
  const g = ctx.createRadialGradient(
    x - r * 0.4,
    y - r * 0.45,
    r * 0.08,
    x,
    y,
    r * 1.05,
  );
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function fillStroke(ctx: Ctx, fill: string | CanvasGradient, width = 1.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = HD.outline;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Fine, deterministic grain over the current path's bounding box. */
function grain(
  ctx: Ctx,
  seed: number,
  count: number,
  light: string,
  dark: string,
  pad = 2,
) {
  const rng = createRng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng() < 0.5 ? dark : light;
    ctx.fillRect(
      pad + rng() * (S - pad * 2),
      pad + rng() * (S - pad * 2),
      1,
      1,
    );
  }
}

// ── arena ──────────────────────────────────────────────────────────────────

function paintFloor(ctx: Ctx, shadow: boolean): void {
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [HD.floor, HD.floorDark]);
  ctx.fillRect(0, 0, S, S);
  grain(ctx, 11, 220, 'rgba(255,255,255,0.035)', 'rgba(0,0,0,0.12)', 0);

  // A soft centre lift, like a matte panel catching the arena lights.
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Panel seams.
  ctx.strokeStyle = HD.floorSeam;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);

  if (shadow) {
    ctx.fillStyle = linear(ctx, 0, 0, 0, S * 0.55, [
      'rgba(0,0,0,0.55)',
      'rgba(0,0,0,0)',
    ]);
    ctx.fillRect(0, 0, S, S * 0.55);
  }
}

/** Matte stone block in 3/4 view: a lit top face over a darker front face. */
function paintWall(ctx: Ctx): void {
  const front = S * 0.22;
  const r = 9;

  roundRect(ctx, 2, 2, S - 4, S - 4, r);
  ctx.fillStyle = linear(ctx, 0, S - front, 0, S, [
    HD.stoneSide,
    HD.stoneSideDark,
  ]);
  ctx.fill();

  roundRect(ctx, 2, 2, S - 4, S - front - 2, r);
  ctx.fillStyle = linear(ctx, 0, 2, S, S - front, [
    HD.stoneTop,
    HD.stoneTopDark,
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  grain(ctx, 23, 140, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.14)');
  ctx.restore();

  // Rim light along the top-left edge, in the arena's accent.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(160, 220, 255, 0.45)';
  ctx.beginPath();
  ctx.moveTo(4.5, S - front - 6);
  ctx.lineTo(4.5, 2 + r);
  ctx.quadraticCurveTo(4.5, 4.5, 2 + r, 4.5);
  ctx.lineTo(S - 2 - r, 4.5);
  ctx.stroke();

  // The seam where top meets front.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(4, S - front);
  ctx.lineTo(S - 4, S - front);
  ctx.stroke();

  roundRect(ctx, 2, 2, S - 4, S - 4, r);
  ctx.strokeStyle = HD.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** A wooden crate with metal corner brackets — the soft block. */
function paintCrate(ctx: Ctx): void {
  const r = 6;
  roundRect(ctx, 3, 3, S - 6, S - 6, r);
  ctx.fillStyle = linear(ctx, 3, 3, S - 3, S - 3, [HD.crate, HD.crateDark]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Planks: three horizontal boards with a darker joint between them.
  const rng = createRng(5);
  for (let i = 0; i < 3; i++) {
    const y = 3 + (i * (S - 6)) / 3;
    ctx.fillStyle = `rgba(0,0,0,${0.06 + rng() * 0.08})`;
    ctx.fillRect(3, y, S - 6, (S - 6) / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(3, y, S - 6, 1.5);
    ctx.fillStyle = 'rgba(255,230,200,0.14)';
    ctx.fillRect(3, y + 1.5, S - 6, 1);
    // Wood grain.
    ctx.strokeStyle = 'rgba(60,35,20,0.18)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const gy = y + 4 + rng() * ((S - 6) / 3 - 8);
      ctx.beginPath();
      ctx.moveTo(6, gy);
      ctx.bezierCurveTo(
        S * 0.3,
        gy + (rng() - 0.5) * 3,
        S * 0.7,
        gy + (rng() - 0.5) * 3,
        S - 6,
        gy,
      );
      ctx.stroke();
    }
  }
  // Front face shading.
  ctx.fillStyle = linear(ctx, 0, S * 0.75, 0, S, [
    'rgba(0,0,0,0)',
    'rgba(0,0,0,0.4)',
  ]);
  ctx.fillRect(0, S * 0.75, S, S * 0.25);
  // Top-left rim light.
  ctx.fillStyle = linear(ctx, 0, 0, 0, 10, [
    'rgba(255,235,210,0.35)',
    'rgba(255,235,210,0)',
  ]);
  ctx.fillRect(3, 3, S - 6, 10);
  ctx.restore();

  // Corner brackets.
  const bracket = (x: number, y: number, sx: number, sy: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(14, 4.5);
    ctx.lineTo(4.5, 4.5);
    ctx.lineTo(4.5, 14);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, 14, 14, [HD.bracket, HD.bracketDark]);
    ctx.fill();
    ctx.strokeStyle = HD.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    circle(ctx, 2.6, 2.6, 1.1);
    ctx.fillStyle = HD.metal;
    ctx.fill();
    ctx.restore();
  };
  bracket(3, 3, 1, 1);
  bracket(S - 3, 3, -1, 1);
  bracket(3, S - 3, 1, -1);
  bracket(S - 3, S - 3, -1, -1);

  roundRect(ctx, 3, 3, S - 6, S - 6, r);
  ctx.strokeStyle = HD.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function paintShadow(ctx: Ctx): void {
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.45);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.scale(1, 0.4);
  ctx.translate(-S / 2, -S / 2);
  ctx.fillStyle = g;
  circle(ctx, S / 2, S / 2, S * 0.45);
  ctx.fill();
  ctx.restore();
}

function paintDebris(ctx: Ctx): void {
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(0.3);
  roundRect(ctx, -9, -6, 18, 12, 2);
  ctx.fillStyle = linear(ctx, 0, -6, 0, 6, [HD.crate, HD.crateDark]);
  ctx.fill();
  ctx.strokeStyle = HD.outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function paintSpark(ctx: Ctx): void {
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,245,1)');
  g.addColorStop(0.2, 'rgba(255,220,130,0.9)');
  g.addColorStop(0.5, 'rgba(255,150,50,0.35)');
  g.addColorStop(1, 'rgba(255,110,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

// ── bomb ───────────────────────────────────────────────────────────────────

function paintBomb(ctx: Ctx, frame: number): void {
  const cx = S * 0.46;
  const cy = S * 0.58;
  const r = S * 0.29;

  circle(ctx, cx, cy, r);
  fillStroke(ctx, sphere(ctx, cx, cy, r, '#6f7893', '#262a37', '#07080c'), 1.5);

  // Cool rim light from the arena, warm rim light from the fuse.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(120, 190, 255, 0.28)';
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2.5, 0.3, 1.7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 170, 80, 0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2.5, -1.3, -0.3);
  ctx.stroke();

  ellipse(ctx, cx - r * 0.38, cy - r * 0.42, r * 0.22, r * 0.12, -0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();

  // Metal cap.
  ctx.save();
  ctx.translate(cx + r * 0.62, cy - r * 0.62);
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, -6, -5, 12, 9, 2);
  ctx.fillStyle = linear(ctx, -6, 0, 6, 0, [HD.metal, HD.metalDark]);
  ctx.fill();
  ctx.strokeStyle = HD.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Fuse.
  const fx = cx + r * 0.9;
  const fy = cy - r * 0.9;
  const ex = cx + r * 1.15;
  const ey = cy - r * 1.55;
  ctx.strokeStyle = HD.outline;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx + 8, fy - 4, ex, ey);
  ctx.stroke();
  ctx.strokeStyle = HD.fuse;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Spark — a soft bloom rather than rays.
  const glow = frame === 0 ? 9 : 12;
  const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, glow);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.3, 'rgba(255,205,90,0.9)');
  g.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = g;
  circle(ctx, ex, ey, glow);
  ctx.fill();
}

// ── flames ─────────────────────────────────────────────────────────────────

/** Half-width of the blast per frame, as a share of the tile. */
const FLAME_WIDTH = [0.4, 0.34, 0.24, 0.12];

/** The outline of `shape` at half-width `hw`, drawn pointing right/along x. */
function flamePath(ctx: Ctx, shape: FlameShape, hw: number): void {
  const c = S / 2;
  ctx.beginPath();
  if (shape === 'center') {
    ctx.roundRect(0, c - hw, S, hw * 2, 0);
    ctx.roundRect(c - hw, 0, hw * 2, S, 0);
    ctx.moveTo(c + hw * 1.25, c);
    ctx.arc(c, c, hw * 1.25, 0, TAU);
    return;
  }
  if (shape === 'horizontal' || shape === 'vertical') {
    ctx.rect(0, c - hw, S, hw * 2);
    return;
  }
  // An end: the blast arrives from the left and finishes in a rounded tongue.
  ctx.rect(0, c - hw, c, hw * 2);
  ctx.moveTo(c + Math.min(hw * 1.3, c - 2), c);
  ctx.ellipse(c, c, Math.min(hw * 1.3, c - 2), hw, 0, 0, TAU);
}

const FLAME_ROTATION: Record<FlameShape, number> = {
  center: 0,
  horizontal: 0,
  'end-right': 0,
  vertical: Math.PI / 2,
  'end-down': Math.PI / 2,
  'end-left': Math.PI,
  'end-up': -Math.PI / 2,
};

function paintFlame(ctx: Ctx, shape: FlameShape, frame: number): void {
  const hw = S * (FLAME_WIDTH[frame] ?? 0.1);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(FLAME_ROTATION[shape]);
  ctx.translate(-S / 2, -S / 2);

  // Drawn additively in the scene: the outer layers are the glow, the core is
  // near-white — like energy rather than cartoon fire.
  const layers: [number, string][] = [
    [1.35, 'rgba(255, 90, 20, 0.22)'],
    [1, 'rgba(255, 120, 30, 0.6)'],
    [0.72, '#ff8a2c'],
    [0.48, '#ffc45a'],
    [0.24, '#fff3d2'],
  ];
  for (const [scale, color] of layers) {
    ctx.shadowBlur = scale > 1 ? 12 : 0;
    ctx.shadowColor = 'rgba(255, 110, 20, 0.8)';
    flamePath(ctx, shape, Math.min(hw * scale, S / 2 - 1));
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

// ── power-ups ──────────────────────────────────────────────────────────────

const PANEL: Record<PowerUpKind, { glow: string; from: string; to: string }> = {
  bomb: {
    glow: '#5fa8ff',
    from: 'rgba(90, 140, 230, 0.55)',
    to: 'rgba(30, 55, 120, 0.75)',
  },
  fire: {
    glow: '#ff8a4a',
    from: 'rgba(245, 120, 70, 0.55)',
    to: 'rgba(140, 40, 20, 0.75)',
  },
  speed: {
    glow: '#ffd24a',
    from: 'rgba(240, 200, 80, 0.55)',
    to: 'rgba(130, 95, 10, 0.75)',
  },
  egg: {
    glow: '#9ff0a8',
    from: 'rgba(120, 220, 140, 0.55)',
    to: 'rgba(30, 110, 60, 0.75)',
  },
  pierce: {
    glow: '#ff6a6a',
    from: 'rgba(230, 90, 90, 0.55)',
    to: 'rgba(120, 25, 35, 0.75)',
  },
  remote: {
    glow: '#9ab8ff',
    from: 'rgba(120, 150, 240, 0.55)',
    to: 'rgba(40, 55, 130, 0.75)',
  },
  vest: {
    glow: '#7fe8d8',
    from: 'rgba(90, 210, 190, 0.55)',
    to: 'rgba(20, 100, 90, 0.75)',
  },
  glove: {
    glow: '#ffb46a',
    from: 'rgba(245, 170, 90, 0.55)',
    to: 'rgba(130, 70, 20, 0.75)',
  },
  kick: {
    glow: '#c88aff',
    from: 'rgba(190, 130, 245, 0.55)',
    to: 'rgba(80, 35, 140, 0.75)',
  },
};

/** A small bomb for the glove and the kick cards. */
function miniBomb(ctx: Ctx, cx: number, cy: number, r: number): void {
  circle(ctx, cx, cy, r);
  fillStroke(ctx, sphere(ctx, cx, cy, r, '#6f7893', '#262a37', '#07080c'), 1);
  ellipse(ctx, cx - r * 0.4, cy - r * 0.4, r * 0.28, r * 0.17, -0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.strokeStyle = HD.fuse;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.6, cy - r * 0.75);
  ctx.quadraticCurveTo(cx + r, cy - r * 1.1, cx + r * 1.05, cy - r * 1.4);
  ctx.stroke();
  const g = ctx.createRadialGradient(
    cx + r * 1.05,
    cy - r * 1.45,
    0,
    cx + r * 1.05,
    cy - r * 1.45,
    4.5,
  );
  g.addColorStop(0, '#fff5d0');
  g.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = g;
  circle(ctx, cx + r * 1.05, cy - r * 1.45, 4.5);
  ctx.fill();
}

/** The glove: a big cartoon glove, a bomb held up in it. */
function paintGloveIcon(ctx: Ctx): void {
  miniBomb(ctx, 33, 22, 8);
  // Palm and fingers wrapped round the bomb from below.
  ctx.beginPath();
  ctx.moveTo(19, 30);
  ctx.bezierCurveTo(19, 24, 24, 24, 25, 29);
  ctx.lineTo(26, 31);
  ctx.bezierCurveTo(28, 28, 38, 28, 41, 31);
  ctx.bezierCurveTo(44, 26, 49, 28, 47, 34);
  ctx.bezierCurveTo(46, 42, 42, 46, 36, 47);
  ctx.lineTo(27, 47);
  ctx.bezierCurveTo(21, 45, 18, 38, 19, 30);
  ctx.closePath();
  ctx.shadowColor = 'rgba(255,190,120,0.7)';
  ctx.shadowBlur = 6;
  fillStroke(
    ctx,
    linear(ctx, 18, 26, 48, 48, ['#fff6ea', '#f1d9bf', '#c9a27c']),
    1.3,
  );
  ctx.shadowBlur = 0;
  // Knuckle seams.
  ctx.strokeStyle = 'rgba(120, 80, 50, 0.55)';
  ctx.lineWidth = 1.2;
  for (const x of [30, 35, 40]) {
    ctx.beginPath();
    ctx.moveTo(x, 31);
    ctx.lineTo(x - 0.5, 36);
    ctx.stroke();
  }
  // The cuff.
  roundRect(ctx, 24, 46, 16, 7, 3);
  fillStroke(ctx, linear(ctx, 24, 46, 40, 53, ['#ff9a4a', '#c4521c']), 1.1);
}

/** The kick: a sneaker swinging into a bomb, speed lines behind it. */
function paintKickIcon(ctx: Ctx): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [x, y, w] of [
    [10, 30, 8],
    [12, 36, 10],
    [10, 42, 7],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // Sneaker: the upper, then the white sole.
  ctx.beginPath();
  ctx.moveTo(22, 26);
  ctx.lineTo(30, 26);
  ctx.bezierCurveTo(31, 32, 36, 34, 42, 35);
  ctx.bezierCurveTo(45, 36, 45, 41, 42, 42);
  ctx.lineTo(22, 42);
  ctx.closePath();
  ctx.shadowColor = 'rgba(200,140,255,0.8)';
  ctx.shadowBlur = 6;
  fillStroke(
    ctx,
    linear(ctx, 22, 26, 44, 42, ['#c99aff', '#7a3fd0', '#3f1b80']),
    1.2,
  );
  ctx.shadowBlur = 0;
  roundRect(ctx, 20.5, 41, 25, 5, 2.5);
  fillStroke(ctx, linear(ctx, 20, 41, 20, 46, ['#ffffff', '#cfd4e2']), 1);
  // Laces.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (const [x, y] of [
    [31, 30],
    [34, 32],
    [37, 33.5],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 2);
    ctx.lineTo(x + 2, y + 1);
    ctx.stroke();
  }
  miniBomb(ctx, 50, 40, 6.5);
}

/** A glass tile with a coloured edge light — reads as a pickup, not a block. */
function paintPowerUp(ctx: Ctx, kind: PowerUpKind): void {
  // The egg is not a bonus card but a thing about to hatch: it has its own painter.
  if (kind === 'egg') {
    paintEgg(ctx);
    return;
  }
  const p = PANEL[kind];
  ctx.shadowColor = p.glow;
  ctx.shadowBlur = 10;
  roundRect(ctx, 8, 8, S - 16, S - 16, 12);
  ctx.fillStyle = linear(ctx, 8, 8, S - 8, S - 8, [p.from, p.to]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = p.glow;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Gloss.
  roundRect(ctx, 11, 10, S - 22, (S - 22) * 0.45, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();

  if (kind === 'bomb') {
    const cx = 31;
    const cy = 35;
    circle(ctx, cx, cy, 11);
    fillStroke(
      ctx,
      sphere(ctx, cx, cy, 11, '#6f7893', '#262a37', '#07080c'),
      1.2,
    );
    ellipse(ctx, cx - 4.5, cy - 4.5, 3, 1.8, -0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    ctx.strokeStyle = HD.fuse;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + 7.5, cy - 8.5);
    ctx.quadraticCurveTo(cx + 12, cy - 12, cx + 12, cy - 16);
    ctx.stroke();
    const g = ctx.createRadialGradient(
      cx + 12,
      cy - 17,
      0,
      cx + 12,
      cy - 17,
      6,
    );
    g.addColorStop(0, '#fff5d0');
    g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g;
    circle(ctx, cx + 12, cy - 17, 6);
    ctx.fill();
  } else if (kind === 'fire') {
    const flame = (scale: number, fill: string | CanvasGradient) => {
      ctx.beginPath();
      ctx.moveTo(32, 33 - 19 * scale);
      ctx.bezierCurveTo(
        32 + 15 * scale,
        33 - 3 * scale,
        32 + 13 * scale,
        33 + 15 * scale,
        32,
        33 + 16 * scale,
      );
      ctx.bezierCurveTo(
        32 - 13 * scale,
        33 + 15 * scale,
        32 - 15 * scale,
        33 - 1 * scale,
        32,
        33 - 19 * scale,
      );
      ctx.fillStyle = fill;
      ctx.fill();
    };
    ctx.shadowColor = 'rgba(255,140,60,0.9)';
    ctx.shadowBlur = 8;
    flame(1, linear(ctx, 0, 14, 0, 50, ['#ffd166', '#ff7a2a', '#d4341a']));
    ctx.shadowBlur = 0;
    flame(0.55, linear(ctx, 0, 24, 0, 44, ['#fff8e6', '#ffd166']));
  } else if (kind === 'pierce') {
    // A bolt through a crate: the flame does not stop.
    roundRect(ctx, 20, 24, 24, 18, 3);
    ctx.fillStyle = linear(ctx, 20, 24, 44, 42, [HD.crate, HD.crateDark]);
    ctx.fill();
    ctx.strokeStyle = HD.crateEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowColor = 'rgba(255,120,80,0.9)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffd3a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 33);
    ctx.lineTo(50, 33);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(44, 26);
    ctx.lineTo(53, 33);
    ctx.lineTo(44, 40);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (kind === 'remote') {
    // A remote with an antenna and the big red button.
    roundRect(ctx, 23, 22, 18, 28, 4);
    fillStroke(ctx, linear(ctx, 23, 22, 41, 50, ['#4a5366', '#1d222d']), 1.2);
    ctx.strokeStyle = HD.metal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 22);
    ctx.lineTo(42, 11);
    ctx.stroke();
    circle(ctx, 42.5, 10, 2.2);
    ctx.fillStyle = HD.accent;
    ctx.shadowColor = HD.accent;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    circle(ctx, 32, 33, 5);
    fillStroke(ctx, sphere(ctx, 32, 33, 5, '#ff9a8a', '#e8403a', '#7a1515'), 1);
    for (const y of [43, 46.5]) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(27, y, 10, 1.5);
    }
  } else if (kind === 'glove') {
    paintGloveIcon(ctx);
  } else if (kind === 'kick') {
    paintKickIcon(ctx);
  } else if (kind === 'vest') {
    // A shield: a few seconds where nothing burns you.
    ctx.beginPath();
    ctx.moveTo(32, 13);
    ctx.lineTo(46, 19);
    ctx.bezierCurveTo(46, 36, 40, 46, 32, 51);
    ctx.bezierCurveTo(24, 46, 18, 36, 18, 19);
    ctx.closePath();
    ctx.shadowColor = 'rgba(120,255,230,0.8)';
    ctx.shadowBlur = 8;
    fillStroke(
      ctx,
      linear(ctx, 18, 13, 46, 51, ['#bffff2', '#4fd0b8', '#146e62']),
      1.4,
    );
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 19);
    ctx.lineTo(32, 45);
    ctx.stroke();
  } else {
    // Lightning bolt — speed, in the modern idiom.
    ctx.beginPath();
    ctx.moveTo(36, 14);
    ctx.lineTo(22, 36);
    ctx.lineTo(31, 36);
    ctx.lineTo(27, 50);
    ctx.lineTo(42, 28);
    ctx.lineTo(33, 28);
    ctx.closePath();
    ctx.shadowColor = 'rgba(255,220,90,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = linear(ctx, 0, 14, 0, 50, ['#fff6d0', '#ffd24a']);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120, 85, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ── players ────────────────────────────────────────────────────────────────

/**
 * An original helmeted bomber: round helmet, dark glossy visor with glowing
 * eyes, coloured suit, gloves and boots. Facing left is facing right, mirrored.
 */
/** One frame of a player, 64 px, facing `facing`. Exported so the roster can draw it too. */
export function paintHdPlayer(
  ctx: Ctx,
  c: HdPlayerColors,
  facing: Direction,
  frame: number,
): void {
  if (facing === 'left') {
    ctx.translate(S, 0);
    ctx.scale(-1, 1);
  }
  const side = facing === 'left' || facing === 'right';
  const bob = frame === 0 ? 0 : -1.5;
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  // Boots.
  const boot = (x: number, y: number) => {
    ellipse(ctx, x, y, 7.5, 5);
    fillStroke(ctx, linear(ctx, 0, y - 5, 0, y + 5, [HD.boot, HD.bootDark]));
  };
  if (side) {
    boot(30 - step * 6, 57);
    boot(36 + step * 6, 57);
  } else {
    boot(24, 57 - (step === 1 ? 3 : 0));
    boot(40, 57 - (step === -1 ? 3 : 0));
  }

  ctx.translate(0, bob);

  // Body.
  ellipse(ctx, 32, 45, side ? 11 : 13, 10.5);
  fillStroke(ctx, sphere(ctx, 32, 45, 12, c.suit, c.suit, c.suitDark));
  ctx.fillStyle = HD.belt;
  ctx.fillRect(side ? 22 : 20, 46, side ? 20 : 24, 3.5);
  roundRect(ctx, side ? 34 : 29, 45, 6, 5.5, 1.5);
  fillStroke(ctx, linear(ctx, 0, 45, 0, 50, ['#fff2a8', HD.beltDark]), 1);

  // Gloves.
  const glove = (x: number, y: number) => {
    circle(ctx, x, y, 5.5);
    fillStroke(
      ctx,
      sphere(ctx, x, y, 5.5, '#ffd1e0', HD.glove, HD.gloveDark),
      1.2,
    );
  };
  if (side) {
    glove(38 + step * 4, 46);
  } else {
    glove(18, 45 + step * 1.5);
    glove(46, 45 - step * 1.5);
  }

  // Helmet.
  circle(ctx, 32, 23, 18);
  fillStroke(
    ctx,
    sphere(ctx, 32, 23, 18, c.helmetLight, c.helmet, c.helmetDark),
    1.5,
  );
  // Cool rim light on the shadow side.
  ctx.strokeStyle = 'rgba(130, 200, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 23, 16, -0.3, 1.4);
  ctx.stroke();

  if (facing === 'up') {
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 23, 12, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    for (const x of [14.5, 49.5]) {
      circle(ctx, x, 25, 3.5);
      fillStroke(ctx, c.helmetDark, 1);
    }
  } else if (side) {
    circle(ctx, 22, 25, 4);
    fillStroke(ctx, c.helmetDark, 1);
    roundRect(ctx, 31, 17, 18, 14, 6);
    fillStroke(
      ctx,
      linear(ctx, 31, 17, 49, 31, [HD.visorLight, HD.visor]),
      1.2,
    );
    paintEye(ctx, 42, 24);
    visorGloss(ctx, 33, 18, 12, 4);
  } else {
    for (const x of [14.5, 49.5]) {
      circle(ctx, x, 25, 3.5);
      fillStroke(ctx, c.helmetDark, 1);
    }
    roundRect(ctx, 18.5, 17, 27, 15, 7);
    fillStroke(
      ctx,
      linear(ctx, 18, 17, 46, 32, [HD.visorLight, HD.visor]),
      1.2,
    );
    paintEye(ctx, 27, 24.5);
    paintEye(ctx, 37, 24.5);
    visorGloss(ctx, 20.5, 18, 20, 4.5);
  }

  // Specular highlight on the helmet.
  ellipse(ctx, 24, 12, 6, 3.2, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

function visorGloss(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
}

function paintEye(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.shadowColor = HD.eye;
  ctx.shadowBlur = 6;
  ellipse(ctx, x, y, 2.4, 4);
  ctx.fillStyle = HD.eye;
  ctx.fill();
  ctx.restore();
}
