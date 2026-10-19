import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The detail layout every "look closer" page shares — a character, an arena,
 * an item: a head with the eyebrow, title and lead; a stage with the big
 * picture next to a panel of controls; then sections of smaller views and
 * notes. The page projects its own stage, panel and sections.
 *
 * ```html
 * <lib-showcase eyebrow="Mapa" title="Subestação" lead="…">
 *   <a showcase-actions …>Jogar</a>
 *   <canvas showcase-stage></canvas>
 *   <div showcase-panel>…</div>
 *   <lib-showcase-section title="Peças">…</lib-showcase-section>
 * </lib-showcase>
 * ```
 */
@Component({
  selector: 'lib-showcase',
  templateUrl: './showcase.html',
  styleUrl: './showcase.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseComponent {
  /** Small uppercase line above the title: the kind of thing shown. */
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  readonly lead = input<string | null>(null);
}

/** A titled block under the stage: tiles at several sizes, a sprite sheet, notes. */
@Component({
  selector: 'lib-showcase-section',
  template: `
    <section class="section">
      <h2 class="section__title">{{ title() }}</h2>
      @if (lead(); as text) {
        <p class="section__lead">{{ text }}</p>
      }
      <div class="section__body"><ng-content /></div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .section__title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .section__lead {
      margin-top: var(--space-1);
      max-width: 60ch;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
    }
    .section__body {
      margin-top: var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseSectionComponent {
  readonly title = input.required<string>();
  readonly lead = input<string | null>(null);
}

export type ShowcaseNoteTone = 'info' | 'warning';

/** One decision or remark, with a coloured edge; several sit in a grid. */
@Component({
  selector: 'lib-showcase-note',
  template: `
    <h3 class="note__title">{{ title() }}</h3>
    <p class="note__body"><ng-content /></p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border-left: 3px solid var(--color-info);
      border-radius: var(--radius-sm);
      background: var(--color-bg-surface);
    }
    :host([tone='warning']) {
      border-left-color: var(--color-warning);
    }
    .note__title {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }
    .note__body {
      font-size: var(--font-size-sm);
      line-height: 1.55;
      color: var(--color-text-secondary);
    }
  `,
  host: { '[attr.tone]': 'tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseNoteComponent {
  readonly title = input.required<string>();
  readonly tone = input<ShowcaseNoteTone>('info');
}
