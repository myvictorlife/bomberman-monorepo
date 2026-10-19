import { MountId } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { MOUNT_PORTRAIT_PAINTER } from '../../services/mount-painter';
import { MountPortrait } from './mount-portrait';

describe('MountPortrait', () => {
  let spectator: Spectator<MountPortrait>;
  const painted: MountId[] = [];
  const createComponent = createComponentFactory({
    component: MountPortrait,
    providers: [
      {
        provide: MOUNT_PORTRAIT_PAINTER,
        useValue: (doc: Document, mountId: MountId) => {
          painted.push(mountId);
          return doc.createElement('canvas');
        },
      },
    ],
  });

  beforeEach(() => {
    painted.length = 0;
    spectator = createComponent({ props: { mountId: 'pato', size: 64 } });
  });

  it('paints the mount into its box, hidden from assistive tech, and again when the mount changes', () => {
    const canvas = spectator.query('canvas[data-mount="pato"]');
    expect(canvas).toExist();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(spectator.query('.portrait')).toHaveStyle({
      width: '64px',
      height: '64px',
    });

    spectator.setInput('mountId', 'tatu');
    expect(spectator.query('canvas[data-mount="tatu"]')).toExist();
    expect(painted).toEqual(['pato', 'tatu']);
  });
});
