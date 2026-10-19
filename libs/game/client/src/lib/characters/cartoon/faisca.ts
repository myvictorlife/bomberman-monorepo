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

const SKIN = '#d9a06b';
const SKIN_SH = '#b97d4e';
const HAIR = '#2b1d16';
const SHIRT = '#f1e9d2';
const SHIRT_SH = '#cfc3a4';
const SHORTS = '#5b5a3c';
const SHORTS_SH = '#3f3e29';
const BOOT = '#6b3f23';
const BOOT_SH = '#4a2a16';
const BOOT_TOP = '#8d5a33';
const GLOVE = '#2f2a28';

/**
 * Faísca, the sapper and the default character: bandana and sash in the team
 * colour, goggles pushed up, sleeveless shirt, shorts, work boots, fingerless
 * gloves and a charge pouch on the hip. Hands on hips when standing.
 */
export function paintFaisca(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame !== 0;
  const step = stepOf(o.frame);
  const seated = !!o.seated;
  const bob = seated ? 0 : walking ? -1.2 : Math.sin((t * TAU) / 2.6) * 0.4;
  beginFrame(ctx, o.facing);

  // ── legs and boots ──
  const bootAt = (x: number, by: number, fwd: number, rot = 0) => {
    const bootPath: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.5, -4);
      ctx.lineTo(4.5, -4);
      ctx.lineTo(5 + fwd, 3);
      ctx.quadraticCurveTo(0, 4.5, -5 + fwd * 0.3, 3);
      ctx.closePath();
      ctx.restore();
    };
    bootPath();
    fillStroke(ctx, BOOT);
    shadeRight(ctx, bootPath, BOOT_SH, 1.6, 0.6);
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    roundRect(ctx, -5, -5, 10, 2.6, 1.2);
    ctx.restore();
    fillStroke(ctx, BOOT_TOP, 1.4);
  };
  const legBoot = (x: number, lift: number, fwd: number) => {
    const legPath: Path = () =>
      roundRect(ctx, x - 3, 42, 6, 11 - lift * 0.5, 2.5);
    legPath();
    fillStroke(ctx, SKIN);
    shadeRight(ctx, legPath, SKIN_SH, 1.4, 0);
    bootAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hangLeg = (hx: number, dir: number) => {
      const legPath: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3, 0, 6, 9, 2.5);
        ctx.restore();
      };
      legPath();
      fillStroke(ctx, SKIN);
      shadeRight(ctx, legPath, SKIN_SH, 1.4, 0);
      bootAt(hx + dir * 3.5, 51, 0, dir * 0.35);
    };
    if (side) hangLeg(33, 0.4);
    else {
      hangLeg(25, -1);
      hangLeg(39, 1);
    }
  } else if (side) {
    legBoot(29 - step * 4, step === 1 ? 2 : 0, step === 1 ? 2 : 0);
    legBoot(35 + step * 4, step === -1 ? 2 : 0, step === -1 ? 2 : 0);
  } else {
    legBoot(26.5, step === 1 ? 2.5 : 0, 0);
    legBoot(37.5, step === -1 ? 2.5 : 0, 0);
  }

  ctx.translate(0, bob);

  // ── shorts ──
  const shortsPath: Path = () => {
    ctx.beginPath();
    if (seated) {
      if (side) {
        ctx.moveTo(24, 36);
        ctx.lineTo(41, 36);
        ctx.lineTo(42, 43);
        ctx.lineTo(23, 43);
      } else {
        ctx.moveTo(21, 36);
        ctx.lineTo(43, 36);
        ctx.lineTo(45, 43);
        ctx.lineTo(19, 43);
      }
    } else if (side) {
      ctx.moveTo(24, 36);
      ctx.lineTo(41, 36);
      ctx.lineTo(42, 45);
      ctx.lineTo(33, 46);
      ctx.lineTo(32, 42);
      ctx.lineTo(31, 46);
      ctx.lineTo(22, 45);
    } else {
      ctx.moveTo(21, 36);
      ctx.lineTo(43, 36);
      ctx.lineTo(44, 45);
      ctx.lineTo(33.5, 46);
      ctx.lineTo(32, 42);
      ctx.lineTo(30.5, 46);
      ctx.lineTo(20, 45);
    }
    ctx.closePath();
  };
  shortsPath();
  fillStroke(ctx, SHORTS);
  shadeRight(ctx, shortsPath, SHORTS_SH);

  // ── torso: sleeveless shirt ──
  const torsoPath: Path = () => {
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
  torsoPath();
  fillStroke(ctx, SHIRT);
  shadeRight(ctx, torsoPath, SHIRT_SH);
  // Sash in the team colour, with a knot on the hip.
  const sashPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(23, 33);
      ctx.lineTo(42, 33);
      ctx.lineTo(42, 37.5);
      ctx.lineTo(23, 37.5);
    } else {
      ctx.moveTo(19.5, 33);
      ctx.lineTo(44.5, 33);
      ctx.lineTo(44.5, 37.5);
      ctx.lineTo(19.5, 37.5);
    }
    ctx.closePath();
  };
  sashPath();
  fillStroke(ctx, c.suit);
  shadeRight(ctx, sashPath, c.suitDark, 1.4, 1);
  if (!back) {
    const kx = side ? 24 : 21.5;
    circle(ctx, kx, 35.5, 2.4);
    fillStroke(ctx, c.suitLight, 1.5);
    ctx.beginPath();
    ctx.moveTo(kx - 1, 37);
    ctx.quadraticCurveTo(kx - 4, 42, kx - 2, 46);
    ctx.lineTo(kx + 1.5, 44);
    ctx.quadraticCurveTo(kx, 40, kx + 1, 37.5);
    ctx.closePath();
    fillStroke(ctx, c.suit, 1.5);
    // Charge pouch on the right hip.
    const px = side ? 38 : 40;
    roundRect(ctx, px - 3, 36, 6.5, 6, 1.5);
    fillStroke(ctx, GLOVE, 1.5);
    roundRect(ctx, px - 3, 36, 6.5, 2, 1);
    fillStroke(ctx, '#4a423e', 1);
  } else {
    ctx.beginPath();
    ctx.moveTo(32, 35);
    ctx.lineTo(26, 31);
    ctx.lineTo(27, 36);
    ctx.closePath();
    fillStroke(ctx, c.suitLight, 1.5);
    ctx.beginPath();
    ctx.moveTo(32, 35);
    ctx.lineTo(38, 31);
    ctx.lineTo(37, 36);
    ctx.closePath();
    fillStroke(ctx, c.suitLight, 1.5);
    ctx.beginPath();
    ctx.moveTo(30, 36);
    ctx.quadraticCurveTo(27, 42, 29, 47);
    ctx.lineTo(32, 45);
    ctx.lineTo(31, 37);
    ctx.closePath();
    fillStroke(ctx, c.suit, 1.5);
    circle(ctx, 32, 35.5, 2.4);
    fillStroke(ctx, c.suitLight, 1.5);
  }

  // ── arms: hands on hips when standing, swinging when walking ──
  const arm = (
    sx: number,
    sy: number,
    hx: number,
    hy: number,
    ex: number,
    ey: number,
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
    circle(ctx, hx, hy, 3.2);
    fillStroke(ctx, GLOVE, 1.6);
    roundRect(ctx, hx - 2.4, hy - 3.6, 4.8, 2.2, 1);
    fillStroke(ctx, SKIN, 1.2);
  };
  if (seated) {
    if (side) arm(37, 25, 44, 33, 42, 29);
    else {
      arm(22, 25, 26, 34, 18, 31);
      arm(42, 25, 38, 34, 46, 31);
    }
  } else if (side) {
    const sw = walking ? step * 5 : 0;
    arm(37, 25, 40 + sw, 36, 43 + sw * 0.5, 31);
  } else if (walking) {
    arm(22, 25, 17 + step * 1.5, 38 + step * 2, 18, 31);
    arm(42, 25, 47 - step * 1.5, 38 - step * 2, 46, 31);
  } else {
    arm(22, 25, 21, 35, 14.5, 30);
    arm(42, 25, 43, 35, 49.5, 30);
  }

  // ── head ──
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN);
  shadeRight(ctx, head, SKIN_SH, 1.8, 1.2);
  if (side) {
    ctx.beginPath();
    ctx.ellipse(26, 15, 2.2, 3, 0, 0, TAU);
    fillStroke(ctx, SKIN, 1.4);
  } else if (!back) {
    for (const x of [21.5, 42.5]) {
      ctx.beginPath();
      ctx.ellipse(x, 15, 1.8, 2.8, 0, 0, TAU);
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
      ctx.beginPath();
      ctx.ellipse(x, y, 1.7, h, 0, 0, TAU);
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x - 0.5, y - 0.9, 0.55);
      ctx.fillStyle = '#fff';
      ctx.fill();
    };
    if (side) {
      eye(37, 16);
      ctx.beginPath();
      ctx.moveTo(34, 12.5);
      ctx.lineTo(39.5, 12);
      inkOnly(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.5);
      ctx.quadraticCurveTo(44, 17.5, 41.5, 19);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(37, 21);
      ctx.lineTo(40.5, 21.5);
      inkOnly(ctx, 1.4);
    } else {
      eye(28, 16);
      eye(36, 16);
      ctx.beginPath();
      ctx.moveTo(25, 12.5);
      ctx.lineTo(30.5, 12);
      ctx.moveTo(33.5, 12);
      ctx.lineTo(39, 12.8);
      inkOnly(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(29, 21);
      ctx.quadraticCurveTo(33, 23, 36.5, 20.5);
      inkOnly(ctx, 1.4);
      roundRect(ctx, 37.5, 18, 4, 1.6, 0.6);
      fillStroke(ctx, '#e8d9c0', 1);
    }
  }

  // ── hair, bandana, goggles ──
  ctx.beginPath();
  ctx.moveTo(21.5, 11);
  ctx.lineTo(23, 6.5);
  ctx.lineTo(26, 8);
  ctx.lineTo(28, 3);
  ctx.lineTo(31, 6);
  ctx.lineTo(34, 2.5);
  ctx.lineTo(36, 6);
  ctx.lineTo(39, 4);
  ctx.lineTo(40.5, 8);
  ctx.lineTo(42.5, 11);
  ctx.quadraticCurveTo(32, 8, 21.5, 11);
  ctx.closePath();
  fillStroke(ctx, HAIR);
  if (back) {
    ctx.beginPath();
    ctx.moveTo(22, 11);
    ctx.quadraticCurveTo(32, 20, 42, 11);
    ctx.lineTo(42, 14);
    ctx.quadraticCurveTo(32, 23, 22, 14);
    ctx.closePath();
    fillStroke(ctx, HAIR);
  }
  const bandPath: Path = () => roundRect(ctx, 21, 9.5, 22, 4.2, 1.5);
  bandPath();
  fillStroke(ctx, c.suit);
  shadeRight(ctx, bandPath, c.suitDark, 1.2, 1);
  const tail = (x: number, y: number, dir: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5 * dir, y + 1, x + 7 * dir, y + 6);
    ctx.lineTo(x + 4 * dir, y + 5);
    ctx.quadraticCurveTo(x + 3 * dir, y + 3, x, y + 3);
    ctx.closePath();
    fillStroke(ctx, c.suit, 1.5);
  };
  if (back) {
    tail(32, 10, -1);
    tail(32, 10, 1);
  } else if (side) tail(23, 10, -1);
  else tail(21.5, 10, -1);
  if (!back) {
    const gx = side ? [35.5] : [27.5, 36.5];
    ctx.beginPath();
    ctx.moveTo(side ? 30 : 22, 8.5);
    ctx.lineTo(side ? 41 : 42, 8.5);
    inkOnly(ctx, 2.2);
    for (const x of gx) {
      circle(ctx, x, 8.3, 3.2);
      fillStroke(ctx, '#3a3330', 1.6);
      circle(ctx, x, 8.3, 1.9);
      ctx.fillStyle = c.glow;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      circle(ctx, x - 0.6, 7.6, 0.6);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  } else {
    roundRect(ctx, 24, 6.5, 16, 3, 1.5);
    fillStroke(ctx, '#3a3330', 1.6);
  }
  ctx.restore();
}
