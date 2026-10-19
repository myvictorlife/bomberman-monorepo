import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ARENA_THEMES, TEXTURE } from '@libs/game-client';
import { findMap, MapId } from '@libs/game-core';
import {
  ButtonComponent,
  ShowcaseComponent,
  ShowcaseNoteComponent,
  ShowcaseSectionComponent,
  SpritePainter,
  SpriteTileComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { ArenasStore } from '../../+state/arenas.store';
import {
  ARENA_DEMO_VIDEOS,
  ARENA_TILE_PAINTER,
} from '../../services/arena-preview-painter';

/** The tiles an arena is built from, in the order they are shown. */
export const ARENA_PIECES = [
  { key: TEXTURE.floor, nameKey: 'ARENAS.PIECE_FLOOR' },
  { key: TEXTURE.wall, nameKey: 'ARENAS.PIECE_WALL' },
  { key: TEXTURE.block, nameKey: 'ARENAS.PIECE_BLOCK' },
  { key: TEXTURE.feature, nameKey: 'ARENAS.PIECE_FEATURE' },
  { key: TEXTURE.wallBorder, nameKey: 'ARENAS.PIECE_BORDER' },
  { key: TEXTURE.wallTop, nameKey: 'ARENAS.PIECE_TOP' },
] as const;

/**
 * One arena up close: a match playing on it, its facts, every tile it is built
 * from at the arena's size and zoomed, and the decisions behind it.
 */
@Component({
  selector: 'lib-arena-detail',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonComponent,
    ShowcaseComponent,
    ShowcaseSectionComponent,
    ShowcaseNoteComponent,
    SpriteTileComponent,
  ],
  templateUrl: './arena-detail.html',
  styleUrls: ['./arena-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArenaDetail {
  private readonly store = inject(ArenasStore);
  private readonly play = inject(ARENA_DEMO_VIDEOS);
  private readonly paintTile = inject(ARENA_TILE_PAINTER);
  private readonly preview =
    viewChild.required<ElementRef<HTMLCanvasElement>>('preview');

  /** The guard on the route guarantees a known id. */
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') as MapId;
  readonly others = this.store.maps().filter((m) => m !== this.id);
  readonly accent = ARENA_THEMES[this.id].accent;
  /** The centre piece only exists on maps that put an extra wall there. */
  readonly pieces = ARENA_PIECES.filter(
    (p) => p.key !== TEXTURE.feature || findMap(this.id).extraWalls.length > 0,
  );
  readonly notes = [1, 2, 3].map(
    (n) => `MAPS.${this.id.toUpperCase()}.NOTE_${n}`,
  );
  readonly sizes = [
    { px: 64, labelKey: 'ARENAS.SIZE_REAL' },
    { px: 128, labelKey: 'ARENAS.SIZE_2X' },
  ];

  constructor() {
    this.store.select(this.id);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const videos = this.play([this.preview().nativeElement]);
      destroyRef.onDestroy(() => videos.stop());
    });
  }

  mapKey(
    field: 'NAME' | 'OWNER' | 'DESC' | 'MOMENT' | 'MOMENT_DESC',
    id: MapId = this.id,
  ): string {
    return `MAPS.${id.toUpperCase()}.${field}`;
  }

  /** A painter for one of this arena's tiles, for the sprite tiles. */
  tileOf(key: string): SpritePainter {
    return (ctx) => this.paintTile(ctx, this.id, key);
  }
}
