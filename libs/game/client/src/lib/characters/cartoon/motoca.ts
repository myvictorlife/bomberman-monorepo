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

const SKIN = '#c98a5e';
const SKIN_SH = '#a66a42';
const JACKET = '#23262e';
const JACKET_SH = '#121419';
const HELM = '#d8302e';
const HELM_SH = '#9a1f1e';
const JEANS = '#2f3b57';
const JEANS_SH = '#1f2839';
const SOCK = '#f4f2ea';
const SOCK_SH = '#cfccbf';
const SANDAL = '#2a2a2a';
const BAG = '#2b2f3a';
const BAG_SH = '#171a22';

/**
 * Zé Motoca, the delivery rider: open-face helmet with the visor up and a team
 * stripe, black jacket with reflective bands, the thermal bag on his back,
 * jeans, socks and sandals. Phone in one hand, thumbs up with the other.
 */
export function paintMotoca(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame !== 0;
  const step = stepOf(o.frame);
  const seated = !!o.seated;
  const bob = seated ? 0 : walking ? -1.2 : Math.sin((t * TAU) / 2.2) * 0.4;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: jeans, socks and sandals ──
  const sandalAt = (x: number, by: number, fwd: number, rot = 0) => {
    const sock: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, -4);
      ctx.lineTo(5 + fwd, 2.5);
      ctx.quadraticCurveTo(0, 4.5, -4.5 + fwd * 0.3, 2.5);
      ctx.closePath();
      ctx.restore();
    };
    sock();
    fillStroke(ctx, SOCK);
    shadeRight(ctx, sock, SOCK_SH, 1.4, 0.6);
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-4.5, 1.5);
    ctx.lineTo(5 + fwd, 1.5);
    ctx.moveTo(-1, -1.5);
    ctx.lineTo(2.5, 2);
    ctx.moveTo(2.5, -1.5);
    ctx.lineTo(-1, 2);
    ctx.restore();
    ctx.strokeStyle = SANDAL;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () =>
      roundRect(ctx, x - 3.2, 42, 6.4, 11 - lift * 0.5, 2.2);
    p();
    fillStroke(ctx, JEANS);
    shadeRight(ctx, p, JEANS_SH, 1.4, 0);
    sandalAt(x, 55 - lift, fwd);
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
      sandalAt(hx + dir * 3.5, 51, 0, dir * 0.35);
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

  // ── delivery bag ──
  const bag = (x: number, y: number, w: number, hgt: number) => {
    const p: Path = () => roundRect(ctx, x, y, w, hgt, 2.5);
    p();
    fillStroke(ctx, BAG);
    shadeRight(ctx, p, BAG_SH, 1.6, 1.2);
    roundRect(ctx, x + 1.5, y + 2, w - 3, 2.2, 1);
    ctx.fillStyle = c.suit;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 6);
    ctx.lineTo(x + w - 1, y + 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const cx = x + w / 2;
    const cy = y + hgt / 2 + 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      const b = a + TAU / 10;
      ctx.lineTo(cx + Math.cos(a) * 3.2, cy + Math.sin(a) * 3.2);
      ctx.lineTo(cx + Math.cos(b) * 1.4, cy + Math.sin(b) * 1.4);
    }
    ctx.closePath();
    ctx.fillStyle = c.suitLight;
    ctx.fill();
  };
  if (side) bag(13, 24, 11, 15);
  else if (!back) {
    roundRect(ctx, 19, 23, 26, 6, 2);
    fillStroke(ctx, BAG);
  }

  // ── jacket ──
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
  fillStroke(ctx, JACKET);
  shadeRight(ctx, torsoPath, JACKET_SH);
  if (back) {
    bag(22, 25, 20, 17);
    ctx.strokeStyle = BAG_SH;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(24, 23);
    ctx.lineTo(25, 30);
    ctx.moveTo(40, 23);
    ctx.lineTo(39, 30);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(side ? 37 : 32, 24);
    ctx.lineTo(side ? 37 : 32, hem - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    roundRect(ctx, side ? 25 : 20, 31, side ? 16 : 24, 3.2, 1);
    ctx.fillStyle = c.suit;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side ? 26 : 21, 32.6);
    ctx.lineTo(side ? 40 : 43, 32.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.strokeStyle = BAG_SH;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (side) {
      ctx.moveTo(28, 23);
      ctx.lineTo(27, 31);
    } else {
      ctx.moveTo(24, 23);
      ctx.lineTo(25, 30);
      ctx.moveTo(40, 23);
      ctx.lineTo(39, 30);
    }
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
    ctx.strokeStyle = JACKET;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    const ux = ex + (hx - ex) * 0.6;
    const uy = ey + (hy - ey) * 0.6;
    ctx.beginPath();
    ctx.moveTo(ux - 2.2, uy);
    ctx.lineTo(ux + 2.2, uy);
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.9);
      fillStroke(ctx, SKIN, 1.6);
    }
  };
  const phone = (x: number, y: number) => {
    roundRect(ctx, x - 2.6, y - 4.2, 5.2, 8.4, 1);
    fillStroke(ctx, '#1a1c22', 1.5);
    roundRect(ctx, x - 1.9, y - 3.4, 3.8, 6.6, 0.6);
    ctx.fillStyle = c.glow;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, x, y - 1, 0.9);
    ctx.fillStyle = INK;
    ctx.fill();
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
    phone(44 + sw * 0.5, 30);
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 38 + step * 2, 18, 31);
    sleeve(42, 25, 47 - step * 1.5, 38 - step * 2, 46, 31);
    phone(47, 30);
  } else {
    sleeve(22, 25, 17, 33, 15.5, 29);
    roundRect(ctx, 14.3, 23.5, 2.4, 4, 1.2);
    fillStroke(ctx, SKIN, 1.3);
    sleeve(42, 25, 46, 34, 46.5, 29);
    phone(46.5, 27);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN);
  shadeRight(ctx, head, SKIN_SH, 1.8, 1.2);
  if (!back) {
    const eye = (x: number, y: number) => {
      const h = 2.4 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.lineTo(x + 1.8, y);
        inkOnly(ctx, 1.6);
        return;
      }
      ellipse(ctx, x, y, 1.6, h);
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x - 0.5, y - 0.9, 0.55);
      ctx.fillStyle = '#fff';
      ctx.fill();
    };
    if (side) {
      eye(37, 16.5);
      ctx.beginPath();
      ctx.moveTo(34, 13);
      ctx.lineTo(39.5, 12.6);
      inkOnly(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.5);
      ctx.quadraticCurveTo(44, 17.5, 41.5, 19);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(36.5, 21.5);
      ctx.quadraticCurveTo(39, 23, 41, 21);
      inkOnly(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(37, 20);
      ctx.lineTo(41, 19.6);
      inkOnly(ctx, 1.2);
    } else {
      eye(28, 16.5);
      eye(36, 16.5);
      ctx.beginPath();
      ctx.moveTo(25, 13);
      ctx.lineTo(30.5, 12.5);
      ctx.moveTo(33.5, 12.5);
      ctx.lineTo(39, 13);
      inkOnly(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(27.5, 21);
      ctx.quadraticCurveTo(32, 24.5, 36.5, 21);
      inkOnly(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(28.5, 20);
      ctx.quadraticCurveTo(32, 18.8, 35.5, 20);
      inkOnly(ctx, 1.3);
    }
  }
  // ── open-face helmet ──
  const shell: Path = () => {
    ctx.beginPath();
    ctx.moveTo(20.5, 14);
    ctx.quadraticCurveTo(20, 1.5, 32, 1.5);
    ctx.quadraticCurveTo(44, 1.5, 43.5, 14);
    ctx.lineTo(43.5, 17);
    ctx.quadraticCurveTo(41, 17.5, 40.5, 14.5);
    ctx.quadraticCurveTo(32, 12, 23.5, 14.5);
    ctx.quadraticCurveTo(23, 17.5, 20.5, 17);
    ctx.closePath();
  };
  shell();
  fillStroke(ctx, HELM);
  shadeRight(ctx, shell, HELM_SH, 1.8, 1.4);
  ctx.beginPath();
  if (side) {
    ctx.moveTo(23, 8);
    ctx.quadraticCurveTo(32, 1, 41, 7);
  } else {
    ctx.moveTo(32, 1.5);
    ctx.lineTo(32, back ? 13 : 12.5);
  }
  ctx.strokeStyle = c.suit;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  if (!back) {
    roundRect(ctx, side ? 26 : 21.5, 8.5, side ? 20 : 21, 4.5, 2);
    ctx.fillStyle = c.glow;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side ? 28 : 23.5, 10);
    ctx.lineTo(side ? 38 : 33, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    if (side) {
      ctx.moveTo(23, 16);
      ctx.quadraticCurveTo(26, 25, 34, 25.5);
    } else {
      ctx.moveTo(22, 16);
      ctx.quadraticCurveTo(24, 26, 32, 26.5);
      ctx.quadraticCurveTo(40, 26, 42, 16);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    circle(ctx, side ? 34 : 32, side ? 25.5 : 26.5, 1.1);
    ctx.fillStyle = '#9aa0ad';
    ctx.fill();
  }
  ellipse(ctx, 26, 6, 4, 1.8, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
