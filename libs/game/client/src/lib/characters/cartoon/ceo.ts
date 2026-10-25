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

const SKIN = '#eec1a0';
const SKIN_LINE = lineOf(SKIN);
const HAIR = '#4a372b';
const HAIR_LIT = '#6a5242';
const GREY = '#b5aea6';
const VEST = '#26324a';
const CHINOS = '#c7b08a';
const SNEAKER = '#f4f3ee';
const PHONE = '#22252c';
const CAN = '#d9dde4';
const VEINS = 'rgba(214, 64, 64, 0.6)';
const BAGS = 'rgba(122, 72, 120, 0.32)';
const SWEAT = '#bfe6ff';
const WATCH = '#1d1f24';
const BUD = '#fbfbf8';

/**
 * O CEO Nervosinho, the founder who never sleeps: a navy fleece vest zipped
 * over a team-coloured shirt with the sleeves rolled up, khaki chinos,
 * sneakers, a smartwatch and one earbud. A phone in one hand with the chart
 * going down, an energy drink in the other — the fourth of the night.
 * Bloodshot eyes wide open, one of them twitching, dark rings, a sweat drop
 * and a clenched-teeth smile that says everything is fine. The combed-back
 * hair has gone grey at the temples and is coming loose; standing still, he
 * trembles.
 */
export function paintCeo(ctx: Ctx, o: CharacterPose): void {
  const c = teamFor(o.slot);
  const t = o.t ?? 0;
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
        ? -3.4
        : scared
          ? -2
          : walking
            ? -1.4
            : Math.sin((t * TAU) / 2.6) * 0.45;
  const SHIRT = c.suit;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: chinos and sneakers ──
  const shoeAt = (x: number, by: number, fwd: number, rot = 0) => {
    const p: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.4, -3.2);
      ctx.lineTo(4, -3.2);
      ctx.quadraticCurveTo(5.8 + fwd, -1, 5.6 + fwd, 2.2);
      ctx.lineTo(-4.8, 2.4);
      ctx.closePath();
      ctx.restore();
    };
    p();
    fillStroke(ctx, SNEAKER, 1.7, lineOf(SNEAKER));
    volume(ctx, p, SNEAKER, 1.12, 1.4);
    seam(
      ctx,
      [
        [x - 4.5, by + 1.3],
        [x + 5.2 + fwd, by + 1.3],
      ],
      lineOf(SNEAKER),
      1,
    );
    circle(ctx, x - 2.4, by - 0.6, 0.9);
    ctx.fillStyle = c.suit;
    ctx.fill();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () => roundRect(ctx, x - 3.1, 41, 6.2, 12 - lift * 0.5, 2);
    p();
    fillStroke(ctx, CHINOS, 1.7, lineOf(CHINOS));
    volume(ctx, p, CHINOS, 1, 1.4);
    // The cuff, rolled once: ankles on show, no socks.
    seam(
      ctx,
      [
        [x - 3, 51.6 - lift],
        [x + 3, 51.6 - lift],
      ],
      lineOf(CHINOS),
      1,
    );
    shoeAt(x, 55 - lift, fwd);
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      const p: Path = () => {
        ctx.save();
        ctx.translate(hx, 40);
        ctx.rotate(dir * 0.35);
        roundRect(ctx, -3.1, 0, 6.2, 9, 2);
        ctx.restore();
      };
      p();
      fillStroke(ctx, CHINOS, 1.7, lineOf(CHINOS));
      volume(ctx, p, CHINOS, 1, 1.4);
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
  // Never quite still: a fine tremble above the knees while he stands.
  const idle = !walking && !placing && !cheering && !scared && !seated;
  ctx.translate(idle ? Math.sin(t * TAU * 9) * 0.35 : 0, 0);

  // ── shirt, then the vest over it ──
  const hem = seated ? 41 : 44;
  const shirtPath: Path = () => {
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
  shirtPath();
  fillStroke(ctx, SHIRT, 1.7, lineOf(SHIRT));
  volume(ctx, shirtPath, SHIRT, 1.1, 1.6);
  // The vest: no sleeves, cut in at the arms, a high zipped collar.
  const vestPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(26, 21.5);
      ctx.lineTo(39.5, 21.5);
      ctx.quadraticCurveTo(42.5, 32, 42, hem - 0.5);
      ctx.lineTo(23.5, hem - 0.5);
      ctx.quadraticCurveTo(23, 30, 26, 21.5);
    } else {
      ctx.moveTo(24, 21.5);
      ctx.lineTo(40, 21.5);
      ctx.quadraticCurveTo(43, 25, 44.5, 30);
      ctx.quadraticCurveTo(45.5, 37, 44.8, hem - 0.5);
      ctx.lineTo(19.2, hem - 0.5);
      ctx.quadraticCurveTo(18.5, 37, 19.5, 30);
      ctx.quadraticCurveTo(21, 25, 24, 21.5);
    }
    ctx.closePath();
  };
  vestPath();
  fillStroke(ctx, VEST, 1.7, lineOf(VEST));
  volume(ctx, vestPath, VEST, 1.25, 1.8);
  // Quilted fleece: two soft horizontal seams.
  for (const y of [30, 37]) {
    seam(
      ctx,
      side
        ? [
            [24.5, y],
            [41.5, y],
          ]
        : [
            [20, y],
            [44, y],
          ],
      lineOf(VEST),
      0.9,
    );
  }
  if (back) {
    // The collar from behind.
    roundRect(ctx, 25, 20, 14, 3.4, 1.4);
    fillStroke(ctx, VEST, 1.4, lineOf(VEST));
  } else {
    if (side) {
      roundRect(ctx, 33, 20, 7, 3.4, 1.4);
      fillStroke(ctx, VEST, 1.4, lineOf(VEST));
      seam(
        ctx,
        [
          [39, 22],
          [40.5, hem - 1],
        ],
        '#c9ccd4',
        0.9,
      );
    } else {
      // A shirt collar peeking out, then the zipped fleece collar.
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(32, 23);
        ctx.lineTo(32 + dir * 4.6, 20.6);
        ctx.lineTo(32 + dir * 3.8, 24.4);
        ctx.closePath();
        fillStroke(ctx, SHIRT, 1.2, lineOf(SHIRT));
      }
      roundRect(ctx, 25.5, 21, 13, 3, 1.3);
      fillStroke(ctx, VEST, 1.4, lineOf(VEST));
      seam(
        ctx,
        [
          [32, 21.5],
          [32, hem - 1],
        ],
        '#c9ccd4',
        0.9,
      );
      // The zip pull, a little silver tab.
      roundRect(ctx, 31.2, 24, 1.6, 2.6, 0.5);
      ctx.fillStyle = '#dfe2e8';
      ctx.fill();
      // The logo patch on the chest, in the team's light colour.
      circle(ctx, 38.6, 27.2, 1.6);
      ctx.fillStyle = c.suitLight;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(37.8, 27.6);
      ctx.lineTo(38.6, 26.4);
      ctx.lineTo(39.4, 27.6);
      ctx.strokeStyle = VEST;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  // ── arms: rolled shirt sleeves, a watch on the left wrist ──
  const sleeve = (
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    hx: number,
    hy: number,
    hand = true,
    watch = false,
  ) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = lineOf(SHIRT);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = SHIRT;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    // The forearm, bare from the roll to the hand.
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 6.4;
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    circle(ctx, ex, ey, 2.7);
    fillStroke(ctx, SHIRT, 1.3, lineOf(SHIRT));
    if (watch) {
      const wx = ex + (hx - ex) * 0.62;
      const wy = ey + (hy - ey) * 0.62;
      circle(ctx, wx, wy, 1.9);
      fillStroke(ctx, WATCH, 1, INK);
      circle(ctx, wx, wy, 0.9);
      ctx.fillStyle = c.glow;
      ctx.fill();
    }
    if (hand) {
      circle(ctx, hx, hy, 2.8);
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    }
  };
  /** The phone: a dark slab, the runway chart on screen, going down. */
  const phone = (x: number, y: number, tilt = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    roundRect(ctx, -2.4, -4.2, 4.8, 8.4, 1.1);
    fillStroke(ctx, PHONE, 1.2, INK);
    roundRect(ctx, -1.7, -3.4, 3.4, 6.6, 0.6);
    ctx.fillStyle = '#f4f6fa';
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-1.3, -2.2);
    ctx.lineTo(-0.4, -0.8);
    ctx.lineTo(0.2, -1.4);
    ctx.lineTo(1.3, 2.4);
    ctx.strokeStyle = '#e04848';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // A notification badge: another investor asking.
    circle(ctx, 1.9, -3.7, 1);
    ctx.fillStyle = '#ff4d4d';
    ctx.fill();
    ctx.restore();
  };
  /** The energy drink: a tall can, a bolt in the team's glow. */
  const can = (x: number, y: number, tilt = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const body: Path = () => roundRect(ctx, -2.6, -4.6, 5.2, 9.4, 1);
    body();
    fillStroke(ctx, CAN, 1.3, lineOf(CAN));
    volume(ctx, body, CAN, 0.9, 1.2);
    roundRect(ctx, -2.6, -2.6, 5.2, 5, 0.4);
    ctx.fillStyle = PHONE;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.6, -2.2);
    ctx.lineTo(-1, 0.3);
    ctx.lineTo(0.3, 0.3);
    ctx.lineTo(-0.6, 2.2);
    ctx.lineTo(1.2, -0.5);
    ctx.lineTo(-0.1, -0.5);
    ctx.closePath();
    ctx.fillStyle = c.glow;
    ctx.fill();
    seam(
      ctx,
      [
        [-2.2, -4.3],
        [2.2, -4.3],
      ],
      lineOf(CAN),
      0.8,
    );
    gloss(ctx, -1.7, 3, 0.4, 1, 0, 0.7);
    ctx.restore();
  };
  if (seated) {
    if (side) sleeve(37, 25, 41, 31, 42, 29);
    else {
      sleeve(22, 25, 21, 31, 18, 31, true, true);
      sleeve(42, 25, 43, 31, 46, 31);
    }
  } else if (placing) {
    if (side) {
      sleeve(37, 25, 42, 31, 47, 38);
      phone(48.5, 35, 0.3);
    } else if (back) {
      sleeve(22, 25, 18, 32, 19, 40);
      sleeve(42, 25, 46, 32, 45, 40);
    } else {
      sleeve(22, 25, 19, 32, 17.5, 37, true, true);
      can(16.5, 33.5);
      sleeve(42, 25, 44, 32, 38, 41);
    }
  } else if (scared) {
    if (side) {
      sleeve(37, 25, 41, 20, 40, 14);
      phone(40, 10, 0.4);
    } else {
      sleeve(22, 25, 18, 19, 21, 13, true, true);
      can(20, 9, -0.4);
      sleeve(42, 25, 46, 19, 43, 13);
      phone(43, 9, 0.3);
    }
  } else if (cheering) {
    // Both arms up, phone held high: "best quarter ever", going on LinkedIn.
    if (side) {
      sleeve(37, 25, 41, 18, 44, 9);
      phone(45, 5.5, 0.2);
    } else {
      sleeve(22, 25, 17, 18, 14, 10, true, true);
      can(13.5, 6.5, -0.2);
      sleeve(42, 25, 47, 18, 50, 10);
      phone(50.5, 5.5, 0.25);
    }
  } else if (side) {
    // Phone held out in front, walking and typing.
    const sw = walking ? step * 4 : 0;
    sleeve(37, 25, 40 + sw * 0.5, 33, 43 + sw * 0.4, 29, true, true);
    phone(44.5 + sw * 0.4, 26.5, 0.25);
  } else if (walking) {
    sleeve(22, 25, 18 + step * 1.5, 33, 17, 37 + step * 2, true, true);
    can(16.5, 34 + step * 2);
    sleeve(42, 25, 46, 32, 44, 30);
    phone(44, 27.5, 0.15);
  } else {
    // Can down by the hip, phone up at chest height, thumb scrolling.
    sleeve(22, 25, 18.5, 32, 17.5, 38, true, true);
    can(17, 35);
    sleeve(42, 25, 46.5, 32, 43.5, 30);
    phone(43.5, 27.2 + Math.sin(t * 2) * 0.3, 0.15);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN, 1.7, SKIN_LINE);
  volume(ctx, head, SKIN, 1.3, 1.8);
  if (!back) {
    // His right eye twitches, in bursts.
    const twitch = Math.sin(t * TAU * 0.7) > 0.8 && Math.sin(t * TAU * 11) > 0;
    /** Wide open and never closing: tiny pupils, red veins, dark rings. */
    const eye = (x: number, y: number, twitching = false) => {
      ctx.beginPath();
      ctx.arc(x, y + 3.4, 2.6, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = BAGS;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ellipse(ctx, x, y, 2.6, 3);
      fillStroke(ctx, '#ffffff', 0.9, SKIN_LINE);
      ctx.strokeStyle = VEINS;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(x - 2.4, y + 0.4);
      ctx.lineTo(x - 1.3, y + 0.1);
      ctx.lineTo(x - 0.9, y + 0.7);
      ctx.moveTo(x + 2.4, y - 0.3);
      ctx.lineTo(x + 1.4, y + 0.3);
      ctx.moveTo(x + 2.1, y + 1.3);
      ctx.lineTo(x + 1.2, y + 1);
      ctx.stroke();
      circle(ctx, x + 0.2, y + 0.2, 0.8);
      ctx.fillStyle = INK;
      ctx.fill();
      if (twitching) {
        // The lid jumps halfway down and back.
        ctx.save();
        ellipse(ctx, x, y, 2.7, 3.1);
        ctx.clip();
        ctx.fillStyle = SKIN;
        ctx.fillRect(x - 3, y - 3.2, 6, 2.6);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(x - 2.6, y - 0.5);
        ctx.quadraticCurveTo(x, y - 1.1, x + 2.6, y - 0.5);
        inkOnly(ctx, 1.3);
      }
    };
    /** A sweat drop sliding down the temple, then starting again. */
    const sweat = (x: number, y: number) => {
      const slide = ((t * 0.6) % 1) * 4;
      ctx.beginPath();
      ctx.moveTo(x, y + slide - 1.8);
      ctx.quadraticCurveTo(x + 1.3, y + slide + 0.4, x, y + slide + 1);
      ctx.quadraticCurveTo(x - 1.3, y + slide + 0.4, x, y + slide - 1.8);
      fillStroke(ctx, SWEAT, 0.8, lineOf(SWEAT));
    };
    if (side) {
      eye(37.5, 15.5, twitch);
      // The brow, pushed up in the middle: worried.
      ctx.beginPath();
      ctx.moveTo(34.4, 10.2);
      ctx.quadraticCurveTo(37.5, 10.4, 40.2, 11.8);
      inkOnly(ctx, 1.4);
      // Nose.
      ctx.beginPath();
      ctx.moveTo(41.5, 15.2);
      ctx.quadraticCurveTo(44, 17.4, 41.6, 18.6);
      inkOnly(ctx, 1.4);
      // Teeth clenched, from the side.
      roundRect(ctx, 36, 20, 5, 2.4, 0.8);
      fillStroke(ctx, '#ffffff', 1.1, INK);
      seam(
        ctx,
        [
          [36.3, 21.2],
          [40.7, 21.2],
        ],
        'rgba(28, 21, 17, 0.45)',
        0.5,
      );
      sweat(33.5, 9.5);
    } else {
      eye(28, 15.5);
      eye(36, 15.5, twitch);
      // Brows up in the middle: everything is fine, everything is fine.
      ctx.beginPath();
      ctx.moveTo(24.8, 11.6);
      ctx.quadraticCurveTo(27.6, 11.4, 30.4, 9.8);
      ctx.moveTo(33.6, 9.8);
      ctx.quadraticCurveTo(36.4, 11.4, 39.2, 11.6);
      inkOnly(ctx, 1.4);
      seam(
        ctx,
        [
          [32.4, 18],
          [31.4, 18.8],
        ],
        SKIN_LINE,
        1,
      );
      // The smile with every tooth clenched: a wide white bar.
      ctx.beginPath();
      ctx.moveTo(27, 20.4);
      ctx.quadraticCurveTo(32, 21.6, 37, 20);
      ctx.lineTo(36.6, 23);
      ctx.quadraticCurveTo(32, 24, 27.4, 23.2);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.2, INK);
      ctx.beginPath();
      ctx.moveTo(27.3, 21.8);
      ctx.quadraticCurveTo(32, 22.8, 36.8, 21.5);
      for (const x of [29.5, 32, 34.5]) {
        ctx.moveTo(x, 20.9);
        ctx.lineTo(x, 23.4);
      }
      ctx.strokeStyle = 'rgba(28, 21, 17, 0.45)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      sweat(40.6, 10.5);
      // The earbud in his right ear.
      circle(ctx, 22, 17.2, 1.2);
      fillStroke(ctx, BUD, 0.9, lineOf(BUD));
      seam(
        ctx,
        [
          [22, 18.2],
          [22.2, 20.4],
        ],
        BUD,
        1,
      );
    }
  }

  // ── hair: combed back, grey at the temples ──
  const cap: Path = () => {
    ctx.beginPath();
    if (back) {
      ctx.moveTo(21.2, 15);
      ctx.quadraticCurveTo(20.6, 3.5, 32, 3.2);
      ctx.quadraticCurveTo(43.4, 3.5, 42.8, 15);
      ctx.quadraticCurveTo(42.5, 19.5, 40, 21);
      ctx.quadraticCurveTo(32, 22.8, 24, 21);
      ctx.quadraticCurveTo(21.5, 19.5, 21.2, 15);
    } else if (side) {
      ctx.moveTo(22, 17);
      ctx.quadraticCurveTo(20.4, 4, 31, 2.6);
      ctx.quadraticCurveTo(40.5, 2, 42.6, 9.5);
      ctx.quadraticCurveTo(38, 7.4, 33.5, 8.2);
      ctx.quadraticCurveTo(29.5, 9, 28.5, 13.5);
      ctx.quadraticCurveTo(26, 17.5, 22, 17);
    } else {
      // A swept-back quiff: up off the forehead, flat over the sides.
      ctx.moveTo(21.4, 14.5);
      ctx.quadraticCurveTo(20.4, 4.5, 27.5, 2.6);
      ctx.quadraticCurveTo(33, 0.6, 38.5, 2.4);
      ctx.quadraticCurveTo(43.8, 4.8, 42.6, 14.5);
      ctx.quadraticCurveTo(41.6, 10, 38.2, 8.4);
      ctx.quadraticCurveTo(32, 6.6, 25.8, 8.4);
      ctx.quadraticCurveTo(22.4, 10, 21.4, 14.5);
    }
    ctx.closePath();
  };
  cap();
  fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
  volume(ctx, cap, HAIR, 1.2, 1.6);
  // Comb lines, all running back.
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = HAIR_LIT;
  ctx.beginPath();
  if (back) {
    for (const x of [27, 32, 37]) {
      ctx.moveTo(x, 4.5);
      ctx.quadraticCurveTo(x + (x - 32) * 0.15, 12, x, 19.5);
    }
  } else if (side) {
    ctx.moveTo(38, 4.2);
    ctx.quadraticCurveTo(30, 3.5, 25, 9);
    ctx.moveTo(39.5, 6.5);
    ctx.quadraticCurveTo(32, 5.8, 27, 12);
  } else {
    ctx.moveTo(26.5, 6.5);
    ctx.quadraticCurveTo(29, 2.8, 32.5, 2.4);
    ctx.moveTo(31, 6.4);
    ctx.quadraticCurveTo(34, 2.6, 38, 3.4);
    ctx.moveTo(35.5, 6.8);
    ctx.quadraticCurveTo(39.5, 4.6, 41.4, 8.5);
  }
  ctx.stroke();
  // Grey at the temples: the last funding round.
  ctx.strokeStyle = GREY;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (side) {
    ctx.moveTo(24.6, 10.5);
    ctx.quadraticCurveTo(23.2, 13.5, 23.6, 16.2);
  } else {
    const top = back ? 11 : 8.8;
    const low = back ? 19 : 13.8;
    for (const dir of [-1, 1]) {
      ctx.moveTo(32 + dir * 9.6, top);
      ctx.quadraticCurveTo(
        32 + dir * 10.6,
        (top + low) / 2,
        32 + dir * 10.2,
        low,
      );
    }
  }
  // And one streak through the top, new since the last round.
  if (!side) {
    ctx.moveTo(29.5, back ? 4.5 : 7.4);
    ctx.quadraticCurveTo(30.5, 4, 32.5, back ? 9 : 2.8);
  }
  ctx.stroke();
  // The strands that came loose from the comb.
  if (!back) {
    const strands: readonly (readonly [
      number,
      number,
      number,
      number,
      number,
      number,
    ])[] = side
      ? [
          [31, 3, 30, 0.6, 31.8, 0],
          [35, 2.8, 35.6, 0.8, 37.2, 0.8],
        ]
      : [
          [29, 2.6, 27.8, 0.2, 29.4, -0.4],
          [33, 1.6, 33.4, -0.8, 35, -0.6],
          [37.5, 2.6, 39.4, 1.4, 40.2, 2.6],
        ];
    for (const [x0, y0, cx, cy, x1, y1] of strands) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.strokeStyle = lineOf(HAIR);
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.strokeStyle = HAIR;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';

  if (scared && !back) {
    scaredFace(
      ctx,
      side
        ? [[37.5, 15.5]]
        : [
            [28, 15.5],
            [36, 15.5],
          ],
      side ? [39.5, 21.5] : [32, 22],
      SKIN_LINE,
    );
  }
  ctx.restore();
  ctx.restore();
}
