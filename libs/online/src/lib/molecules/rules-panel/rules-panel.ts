import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import {
  PUBLIC_ROOM_RULES,
  RoomRules,
  RULE_FIELDS,
  RuleField,
} from '@libs/game-protocol';
import {
  SegmentedControlComponent,
  SegmentedControlOption,
  SwitchComponent,
} from '@libs/ui';
import { TranslatePipe } from '@ngx-translate/core';

/** `countdownMs` → `COUNTDOWN_MS`: the i18n key of a rule under `ONLINE.RULES`. */
export function ruleKey(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}

/**
 * How the room plays, rule by rule, drawn from {@link RULE_FIELDS}: everyone
 * reads them, an admin changes them. A rule changed during a round shows the
 * value that is coming. Presentational: the page sends the change.
 */
@Component({
  selector: 'lib-rules-panel',
  imports: [TranslatePipe, SegmentedControlComponent, SwitchComponent],
  templateUrl: './rules-panel.html',
  styleUrls: ['./rules-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesPanelComponent {
  readonly rules = input<RoomRules>(PUBLIC_ROOM_RULES);
  /** Rules waiting for the next round, or `null`. */
  readonly nextRules = input<RoomRules | null>(null);
  readonly admin = input(false);

  readonly ruleChange = output<Partial<RoomRules>>();

  readonly fields = RULE_FIELDS;
  /**
   * What to show: the pending rules when there are any, so an admin sees what
   * they set. Over the defaults, so a server older than a rule still reads.
   */
  readonly shown = computed(
    (): RoomRules => ({
      ...PUBLIC_ROOM_RULES,
      ...(this.nextRules() ?? this.rules()),
    }),
  );

  labelKey(field: RuleField): string {
    return `ONLINE.RULES.${ruleKey(field.key)}`;
  }

  valueOf(field: RuleField): number | boolean {
    return this.shown()[field.key];
  }

  /** A number as the page says it: a count, seconds, or "off" for a zero clock or streak. */
  text(
    field: RuleField,
    value: number | boolean,
  ): { key: string; params?: Record<string, number> } {
    if (typeof value === 'boolean')
      return { key: value ? 'ONLINE.RULES.ON' : 'ONLINE.RULES.OFF' };
    if (field.unit === 'seconds') {
      return value === 0
        ? { key: 'ONLINE.RULES.OFF' }
        : { key: 'ONLINE.RULES.SECONDS', params: { s: value / 1000 } };
    }
    if (field.unit === 'wins' && value === 0)
      return { key: 'ONLINE.RULES.OFF' };
    return { key: 'ONLINE.RULES.COUNT', params: { n: value } };
  }

  options(field: RuleField): SegmentedControlOption[] {
    return (field.options ?? []).map((value) => {
      const t = this.text(field, value);
      return t.params
        ? {
            value: String(value),
            label:
              String(Object.values(t.params)[0]) +
              (field.unit === 'seconds' ? ' s' : ''),
          }
        : { value: String(value), labelKey: t.key };
    });
  }

  pick(field: RuleField, value: string): void {
    this.ruleChange.emit({ [field.key]: Number(value) });
  }

  toggle(field: RuleField, on: boolean): void {
    this.ruleChange.emit({ [field.key]: on });
  }
}
