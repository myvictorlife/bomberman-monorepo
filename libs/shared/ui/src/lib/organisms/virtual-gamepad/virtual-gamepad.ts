import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  DPAD_DEFAULTS,
  dragDirection,
  PadDirection,
  QUARTER_TURN,
  QUARTER_TURN_BACK,
} from './dpad';

export type { PadDirection } from './dpad';

/** The pad's dead zone, as a share of its width: the same feel at any size. */
const DEAD_ZONE_SHARE = 0.12;

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

  readonly direction = output<PadDirection | null>();
  readonly bombPress = output<void>();
  readonly abilityPress = output<void>();
  readonly detonatePress = output<void>();

  /** Where the pad points right now; shown on the pad and reported on change. */
  readonly held = signal<PadDirection | null>(null);

  private readonly pad = viewChild.required<ElementRef<HTMLElement>>('pad');
  /** The pointer that owns the pad, so a second finger on a button is ignored here. */
  private padPointer: number | null = null;

  onPadDown(event: PointerEvent): void {
    if (this.padPointer !== null) return;
    event.preventDefault();
    this.padPointer = event.pointerId;
    try {
      // Keeps the moves coming once the thumb slides off the pad. A pointer
      // the browser does not know (a synthetic event) is refused: fine.
      this.pad().nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // Nothing to capture.
    }
    this.track(event);
  }

  onPadMove(event: PointerEvent): void {
    if (event.pointerId !== this.padPointer) return;
    this.track(event);
  }

  onPadUp(event: PointerEvent): void {
    if (event.pointerId !== this.padPointer) return;
    this.padPointer = null;
    this.point(null);
  }

  /** Touch down fires the action; the default would also select text or scroll. */
  onButton(event: PointerEvent, action: 'bomb' | 'ability' | 'detonate'): void {
    event.preventDefault();
    if (action === 'bomb') this.bombPress.emit();
    else if (action === 'ability') this.abilityPress.emit();
    else this.detonatePress.emit();
  }

  private track(event: PointerEvent): void {
    const rect = this.pad().nativeElement.getBoundingClientRect();
    const centre = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const held = this.held();
    const onScreen = dragDirection(
      centre,
      { x: event.clientX, y: event.clientY },
      held && this.turned() ? QUARTER_TURN_BACK[held] : held,
      { ...DPAD_DEFAULTS, deadZone: rect.width * DEAD_ZONE_SHARE },
    );
    this.point(onScreen && this.turned() ? QUARTER_TURN[onScreen] : onScreen);
  }

  private point(next: PadDirection | null): void {
    if (next === this.held()) return;
    this.held.set(next);
    this.direction.emit(next);
  }
}
