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
  stepOf,
  TAU,
  teamFor,
  volume,
  lineOf,
} from './ink';

const CAPY = '#9a7447';
const CAPY_SH = '#6f5130';
const CAPY_BELLY = '#c4a070';
const BIRD = '#f2c94c';
const BIRD_BEAK = '#e8792a';

/** Capivara: calm, round, chewing. Carries a small bird whenever nobody rides it. */
export function paintCapivara(
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
  const breath = walking ? 0 : Math.sin((t * TAU) / 3) * 0.5;
  const chew = walking ? 0 : (Math.sin((t * TAU) / 0.9) + 1) * 0.5;
  const hop = Math.abs(Math.sin((t * TAU) / 1.4)) * (walking ? 0.6 : 0);
  beginFrame(ctx, o.facing);
  mountFrame(ctx, o.facing);

  const leg = (x: number, y: number, lift: number) => {
    const p: Path = () => roundRect(ctx, x - 3, y - 7 - lift, 6, 8, 2.5);
    p();
    fillStroke(ctx, CAPY, 1.7, lineOf(CAPY));
    volume(ctx, p, CAPY, 0.86, 1.2);
    ellipse(ctx, x, y - lift + 0.5, 3.6, 1.8);
    fillStroke(ctx, CAPY_SH, 1.4, lineOf(CAPY_SH));
  };
  const body = (cx: number, cy: number, rx: number, ry: number) => {
    const p: Path = () => ellipse(ctx, cx, cy, rx, ry);
    p();
    fillStroke(ctx, CAPY, 1.7, lineOf(CAPY));
    volume(ctx, p, CAPY, 1.58, 2.2);
    ctx.save();
    p();
    ctx.clip();
    ellipse(ctx, cx, cy + ry * 0.55, rx * 0.75, ry * 0.5);
    ctx.fillStyle = CAPY_BELLY;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    for (const [fx, fy] of [
      [-0.5, -0.4],
      [-0.2, -0.6],
      [0.2, -0.55],
      [0.5, -0.3],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + rx * fx, cy + ry * fy);
      ctx.lineTo(cx + rx * fx + 1.2, cy + ry * fy - 1.6);
      ctx.stroke();
    }
  };
  const saddle = (cx: number, cy: number, rx: number, ry: number) => {
    const p: Path = () => ellipse(ctx, cx, cy, rx, ry);
    p();
    fillStroke(ctx, c.suit, 1.7, lineOf(c.suit));
    volume(ctx, p, c.suit, 1.01, 1.4);
    ellipse(ctx, cx, cy, rx * 0.6, ry * 0.55);
    ctx.strokeStyle = c.suitLight;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  // Half-closed eyes: the calmest animal in the arena.
  const eye = (x: number, y: number) => {
    const h = 1.3 * (1 - blink);
    ellipse(ctx, x, y, 1.5, Math.max(0.3, h));
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 1.8, y - 1.1);
    ctx.lineTo(x + 1.8, y - 1.1);
    inkOnly(ctx, 1.3);
    if (h > 0.5) {
      circle(ctx, x - 0.4, y - 0.3, 0.4);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  };
  const ear = (x: number, y: number) => {
    circle(ctx, x, y, 2.2);
    fillStroke(ctx, CAPY, 1.5, lineOf(CAPY));
    circle(ctx, x, y, 1);
    ctx.fillStyle = CAPY_SH;
    ctx.fill();
  };
  const bird = (x: number, y: number, dir: number) => {
    ellipse(ctx, x, y, 3, 2.4);
    fillStroke(ctx, BIRD, 1.5, lineOf(BIRD));
    circle(ctx, x + 2 * dir, y - 2, 2);
    fillStroke(ctx, BIRD, 1.5, lineOf(BIRD));
    ctx.beginPath();
    ctx.moveTo(x + 3.6 * dir, y - 2.3);
    ctx.lineTo(x + 5.5 * dir, y - 1.7);
    ctx.lineTo(x + 3.6 * dir, y - 1.1);
    ctx.closePath();
    fillStroke(ctx, BIRD_BEAK, 1, lineOf(BIRD_BEAK));
    circle(ctx, x + 2.4 * dir, y - 2.4, 0.5);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 2.5 * dir, y - 0.5);
    ctx.lineTo(x - 4.5 * dir, y - 2.5);
    inkOnly(ctx, 1.2);
  };
  const headFront = (cx: number, cy: number) => {
    ear(cx - 6.5, cy - 6);
    ear(cx + 6.5, cy - 6);
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 7.5, cy - 5);
      ctx.quadraticCurveTo(cx, cy - 9, cx + 7.5, cy - 5);
      ctx.quadraticCurveTo(cx + 8, cy + 5, cx, cy + 7);
      ctx.quadraticCurveTo(cx - 8, cy + 5, cx - 7.5, cy - 5);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, CAPY, 1.7, lineOf(CAPY));
    volume(ctx, p, CAPY, 1.15, 1.6);
    eye(cx - 3.5, cy - 2);
    eye(cx + 3.5, cy - 2);
    roundRect(ctx, cx - 4.5, cy + 0.5, 9, 5.5 + chew * 0.6, 2.5);
    fillStroke(ctx, CAPY_BELLY, 1.4, lineOf(CAPY_BELLY));
    ctx.fillStyle = INK;
    for (const dx of [-2, 2]) {
      ellipse(ctx, cx + dx, cy + 2.4, 1, 0.7);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, cy + 4.8 + chew * 0.6);
    ctx.lineTo(cx + 2.5, cy + 4.8 + chew * 0.6);
    inkOnly(ctx, 1);
    roundRect(ctx, cx - 1.6, cy + 4, 3.2, 1.6, 0.4);
    ctx.fillStyle = '#f2b36a';
    ctx.fill();
  };
  const headSide = (cx: number, cy: number) => {
    ear(cx - 3, cy - 6);
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 4);
      ctx.quadraticCurveTo(cx - 2, cy - 9, cx + 5, cy - 5);
      ctx.lineTo(cx + 10, cy - 1);
      ctx.quadraticCurveTo(cx + 10.5, cy + 4, cx + 6, cy + 5);
      ctx.quadraticCurveTo(cx - 5, cy + 6, cx - 7, cy - 4);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, CAPY, 1.7, lineOf(CAPY));
    volume(ctx, p, CAPY, 1.15, 1.6);
    eye(cx + 1.5, cy - 2);
    ellipse(ctx, cx + 8.5, cy + 0.5, 1, 0.7);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy + 3 + chew * 0.6);
    ctx.lineTo(cx + 9.5, cy + 2.5 + chew * 0.6);
    inkOnly(ctx, 1);
    roundRect(ctx, cx + 6.5, cy + 2, 2.4, 1.6, 0.4);
    ctx.fillStyle = '#f2b36a';
    ctx.fill();
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

  ctx.translate(0, breath * 0.3 - hop);
  if (side) {
    leg(22, 58, step === 1 ? 2 : 0);
    leg(40, 58, step === -1 ? 2 : 0);
    body(31, 45, 20, 12.5 + breath * 0.3);
    saddle(27, 33.5, 8.5, 3.2);
    riderAt(27, 33.5);
    leg(27, 59, step === -1 ? 2 : 0);
    leg(45, 59, step === 1 ? 2 : 0);
    scaled(48, 38 + (walking ? step * 0.6 : 0), 1.3, () => headSide(0, 0));
    if (!withRider) bird(16, 34, 1);
  } else if (back) {
    scaled(32, 28, 1.3, () => {
      ear(-7, -2);
      ear(7, -2);
      ellipse(ctx, 0, 0, 7, 4);
      fillStroke(ctx, CAPY, 1.7, lineOf(CAPY));
    });
    leg(21, 58, step === 1 ? 2 : 0);
    leg(43, 58, step === -1 ? 2 : 0);
    body(32, 45, 18, 13 + breath * 0.3);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    ellipse(ctx, 32, 55, 6, 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();
    if (!withRider) bird(32, 30, 1);
  } else {
    leg(20, 59, step === 1 ? 2 : 0);
    leg(44, 59, step === -1 ? 2 : 0);
    body(32, 45, 18, 13 + breath * 0.3);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    scaled(32, 51, 1.3, () => headFront(0, 0));
    if (!withRider) bird(20, 36, 1);
  }
  ctx.restore();
  ctx.restore();
}
