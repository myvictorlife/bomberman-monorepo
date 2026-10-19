import type { Meta, StoryObj } from '@storybook/angular';
import { PlayerBadgesComponent } from './player-badges';

const meta: Meta<PlayerBadgesComponent> = {
  title: 'Molecules/Player badges',
  component: PlayerBadgesComponent,
  render: (args) => ({
    props: args,
    template: `<lib-player-badges [stats]="stats" [testId]="testId" />`,
  }),
  args: {
    testId: 'story',
    stats: {
      bombs: 3,
      fire: 4,
      speed: 1,
      pierce: false,
      remote: false,
      glove: false,
      kick: false,
      vestSeconds: 0,
      mount: null,
      abilityReadyIn: 0,
      abilityActive: false,
    },
  },
};
export default meta;

type Story = StoryObj<PlayerBadgesComponent>;

/** The three counts every player has. Hover a badge for its name. */
export const Counts: Story = {};

/** Everything picked up at once: the one-off items stay icon-only, so the row never grows past a line. */
export const Loaded: Story = {
  args: {
    stats: {
      bombs: 6,
      fire: 8,
      speed: 4,
      pierce: true,
      remote: true,
      glove: true,
      kick: true,
      vestSeconds: 5,
      mount: 'pato',
      abilityReadyIn: 0,
      abilityActive: false,
    },
  },
};

/** The mount's ability counting down, then running. */
export const Ability: Story = {
  render: () => ({
    props: {
      cooling: {
        bombs: 2,
        fire: 2,
        speed: 0,
        pierce: false,
        remote: false,
        glove: false,
        kick: false,
        vestSeconds: 0,
        mount: 'tatu',
        abilityReadyIn: 4,
        abilityActive: false,
      },
      active: {
        bombs: 2,
        fire: 2,
        speed: 0,
        pierce: false,
        remote: false,
        glove: false,
        kick: false,
        vestSeconds: 0,
        mount: 'tatu',
        abilityReadyIn: 0,
        abilityActive: true,
      },
    },
    template: `
      <div style="display: grid; gap: var(--space-3)">
        <lib-player-badges [stats]="cooling" />
        <lib-player-badges [stats]="active" />
      </div>
    `,
  }),
};
