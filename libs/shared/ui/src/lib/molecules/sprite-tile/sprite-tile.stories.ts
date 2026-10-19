import type { Meta, StoryObj } from '@storybook/angular';
import { SpritePainter, SpriteTileComponent } from './sprite-tile';

/** A stand-in sprite: a bomb-ish circle with a fuse, drawn in a 64-unit space. */
const paintBall: SpritePainter = (ctx) => {
  ctx.beginPath();
  ctx.arc(30, 36, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#262a37';
  ctx.fill();
  ctx.strokeStyle = '#5fd3ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(42, 22);
  ctx.quadraticCurveTo(50, 16, 48, 8);
  ctx.stroke();
};

const meta: Meta<SpriteTileComponent> = {
  title: 'Molecules/Sprite tile',
  component: SpriteTileComponent,
  render: (args) => ({
    props: { ...args, paint: paintBall },
    template: `<lib-sprite-tile [paint]="paint" [size]="size" [units]="units" [label]="label" />`,
  }),
  argTypes: {
    size: { control: { type: 'range', min: 32, max: 256, step: 16 } },
  },
  args: { size: 64, units: 64, label: '64 px · real' },
};
export default meta;

type Story = StoryObj<SpriteTileComponent>;

export const Playground: Story = {};

/** The same sprite at the arena's size and zoomed, as the detail pages show it. */
export const Sizes: Story = {
  render: () => ({
    props: { paint: paintBall },
    template: `
      <div style="display: flex; align-items: flex-end; gap: var(--space-4)">
        <lib-sprite-tile [paint]="paint" [size]="64" label="64 px · real" />
        <lib-sprite-tile [paint]="paint" [size]="128" label="2×" />
        <lib-sprite-tile [paint]="paint" [size]="192" label="3×" />
      </div>
    `,
  }),
};
