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
  HEAD_SCALE,
  INK,
  inkOnly,
  NECK_Y,
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

const SKIN = '#f5d3bf';
const SKIN_LINE = lineOf(SKIN);
const HAIR = '#6e3b26';
const HAIR_LIT = '#8f5236';
const BLAZER = '#4a4f5e';
const TROUSERS = '#2f3343';
const SNEAKER = '#f0efe9';
const LAPTOP = '#b9bec9';
const HEADSET = '#2b2b33';
const BAGS = 'rgba(122, 72, 120, 0.26)';
const COFFEE = '#5b3722';

/**
 * A Gestora, the engineering manager: a slate blazer over a team-coloured
 * tee, a headset round her neck from one meeting to the next, a badge on a
 * lanyard, a laptop under one arm and a tall glass mug of coffee in the
 * other hand. Long wavy hair swept to one side, a stray lock that gave up,
 * and the dark circles of a week of one-on-ones.
 */
export function paintGestora(ctx: Ctx, o: CharacterPose): void {
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
          ? -2
          : walking
            ? -1.2
            : Math.sin((t * TAU) / 3.4) * 0.5;
  const TEE = c.suit;
  beginFrame(ctx, o.facing);

  // ── the hair that falls behind her back, before the body covers it ──
  if (!back) {
    ctx.save();
    ctx.translate(32, NECK_Y + bob);
    ctx.scale(HEAD_SCALE, HEAD_SCALE);
    ctx.translate(-32, -NECK_Y);
    const mass: Path = () => {
      ctx.beginPath();
      if (side) {
        ctx.moveTo(31, 4);
        ctx.quadraticCurveTo(18.5, 4, 18.5, 15);
        ctx.quadraticCurveTo(17, 27, 20.5, 34.5);
        ctx.quadraticCurveTo(26, 36.5, 31, 33.5);
        ctx.quadraticCurveTo(29, 25, 30, 18);
      } else {
        ctx.moveTo(22, 9);
        ctx.quadraticCurveTo(17.5, 16, 18.5, 26);
        ctx.quadraticCurveTo(19, 32.5, 22.5, 34);
        ctx.lineTo(42, 35.5);
        ctx.quadraticCurveTo(48.5, 33, 47, 23);
        ctx.quadraticCurveTo(46.5, 12, 42, 8);
      }
      ctx.closePath();
    };
    mass();
    fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
    volume(ctx, mass, HAIR, 1.1, 1.6);
    ctx.restore();
  }

  bodyFrame(ctx);

  // ── legs ──
  const shoeAt = (x: number, by: number, fwd: number, rot = 0) => {
    const p: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.2, -3);
      ctx.lineTo(3.6, -3);
      ctx.quadraticCurveTo(5.5 + fwd, -1, 5.5 + fwd, 2);
      ctx.lineTo(-4.6, 2.4);
      ctx.closePath();
      ctx.restore();
    };
    p();
    fillStroke(ctx, SNEAKER, 1.7, lineOf(SNEAKER));
    volume(ctx, p, SNEAKER, 1.1, 1.4);
    seam(
      ctx,
      [
        [x - 4.4 + 0, by + 1.2],
        [x + 5 + fwd, by + 1.2],
      ],
      c.suit,
      1.1,
    );
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () => roundRect(ctx, x - 3, 41, 6, 12 - lift * 0.5, 2);
    p();
    fillStroke(ctx, TROUSERS, 1.7, lineOf(TROUSERS));
    volume(ctx, p, TROUSERS, 1, 1.4);
    shoeAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3, 0, 6, 9, 2);
        ctx.restore();
      };
      p();
      fillStroke(ctx, TROUSERS, 1.7, lineOf(TROUSERS));
      volume(ctx, p, TROUSERS, 1, 1.4);
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

  // ── blazer over the tee ──
  const hem = seated ? 41 : 44;
  const blazerPath: Path = () => {
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
  blazerPath();
  fillStroke(ctx, BLAZER, 1.7, lineOf(BLAZER));
  volume(ctx, blazerPath, BLAZER, 1.2, 1.8);
  if (back) {
    seam(
      ctx,
      [
        [32, 24],
        [32, hem - 1],
      ],
      lineOf(BLAZER),
      1.1,
    );
    ctx.beginPath();
    ctx.moveTo(25, 22.5);
    ctx.quadraticCurveTo(32, 26.5, 39, 22.5);
    ctx.strokeStyle = HEADSET;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // The tee in the opening, then the lapels over it.
    const teePath: Path = () => {
      ctx.beginPath();
      if (side) {
        ctx.moveTo(33.5, 22);
        ctx.lineTo(40, 22);
        ctx.lineTo(38.5, hem - 1);
        ctx.lineTo(35, hem - 1);
      } else {
        ctx.moveTo(26.5, 22);
        ctx.lineTo(37.5, 22);
        ctx.lineTo(36, hem - 1);
        ctx.lineTo(28, hem - 1);
      }
      ctx.closePath();
    };
    teePath();
    fillStroke(ctx, TEE, 1.6, lineOf(TEE));
    volume(ctx, teePath, TEE, 0.9, 1.2);
    // A crew neck of skin above the tee.
    if (!side) {
      ctx.beginPath();
      ctx.moveTo(28.5, 22);
      ctx.quadraticCurveTo(32, 25, 35.5, 22);
      ctx.closePath();
      fillStroke(ctx, SKIN, 1.2, SKIN_LINE);
    }
    const lapel = (pts: readonly (readonly [number, number])[]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      fillStroke(ctx, BLAZER, 1.4, lineOf(BLAZER));
    };
    if (side) {
      lapel([
        [33, 22],
        [35.5, 22],
        [36.5, 28],
        [34.5, 27],
        [35, 33],
      ]);
    } else {
      lapel([
        [25.5, 22],
        [28, 22],
        [29, 31],
        [27, 28],
        [28.4, 37],
      ]);
      lapel([
        [38.5, 22],
        [36, 22],
        [35, 31],
        [37, 28],
        [35.6, 37],
      ]);
      // Breast pocket with a pen.
      seam(
        ctx,
        [
          [38.5, 33],
          [43, 33],
        ],
        lineOf(BLAZER),
        1.2,
      );
      seam(
        ctx,
        [
          [40, 30.5],
          [40, 33],
        ],
        c.suitLight,
        1.2,
      );
    }
    // Lanyard and badge.
    ctx.beginPath();
    if (side) {
      ctx.moveTo(33, 23);
      ctx.lineTo(37, 31);
    } else {
      ctx.moveTo(29, 22.5);
      ctx.lineTo(32, 31);
      ctx.lineTo(35, 22.5);
    }
    ctx.strokeStyle = c.suitDark;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    const bx = side ? 37 : 32;
    roundRect(ctx, bx - 2.6, 31, 5.2, 6.4, 0.8);
    fillStroke(ctx, '#fbfaf6', 1.1, lineOf('#fbfaf6'));
    roundRect(ctx, bx - 1.7, 32, 2.2, 2.4, 0.4);
    ctx.fillStyle = HAIR;
    ctx.fill();
    seam(
      ctx,
      [
        [bx - 1.6, 35.5],
        [bx + 1.6, 35.5],
      ],
      c.suit,
      0.9,
    );
    // The headset, round the neck: band and an ear cup each side.
    if (side) {
      ctx.beginPath();
      ctx.moveTo(26, 22.5);
      ctx.quadraticCurveTo(32, 26, 38, 23);
      ctx.strokeStyle = HEADSET;
      ctx.lineWidth = 2;
      ctx.stroke();
      ellipse(ctx, 37.5, 24, 2.2, 2.6);
      fillStroke(ctx, HEADSET, 1.1, INK);
      seam(
        ctx,
        [
          [38.5, 25],
          [41.5, 27.5],
        ],
        HEADSET,
        1.1,
      );
    } else {
      ctx.beginPath();
      ctx.moveTo(25, 23);
      ctx.quadraticCurveTo(32, 27.5, 39, 23);
      ctx.strokeStyle = HEADSET;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (const x of [24.5, 39.5]) {
        ellipse(ctx, x, 24.5, 2.3, 2.7);
        fillStroke(ctx, HEADSET, 1.1, INK);
        circle(ctx, x, 24.5, 1);
        ctx.fillStyle = c.suit;
        ctx.fill();
      }
      // The boom mic, swung down, off.
      ctx.beginPath();
      ctx.moveTo(24.5, 26.5);
      ctx.quadraticCurveTo(24, 30, 27, 31);
      ctx.strokeStyle = HEADSET;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      circle(ctx, 27.4, 31, 0.9);
      ctx.fillStyle = HEADSET;
      ctx.fill();
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
    ctx.strokeStyle = lineOf(BLAZER);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = BLAZER;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.8);
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    }
  };
  /** The tall glass mug: coffee two-thirds up, a handle, a little steam. */
  const mug = (x: number, y: number, tilt = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.arc(3.8, -0.5, 2.4, -1.3, 1.3);
    ctx.strokeStyle = lineOf('#cfe1e6');
    ctx.lineWidth = 1.4;
    ctx.stroke();
    roundRect(ctx, -3.3, -5, 6.6, 9.5, 1.4);
    ctx.fillStyle = 'rgba(214, 233, 238, 0.55)';
    ctx.fill();
    roundRect(ctx, -2.6, -1.8, 5.2, 5.6, 1);
    ctx.fillStyle = COFFEE;
    ctx.fill();
    roundRect(ctx, -3.3, -5, 6.6, 9.5, 1.4);
    ctx.strokeStyle = lineOf('#cfe1e6');
    ctx.lineWidth = 1.3;
    ctx.stroke();
    gloss(ctx, -1.8, -2.5, 0.6, 2, 0, 0.7);
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3);
    for (const dx of [-1, 1.2]) {
      const w = Math.sin(t * 2.4 + dx) * 0.8;
      ctx.beginPath();
      ctx.moveTo(dx, -6);
      ctx.quadraticCurveTo(dx + 1.2 + w, -8, dx + w, -10);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();
  };
  /** The laptop, closed, under the arm: a sticker of the team's colour. */
  const laptop = (x: number, y: number, rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const p: Path = () => roundRect(ctx, -5, -3.6, 10, 7.2, 1.2);
    p();
    fillStroke(ctx, LAPTOP, 1.5, lineOf(LAPTOP));
    volume(ctx, p, LAPTOP, 0.8, 1.1);
    circle(ctx, 1.5, -0.5, 1.4);
    ctx.fillStyle = c.suit;
    ctx.fill();
    roundRect(ctx, -3.5, 0.6, 2.6, 1.6, 0.4);
    ctx.fillStyle = '#f2c94c';
    ctx.fill();
    ctx.restore();
  };
  if (seated) {
    if (side) sleeve(37, 25, 44, 33, 42, 29);
    else {
      sleeve(22, 25, 26, 34, 18, 31);
      sleeve(42, 25, 38, 34, 46, 31);
    }
  } else if (placing) {
    if (side) {
      sleeve(37, 25, 43, 31, 47, 38);
      mug(49, 36);
    } else if (back) {
      sleeve(22, 25, 18, 33, 19, 40);
      sleeve(42, 25, 46, 33, 45, 40);
    } else {
      sleeve(22, 25, 18, 33, 17.5, 37);
      mug(16.5, 34.5);
      sleeve(42, 25, 44, 33, 38, 41);
    }
  } else if (scared) {
    if (side) {
      sleeve(37, 25, 42, 20, 40, 14);
      mug(40, 10, 0.5);
    } else {
      sleeve(22, 25, 17, 19, 21, 13);
      mug(20, 9, -0.4);
      sleeve(42, 25, 47, 19, 43, 13);
    }
  } else if (cheering) {
    if (side) {
      sleeve(37, 25, 42, 17, 44, 9);
      mug(45, 5.5);
    } else {
      sleeve(22, 25, 16, 18, 14, 10);
      mug(13.5, 6.5);
      sleeve(42, 25, 48, 18, 50, 10);
    }
  } else if (side) {
    const sw = walking ? step * 5 : 0;
    if (!back) laptop(28, 32, -0.1);
    sleeve(37, 25, 40 + sw, 36, 43 + sw * 0.5, 33);
    mug(45 + sw * 0.5, 31);
  } else if (walking) {
    laptop(47.5, 32.5, 1.45);
    sleeve(42, 25, 46.5, 33, 44, 38);
    sleeve(22, 25, 17 + step * 1.5, 38 + step * 2, 18, 33);
    mug(17, 31);
  } else {
    // Laptop pinned between arm and ribs, mug held up near the chin.
    laptop(47.5, 32.5, 1.45);
    sleeve(42, 25, 46.5, 33, 44, 38);
    sleeve(22, 25, 17.5, 33, 18.5, 33);
    mug(17.5, 31);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN, 1.7, SKIN_LINE);
  volume(ctx, head, SKIN, 1.3, 1.8);
  if (!back) {
    /** Heavy lids: the top of each eye is skin, and a ring under it. */
    const eye = (x: number, y: number) => {
      const lid = Math.min(1, 0.42 + blink * 0.58);
      ctx.beginPath();
      ctx.arc(x, y + 3, 2.4, 0.25, Math.PI - 0.25);
      ctx.strokeStyle = BAGS;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (lid > 0.92) {
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 0.6);
        ctx.quadraticCurveTo(x, y + 1.4, x + 2, y + 0.6);
        inkOnly(ctx, 1.5);
        return;
      }
      ellipse(ctx, x, y, 2.3, 2.6);
      fillStroke(ctx, '#ffffff', 0.9, SKIN_LINE);
      ellipse(ctx, x + 0.3, y + 0.7, 1.4, 1.8);
      ctx.fillStyle = '#5a4630';
      ctx.fill();
      circle(ctx, x + 0.3, y + 0.8, 0.8);
      ctx.fillStyle = INK;
      ctx.fill();
      const lidY = y - 2.6 + lid * 5.2;
      ctx.save();
      ellipse(ctx, x, y, 2.4, 2.7);
      ctx.clip();
      ctx.fillStyle = SKIN;
      ctx.fillRect(x - 3, y - 3, 6, lidY - (y - 3));
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x - 2.5, lidY + 0.2);
      ctx.quadraticCurveTo(x, lidY - 0.6, x + 2.5, lidY + 0.2);
      inkOnly(ctx, 1.5);
      seam(
        ctx,
        [
          [x + 2.3, lidY],
          [x + 3.1, lidY - 0.6],
        ],
        INK,
        1.1,
      );
    };
    if (side) {
      eye(37, 16);
      ctx.beginPath();
      ctx.moveTo(34.5, 11.6);
      ctx.quadraticCurveTo(37, 10.8, 39.5, 11.9);
      inkOnly(ctx, 1.3);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.8);
      ctx.quadraticCurveTo(43.6, 17.6, 41.5, 18.8);
      inkOnly(ctx, 1.4);
      ctx.beginPath();
      ctx.moveTo(37.2, 21.2);
      ctx.quadraticCurveTo(39.2, 22.2, 40.8, 20.6);
      inkOnly(ctx, 1.3);
      ellipse(ctx, 35, 19.5, 1.8, 1);
      ctx.fillStyle = 'rgba(232, 120, 120, 0.2)';
      ctx.fill();
    } else {
      eye(28, 16);
      eye(36, 16);
      // Brows lifted in the middle: trying.
      ctx.beginPath();
      ctx.moveTo(25.2, 12.2);
      ctx.quadraticCurveTo(27.5, 11.6, 30.2, 11);
      ctx.moveTo(33.8, 11);
      ctx.quadraticCurveTo(36.5, 11.6, 38.8, 12.2);
      inkOnly(ctx, 1.3);
      seam(
        ctx,
        [
          [32.4, 18.6],
          [31.6, 19.2],
        ],
        SKIN_LINE,
        1,
      );
      // A small lopsided smile.
      ctx.beginPath();
      ctx.moveTo(29.6, 21);
      ctx.quadraticCurveTo(32.4, 22.8, 35.2, 20.3);
      inkOnly(ctx, 1.3);
      for (const x of [25.2, 38.8]) {
        ellipse(ctx, x, 19.3, 1.8, 1);
        ctx.fillStyle = 'rgba(232, 120, 120, 0.2)';
        ctx.fill();
      }
    }
  }

  // ── hair over the head ──
  const cap: Path = () => {
    ctx.beginPath();
    if (back) {
      ctx.moveTo(21, 13);
      ctx.quadraticCurveTo(21, 3, 32, 3);
      ctx.quadraticCurveTo(43, 3, 43, 13);
      ctx.quadraticCurveTo(45.5, 23, 43.5, 32.5);
      ctx.quadraticCurveTo(32, 35, 20.5, 32);
      ctx.quadraticCurveTo(18.5, 23, 21, 13);
    } else if (side) {
      ctx.moveTo(21.5, 17);
      ctx.quadraticCurveTo(20, 3, 32, 3);
      ctx.quadraticCurveTo(41.5, 3, 43, 10.5);
      ctx.quadraticCurveTo(38.5, 8, 35, 9.5);
      ctx.quadraticCurveTo(31, 11, 30, 17);
      ctx.quadraticCurveTo(26, 20, 21.5, 17);
    } else {
      // Side part on her right; the rest swept across and down her left.
      ctx.moveTo(21.8, 14.5);
      ctx.quadraticCurveTo(20.5, 3, 29.5, 3);
      ctx.quadraticCurveTo(42.5, 2.5, 44, 12);
      ctx.quadraticCurveTo(45, 19, 43, 25.5);
      ctx.lineTo(40.6, 24);
      ctx.quadraticCurveTo(41.4, 16, 38.5, 11.2);
      ctx.quadraticCurveTo(33.5, 6.8, 27.5, 7.4);
      ctx.quadraticCurveTo(23.8, 9.2, 21.8, 14.5);
    }
    ctx.closePath();
  };
  cap();
  fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
  volume(ctx, cap, HAIR, 1.2, 1.6);
  // Waves: light strands following the sweep.
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = HAIR_LIT;
  ctx.beginPath();
  if (back) {
    ctx.moveTo(27, 6);
    ctx.quadraticCurveTo(24, 18, 26, 32);
    ctx.moveTo(36, 6);
    ctx.quadraticCurveTo(40, 18, 38, 33);
    ctx.moveTo(32, 9);
    ctx.quadraticCurveTo(30, 22, 32.5, 34);
  } else if (side) {
    ctx.moveTo(30, 5);
    ctx.quadraticCurveTo(24, 8, 23.5, 15);
    ctx.moveTo(36, 5);
    ctx.quadraticCurveTo(32, 8, 31, 13);
  } else {
    ctx.moveTo(28.5, 4.5);
    ctx.quadraticCurveTo(37, 4.5, 41.5, 10);
    ctx.moveTo(30, 6);
    ctx.quadraticCurveTo(39, 7, 42.5, 17);
  }
  ctx.stroke();
  // The lock that falls over her left shoulder, in front of the blazer.
  if (!back && !side) {
    const lock: Path = () => {
      ctx.beginPath();
      ctx.moveTo(42.5, 19);
      ctx.quadraticCurveTo(47.5, 25, 45.5, 32);
      ctx.quadraticCurveTo(44.5, 36, 41.5, 35.5);
      ctx.quadraticCurveTo(43.5, 31, 41.8, 26.5);
      ctx.quadraticCurveTo(40.6, 23.5, 40.6, 22);
      ctx.closePath();
    };
    lock();
    fillStroke(ctx, HAIR, 1.5, lineOf(HAIR));
    volume(ctx, lock, HAIR, 0.9, 1.2);
  }
  // The stray lock that gave up on the day.
  ctx.beginPath();
  if (side) {
    ctx.moveTo(30, 3.4);
    ctx.quadraticCurveTo(28.5, -0.5, 32, -0.8);
  } else {
    ctx.moveTo(30.5, 3.2);
    ctx.quadraticCurveTo(28.8, -0.6, 32.4, -1);
    ctx.quadraticCurveTo(34, -0.6, 33.2, 1);
  }
  ctx.strokeStyle = lineOf(HAIR);
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  if (scared && !back) {
    scaredFace(
      ctx,
      side
        ? [[37, 16]]
        : [
            [28, 16],
            [36, 16],
          ],
      side ? [39.5, 21.5] : [32, 22],
      SKIN_LINE,
    );
  }
  ctx.restore();
  ctx.restore();
}
