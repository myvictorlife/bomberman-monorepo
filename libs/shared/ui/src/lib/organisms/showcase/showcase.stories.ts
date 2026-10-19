import type { Meta, StoryObj } from '@storybook/angular';
import {
  ShowcaseComponent,
  ShowcaseNoteComponent,
  ShowcaseSectionComponent,
} from './showcase';

const meta: Meta<ShowcaseComponent> = {
  title: 'Organisms/Showcase',
  component: ShowcaseComponent,
  render: (args) => ({
    props: args,
    moduleMetadata: {
      imports: [ShowcaseSectionComponent, ShowcaseNoteComponent],
    },
    template: `
      <lib-showcase [eyebrow]="eyebrow" [title]="title" [lead]="lead">
        <button showcase-actions type="button">Play here</button>
        <div showcase-stage style="width: 16rem; height: 16rem; display: grid; place-items: center; color: #9aa3b5">stage</div>
        <div showcase-panel>
          <p style="font-size: var(--font-size-xs); letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-text-secondary)">Controls</p>
          <p>Anything the page needs: toggles, swatches, stats.</p>
        </div>
        <lib-showcase-section title="Side by side" lead="The first tile is what the player sees.">
          <div style="display: flex; gap: var(--space-4)">
            <div style="width: 4rem; height: 4rem; background: #1b1f2a; border-radius: 6px"></div>
            <div style="width: 8rem; height: 8rem; background: #1b1f2a; border-radius: 6px"></div>
          </div>
        </lib-showcase-section>
        <lib-showcase-section title="Decisions">
          <div style="display: grid; gap: var(--space-3); grid-template-columns: 1fr 1fr">
            <lib-showcase-note title="Why this shape">It reads at 64 px.</lib-showcase-note>
            <lib-showcase-note title="Open point" tone="warning">Sound is not done.</lib-showcase-note>
          </div>
        </lib-showcase-section>
      </lib-showcase>
    `,
  }),
  args: {
    eyebrow: 'Arena · Faísca’s workplace',
    title: 'Substation',
    lead: 'The arena where the electrician works.',
  },
};
export default meta;

type Story = StoryObj<ShowcaseComponent>;

export const Playground: Story = {};
