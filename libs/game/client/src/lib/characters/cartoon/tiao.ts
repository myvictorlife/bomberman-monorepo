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
  volume,
  lineOf,
} from './ink';

const SKIN = '#d8a07a';
const SKIN_LINE = lineOf(SKIN);
const SHIRT = '#2c4170';
const SHIRT_SH = '#1b2a4b';
const PANTS = '#25365c';
const BOOT = '#5b3a22';
const BOOT_SH = '#3b2414';
const BELT = '#8a5a2b';
const BELT_SH = '#5e3c1b';
const POUCH = '#e0b23a';
const HAT = '#f2f1ea';
const MOUSTACHE = '#6b5a4a';
const PLIERS = '#d23b33';

/**
 * Tião, the electrician who runs the Substation: white hard hat with a brim
 * and a team stripe, a grey moustache, navy work shirt with a reflective band,
 * a tool belt with a yellow pouch, work boots, and pliers in hand.
 */
export function paintTiao(ctx: Ctx, o: CharacterPose): void {
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

  // ── legs: work trousers and boots ──
  const bootAt = (x: number, by: number, fwd: number, rot = 0) => {
    const boot: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, -4);
      ctx.lineTo(5.5 + fwd, 1.5);
      ctx.quadraticCurveTo(5.5 + fwd, 4, 2 + fwd, 4);
      ctx.lineTo(-4.5, 4);
      ctx.closePath();
      ctx.restore();
    };
    boot();
    fillStroke(ctx, BOOT, 1.7, lineOf(BOOT));
    volume(ctx, boot, BOOT, 1.01, 1.4);
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-4.5, 2.6);
    ctx.lineTo(5 + fwd, 2.6);
    ctx.restore();
    ctx.strokeStyle = BOOT_SH;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () =>
      roundRect(ctx, x - 3.4, 42, 6.8, 10.5 - lift * 0.5, 2.2);
    p();
    fillStroke(ctx, PANTS, 1.7, lineOf(PANTS));
    volume(ctx, p, PANTS, 1.01, 1.4);
    bootAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3.4, 0, 6.8, 9, 2.2);
        ctx.restore();
      };
      p();
      fillStroke(ctx, PANTS, 1.7, lineOf(PANTS));
      volume(ctx, p, PANTS, 1.01, 1.4);
      bootAt(hx + dir * 3.5, 51, 0, dir * 0.35);
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

  // ── work shirt ──
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
  fillStroke(ctx, SHIRT, 1.7, lineOf(SHIRT));
  volume(ctx, torsoPath, SHIRT, 1.3, 1.8);

  // Reflective band across the chest, in the team colour.
  roundRect(ctx, side ? 24 : 19.5, 29, side ? 18 : 25, 3.2, 1);
  ctx.fillStyle = c.suit;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(side ? 25 : 20.5, 30.6);
  ctx.lineTo(side ? 41 : 43.5, 30.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  if (!back) {
    // Button placket and a chest pocket with a pen.
    ctx.beginPath();
    ctx.moveTo(side ? 37 : 32, 23);
    ctx.lineTo(side ? 37 : 32, 28.5);
    ctx.moveTo(side ? 37 : 32, 32.5);
    ctx.lineTo(side ? 37 : 32, hem - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    if (!side) {
      roundRect(ctx, 35, 23.5, 6, 4.5, 1);
      ctx.strokeStyle = SHIRT_SH;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(37, 22.5);
      ctx.lineTo(37, 25);
      ctx.strokeStyle = '#e7e7e7';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  // ── tool belt ──
  const beltY = hem - 4.5;
  roundRect(ctx, side ? 22.5 : 18.5, beltY, side ? 20.5 : 27, 3.6, 1.2);
  fillStroke(ctx, BELT, 1.4, lineOf(BELT));
  ctx.beginPath();
  ctx.moveTo(side ? 23 : 19, beltY + 1);
  ctx.lineTo(side ? 42.5 : 45, beltY + 1);
  ctx.strokeStyle = BELT_SH;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (!back) {
    roundRect(ctx, side ? 39 : 30, beltY - 0.4, 4, 4.4, 0.8);
    ctx.strokeStyle = '#cfcfcf';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  const pouch: Path = () =>
    roundRect(ctx, side ? 23 : 19.5, beltY + 2.5, side ? 7 : 7.5, 6.5, 1.8);
  pouch();
  fillStroke(ctx, POUCH, 1.4, lineOf(POUCH));
  shadeRight(ctx, pouch, '#b18a24', 1.2, 0.8);
  // A screwdriver handle sticking out of the pouch.
  roundRect(ctx, side ? 25 : 21.5, beltY - 0.5, 2.2, 4, 0.8);
  ctx.fillStyle = PLIERS;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.stroke();

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
    ctx.strokeStyle = lineOf(SHIRT);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = SHIRT;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    // Rolled-up cuff, forearm showing.
    const ux = ex + (hx - ex) * 0.35;
    const uy = ey + (hy - ey) * 0.35;
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = lineOf(SKIN);
    ctx.lineWidth = 6.6;
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 3.8;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.9);
      fillStroke(ctx, SKIN, 1.6, lineOf(SKIN));
    }
  };
  const pliers = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x - 1.6, y + 4.5);
    ctx.lineTo(x - 0.5, y);
    ctx.moveTo(x + 1.6, y + 4.5);
    ctx.lineTo(x + 0.5, y);
    ctx.strokeStyle = lineOf(PLIERS);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = PLIERS;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 0.4, y);
    ctx.lineTo(x - 0.9, y - 4.2);
    ctx.moveTo(x + 0.4, y);
    ctx.lineTo(x + 0.9, y - 4.2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = '#b9bec8';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };
  if (seated) {
    if (side) sleeve(37, 25, 44, 33, 42, 29);
    else {
      sleeve(22, 25, 26, 34, 18, 31);
      sleeve(42, 25, 38, 34, 46, 31);
    }
  } else if (side) {
    const sw = walking ? step * 5 : 0;
    sleeve(37, 25, 40 + sw, 36, 43 + sw * 0.5, 32);
    pliers(44 + sw * 0.5, 30);
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 38 + step * 2, 18, 32);
    sleeve(42, 25, 47 - step * 1.5, 38 - step * 2, 46, 32);
    pliers(47, 30);
  } else {
    // Hand on the belt, pliers up in the other.
    sleeve(22, 25, 17, 34, 19.5, 38);
    sleeve(42, 25, 47, 33, 46.5, 28);
    pliers(46.5, 25);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN, 1.7, lineOf(SKIN));
  volume(ctx, head, SKIN, 1.3, 1.8);
  if (!back) {
    const eye = (x: number, y: number) => {
      const h = 2.3 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.lineTo(x + 1.8, y);
        inkOnly(ctx, 1.6);
        return;
      }
      ellipse(ctx, x, y, 2.2, h + 0.4);
      fillStroke(ctx, '#ffffff', 0.9, SKIN_LINE);
      ellipse(ctx, x + 0.3, y + 0.4, 1.3, Math.min(2, h * 0.8));
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x - 0.3, y - 0.7, 0.6);
      ctx.fillStyle = '#fff';
      ctx.fill();
    };
    const moustache = (cx: number, w: number) => {
      ctx.beginPath();
      ctx.moveTo(cx - w, 21.2);
      ctx.quadraticCurveTo(cx - w * 0.5, 18.2, cx, 19.6);
      ctx.quadraticCurveTo(cx + w * 0.5, 18.2, cx + w, 21.2);
      ctx.quadraticCurveTo(cx + w * 0.5, 20.4, cx, 21);
      ctx.quadraticCurveTo(cx - w * 0.5, 20.4, cx - w, 21.2);
      ctx.closePath();
      fillStroke(ctx, MOUSTACHE, 1.2, lineOf(MOUSTACHE));
    };
    if (side) {
      eye(37, 16.5);
      ctx.beginPath();
      ctx.moveTo(34, 13.2);
      ctx.lineTo(39.5, 12.8);
      inkOnly(ctx, 1.8);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.5);
      ctx.quadraticCurveTo(44, 17.5, 41.5, 19);
      inkOnly(ctx, 1.5);
      moustache(39.5, 3.4);
      ctx.beginPath();
      ctx.moveTo(37.5, 23);
      ctx.quadraticCurveTo(39.5, 23.8, 41, 22.6);
      inkOnly(ctx, 1.3);
    } else {
      eye(28, 16.5);
      eye(36, 16.5);
      ctx.beginPath();
      ctx.moveTo(25, 13.2);
      ctx.lineTo(30.5, 12.8);
      ctx.moveTo(33.5, 12.8);
      ctx.lineTo(39, 13.2);
      inkOnly(ctx, 1.8);
      moustache(32, 5.2);
      ctx.beginPath();
      ctx.moveTo(29.5, 23.2);
      ctx.quadraticCurveTo(32, 24.6, 34.5, 23.2);
      inkOnly(ctx, 1.3);
    }
  }

  // ── hard hat: dome, brim, team stripe ──
  const dome: Path = () => {
    ctx.beginPath();
    ctx.moveTo(21.5, 12.5);
    ctx.quadraticCurveTo(21, 2, 32, 2);
    ctx.quadraticCurveTo(43, 2, 42.5, 12.5);
    ctx.closePath();
  };
  dome();
  fillStroke(ctx, HAT, 1.7, lineOf(HAT));
  volume(ctx, dome, HAT, 1.3, 1.8);
  const brim: Path = () => {
    if (side) roundRect(ctx, 21, 11, 26, 3.2, 1.6);
    else roundRect(ctx, 18.5, 11, 27, 3.2, 1.6);
  };
  brim();
  fillStroke(ctx, HAT, 1.6, lineOf(HAT));
  volume(ctx, brim, HAT, 0.86, 1.2);
  ctx.beginPath();
  if (side) {
    ctx.moveTo(24, 7);
    ctx.quadraticCurveTo(32, 2.2, 40, 6.5);
  } else {
    ctx.moveTo(32, 2.2);
    ctx.lineTo(32, 11);
  }
  ctx.strokeStyle = c.suit;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  if (!back) {
    // A small lightning-bolt badge on the front of the hat.
    const bx = side ? 37.5 : 26.5;
    ctx.beginPath();
    ctx.moveTo(bx + 1.2, 4.6);
    ctx.lineTo(bx - 0.8, 7.8);
    ctx.lineTo(bx + 0.4, 7.8);
    ctx.lineTo(bx - 0.8, 10.4);
    ctx.lineTo(bx + 1.8, 6.9);
    ctx.lineTo(bx + 0.6, 6.9);
    ctx.closePath();
    ctx.fillStyle = POUCH;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ellipse(ctx, 26.5, 5.5, 3.6, 1.6, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
