import {
  beginFrame,
  CharacterPose,
  circle,
  Ctx,
  fillStroke,
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

const SKIN = '#f1c8a2';
const SKIN_SH = '#d1a179';
const HAIR = '#7a3f22';
const HOOD = '#3a3f4a';
const HOOD_SH = '#262a33';
const HOOD_POCKET = '#474d5a';
const JEANS = '#3a4a6b';
const JEANS_SH = '#283551';
const SNEAKER = '#f0efe9';
const SNEAKER_SH = '#c9c7bd';
const MUG = '#f6f3ea';

/**
 * Byte, the developer: graphite hoodie with team-coloured drawstrings and a
 * `</>` print, headphones, round glasses, stubble, jeans and white sneakers.
 * One hand in the pocket, the other holding a steaming mug of coffee.
 */
export function paintByte(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame !== 0;
  const step = stepOf(o.frame);
  const seated = !!o.seated;
  const bob = seated ? 0 : walking ? -1.2 : Math.sin((t * TAU) / 3.1) * 0.4;
  beginFrame(ctx, o.facing);

  // ── legs: jeans and sneakers ──
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
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-4.5, 1.5);
    ctx.lineTo(5 + fwd, 1.5);
    ctx.restore();
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () =>
      roundRect(ctx, x - 3.2, 42, 6.4, 11 - lift * 0.5, 2.2);
    p();
    fillStroke(ctx, JEANS);
    shadeRight(ctx, p, JEANS_SH, 1.4, 0);
    sneakerAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3.2, 0, 6.4, 9, 2.2);
        ctx.restore();
      };
      p();
      fillStroke(ctx, JEANS);
      shadeRight(ctx, p, JEANS_SH, 1.4, 0);
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

  // ── hoodie ──
  const hem = seated ? 42 : 44;
  const torsoPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(24, 22);
      ctx.lineTo(40, 22);
      ctx.quadraticCurveTo(44, 32, 42, hem);
      ctx.lineTo(23, hem);
      ctx.quadraticCurveTo(20, 32, 24, 22);
    } else {
      ctx.moveTo(21, 22);
      ctx.lineTo(43, 22);
      ctx.quadraticCurveTo(47, 32, 45, hem);
      ctx.lineTo(19, hem);
      ctx.quadraticCurveTo(17, 32, 21, 22);
    }
    ctx.closePath();
  };
  torsoPath();
  fillStroke(ctx, HOOD);
  shadeRight(ctx, torsoPath, HOOD_SH);
  if (back) {
    const hoodPath: Path = () => {
      ctx.beginPath();
      ctx.moveTo(23, 22);
      ctx.quadraticCurveTo(32, 20, 41, 22);
      ctx.quadraticCurveTo(40, 32, 32, 34);
      ctx.quadraticCurveTo(24, 32, 23, 22);
      ctx.closePath();
    };
    hoodPath();
    fillStroke(ctx, HOOD_POCKET);
    shadeRight(ctx, hoodPath, HOOD_SH, 1.4, 1);
  } else {
    const pocketPath: Path = () =>
      roundRect(
        ctx,
        side ? 27 : 23,
        seated ? 34 : 35,
        side ? 13 : 18,
        seated ? 6 : 7,
        2,
      );
    pocketPath();
    fillStroke(ctx, HOOD_POCKET, 1.6);
    shadeRight(ctx, pocketPath, HOOD_SH, 1.2, 0.8);
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(side ? 36 : 29, 24);
    ctx.lineTo(side ? 35 : 28, 27.5);
    ctx.moveTo(side ? 39 : 35, 24);
    ctx.lineTo(side ? 39 : 36, 27.5);
    ctx.stroke();
    for (const x of side ? [35, 39] : [28, 36]) {
      roundRect(ctx, x - 0.9, 27, 1.8, 2.2, 0.6);
      ctx.fillStyle = c.suitLight;
      ctx.fill();
    }
    if (!side) {
      ctx.font = 'bold 5.5px monospace';
      ctx.fillStyle = c.suitLight;
      ctx.textAlign = 'center';
      ctx.fillText('</>', 32, 33);
    }
    ctx.beginPath();
    ctx.moveTo(side ? 25 : 22, 23.5);
    ctx.quadraticCurveTo(32, 27.5, side ? 40 : 42, 23.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // ── arms ──
  const sleeve = (
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    hx: number,
    hy: number,
    hand = true,
  ) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = HOOD;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.9);
      fillStroke(ctx, SKIN, 1.6);
    }
  };
  const mug = (x: number, y: number) => {
    roundRect(ctx, x - 3, y - 3.5, 6, 7, 1.2);
    fillStroke(ctx, MUG, 1.6);
    ctx.fillStyle = c.suit;
    ctx.fillRect(x - 3, y - 1, 6, 2.2);
    ctx.beginPath();
    ctx.arc(x + 3.6, y, 2, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (!walking && !seated) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      for (const dx of [-1.2, 1.2]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y - 5);
        ctx.quadraticCurveTo(
          x + dx + 1,
          y - 7 - Math.sin((t * TAU) / 1.8 + dx) * 0.6,
          x + dx,
          y - 9,
        );
        ctx.stroke();
      }
    }
  };
  if (seated) {
    if (side) sleeve(37, 25, 44, 33, 42, 29);
    else {
      sleeve(22, 25, 26, 34, 18, 31);
      sleeve(42, 25, 38, 34, 46, 31);
    }
  } else if (side) {
    const sw = walking ? step * 5 : 0;
    sleeve(37, 25, 40 + sw, 36, 43 + sw * 0.5, 31);
    mug(43 + sw * 0.5, 31);
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 38 + step * 2, 18, 31);
    sleeve(42, 25, 47 - step * 1.5, 38 - step * 2, 46, 31);
    mug(46, 29.5);
  } else {
    sleeve(22, 25, 19, 32, 21, 36, false);
    sleeve(42, 25, 46, 34, 46.5, 28);
    mug(46.5, 26.5);
  }

  // ── head ──
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN);
  shadeRight(ctx, head, SKIN_SH, 1.8, 1.2);
  if (!back) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const dots: [number, number][] = side
      ? [
          [38, 21],
          [40, 22],
          [36, 22.5],
        ]
      : [
          [28, 22],
          [30.5, 23],
          [33.5, 23],
          [36, 22],
        ];
    for (const [x, y] of dots) {
      circle(ctx, x, y, 0.5);
      ctx.fill();
    }
    ctx.beginPath();
    if (side) {
      ctx.moveTo(37, 20.5);
      ctx.lineTo(40.5, 21);
    } else {
      ctx.moveTo(29.5, 20.5);
      ctx.quadraticCurveTo(32, 22, 34.5, 20.5);
    }
    inkOnly(ctx, 1.4);
    if (side) {
      ctx.beginPath();
      ctx.moveTo(41.5, 15);
      ctx.quadraticCurveTo(44, 17, 41.5, 18.5);
      inkOnly(ctx, 1.5);
    }
    const eye = (x: number, y: number) => {
      const h = 1.6 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.5, y);
        ctx.lineTo(x + 1.5, y);
        inkOnly(ctx, 1.4);
        return;
      }
      ctx.beginPath();
      ctx.ellipse(x, y, 1.3, h, 0, 0, TAU);
      ctx.fillStyle = INK;
      ctx.fill();
    };
    const lens = (x: number, y: number) => {
      circle(ctx, x, y, 4);
      ctx.fillStyle = c.glow;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      eye(x, y + 0.3);
      circle(ctx, x, y, 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 2.4, y - 1.4);
      ctx.lineTo(x - 0.8, y - 2.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    if (side) {
      lens(37.5, 16);
      ctx.beginPath();
      ctx.moveTo(33.5, 15.5);
      ctx.lineTo(26, 14.5);
      inkOnly(ctx, 1.5);
    } else {
      lens(27.5, 16);
      lens(36.5, 16);
      ctx.beginPath();
      ctx.moveTo(31.5, 16);
      ctx.lineTo(32.5, 16);
      inkOnly(ctx, 1.7);
      ctx.beginPath();
      ctx.moveTo(23.5, 15);
      ctx.lineTo(22, 14);
      ctx.moveTo(40.5, 15);
      ctx.lineTo(42, 14);
      inkOnly(ctx, 1.5);
    }
    ctx.beginPath();
    if (side) {
      ctx.moveTo(34.5, 10.5);
      ctx.lineTo(40, 10.8);
    } else {
      ctx.moveTo(24.5, 11);
      ctx.lineTo(30, 10.5);
      ctx.moveTo(34, 10.5);
      ctx.lineTo(39.5, 11);
    }
    inkOnly(ctx, 1.5);
  }
  // Hair and headphones.
  ctx.beginPath();
  ctx.moveTo(21.5, 12);
  ctx.quadraticCurveTo(21, 5, 27, 4.5);
  ctx.lineTo(28.5, 2.5);
  ctx.lineTo(31, 4.2);
  ctx.lineTo(33.5, 1.8);
  ctx.lineTo(35.5, 4.2);
  ctx.lineTo(38, 3);
  ctx.quadraticCurveTo(43, 5, 42.5, 12);
  ctx.quadraticCurveTo(39, 8.5, 32, 8.5);
  ctx.quadraticCurveTo(25, 8.5, 21.5, 12);
  ctx.closePath();
  fillStroke(ctx, HAIR);
  if (back) {
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.quadraticCurveTo(32, 19, 42, 12);
    ctx.lineTo(42, 15);
    ctx.quadraticCurveTo(32, 22, 22, 15);
    ctx.closePath();
    fillStroke(ctx, HAIR);
  }
  ctx.beginPath();
  ctx.arc(32, 13, 11.5, Math.PI * 1.08, Math.PI * 1.92);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = HOOD;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const cup = (x: number) => {
    roundRect(ctx, x - 2.6, 12, 5.2, 7, 2);
    fillStroke(ctx, HOOD_SH, 1.6);
    roundRect(ctx, x - 1.4, 13.5, 2.8, 4, 1);
    ctx.fillStyle = c.suit;
    ctx.fill();
  };
  if (side) cup(26);
  else {
    cup(21.5);
    cup(42.5);
  }
  ctx.restore();
}
