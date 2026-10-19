import { CharacterFrame } from '@libs/game-client';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { MOUNT_SPRITE_PAINTER } from '../../services/mount-painter';
import { MountSprite } from './mount-sprite';

describe('MountSprite', () => {
  let spectator: Spectator<MountSprite>;
  const painted: CharacterFrame[] = [];
  const createComponent = createComponentFactory({
    component: MountSprite,
    providers: [
      {
        provide: MOUNT_SPRITE_PAINTER,
        useValue: (doc: Document, frame: CharacterFrame) => {
          painted.push(frame);
          return doc.createElement('canvas');
        },
      },
    ],
  });

  beforeEach(() => {
    painted.length = 0;
    spectator = createComponent({
      props: { mountId: 'pato', riderId: 'lia', size: 56 },
    });
  });

  it('paints the rider on the mount, hidden from assistive tech, and again when a pose changes', () => {
    const canvas = spectator.query('canvas') as HTMLCanvasElement;
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas.dataset).toMatchObject({
      mount: 'pato',
      character: 'lia',
      facing: 'down',
      frame: '0',
    });
    expect(spectator.query('.sprite')).toHaveStyle({
      width: '56px',
      height: '56px',
    });

    spectator.setInput({ facing: 'left', frame: 2 });
    expect(
      (spectator.query('canvas') as HTMLCanvasElement).dataset,
    ).toMatchObject({ facing: 'left', frame: '2' });
    expect(painted).toHaveLength(2);
    expect(painted[1]).toEqual({
      characterId: 'lia',
      facing: 'left',
      frame: 2,
      mountId: 'pato',
      slot: 0,
    });
  });
});
