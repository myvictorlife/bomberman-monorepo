import { provideRouter } from '@angular/router';
import { CharacterSelectionService } from '@libs/character-select';
import { CharacterFrame } from '@libs/game-client';
import { MountId } from '@libs/game-core';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import {
  provideTranslateService,
  TranslateLoader,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { CharactersStore } from '../../+state/characters.store';
import {
  CHARACTER_PAINTER,
  MOUNT_ICON_PAINTER,
} from '../../services/character-painter';
import { Characters, WALK_STEP_MS } from './characters';

class StubTranslateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      CHARACTERS: {
        TITLE: 'Characters',
        LEAD: 'Lead',
        ROSTER: 'Roster',
        SELECTED: 'Selected',
        PLAY_WITH: 'Play as {{name}}',
        MOUNT: 'Mount',
        ON_FOOT: 'On foot',
        SEE_MOUNTS: 'See the mounts',
        TURN_HINT: 'Click to turn',
        FACING: 'Facing',
        FACING_DOWN: 'Front',
        FACING_LEFT: 'Left',
        FACING_UP: 'Back',
        FACING_RIGHT: 'Right',
        POSE_STANDING: '{{side}}, standing',
        POSE_WALKING: '{{side}}, walking',
        WALK: 'Walk',
        STAND: 'Stand still',
        STORY: 'Story',
        BOMBS: 'Bombs',
        FIRE: 'Fire',
        SPEED: 'Speed',
        SPEED_VALUE: '{{n}} tiles/s',
        NOVATO: {
          NAME: 'Rookie',
          JOB: 'First match',
          STORY: 'Read the rules once.',
        },
        FAISCA: { NAME: 'Faísca', JOB: 'Sapper', STORY: 'Wakes at five.' },
        BYTE: { NAME: 'Byte', JOB: 'Developer', STORY: 'One more coffee.' },
        LIA: { NAME: 'Dra. Lia', JOB: 'Doctor', STORY: 'Keeps score.' },
        MOTOCA: { NAME: 'Zé Motoca', JOB: 'Rider', STORY: 'Never cancels.' },
      },
      CHARACTER_GROUPS: {
        STARTER: 'Starter',
        DEMOLITION: 'Demolition',
        TECH: 'IT',
        HEALTH: 'Health',
        DELIVERY: 'Delivery',
      },
      MOUNTS: {
        TATU: {
          NAME: 'Tatu',
          STORY: 'Rolls up.',
          ABILITY: 'Roll',
          ABILITY_DESC: 'Immune for a second.',
        },
        PATO: {
          NAME: 'Pato',
          STORY: 'Listens to bugs.',
          ABILITY: 'Hop',
          ABILITY_DESC: 'Over the cell ahead.',
        },
        BERNARDO: {
          NAME: 'Bernardo',
          STORY: 'Never saw a mountain.',
          ABILITY: 'Sniff',
          ABILITY_DESC: 'Shows what crates hide.',
        },
        CAPIVARA: {
          NAME: 'Capivara',
          STORY: 'Never leaves.',
          ABILITY: 'Unbothered',
          ABILITY_DESC: 'Walks over bombs.',
        },
      },
    });
  }
}

describe('Characters', () => {
  let spectator: Spectator<Characters>;
  const painted: CharacterFrame[] = [];

  const createComponent = createComponentFactory({
    component: Characters,
    providers: [
      CharactersStore,
      provideRouter([]),
      {
        provide: CHARACTER_PAINTER,
        useValue: (doc: Document, frame: CharacterFrame) => {
          painted.push(frame);
          return doc.createElement('canvas');
        },
      },
      {
        provide: MOUNT_ICON_PAINTER,
        useValue: (doc: Document, mountId: MountId) => {
          const canvas = doc.createElement('canvas');
          canvas.dataset['mount'] = mountId;
          return canvas;
        },
      },
      provideTranslateService({
        loader: [{ provide: TranslateLoader, useClass: StubTranslateLoader }],
        lang: 'en',
        fallbackLang: 'en',
      }),
    ],
  });

  const stage = () =>
    spectator.query('[data-testid="characters-stage"] canvas');

  beforeEach(() => {
    localStorage.clear();
    painted.length = 0;
    spectator = createComponent();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists the roster by profession with the default character selected, and points to the mounts', () => {
    expect(spectator.query('[data-testid="characters-title"]')).toHaveText(
      'Characters',
    );

    const groups = spectator.queryAll('[data-testid="characters-group"]');
    expect(groups.map((g) => g.getAttribute('data-group'))).toEqual([
      'starter',
      'demolition',
      'tech',
      'health',
      'delivery',
      'works',
    ]);
    expect(groups[2]).toHaveText('IT');
    expect(groups[2]?.querySelector('[data-character="byte"]')).not.toBeNull();

    const cards = spectator.queryAll('[data-testid="characters-card"]');
    expect(cards).toHaveLength(11);
    expect(cards[0]).toHaveText('Rookie');
    expect(cards[0]).toHaveText('First match');
    expect(cards[0]).toHaveText('Selected');
    expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
    expect(cards[1]).not.toHaveText('Selected');
    expect(
      spectator.query('[data-testid="characters-selected-name"]'),
    ).toHaveText('Rookie');
    expect(spectator.query('[data-testid="characters-story"]')).toHaveText(
      'Read the rules once.',
    );
    expect(spectator.queryAll('[data-testid="characters-mount"]')).toHaveLength(
      5,
    );
    // Their stories and abilities live on the mounts page now.
    expect(
      spectator.query('[data-testid="characters-mounts-link"]'),
    ).toHaveAttribute('href', '/mounts');
    expect(spectator.query('[data-testid="characters-play"]')).toHaveText(
      'Play as Rookie',
    );
    expect(spectator.query('[data-testid="characters-stats"]')).toHaveText(
      '3.2 tiles/s',
    );
  });

  it('selects another character for the game and shows its story', () => {
    spectator.click('[data-testid="characters-card"][data-character="byte"]');

    expect(spectator.inject(CharacterSelectionService).selectedId()).toBe(
      'byte',
    );
    expect(
      spectator.query('[data-testid="characters-selected-name"]'),
    ).toHaveText('Byte');
    expect(spectator.query('[data-testid="characters-story"]')).toHaveText(
      'One more coffee.',
    );
    expect(stage()).toHaveAttribute('data-character', 'byte');
    expect(spectator.queryAll('[data-testid="characters-card"]')[2]).toHaveText(
      'Selected',
    );

    spectator.click('[data-testid="characters-card"][data-character="motoca"]');
    expect(
      spectator.query('[data-testid="characters-selected-name"]'),
    ).toHaveText('Zé Motoca');
    expect(spectator.query('[data-testid="characters-story"]')).toHaveText(
      'Never cancels.',
    );
  });

  it('shows the selected character standing, facing the front, on foot', () => {
    expect(stage()).toHaveAttribute('data-facing', 'down');
    expect(stage()).toHaveAttribute('data-frame', '0');
    expect(stage()).toHaveAttribute('data-mount', 'none');
  });

  it('turns the character when the stage is clicked', () => {
    spectator.click('[data-testid="characters-stage"]');
    expect(stage()).toHaveAttribute('data-facing', 'left');

    spectator.click('[data-testid="characters-stage"]');
    expect(stage()).toHaveAttribute('data-facing', 'up');
  });

  it('shows eight poses around the stage: the sides standing, the corners walking', () => {
    const poses = spectator.queryAll('[data-testid="characters-pose"]');
    expect(poses).toHaveLength(8);
    expect(
      poses.filter((p) => p.getAttribute('data-walking') === 'true'),
    ).toHaveLength(4);
    expect(poses[1]).toHaveAttribute('aria-label', 'Back, standing');
    expect(poses[2]).toHaveAttribute('aria-label', 'Right, walking');
    // A walking thumbnail is caught mid-step while the stage stands still.
    expect(poses[2]?.querySelector('canvas')).toHaveAttribute(
      'data-frame',
      '1',
    );
    expect(poses[1]?.querySelector('canvas')).toHaveAttribute(
      'data-frame',
      '0',
    );
  });

  it('faces the side whose pose is clicked, walking when the pose walks', () => {
    spectator.click(
      '[data-testid="characters-pose"][data-facing="right"][data-walking="false"]',
    );

    expect(stage()).toHaveAttribute('data-facing', 'right');
    expect(stage()).toHaveAttribute('data-frame', '0');
    expect(
      spectator.query(
        '[data-testid="characters-pose"][data-facing="right"][data-walking="false"]',
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      spectator.query(
        '[data-testid="characters-pose"][data-facing="down"][data-walking="false"]',
      ),
    ).toHaveAttribute('aria-pressed', 'false');

    spectator.click(
      '[data-testid="characters-pose"][data-facing="left"][data-walking="true"]',
    );
    expect(stage()).toHaveAttribute('data-facing', 'left');
    expect(stage()).toHaveAttribute('data-frame', '1');
    expect(spectator.query('[data-testid="characters-walk"]')).toHaveText(
      'Stand still',
    );
    expect(
      spectator.query(
        '[data-testid="characters-pose"][data-facing="left"][data-walking="true"]',
      ),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('previews any mount, then back on foot', () => {
    spectator.click('[data-testid="characters-mount"][data-mount="bernardo"]');

    expect(stage()).toHaveAttribute('data-mount', 'bernardo');
    expect(painted.at(-1)?.mountId).toBe('bernardo');
    expect(
      spectator.query(
        '[data-testid="characters-mount"][data-mount="bernardo"]',
      ),
    ).toHaveAttribute('aria-pressed', 'true');

    spectator.click('[data-testid="characters-on-foot"]');
    expect(stage()).toHaveAttribute('data-mount', 'none');
  });

  it('walks through the step cycle while walking is on, then stands still', () => {
    vi.useFakeTimers();

    spectator.click('[data-testid="characters-walk"]');
    expect(spectator.query('[data-testid="characters-walk"]')).toHaveText(
      'Stand still',
    );
    expect(stage()).toHaveAttribute('data-frame', '1');

    vi.advanceTimersByTime(WALK_STEP_MS);
    spectator.detectChanges();
    expect(stage()).toHaveAttribute('data-frame', '0');

    vi.advanceTimersByTime(WALK_STEP_MS);
    spectator.detectChanges();
    expect(stage()).toHaveAttribute('data-frame', '2');

    spectator.click('[data-testid="characters-walk"]');
    expect(stage()).toHaveAttribute('data-frame', '0');

    vi.advanceTimersByTime(WALK_STEP_MS * 3);
    spectator.detectChanges();
    expect(stage()).toHaveAttribute('data-frame', '0');
  });

  it('stops the walk timer when the page is left', () => {
    vi.useFakeTimers();
    spectator.click('[data-testid="characters-walk"]');
    const store = spectator.inject(CharactersStore);

    spectator.fixture.destroy();
    vi.advanceTimersByTime(WALK_STEP_MS * 3);

    expect(store.step()).toBe(0);
  });
});
