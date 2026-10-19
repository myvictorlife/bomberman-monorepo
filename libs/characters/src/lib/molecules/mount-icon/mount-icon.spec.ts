import { MountId } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { MOUNT_ICON_PAINTER } from '../../services/character-painter';
import { MountIcon } from './mount-icon';

describe('MountIcon', () => {
  let spectator: Spectator<MountIcon>;
  const painted: [MountId, number | undefined][] = [];

  const createComponent = createComponentFactory({
    component: MountIcon,
    providers: [
      {
        provide: MOUNT_ICON_PAINTER,
        useValue: (doc: Document, mountId: MountId, slot?: number) => {
          painted.push([mountId, slot]);
          return doc.createElement('canvas');
        },
      },
    ],
  });

  beforeEach(() => {
    painted.length = 0;
    spectator = createComponent({ props: { mountId: 'tatu' } });
  });

  it('paints the mount portrait and repaints for another mount', () => {
    expect(painted).toEqual([['tatu', 0]]);
    expect(spectator.query('canvas')).toHaveAttribute('data-mount', 'tatu');

    spectator.setInput({ mountId: 'pato', slot: 1 });

    expect(painted.at(-1)).toEqual(['pato', 1]);
    expect(spectator.queryAll('canvas')).toHaveLength(1);
  });
});
