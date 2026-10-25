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
  stepOf,
  TAU,
  teamFor,
  scaredFace,
  FRAME_SCARED,
  FRAME_CHEER,
  FRAME_PLACE,
  volume,
  lineOf,
  seam,
  gloss,
} from './ink';

const SKIN = '#a8714f';
const SKIN_LINE = lineOf(SKIN);
const GREY = '#d9d4cc';
const JACKET = '#3b4148';
const REFLECT = '#e6e9ee';
const CARGO = '#2d3446';
const BOOT = '#5b3b26';
const BOOT_SOLE = '#2a211b';
const RED = '#d23c33';
const VALVE = '#c7ccd3';
const HOSE = '#1f2024';
const PAGER = '#24262b';

/**
 * O Staff do B.O., the staff engineer who has been here longest and puts out
 * every fire the rest of the company starts: a charcoal work jacket with a
 * reflective band in the team's colour, cargo work trousers and boots, an
 * on-call pager blinking on his belt and a fire extinguisher in his hand.
 * Bald with a ring of grey, a white goatee, crow's feet and the level gaze
 * of someone who has seen a worse deploy.
 */
export function paintStaff(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame === 1 || o.frame === 2;
  const placing = o.frame === FRAME_PLACE;
  const cheering = o.frame === FRAME_CHEER;
  const scared = o.frame === FRAME_SCARED;
  const step = stepOf(o.frame);
  const seated = !!o.seated;
  const bob = seated
    ? 0
    : placing
      ? 2.4
      : cheering
        ? -3
        : scared
          ? -1.6
          : walking
            ? -1.2
            : Math.sin((t * TAU) / 3.6) * 0.4;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: cargo trousers and work boots ──
  const bootAt = (x: number, by: number, fwd: number, rot = 0) => {
    const p: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.4, -4.6);
      ctx.lineTo(3, -4.6);
      ctx.lineTo(3.6, -1.6);
      ctx.quadraticCurveTo(6 + fwd, -1.2, 5.8 + fwd, 2);
      ctx.lineTo(-4.8, 2);
      ctx.closePath();
      ctx.restore();
    };
    p();
    fillStroke(ctx, BOOT, 1.7, INK);
    volume(ctx, p, BOOT, 1.05, 1.4);
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    roundRect(ctx, -5, 0.8, 11 + fwd, 2, 0.6);
    ctx.fillStyle = BOOT_SOLE;
    ctx.fill();
    // Laces.
    ctx.strokeStyle = '#e8c27a';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const y of [-3.6, -2.2]) {
      ctx.moveTo(-1.4, y);
      ctx.lineTo(1.6, y);
    }
    ctx.stroke();
    ctx.restore();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () => roundRect(ctx, x - 3.3, 41, 6.6, 11 - lift * 0.5, 2);
    p();
    fillStroke(ctx, CARGO, 1.7, lineOf(CARGO));
    volume(ctx, p, CARGO, 1, 1.4);
    if (!back) {
      roundRect(ctx, x - 2.4, 44, 4.8, 3.6, 0.6);
      ctx.strokeStyle = lineOf(CARGO);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    bootAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3.3, 0, 6.6, 9, 2);
        ctx.restore();
      };
      p();
      fillStroke(ctx, CARGO, 1.7, lineOf(CARGO));
      volume(ctx, p, CARGO, 1, 1.4);
      bootAt(hx + dir * 3.5, 51, 0, dir * 0.35);
    };
    if (side) hang(33, 0.4);
    else {
      hang(25, -1);
      hang(39, 1);
    }
  } else if (cheering) {
    if (side) {
      legAt(29, 2.5, 2);
      legAt(35, 0, 0);
    } else {
      legAt(26.5, 2.5, 0);
      legAt(37.5, 0, 0);
    }
  } else if (side) {
    legAt(29 - step * 4, step === 1 ? 2 : 0, step === 1 ? 2 : 0);
    legAt(35 + step * 4, step === -1 ? 2 : 0, step === -1 ? 2 : 0);
  } else {
    legAt(26.5, step === 1 ? 2.5 : 0, 0);
    legAt(37.5, step === -1 ? 2.5 : 0, 0);
  }

  ctx.translate(0, bob);

  // ── the work jacket, with its reflective band ──
  const hem = seated ? 41 : 44;
  const jacketPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(24, 21.5);
      ctx.lineTo(40, 21.5);
      ctx.quadraticCurveTo(44, 32, 43, hem);
      ctx.lineTo(22.5, hem);
      ctx.quadraticCurveTo(20.5, 32, 24, 21.5);
    } else {
      ctx.moveTo(21, 21.5);
      ctx.lineTo(43, 21.5);
      ctx.quadraticCurveTo(47, 32, 46, hem);
      ctx.lineTo(18, hem);
      ctx.quadraticCurveTo(17, 32, 21, 21.5);
    }
    ctx.closePath();
  };
  jacketPath();
  fillStroke(ctx, JACKET, 1.7, lineOf(JACKET));
  volume(ctx, jacketPath, JACKET, 1.25, 1.8);
  /** A band across the jacket: the team's colour, a silver stripe through it. */
  const band = (y: number) => {
    ctx.save();
    jacketPath();
    ctx.clip();
    ctx.fillStyle = c.suit;
    ctx.fillRect(16, y, 32, 3.6);
    ctx.fillStyle = REFLECT;
    ctx.fillRect(16, y + 1.2, 32, 1.2);
    ctx.restore();
  };
  band(33);
  if (back) {
    // A second band across the shoulders, seen from behind.
    band(26);
  } else {
    // The zip, a stand-up collar and a chest pocket with a pen.
    seam(
      ctx,
      [
        [side ? 38.5 : 32, 21.5],
        [side ? 40.5 : 32, hem - 0.5],
      ],
      '#9aa1aa',
      0.9,
    );
    if (side) {
      roundRect(ctx, 33.5, 19.8, 7, 3.4, 1.2);
      fillStroke(ctx, JACKET, 1.3, lineOf(JACKET));
    } else {
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(32, 21.6);
        ctx.lineTo(32 + dir * 6.5, 19.8);
        ctx.lineTo(32 + dir * 7, 23.4);
        ctx.lineTo(32 + dir * 1.2, 25);
        ctx.closePath();
        fillStroke(ctx, JACKET, 1.3, lineOf(JACKET));
      }
      roundRect(ctx, 35, 26.4, 5.6, 4.6, 0.6);
      ctx.strokeStyle = lineOf(JACKET);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      seam(
        ctx,
        [
          [36.6, 24.6],
          [36.6, 27],
        ],
        c.suitLight,
        1.1,
      );
      // A patch on the other breast: the incident count, never zero.
      circle(ctx, 26.2, 28.4, 2);
      fillStroke(ctx, RED, 0.9, lineOf(RED));
      ctx.font = 'bold 2.6px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('!', 26.2, 29.4);
    }
  }
  // The belt, and the on-call pager clipped to it, blinking.
  seam(
    ctx,
    side
      ? [
          [22.8, hem - 0.6],
          [42.8, hem - 0.6],
        ]
      : [
          [18.2, hem - 0.6],
          [45.8, hem - 0.6],
        ],
    '#1c1a18',
    1.6,
  );
  if (!back) {
    const px = side ? 27 : 40.5;
    roundRect(ctx, px - 2.4, hem - 3.4, 4.8, 3.6, 0.6);
    fillStroke(ctx, PAGER, 1, INK);
    roundRect(ctx, px - 1.6, hem - 2.8, 2.4, 1.4, 0.3);
    ctx.fillStyle = '#9fd18a';
    ctx.fill();
    circle(ctx, px + 1.4, hem - 2.1, 0.6);
    ctx.fillStyle = Math.sin(t * 9) > 0 ? '#ff3b3b' : '#5a1a1a';
    ctx.fill();
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
    ctx.strokeStyle = lineOf(JACKET);
    ctx.lineWidth = 8.2;
    ctx.stroke();
    ctx.strokeStyle = JACKET;
    ctx.lineWidth = 4.8;
    ctx.stroke();
    // The band round the forearm.
    const bx = ex + (hx - ex) * 0.45;
    const by = ey + (hy - ey) * 0.45;
    circle(ctx, bx, by, 2.5);
    ctx.fillStyle = c.suit;
    ctx.fill();
    circle(ctx, bx, by, 1.1);
    ctx.fillStyle = REFLECT;
    ctx.fill();
    if (hand) {
      circle(ctx, hx, hy, 2.9);
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    }
  };
  /**
   * The extinguisher, held by its valve: a red cylinder, a white label, the
   * black hose curled down its side. `spray` puts a white cloud at the nozzle.
   */
  const extinguisher = (x: number, y: number, tilt = 0, spray = false) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    roundRect(ctx, -1.6, -1.6, 3.2, 2.4, 0.6);
    fillStroke(ctx, VALVE, 1, lineOf(VALVE));
    const body: Path = () => roundRect(ctx, -3.2, 0.6, 6.4, 11, 2.6);
    body();
    fillStroke(ctx, RED, 1.5, lineOf(RED));
    volume(ctx, body, RED, 1, 1.4);
    roundRect(ctx, -2.2, 4, 4.4, 3.6, 0.5);
    ctx.fillStyle = '#f4f1ea';
    ctx.fill();
    seam(
      ctx,
      [
        [-1.4, 5.2],
        [1.4, 5.2],
      ],
      RED,
      0.6,
    );
    seam(
      ctx,
      [
        [-1.4, 6.4],
        [0.8, 6.4],
      ],
      INK,
      0.5,
    );
    gloss(ctx, -1.8, 3, 0.6, 2.4, 0, 0.6);
    // The hose: from the valve, out and down to the nozzle.
    ctx.beginPath();
    ctx.moveTo(1.4, -0.6);
    ctx.quadraticCurveTo(6, 0.4, 4.6, 6);
    ctx.lineTo(4.4, 8.4);
    ctx.strokeStyle = HOSE;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    roundRect(ctx, 3.4, 8, 2, 2.6, 0.4);
    ctx.fillStyle = HOSE;
    ctx.fill();
    if (spray) {
      ctx.globalAlpha = 0.85;
      for (const [dx, dy, r] of [
        [4.4, 13, 2.2],
        [2, 15, 2.6],
        [6.6, 15.4, 2.4],
        [4.4, 17, 2],
      ] as const) {
        circle(ctx, dx + Math.sin(t * 7 + dx) * 0.3, dy, r);
        ctx.fillStyle = '#f4f7fa';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
  if (seated) {
    if (side) sleeve(37, 25, 44, 33, 42, 29);
    else {
      sleeve(22, 25, 26, 34, 18, 31);
      sleeve(42, 25, 38, 34, 46, 31);
    }
  } else if (placing) {
    // Putting it out before it has even started.
    if (side) {
      sleeve(37, 25, 42, 31, 45, 34);
      extinguisher(45, 35, -0.3, true);
    } else if (back) {
      sleeve(22, 25, 18, 33, 19, 40);
      sleeve(42, 25, 46, 33, 45, 40);
    } else {
      sleeve(22, 25, 18, 33, 21, 38);
      sleeve(42, 25, 46, 32, 43, 34);
      extinguisher(43, 35, 0.2, true);
    }
  } else if (scared) {
    if (side) {
      sleeve(37, 25, 42, 20, 40, 14);
      extinguisher(40, 14, 0.3);
    } else {
      sleeve(22, 25, 17, 19, 21, 13);
      sleeve(42, 25, 47, 19, 43, 13);
      extinguisher(43, 13, 0.3);
    }
  } else if (cheering) {
    // The extinguisher up like a trophy: incident closed.
    if (side) {
      sleeve(37, 25, 42, 17, 44, 9);
      extinguisher(44, 8, 0.15);
    } else {
      sleeve(22, 25, 16, 18, 14, 10);
      sleeve(42, 25, 48, 18, 50, 10);
      extinguisher(50, 8, 0.15);
    }
  } else if (side) {
    const sw = walking ? step * 4 : 0;
    sleeve(37, 25, 39 + sw, 34, 40 + sw * 0.6, 37);
    extinguisher(40 + sw * 0.6, 37.5, 0);
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 33, 18, 37 + step * 2);
    sleeve(42, 25, 47 - step * 1.5, 33, 46, 37 - step * 2);
    extinguisher(46, 37.5 - step * 2, 0);
  } else {
    // One hand on the hip, the extinguisher hanging ready at his side.
    sleeve(22, 25, 17, 31, 21.5, 36);
    sleeve(42, 25, 46.5, 32, 46.5, 37);
    extinguisher(46.5, 37.5, 0);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN, 1.7, SKIN_LINE);
  volume(ctx, head, SKIN, 1.3, 1.8);
  // The shine on the scalp.
  gloss(ctx, side ? 33 : 28, 5.4, 2.6, 1.2, -0.3, 0.55);
  /** The ring of grey: close-cropped, hugging the head from ear to ear. */
  const ring: Path = () => {
    ctx.beginPath();
    if (back) {
      ctx.moveTo(21.2, 12.5);
      ctx.quadraticCurveTo(21.6, 19.6, 26, 21.2);
      ctx.quadraticCurveTo(32, 22.6, 38, 21.2);
      ctx.quadraticCurveTo(42.4, 19.6, 42.8, 12.5);
      ctx.quadraticCurveTo(42, 16.6, 38, 17.6);
      ctx.quadraticCurveTo(32, 18.8, 26, 17.6);
      ctx.quadraticCurveTo(22, 16.6, 21.2, 12.5);
    } else if (side) {
      ctx.moveTo(21.6, 12);
      ctx.quadraticCurveTo(21.4, 18, 24.6, 20);
      ctx.lineTo(26.4, 18.6);
      ctx.quadraticCurveTo(24.4, 16.4, 24.6, 12.6);
    } else {
      for (const dir of [-1, 1]) {
        ctx.moveTo(32 + dir * 10.6, 11);
        ctx.quadraticCurveTo(32 + dir * 11, 15, 32 + dir * 10.2, 18);
        ctx.lineTo(32 + dir * 9.2, 17);
        ctx.quadraticCurveTo(32 + dir * 9.6, 14, 32 + dir * 9.4, 11.6);
        ctx.closePath();
      }
      return;
    }
    ctx.closePath();
  };
  ring();
  fillStroke(ctx, GREY, 1, lineOf(SKIN));
  // Stubble texture: short darker ticks through the grey.
  ctx.save();
  ring();
  ctx.clip();
  ctx.strokeStyle = 'rgba(90, 80, 70, 0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 20; x <= 44; x += 1.6) {
    for (let y = 11; y <= 22; y += 2.2) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.4, y + 0.9);
    }
  }
  ctx.stroke();
  ctx.restore();
  if (!back) {
    /** Steady, a little narrowed, crow's feet at the corners. */
    const eye = (x: number, y: number, outward: number) => {
      const h = 1.4 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.5, y);
        ctx.lineTo(x + 1.5, y);
        inkOnly(ctx, 1.4);
      } else {
        ctx.beginPath();
        ctx.ellipse(x, y, 1.3, h, 0, 0, TAU);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      // A heavy lid line, and the crow's feet.
      ctx.beginPath();
      ctx.moveTo(x - 2, y - 1.3);
      ctx.quadraticCurveTo(x, y - 2, x + 2, y - 1.3);
      inkOnly(ctx, 1.2);
      ctx.strokeStyle = SKIN_LINE;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const dy of [-0.8, 0.6]) {
        ctx.moveTo(x + outward * 2.4, y + dy * 0.5);
        ctx.lineTo(x + outward * 3.6, y + dy);
      }
      ctx.stroke();
    };
    if (side) {
      eye(37.5, 15.8, -1);
      ctx.beginPath();
      ctx.moveTo(34.8, 11.8);
      ctx.lineTo(40, 11.4);
      ctx.strokeStyle = GREY;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(41.5, 15.2);
      ctx.quadraticCurveTo(44.2, 17.4, 41.6, 18.8);
      inkOnly(ctx, 1.4);
    } else {
      eye(28, 15.8, -1);
      eye(36, 15.8, 1);
      // Grey brows, thick and level.
      ctx.beginPath();
      ctx.moveTo(25, 12.2);
      ctx.lineTo(30.4, 11.8);
      ctx.moveTo(33.6, 11.8);
      ctx.lineTo(39, 12.2);
      ctx.strokeStyle = GREY;
      ctx.lineWidth = 1.9;
      ctx.stroke();
      seam(
        ctx,
        [
          [32.4, 18.2],
          [31.6, 18.8],
        ],
        SKIN_LINE,
        1,
      );
    }
    // The white goatee and moustache around a flat, unbothered mouth.
    const goatee: Path = () => {
      ctx.beginPath();
      if (side) {
        ctx.moveTo(36.6, 19.8);
        ctx.quadraticCurveTo(39.5, 19, 42, 20);
        ctx.quadraticCurveTo(42.4, 24.6, 39, 25.8);
        ctx.quadraticCurveTo(36.4, 25, 36.6, 19.8);
      } else {
        ctx.moveTo(28.2, 20.6);
        ctx.quadraticCurveTo(32, 18.6, 35.8, 20.6);
        ctx.quadraticCurveTo(36, 22.6, 34.6, 22.4);
        ctx.quadraticCurveTo(34.8, 26.2, 32, 26.6);
        ctx.quadraticCurveTo(29.2, 26.2, 29.4, 22.4);
        ctx.quadraticCurveTo(28, 22.6, 28.2, 20.6);
      }
      ctx.closePath();
    };
    goatee();
    fillStroke(ctx, GREY, 1.2, lineOf(GREY));
    volume(ctx, goatee, GREY, 0.9, 1.1);
    ctx.beginPath();
    if (side) {
      ctx.moveTo(38.4, 21.8);
      ctx.lineTo(41, 21.6);
    } else {
      ctx.moveTo(30.2, 22.2);
      ctx.lineTo(33.8, 22.2);
    }
    ctx.strokeStyle = '#4a2a1e';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (!side) {
      // The ear-piece of the on-call phone, never out.
      ellipse(ctx, 21.6, 16.4, 1.1, 1.5);
      fillStroke(ctx, PAGER, 0.8, INK);
    }
  }

  if (scared && !back) {
    scaredFace(
      ctx,
      side
        ? [[37.5, 15.8]]
        : [
            [28, 15.8],
            [36, 15.8],
          ],
      side ? [39.5, 21.5] : [32, 22],
      SKIN_LINE,
    );
  }
  ctx.restore();
  ctx.restore();
}
