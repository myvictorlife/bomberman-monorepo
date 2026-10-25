import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DPAD_DEFAULTS,
  dragDirection,
  followCentre,
  PadDirection,
  PadPoint,
  QUARTER_TURN,
  QUARTER_TURN_BACK,
} from './dpad';
import { demoPose } from './gamepad-demo';

export type { PadDirection } from './dpad';

/** The pad's dead zone, as a share of its width: the same feel at any size. */
const DEAD_ZONE_SHARE = 0.12;
/** How far the hub travels from the centre, as a share of the pad's width. */
const HUB_TRAVEL_SHARE = 0.22;
/** A tick in the hand when the pad turns, where the phone can (not iOS). */
const TURN_BUZZ_MS = 8;
/** The pad's reach: past its rim, a thumb drags it along. */
const REACH_SHARE = 0.5;

/**
 * A touch-screen controller laid over a game: a D-pad on the left and the
 * action buttons on the right, where the thumbs rest when a phone is held
 * sideways. It takes the whole area it is given but is only solid where the
 * controls are — everything between them lets touches through.
 *
 * The pad is a thumbstick that reads as a D-pad: wherever the finger goes it
 * is resolved to one of four directions from the pad's centre, with a dead
 * zone and a bias towards the direction already held. `direction` reports
 * each change, `null` when the thumb lifts. The buttons fire on touch down —
 * a bomb cannot wait for a release.
 *
 * The pad floats. With `float` on (the default) a thumb landing anywhere on
 * the left half takes it, and the pad jumps under the thumb, centred there;
 * a thumb landing on the pad itself steers from the pad's centre at once,
 * the way a fixed pad would. Either way, a thumb that strays past the pad's
 * rim drags the pad along, so a drifting thumb never has to lift and land
 * again. Pages turn `float` off while the left half holds something else to
 * tap, such as a result screen's buttons.
 *
 * With `demo` on, a ghost thumb plays that out on a loop — for a picture of
 * the controller, not a game. It drives the same code a real thumb does, so
 * the demo cannot drift from the real thing. It stays still for anyone who
 * asked the system for reduced motion.
 */
@Component({
  selector: 'lib-virtual-gamepad',
  imports: [TranslatePipe],
  templateUrl: './virtual-gamepad.html',
  styleUrl: './virtual-gamepad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class VirtualGamepadComponent {
  /** Hides the mount's ability button when the player has nothing to use. */
  readonly ability = input(true);
  /** Hides the detonator when the player holds no remote bombs. */
  readonly detonate = input(true);
  /**
   * The pad is drawn a quarter turn clockwise — the whole game is, on a
   * phone held upright — so a push towards the screen's right is "up".
   * Directions come out in the pad's own terms.
   */
  readonly turned = input(false);
  /** The left half takes the thumb, not only the pad: see the class doc. */
  readonly float = input(true);
  /** A ghost thumb shows how the pad works, on a loop: see the class doc. */
  readonly demo = input(false);

  readonly direction = output<PadDirection | null>();
  readonly bombPress = output<void>();
  readonly abilityPress = output<void>();
  readonly detonatePress = output<void>();

  /** Where the pad points right now; shown on the pad and reported on change. */
  readonly held = signal<PadDirection | null>(null);
  /** How far the pad has moved from where it rests, in its own (drawn) pixels. */
  readonly shift = signal<PadPoint>({ x: 0, y: 0 });
  /** How far the hub sits off the pad's centre, following the thumb. */
  readonly knob = signal<PadPoint>({ x: 0, y: 0 });
  /** Where the demo thumb is, off the pad's centre; kept on lift so it fades in place. */
  readonly thumb = signal<PadPoint>({ x: 0, y: 0 });
  /** Whether the demo thumb is on the screen. */
  readonly thumbDown = signal(false);

  private readonly pad = viewChild.required<ElementRef<HTMLElement>>('pad');
  /** The pointer that owns the pad, so a second finger on a button is ignored here. */
  private padPointer: number | null = null;
  /** The pad's resting centre on screen, measured when the thumb lands. */
  private rest: PadPoint = { x: 0, y: 0 };
  /** The pad's centre on screen while the thumb is down. */
  private centre: PadPoint = { x: 0, y: 0 };
  private width = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // The demo is decided once, when the controller is first drawn.
    afterNextRender(() => {
      if (!this.demo()) return;
      const stop = this.playDemo();
      destroyRef.onDestroy(stop);
    });
  }

  onPadDown(event: PointerEvent): void {
    if (this.padPointer !== null) return;
    const pad = this.pad().nativeElement;
    const onPad = event.target instanceof Node && pad.contains(event.target);
    if (!onPad && !this.float()) return;
    event.preventDefault();
    this.padPointer = event.pointerId;
    try {
      // Keeps the moves coming once the thumb slides away; they bubble up to
      // the zone from the pad, which takes touches even with `float` off. A
      // pointer the browser does not know (a synthetic event) is refused: fine.
      pad.setPointerCapture?.(event.pointerId);
    } catch {
      // Nothing to capture.
    }
    this.press({ x: event.clientX, y: event.clientY }, onPad);
  }

  onPadMove(event: PointerEvent): void {
    if (event.pointerId !== this.padPointer) return;
    this.track({ x: event.clientX, y: event.clientY });
  }

  onPadUp(event: PointerEvent): void {
    if (event.pointerId !== this.padPointer) return;
    this.padPointer = null;
    this.lift();
  }

  /** Touch down fires the action; the default would also select text or scroll. */
  onButton(event: PointerEvent, action: 'bomb' | 'ability' | 'detonate'): void {
    event.preventDefault();
    if (action === 'bomb') this.bombPress.emit();
    else if (action === 'ability') this.abilityPress.emit();
    else this.detonatePress.emit();
  }

  /** A thumb lands at `finger`, on the pad or beside it. */
  private press(finger: PadPoint, onPad: boolean): void {
    // The pad is at rest whenever no thumb holds it, so this is its home.
    const rect = this.pad().nativeElement.getBoundingClientRect();
    this.width = rect.width;
    this.rest = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.centre = onPad ? this.rest : finger;
    this.track(finger);
  }

  private lift(): void {
    this.shift.set({ x: 0, y: 0 });
    this.knob.set({ x: 0, y: 0 });
    this.point(null);
  }

  private track(finger: PadPoint): void {
    this.centre = followCentre(this.centre, finger, this.width * REACH_SHARE);
    const held = this.held();
    const onScreen = dragDirection(
      this.centre,
      finger,
      held && this.turned() ? QUARTER_TURN_BACK[held] : held,
      { ...DPAD_DEFAULTS, deadZone: this.width * DEAD_ZONE_SHARE },
    );
    this.shift.set(
      this.drawn(this.centre.x - this.rest.x, this.centre.y - this.rest.y),
    );
    const dx = finger.x - this.centre.x;
    const dy = finger.y - this.centre.y;
    const travel = this.width * HUB_TRAVEL_SHARE;
    const scale = Math.min(1, travel / (Math.hypot(dx, dy) || 1));
    this.knob.set(this.drawn(dx * scale, dy * scale));
    this.point(onScreen && this.turned() ? QUARTER_TURN[onScreen] : onScreen);
  }

  /**
   * A move on screen in the pad's own pixels. Turned a quarter clockwise,
   * the pad's x runs down the screen and its y runs right to left.
   */
  private drawn(dx: number, dy: number): PadPoint {
    return this.turned() ? { x: dy, y: -dx } : { x: dx, y: dy };
  }

  private point(next: PadDirection | null): void {
    if (next === this.held()) return;
    this.held.set(next);
    this.direction.emit(next);
    if (next !== null && !this.demo()) navigator.vibrate?.(TURN_BUZZ_MS);
  }

  /** Runs the demo thumb every frame until the returned stop is called. */
  private playDemo(): () => void {
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      return () => undefined;
    let start: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      start ??= now;
      this.demoFrame(now - start);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }

  /** The demo thumb `at` milliseconds in, played as a real thumb would be. */
  private demoFrame(at: number): void {
    const pose = demoPose(at);
    if (!pose.down) {
      if (this.thumbDown()) {
        this.thumbDown.set(false);
        this.lift();
      }
      return;
    }
    if (!this.thumbDown()) {
      // Measured at rest, so the script's pad widths fit a pad of any size.
      const rect = this.pad().nativeElement.getBoundingClientRect();
      if (!rect.width) return;
      this.thumbDown.set(true);
      this.press(
        {
          x: rect.left + rect.width / 2 + pose.x * rect.width,
          y: rect.top + rect.height / 2 + pose.y * rect.width,
        },
        Math.hypot(pose.x, pose.y) <= REACH_SHARE,
      );
    }
    const finger = {
      x: this.rest.x + pose.x * this.width,
      y: this.rest.y + pose.y * this.width,
    };
    this.track(finger);
    this.thumb.set(
      this.drawn(finger.x - this.centre.x, finger.y - this.centre.y),
    );
  }
}
