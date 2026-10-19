import { CharacterFrame } from '@libs/game-client';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { CHARACTER_PAINTER } from '../../services/character-painter';
import { CharacterSprite } from './character-sprite';

describe('CharacterSprite', () => {
  let spectator: Spectator<CharacterSprite>;
  const painted: CharacterFrame[] = [];

  const createComponent = createComponentFactory({
    component: CharacterSprite,
    providers: [
      {
        provide: CHARACTER_PAINTER,
        useValue: (doc: Document, frame: CharacterFrame) => {
          painted.push(frame);
          return doc.createElement('canvas');
        },
      },
    ],
  });

  beforeEach(() => {
    painted.length = 0;
    spectator = createComponent({ props: { characterId: 'faisca', size: 96 } });
  });

  it('paints the standing frame, facing down, on foot by default', () => {
    expect(painted).toEqual([
      {
        characterId: 'faisca',
        facing: 'down',
        frame: 0,
        mountId: null,
        slot: 0,
      },
    ]);

    const canvas = spectator.query('canvas');
    expect(canvas).toHaveAttribute('data-facing', 'down');
    expect(canvas).toHaveAttribute('data-character', 'faisca');
    expect(spectator.query('.sprite')).toHaveStyle({
      width: '96px',
      height: '96px',
    });
    expect(canvas).toHaveStyle({ width: '100%', height: '100%' });
  });

  it('repaints when the pose, the mount or the character changes', () => {
    spectator.setInput({
      facing: 'left',
      frame: 2,
      mountId: 'pato',
      characterId: 'byte',
      slot: 2,
    });

    expect(painted.at(-1)).toEqual({
      characterId: 'byte',
      facing: 'left',
      frame: 2,
      mountId: 'pato',
      slot: 2,
    });
    expect(spectator.queryAll('canvas')).toHaveLength(1);
    expect(spectator.query('canvas')).toHaveAttribute('data-mount', 'pato');
  });
});
