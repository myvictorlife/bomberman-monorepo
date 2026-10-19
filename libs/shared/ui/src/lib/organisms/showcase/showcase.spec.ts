import { Component } from '@angular/core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  ShowcaseComponent,
  ShowcaseNoteComponent,
  ShowcaseSectionComponent,
} from './showcase';

@Component({
  imports: [ShowcaseComponent, ShowcaseSectionComponent, ShowcaseNoteComponent],
  template: `
    <lib-showcase eyebrow="Mapa" title="Subestação" lead="A arena do Faísca.">
      <a showcase-actions href="/play">Jogar</a>
      <canvas showcase-stage data-testid="stage"></canvas>
      <p showcase-panel data-testid="panel">Controles</p>
      <lib-showcase-section title="Peças" lead="Cada bloco de perto.">
        <lib-showcase-note title="Pilar">Indestrutível.</lib-showcase-note>
        <lib-showcase-note title="Som" tone="warning"
          >Ainda não feito.</lib-showcase-note
        >
      </lib-showcase-section>
    </lib-showcase>
  `,
})
class HostComponent {}

@Component({
  imports: [ShowcaseComponent],
  template: `<lib-showcase title="Só o título" />`,
})
class BareHostComponent {}

describe('ShowcaseComponent', () => {
  let spectator: Spectator<HostComponent>;
  const createComponent = createComponentFactory(HostComponent);

  beforeEach(() => {
    spectator = createComponent();
  });

  it('renders the head and projects actions, stage and panel into their slots', () => {
    expect(spectator.query('.showcase__eyebrow')).toHaveText('Mapa');
    expect(spectator.query('h1')).toHaveText('Subestação');
    expect(spectator.query('.showcase__lead')).toHaveText('A arena do Faísca.');
    expect(spectator.query('.showcase__actions a')).toHaveText('Jogar');
    expect(spectator.query('.showcase__stage [data-testid="stage"]')).toExist();
    expect(
      spectator.query('.showcase__panel [data-testid="panel"]'),
    ).toHaveText('Controles');
  });

  it('lays sections and notes under the stage', () => {
    expect(spectator.query('.showcase__sections .section__title')).toHaveText(
      'Peças',
    );
    expect(spectator.query('.section__lead')).toHaveText(
      'Cada bloco de perto.',
    );
    const notes = spectator.queryAll('lib-showcase-note');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveText('Pilar');
    expect(notes[1]?.getAttribute('tone')).toBe('warning');
    expect(notes[0]?.getAttribute('tone')).toBe('info');
  });

  it('shows no eyebrow or lead when none is given', () => {
    const bare = createComponentFactory(BareHostComponent)();

    expect(bare.query('h1')).toHaveText('Só o título');
    expect(bare.query('.showcase__eyebrow')).not.toExist();
    expect(bare.query('.showcase__lead')).not.toExist();
  });
});
