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
  RIDER_SCALE,
  roundRect,
  shadeRight,
  stepOf,
  TAU,
  teamFor,
} from './ink';

const FUR = '#f3e9d6';
const FUR_SH = '#cdbfa3';
const PATCH = '#a4683b';
const PATCH_SH = '#7c4b27';
const NOSE = '#1c1511';
const TONGUE = '#e8697a';
const CASK = '#8a5a34';
const CASK_SH = '#5f3c21';

interface Patch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  r?: number;
}

/** Bernardo, a Saint Bernard rescue dog with the first-aid cask. Always wagging. */
export function paintBernardo(
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
  const breath = walking ? 0 : Math.sin((t * TAU) / 2.6) * 0.5;
  const wag = Math.sin((t * TAU) / 0.6) * (walking ? 0.5 : 0.35);
  beginFrame(ctx, o.facing);

  const leg = (x: number, y: number, lift: number, patch: boolean) => {
    const p: Path = () => roundRect(ctx, x - 3.2, y - 9 - lift, 6.4, 9.5, 2.6);
    p();
    fillStroke(ctx, patch ? PATCH : FUR);
    shadeRight(ctx, p, patch ? PATCH_SH : FUR_SH, 1.2, 0);
    ellipse(ctx, x, y - lift, 4, 2.2);
    fillStroke(ctx, FUR, 1.6);
    ctx.fillStyle = INK;
    for (const dx of [-2, 0, 2]) {
      circle(ctx, x + dx, y - lift - 0.8, 0.5);
      ctx.fill();
    }
  };
  const body = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    patches: Patch[],
  ) => {
    const p: Path = () => ellipse(ctx, cx, cy, rx, ry);
    p();
    fillStroke(ctx, FUR);
    shadeRight(ctx, p, FUR_SH, 2.2, 1.8);
    ctx.save();
    p();
    ctx.clip();
    for (const q of patches) {
      ellipse(ctx, q.x, q.y, q.rx, q.ry, q.r ?? 0);
      ctx.fillStyle = PATCH;
      ctx.fill();
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
  const cask = (x: number, y: number, w: number, h: number) => {
    const p: Path = () => roundRect(ctx, x - w / 2, y - h / 2, w, h, 2);
    p();
    fillStroke(ctx, CASK, 1.6);
    shadeRight(ctx, p, CASK_SH, 1.2, 0.8);
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 1;
    for (const k of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(x + w * k, y - h / 2 + 0.5);
      ctx.lineTo(x + w * k, y + h / 2 - 0.5);
      ctx.stroke();
    }
    roundRect(ctx, x - 2.4, y - 2.4, 4.8, 4.8, 0.8);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = c.suit;
    ctx.fillRect(x - 0.7, y - 1.8, 1.4, 3.6);
    ctx.fillRect(x - 1.8, y - 0.7, 3.6, 1.4);
  };
  const eye = (x: number, y: number) => {
    const h = 1.9 * (1 - blink);
    if (h < 0.3) {
      ctx.beginPath();
      ctx.moveTo(x - 1.5, y);
      ctx.lineTo(x + 1.5, y);
      inkOnly(ctx, 1.5);
      return;
    }
    ellipse(ctx, x, y, 1.6, h);
    ctx.fillStyle = INK;
    ctx.fill();
    circle(ctx, x - 0.5, y - 0.6, 0.55);
    ctx.fillStyle = '#fff';
    ctx.fill();
  };
  const ear = (x: number, y: number, dir: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 4 * dir, y + 1, x + 3.5 * dir, y + 8);
      ctx.quadraticCurveTo(x + 1.5 * dir, y + 10, x - 0.5 * dir, y + 8);
      ctx.quadraticCurveTo(x - 1.5 * dir, y + 4, x, y);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, PATCH);
    shadeRight(ctx, p, PATCH_SH, 1.2, 1);
  };
  const headFront = (cx: number, cy: number) => {
    ear(cx - 7, cy - 4, -1);
    ear(cx + 7, cy - 4, 1);
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 5);
      ctx.quadraticCurveTo(cx, cy - 9, cx + 8, cy - 5);
      ctx.quadraticCurveTo(cx + 8.5, cy + 4, cx, cy + 7);
      ctx.quadraticCurveTo(cx - 8.5, cy + 4, cx - 8, cy - 5);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, FUR);
    shadeRight(ctx, p, FUR_SH, 1.6, 1.2);
    ctx.save();
    p();
    ctx.clip();
    ctx.fillStyle = PATCH;
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 2.5, 4.5, 4, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 2.5, 4.5, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    eye(cx - 3.2, cy - 2);
    eye(cx + 3.2, cy - 2);
    ellipse(ctx, cx, cy + 3, 4.5, 3.2);
    fillStroke(ctx, FUR, 1.4);
    const ty = cy + 8.5 + breath * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - 1.8, cy + 4.5);
    ctx.lineTo(cx + 1.8, cy + 4.5);
    ctx.quadraticCurveTo(cx + 1.8, ty, cx, ty);
    ctx.quadraticCurveTo(cx - 1.8, ty, cx - 1.8, cy + 4.5);
    ctx.closePath();
    fillStroke(ctx, TONGUE, 1.4);
    ellipse(ctx, cx, cy + 1.6, 2.2, 1.5);
    ctx.fillStyle = NOSE;
    ctx.fill();
    circle(ctx, cx - 0.7, cy + 1.1, 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  };
  const headSide = (cx: number, cy: number) => {
    ear(cx - 4, cy - 5, -1);
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 5);
      ctx.quadraticCurveTo(cx, cy - 9, cx + 6, cy - 4);
      ctx.lineTo(cx + 10, cy + 1);
      ctx.quadraticCurveTo(cx + 9, cy + 5, cx + 4, cy + 5.5);
      ctx.quadraticCurveTo(cx - 6, cy + 5, cx - 7, cy - 5);
      ctx.closePath();
    };
    p();
    fillStroke(ctx, FUR);
    shadeRight(ctx, p, FUR_SH, 1.6, 1.2);
    ctx.save();
    p();
    ctx.clip();
    ctx.fillStyle = PATCH;
    ctx.beginPath();
    ctx.ellipse(cx - 1, cy - 2.5, 5, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    eye(cx + 1.5, cy - 2);
    const ty = cy + 7 + breath * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy + 3);
    ctx.lineTo(cx + 8, cy + 3.5);
    ctx.quadraticCurveTo(cx + 8, ty, cx + 6, ty);
    ctx.quadraticCurveTo(cx + 4.5, cy + 6, cx + 5, cy + 3);
    ctx.closePath();
    fillStroke(ctx, TONGUE, 1.4);
    ellipse(ctx, cx + 9.5, cy + 0.5, 1.8, 1.4);
    ctx.fillStyle = NOSE;
    ctx.fill();
  };
  const tail = (x: number, y: number, dir: number, up: number) => {
    const p: Path = () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x - 6 * dir,
        y - 2 + wag * 3,
        x - 8 * dir,
        y - 9 * up + wag * 4,
      );
      ctx.quadraticCurveTo(
        x - 4 * dir,
        y - 4 * up + wag * 3,
        x + 1 * dir,
        y - 3,
      );
      ctx.closePath();
    };
    p();
    fillStroke(ctx, FUR);
    ctx.save();
    p();
    ctx.clip();
    circle(ctx, x - 7 * dir, y - 7 * up + wag * 4, 3);
    ctx.fillStyle = PATCH;
    ctx.fill();
    ctx.restore();
  };
  const riderAt = (hx: number, hy: number) => {
    if (!withRider) return;
    // Smaller than on foot, so the dog is the hero and the rider sits in the saddle.
    const k = RIDER_SCALE;
    ctx.save();
    ctx.translate(hx - 32 * k, hy - 38 * k);
    ctx.scale(k, k);
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
  // A bigger head than the body's scale: it is what you read first.
  const scaled = (cx: number, cy: number, s: number, draw: () => void) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    draw();
    ctx.restore();
  };

  ctx.translate(0, breath * 0.3 + (walking ? -0.8 : 0));
  if (side) {
    tail(13, 40, 1, 1);
    leg(20, 58, step === 1 ? 2 : 0, true);
    leg(40, 58, step === -1 ? 2 : 0, false);
    body(30, 45, 20, 12 + breath * 0.3, [
      { x: 17, y: 42, rx: 9, ry: 8 },
      { x: 37, y: 51, rx: 8, ry: 5, r: 0.4 },
    ]);
    saddle(26, 34, 8.5, 3.2);
    riderAt(26, 34);
    leg(26, 60, step === -1 ? 2 : 0, false);
    leg(44, 60, step === 1 ? 2 : 0, true);
    // Neck, collar and the cask hanging from it.
    const neck: Path = () => roundRect(ctx, 40, 29, 13, 18, 5.5);
    neck();
    fillStroke(ctx, FUR);
    shadeRight(ctx, neck, FUR_SH, 1.4, 1);
    ctx.beginPath();
    ctx.moveTo(41, 44);
    ctx.lineTo(53, 44);
    ctx.strokeStyle = c.suitDark;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    cask(47, 49, 8, 6.5);
    scaled(48, 31 + (walking ? step * 0.8 : 0), 1.3, () => headSide(0, 0));
  } else if (back) {
    // Only the crown and the ears show past the rider's back.
    scaled(32, 27, 1.3, () => {
      ellipse(ctx, 0, 2, 11, 5);
      fillStroke(ctx, FUR);
      ctx.save();
      ellipse(ctx, 0, 2, 11, 5);
      ctx.clip();
      ctx.fillStyle = PATCH;
      ctx.fillRect(-13, -3, 8, 10);
      ctx.fillRect(5, -3, 8, 10);
      ctx.restore();
      ear(-10, 0, -1);
      ear(10, 0, 1);
    });
    leg(19, 59, step === 1 ? 2 : 0, true);
    leg(45, 59, step === -1 ? 2 : 0, false);
    body(32, 45, 18, 13 + breath * 0.3, [
      { x: 21, y: 41, rx: 8, ry: 7 },
      { x: 42, y: 50, rx: 7, ry: 5 },
    ]);
    saddle(32, 33, 9, 3.4);
    riderAt(32, 33);
    ctx.beginPath();
    ctx.moveTo(29, 53);
    ctx.lineTo(35, 53);
    ctx.quadraticCurveTo(36 + wag * 3, 59, 32 + wag * 5, 63);
    ctx.quadraticCurveTo(28 + wag * 3, 59, 29, 53);
    ctx.closePath();
    fillStroke(ctx, FUR);
  } else {
    leg(19, 58, step === 1 ? 2 : 0, true);
    leg(45, 58, step === -1 ? 2 : 0, false);
    body(32, 44, 17, 13.5 + breath * 0.3, [
      { x: 20, y: 42, rx: 8, ry: 7 },
      { x: 44, y: 50, rx: 7, ry: 5 },
    ]);
    saddle(32, 32, 9, 3.4);
    riderAt(32, 32);
    leg(23, 60.5, step === -1 ? 1.5 : 0, false);
    leg(41, 60.5, step === 1 ? 1.5 : 0, true);
    scaled(32, 50, 1.3, () => headFront(0, 0));
    cask(32, 59.5, 8, 5);
  }
  ctx.restore();
}
