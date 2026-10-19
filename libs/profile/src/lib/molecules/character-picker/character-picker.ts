import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CHARACTERS, CharacterId, PlayerColorId } from '@libs/game-core';
import { colorSlot, paintCartoonCharacter } from '@libs/game-client';
import { SpritePainter, SpriteTileComponent } from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The roster as a grid of portraits, painted in the player's colour, for
 * picking the favourite character. A radio group.
 */
@Component({
  selector: 'lib-character-picker',
  imports: [SpriteTileComponent, TranslatePipe],
  templateUrl: './character-picker.html',
  styleUrls: ['./character-picker.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterPickerComponent {
  readonly value = input<CharacterId | null>(null);
  readonly color = input<PlayerColorId | null>(null);
  readonly disabled = input(false);
  readonly pick = output<CharacterId>();

  readonly characters = CHARACTERS;

  /** One painter per character, rebuilt only when the colour changes. */
  readonly painters = computed(() => {
    const color = this.color();
    const slot = color ? colorSlot(color) : 0;
    return new Map<CharacterId, SpritePainter>(
      CHARACTERS.map((c) => [
        c.id,
        (ctx) =>
          paintCartoonCharacter(ctx, {
            characterId: c.id,
            facing: 'down',
            frame: 0,
            slot,
          }),
      ]),
    );
  });

  nameKey(id: CharacterId): string {
    return `CHARACTERS.${id.toUpperCase()}.NAME`;
  }

  choose(id: CharacterId): void {
    if (id !== this.value()) this.pick.emit(id);
  }
}
