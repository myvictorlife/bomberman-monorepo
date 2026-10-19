import {
  BOMB_FUSE_TICKS,
  cellIndex,
  CHARACTERS,
  DEATH_TICKS,
  DIRECTION_DELTA,
  flightPosition,
  GameState,
  isDashing,
  MapId,
} from '@libs/game-core';
import { HD_TILE } from '../skins/hd/hd-palette';
import { ARENA_THEMES, tileTextureKey } from '../skins/hd/themes';
import { ArenaMoment, blackoutAt, quickened } from '../skins/hd/themes/moments';
import { flameFrame } from '../skins/flame-frame';
import { TEXTURE } from '../skins/texture-keys';
import { previewTextures, TextureLookup } from './arena-preview';

const WALK_CYCLE = [1, 0, 2, 0];

/**
 * Paints one frame of a game state on a plain 2D context with the HD skin —
 * the renderer of the title screen's "videos", where Phaser would be a lot
 * to load for a card. The context's unit is the pixel at {@link HD_TILE} per
 * cell; scale it before calling for a smaller picture.
 */
export class FramePainter {
  private readonly tex: TextureLookup;
  private readonly moment: ArenaMoment | null;

  /**
   * `quickMoments`: a blackout every 8 s instead of 30, so a short preview
   * gets to show it.
   */
  constructor(
    doc: Document,
    mapId: MapId,
    options: { quickMoments?: boolean } = {},
  ) {
    this.tex = previewTextures(doc, mapId);
    const moment = ARENA_THEMES[mapId]?.moment ?? null;
    this.moment = options.quickMoments ? quickened(moment, 8 * 60) : moment;
  }

  /** Rain: a wet sheen, and streaks that fall across the picture, the same ones every tick. */
  private paintRain(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    tick: number,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(154, 199, 255, 0.06)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(220, 235, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      // A fixed lane per drop, falling at its own pace: deterministic, no state to keep.
      const lane = ((i * 7919) % 1000) / 1000;
      const pace = 14 + ((i * 104729) % 7);
      const x = ((lane * W + tick * 3 + i * 13) % (W + 60)) - 30;
      const y = ((((i * 5261) % H) + tick * pace) % (H + 40)) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y - 22);
    }
    ctx.stroke();
    ctx.restore();
  }

  paint(ctx: CanvasRenderingContext2D, state: GameState): void {
    const S = HD_TILE;
    const draw = (
      key: string,
      x: number,
      y: number,
      scale = 1,
      rotation = 0,
    ) => {
      const image = this.tex.get(key);
      if (!image) return;
      // A taller texture (a rider's head above the mount) keeps its feet on the cell.
      const above = image.height - image.width;
      if (scale === 1 && rotation === 0) {
        ctx.drawImage(image, x * S, y * S - above);
        return;
      }
      ctx.save();
      ctx.translate(x * S + S / 2, y * S + S / 2);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.drawImage(image, -S / 2, -S / 2 - above);
      ctx.restore();
    };
    const shadow = (x: number, y: number, size: number) => {
      const image = this.tex.get(TEXTURE.shadow);
      if (!image) return;
      ctx.save();
      ctx.translate(x * S + S / 2, y * S + S / 2 + S * 0.36);
      ctx.scale(size, size);
      ctx.drawImage(image, -S / 2, -S / 2);
      ctx.restore();
    };
    const solid = (col: number, row: number) =>
      state.tiles[cellIndex(state, col, row)] !== 'empty';
    const burning = new Set(
      state.burningBlocks.map((b) => cellIndex(state, b.col, b.row)),
    );

    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const index = cellIndex(state, col, row);
        const tile = state.tiles[index] ?? 'wall';
        draw(tileTextureKey(state, col, row, tile, solid), col, row);
        if (burning.has(index)) {
          // A crate going up: the floor shows through as it fades.
          ctx.save();
          ctx.globalAlpha = 0.5;
          draw(TEXTURE.flame('center', 1), col, row);
          ctx.restore();
        }
      }
    }

    for (const p of state.powerUps) draw(TEXTURE.powerUp(p.kind), p.col, p.row);

    // The arena's moment: the lights out (bombs and flames stay above the dark), or rain.
    const dark = blackoutAt(this.moment, state.tick);
    const W = state.cols * S;
    const H = state.rows * S;
    if (dark > 0) {
      ctx.fillStyle = `rgba(2, 3, 10, ${0.86 * dark})`;
      ctx.fillRect(0, 0, W, H);
    }

    for (const b of state.bombs) {
      const elapsed = BOMB_FUSE_TICKS - b.fuse;
      const rate = b.fuse < BOMB_FUSE_TICKS / 3 ? 0.5 : 0.25;
      shadow(b.col, b.row, 0.8);
      draw(
        TEXTURE.bomb(Math.floor(elapsed / 6) % 2),
        b.col,
        b.row,
        1 + 0.08 * Math.sin(elapsed * rate),
      );
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of state.flames)
      draw(TEXTURE.flame(f.shape, flameFrame(f.ticksLeft)), f.col, f.row);
    ctx.restore();

    // Everyone on the floor, back to front, so a player lower down covers one above.
    const standing = [
      ...state.players.map((p) => ({ kind: 'player' as const, y: p.y, p })),
      ...state.outsiders.map((o) => ({ kind: 'outsider' as const, y: o.y, o })),
    ].sort((a, b) => a.y - b.y);
    ctx.save();
    if (dark > 0.5) ctx.globalAlpha = 0.35;
    for (const entry of standing) {
      if (entry.kind === 'outsider') {
        const o = entry.o;
        const slot = Math.max(
          0,
          CHARACTERS.findIndex((c) => c.id === o.characterId),
        );
        const frame = o.moving
          ? (WALK_CYCLE[Math.floor(state.tick / 8) % 4] ?? 0)
          : 0;
        shadow(o.x, o.y, 0.8);
        draw(TEXTURE.player(slot, o.facing, frame), o.x, o.y - 0.12);
        continue;
      }
      const p = entry.p;
      if (p.alive) {
        const frame = p.moving
          ? (WALK_CYCLE[Math.floor(state.tick / 8) % 4] ?? 0)
          : 0;
        const key = p.mountId
          ? TEXTURE.playerMounted(p.slot, p.mountId, p.facing, frame)
          : TEXTURE.player(p.slot, p.facing, frame);
        // Grabbed with the glove: held over the holder's head, or flying to where they were thrown.
        const holder = p.carriedBy
          ? state.players.find((h) => h.id === p.carriedBy)
          : null;
        if (holder) {
          draw(key, holder.x, holder.y - 0.95);
          continue;
        }
        if (p.flight) {
          const [col, row, arc] = flightPosition(state, p.flight, state.tick);
          shadow(col, row, 0.9 - arc * 0.3);
          draw(key, col, row - 0.12 - arc * 0.9, 1 + arc * 0.2);
          continue;
        }
        // Pato in the air: an arc up and down over the jump, the shadow shrinking under it.
        if (p.jump) {
          const span = Math.max(1, p.jump.endTick - p.jump.startTick);
          const t = Math.min(
            1,
            Math.max(0, (state.tick - p.jump.startTick) / span),
          );
          const lift = Math.sin(Math.PI * t);
          shadow(p.x, p.y, 0.9 - lift * 0.4);
          draw(key, p.x, p.y - 0.12 - lift * 0.8, 1 + lift * 0.15);
          continue;
        }
        // Tatu sprinting: two fading copies trail behind.
        if (isDashing(state, p)) {
          const [dx, dy] = DIRECTION_DELTA[p.facing];
          ctx.save();
          for (const [back, alpha] of [
            [0.7, 0.18],
            [0.35, 0.35],
          ] as const) {
            ctx.globalAlpha *= alpha;
            draw(key, p.x - dx * back, p.y - 0.12 - dy * back);
            ctx.globalAlpha /= alpha;
          }
          ctx.restore();
        }
        shadow(p.x, p.y, 0.9);
        draw(key, p.x, p.y - 0.12);
        if (state.tick < p.shieldedUntilTick) {
          ctx.beginPath();
          ctx.arc(
            p.x * S + S / 2,
            p.y * S + S / 2 - S * 0.12,
            S * 0.55 + Math.sin(state.tick / 3) * 2,
            0,
            Math.PI * 2,
          );
          ctx.strokeStyle = 'rgba(95, 211, 255, 0.8)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      } else if (
        p.diedAtTick !== null &&
        state.tick - p.diedAtTick < DEATH_TICKS
      ) {
        // Death: spin, grow and fade, like the live arena.
        const t = (state.tick - p.diedAtTick) / DEATH_TICKS;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        draw(
          TEXTURE.player(p.slot, 'down', 0),
          p.x,
          p.y - 0.12,
          1 + t * 0.5,
          t * Math.PI * 2,
        );
        ctx.restore();
      }
    }

    ctx.restore();

    if (this.moment?.kind === 'rain') this.paintRain(ctx, W, H, state.tick);

    for (const b of state.thrownBombs) {
      const [col, row, arc] = flightPosition(state, b, state.tick);
      shadow(col, row, 0.8 - arc * 0.3);
      draw(
        TEXTURE.bomb(0),
        col,
        row - arc * 0.9,
        1 + arc * 0.25,
        ((state.tick - b.startTick) * 12 * Math.PI) / 180,
      );
    }

    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.35,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/** A name and how many wins, for the ranking picture. */
const BOARD = [
  { name: 'Faísca', wins: 12, color: '#3d7bdc' },
  { name: 'Dra. Lia', wins: 9, color: '#e8575a' },
  { name: 'Zé Motoca', wins: 7, color: '#3fb67a' },
  { name: 'Dev Cansado', wins: 5, color: '#d9dde6' },
  { name: 'Tião', wins: 2, color: '#f1c744' },
];

/**
 * The ranking as a picture: five names, their wins as bars, and every few
 * seconds somebody wins a round and climbs — the rows slide past each other.
 * `t` is seconds; the same `t` always paints the same frame.
 */
export function paintRankingDemo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
): void {
  const period = 2.4;
  const round = Math.floor(t / period);
  const k = (t % period) / period;
  // Each round, the one in last place but one wins twice and overtakes the row above.
  const rows = BOARD.map((r, i) => ({
    ...r,
    wins: r.wins + Math.floor((round + (4 - i)) / 5) * 3,
  }));
  const order = [...rows].sort((a, b) => b.wins - a.wins);
  const climber = order[(round % 4) + 1];
  const above = order[round % 4];
  if (climber && above) climber.wins = above.wins + 1;
  const after = [...rows].sort((a, b) => b.wins - a.wins);
  const ease =
    k < 0.3 ? 0 : k > 0.6 ? 1 : (1 - Math.cos(((k - 0.3) / 0.3) * Math.PI)) / 2;

  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 0, width, height);
  const pad = width * 0.06;
  const rowH = (height - pad * 2) / BOARD.length;
  const barMax = Math.max(...after.map((r) => r.wins));
  ctx.font = `600 ${Math.round(rowH * 0.34)}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  rows.forEach((row) => {
    const from = order.indexOf(row);
    const to = after.indexOf(row);
    const y = pad + (from + (to - from) * ease) * rowH + rowH / 2;
    const place = to + 1;
    ctx.fillStyle = place === 1 ? '#f2c94c' : 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'left';
    ctx.fillText(`${place}`, pad, y);
    ctx.fillStyle = '#e9ecf3';
    ctx.fillText(row.name, pad + rowH * 0.6, y);
    const barX = pad + rowH * 0.6 + width * 0.36;
    const barW = (width - pad - barX) * (row.wins / barMax);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(barX, y - rowH * 0.16, width - pad - barX, rowH * 0.32);
    ctx.fillStyle = row.color;
    ctx.fillRect(barX, y - rowH * 0.16, barW, rowH * 0.32);
    ctx.fillStyle = '#0f1219';
    ctx.textAlign = 'right';
    ctx.fillText(`${row.wins}`, barX + barW - rowH * 0.12, y);
  });
  // The crown on whoever is first.
  const first = after[0];
  if (first) {
    const y = pad + rowH / 2;
    ctx.fillStyle = '#f2c94c';
    ctx.textAlign = 'right';
    ctx.font = `${Math.round(rowH * 0.4)}px system-ui, sans-serif`;
    ctx.fillText('🏆', width - pad * 0.3, y);
  }
}
