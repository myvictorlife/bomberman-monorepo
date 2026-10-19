import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** What a player has picked up, as the game's HUD reports it. Plain data, so any page can feed it. */
export interface PlayerBadgeStats {
  bombs: number;
  fire: number;
  speed: number;
  pierce: boolean;
  remote: boolean;
  glove: boolean;
  kick: boolean;
  /** Whole seconds of vest left; 0 when none. */
  vestSeconds: number;
  /** The mount's id, or `null` on foot. */
  mount: string | null;
  /** Whole seconds until the mount ability is ready; 0 when ready. */
  abilityReadyIn: number;
  abilityActive: boolean;
}

export interface PlayerBadge {
  key: string;
  icon: string;
  /** The number or state shown beside the icon; nothing for a one-off item. */
  value: string | null;
  /** The name, shown on hover and read to assistive tech. */
  tip: string;
  state?: 'ready' | 'active' | 'cooldown';
}

/**
 * A player's stats as a row of icon badges — a count beside the counted ones,
 * only the icon for a one-off item — with the name on hover and for screen
 * readers, so a card stays one line whatever was picked up.
 */
@Component({
  selector: 'lib-player-badges',
  templateUrl: './player-badges.html',
  styleUrls: ['./player-badges.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.badges--sm]': 'size() === "sm"' },
})
export class PlayerBadgesComponent {
  private readonly translate = inject(TranslateService);

  readonly stats = input.required<PlayerBadgeStats>();
  /** Prefix of each badge's `data-testid`: `<testId>-bombs`, `<testId>-pierce`, … */
  readonly testId = input('badge');
  /** `sm` for a strip over the arena, where the row must stay discreet. */
  readonly size = input<'md' | 'sm'>('md');

  readonly badges = computed((): PlayerBadge[] => {
    const s = this.stats();
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(key, params) as string;
    const list: PlayerBadge[] = [
      {
        key: 'bombs',
        icon: '💣',
        value: String(s.bombs),
        tip: t('PLAY.BOMBS'),
      },
      { key: 'fire', icon: '🔥', value: String(s.fire), tip: t('PLAY.FIRE') },
    ];
    // The strip over the arena leaves out a speed nobody has picked up yet.
    if (s.speed > 0 || this.size() === 'md')
      list.push({
        key: 'speed',
        icon: '🛼',
        value: String(s.speed),
        tip: t('PLAY.SPEED'),
      });
    if (s.pierce)
      list.push({
        key: 'pierce',
        icon: '🧨',
        value: null,
        tip: t('PLAY.PIERCE'),
      });
    if (s.remote)
      list.push({
        key: 'remote',
        icon: '🎮',
        value: null,
        tip: t('PLAY.REMOTE'),
      });
    if (s.glove)
      list.push({
        key: 'glove',
        icon: '🧤',
        value: null,
        tip: t('PLAY.GLOVE'),
      });
    if (s.kick)
      list.push({ key: 'kick', icon: '👟', value: null, tip: t('PLAY.KICK') });
    if (s.vestSeconds > 0) {
      list.push({
        key: 'vest',
        icon: '🛡️',
        value: t('PLAY.ABILITY_IN', { s: s.vestSeconds }),
        tip: t('PLAY.VEST'),
      });
    }
    if (s.mount) {
      list.push({
        key: 'mount',
        icon: '🐾',
        value: null,
        tip: `${t('PLAY.MOUNT')}: ${t(`MOUNTS.${s.mount.toUpperCase()}.NAME`)}`,
      });
      const state = s.abilityActive
        ? 'active'
        : s.abilityReadyIn > 0
          ? 'cooldown'
          : 'ready';
      const text =
        state === 'active'
          ? t('PLAY.ABILITY_ACTIVE')
          : state === 'cooldown'
            ? t('PLAY.ABILITY_IN', { s: s.abilityReadyIn })
            : t('PLAY.ABILITY_READY');
      list.push({
        key: 'ability',
        icon: '⚡',
        value: state === 'cooldown' ? text : null,
        tip: `${t('PLAY.ABILITY')}: ${text}`,
        state,
      });
    }
    return list;
  });
}
