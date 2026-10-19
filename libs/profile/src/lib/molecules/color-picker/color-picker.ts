import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { PLAYER_COLOR_IDS, PlayerColorId } from '@libs/game-core';
import { colorSlot, hdSkin } from '@libs/game-client';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The eight player colours as swatches, plus "automatic" — the colour of the
 * slot the round gives. A radio group: one is always the current choice.
 */
@Component({
  selector: 'lib-color-picker',
  imports: [TranslatePipe],
  templateUrl: './color-picker.html',
  styleUrls: ['./color-picker.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent {
  readonly value = input<PlayerColorId | null>(null);
  readonly disabled = input(false);
  readonly pick = output<PlayerColorId | null>();

  readonly colors = PLAYER_COLOR_IDS;

  hex(color: PlayerColorId): string {
    return hdSkin.playerColors[colorSlot(color)] ?? '#888';
  }

  labelKey(color: PlayerColorId): string {
    return `PROFILE.COLOR_NAMES.${color.toUpperCase()}`;
  }

  choose(color: PlayerColorId | null): void {
    if (color !== this.value()) this.pick.emit(color);
  }
}
