import { FlameShape, PowerUpKind } from '@libs/game-core';
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
import {
  ARENA_COLORS as C,
  EGG_ICON,
  EGG_ICON_PALETTE,
  GLOVE_ICON,
  GLOVE_ICON_PALETTE,
  KICK_ICON,
  KICK_ICON_PALETTE,
  PIERCE_ICON,
  PIERCE_ICON_PALETTE,
  REMOTE_ICON,
  REMOTE_ICON_PALETTE,
  VEST_ICON,
  VEST_ICON_PALETTE,
  FLAME_BANDS,
  FLAME_ICON,
  FLAME_ICON_PALETTE,
  Palette,
  PixelGrid,
  PLAYER_PALETTES,
  playerGrid,
  POWER_UP_PANELS,
  WALLPASS_ICON,
  WALLPASS_ICON_PALETTE,
  FULLFIRE_ICON,
  FULLFIRE_ICON_PALETTE,
  POWERBOMB_ICON,
  POWERBOMB_ICON_PALETTE,
  SKULL_ICON,
  SKULL_ICON_PALETTE,
  CLOCK_ICON,
  CLOCK_ICON_PALETTE,
  ONEUP_ICON,
  ONEUP_ICON_PALETTE,
  SKATE_ICON,
  SKATE_ICON_PALETTE,
  TILE,
} from './classic-sprites';

type Ctx = CanvasRenderingContext2D;

/** Paints every texture of the classic skin onto its own 16 × 16 canvas. */
export function paintClassicTextures(
  doc: Document,
): Map<string, HTMLCanvasElement> {
  const textures = new Map<string, HTMLCanvasElement>();
  const paint = (key: string, draw: (ctx: Ctx) => void) => {
    const canvas = doc.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    draw(ctx);
    textures.set(key, canvas);
  };

  paint(TEXTURE.floor, (ctx) => paintFloor(ctx, false));
  paint(TEXTURE.floorShadow, (ctx) => paintFloor(ctx, true));
  paint(TEXTURE.wall, paintWall);
  paint(TEXTURE.block, paintBlock);
  paint(TEXTURE.shadow, (ctx) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(8, 8, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  paint(TEXTURE.debris, (ctx) => {
    px(ctx, 6, 6, 4, 3, C.brick);
    px(ctx, 6, 6, 4, 1, C.brickLight);
  });
  paint(TEXTURE.spark, (ctx) => {
    px(ctx, 7, 6, 2, 4, C.sparkHot);
    px(ctx, 6, 7, 4, 2, C.sparkHot);
  });
  for (let f = 0; f < BOMB_FRAMES; f++)
    paint(TEXTURE.bomb(f), (ctx) => paintBomb(ctx, f));
  for (const shape of FLAME_SHAPES) {
    for (let f = 0; f < FLAME_FRAMES; f++) {
      paint(TEXTURE.flame(shape, f), (ctx) => paintFlame(ctx, shape, f));
    }
  }
  for (const kind of POWER_UP_KINDS)
    paint(TEXTURE.powerUp(kind), (ctx) => paintPowerUp(ctx, kind));
  for (let slot = 0; slot < PLAYER_SLOTS; slot++) {
    const palette = PLAYER_PALETTES[slot % PLAYER_PALETTES.length] as Palette;
    for (const facing of FACINGS) {
      for (let f = 0; f < PLAYER_FRAMES; f++) {
        const pose = facing === 'left' || facing === 'right' ? 'side' : facing;
        paint(TEXTURE.player(slot, facing, f), (ctx) =>
          paintGrid(
            ctx,
            playerGrid(pose, Math.min(f, 2)),
            palette,
            0,
            0,
            facing === 'left',
          ),
        );
        // No pixel-art mounts yet: a mounted player looks like a player.
        for (const mountId of MOUNT_IDS) {
          paint(TEXTURE.playerMounted(slot, mountId, facing, f), (ctx) =>
            paintGrid(
              ctx,
              playerGrid(pose, Math.min(f, 2)),
              palette,
              0,
              0,
              facing === 'left',
            ),
          );
        }
      }
    }
  }
  return textures;
}

function px(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function paintGrid(
  ctx: Ctx,
  grid: PixelGrid,
  palette: Palette,
  ox: number,
  oy: number,
  mirror = false,
): void {
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x] as string];
      if (!color) continue;
      px(ctx, ox + (mirror ? row.length - 1 - x : x), oy + y, 1, 1, color);
    }
  });
}

function paintFloor(ctx: Ctx, shadow: boolean): void {
  px(ctx, 0, 0, TILE, TILE, C.grass);
  // A few darker blades so a field of floor does not look flat.
  for (const [x, y] of [
    [2, 3],
    [3, 2],
    [10, 5],
    [11, 4],
    [6, 11],
    [7, 10],
    [13, 12],
    [1, 13],
  ]) {
    px(ctx, x as number, y as number, 1, 1, C.grassDetail);
  }
  if (shadow) px(ctx, 0, 0, TILE, 3, C.grassShadow);
}

function paintWall(ctx: Ctx): void {
  px(ctx, 0, 0, TILE, TILE, C.wall);
  px(ctx, 0, 0, TILE, 2, C.wallLight);
  px(ctx, 0, 0, 2, TILE, C.wallLight);
  px(ctx, 0, TILE - 2, TILE, 2, C.wallDark);
  px(ctx, TILE - 2, 0, 2, TILE, C.wallDark);
  px(ctx, 4, 4, 8, 8, C.wallInner);
  px(ctx, 4, 11, 8, 1, C.wallDark);
  px(ctx, 11, 4, 1, 8, C.wallDark);
}

function paintBlock(ctx: Ctx): void {
  px(ctx, 0, 0, TILE, TILE, C.brick);
  for (let y = 0; y < TILE; y++) {
    const course = Math.floor(y / 4);
    for (let x = 0; x < TILE; x++) {
      const joint = (x + (course % 2 === 1 ? 4 : 0)) % 8 === 7;
      if (y % 4 === 3 || joint) px(ctx, x, y, 1, 1, C.mortar);
      else if (y % 4 === 0) px(ctx, x, y, 1, 1, C.brickLight);
    }
  }
}

function paintBomb(ctx: Ctx, frame: number): void {
  const cx = 8;
  const cy = 9.5;
  const r = 5.5;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) {
        const shine = Math.hypot(x + 0.5 - 6, y + 0.5 - 7.5) < 2;
        px(ctx, x, y, 1, 1, shine ? C.bombShine : C.bombBody);
      } else if (d <= r + 1) {
        px(ctx, x, y, 1, 1, C.bombOutline);
      }
    }
  }
  px(ctx, 6, 7, 1, 1, '#ffffff');
  px(ctx, 9, 2, 1, 2, C.fuse);
  px(ctx, 10, 1, 1, 1, C.fuse);
  if (frame === 0) {
    px(ctx, 11, 0, 1, 1, C.spark);
  } else {
    px(ctx, 10, 0, 3, 1, C.spark);
    px(ctx, 11, 0, 1, 2, C.spark);
    px(ctx, 11, 0, 1, 1, C.sparkHot);
  }
}

function insideFlame(
  shape: FlameShape,
  x: number,
  y: number,
  hw: number,
): boolean {
  const dx = x + 0.5 - 8;
  const dy = y + 0.5 - 8;
  const band = (along: number, across: number, tip: 1 | -1 | 0) => {
    if (tip === 0) return Math.abs(across) <= hw;
    // A band coming from the centre side, ending in a rounded tip.
    const toward = along * tip;
    return (
      (toward <= 0 && Math.abs(across) <= hw) ||
      Math.hypot(toward - 1, across) <= hw
    );
  };
  switch (shape) {
    case 'center':
      return (
        Math.abs(dx) <= hw || Math.abs(dy) <= hw || Math.hypot(dx, dy) <= hw + 1
      );
    case 'horizontal':
      return band(dx, dy, 0);
    case 'vertical':
      return band(dy, dx, 0);
    case 'end-right':
      return band(dx, dy, 1);
    case 'end-left':
      return band(dx, dy, -1);
    case 'end-down':
      return band(dy, dx, 1);
    case 'end-up':
      return band(dy, dx, -1);
  }
}

function paintFlame(ctx: Ctx, shape: FlameShape, frame: number): void {
  const [outer, mid, inner] = FLAME_BANDS[frame] as readonly [
    number,
    number,
    number,
  ];
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (insideFlame(shape, x, y, inner)) px(ctx, x, y, 1, 1, C.flameInner);
      else if (insideFlame(shape, x, y, mid)) px(ctx, x, y, 1, 1, C.flameMid);
      else if (insideFlame(shape, x, y, outer))
        px(ctx, x, y, 1, 1, C.flameOuter);
    }
  }
}

function paintPowerUp(ctx: Ctx, kind: PowerUpKind): void {
  const panel = POWER_UP_PANELS[kind];
  px(ctx, 0, 0, TILE, TILE, panel.fill);
  px(ctx, 0, 0, TILE, 1, panel.light);
  px(ctx, 0, 0, 1, TILE, panel.light);
  px(ctx, 0, TILE - 1, TILE, 1, panel.dark);
  px(ctx, TILE - 1, 0, 1, TILE, panel.dark);

  if (kind === 'fire') {
    paintGrid(ctx, FLAME_ICON, FLAME_ICON_PALETTE, 2, 2);
  } else if (kind === 'speed') {
    paintGrid(ctx, SKATE_ICON, SKATE_ICON_PALETTE, 2, 2);
  } else if (kind === 'egg') {
    paintGrid(ctx, EGG_ICON, EGG_ICON_PALETTE, 2, 2);
  } else if (kind === 'pierce') {
    paintGrid(ctx, PIERCE_ICON, PIERCE_ICON_PALETTE, 2, 2);
  } else if (kind === 'remote') {
    paintGrid(ctx, REMOTE_ICON, REMOTE_ICON_PALETTE, 2, 2);
  } else if (kind === 'vest') {
    paintGrid(ctx, VEST_ICON, VEST_ICON_PALETTE, 2, 2);
  } else if (kind === 'glove') {
    paintGrid(ctx, GLOVE_ICON, GLOVE_ICON_PALETTE, 2, 2);
  } else if (kind === 'kick') {
    paintGrid(ctx, KICK_ICON, KICK_ICON_PALETTE, 2, 2);
  } else if (kind === 'wallpass') {
    paintGrid(ctx, WALLPASS_ICON, WALLPASS_ICON_PALETTE, 2, 2);
  } else if (kind === 'fullfire') {
    paintGrid(ctx, FULLFIRE_ICON, FULLFIRE_ICON_PALETTE, 2, 2);
  } else if (kind === 'powerbomb') {
    paintGrid(ctx, POWERBOMB_ICON, POWERBOMB_ICON_PALETTE, 2, 2);
  } else if (kind === 'skull') {
    paintGrid(ctx, SKULL_ICON, SKULL_ICON_PALETTE, 2, 2);
  } else if (kind === 'clock') {
    paintGrid(ctx, CLOCK_ICON, CLOCK_ICON_PALETTE, 2, 2);
  } else if (kind === 'oneup') {
    paintGrid(ctx, ONEUP_ICON, ONEUP_ICON_PALETTE, 2, 2);
  } else {
    // A small bomb with a lit fuse.
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const d = Math.hypot(x + 0.5 - 7.5, y + 0.5 - 9);
        if (d <= 4) px(ctx, x, y, 1, 1, C.bombBody);
        else if (d <= 5) px(ctx, x, y, 1, 1, C.bombOutline);
      }
    }
    px(ctx, 6, 7, 1, 1, '#ffffff');
    px(ctx, 9, 3, 1, 2, C.fuse);
    px(ctx, 10, 2, 1, 1, C.spark);
  }
}
