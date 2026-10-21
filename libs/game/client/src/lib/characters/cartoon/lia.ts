import {
  beginFrame,
  bodyFrame,
  CharacterPose,
  circle,
  Ctx,
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
} from './ink';

const SKIN = '#8d5a3b';
const SKIN_LINE = lineOf(SKIN);
const HAIR = '#1f1612';
const COAT = '#f4f3ee';
const CLOG = '#f0efe9';
const STETHO = '#2b2b33';

/**
 * Dra. Lia, the doctor: white coat open over team-coloured scrubs, stethoscope,
 * badge, pens in the pocket, a bun with a team-coloured tie, clogs. Clipboard
 * against the hip when standing, the other hand in the coat pocket.
 */
export function paintLia(ctx: Ctx, o: CharacterPose): void {
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
            : Math.sin((t * TAU) / 2.8) * 0.4;
  const SCRUB = c.suit;
  beginFrame(ctx, o.facing);
  bodyFrame(ctx);

  // ── legs ──
  const clogAt = (x: number, by: number, fwd: number, rot = 0) => {
    const p: Path = () => {
      ctx.save();
      ctx.translate(x, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-4.5, -3.5);
      ctx.lineTo(4.5, -3.5);
      ctx.lineTo(5.5 + fwd, 2.5);
      ctx.quadraticCurveTo(0, 4.5, -5 + fwd * 0.3, 2.5);
      ctx.closePath();
      ctx.restore();
    };
    p();
    fillStroke(ctx, CLOG, 1.7, lineOf(CLOG));
    volume(ctx, p, CLOG, 1.15, 1.6);
  };
  const legAt = (x: number, lift: number, fwd: number) => {
    const p: Path = () =>
      roundRect(ctx, x - 3.2, 42, 6.4, 11 - lift * 0.5, 2.2);
    p();
    fillStroke(ctx, SCRUB, 1.7, lineOf(SCRUB));
    volume(ctx, p, SCRUB, 1.01, 1.4);
    clogAt(x, 55 - lift, fwd);
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
      fillStroke(ctx, SCRUB, 1.7, lineOf(SCRUB));
      volume(ctx, p, SCRUB, 1.01, 1.4);
      clogAt(hx + dir * 3.5, 51, 0, dir * 0.35);
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

  // ── white coat ──
  const hem = seated ? 42 : 46;
  const coatPath: Path = () => {
    ctx.beginPath();
    if (side) {
      ctx.moveTo(24, 22);
      ctx.lineTo(40, 22);
      ctx.quadraticCurveTo(44, 32, 43, hem);
      ctx.lineTo(22, hem);
      ctx.quadraticCurveTo(20, 32, 24, 22);
    } else {
      ctx.moveTo(21, 22);
      ctx.lineTo(43, 22);
      ctx.quadraticCurveTo(47, 32, 46, hem);
      ctx.lineTo(18, hem);
      ctx.quadraticCurveTo(17, 32, 21, 22);
    }
    ctx.closePath();
  };
  coatPath();
  fillStroke(ctx, COAT, 1.7, lineOf(COAT));
  volume(ctx, coatPath, COAT, 1.3, 1.8);
  if (back) {
    ctx.beginPath();
    ctx.moveTo(32, 24);
    ctx.lineTo(32, hem - 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(25, 22.5);
    ctx.quadraticCurveTo(32, 27, 39, 22.5);
    ctx.strokeStyle = STETHO;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  } else {
    const vPath: Path = () => {
      ctx.beginPath();
      if (side) {
        ctx.moveTo(33, 22);
        ctx.lineTo(40, 22);
        ctx.lineTo(38, hem - 2);
        ctx.lineTo(35, hem - 2);
      } else {
        ctx.moveTo(27, 22);
        ctx.lineTo(37, 22);
        ctx.lineTo(35.5, hem - 2);
        ctx.lineTo(28.5, hem - 2);
      }
      ctx.closePath();
    };
    vPath();
    fillStroke(ctx, SCRUB, 1.7, lineOf(SCRUB));
    volume(ctx, vPath, SCRUB, 0.86, 1.2);
    ctx.beginPath();
    if (side) {
      ctx.moveTo(33, 22);
      ctx.lineTo(35, 30);
      ctx.moveTo(40, 22);
      ctx.lineTo(38, 30);
    } else {
      ctx.moveTo(27, 22);
      ctx.lineTo(29.5, 31);
      ctx.moveTo(37, 22);
      ctx.lineTo(34.5, 31);
    }
    inkOnly(ctx, 1.6);
    if (!side) {
      roundRect(ctx, 38, 30, 6, 5, 1);
      fillStroke(ctx, COAT, 1.3, lineOf(COAT));
      ctx.strokeStyle = c.suit;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(39.5, 28.5);
      ctx.lineTo(39.5, 31);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(41.5, 28.5);
      ctx.lineTo(41.5, 31);
      ctx.stroke();
      roundRect(ctx, 20.5, 30, 5.5, 3.5, 0.8);
      fillStroke(ctx, c.suitLight, 1.2, lineOf(c.suitLight));
    }
    ctx.beginPath();
    if (side) {
      ctx.moveTo(30, 23);
      ctx.quadraticCurveTo(36, 27, 38, 33);
    } else {
      ctx.moveTo(26.5, 23);
      ctx.quadraticCurveTo(29, 30, 31, 35);
      ctx.moveTo(37.5, 23);
      ctx.quadraticCurveTo(35, 27, 33, 30);
    }
    ctx.strokeStyle = STETHO;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    circle(ctx, side ? 38.5 : 31, side ? 34.5 : 36.5, 2.4);
    fillStroke(ctx, '#b9bcc8', 1.4, lineOf('#b9bcc8'));
    circle(ctx, side ? 38.5 : 31, side ? 34.5 : 36.5, 1);
    ctx.fillStyle = INK;
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
    ctx.strokeStyle = lineOf(COAT);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = COAT;
    ctx.lineWidth = 4.6;
    ctx.stroke();
    if (hand) {
      circle(ctx, hx, hy, 2.9);
      fillStroke(ctx, SKIN, 1.6, lineOf(SKIN));
    }
  };
  const clipboard = (x: number, y: number) => {
    roundRect(ctx, x - 4, y - 5, 8, 10.5, 1);
    fillStroke(ctx, '#8a6a46', 1.6, lineOf('#8a6a46'));
    roundRect(ctx, x - 3, y - 3.5, 6, 8.5, 0.6);
    ctx.fillStyle = '#fbfaf5';
    ctx.fill();
    roundRect(ctx, x - 1.8, y - 6, 3.6, 2, 0.6);
    fillStroke(ctx, '#9aa0ad', 1.2, lineOf('#9aa0ad'));
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    for (const dy of [-1.5, 0.5, 2.5]) {
      ctx.beginPath();
      ctx.moveTo(x - 2, y + dy);
      ctx.lineTo(x + 2, y + dy);
      ctx.stroke();
    }
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y + 2.5);
    ctx.lineTo(x - 0.5, y + 3.5);
    ctx.lineTo(x + 1.5, y + 1.5);
    ctx.stroke();
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
      clipboard(49, 38);
    } else if (back) {
      sleeve(22, 25, 18, 33, 19, 40);
      sleeve(42, 25, 46, 33, 45, 40);
    } else {
      sleeve(22, 25, 18, 33, 17.5, 36);
      clipboard(16.5, 36.5);
      sleeve(42, 25, 44, 33, 38, 41);
    }
  } else if (scared) {
    if (side) sleeve(37, 25, 42, 20, 40, 14);
    else {
      sleeve(22, 25, 17, 19, 21, 13);
      sleeve(42, 25, 47, 19, 43, 13);
    }
  } else if (cheering) {
    if (side) {
      sleeve(37, 25, 42, 17, 44, 9);
      clipboard(46, 8);
    } else {
      sleeve(22, 25, 16, 18, 14, 10);
      clipboard(13, 9);
      sleeve(42, 25, 48, 18, 50, 10);
    }
  } else if (side) {
    const sw = walking ? step * 5 : 0;
    sleeve(37, 25, 40 + sw, 36, 43 + sw * 0.5, 33);
    clipboard(45 + sw * 0.5, 33);
  } else if (walking) {
    sleeve(22, 25, 17 + step * 1.5, 38 + step * 2, 18, 33);
    sleeve(42, 25, 47 - step * 1.5, 38 - step * 2, 46, 33);
    clipboard(16, 33);
  } else {
    sleeve(22, 25, 18, 33, 17.5, 36);
    clipboard(16.5, 36.5);
    sleeve(42, 25, 46, 33, 44, 40, false);
  }

  // ── head ──
  headFrame(ctx, bob);
  const head: Path = () => headPath(ctx);
  if (back) {
    circle(ctx, 32, 9, 5);
    fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
  } else if (side) {
    circle(ctx, 24, 9, 5);
    fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
  }
  head();
  fillStroke(ctx, SKIN, 1.7, lineOf(SKIN));
  volume(ctx, head, SKIN, 1.3, 1.8);
  if (side) {
    circle(ctx, 25, 17.5, 0.9);
    ctx.fillStyle = c.suitLight;
    ctx.fill();
  } else if (!back) {
    for (const x of [21.8, 42.2]) {
      circle(ctx, x, 17.5, 0.9);
      ctx.fillStyle = c.suitLight;
      ctx.fill();
    }
  }
  if (!back) {
    const eye = (x: number, y: number) => {
      const h = 2.8 * (1 - blink);
      if (h < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x - 1.8, y);
        ctx.lineTo(x + 1.8, y);
        inkOnly(ctx, 1.6);
        return;
      }
      ctx.beginPath();
      ctx.ellipse(x, y, 2.3, h + 0.3, 0, 0, TAU);
      fillStroke(ctx, '#ffffff', 0.9, SKIN_LINE);
      ctx.beginPath();
      ctx.ellipse(x + 0.3, y + 0.4, 1.4, Math.min(2.1, h * 0.8), 0, 0, TAU);
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x - 0.3, y - 0.8, 0.6);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 2, y - h + 0.2);
      ctx.lineTo(x + 2.6, y - h - 0.6);
      inkOnly(ctx, 1.2);
    };
    if (side) {
      eye(37, 16);
      ctx.beginPath();
      ctx.moveTo(34, 11.8);
      ctx.quadraticCurveTo(37, 11, 39.5, 12);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(41.5, 15.5);
      ctx.quadraticCurveTo(44, 17.5, 41.5, 19);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(37, 21);
      ctx.quadraticCurveTo(39, 22.2, 40.8, 21);
      inkOnly(ctx, 1.4);
    } else {
      eye(28, 16);
      eye(36, 16);
      ctx.beginPath();
      ctx.moveTo(25, 12);
      ctx.quadraticCurveTo(28, 10.8, 30.5, 12);
      ctx.moveTo(33.5, 12);
      ctx.quadraticCurveTo(36, 10.8, 39, 12);
      inkOnly(ctx, 1.5);
      ctx.beginPath();
      ctx.moveTo(29, 20.5);
      ctx.quadraticCurveTo(32, 23.2, 35, 20.5);
      inkOnly(ctx, 1.4);
      circle(ctx, 38.5, 19.5, 0.6);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }
  // Hair cap with a centre part; bun and tie.
  ctx.beginPath();
  ctx.moveTo(21.5, 12.5);
  ctx.quadraticCurveTo(21, 3.5, 32, 3.5);
  ctx.quadraticCurveTo(43, 3.5, 42.5, 12.5);
  ctx.quadraticCurveTo(40, 8.5, 36, 9.5);
  ctx.quadraticCurveTo(32, 7, 28, 9.5);
  ctx.quadraticCurveTo(24, 8.5, 21.5, 12.5);
  ctx.closePath();
  fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
  if (back) {
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.quadraticCurveTo(32, 18, 42, 12);
    ctx.lineTo(42, 15);
    ctx.quadraticCurveTo(32, 21, 22, 15);
    ctx.closePath();
    fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
    circle(ctx, 32, 9, 5);
    fillStroke(ctx, HAIR, 1.7, lineOf(HAIR));
    ctx.beginPath();
    ctx.arc(32, 9, 5, 0.3, 1.2);
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else if (side) {
    ctx.beginPath();
    ctx.arc(24, 9, 5, 1.2, 2.4);
    ctx.strokeStyle = c.suit;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.lineTo(32, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
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
