import type { Meta, StoryObj } from '@storybook/angular';
import { VirtualGamepadComponent } from './virtual-gamepad';

/**
 * A touch controller laid over a game: thumbstick-as-D-pad on the left,
 * action buttons on the right. The host fills its container, so the story
 * gives it a dark stage to sit on. Press and drag on the pad, or anywhere on
 * the left half with `float` on; the arrows light up and `direction` reports
 * each change.
 */
const meta: Meta<VirtualGamepadComponent> = {
  title: 'Organisms/VirtualGamepad',
  component: VirtualGamepadComponent,
  argTypes: {
    direction: { action: 'direction' },
    bombPress: { action: 'bombPress' },
    abilityPress: { action: 'abilityPress' },
    detonatePress: { action: 'detonatePress' },
  },
  args: { ability: true, detonate: true, float: true, demo: false },
  render: (args) => ({
    props: args,
    template: `
      <div style="position: relative; height: 24rem; background: #0b0b12; border-radius: 12px;">
        <lib-virtual-gamepad
          [ability]="ability"
          [detonate]="detonate"
          [float]="float"
          [demo]="demo"
          (direction)="direction($event)"
          (bombPress)="bombPress()"
          (abilityPress)="abilityPress()"
          (detonatePress)="detonatePress()"
        />
      </div>
    `,
  }),
};
export default meta;

type Story = StoryObj<VirtualGamepadComponent>;

export const Playground: Story = {};

/** A player on foot with no remote bombs: only the bomb button remains. */
export const BombOnly: Story = {
  args: { ability: false, detonate: false },
};

/** A ghost thumb plays the floating pad on a loop, as on the home page. */
export const Demo: Story = {
  args: { demo: true },
};
