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

const SKIN = '#c68d66';
const SKIN_LINE = lineOf(SKIN);
const HAIR = '#231c18';
const FLANNEL = '#b5672f';
const FLANNEL_CHECK = 'rgba(60, 24, 8, 0.38)';
const TEE = '#f3f1ea';
const JOGGERS = '#565b66';
const SHOE = '#2a2b31';
const SOLE = '#f0efe9';
const FRAME = '#1f1d1c';
const STAMP_HANDLE = '#8a5a34';
const STAMP_INK = '#d63b3b';
const BRASS = '#c9a34a';

/**
 * O Tester do Contra, quality assurance: a beanie in the team's colour, thick
 * square glasses, an open flannel shirt over a white tee with a bug crossed
 * out, joggers and high-tops. A magnifying glass in one hand and, in the
 * other, the rubber stamp that says no before the ticket is read. One brow up,
 * one brow down, the mouth pulled to one side: he has found something.
 */
export function paintTester(ctx: Ctx, o: CharacterPose): void {
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
      ? 2.8
      : cheering
        ? -3
        : scared
          ? -2
          : walking
            ? -1.2
            : Math.sin((t * TAU) / 3.2) * 0.4;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: joggers and high-tops ──
  const shoeAt = (x: number, by: number, fwd: number, rot = 0) => {
    const p: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.2, -4.4);
      ctx.lineTo(2.6, -4.4);
      ctx.lineTo(3.4, -1.6);
      ctx.quadraticCurveTo(5.8 + fwd, -1, 5.6 + fwd, 2.2);
      ctx.lineTo(-4.8, 2.4);
      ctx.closePath();
      ctx.restore();
    };
    p();
    fillStroke(ctx, SHOE, 1.7, INK);
    volume(ctx, p, SHOE, 1, 1.3);
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    roundRect(ctx, -4.8, 0.6, 10.4 + fwd, 1.8, 0.6);
    ctx.fillStyle = SOLE;
    ctx.fill();
    // The ankle patch, in the team's colour.
    circle(ctx, -1.6, -2.6, 1);
    ctx.fillStyle = c.suit;
    ctx.fill();
    ctx.restore();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () =>
      roundRect(ctx, x - 3.2, 41, 6.4, 11 - lift * 0.5, 2.2);
    p();
    fillStroke(ctx, JOGGERS, 1.7, lineOf(JOGGERS));
    volume(ctx, p, JOGGERS, 1, 1.4);
    // The elastic cuff, gathered at the ankle.
    seam(
      ctx,
      [
        [x - 3, 50.2 - lift],
        [x + 3, 50.2 - lift],
      ],
      lineOf(JOGGERS),
      1.1,
    );
    shoeAt(x, 55 - lift, fwd);
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
      fillStroke(ctx, JOGGERS, 1.7, lineOf(JOGGERS));
      volume(ctx, p, JOGGERS, 1, 1.4);
      shoeAt(hx + dir * 3.5, 51, 0, dir * 0.35);
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

  // ── the tee, then the open flannel over it ──
  const hem = seated ? 41 : 44;
  const flannelPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(24, 22);
      ctx.lineTo(40, 22);
      ctx.quadraticCurveTo(43.5, 32, 42.5, hem);
      ctx.lineTo(22.5, hem);
      ctx.quadraticCurveTo(20.5, 32, 24, 22);
    } else {
      ctx.moveTo(21, 22);
      ctx.lineTo(43, 22);
      ctx.quadraticCurveTo(46.5, 32, 45.5, hem);
      ctx.lineTo(18.5, hem);
      ctx.quadraticCurveTo(17.5, 32, 21, 22);
    }
    ctx.closePath();
  };
  flannelPath();
  fillStroke(ctx, FLANNEL, 1.7, lineOf(FLANNEL));
  // The check: a few dark bands each way, clipped to the shirt.
  ctx.save();
  flannelPath();
  ctx.clip();
  ctx.strokeStyle = FLANNEL_CHECK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let x = 20; x <= 46; x += 5) {
    ctx.moveTo(x, 21);
    ctx.lineTo(x, hem + 1);
  }
  for (let y = 26; y <= hem; y += 5) {
    ctx.moveTo(17, y);
    ctx.lineTo(47, y);
  }
  ctx.stroke();
  ctx.restore();
  volume(ctx, flannelPath, FLANNEL, 1.15, 1.7);
  if (back) {
    // A yoke across the shoulders.
    seam(
      ctx,
      [
        [21.5, 26],
        [42.5, 26],
      ],
      lineOf(FLANNEL),
      1.1,
    );
  } else {
    const teePath: Path = () => {
      ctx.beginPath();
      if (side) {
        ctx.moveTo(34, 22);
        ctx.lineTo(40, 22);
        ctx.quadraticCurveTo(42.5, 32, 41.5, hem - 0.5);
        ctx.lineTo(36, hem - 0.5);
      } else {
        ctx.moveTo(26, 22);
        ctx.lineTo(38, 22);
        ctx.lineTo(37, hem - 0.5);
        ctx.lineTo(27, hem - 0.5);
      }
      ctx.closePath();
    };
    teePath();
    fillStroke(ctx, TEE, 1.4, lineOf(TEE));
    volume(ctx, teePath, TEE, 0.9, 1.2);
    if (!side) {
      // A crew neck, then the bug with a red line through it.
      ctx.beginPath();
      ctx.moveTo(28.5, 22);
      ctx.quadraticCurveTo(32, 25, 35.5, 22);
      ctx.closePath();
      fillStroke(ctx, SKIN, 1.1, SKIN_LINE);
      ellipse(ctx, 32, 33, 2.2, 2.8);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const dy of [-1.2, 0.4, 2]) {
        ctx.moveTo(29.2, 33 + dy);
        ctx.lineTo(34.8, 33 + dy);
      }
      ctx.moveTo(31, 30.4);
      ctx.lineTo(30, 29.2);
      ctx.moveTo(33, 30.4);
      ctx.lineTo(34, 29.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(32, 33, 4.2, 0, TAU);
      ctx.moveTo(29, 30);
      ctx.lineTo(35, 36);
      ctx.strokeStyle = c.suit;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    // The open fronts of the flannel, with buttons on one side.
    const front = (pts: readonly (readonly [number, number])[]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = lineOf(FLANNEL);
      ctx.lineWidth = 1.3;
      ctx.stroke();
    };
    if (side) {
      front([
        [34, 22],
        [36, hem - 0.5],
      ]);
    } else {
      front([
        [26, 22],
        [27, hem - 0.5],
      ]);
      front([
        [38, 22],
        [37, hem - 0.5],
      ]);
      for (const y of [28, 33, 38]) {
        circle(ctx, 25.4, y, 0.6);
        ctx.fillStyle = '#efe4cf';
        ctx.fill();
      }
      // A collar point each side.
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(32 + dir * 3.5, 21.6);
        ctx.lineTo(32 + dir * 7, 21.6);
        ctx.lineTo(32 + dir * 5, 25.4);
        ctx.closePath();
        fillStroke(ctx, FLANNEL, 1.2, lineOf(FLANNEL));
      }
    }
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
    ctx.strokeStyle = lineOf(FLANNEL);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = FLANNEL;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.8);
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    }
  };
  /** The magnifying glass: a brass rim, a pale lens, a dark handle. */
  const glass = (x: number, y: number, tilt = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 5.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = '#3b2f28';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    circle(ctx, 0, -4.2, 4.2);
    ctx.fillStyle = 'rgba(210, 236, 248, 0.45)';
    ctx.fill();
    ctx.strokeStyle = lineOf(BRASS);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    gloss(ctx, -1.6, -5.6, 0.7, 1.6, -0.6, 0.8);
    ctx.restore();
  };
  /** The rubber stamp: a round wooden handle on a red-inked block. */
  const stamp = (x: number, y: number, tilt = 0, inked = false) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    roundRect(ctx, -1.2, -6, 2.4, 4.4, 0.8);
    fillStroke(ctx, STAMP_HANDLE, 1.1, lineOf(STAMP_HANDLE));
    circle(ctx, 0, -6.4, 2.1);
    fillStroke(ctx, STAMP_HANDLE, 1.1, lineOf(STAMP_HANDLE));
    roundRect(ctx, -3.6, -1.8, 7.2, 2.6, 0.6);
    fillStroke(ctx, '#3a3d45', 1.1, INK);
    ctx.fillStyle = STAMP_INK;
    ctx.fillRect(-3.4, 0.6, 6.8, 0.9);
    ctx.restore();
    if (inked) {
      // The mark it leaves: a red frame and a cross.
      ctx.save();
      ctx.translate(x, y + 3.6);
      ctx.rotate(-0.15);
      ctx.strokeStyle = STAMP_INK;
      ctx.lineWidth = 0.9;
      ctx.strokeRect(-4.6, -1.6, 9.2, 3.4);
      ctx.beginPath();
      ctx.moveTo(-3, -0.8);
      ctx.lineTo(3, 1);
      ctx.moveTo(3, -0.8);
      ctx.lineTo(-3, 1);
      ctx.stroke();
      ctx.restore();
    }
  };
  if (seated) {
    if (side) sleeve(37, 25, 44, 33, 42, 29);
    else {
      sleeve(22, 25, 26, 34, 18, 31);
      sleeve(42, 25, 38, 34, 46, 31);
    }
  } else if (placing) {
    // Stamping the floor: REPROVADO.
    if (side) {
      sleeve(37, 25, 43, 33, 46, 42);
      stamp(46, 46, 0, true);
    } else if (back) {
      sleeve(22, 25, 18, 33, 19, 40);
      sleeve(42, 25, 46, 33, 45, 40);
    } else {
      sleeve(22, 25, 18, 33, 17.5, 37);
      glass(17.5, 34, -0.3);
      sleeve(42, 25, 45, 34, 44, 42);
      stamp(44, 46, 0, true);
    }
  } else if (scared) {
    if (side) {
      sleeve(37, 25, 42, 20, 40, 14);
      glass(40, 11, 0.4);
    } else {
      sleeve(22, 25, 17, 19, 21, 13);
      glass(21, 10, -0.3);
      sleeve(42, 25, 47, 19, 43, 13);
      stamp(43, 10, 0.3);
    }
  } else if (cheering) {
    // The stamp raised high, about to come down on somebody's ticket.
    if (side) {
      sleeve(37, 25, 42, 17, 44, 9);
      stamp(44.5, 7, 0.2);
    } else {
      sleeve(22, 25, 16, 18, 14, 10);
      glass(14, 7, -0.2);
      sleeve(42, 25, 48, 18, 50, 10);
      stamp(50.5, 8, 0.2);
    }
  } else if (side) {
    // Leaning into the magnifying glass, held out ahead.
    const sw = walking ? step * 3 : 0;
    sleeve(37, 25, 41 + sw * 0.4, 31, 45 + sw * 0.4, 25);
    glass(46 + sw * 0.4, 25, 0.45);
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 34 + step * 2, 18, 38 + step * 2);
    stamp(18, 41 + step * 2, 0);
    sleeve(42, 25, 47, 31, 45, 27);
    glass(45, 25, 0.2);
  } else {
    // Stamp ready by the hip; the lens up beside the face, checking.
    sleeve(22, 25, 18.5, 33, 18.5, 38);
    stamp(18.5, 41.5, 0);
    sleeve(42, 25, 47, 31, 45.5, 26.5);
    glass(45.5, 25 + Math.sin(t * 1.6) * 0.4, 0.15);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN, 1.7, SKIN_LINE);
  volume(ctx, head, SKIN, 1.3, 1.8);
  if (!back) {
    const eye = (x: number, y: number) => {
      const h = 1.5 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.4, y);
        ctx.lineTo(x + 1.4, y);
        inkOnly(ctx, 1.4);
        return;
      }
      ctx.beginPath();
      ctx.ellipse(x, y, 1.2, h, 0, 0, TAU);
      ctx.fillStyle = INK;
      ctx.fill();
    };
    /** Square, thick frames, pushed down the nose a little. */
    const lens = (x: number, y: number) => {
      roundRect(ctx, x - 3.6, y - 2.8, 7.2, 5.8, 1.2);
      ctx.fillStyle = 'rgba(210, 236, 248, 0.28)';
      ctx.fill();
      eye(x, y + 0.1);
      roundRect(ctx, x - 3.6, y - 2.8, 7.2, 5.8, 1.2);
      ctx.strokeStyle = FRAME;
      ctx.lineWidth = 1.9;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 2.2, y - 1.4);
      ctx.lineTo(x - 0.8, y - 2.2);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    };
    if (side) {
      lens(38, 16.4);
      ctx.beginPath();
      ctx.moveTo(34.4, 16);
      ctx.lineTo(27, 15);
      inkOnly(ctx, 1.5);
      // The one brow he raises, the one that means "really?".
      ctx.beginPath();
      ctx.moveTo(35, 11);
      ctx.quadraticCurveTo(37.5, 9.2, 40.6, 10.6);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.4);
      ctx.quadraticCurveTo(44, 17.4, 41.6, 18.8);
      inkOnly(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(37, 21.4);
      ctx.lineTo(40.4, 20.8);
      inkOnly(ctx, 1.3);
    } else {
      lens(27.6, 16.4);
      lens(36.4, 16.4);
      ctx.beginPath();
      ctx.moveTo(31.2, 16);
      ctx.lineTo(32.8, 16);
      inkOnly(ctx, 1.7);
      // One brow up, one brow down.
      ctx.beginPath();
      ctx.moveTo(24.4, 11.4);
      ctx.lineTo(30.2, 12.4);
      ctx.moveTo(33.8, 10.8);
      ctx.quadraticCurveTo(36.6, 8.4, 39.6, 9.8);
      inkOnly(ctx, 1.5);
      seam(
        ctx,
        [
          [32.4, 18.8],
          [31.6, 19.4],
        ],
        SKIN_LINE,
        1,
      );
      // The mouth pulled to one side: unconvinced.
      ctx.beginPath();
      ctx.moveTo(29.4, 21.8);
      ctx.quadraticCurveTo(32.4, 21.6, 35.4, 20.4);
      inkOnly(ctx, 1.4);
      seam(
        ctx,
        [
          [35.2, 20.2],
          [36, 19.6],
        ],
        INK,
        1,
      );
    }
  }

  // ── the beanie, in the team's colour, short hair under it ──
  if (!back) {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(22, 12);
      ctx.lineTo(22.2, 18);
      ctx.quadraticCurveTo(25, 19, 27.5, 16.5);
      ctx.lineTo(27.5, 12);
    } else {
      ctx.moveTo(21.6, 11);
      ctx.lineTo(21.8, 16.5);
      ctx.lineTo(23.6, 13);
      ctx.moveTo(42.4, 11);
      ctx.lineTo(42.2, 16.5);
      ctx.lineTo(40.4, 13);
    }
    ctx.closePath();
    fillStroke(ctx, HAIR, 1.2, lineOf(HAIR));
  } else {
    // Short hair at the nape, under the beanie.
    ctx.beginPath();
    ctx.moveTo(21.4, 11);
    ctx.quadraticCurveTo(21, 18.5, 25, 20);
    ctx.quadraticCurveTo(32, 21.6, 39, 20);
    ctx.quadraticCurveTo(43, 18.5, 42.6, 11);
    ctx.closePath();
    fillStroke(ctx, HAIR, 1.4, lineOf(HAIR));
  }
  const beanie: Path = () => {
    ctx.beginPath();
    ctx.moveTo(20.6, 11.5);
    ctx.quadraticCurveTo(20, 1.4, 32, 1);
    ctx.quadraticCurveTo(44, 1.4, 43.4, 11.5);
    ctx.closePath();
  };
  beanie();
  fillStroke(ctx, c.suit, 1.7, lineOf(c.suit));
  volume(ctx, beanie, c.suit, 1.2, 1.6);
  // Ribbing.
  ctx.strokeStyle = c.suitDark;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const x of [26, 30, 34, 38]) {
    ctx.moveTo(x, 3);
    ctx.lineTo(x + (x - 32) * 0.08, 8);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // The folded cuff.
  const cuff: Path = () => roundRect(ctx, 20, 8.4, 24, 4.4, 2);
  cuff();
  fillStroke(ctx, c.suitDark, 1.5, lineOf(c.suitDark));
  volume(ctx, cuff, c.suitDark, 0.8, 1.1);
  if (!back) {
    // A little woven tag on the cuff.
    roundRect(ctx, side ? 35 : 29.6, 9.4, 4.8, 2.4, 0.4);
    ctx.fillStyle = '#efe9dc';
    ctx.fill();
  }

  if (scared && !back) {
    scaredFace(
      ctx,
      side
        ? [[38, 16.4]]
        : [
            [27.6, 16.4],
            [36.4, 16.4],
          ],
      side ? [39.5, 21.5] : [32, 22],
      SKIN_LINE,
    );
  }
  ctx.restore();
  ctx.restore();
}
