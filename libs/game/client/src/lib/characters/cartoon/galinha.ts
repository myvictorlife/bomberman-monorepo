import {
  beginFrame,
  CharacterPainter,
  circle,
  Ctx,
  ellipse,
  fillStroke,
  glowFill,
  INK,
  inkOnly,
  MountPose,
  Path,
  mountFrame,
  riderFrame,
  shadeRight,
  stepOf,
  TAU,
  teamFor,
} from './ink';

const FEATHER = '#fbf6ea';
const FEATHER_SH = '#ddd3bd';
const COMB = '#e8402f';
const COMB_SH = '#b52a1d';
const BEAK = '#f6b82b';
const BEAK_SH = '#c98a12';
const LEG = '#f08a2e';
const SPARK = '#ffe45c';
const SPARK_GLOW = '#fff3a0';

/**
 * Galinha, an electric hen: a plump white bird with a comb shaped like a
 * lightning bolt, a red wattle, wings tipped in yellow sparks and a crackle
 * round her that never quite settles. Struts like a hen — head bobbing with
 * every step — and carries the rider on a team-coloured saddle.
 */
export function paintGalinha(
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
  // A hen's head goes forward on one step and back on the other.
  const peck = walking ? step * 1.6 : 0;
  beginFrame(ctx, o.facing);
  mountFrame(ctx, o.facing);

  const leg = (x: number, y: number, lift: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 9 - lift);
    ctx.lineTo(x, y - lift);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = LEG;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const dx of [-3.5, 0, 3.5]) {
      ctx.beginPath();
      ctx.moveTo(x, y - lift);
      ctx.lineTo(x + dx, y + 2 - lift);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = LEG;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };
  const body = (cx: number, cy: number, rx: number, ry: number) => {
    const p: Path = () => ellipse(ctx, cx, cy, rx, ry);
    p();
    fillStroke(ctx, FEATHER);
    shadeRight(ctx, p, FEATHER_SH, 2.2, 1.8);
    // Three soft feather scallops on the breast.
    for (const [dx, dy] of [
      [-6, 5],
      [0, 7],
      [6, 5],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = FEATHER_SH;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  };
  /** A wing, its tip three yellow bolts that glow a little. */
  const wing = (cx: number, cy: number, dir: 1 | -1, flap: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 6 * dir, cy - 4);
      ctx.quadraticCurveTo(cx + 6 * dir, cy - 6 - flap, cx + 9 * dir, cy + 1);
      ctx.lineTo(cx + 6 * dir, cy + 2);
      ctx.lineTo(cx + 7 * dir, cy + 5);
      ctx.lineTo(cx + 3 * dir, cy + 4);
      ctx.lineTo(cx + 3 * dir, cy + 7);
      ctx.quadraticCurveTo(cx - 5 * dir, cy + 6, cx - 6 * dir, cy - 4);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, FEATHER, 1.6);
    shadeRight(ctx, p, FEATHER_SH, 1.2 * dir, 1);
    ctx.beginPath();
    ctx.moveTo(cx + 9 * dir, cy + 1);
    ctx.lineTo(cx + 6 * dir, cy + 2);
    ctx.lineTo(cx + 7 * dir, cy + 5);
    ctx.lineTo(cx + 3 * dir, cy + 4);
    ctx.lineTo(cx + 3 * dir, cy + 7);
    ctx.strokeStyle = SPARK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
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
  /** The comb: a red lightning bolt standing on the head. */
  const comb = (cx: number, cy: number, s: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 3 * s, cy);
      ctx.lineTo(cx - 1 * s, cy - 6 * s);
      ctx.lineTo(cx + 0.5 * s, cy - 3 * s);
      ctx.lineTo(cx + 2.5 * s, cy - 8 * s);
      ctx.lineTo(cx + 2 * s, cy - 2.5 * s);
      ctx.lineTo(cx + 4 * s, cy - 4 * s);
      ctx.lineTo(cx + 3 * s, cy);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, COMB, 1.5);
    shadeRight(ctx, p, COMB_SH, 0.8, 0.6);
  };
  const eye = (x: number, y: number) => {
    const h = 1.9 * (1 - blink);
    if (h < 0.3) {
      ctx.beginPath();
      ctx.moveTo(x - 1.4, y);
      ctx.lineTo(x + 1.4, y);
      inkOnly(ctx, 1.4);
      return;
    }
    ellipse(ctx, x, y, 1.6, h);
    ctx.fillStyle = INK;
    ctx.fill();
    circle(ctx, x - 0.5, y - 0.7, 0.55);
    ctx.fillStyle = '#fff';
    ctx.fill();
  };
  const head = (cx: number, cy: number, r: number, dir: -1 | 0 | 1) => {
    comb(cx - (dir === 1 ? 2.5 : 1.5), cy - r + 2.5, 1.35);
    const p: Path = () => circle(ctx, cx, cy, r);
    p();
    fillStroke(ctx, FEATHER);
    shadeRight(ctx, p, FEATHER_SH, 1.6, 1.2);
    if (dir === 0) {
      const b: Path = () => {
        ctx.beginPath();
        ctx.moveTo(cx - 2.6, cy + 1);
        ctx.lineTo(cx + 2.6, cy + 1);
        ctx.lineTo(cx, cy + 5);
        ctx.closePath();
      };
      b();
      fillStroke(ctx, BEAK, 1.4);
      shadeRight(ctx, b, BEAK_SH, 0.8, 0.6);
      ellipse(ctx, cx, cy + 7, 1.8, 2.4);
      fillStroke(ctx, COMB, 1.2);
      eye(cx - 3, cy - 1.5);
      eye(cx + 3, cy - 1.5);
    } else if (dir === 1) {
      const b: Path = () => {
        ctx.beginPath();
        ctx.moveTo(cx + r - 1.5, cy - 1.5);
        ctx.lineTo(cx + r + 4.5, cy + 0.5);
        ctx.lineTo(cx + r - 1.5, cy + 2.5);
        ctx.closePath();
      };
      b();
      fillStroke(ctx, BEAK, 1.4);
      shadeRight(ctx, b, BEAK_SH, 0.8, 0.6);
      ellipse(ctx, cx + r - 2.5, cy + 4.5, 1.6, 2.4);
      fillStroke(ctx, COMB, 1.2);
      eye(cx + 2, cy - 1.5);
    }
  };
  /** Tail feathers, fanned up and back, the middle one a bolt. */
  const tail = (x: number, y: number, dir: number) => {
    for (const [dx, dy, w] of [
      [-2, -11, 3.4],
      [2, -13, 3.6],
      [6, -10, 3.2],
    ] as const) {
      const p: Path = () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          x + (dx - w) * dir,
          y + dy * 0.5,
          x + dx * dir,
          y + dy,
        );
        ctx.quadraticCurveTo(
          x + (dx + w) * dir,
          y + dy * 0.5,
          x + 2 * dir,
          y + 1,
        );
        ctx.closePath();
      };
      p();
      fillStroke(ctx, FEATHER, 1.5);
      shadeRight(ctx, p, FEATHER_SH, 1, 0.8);
    }
    ctx.beginPath();
    ctx.moveTo(x + 2 * dir, y - 3);
    ctx.lineTo(x + 1 * dir, y - 7);
    ctx.lineTo(x + 3 * dir, y - 7);
    ctx.lineTo(x + 2 * dir, y - 11);
    ctx.strokeStyle = SPARK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
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
  /** A bolt crackling off her, outlined so it reads on any floor. */
  const zap = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 3.5 * s);
    ctx.lineTo(x - 1.8 * s, y);
    ctx.lineTo(x + 0.7 * s, y);
    ctx.lineTo(x - 1.1 * s, y + 3.5 * s);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = SPARK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  };
  const glow = (cx: number, cy: number, r: number) => {
    circle(ctx, cx, cy, r);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * TAU * 1.5);
    glowFill(ctx, SPARK_GLOW, 10);
    ctx.restore();
  };

  const flap = walking ? 1.5 + step : Math.sin(t * TAU) * 0.6;
  ctx.translate(0, breath * 0.3);
  if (side) {
    glow(30, 45, 15);
    tail(15, 42, -1);
    leg(26, 59, step === 1 ? 2 : 0);
    body(30, 44, 16, 12.5 + breath * 0.3);
    wing(27, 42, -1, flap);
    saddle(27, 33, 8, 3);
    riderAt(27, 33);
    leg(34, 60, step === -1 ? 2 : 0);
    head(45 + peck, 30, 8.5, 1);
  } else if (back) {
    glow(32, 45, 15);
    head(32, 27, 7.5, -1);
    leg(25, 59, step === 1 ? 2 : 0);
    leg(39, 59, step === -1 ? 2 : 0);
    wing(18, 43, -1, flap);
    wing(46, 43, 1, flap);
    body(32, 45, 15, 12.5 + breath * 0.3);
    saddle(32, 33, 8.5, 3.2);
    riderAt(32, 33);
    tail(32, 55, 1);
  } else {
    glow(32, 45, 15);
    leg(25, 60, step === 1 ? 2 : 0);
    leg(39, 60, step === -1 ? 2 : 0);
    wing(18, 43, -1, flap);
    wing(46, 43, 1, flap);
    body(32, 45, 15, 12.5 + breath * 0.3);
    saddle(32, 33, 8.5, 3.2);
    riderAt(32, 33);
    head(32, 49 + Math.abs(peck) * 0.4, 7.5, 0);
  }

  const phase = Math.floor(t * 6) % 3;
  if (phase === 0) zap(side ? 12 : 13, 36, 1);
  if (phase === 1) zap(side ? 50 : 51, 40, 0.9);
  if (phase === 2 || walking) zap(side ? 40 : 48, 56, 0.8);
  ctx.restore();
  ctx.restore();
}
