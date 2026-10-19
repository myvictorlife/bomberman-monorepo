import * as Phaser from 'phaser';
import type { ArenaHandle, ArenaOptions } from '../mount-arena';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Voice } from '../audio/voice';
import { LocalSession } from '../session/local-session';
import { hdSkin } from '../skins/hd/hd-skin';
import { ArenaScene } from './arena-scene';

/** Only reached through `mountArena`'s dynamic import — Phaser stays out of every other chunk. */
export function createArenaGame(
  host: HTMLElement,
  options: ArenaOptions,
): ArenaHandle {
  const skin = options.skin ?? hdSkin;
  const sfx = new Sfx();
  sfx.muted = options.muted ?? false;
  const voice = new Voice();
  voice.muted = sfx.muted;
  const music = new Music();
  if (options.music ?? true) music.start();
  const local = options.session
    ? null
    : new LocalSession(
        {
          seed: options.seed ?? Date.now(),
          players: options.players,
          mapId: options.mapId,
        },
        options.bots,
      );
  const session = options.session ?? (local as LocalSession);
  const scene = new ArenaScene({
    session,
    controls: options.controls,
    skin,
    sfx,
    voice,
    onHud: options.onHud,
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: session.state.cols * skin.tileSize,
    height: session.state.rows * skin.tileSize,
    pixelArt: skin.pixelArt,
    roundPixels: skin.pixelArt,
    antialias: !skin.pixelArt,
    backgroundColor: '#0b0b12',
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  });

  return {
    restart: (seed) => local?.restart(seed),
    setMuted: (muted) => {
      sfx.muted = muted;
      voice.muted = muted;
    },
    setMusic: (on) => (on ? music.start() : music.stop()),
    destroy: () => {
      music.close();
      voice.close();
      sfx.close();
      const gl = (game.renderer as { gl?: WebGLRenderingContext }).gl;
      game.destroy(true);
      // A destroyed game's WebGL context lives on until garbage collection, and
      // browsers allow only a handful per page: after a few visits the oldest
      // live one is dropped and the arena flickers. Release it now instead.
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
