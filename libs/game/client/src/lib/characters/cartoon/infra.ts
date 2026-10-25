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

const SKIN = '#e9bc98';
const SKIN_LINE = lineOf(SKIN);
const HAIR = '#8b5a2e';
const HAIR_LIT = '#ab7443';
const SHORTS = '#6f7553';
const SOCK = '#f4f2ec';
const SANDAL = '#4d3526';
const CABLE = '#f2c94c';
const PLUG = '#e9eef2';
const CUIA = '#6e7d34';
const CUIA_RIM = '#c9b37a';
const YERBA = '#8fb04a';
const BOMBILLA = '#cfd4da';
const KEYS = '#d7c27a';

/**
 * O Cara da Infra, who will look at it on Monday: a man-bun, a full beard and
 * the calm, half-closed eyes of someone with no deadline he believes in. A
 * tee in the team's colour with a server rack printed on it, a coil of yellow
 * network cable over one shoulder with the plug hanging loose, a ring of keys
 * to rooms nobody else can open, cargo shorts, white socks and sandals, and a
 * cuia of chimarrão — sipped through its bomba.
 */
export function paintInfra(ctx: Ctx, o: CharacterPose): void {
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
  // Unhurried: the slowest breath in the cast.
  const bob = seated
    ? 0
    : placing
      ? 2.2
      : cheering
        ? -2.4
        : scared
          ? -2
          : walking
            ? -0.9
            : Math.sin((t * TAU) / 4.6) * 0.55;
  const TEE = c.suit;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs: shorts, bare shins, socks and sandals ──
  const sandalAt = (x: number, by: number, fwd: number, rot = 0) => {
    ctx.save();
    ctx.translate(x, by);
    ctx.rotate(rot);
    // The sock, pulled up, then the sole and the strap over it.
    const sock: Path = () => {
      ctx.beginPath();
      ctx.moveTo(-3, -5);
      ctx.lineTo(3, -5);
      ctx.lineTo(3.4, -1.6);
      ctx.quadraticCurveTo(5.4 + fwd, -0.6, 5 + fwd, 1.4);
      ctx.lineTo(-4.2, 1.4);
      ctx.quadraticCurveTo(-4, -1.6, -3, -5);
      ctx.closePath();
    };
    sock();
    fillStroke(ctx, SOCK, 1.5, lineOf(SOCK));
    volume(ctx, sock, SOCK, 1, 1.2);
    seam(
      ctx,
      [
        [-2.8, -3.8],
        [2.8, -3.8],
      ],
      c.suit,
      0.9,
    );
    roundRect(ctx, -4.8, 1, 10.6 + fwd, 2, 0.8);
    fillStroke(ctx, SANDAL, 1.2, INK);
    roundRect(ctx, -3.6, -1.8, 7.6 + fwd * 0.6, 1.8, 0.6);
    fillStroke(ctx, SANDAL, 1, INK);
    ctx.restore();
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    // Bare shin between the shorts and the sock.
    const shin: Path = () =>
      roundRect(ctx, x - 2.4, 45, 4.8, 6 - lift * 0.5, 1.6);
    shin();
    fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    volume(ctx, shin, SKIN, 0.9, 1.2);
    sandalAt(x, 55 - lift, fwd);
  };
  const shortsLeg = (x: number) => {
    const p: Path = () => roundRect(ctx, x - 3.8, 40, 7.6, 7, 1.8);
    p();
    fillStroke(ctx, SHORTS, 1.7, lineOf(SHORTS));
    volume(ctx, p, SHORTS, 1, 1.3);
    // The cargo pocket, flap and all.
    if (!back) {
      roundRect(ctx, x - 2.4, 42.4, 4.8, 3.8, 0.6);
      ctx.strokeStyle = lineOf(SHORTS);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      seam(
        ctx,
        [
          [x - 2.4, 43.4],
          [x + 2.4, 43.4],
        ],
        lineOf(SHORTS),
        0.9,
      );
    }
  };
  if (seated) {
    const hang = (hx: number, dir: number) => {
      ctx.save();
      ctx.translate(hx, 40);
      ctx.rotate(dir * 0.35);
      const p: Path = () => roundRect(ctx, -2.4, 3, 4.8, 6, 1.6);
      p();
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
      ctx.restore();
      sandalAt(hx + dir * 3.5, 51, 0, dir * 0.35);
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
    legAt(29 - step * 3, step === 1 ? 1.6 : 0, step === 1 ? 2 : 0);
    legAt(35 + step * 3, step === -1 ? 1.6 : 0, step === -1 ? 2 : 0);
  } else {
    legAt(26.5, step === 1 ? 2 : 0, 0);
    legAt(37.5, step === -1 ? 2 : 0, 0);
  }

  ctx.translate(0, bob);

  // ── shorts up top, then the tee ──
  if (side) {
    shortsLeg(29 - (seated ? 0 : step * 1.5));
    shortsLeg(35 + (seated ? 0 : step * 1.5));
  } else {
    shortsLeg(26.5);
    shortsLeg(37.5);
  }
  const hem = seated ? 40 : 42;
  const teePath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(24, 22);
      ctx.lineTo(40, 22);
      ctx.quadraticCurveTo(44.5, 31, 43, hem);
      ctx.lineTo(22.5, hem);
      ctx.quadraticCurveTo(20.5, 32, 24, 22);
    } else {
      ctx.moveTo(21, 22);
      ctx.lineTo(43, 22);
      ctx.quadraticCurveTo(47, 32, 46, hem);
      ctx.lineTo(18, hem);
      ctx.quadraticCurveTo(17, 32, 21, 22);
    }
    ctx.closePath();
  };
  teePath();
  fillStroke(ctx, TEE, 1.7, lineOf(TEE));
  volume(ctx, teePath, TEE, 1.25, 1.8);
  // The belt, and the ring of keys swinging from it.
  seam(
    ctx,
    side
      ? [
          [23, hem - 0.8],
          [42.6, hem - 0.8],
        ]
      : [
          [18.4, hem - 0.8],
          [45.6, hem - 0.8],
        ],
    '#3a2a20',
    1.6,
  );
  if (!back) {
    const kx = side ? 30 : 23;
    const swing = Math.sin(t * (walking ? 9 : 1.4)) * (walking ? 0.5 : 0.15);
    ctx.save();
    ctx.translate(kx, hem - 0.4);
    ctx.rotate(swing);
    circle(ctx, 0, 1.6, 1.4);
    ctx.strokeStyle = BOMBILLA;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    for (const [dx, a] of [
      [-1, 0.5],
      [0, 0],
      [1.1, -0.45],
    ] as const) {
      ctx.save();
      ctx.translate(dx * 0.6, 3);
      ctx.rotate(a);
      roundRect(ctx, -0.5, 0, 1, 3.2, 0.3);
      ctx.fillStyle = KEYS;
      ctx.fill();
      ctx.strokeStyle = lineOf(KEYS);
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  if (!back && !side) {
    // A crew neck, and the rack on the print: three units, one light red.
    ctx.beginPath();
    ctx.moveTo(27.5, 22);
    ctx.quadraticCurveTo(32, 25.5, 36.5, 22);
    ctx.strokeStyle = lineOf(TEE);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, 28, 28 + i * 3.2, 8, 2.6, 0.5);
      ctx.fillStyle = c.suitLight;
      ctx.fill();
      for (let j = 0; j < 2; j++) {
        circle(ctx, 33.2 + j * 1.5, 29.3 + i * 3.2, 0.45);
        ctx.fillStyle = i === 1 && j === 1 ? '#ff4d4d' : '#5fe08a';
        ctx.fill();
      }
    }
  }

  // ── the coil of cable over his left shoulder, behind the arms ──
  const coil = () => {
    const cx = side ? 28 : 42.5;
    const cy = 27;
    for (const [r, a] of [
      [5.4, 0],
      [4.8, 0.3],
      [4.2, -0.2],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.75, r, a, 0, TAU);
      ctx.strokeStyle = lineOf(CABLE);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = CABLE;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // The loose end, a plug hanging down to his hip.
    const sway = Math.sin(t * 1.3) * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy + 5);
    ctx.quadraticCurveTo(cx + 3 + sway, cy + 9, cx + 1.6 + sway, cy + 12);
    ctx.strokeStyle = lineOf(CABLE);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = CABLE;
    ctx.lineWidth = 1;
    ctx.stroke();
    roundRect(ctx, cx + 0.4 + sway, cy + 11.6, 2.4, 3, 0.4);
    fillStroke(ctx, PLUG, 0.9, lineOf(PLUG));
  };
  if (!back) coil();
  else {
    // From behind, the cable crosses his back on its way over the shoulder.
    ctx.beginPath();
    ctx.moveTo(40, 22.5);
    ctx.quadraticCurveTo(30, 30, 24, 38);
    ctx.strokeStyle = lineOf(CABLE);
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = CABLE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ── arms: short sleeves, then bare forearms ──
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
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 7.4;
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    // The short sleeve, over the shoulder end.
    const mx = sx + (ex - sx) * 0.5;
    const my = sy + (ey - sy) * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(mx, my);
    ctx.strokeStyle = lineOf(TEE);
    ctx.lineWidth = 8.4;
    ctx.stroke();
    ctx.strokeStyle = TEE;
    ctx.lineWidth = 5.2;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.9);
      fillStroke(ctx, SKIN, 1.5, SKIN_LINE);
    }
  };
  /** The cuia: a gourd with a pale rim, green yerba and the silver bomba. */
  const cuia = (x: number, y: number, tilt = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(0.6, -2);
    ctx.lineTo(2.6, -9);
    ctx.strokeStyle = lineOf(BOMBILLA);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = BOMBILLA;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    const body: Path = () => {
      ctx.beginPath();
      ctx.moveTo(-3.2, -2.6);
      ctx.quadraticCurveTo(-4.6, 2.6, -1.8, 4.4);
      ctx.lineTo(1.8, 4.4);
      ctx.quadraticCurveTo(4.6, 2.6, 3.2, -2.6);
      ctx.closePath();
    };
    body();
    fillStroke(ctx, CUIA, 1.3, lineOf(CUIA));
    volume(ctx, body, CUIA, 1, 1.2);
    ellipse(ctx, 0, -2.6, 3.4, 1.2);
    fillStroke(ctx, CUIA_RIM, 1, lineOf(CUIA_RIM));
    ellipse(ctx, 0, -2.6, 2.4, 0.7);
    ctx.fillStyle = YERBA;
    ctx.fill();
    gloss(ctx, -1.8, 0.6, 0.5, 1.4, 0, 0.6);
    ctx.restore();
  };
  // Every few seconds, unhurried, a sip.
  const sip = !walking && Math.sin((t * TAU) / 6) > 0.75;
  if (seated) {
    if (side) sleeve(37, 25, 44, 33, 42, 29);
    else {
      sleeve(22, 25, 26, 34, 18, 31);
      sleeve(42, 25, 38, 34, 46, 31);
    }
  } else if (placing) {
    if (side) {
      sleeve(37, 25, 43, 31, 47, 38);
      cuia(48, 35);
    } else if (back) {
      sleeve(22, 25, 18, 33, 19, 40);
      sleeve(42, 25, 46, 33, 45, 40);
    } else {
      sleeve(22, 25, 18, 33, 17.5, 38);
      cuia(17.5, 35);
      sleeve(42, 25, 45, 33, 40, 41);
    }
  } else if (scared) {
    if (side) {
      sleeve(37, 25, 42, 20, 40, 14);
      cuia(40, 11, 0.3);
    } else {
      sleeve(22, 25, 17, 19, 21, 13);
      cuia(21, 10, -0.3);
      sleeve(42, 25, 47, 19, 43, 13);
    }
  } else if (cheering) {
    // A cheer, of a kind: one arm up, the cuia never spilled.
    if (side) {
      sleeve(37, 25, 42, 17, 44, 9);
      cuia(44.5, 6.5);
    } else {
      sleeve(22, 25, 16, 18, 14, 10);
      cuia(14, 7);
      sleeve(42, 25, 46, 33, 44, 38);
    }
  } else if (side) {
    const sw = walking ? step * 3 : 0;
    if (sip) {
      sleeve(37, 25, 42, 30, 40, 22);
      cuia(41, 20, -0.5);
    } else {
      sleeve(37, 25, 40 + sw, 34, 42 + sw * 0.5, 33);
      cuia(42.5 + sw * 0.5, 31);
    }
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 33, 18, 36 + step * 1.5);
    cuia(18, 33.5 + step * 1.5);
    sleeve(42, 25, 47 - step * 1.5, 33, 46, 38 - step * 1.5);
  } else {
    // Cuia in one hand at the chest, the other thumb hooked in the belt.
    if (sip) {
      sleeve(22, 25, 20, 32, 26, 25);
      cuia(27, 22.5, 0.5);
    } else {
      sleeve(22, 25, 18.5, 33, 19.5, 33);
      cuia(19.5, 30.5);
    }
    sleeve(42, 25, 46, 33, 42.5, 40);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  head();
  fillStroke(ctx, SKIN, 1.7, SKIN_LINE);
  volume(ctx, head, SKIN, 1.3, 1.8);
  /** The beard: cheeks to chin, full, the mouth set into it. */
  const beard: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(29, 13.5);
      ctx.quadraticCurveTo(29.5, 20, 32.5, 24.5);
      ctx.quadraticCurveTo(38, 28.5, 42.5, 22.5);
      ctx.quadraticCurveTo(43.4, 20.2, 42.6, 19);
      ctx.quadraticCurveTo(38.5, 20.4, 35, 18.6);
      ctx.quadraticCurveTo(32.5, 16.5, 31.5, 13.5);
    } else {
      ctx.moveTo(21.8, 14);
      ctx.quadraticCurveTo(21.4, 23, 26, 26.6);
      ctx.quadraticCurveTo(32, 30.2, 38, 26.6);
      ctx.quadraticCurveTo(42.6, 23, 42.2, 14);
      ctx.quadraticCurveTo(40.6, 18.6, 37.4, 19.2);
      ctx.quadraticCurveTo(32, 17.6, 26.6, 19.2);
      ctx.quadraticCurveTo(23.4, 18.6, 21.8, 14);
    }
    ctx.closePath();
  };
  if (!back) {
    /** Half closed, unbothered. */
    const eye = (x: number, y: number) => {
      const lid = Math.min(1, 0.5 + blink * 0.5);
      if (lid > 0.92) {
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y + 0.4);
        ctx.quadraticCurveTo(x, y + 1.2, x + 1.8, y + 0.4);
        inkOnly(ctx, 1.4);
        return;
      }
      ellipse(ctx, x, y, 2, 2.2);
      fillStroke(ctx, '#ffffff', 0.9, SKIN_LINE);
      circle(ctx, x + 0.2, y + 0.7, 1.2);
      ctx.fillStyle = '#4b6a3a';
      ctx.fill();
      circle(ctx, x + 0.2, y + 0.8, 0.6);
      ctx.fillStyle = INK;
      ctx.fill();
      const lidY = y - 2.2 + lid * 4.4;
      ctx.save();
      ellipse(ctx, x, y, 2.1, 2.3);
      ctx.clip();
      ctx.fillStyle = SKIN;
      ctx.fillRect(x - 3, y - 3, 6, lidY - (y - 3));
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x - 2.2, lidY + 0.1);
      ctx.quadraticCurveTo(x, lidY - 0.4, x + 2.2, lidY + 0.1);
      inkOnly(ctx, 1.4);
    };
    if (side) eye(37.5, 15.5);
    else {
      eye(28, 15.5);
      eye(36, 15.5);
    }
    // Brows: relaxed, level.
    ctx.beginPath();
    if (side) {
      ctx.moveTo(35, 11.6);
      ctx.lineTo(40, 11.8);
    } else {
      ctx.moveTo(25.2, 11.8);
      ctx.lineTo(30.2, 11.6);
      ctx.moveTo(33.8, 11.6);
      ctx.lineTo(38.8, 11.8);
    }
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (side) {
      ctx.beginPath();
      ctx.moveTo(41.5, 15);
      ctx.quadraticCurveTo(44, 17, 41.6, 18.4);
      inkOnly(ctx, 1.4);
    } else {
      seam(
        ctx,
        [
          [32.4, 17.8],
          [31.6, 18.4],
        ],
        SKIN_LINE,
        1,
      );
    }
    beard();
    fillStroke(ctx, HAIR, 1.5, lineOf(HAIR));
    volume(ctx, beard, HAIR, 1, 1.3);
    // A few strands of light through the beard.
    ctx.strokeStyle = HAIR_LIT;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (side) {
      ctx.moveTo(33, 21);
      ctx.quadraticCurveTo(34.5, 24, 37, 25.4);
    } else {
      ctx.moveTo(25, 21);
      ctx.quadraticCurveTo(26, 24.5, 29, 26.6);
      ctx.moveTo(39, 21);
      ctx.quadraticCurveTo(38, 24.5, 35, 26.6);
    }
    ctx.stroke();
    // The mouth, a calm little smile in the beard.
    ctx.beginPath();
    if (side) {
      ctx.moveTo(38, 21.6);
      ctx.quadraticCurveTo(40, 22.6, 41.4, 21.2);
    } else {
      ctx.moveTo(29.8, 21.4);
      ctx.quadraticCurveTo(32, 23, 34.2, 21.4);
    }
    ctx.strokeStyle = '#5a2f22';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  } else {
    // From behind, the beard shows round the jaw.
    ctx.beginPath();
    ctx.moveTo(21.8, 18);
    ctx.quadraticCurveTo(22.8, 23.5, 25.5, 24.5);
    ctx.moveTo(42.2, 18);
    ctx.quadraticCurveTo(41.2, 23.5, 38.5, 24.5);
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  // ── hair pulled back into a bun ──
  const cap: Path = () => {
    ctx.beginPath();
    if (back) {
      ctx.moveTo(21.4, 16);
      ctx.quadraticCurveTo(20.6, 3.4, 32, 3.2);
      ctx.quadraticCurveTo(43.4, 3.4, 42.6, 16);
      ctx.quadraticCurveTo(32, 19.5, 21.4, 16);
    } else if (side) {
      ctx.moveTo(22, 16);
      ctx.quadraticCurveTo(20.4, 3.6, 31, 3);
      ctx.quadraticCurveTo(40.5, 2.6, 42.4, 9.8);
      ctx.quadraticCurveTo(37, 7.6, 31.5, 9);
      ctx.quadraticCurveTo(29.6, 12.5, 29, 14);
      ctx.quadraticCurveTo(25.5, 16.8, 22, 16);
    } else {
      ctx.moveTo(21.6, 14);
      ctx.quadraticCurveTo(20.6, 3.6, 32, 3.2);
      ctx.quadraticCurveTo(43.4, 3.6, 42.4, 14);
      ctx.quadraticCurveTo(41, 9, 37, 8);
      ctx.quadraticCurveTo(32, 7.2, 27, 8);
      ctx.quadraticCurveTo(23, 9, 21.6, 14);
    }
    ctx.closePath();
  };
  cap();
  fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
  volume(ctx, cap, HAIR, 1.2, 1.6);
  ctx.strokeStyle = HAIR_LIT;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  if (side) {
    ctx.moveTo(38, 4.4);
    ctx.quadraticCurveTo(30, 4, 26, 9);
  } else {
    ctx.moveTo(26, 7);
    ctx.quadraticCurveTo(28, 4, 32, 4);
    ctx.moveTo(38, 7);
    ctx.quadraticCurveTo(36, 4, 32, 4);
  }
  ctx.stroke();
  // The bun on top, with its tie in the team's colour.
  const bx = side ? 28 : 32;
  const bun: Path = () => ellipse(ctx, bx, -0.6, 4, 3.4);
  bun();
  fillStroke(ctx, HAIR, 1.6, lineOf(HAIR));
  volume(ctx, bun, HAIR, 1, 1.3);
  roundRect(ctx, bx - 2.6, 1.8, 5.2, 1.6, 0.6);
  ctx.fillStyle = c.suit;
  ctx.fill();
  ctx.strokeStyle = lineOf(c.suit);
  ctx.lineWidth = 0.8;
  ctx.stroke();

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
