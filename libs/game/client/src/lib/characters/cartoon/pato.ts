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

const DUCK = '#f7c948';
const DUCK_SH = '#d9a21e';
const BEAK = '#f08a2e';
const BEAK_SH = '#c4661a';
const FOOT = '#e8792a';

/** Pato, a giant rubber duck: the debugging kind. Waddles. */
export function paintPato(
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
  const breath = walking ? 0 : Math.sin((t * TAU) / 2.4) * 0.5;
  const waddle = walking ? step * 0.06 : 0;
  beginFrame(ctx, o.facing);
  mountFrame(ctx, o.facing);

  const foot = (x: number, y: number, lift: number) => {
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 4 - lift);
    ctx.lineTo(x + 1.5, y - 4 - lift);
    ctx.lineTo(x + 5, y + 1 - lift);
    ctx.lineTo(x + 2, y + 0.5 - lift);
    ctx.lineTo(x, y + 2 - lift);
    ctx.lineTo(x - 2, y + 0.5 - lift);
    ctx.lineTo(x - 5, y + 1 - lift);
    ctx.closePath();
    fillStroke(ctx, FOOT, 1.6);
  };
  const gloss = (cx: number, cy: number, rx: number, ry: number) => {
    ellipse(ctx, cx - rx * 0.45, cy - ry * 0.45, rx * 0.22, ry * 0.18, -0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  };
  const body = (cx: number, cy: number, rx: number, ry: number) => {
    const p: Path = () => ellipse(ctx, cx, cy, rx, ry);
    p();
    fillStroke(ctx, DUCK);
    shadeRight(ctx, p, DUCK_SH, 2.2, 1.8);
    gloss(cx, cy, rx, ry);
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
    const h = 2 * (1 - blink);
    if (h < 0.3) {
      ctx.beginPath();
      ctx.moveTo(x - 1.5, y);
      ctx.lineTo(x + 1.5, y);
      inkOnly(ctx, 1.5);
      return;
    }
    ellipse(ctx, x, y, 1.7, h);
    ctx.fillStyle = INK;
    ctx.fill();
    circle(ctx, x - 0.6, y - 0.7, 0.6);
    ctx.fillStyle = '#fff';
    ctx.fill();
  };
  const head = (cx: number, cy: number, r: number, dir: -1 | 0 | 1) => {
    const p: Path = () => circle(ctx, cx, cy, r);
    p();
    fillStroke(ctx, DUCK);
    shadeRight(ctx, p, DUCK_SH, 1.8, 1.4);
    gloss(cx, cy, r, r);
    if (dir === 0) {
      const b: Path = () => {
        ctx.beginPath();
        ctx.moveTo(cx - 4.5, cy + 1.5);
        ctx.quadraticCurveTo(cx, cy + 0.5, cx + 4.5, cy + 1.5);
        ctx.quadraticCurveTo(cx + 3, cy + 5.5, cx, cy + 5.5);
        ctx.quadraticCurveTo(cx - 3, cy + 5.5, cx - 4.5, cy + 1.5);
        ctx.closePath();
      };
      b();
      fillStroke(ctx, BEAK, 1.6);
      shadeRight(ctx, b, BEAK_SH, 1.2, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, cy + 3);
      ctx.quadraticCurveTo(cx, cy + 4, cx + 3.5, cy + 3);
      inkOnly(ctx, 1);
      eye(cx - 3, cy - 1.5);
      eye(cx + 3, cy - 1.5);
    } else if (dir === 1) {
      const b: Path = () => {
        ctx.beginPath();
        ctx.moveTo(cx + r - 2, cy - 1.5);
        ctx.lineTo(cx + r + 6, cy);
        ctx.lineTo(cx + r - 2, cy + 3);
        ctx.closePath();
      };
      b();
      fillStroke(ctx, BEAK, 1.6);
      shadeRight(ctx, b, BEAK_SH, 1, 0.8);
      ctx.beginPath();
      ctx.moveTo(cx + r - 2, cy + 0.6);
      ctx.lineTo(cx + r + 4.5, cy + 0.4);
      inkOnly(ctx, 1);
      eye(cx + 1.5, cy - 1.5);
    }
  };
  const tail = (x: number, y: number, dir: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 5 * dir, y - 4, x - 7 * dir, y - 9);
      ctx.quadraticCurveTo(x - 2 * dir, y - 5, x + 2 * dir, y - 4);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, DUCK);
    shadeRight(ctx, p, DUCK_SH, 1.2, 1);
  };
  const riderAt = (hx: number, hy: number) => {
    if (!withRider) return;
    riderFrame(ctx, o.facing, hx, hy);
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

  ctx.translate(32, 44);
  ctx.rotate(waddle);
  ctx.translate(-32, -44 + breath * 0.3);
  if (side) {
    tail(16, 42, 1);
    foot(24, 57, step === 1 ? 2 : 0);
    body(31, 45, 19, 12.5 + breath * 0.3);
    saddle(27, 34, 8.5, 3.2);
    riderAt(27, 34);
    foot(34, 58, step === -1 ? 2 : 0);
    const neck: Path = () => roundRect(ctx, 41, 29, 10, 17, 5);
    neck();
    fillStroke(ctx, DUCK);
    shadeRight(ctx, neck, DUCK_SH, 1.6, 1);
    head(47, 28 + (walking ? step * 0.8 : 0), 9.5, 1);
  } else if (back) {
    head(32, 28, 9.5, -1);
    foot(22, 57, step === 1 ? 2 : 0);
    foot(42, 57, step === -1 ? 2 : 0);
    body(32, 45, 17, 13 + breath * 0.3);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    tail(32, 56, 0);
    const tp: Path = () => {
      ctx.beginPath();
      ctx.moveTo(28, 52);
      ctx.lineTo(36, 52);
      ctx.quadraticCurveTo(34, 60, 32, 61);
      ctx.quadraticCurveTo(30, 60, 28, 52);
      ctx.closePath();
    };
    tp();
    fillStroke(ctx, DUCK);
    shadeRight(ctx, tp, DUCK_SH, 1.2, 1);
  } else {
    foot(21, 58, step === 1 ? 2 : 0);
    foot(43, 58, step === -1 ? 2 : 0);
    body(32, 45, 17, 13 + breath * 0.3);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    roundRect(ctx, 27, 44, 10, 9, 4.5);
    fillStroke(ctx, DUCK);
    head(32, 52, 9.5, 0);
  }
  ctx.restore();
  ctx.restore();
}
