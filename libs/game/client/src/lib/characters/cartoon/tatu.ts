import {
  beginFrame,
  CharacterPainter,
  circle,
  Ctx,
  ellipse,
  fillStroke,
  INK,
  inkOnly,
  MountPose,
  Path,
  mountFrame,
  riderFrame,
  roundRect,
  shadeRight,
  stepOf,
  TAU,
  teamFor,
} from './ink';

const SHELL = '#a88556';
const SHELL_SH = '#7f6239';
const BAND = '#6e5231';
const HIDE = '#d9b98c';
const HIDE_SH = '#b3925f';
const CLAW = '#3a2e22';

/** Tatu, an armadillo: banded shell, short snout, clawed feet, team saddle. */
export function paintTatu(
  ctx: Ctx,
  o: MountPose,
  rider: CharacterPainter,
): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame !== 0;
  const step = stepOf(o.frame);
  const withRider = o.rider !== false;
  const breath = walking ? 0 : Math.sin((t * TAU) / 2.2) * 0.5;
  const bob = walking ? -1 : 0;
  beginFrame(ctx, o.facing);
  mountFrame(ctx, o.facing);

  const leg = (x: number, y: number, lift: number) => {
    const p: Path = () => roundRect(ctx, x - 3, y - 7 - lift, 6, 8, 2.5);
    p();
    fillStroke(ctx, HIDE);
    shadeRight(ctx, p, HIDE_SH, 1.2, 0);
    for (const dx of [-2, 0, 2]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y - lift);
      ctx.lineTo(x + dx, y + 2 - lift);
      ctx.strokeStyle = CLAW;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  };
  const shell = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    bands: { x: number; y: number; rx: number; ry: number }[],
  ) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
      ctx.quadraticCurveTo(cx + rx, cy + ry * 0.55, cx, cy + ry * 0.75);
      ctx.quadraticCurveTo(cx - rx, cy + ry * 0.55, cx - rx, cy);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, SHELL);
    shadeRight(ctx, p, SHELL_SH, 2, 1.6);
    ctx.save();
    p();
    ctx.clip();
    ctx.strokeStyle = BAND;
    ctx.lineWidth = 1.6;
    for (const b of bands) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  };
  const saddle = (cx: number, cy: number, rx: number, ry: number) => {
    const p: Path = () => ellipse(ctx, cx, cy, rx, ry);
    p();
    fillStroke(ctx, c.suit);
    shadeRight(ctx, p, c.suitDark, 1.4, 1);
    ellipse(ctx, cx, cy, rx * 0.6, ry * 0.55);
    ctx.strokeStyle = c.suitLight;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  const eye = (x: number, y: number) => {
    const h = 1.6 * (1 - blink);
    if (h < 0.3) {
      ctx.beginPath();
      ctx.moveTo(x - 1.2, y);
      ctx.lineTo(x + 1.2, y);
      inkOnly(ctx, 1.4);
      return;
    }
    ellipse(ctx, x, y, 1.3, h);
    ctx.fillStyle = INK;
    ctx.fill();
    circle(ctx, x - 0.4, y - 0.5, 0.45);
    ctx.fillStyle = '#fff';
    ctx.fill();
  };
  const ear = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ellipse(ctx, 0, 0, 1.8, 3);
    ctx.restore();
    fillStroke(ctx, HIDE, 1.5);
  };
  const headFront = (cx: number, cy: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 4);
      ctx.quadraticCurveTo(cx, cy - 8, cx + 7, cy - 4);
      ctx.quadraticCurveTo(cx + 6, cy + 4, cx, cy + 6);
      ctx.quadraticCurveTo(cx - 6, cy + 4, cx - 7, cy - 4);
      ctx.closePath();
    };
    ear(cx - 6, cy - 6, -0.5);
    ear(cx + 6, cy - 6, 0.5);
    p();
    fillStroke(ctx, HIDE);
    shadeRight(ctx, p, HIDE_SH, 1.4, 1);
    eye(cx - 3, cy - 2);
    eye(cx + 3, cy - 2);
    ellipse(ctx, cx, cy + 3.5, 2.2, 1.4);
    ctx.fillStyle = INK;
    ctx.fill();
  };
  const headSide = (cx: number, cy: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 5);
      ctx.quadraticCurveTo(cx + 2, cy - 8, cx + 7, cy - 2);
      ctx.lineTo(cx + 10, cy + 2);
      ctx.quadraticCurveTo(cx + 4, cy + 5, cx - 5, cy + 3);
      ctx.closePath();
    };
    ear(cx - 3, cy - 7, 0.3);
    p();
    fillStroke(ctx, HIDE);
    shadeRight(ctx, p, HIDE_SH, 1.4, 1);
    eye(cx + 1, cy - 2.5);
    circle(ctx, cx + 9.2, cy + 1.5, 1.2);
    ctx.fillStyle = INK;
    ctx.fill();
  };
  const tail = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 2.5);
    ctx.lineTo(x + dx, y + dy);
    ctx.lineTo(x, y + 2.5);
    ctx.closePath();
    fillStroke(ctx, HIDE);
    ctx.strokeStyle = BAND;
    ctx.lineWidth = 1;
    for (const k of [0.3, 0.55, 0.8]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * k, y + dy * k - 1.5 * (1 - k));
      ctx.lineTo(x + dx * k, y + dy * k + 1.5 * (1 - k));
      ctx.stroke();
    }
  };
  const scaled = (cx: number, cy: number, s: number, draw: () => void) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    draw();
    ctx.restore();
  };
  const riderAt = (hx: number, hy: number) => {
    if (!withRider) return;
    riderFrame(ctx, o.facing, hx, hy);
    // The context is already mirrored for `left`; the rider must not mirror twice.
    rider(ctx, {
      facing: o.facing === 'left' ? 'right' : o.facing,
      frame: 0,
      slot: o.slot,
      t,
      blink: o.riderBlink ?? 0,
      seated: true,
    });
    ctx.restore();
  };

  ctx.translate(0, bob + breath * 0.3);
  if (side) {
    tail(13, 47, -9, 4);
    leg(22, 57, step === 1 ? 2 : 0);
    leg(40, 57, step === -1 ? 2 : 0);
    shell(31, 44, 20, 12.5 + breath * 0.3, [
      { x: 31, y: 44, rx: 13, ry: 11 },
      { x: 31, y: 44, rx: 7, ry: 11 },
      { x: 31, y: 44, rx: 2, ry: 11 },
    ]);
    saddle(28, 33, 9, 3.4);
    riderAt(28, 33);
    leg(27, 58, step === -1 ? 2 : 0);
    leg(45, 58, step === 1 ? 2 : 0);
    scaled(49, 46 + (walking ? step * 0.6 : 0), 1.3, () => headSide(0, 0));
  } else if (back) {
    scaled(32, 28, 1.3, () => {
      ear(-7, -2, -0.4);
      ear(7, -2, 0.4);
      ellipse(ctx, 0, 1, 7, 3.5);
      fillStroke(ctx, HIDE);
    });
    leg(19, 55, step === 1 ? 2 : 0);
    leg(45, 55, step === -1 ? 2 : 0);
    shell(32, 44, 18, 13 + breath * 0.3, [
      { x: 32, y: 35, rx: 16, ry: 6 },
      { x: 32, y: 40, rx: 17, ry: 6 },
      { x: 32, y: 45, rx: 17.5, ry: 6 },
    ]);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    tail(32, 54, 0, 8);
    ctx.beginPath();
    ctx.moveTo(29.5, 51.5);
    ctx.lineTo(34.5, 51.5);
    ctx.lineTo(32, 62);
    ctx.closePath();
    fillStroke(ctx, HIDE);
  } else {
    leg(19, 56, step === 1 ? 2 : 0);
    leg(45, 56, step === -1 ? 2 : 0);
    shell(32, 44, 18, 13 + breath * 0.3, [
      { x: 32, y: 53, rx: 16, ry: 6 },
      { x: 32, y: 48, rx: 17, ry: 6 },
      { x: 32, y: 43, rx: 17.5, ry: 6 },
    ]);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    scaled(32, 54, 1.3, () => headFront(0, 0));
  }
  ctx.restore();
  ctx.restore();
}
