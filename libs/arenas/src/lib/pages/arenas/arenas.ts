import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ARENA_THEMES } from '@libs/game-client';
import { MapId } from '@libs/game-core';
import { ButtonComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';
import { ArenasStore } from '../../+state/arenas.store';
import { ARENA_DEMO_VIDEOS } from '../../services/arena-preview-painter';

@Component({
  selector: 'lib-arenas',
  imports: [TranslatePipe, RouterLink, ButtonComponent],
  templateUrl: './arenas.html',
  styleUrls: ['./arenas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Arenas {
  private readonly store = inject(ArenasStore);
  private readonly play = inject(ARENA_DEMO_VIDEOS);
  private readonly previews =
    viewChildren<ElementRef<HTMLCanvasElement>>('preview');

  readonly maps = this.store.maps;
  readonly selected = this.store.selected;
  readonly select = this.store.select;

  constructor() {
    // Each card plays a little match on its arena, by the rules; stopped when the page is left.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const videos = this.play(this.previews().map((p) => p.nativeElement));
      destroyRef.onDestroy(() => videos.stop());
    });
  }

  accent(id: MapId): string {
    return ARENA_THEMES[id].accent;
  }

  mapKey(
    id: string,
    field: 'NAME' | 'OWNER' | 'DESC' | 'MOMENT' | 'MOMENT_DESC',
  ): string {
    return `MAPS.${id.toUpperCase()}.${field}`;
  }
}
