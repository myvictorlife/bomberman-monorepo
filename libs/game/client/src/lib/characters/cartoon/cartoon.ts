import {
  CharacterId,
  Direction,
  findCharacter,
  MountId,
} from '@libs/game-core';
import { paintBernardo } from './bernardo';
import { paintByte } from './byte';
import { paintCapivara } from './capivara';
import { paintFaisca } from './faisca';
import { paintGalinha } from './galinha';
import {
  CharacterPainter,
  circle,
  Ctx,
  fillStroke,
  MountPose,
  roundRect,
  teamFor,
} from './ink';
import { paintLia } from './lia';
import { paintMotoca } from './motoca';
import { paintNovato } from './novato';
import { paintPato } from './pato';
import { paintTatu } from './tatu';
import { paintTiao } from './tiao';

/** Colour index for painters, re-exported for pages that pick a colour. */
export { colorSlot } from './ink';

export const CHARACTER_PAINTERS: Readonly<
  Record<CharacterId, CharacterPainter>
> = {
  novato: paintNovato,
  faisca: paintFaisca,
  byte: paintByte,
  lia: paintLia,
  motoca: paintMotoca,
  tiao: paintTiao,
};

type MountPainterWithRider = (
  ctx: Ctx,
  pose: MountPose,
  rider: CharacterPainter,
) => void;

export const MOUNT_PAINTERS: Readonly<Record<MountId, MountPainterWithRider>> =
  {
    tatu: paintTatu,
    pato: paintPato,
    bernardo: paintBernardo,
    capivara: paintCapivara,
    galinha: paintGalinha,
  };

export interface CartoonPose {
  characterId: CharacterId;
  facing: Direction;
  /** 0 = standing, 1 and 2 = the two steps of the walk cycle. */
  frame: number;
  /** Picks the team colour: a slot of the round, or a picked colour's {@link colorSlot}. */
  slot: number;
  /** Seconds, for idle motion; omit for a still frame. */
  t?: number;
  /** 0 = eyes open, 1 = closed. */
  blink?: number;
  /** Draw the character riding this mount; `null` or omitted is on foot. */
  mountId?: MountId | null;
}

/** One frame of a character, on foot or on a mount, in 64 × 64 logical space. */
export function paintCartoonCharacter(ctx: Ctx, pose: CartoonPose): void {
  const paintCharacter = CHARACTER_PAINTERS[findCharacter(pose.characterId).id];
  if (pose.mountId) {
    // A mount has no bomb-setting or cheering pose: those frames are its
    // idle — the same standing frame at two later moments of its own motion
    // (a chew, a blink, a tail wag), so a rider waiting on it sees it live.
    const idle = pose.frame >= 3;
    MOUNT_PAINTERS[pose.mountId](
      ctx,
      {
        ...pose,
        frame: idle ? 0 : pose.frame,
        t: idle ? (pose.t ?? 0) + (pose.frame === 3 ? 0.45 : 1.35) : pose.t,
        rider: true,
        riderBlink: pose.blink,
      },
      paintCharacter,
    );
  } else {
    paintCharacter(ctx, pose);
  }
}

/** The mount alone, for a roster card. */
export function paintCartoonMount(
  ctx: Ctx,
  mountId: MountId,
  pose: Omit<CartoonPose, 'characterId' | 'mountId'>,
): void {
  MOUNT_PAINTERS[mountId](ctx, { ...pose, rider: false }, paintFaisca);
}

/** A framed portrait of the mount, with the team seal, for lists and the HUD. */
export function paintCartoonMountIcon(
  ctx: Ctx,
  mountId: MountId,
  slot: number,
): void {
  const c = teamFor(slot);
  const zoom = mountId === 'pato' ? 2.1 : mountId === 'bernardo' ? 2 : 1.9;
  const anchor =
    mountId === 'tatu' || mountId === 'pato' || mountId === 'galinha' ? 48 : 49;
  roundRect(ctx, 2, 2, 60, 60, 12);
  fillStroke(ctx, '#2a2420', 2.2);
  ctx.save();
  roundRect(ctx, 2, 2, 60, 60, 12);
  ctx.clip();
  ctx.translate(32, mountId === 'pato' ? 38 : 36);
  ctx.scale(zoom, zoom);
  ctx.translate(-32, -anchor);
  paintCartoonMount(ctx, mountId, { facing: 'down', frame: 0, slot, t: 0 });
  ctx.restore();
  circle(ctx, 52, 12, 5.5);
  fillStroke(ctx, c.suit, 1.6);
  ctx.beginPath();
  ctx.moveTo(49, 12);
  ctx.lineTo(51.5, 14.5);
  ctx.lineTo(55.5, 9.5);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}
