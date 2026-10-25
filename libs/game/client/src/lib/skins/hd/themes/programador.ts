import {
  createRng,
  PIZZA_PANIC_EVERY_TICKS,
  PIZZA_PANIC_TICKS,
} from '@libs/game-core';
import { HD_TILE as S } from '../hd-palette';
import { TEXTURE } from '../../texture-keys';
import {
  ArenaTheme,
  circle,
  Ctx,
  floorShadow,
  glow,
  linear,
  OUTLINE,
  roundRect,
  TAU,
  tilePainter,
} from './theme';
import { ALARM_SUFFIX } from './moments';

/**
 * Programador — the tech crew's open-space office. Carpet squares on the
 * floor, desks with a monitor full of code for pillars (a mug, an energy
 * drink or a rubber duck tells whose), stacks of pizza boxes for crates,
 * cubicle partitions round the edge, whiteboards along the top and the CI
 * screen in the middle of them. Its moment is the broken build: every
 * monitor and the CI screen go red for two seconds — and the Pizzaiolo,
 * panicking, throws three pizzas at once.
 *
 * Beside the whiteboards, the kitchen window, where the Pizzaiolo throws
 * pizzas from (the rules are in `@libs/game-core`'s `pizza.ts`): painted two
 * cells wide, one look per pose, under {@link PIZZAIOLO_TEXTURE}.
 */
const ACCENT = '#4f8cff';
const ALARM_RED = '#ff4a5a';
const OK = '#3ddc84';
const CARPET = '#bfc7d4';
const CARPET_D = '#b2bbca';
const WALL = '#cfd3da';
const WOOD = '#a8713f';
const WOOD_D = '#6e4624';
const WOOD_L = '#c48a52';
const FABRIC = '#3c4a63';
const FABRIC_D = '#2c374b';
const RAIL = '#d5dae2';
const BOARD = '#f7f8f6';
const BOARD_D = '#b9bfc9';
const SCREEN = '#13203a';
const CODE = ['#7ee787', '#79c0ff', '#ffa657', '#d2a8ff'];
const NOTES = ['#ffd84d', '#ff9bb5', '#8ee0a1', '#7cc7ff'];
const METAL = '#8fb3d9';
const METAL_D = '#5b80aa';
const METAL_L = '#c3d8ee';
const JOINT = '#d9443a';

/** The Pizzaiolo's looks, two cells wide and one tall: `pizzaiolo:<pose>`. */
export type PizzaioloPose = 'idle' | 'juggle' | 'throw' | 'panic';
export const PIZZAIOLO_TEXTURE = (pose: PizzaioloPose) => `pizzaiolo:${pose}`;
/** A pizza in the air, and the target it shows on the floor while it flies. */
export const PIZZA_TEXTURE = 'pizza';
export const PIZZA_TARGET_TEXTURE = 'pizza-target';

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function outline(ctx: Ctx, width = 1.5): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.stroke();
}

function stickyNote(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  angle: number,
): void {
  const h = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-h + 0.8, -h + 1.2, size, size);
  ctx.fillStyle = color;
  ctx.fillRect(-h, -h, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-h, -h, size, size * 0.2);
  ctx.strokeStyle = 'rgba(40,40,60,0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-h + 1.5, 0);
  ctx.lineTo(h - 1.5, 0);
  ctx.moveTo(-h + 1.5, h * 0.5);
  ctx.lineTo(h * 0.3, h * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** The floor: a calm carpet square; now and then a coffee ring (1) or a fallen note (2). */
function carpet(ctx: Ctx, shadow: boolean, extra = 0): void {
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [CARPET, CARPET_D]);
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 2.5; k < S; k += 3) {
    ctx.moveTo(1, k);
    ctx.lineTo(S - 1, k);
  }
  ctx.stroke();
  const rng = createRng(9);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(rng() * S, rng() * S, 1.3, 1.3);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  if (extra === 1) {
    ctx.beginPath();
    ctx.ellipse(40, 24, 6.5, 5.5, 0.2, 0, TAU);
    ctx.strokeStyle = 'rgba(84,48,22,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    circle(ctx, 47.5, 31, 1.6);
    ctx.fillStyle = 'rgba(84,48,22,0.38)';
    ctx.fill();
  } else if (extra === 2) stickyNote(ctx, 20, 42, 11, NOTES[0] ?? '', -0.35);
  if (shadow) floorShadow(ctx);
}

/**
 * A pillar: a desk seen from above, a big monitor of code, a keyboard and
 * one thing that says whose it is — a mug (0), an energy drink (1), a rubber
 * duck (2). Few, big shapes: it is read at ~45 px. Red with a "!" when the
 * build breaks.
 */
function desk(ctx: Ctx, variant: number, alarm: boolean): void {
  const top = S - 13;
  const light = alarm ? ALARM_RED : '#8fc8ff';
  roundRect(ctx, 3, 5, S - 6, S - 8, 5);
  ctx.fillStyle = WOOD_D;
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, top, 0, S, [
    'rgba(0,0,0,0.05)',
    'rgba(0,0,0,0.4)',
  ]);
  ctx.fill();
  roundRect(ctx, 3, 5, S - 6, top - 5, 5);
  ctx.fillStyle = linear(ctx, 3, 5, S, top, [WOOD_L, WOOD]);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 3, 5, S - 6, top - 5, 5);
  ctx.clip();
  const pool = ctx.createRadialGradient(32, 34, 2, 32, 34, 28);
  pool.addColorStop(0, rgba(light, 0.2));
  pool.addColorStop(1, rgba(light, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(4, top, S - 8, 1.4);

  // The monitor.
  roundRect(ctx, 27, 33, 10, 5, 1);
  ctx.fillStyle = '#262a35';
  ctx.fill();
  roundRect(ctx, 6, 6, 52, 29, 4);
  ctx.fillStyle = '#2b303c';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(9, 7, 46, 1.2);
  roundRect(ctx, 9.5, 9.5, 45, 22, 2);
  ctx.fillStyle = alarm
    ? linear(ctx, 0, 9, 0, 32, ['#e0303f', '#a3141f'])
    : SCREEN;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 9.5, 9.5, 45, 22, 2);
  ctx.clip();
  if (alarm) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 29.5, 12.5, 5, 11, 2);
    ctx.fill();
    circle(ctx, 32, 27.3, 2.6);
    ctx.fill();
  } else {
    const rng = createRng(17 + variant * 13);
    let indent = 0;
    for (let i = 0; i < 4; i++) {
      const y = 12.5 + i * 4.6;
      indent =
        i === 0
          ? 0
          : Math.max(0, Math.min(2, indent + Math.floor(rng() * 3) - 1));
      let x = 13 + indent * 5;
      const n = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < n && x < 49; j++) {
        let w = 7 + Math.floor(rng() * 12);
        if (x + w > 51) w = 51 - x;
        ctx.fillStyle = CODE[(i + j + variant) % CODE.length] ?? '#ffffff';
        roundRect(ctx, x, y, w, 2.8, 1.4);
        ctx.fill();
        x += w + 3;
      }
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(9, 22);
  ctx.lineTo(24, 9);
  ctx.lineTo(32, 9);
  ctx.lineTo(17, 32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, 9.5, 9.5, 45, 22, 2);
  ctx.shadowColor = alarm ? ALARM_RED : '#79c0ff';
  ctx.shadowBlur = 7;
  ctx.strokeStyle = rgba(alarm ? ALARM_RED : '#79c0ff', 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  roundRect(ctx, 6, 6, 52, 29, 4);
  outline(ctx, 1.3);

  // The keyboard.
  roundRect(ctx, 10, 40, 32, 9, 2);
  ctx.fillStyle = '#e4e7ed';
  ctx.fill();
  ctx.fillStyle = 'rgba(30,34,45,0.28)';
  ctx.fillRect(11.5, 43, 29, 1);
  ctx.fillRect(11.5, 45.6, 29, 1);
  roundRect(ctx, 19, 47, 14, 1.4, 0.7);
  ctx.fill();
  roundRect(ctx, 10, 40, 32, 9, 2);
  outline(ctx, 1.1);

  if (variant === 0) {
    circle(ctx, 51, 44, 6);
    ctx.fillStyle = '#f2f3f7';
    ctx.fill();
    outline(ctx, 1.1);
    circle(ctx, 51, 44, 4.2);
    ctx.fillStyle = '#5a3620';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(57.5, 44.5, 2.4, -1.3, 1.3);
    ctx.strokeStyle = '#f2f3f7';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (variant === 1) {
    roundRect(ctx, 46, 36, 10, 14, 2.5);
    ctx.fillStyle = '#1d3a8a';
    ctx.fill();
    outline(ctx, 1.1);
    ctx.beginPath();
    ctx.ellipse(51, 36.6, 5, 1.8, 0, 0, TAU);
    ctx.fillStyle = '#d4d8e0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(52.5, 39);
    ctx.lineTo(48.4, 44);
    ctx.lineTo(51, 44);
    ctx.lineTo(49.6, 48.4);
    ctx.lineTo(53.8, 42.6);
    ctx.lineTo(51.2, 42.6);
    ctx.closePath();
    ctx.fillStyle = '#ffd84d';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(50, 45.5, 6.2, 4.6, 0, 0, TAU);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    outline(ctx, 1.1);
    circle(ctx, 53.5, 39.8, 3.6);
    ctx.fill();
    outline(ctx, 1.1);
    ctx.beginPath();
    ctx.moveTo(56.6, 39.4);
    ctx.lineTo(60.2, 40.6);
    ctx.lineTo(56.6, 41.8);
    ctx.closePath();
    ctx.fillStyle = '#ff8a1f';
    ctx.fill();
    circle(ctx, 54.4, 39, 0.9);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
  }
  roundRect(ctx, 3, 5, S - 6, S - 8, 5);
  outline(ctx);
}

function lid(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function boxSide(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, 1.2);
  ctx.fillStyle = '#b07f45';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,225,170,0.35)';
  ctx.fillRect(x + 1, y + h * 0.45, w - 2, 0.8);
  ctx.fillStyle = 'rgba(50,28,8,0.45)';
  ctx.fillRect(x + 0.5, y + h - 0.9, w - 1, 0.9);
  roundRect(ctx, x, y, w, h, 1.2);
  outline(ctx, 1.1);
}

/** A crate: three delivery pizza boxes, stacked a little crooked. */
function pizzaBoxes(ctx: Ctx): void {
  boxSide(ctx, 6, 51, 52, 5);
  boxSide(ctx, 8.5, 46.5, 51, 5);
  boxSide(ctx, 5, 42, 52, 5);
  lid(ctx, 5, 9, 52, 34, 4);
  ctx.fillStyle = linear(ctx, 5, 9, 57, 43, ['#f0d3a2', '#d8ad6e']);
  ctx.fill();
  ctx.save();
  lid(ctx, 5, 9, 52, 34, 4);
  ctx.clip();
  ctx.fillStyle = 'rgba(110,70,30,0.22)';
  ctx.fillRect(5, 38.5, 52, 0.9);
  ctx.beginPath();
  ctx.ellipse(15, 34, 5, 3.4, -0.3, 0, TAU);
  ctx.fillStyle = 'rgba(150,90,25,0.24)';
  ctx.fill();
  ctx.restore();
  // The print: a slice and the word, in red.
  ctx.beginPath();
  ctx.moveTo(31, 26);
  ctx.lineTo(25.5, 14.5);
  ctx.quadraticCurveTo(31, 12, 36.5, 14.5);
  ctx.closePath();
  ctx.fillStyle = '#d23a26';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(25.5, 14.5);
  ctx.quadraticCurveTo(31, 12, 36.5, 14.5);
  ctx.strokeStyle = '#d23a26';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = '#f0d3a2';
  for (const [x, y, r] of [
    [30, 17, 1.2],
    [32.6, 19.8, 1],
    [30.6, 22.2, 0.8],
  ] as const) {
    circle(ctx, x, y, r);
    ctx.fill();
  }
  ctx.fillStyle = '#d23a26';
  ctx.font = 'bold 8.5px "Arial Black", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PIZZA', 31, 35);
  // The order slip, taped on.
  ctx.save();
  ctx.translate(47, 16);
  ctx.rotate(0.14);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(-4.2, -5, 9, 11);
  ctx.fillStyle = '#fbfaf5';
  ctx.fillRect(-4.5, -5.5, 9, 11);
  ctx.fillStyle = 'rgba(40,40,50,0.55)';
  ctx.fillRect(-3, -2.5, 6, 0.8);
  ctx.fillRect(-3, -0.5, 4.5, 0.8);
  ctx.fillRect(-3, 1.5, 5.5, 0.8);
  ctx.fillStyle = 'rgba(230,236,245,0.7)';
  ctx.fillRect(-2.5, -7, 5, 2.6);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(9, 10.3, 44, 1.1);
  lid(ctx, 5, 9, 52, 34, 4);
  outline(ctx);
}

/** The border: a cubicle partition, fabric under an aluminium rail; a note (1) or a warning (2) pinned on. */
function partition(ctx: Ctx, variant = 0): void {
  ctx.fillStyle = '#0d1016';
  ctx.fillRect(0, 0, S, 22);
  ctx.fillStyle = linear(ctx, 0, 0, 0, 22, [
    'rgba(0,0,0,0)',
    rgba(FABRIC, 0.3),
  ]);
  ctx.fillRect(0, 0, S, 22);
  ctx.fillStyle = linear(ctx, 0, 24, 0, S, [FABRIC, FABRIC_D]);
  ctx.fillRect(0, 24, S, S - 24);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 27; y < S; y += 2)
    for (let x = y % 4 === 1 ? 0 : 1; x < S; x += 2) ctx.fillRect(x, y, 1, 1);
  roundRect(ctx, 0, 20, S, 6, 2);
  ctx.fillStyle = linear(ctx, 0, 20, 0, 26, ['#ffffff', RAIL, '#7d8596']);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 26, S, 1.2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(S - 1.5, 26, 1.5, S - 26);
  if (variant === 1) stickyNote(ctx, 22, 42, 12, NOTES[1] ?? '', 0.12);
  else if (variant === 2) {
    ctx.save();
    ctx.translate(40, 43);
    ctx.rotate(-0.06);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-9, -7, 19, 15);
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(-9.5, -7.5, 19, 15);
    ctx.fillStyle = '#d93a3a';
    ctx.fillRect(-7, -5, 14, 2.4);
    ctx.fillStyle = 'rgba(30,30,40,0.6)';
    ctx.fillRect(-7, -0.8, 14, 1.2);
    ctx.fillRect(-7, 2, 9, 1.2);
    circle(ctx, 0, -7, 1.2);
    ctx.fillStyle = '#d93a3a';
    ctx.fill();
    ctx.restore();
  }
}

function officeWall(ctx: Ctx): void {
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = linear(ctx, 0, 0, 0, S, [
    'rgba(0,0,0,0)',
    'rgba(0,0,0,0.18)',
  ]);
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#2a2f3b';
  ctx.fillRect(0, S - 7, S, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, S - 7, S, 1);
}

/** The top row: whiteboards — a kanban (0), an architecture nobody follows (1), a burndown that goes up at the end (2). */
function whiteboard(ctx: Ctx, variant = 0): void {
  officeWall(ctx);
  roundRect(ctx, 3, 5, S - 6, 40, 2);
  ctx.fillStyle = BOARD;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 3, 5, S - 6, 40, 2);
  ctx.clip();
  const rng = createRng(23 + variant * 7);
  if (variant === 0) {
    ctx.strokeStyle = 'rgba(40,50,70,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(22.5, 7);
    ctx.lineTo(22.5, 43);
    ctx.moveTo(42.5, 7);
    ctx.lineTo(42.5, 43);
    ctx.moveTo(5, 12.5);
    ctx.lineTo(59, 12.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(40,50,70,0.6)';
    ctx.fillRect(8, 8.5, 9, 1.5);
    ctx.fillRect(27, 8.5, 11, 1.5);
    ctx.fillRect(47, 8.5, 8, 1.5);
    [
      [11, 18],
      [16.5, 26],
      [10, 34],
      [29, 19],
      [35, 29],
      [48.5, 18],
      [54, 27],
      [48, 36],
    ].forEach(([x, y], i) =>
      stickyNote(
        ctx,
        x ?? 0,
        y ?? 0,
        7.5,
        NOTES[i % NOTES.length] ?? '',
        rng() * 0.3 - 0.15,
      ),
    );
  } else if (variant === 1) {
    ctx.strokeStyle = '#2f6fdb';
    ctx.lineWidth = 1.3;
    for (const [x, y, w] of [
      [8, 10, 15],
      [41, 10, 15],
      [24, 29, 16],
    ] as const) {
      roundRect(ctx, x, y, w, 9, 1.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(23, 14.5);
    ctx.lineTo(41, 14.5);
    ctx.moveTo(38, 12.6);
    ctx.lineTo(41, 14.5);
    ctx.lineTo(38, 16.4);
    ctx.moveTo(15.5, 19);
    ctx.lineTo(27, 29);
    ctx.moveTo(48.5, 19);
    ctx.lineTo(37, 29);
    ctx.stroke();
    ctx.fillStyle = 'rgba(47,111,219,0.6)';
    ctx.fillRect(11, 14, 9, 1.2);
    ctx.fillRect(44, 14, 9, 1.2);
    ctx.fillRect(27.5, 33, 9, 1.2);
    ctx.beginPath();
    ctx.ellipse(32, 33.5, 12.5, 7.5, -0.05, 0, TAU);
    ctx.strokeStyle = '#e5484d';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#e5484d';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('?', 50, 41);
  } else {
    ctx.strokeStyle = '#2a2f3b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, 9);
    ctx.lineTo(9, 40);
    ctx.lineTo(56, 40);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(42,47,59,0.45)';
    ctx.beginPath();
    ctx.moveTo(9, 11);
    ctx.lineTo(56, 39);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#2f6fdb';
    ctx.beginPath();
    ctx.moveTo(9, 11);
    ctx.lineTo(17, 14);
    ctx.lineTo(24, 15);
    ctx.lineTo(31, 21);
    ctx.lineTo(37, 22);
    ctx.stroke();
    ctx.strokeStyle = '#e5484d';
    ctx.beginPath();
    ctx.moveTo(37, 22);
    ctx.lineTo(43, 17);
    ctx.lineTo(50, 13);
    ctx.lineTo(56, 9);
    ctx.stroke();
  }
  ctx.restore();
  roundRect(ctx, 3, 5, S - 6, 40, 2);
  ctx.strokeStyle = BOARD_D;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(8, 6);
  ctx.lineTo(20, 6);
  ctx.lineTo(8, 20);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, 8, 45, 48, 3, 1.2);
  ctx.fillStyle = '#8b93a3';
  ctx.fill();
  for (const [color, x] of [
    ['#2f6fdb', 14],
    ['#e5484d', 22],
    ['#1f2328', 30],
  ] as const) {
    roundRect(ctx, x, 43.6, 6, 2, 1);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** The feature: the CI screen — green while the build passes; red, siren on, when it breaks. */
function ciScreen(ctx: Ctx, alarm: boolean): void {
  officeWall(ctx);
  const c = alarm ? ALARM_RED : OK;
  roundRect(ctx, 4, 4, S - 8, 38, 3);
  ctx.fillStyle = '#11141c';
  ctx.fill();
  roundRect(ctx, 6.5, 6.5, S - 13, 33, 1.5);
  ctx.fillStyle = alarm
    ? linear(ctx, 0, 6, 0, 40, ['#4a0c16', '#22060c'])
    : linear(ctx, 0, 6, 0, 40, ['#0e2418', '#07140d']);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 6.5, 6.5, S - 13, 33, 1.5);
  ctx.clip();
  ctx.font = 'bold 5.5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(alarm ? 'deploy/sexta' : 'main', 9.5, 13.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, 21);
  ctx.lineTo(47, 21);
  ctx.stroke();
  [14, 25, 36, 47].forEach((x, i) => {
    const color = !alarm ? OK : i < 2 ? OK : i === 2 ? ALARM_RED : '#4a4f5c';
    circle(ctx, x, 21, 2.8);
    if (alarm && i === 2) glow(ctx, color, 8);
    else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  });
  ctx.font = 'bold 7.5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = 5;
  ctx.fillStyle = c;
  ctx.fillText(alarm ? 'FALHOU' : 'PASSOU', 32, 35);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let k = 7; k < 40; k += 2) ctx.fillRect(6, k, S - 12, 0.8);
  ctx.restore();
  roundRect(ctx, 6.5, 6.5, S - 13, 33, 1.5);
  ctx.strokeStyle = rgba(c, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  // The siren on its corner.
  ctx.fillStyle = '#2a2e3a';
  ctx.fillRect(49.5, 4.2, 9, 1.8);
  ctx.beginPath();
  ctx.arc(54, 4.4, 3.6, Math.PI, 0);
  ctx.closePath();
  if (alarm) glow(ctx, ALARM_RED, 12);
  else {
    ctx.fillStyle = '#6a2f36';
    ctx.fill();
  }
  ctx.fillStyle = '#1a1d26';
  ctx.fillRect(28, 42, 8, 4);
}

/** A pizza seen from above, a little tilted. */
export function paintPie(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  burnt = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.66);
  circle(ctx, 0, 0, r);
  ctx.fillStyle = burnt ? '#3b2a22' : '#e3a548';
  ctx.fill();
  outline(ctx, Math.max(1, r * 0.08));
  circle(ctx, 0, 0, r * 0.8);
  ctx.fillStyle = burnt ? '#241914' : '#d2462e';
  ctx.fill();
  if (!burnt) {
    circle(ctx, 0, 0, r * 0.7);
    ctx.fillStyle = '#ffd56b';
    ctx.fill();
    ctx.fillStyle = '#b3351f';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + 0.3;
      const d = i % 2 ? r * 0.45 : r * 0.28;
      circle(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.13);
      ctx.fill();
    }
    ctx.fillStyle = '#4f9a3a';
    for (const [bx, by] of [
      [0.2, 0.5],
      [-0.45, -0.15],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(bx * r, by * r, r * 0.1, r * 0.06, 0.6, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function arm(
  ctx: Ctx,
  [sx, sy]: readonly [number, number],
  [ex, ey]: readonly [number, number],
  [hx, hy]: readonly [number, number],
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 9.5;
  ctx.stroke();
  ctx.strokeStyle = METAL_D;
  ctx.lineWidth = 7;
  ctx.stroke();
  circle(ctx, ex, ey, 4);
  ctx.fillStyle = JOINT;
  ctx.fill();
  outline(ctx, 1.2);
  circle(ctx, hx, hy, 6.5);
  ctx.fillStyle = METAL_L;
  ctx.fill();
  outline(ctx, 1.2);
  circle(ctx, hx + (hx > sx ? -4 : 4), hy - 3, 2.6);
  ctx.fill();
  outline(ctx, 1.2);
  ctx.restore();
}

/** Elbow and hand of each arm, by pose. */
const ARMS: Record<PizzaioloPose, readonly (readonly [number, number])[]> = {
  idle: [
    [-36, -18],
    [-40, -2],
    [36, -46],
    [42, -66],
  ],
  juggle: [
    [-38, -40],
    [-46, -60],
    [38, -40],
    [46, -60],
  ],
  throw: [
    [-36, -18],
    [-26, -6],
    [40, -48],
    [58, -62],
  ],
  panic: [
    [-40, -48],
    [-34, -84],
    [40, -48],
    [34, -84],
  ],
};

/**
 * The Pizzaiolo himself: a robot chef of blue metal — chef's hat, red
 * neckerchief, big yellow eyes, a wide grin. Waist at (0, 0), about 112
 * units up to the top of the hat.
 */
export function paintChef(ctx: Ctx, pose: PizzaioloPose): void {
  const a = ARMS[pose];
  const at = (i: number): readonly [number, number] => a[i] ?? [0, 0];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  roundRect(ctx, -22, -38, 44, 40, 10);
  ctx.fillStyle = linear(ctx, -22, -38, 22, 2, [METAL, METAL_D]);
  ctx.fill();
  outline(ctx);
  roundRect(ctx, -10, -22, 20, 12, 2.5);
  ctx.fillStyle = '#262b36';
  ctx.fill();
  ctx.fillStyle = pose === 'panic' ? ALARM_RED : '#ffd23f';
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      ctx.fillRect(-8 + c * 4.3, -20 + r * 4.6, 3, 3.4);
  roundRect(ctx, -6, -46, 12, 10, 2);
  ctx.fillStyle = '#4a5568';
  ctx.fill();
  outline(ctx);
  ctx.beginPath();
  ctx.moveTo(-17, -39);
  ctx.lineTo(17, -39);
  ctx.lineTo(0, -24);
  ctx.closePath();
  ctx.fillStyle = '#d23a2a';
  ctx.fill();
  outline(ctx);
  for (const x of [-15, 15]) {
    circle(ctx, x, -38, 4);
    ctx.fillStyle = '#d23a2a';
    ctx.fill();
    outline(ctx);
  }
  arm(ctx, [-21, -32], at(0), at(1));
  arm(ctx, [21, -32], at(2), at(3));
  ctx.fillStyle = JOINT;
  for (const x of [-31, 23]) {
    roundRect(ctx, x, -72, 8, 15, 3);
    ctx.fill();
    outline(ctx);
  }
  roundRect(ctx, -25, -84, 50, 40, 12);
  ctx.fillStyle = linear(ctx, -25, -84, 25, -44, [METAL_L, METAL, METAL_D]);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, -19, -81, 22, 3, 1.5);
  ctx.fill();

  const look = { idle: [0, 0], juggle: [0, -3], throw: [3, -1], panic: [0, 0] }[
    pose
  ];
  for (const ex of [-10.5, 10.5]) {
    circle(ctx, ex, -66, 9);
    ctx.fillStyle = '#ffc93c';
    ctx.fill();
    outline(ctx);
    circle(ctx, ex, -66, 6.6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    circle(
      ctx,
      ex + (look[0] ?? 0),
      -66 + (look[1] ?? 0),
      pose === 'panic' ? 1.6 : 3.4,
    );
    ctx.fillStyle = '#16181f';
    ctx.fill();
    if (pose !== 'panic') {
      circle(ctx, ex + (look[0] ?? 0) - 1.2, -67.5 + (look[1] ?? 0), 1.1);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  if (pose === 'panic') {
    ctx.beginPath();
    ctx.ellipse(0, -51, 5, 5.5, 0, 0, TAU);
    ctx.fillStyle = '#3a1f22';
    ctx.fill();
    outline(ctx);
    circle(ctx, 24, -78, 2.6);
    ctx.fillStyle = '#7cc7ff';
    ctx.fill();
  } else {
    const mouth = () => {
      ctx.beginPath();
      ctx.moveTo(-14, -56);
      ctx.quadraticCurveTo(0, -38, 14, -56);
      ctx.closePath();
    };
    mouth();
    ctx.fillStyle = '#3a1f22';
    ctx.fill();
    outline(ctx);
    ctx.save();
    mouth();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -57, 28, 3.6);
    circle(ctx, 0, -44, 5);
    ctx.fillStyle = '#e8566a';
    ctx.fill();
    ctx.restore();
  }
  roundRect(ctx, -19, -94, 38, 12, 3);
  ctx.fillStyle = '#f6f7f9';
  ctx.fill();
  outline(ctx);
  ctx.beginPath();
  ctx.arc(-12, -100, 9, 0, TAU);
  ctx.arc(0, -105, 11.5, 0, TAU);
  ctx.arc(12, -100, 9, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  for (const [x, y, r, from, to] of [
    [-12, -100, 9, 1.5, 4.9],
    [0, -105, 11.5, 3.5, 6.0],
    [12, -100, 9, 4.6, 7.9],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, from, to);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(-18, -86, 36, 2.5);
  ctx.restore();
}

/** The kitchen window, two cells wide and one tall, with the Pizzaiolo behind the counter. */
function kitchen(ctx: Ctx, pose: PizzaioloPose): void {
  const t = S;
  // The wall around the window, as the whiteboards'.
  officeWall(ctx);
  ctx.save();
  ctx.translate(t, 0);
  officeWall(ctx);
  ctx.restore();
  const x = t * 0.1;
  const w = 2 * t - t * 0.2;
  roundRect(ctx, x, t * 0.04, w, t * 0.82, t * 0.08);
  ctx.fillStyle = linear(ctx, 0, 0, 0, t, ['#6a4528', '#2e1c10']);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, t * 0.04, w, t * 0.82, t * 0.08);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let gx = x; gx < x + w; gx += t * 0.16) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, t);
    ctx.stroke();
  }
  for (let gy = t * 0.1; gy < t; gy += t * 0.16) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  const warm = ctx.createRadialGradient(t, 0, 0, t, 0, t * 1.1);
  warm.addColorStop(0, 'rgba(255,200,120,0.45)');
  warm.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(x, 0, w, t);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 2 * t, t * 0.78);
  ctx.clip();
  ctx.translate(t, t * 1.15);
  ctx.scale(t / 92, t / 92);
  paintChef(ctx, pose);
  ctx.restore();
  if (pose === 'juggle') {
    paintPie(ctx, t * 0.36, t * 0.3, t * 0.14);
    paintPie(ctx, t * 1.64, t * 0.26, t * 0.14);
  }

  roundRect(ctx, t * 0.03, t * 0.7, 2 * t - t * 0.06, t * 0.22, t * 0.05);
  ctx.fillStyle = linear(ctx, 0, t * 0.7, 0, t * 0.92, ['#f2f4f7', '#9aa3b0']);
  ctx.fill();
  outline(ctx, 1.2);
  paintPie(ctx, t * 0.35, t * 0.74, t * 0.17, pose === 'panic');
  ctx.fillStyle = '#2a2f3b';
  ctx.fillRect(0, S - 7, 2 * t, 7);
}

/** The target a pizza shows on its cell while it flies. */
function target(ctx: Ctx): void {
  const c = S / 2;
  ctx.save();
  circle(ctx, c, c, S * 0.4);
  ctx.fillStyle = 'rgba(255,74,90,0.22)';
  ctx.fill();
  ctx.setLineDash([S * 0.09, S * 0.07]);
  ctx.strokeStyle = ALARM_RED;
  ctx.lineWidth = S * 0.06;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = S * 0.045;
  ctx.beginPath();
  ctx.moveTo(c - S * 0.22, c);
  ctx.lineTo(c + S * 0.22, c);
  ctx.moveTo(c, c - S * 0.22);
  ctx.lineTo(c, c + S * 0.22);
  ctx.stroke();
  ctx.restore();
}

const POSES: readonly PizzaioloPose[] = ['idle', 'juggle', 'throw', 'panic'];

export const programadorTheme: ArenaTheme = {
  id: 'programador',
  accent: ACCENT,
  // The build breaks when the Pizzaiolo panics: the rules' clock, not a look's own.
  moment: {
    kind: 'alarm',
    everyTicks: PIZZA_PANIC_EVERY_TICKS,
    forTicks: PIZZA_PANIC_TICKS,
  },
  variants: {
    [TEXTURE.floor]: 14,
    [TEXTURE.wall]: 3,
    [TEXTURE.wallBorder]: 9,
    [TEXTURE.wallTop]: 3,
  },
  paint(doc, resolution = 1) {
    const { paint, textures } = tilePainter(doc, resolution);
    paint(TEXTURE.floor, (ctx) => carpet(ctx, false));
    paint(`${TEXTURE.floor}#1`, (ctx) => carpet(ctx, false, 1));
    paint(`${TEXTURE.floor}#2`, (ctx) => carpet(ctx, false, 2));
    paint(TEXTURE.floorShadow, (ctx) => carpet(ctx, true));
    for (let v = 0; v < 3; v++) {
      const key = v ? `${TEXTURE.wall}#${v}` : TEXTURE.wall;
      paint(key, (ctx) => desk(ctx, v, false));
      paint(key + ALARM_SUFFIX, (ctx) => desk(ctx, v, true));
      paint(v ? `${TEXTURE.wallTop}#${v}` : TEXTURE.wallTop, (ctx) =>
        whiteboard(ctx, v),
      );
      paint(v ? `${TEXTURE.wallBorder}#${v}` : TEXTURE.wallBorder, (ctx) =>
        partition(ctx, v),
      );
    }
    paint(TEXTURE.feature, (ctx) => ciScreen(ctx, false));
    paint(TEXTURE.feature + ALARM_SUFFIX, (ctx) => ciScreen(ctx, true));
    paint(TEXTURE.block, pizzaBoxes);
    paint(PIZZA_TEXTURE, (ctx) => paintPie(ctx, S / 2, S / 2, S * 0.34));
    paint(PIZZA_TARGET_TEXTURE, target);
    for (const pose of POSES) {
      const canvas = doc.createElement('canvas');
      canvas.width = 2 * S * resolution;
      canvas.height = S * resolution;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.scale(resolution, resolution);
      kitchen(ctx, pose);
      textures.set(PIZZAIOLO_TEXTURE(pose), canvas);
    }
    return textures;
  },
};
