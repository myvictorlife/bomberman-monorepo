/**
 * The title screen's opening scene: dusk over the arena, a bomb with a lit
 * fuse on the crates and the Novato beside it. Far layers drift slower than
 * near ones as the page scrolls (the parallax), and the fuse, the clouds and
 * the embers never stop. Pure canvas code, no Angular.
 */

export interface IntroView {
  ctx: CanvasRenderingContext2D;
  /** Size in CSS pixels; the context is already scaled for the screen. */
  w: number;
  h: number;
  /** Seconds, for the ambient motion. */
  t: number;
  /** How far the scene has scrolled up, in CSS pixels, as a negative number. */
  off: number;
  /** The character standing on the crates. */
  hero: CanvasImageSource;
}

/** Below this width the copy sits at the bottom and the art moves up. */
export const NARROW_WIDTH = 760;

const TAU = Math.PI * 2;

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function vgrad(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 1,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws `fn` shifted against the panel's offset: `k` > 0 lags (far), < 0 leads (near). */
function layer(v: IntroView, k: number, fn: () => void): void {
  v.ctx.save();
  v.ctx.translate(0, -v.off * k);
  fn();
  v.ctx.restore();
}

/** A mountain line across the canvas, its base at `base` × height. */
function ridge(
  v: IntroView,
  base: number,
  amp: number,
  seed: number,
  fill: string | CanvasGradient,
  rim?: string,
): void {
  const { ctx, w, h } = v;
  ctx.beginPath();
  ctx.moveTo(-10, h * 2);
  for (let x = -10; x <= w + 10; x += 6) {
    const u = x / Math.max(w, 900);
    const y =
      base * h -
      amp *
        h *
        (0.55 * Math.sin(u * 5.3 + seed) +
          0.3 * Math.sin(u * 11.7 + seed * 2.1) +
          0.15 * Math.sin(u * 23 + seed * 3.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 10, h * 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function stars(v: IntroView, n: number, maxY: number): void {
  const { ctx, w, h, t } = v;
  ctx.fillStyle = '#fff';
  for (let k = 0; k < n; k++) {
    ctx.globalAlpha =
      0.9 * (0.3 + 0.7 * Math.abs(Math.sin(t * (0.6 + hash(k) * 1.4) + k)));
    ctx.fillRect(hash(k * 2.3) * w, hash(k * 4.1) * h * maxY, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
}

/** Sparks rising from the bottom; `area` is the share of the width they use, from the right. */
function embers(
  v: IntroView,
  t: number,
  count: number,
  color: string,
  area = 1,
): void {
  const { ctx, w, h } = v;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < count; k++) {
    const speed = 0.25 + hash(k * 3.1) * 0.6;
    const y = h * 1.05 - ((t * speed * 70 + hash(k) * h * 1.3) % (h * 1.3));
    const x =
      hash(k * 7.7) * w * area + w * (1 - area) + Math.sin(t * 0.8 + k) * 18;
    const r = 1 + hash(k * 1.9) * 2.2;
    const a =
      Math.min(1, (h * 1.05 - y) / (h * 0.3)) * (0.4 + 0.6 * hash(k * 5.3));
    glow(ctx, x, y, r * 5, color, a * 0.55);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A character sprite standing with its feet at (x, y), `size` tall, with a contact shadow. */
function figure(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
): void {
  ctx.fillStyle = 'rgba(8,4,24,.4)';
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.04, size * 0.3, size * 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.drawImage(image, x - size / 2, y - size, size, size);
}

function bomb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
): void {
  ctx.fillStyle = 'rgba(14,8,30,.5)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.1, y + r * 0.96, r * 0.95, r * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x + r * 0.45, y - r * 0.78);
  ctx.rotate(0.55);
  rrect(ctx, -r * 0.2, -r * 0.17, r * 0.4, r * 0.3, r * 0.06);
  ctx.fillStyle = vgrad(ctx, -r * 0.17, r * 0.13, [
    [0, '#6c6888'],
    [1, '#2a2640'],
  ]);
  ctx.fill();
  ctx.restore();
  const body = ctx.createRadialGradient(
    x - r * 0.38,
    y - r * 0.42,
    r * 0.08,
    x,
    y,
    r,
  );
  body.addColorStop(0, '#6a6890');
  body.addColorStop(0.42, '#2c2846');
  body.addColorStop(1, '#0f0c1e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // The sunset catches the right side.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.lineWidth = r * 0.09;
  ctx.strokeStyle = '#ffad6b';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(x - r * 0.05, y + r * 0.02, r * 0.98, -1.2, 1.0);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.26, r * 0.14, -0.7, 0, TAU);
  ctx.fill();
  // The fuse, swaying, and its spark.
  const ex = x + r * 1.05 + Math.sin(t * 2.2) * r * 0.04;
  const ey = y - r * 1.55;
  ctx.strokeStyle = '#d9c3a0';
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.55, y - r * 0.95);
  ctx.bezierCurveTo(
    x + r * 0.75,
    y - r * 1.35,
    x + r * 1.15,
    y - r * 1.2,
    ex,
    ey,
  );
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flicker = 0.8 + 0.2 * Math.sin(t * 31) + 0.1 * Math.sin(t * 17);
  glow(ctx, ex, ey, r * 0.9 * flicker, 'rgba(255,170,70,.9)', 0.9);
  glow(ctx, ex, ey, r * 0.28 * flicker, 'rgba(255,245,210,1)');
  for (let k = 0; k < 16; k++) {
    const ph = (t * 1.6 + k / 16) % 1;
    const ang = hash(k) * TAU;
    const d = ph * r * (0.5 + hash(k + 9) * 0.5);
    ctx.globalAlpha = 1 - ph;
    ctx.fillStyle = k % 3 ? '#ffd27a' : '#fff4d6';
    ctx.beginPath();
    ctx.arc(
      ex + Math.cos(ang) * d,
      ey + Math.sin(ang) * d - ph * r * 0.2,
      r * 0.025 + 1,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function stone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  rrect(ctx, x, y, s, s, s * 0.14);
  ctx.fillStyle = vgrad(ctx, y, y + s, [
    [0, '#55407a'],
    [1, '#1d1838'],
  ]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,190,140,.18)';
  rrect(ctx, x + s * 0.08, y + s * 0.06, s * 0.84, s * 0.1, s * 0.05);
  ctx.fill();
}

function crate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  rrect(ctx, x, y, s, s, s * 0.08);
  ctx.fillStyle = vgrad(ctx, y, y + s, [
    [0, '#b0703f'],
    [1, '#5a3220'],
  ]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,10,.55)';
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.06, y + (s * k) / 3);
    ctx.lineTo(x + s * 0.94, y + (s * k) / 3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x + s * 0.1, y + s * 0.1);
  ctx.lineTo(x + s * 0.9, y + s * 0.9);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,140,.25)';
  ctx.fillRect(x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.05);
}

function grass(v: IntroView, y: number, color: string, seed: number): void {
  const { ctx, w, h, t } = v;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, h * 2);
  for (let x = -10; x <= w + 10; x += 9) {
    const blade = (hash(x * 0.37 + seed) * 0.7 + 0.3) * h * 0.05;
    const sway = Math.sin(t * 1.3 + x * 0.02 + seed) * 4;
    ctx.lineTo(x - 4, y);
    ctx.lineTo(x + sway, y - blade);
    ctx.lineTo(x + 4, y);
  }
  ctx.lineTo(w + 10, h * 2);
  ctx.closePath();
  ctx.fill();
}

/** Dusk over the arena: a bomb with a lit fuse on the crates, the Novato beside it. */
export function paintIntro(v: IntroView): void {
  const { ctx, w, h, t } = v;
  const narrow = w < NARROW_WIDTH;
  const lift = narrow ? 0.3 : 0;
  ctx.fillStyle = vgrad(ctx, 0, h, [
    [0, '#1c1244'],
    [0.38, '#4d2777'],
    [0.62, '#c2537a'],
    [0.78, '#ff9a55'],
    [0.9, '#ffd08a'],
  ]);
  ctx.fillRect(0, -h, w, h * 3);
  const sx = narrow ? w * 0.7 : w * 0.66;
  const sy = h * (0.66 - lift);
  layer(v, 0.5, () => {
    glow(ctx, sx, sy, h * 0.55, 'rgba(255,200,120,.55)');
    ctx.fillStyle = '#ffe2a8';
    ctx.beginPath();
    ctx.arc(sx, sy, h * 0.07, 0, TAU);
    ctx.fill();
    stars(v, 40, 0.3);
    for (let k = 0; k < 5; k++) {
      const cx = ((hash(k) * w * 1.4 + t * (6 + k * 2)) % (w * 1.4)) - w * 0.2;
      const cy = h * (0.16 + hash(k + 3) * 0.25);
      ctx.fillStyle = `rgba(255,${190 + k * 8},${190 + k * 5},.22)`;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.ellipse(
          cx + j * 38,
          cy + Math.sin(j) * 6,
          60 - j * 8,
          16,
          0,
          0,
          TAU,
        );
        ctx.fill();
      }
    }
  });
  layer(v, 0.35, () =>
    ridge(
      v,
      0.7 - lift,
      0.1,
      1.3,
      vgrad(ctx, h * 0.5, h, [
        [0, '#8a4a8f'],
        [1, '#4a2766'],
      ]),
      'rgba(255,190,150,.35)',
    ),
  );
  layer(v, 0.2, () =>
    ridge(
      v,
      0.79 - lift,
      0.07,
      4.1,
      vgrad(ctx, h * 0.6, h, [
        [0, '#5b2f78'],
        [1, '#2d1a52'],
      ]),
      'rgba(255,160,130,.3)',
    ),
  );
  layer(v, 0.05, () => ridge(v, 0.88 - lift, 0.04, 2.2, '#22163f'));
  layer(v, -0.12, () => {
    const s = Math.min(w, h) * (narrow ? 0.15 : 0.12);
    const baseY = h * (0.9 - lift);
    const bx = narrow ? w * 0.5 : w * 0.58;
    stone(ctx, bx - s * 1.05, baseY - s, s);
    crate(ctx, bx, baseY - s, s);
    stone(ctx, bx + s * 1.05, baseY - s, s);
    stone(ctx, bx + s * 2.1, baseY - s, s);
    crate(ctx, bx + s * 1.05, baseY - s * 2.02, s);
    const r = s * 0.75;
    bomb(ctx, bx + s * 0.5, baseY - s - r * 0.98, r, t);
    const hop = Math.abs(Math.sin(t * 1.8)) * s * 0.04;
    figure(ctx, v.hero, bx + s * 1.55, baseY - s * 2.02 - hop, s * 1.25);
    ctx.fillStyle = '#160f2e';
    ctx.fillRect(0, baseY, w, h * 2);
    grass(v, baseY + 2, '#160f2e', 1);
  });
  embers(v, t, 34, 'rgba(255,170,90,1)');
}
