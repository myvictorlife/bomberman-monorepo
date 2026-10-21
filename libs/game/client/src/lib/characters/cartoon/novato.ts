import {
  beginFrame,
  bodyFrame,
  CharacterPose,
  circle,
  Ctx,
  dim,
  ellipse,
  fillStroke,
  gloss,
  headFrame,
  headPath,
  INK,
  lineOf,
  lit,
  occlude,
  Path,
  roundRect,
  seam,
  stepOf,
  TAU,
  teamFor,
  FRAME_CHEER,
  FRAME_PLACE,
  volume,
} from './ink';

const SKIN = '#e8b48a';
const SKIN_LINE = lineOf(SKIN);
const HAIR = '#4a2e1c';
const HAIR_LINE = lineOf(HAIR);
const SHORTS = '#3e4656';
const SHORTS_LINE = lineOf(SHORTS);
const SOCK = '#f4f2ea';
const SNEAKER = '#f0efe9';
const SNEAKER_LINE = lineOf(SNEAKER);
const SOLE = '#b9b7ad';
const MOUTH = '#5a2a2a';
const TONGUE = '#e98a9a';
const BLUSH = 'rgba(232, 110, 110, 0.32)';

/**
 * Novato, the default player: no job, no props. A plain tee and a cap in the
 * team colour, shorts, socks and sneakers, a wide grin. The figure everyone
 * starts as — and the pilot of the cast's volume: a top-left light, a
 * highlight and a core shadow on every shape, lines in each material's own
 * colour, contact shadows where parts meet.
 */
export function paintNovato(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const suitLine = lineOf(c.suit);
  const t = o.t ?? 0;
  const blink = o.blink ?? 0;
  const side = o.facing === 'left' || o.facing === 'right';
  const back = o.facing === 'up';
  const walking = o.frame === 1 || o.frame === 2;
  const placing = o.frame === FRAME_PLACE;
  const cheering = o.frame === FRAME_CHEER;
  const step = stepOf(o.frame);
  const seated = !!o.seated;
  const bob = seated
    ? 0
    : placing
      ? 2.4
      : cheering
        ? -3
        : walking
          ? -1.2
          : Math.sin((t * TAU) / 2.4) * 0.4;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: bare shins, socks and sneakers ──
  const sneakerAt = (x: number, by: number, fwd: number, rot = 0) => {
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    const sole: Path = () => roundRect(ctx, -5.2, 0.4, 11 + fwd, 4, 1.6);
    sole();
    fillStroke(ctx, SOLE, 1.5, lineOf(SOLE));
    const upper: Path = () => {
      ctx.beginPath();
      ctx.moveTo(-4.5, -4);
      ctx.lineTo(4.5, -4);
      ctx.quadraticCurveTo(6.8 + fwd, -1.5, 5.6 + fwd, 2);
      ctx.lineTo(-4.8, 2);
      ctx.closePath();
    };
    upper();
    fillStroke(ctx, SNEAKER, 1.5, SNEAKER_LINE);
    volume(ctx, upper, SNEAKER, 0.9, 1.3);
    // Laces.
    seam(
      ctx,
      [
        [-2.6, -2.3],
        [1.6, -2.3],
      ],
      SNEAKER_LINE,
      0.9,
    );
    seam(
      ctx,
      [
        [-2, -0.7],
        [2.2, -0.7],
      ],
      SNEAKER_LINE,
      0.9,
    );
    gloss(ctx, 3.2 + fwd * 0.5, -0.2, 1.5, 0.7, -0.3, 0.5);
    ctx.restore();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const shin: Path = () =>
      roundRect(ctx, x - 3.2, 41, 6.4, 11 - lift * 0.5, 2.6);
    shin();
    fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    volume(ctx, shin, SKIN, 0.9, 1.3);
    // The knee: a soft arc.
    ctx.beginPath();
    ctx.arc(x, 45.2 - lift * 0.2, 1.8, 0.35, Math.PI - 0.35);
    ctx.strokeStyle = dim(SKIN, 0.22);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    const sock: Path = () =>
      roundRect(ctx, x - 3.4, 49.4 - lift * 0.5, 6.8, 3.4, 1.2);
    sock();
    fillStroke(ctx, SOCK, 1.3, lineOf(SOCK));
    sneakerAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3.2, 0, 6.4, 9, 2.6);
        ctx.restore();
      };
      p();
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
      volume(ctx, p, SKIN, 0.9, 1.3);
      sneakerAt(hx + dir * 3.5, 51, 0, dir * 0.35);
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
  fillStroke(ctx, SHORTS, 1.7, SHORTS_LINE);
  volume(ctx, shortsPath, SHORTS, 1.1, 1.5);
  occlude(ctx, shortsPath, 37, 41, 0.3);
  // A stripe down each side in the team's light, and the fly.
  if (side) {
    seam(
      ctx,
      [
        [25.6, 37.5],
        [25, 44.3],
      ],
      c.suitLight,
      1.3,
    );
  } else {
    seam(
      ctx,
      [
        [22.6, 37.5],
        [21.8, 44.3],
      ],
      c.suitLight,
      1.3,
    );
    seam(
      ctx,
      [
        [41.4, 37.5],
        [42.2, 44.3],
      ],
      c.suitLight,
      1.3,
    );
    if (!back)
      seam(
        ctx,
        [
          [32, 38.5],
          [32, 44],
        ],
        SHORTS_LINE,
        0.9,
      );
  }

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
  fillStroke(ctx, c.suit, 1.7, suitLine);
  volume(ctx, teePath, c.suit, 1.3, 1.9);
  occlude(ctx, teePath, 22, 29, 0.3);
  // Folds at the waist, on the shade side and under the lit sleeve.
  seam(
    ctx,
    [
      [side ? 36 : 38.5, 33.5],
      [side ? 39 : 42, 36.5],
    ],
    dim(c.suit, 0.22),
    0.9,
  );
  seam(
    ctx,
    [
      [side ? 27 : 24, 35.5],
      [side ? 29 : 27, 37.2],
    ],
    dim(c.suit, 0.22),
    0.9,
  );
  if (back) {
    seam(
      ctx,
      [
        [27.5, 22.3],
        [36.5, 22.3],
      ],
      suitLine,
      1.3,
    );
  } else {
    // Ribbed collar: the line and a lighter rib inside it.
    ctx.beginPath();
    ctx.moveTo(side ? 31 : 27, 22.5);
    ctx.quadraticCurveTo(side ? 35 : 32, 26.5, side ? 39 : 37, 22.5);
    ctx.strokeStyle = suitLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side ? 32 : 28, 22);
    ctx.quadraticCurveTo(side ? 35 : 32, 25, side ? 38 : 36, 22);
    ctx.strokeStyle = c.suitLight;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // ── arms: short sleeves, bare forearms, hands with a thumb ──
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
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 7.4;
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    // The lit edge of the forearm.
    ctx.beginPath();
    ctx.moveTo(ex - 0.8, ey - 0.6);
    ctx.lineTo(hx - 0.8, hy - 0.6);
    ctx.strokeStyle = lit(SKIN, 0.4);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // Sleeve over the shoulder.
    const mx = sx + (ex - sx) * 0.45;
    const my = sy + (ey - sy) * 0.45;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.strokeStyle = suitLine;
    ctx.lineWidth = 8.6;
    ctx.stroke();
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 5.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 0.9, sy - 0.7);
    ctx.lineTo(mx - 0.9, my - 0.7);
    ctx.strokeStyle = lit(c.suit, 0.35);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // Thumb toward the body, then the palm over it.
    const toward = hx < 32 ? 1 : -1;
    circle(ctx, hx + toward * 2.3, hy - 1.3, 1.4);
    fillStroke(ctx, SKIN, 1.2, SKIN_LINE);
    const palm: Path = () => circle(ctx, hx, hy, 3.1);
    palm();
    fillStroke(ctx, SKIN, 1.4, SKIN_LINE);
    volume(ctx, palm, SKIN, 0.7, 0.9);
  };
  if (seated) {
    if (side) arm(37, 25, 42, 29, 44, 33);
    else {
      arm(22, 25, 18, 31, 26, 34);
      arm(42, 25, 46, 31, 38, 34);
    }
  } else if (placing) {
    if (side) arm(37, 25, 43, 31, 47, 38);
    else if (back) {
      arm(22, 25, 18, 33, 19, 40);
      arm(42, 25, 46, 33, 45, 40);
    } else {
      arm(22, 25, 20, 33, 25, 41);
      arm(42, 25, 44, 33, 39, 41);
    }
  } else if (cheering) {
    if (side) arm(37, 25, 42, 17, 44, 9);
    else {
      arm(22, 25, 16, 18, 14, 10);
      arm(42, 25, 48, 18, 50, 10);
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
  fillStroke(ctx, SKIN, 1.6, SKIN_LINE);
  volume(ctx, head, SKIN, 1.2, 1.6);
  // Hair at the nape, under the cap.
  if (back) {
    ctx.beginPath();
    ctx.moveTo(22.3, 9);
    ctx.lineTo(41.7, 9);
    ctx.lineTo(41.7, 13);
    ctx.quadraticCurveTo(38.5, 16.5, 35.5, 14.5);
    ctx.quadraticCurveTo(32, 17.5, 28.5, 14.5);
    ctx.quadraticCurveTo(25.5, 16.5, 22.3, 13);
    ctx.closePath();
    fillStroke(ctx, HAIR, 1.3, HAIR_LINE);
  }
  const ear = (x: number, y: number) => {
    const p: Path = () => ellipse(ctx, x, y, 2, 2.9);
    p();
    fillStroke(ctx, SKIN, 1.3, SKIN_LINE);
    ctx.beginPath();
    ctx.arc(x, y, 1.1, -1.2, 1.2);
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  if (side) ear(26, 15.5);
  else if (!back) {
    ear(21.5, 15.5);
    ear(42.5, 15.5);
  }
  if (!back) {
    // Brows.
    if (side) {
      seam(
        ctx,
        [
          [34.5, 12.6],
          [39.6, 13.2],
        ],
        HAIR,
        1.4,
      );
    } else {
      seam(
        ctx,
        [
          [25.4, 13.1],
          [30.2, 12.4],
        ],
        HAIR,
        1.4,
      );
      seam(
        ctx,
        [
          [33.8, 12.4],
          [38.6, 13.1],
        ],
        HAIR,
        1.4,
      );
    }
    const eye = (x: number, y: number) => {
      const h = 3 * (1 - blink);
      if (h < 0.4) {
        ctx.beginPath();
        ctx.moveTo(x - 2, y);
        ctx.lineTo(x + 2, y);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
      }
      ellipse(ctx, x, y, 2.3, h);
      fillStroke(ctx, '#ffffff', 0.9, SKIN_LINE);
      ellipse(ctx, x + 0.3, y + 0.4, 1.35, Math.min(2.1, h * 0.75));
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x - 0.3, y - 0.7, 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };
    if (side) {
      eye(37, 16);
      // Nose and the grin, in profile.
      ctx.beginPath();
      ctx.moveTo(41.5, 15.5);
      ctx.quadraticCurveTo(44, 17.5, 41.5, 19);
      ctx.strokeStyle = SKIN_LINE;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ellipse(ctx, 35.2, 19.2, 1.7, 1.1);
      ctx.fillStyle = BLUSH;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(36.5, 20.6);
      ctx.quadraticCurveTo(39, 23.4, 41.2, 20.6);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.3, MOUTH);
    } else {
      eye(28, 16);
      eye(36, 16);
      ctx.beginPath();
      ctx.moveTo(31, 18.4);
      ctx.quadraticCurveTo(32, 19.7, 33.2, 18.4);
      ctx.strokeStyle = SKIN_LINE;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // A wide, open grin, with the tongue behind the teeth: happy to be here.
      const grin: Path = () => {
        ctx.beginPath();
        ctx.moveTo(27, 19.8);
        ctx.quadraticCurveTo(32, 25.8, 37, 19.8);
        ctx.closePath();
      };
      for (const x of [25.3, 38.7]) {
        ellipse(ctx, x, 19.4, 2, 1.3);
        ctx.fillStyle = BLUSH;
        ctx.fill();
      }
      grin();
      fillStroke(ctx, '#ffffff', 1.4, MOUTH);
      ctx.save();
      grin();
      ctx.clip();
      ellipse(ctx, 32, 24.2, 2.8, 1.9);
      ctx.fillStyle = TONGUE;
      ctx.fill();
      ctx.restore();
    }
  }
  // Hair peeking out under the cap.
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.quadraticCurveTo(22, 15, 23.5, 15.5);
  ctx.lineTo(24.5, 11.5);
  ctx.closePath();
  fillStroke(ctx, HAIR, 1.3, HAIR_LINE);
  ctx.beginPath();
  ctx.moveTo(42, 12);
  ctx.quadraticCurveTo(42, 15, 40.5, 15.5);
  ctx.lineTo(39.5, 11.5);
  ctx.closePath();
  fillStroke(ctx, HAIR, 1.3, HAIR_LINE);
  // The brim's shadow on the forehead.
  if (!back) occlude(ctx, head, 11.5, 16.5, 0.26);

  // ── cap in the team colour ──
  const crown: Path = () => {
    ctx.beginPath();
    ctx.moveTo(21.5, 12);
    ctx.quadraticCurveTo(21, 2.5, 32, 2.5);
    ctx.quadraticCurveTo(43, 2.5, 42.5, 12);
    ctx.closePath();
  };
  crown();
  fillStroke(ctx, c.suit, 1.7, suitLine);
  volume(ctx, crown, c.suit, 1.3, 1.7);
  // Panel seams down from the button.
  seam(
    ctx,
    [
      [32, 3.2],
      [27.2, 11.6],
    ],
    suitLine,
    0.9,
  );
  seam(
    ctx,
    [
      [32, 3.2],
      [36.8, 11.6],
    ],
    suitLine,
    0.9,
  );
  gloss(ctx, 27, 6.2, 3.2, 1.5, -0.6, 0.35);
  circle(ctx, 32, 3, 1.4);
  fillStroke(ctx, c.suitLight, 1, suitLine);
  // Brim: forward from the front, to the side in profile, a strap at the back.
  if (back) {
    roundRect(ctx, 28, 9, 8, 2.4, 1);
    fillStroke(ctx, c.suitDark, 1.1, suitLine);
    circle(ctx, 32, 10.2, 0.7);
    ctx.fillStyle = c.suitLight;
    ctx.fill();
  } else if (side) {
    const brim: Path = () => {
      ctx.beginPath();
      ctx.moveTo(38, 11);
      ctx.quadraticCurveTo(46, 10.5, 48, 13);
      ctx.lineTo(38, 13.4);
      ctx.closePath();
    };
    brim();
    fillStroke(ctx, c.suitDark, 1.5, suitLine);
    seam(
      ctx,
      [
        [38.6, 13.1],
        [47.4, 12.9],
      ],
      dim(c.suitDark, 0.35),
      0.9,
    );
  } else {
    const brim: Path = () => ellipse(ctx, 32, 12, 12, 2.6);
    brim();
    fillStroke(ctx, c.suitDark, 1.5, suitLine);
    volume(ctx, brim, c.suitDark, 0.8, 1);
  }
  ctx.restore();
  ctx.restore();
}
