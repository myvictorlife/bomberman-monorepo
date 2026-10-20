import { CreatureFrame } from '@libs/game-client';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { CREATURE_PAINTER } from '../../services/creature-painter';
import { CreatureSprite } from './creature-sprite';

describe('CreatureSprite', () => {
  let spectator: Spectator<CreatureSprite>;
  const painted: CreatureFrame[] = [];

  const createComponent = createComponentFactory({
    component: CreatureSprite,
    providers: [
      {
        provide: CREATURE_PAINTER,
        useValue: (doc: Document, frame: CreatureFrame) => {
          painted.push(frame);
          return doc.createElement('canvas');
        },
      },
    ],
  });

  beforeEach(() => {
    painted.length = 0;
    spectator = createComponent({
      props: { subject: { creature: 'pombo' }, size: 48 },
    });
  });

  it('paints at twice the size, facing right by default', () => {
    expect(painted).toEqual([
      { subject: { creature: 'pombo' }, size: 96, flip: false },
    ]);
    expect(spectator.query('.sprite')).toHaveStyle({
      width: '48px',
      height: '48px',
    });
    expect(spectator.query('canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  it('repaints when the subject changes', () => {
    spectator.setInput({ subject: { boss: 'rainha' }, flip: true });

    expect(painted.at(-1)).toEqual({
      subject: { boss: 'rainha' },
      size: 96,
      flip: true,
    });
    expect(spectator.queryAll('canvas')).toHaveLength(1);
  });
});
