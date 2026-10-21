import {
  beginFrame,
  bodyFrame,
  CharacterPose,
  circle,
  Ctx,
  ellipse,
  fillStroke,
  headFrame,
  headPath,
  INK,
  inkOnly,
  Path,
  roundRect,
  shadeRight,
  stepOf,
  TAU,
  teamFor,
} from './ink';

const SKIN = '#e8b48a';
const SKIN_SH = '#c58f63';
const HAIR = '#4a2e1c';
const SHORTS = '#3e4656';
const SHORTS_SH = '#2a303c';
const SNEAKER = '#f0efe9';
const SNEAKER_SH = '#c9c7bd';

/**
 * Novato, the default player: no job, no props. A plain tee and a cap in the
 * team colour, shorts, sneakers, a wide grin. The figure everyone starts as.
 */
export function paintNovato(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame !== 0;
  const step = stepOf(o.frame);
  const seated = !!o.seated;
  const bob = seated ? 0 : walking ? -1.2 : Math.sin((t * TAU) / 2.4) * 0.4;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: bare shins and sneakers ──
  const sneakerAt = (x: number, by: number, fwd: number, rot = 0) => {
    const p: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.5, -3.5);
      ctx.lineTo(4.5, -3.5);
      ctx.lineTo(5.5 + fwd, 2.5);
      ctx.quadraticCurveTo(0, 4.5, -5 + fwd * 0.3, 2.5);
      ctx.closePath();
      ctx.restore();
    };
    p();
    fillStroke(ctx, SNEAKER);
    shadeRight(ctx, p, SNEAKER_SH, 1.6, 0.6);
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () => roundRect(ctx, x - 3, 42, 6, 11 - lift * 0.5, 2.5);
    p();
    fillStroke(ctx, SKIN);
    shadeRight(ctx, p, SKIN_SH, 1.4, 0);
    sneakerAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3, 0, 6, 9, 2.5);
        ctx.restore();
      };
      p();
      fillStroke(ctx, SKIN);
      shadeRight(ctx, p, SKIN_SH, 1.4, 0);
      sneakerAt(hx + dir * 3.5, 51, 0, dir * 0.35);
    };
    if (side) hang(33, 0.4);
    else {
      hang(25, -1);
      hang(39, 1);
    }
  } else if (side) {
    legAt(29 - step * 4, step === 1 ? 2 : 0, step === 1 ? 2 : 0);
    legAt(35 + step * 4, step === -1 ? 2 : 0, step === -1 ? 2 : 0);
  } else {
    legAt(26.5, step === 1 ? 2.5 : 0, 0);
    legAt(37.5, step === -1 ? 2.5 : 0, 0);
  }

  ctx.translate(0, bob);

  // ── shorts ──
  const shortsPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(24, 36);
      ctx.lineTo(41, 36);
      ctx.lineTo(42, seated ? 43 : 45);
      ctx.lineTo(23, seated ? 43 : 45);
    } else {
      ctx.moveTo(21, 36);
      ctx.lineTo(43, 36);
      ctx.lineTo(44, seated ? 43 : 45);
      ctx.lineTo(20, seated ? 43 : 45);
    }
    ctx.closePath();
  };
  shortsPath();
  fillStroke(ctx, SHORTS);
  shadeRight(ctx, shortsPath, SHORTS_SH);

  // ── plain tee in the team colour ──
  const teePath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(25, 22);
      ctx.lineTo(39, 22);
      ctx.quadraticCurveTo(43, 30, 41, 38);
      ctx.lineTo(24, 38);
      ctx.quadraticCurveTo(21, 30, 25, 22);
    } else {
      ctx.moveTo(22, 22);
      ctx.lineTo(42, 22);
      ctx.quadraticCurveTo(46, 30, 44, 38);
      ctx.lineTo(20, 38);
      ctx.quadraticCurveTo(18, 30, 22, 22);
    }
    ctx.closePath();
  };
  teePath();
  fillStroke(ctx, c.suit);
  shadeRight(ctx, teePath, c.suitDark);
  if (!back) {
    // Collar.
    ctx.beginPath();
    ctx.moveTo(side ? 31 : 27, 22.5);
    ctx.quadraticCurveTo(side ? 35 : 32, 26, side ? 39 : 37, 22.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── arms: short sleeves, bare forearms ──
  const arm = (
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    hx: number,
    hy: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7.5;
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 4;
    ctx.stroke();
    // Sleeve over the shoulder.
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * 0.45, sy + (ey - sy) * 0.45);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8.5;
    ctx.stroke();
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 5;
    ctx.stroke();
    circle(ctx, hx, hy, 3);
    fillStroke(ctx, SKIN, 1.6);
  };
  if (seated) {
    if (side) arm(37, 25, 42, 29, 44, 33);
    else {
      arm(22, 25, 18, 31, 26, 34);
      arm(42, 25, 46, 31, 38, 34);
    }
  } else if (side) {
    const sw = walking ? step * 5 : 0;
    arm(37, 25, 40 + sw * 0.5, 31, 41 + sw, 37);
  } else if (walking) {
    arm(22, 25, 18, 31, 17 + step * 1.5, 38 + step * 2);
    arm(42, 25, 46, 31, 47 - step * 1.5, 38 - step * 2);
  } else {
    // Arms relaxed at the sides.
    arm(22, 25, 18.5, 31, 18, 37);
    arm(42, 25, 45.5, 31, 46, 37);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN);
  shadeRight(ctx, head, SKIN_SH, 1.8, 1.2);
  if (side) {
    ellipse(ctx, 26, 15, 2.2, 3);
    fillStroke(ctx, SKIN, 1.4);
  } else if (!back) {
    for (const x of [21.5, 42.5]) {
      ellipse(ctx, x, 15, 1.8, 2.8);
      fillStroke(ctx, SKIN, 1.4);
    }
  }
  if (!back) {
    const eye = (x: number, y: number) => {
      const h = 2.6 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.lineTo(x + 1.8, y);
        inkOnly(ctx, 1.6);
        return;
      }
      ellipse(ctx, x, y, 1.7, h);
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x - 0.5, y - 0.9, 0.55);
      ctx.fillStyle = '#fff';
      ctx.fill();
    };
    if (side) {
      eye(37, 16);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.5);
      ctx.quadraticCurveTo(44, 17.5, 41.5, 19);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(36, 20.5);
      ctx.quadraticCurveTo(39, 23, 41, 20.5);
      inkOnly(ctx, 1.4);
    } else {
      eye(28, 16);
      eye(36, 16);
      // A wide, open grin: happy to be here.
      ctx.beginPath();
      ctx.moveTo(27.5, 20);
      ctx.quadraticCurveTo(32, 25, 36.5, 20);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.4);
    }
  }
  // Hair peeking out under the cap.
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.quadraticCurveTo(22, 15, 23.5, 15.5);
  ctx.lineTo(24.5, 11.5);
  ctx.closePath();
  fillStroke(ctx, HAIR, 1.4);
  ctx.beginPath();
  ctx.moveTo(42, 12);
  ctx.quadraticCurveTo(42, 15, 40.5, 15.5);
  ctx.lineTo(39.5, 11.5);
  ctx.closePath();
  fillStroke(ctx, HAIR, 1.4);
  // ── cap in the team colour ──
  const crown: Path = () => {
    ctx.beginPath();
    ctx.moveTo(21.5, 12);
    ctx.quadraticCurveTo(21, 2.5, 32, 2.5);
    ctx.quadraticCurveTo(43, 2.5, 42.5, 12);
    ctx.closePath();
  };
  crown();
  fillStroke(ctx, c.suit);
  shadeRight(ctx, crown, c.suitDark, 1.4, 1);
  circle(ctx, 32, 3, 1.2);
  ctx.fillStyle = c.suitLight;
  ctx.fill();
  // Brim: forward from the front, to the side in profile, a strap at the back.
  ctx.beginPath();
  if (back) {
    roundRect(ctx, 28, 9, 8, 2.4, 1);
    ctx.fillStyle = c.suitDark;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (side) {
    ctx.moveTo(38, 11);
    ctx.quadraticCurveTo(46, 10.5, 48, 13);
    ctx.lineTo(38, 13);
    ctx.closePath();
    fillStroke(ctx, c.suitDark, 1.6);
  } else {
    ctx.ellipse(32, 12, 12, 2.6, 0, 0, TAU);
    fillStroke(ctx, c.suitDark, 1.6);
  }
  ctx.restore();
  ctx.restore();
}
