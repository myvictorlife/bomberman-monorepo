import type { Meta, StoryObj } from '@storybook/angular';
import { PodiumComponent, PodiumPainter } from './podium';

/** A stand-in face: a coloured disc with the place on it, drawn in a 64-unit space. */
const paintDisc: PodiumPainter = (ctx, _characterId, place) => {
  ctx.beginPath();
  ctx.arc(32, 34, 22, 0, Math.PI * 2);
  ctx.fillStyle = ['#f1c744', '#c9cfdb', '#d9843b'][place - 1] ?? '#888';
  ctx.fill();
  ctx.fillStyle = '#1b1510';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(place), 32, 35);
};

const meta: Meta<PodiumComponent> = {
  title: 'Molecules/Podium',
  component: PodiumComponent,
  render: (args) => ({
    props: { ...args, paint: paintDisc },
    template: `<lib-podium [entries]="entries" [paint]="paint" [myId]="myId" />`,
  }),
  args: {
    entries: [
      { id: 'v', name: 'Victor', wins: 14, matches: 21, characterId: 'faisca' },
      { id: 'r', name: 'Raquel', wins: 5, matches: 21, characterId: 'lia' },
      { id: 't', name: 'Tião', wins: 2, matches: 3, characterId: 'tiao' },
    ],
    myId: 'r',
  },
};
export default meta;

type Story = StoryObj<PodiumComponent>;

/** Three on the steps, the viewer highlighted. */
export const Full: Story = {};

/** Only one winner so far: the other steps wait. */
export const Lonely: Story = {
  args: {
    entries: [{ id: 'v', name: 'Victor', wins: 1, matches: 1 }],
    myId: null,
  },
};
