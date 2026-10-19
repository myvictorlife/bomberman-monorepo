import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { VirtualGamepadComponent } from './virtual-gamepad';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      GAMEPAD: {
        MOVE: 'Move',
        BOMB: 'Bomb',
        ABILITY: 'Ability',
        DETONATE: 'Detonate',
      },
    });
  }
}

/** A pointer event jsdom can build: a mouse event wearing a pointer id. */
function pointer(
  type: string,
  x: number,
  y: number,
  pointerId = 1,
): MouseEvent {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

describe('VirtualGamepadComponent', () => {
  let spectator: Spectator<VirtualGamepadComponent>;
  let pad: HTMLElement;
  const directions: (string | null)[] = [];

  const createComponent = createComponentFactory({
    component: VirtualGamepadComponent,
    providers: [
      provideTranslateService({
        loader: { provide: TranslateLoader, useClass: StubTranslateLoader },
        fallbackLang: 'en',
        lang: 'en',
      }),
    ],
  });

  beforeEach(() => {
    directions.length = 0;
    spectator = createComponent();
    spectator.component.direction.subscribe((d) => directions.push(d));
    pad = spectator.query<HTMLElement>('[data-testid="gamepad-pad"]')!;
    // jsdom lays nothing out: a 100×100 pad at (0, 0), centre (50, 50).
    vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
  });

  it('labels the pad and the three buttons', () => {
    expect(pad.getAttribute('aria-label')).toBe('Move');
    expect(
      spectator
        .query('[data-testid="gamepad-bomb"]')
        ?.getAttribute('aria-label'),
    ).toBe('Bomb');
    expect(spectator.query('[data-testid="gamepad-ability"]')).toBeTruthy();
    expect(spectator.query('[data-testid="gamepad-detonate"]')).toBeTruthy();
  });

  it('hides the ability and detonate buttons when told to', () => {
    spectator.setInput({ ability: false, detonate: false });
    expect(spectator.query('[data-testid="gamepad-ability"]')).toBeNull();
    expect(spectator.query('[data-testid="gamepad-detonate"]')).toBeNull();
    expect(spectator.query('[data-testid="gamepad-bomb"]')).toBeTruthy();
  });

  it('points where the thumb pushes and reports each change once', () => {
    pad.dispatchEvent(pointer('pointerdown', 50, 10));
    spectator.detectChanges();
    expect(pad.getAttribute('data-direction')).toBe('up');
    expect(spectator.query('.gamepad__arrow--up')).toHaveClass(
      'gamepad__arrow--held',
    );

    pad.dispatchEvent(pointer('pointermove', 52, 12));
    pad.dispatchEvent(pointer('pointermove', 90, 50));
    spectator.detectChanges();
    expect(pad.getAttribute('data-direction')).toBe('right');

    pad.dispatchEvent(pointer('pointerup', 90, 50));
    spectator.detectChanges();
    expect(pad.getAttribute('data-direction')).toBeNull();
    expect(directions).toEqual(['up', 'right', null]);
  });

  it("reads a turned pad in its own terms: the screen's right is up", () => {
    spectator.setInput({ turned: true });
    pad.dispatchEvent(pointer('pointerdown', 90, 50));
    spectator.detectChanges();
    expect(pad.getAttribute('data-direction')).toBe('up');
    expect(spectator.query('.gamepad__arrow--up')).toHaveClass(
      'gamepad__arrow--held',
    );
    // Down the screen is the pad's right; the held axis still gets its bias.
    pad.dispatchEvent(pointer('pointermove', 60, 88));
    pad.dispatchEvent(pointer('pointermove', 50, 90));
    spectator.detectChanges();
    expect(pad.getAttribute('data-direction')).toBe('right');
    pad.dispatchEvent(pointer('pointerup', 50, 90));
    expect(directions).toEqual(['up', 'right', null]);
  });

  it('points nowhere for a touch in the dead zone', () => {
    pad.dispatchEvent(pointer('pointerdown', 52, 53));
    expect(directions).toEqual([]);
    pad.dispatchEvent(pointer('pointerup', 52, 53));
    expect(directions).toEqual([]);
  });

  it('follows only the finger that took the pad', () => {
    pad.dispatchEvent(pointer('pointerdown', 50, 10, 1));
    pad.dispatchEvent(pointer('pointermove', 90, 50, 2));
    pad.dispatchEvent(pointer('pointerdown', 10, 50, 2));
    expect(directions).toEqual(['up']);
    pad.dispatchEvent(pointer('pointerup', 10, 50, 2));
    expect(directions).toEqual(['up']);
    pad.dispatchEvent(pointer('pointerup', 50, 10, 1));
    expect(directions).toEqual(['up', null]);
  });

  it('fires the actions on touch down', () => {
    const bomb = vi.fn();
    const ability = vi.fn();
    const detonate = vi.fn();
    spectator.component.bombPress.subscribe(bomb);
    spectator.component.abilityPress.subscribe(ability);
    spectator.component.detonatePress.subscribe(detonate);

    spectator
      .query('[data-testid="gamepad-bomb"]')!
      .dispatchEvent(pointer('pointerdown', 0, 0));
    spectator
      .query('[data-testid="gamepad-ability"]')!
      .dispatchEvent(pointer('pointerdown', 0, 0));
    spectator
      .query('[data-testid="gamepad-detonate"]')!
      .dispatchEvent(pointer('pointerdown', 0, 0));

    expect(bomb).toHaveBeenCalledTimes(1);
    expect(ability).toHaveBeenCalledTimes(1);
    expect(detonate).toHaveBeenCalledTimes(1);
  });
});
