import { PUBLIC_ROOM_RULES } from '@libs/game-protocol';
import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { ruleKey, RulesPanelComponent } from './rules-panel';

describe('RulesPanelComponent', () => {
  let spectator: Spectator<RulesPanelComponent>;
  const createComponent = createComponentFactory({
    component: RulesPanelComponent,
    providers: [provideTranslateService()],
  });

  beforeEach(() => (spectator = createComponent()));

  it('names a rule’s strings after its key', () => {
    expect(ruleKey('countdownMs')).toBe('COUNTDOWN_MS');
    expect(ruleKey('outsiders')).toBe('OUTSIDERS');
  });

  it('reads the rules out to everyone, one row per rule', () => {
    expect(spectator.queryAll('.rules__row')).toHaveLength(14);
    expect(spectator.query('[data-testid="rules-fallenOutside"]')).toHaveText(
      'ONLINE.RULES.ON',
    );
    expect(spectator.query('[data-testid="rules-outsiders"]')).toHaveText(
      'ONLINE.RULES.COUNT',
    );
    expect(spectator.query('[data-testid="rules-closingWalls"]')).toHaveText(
      'ONLINE.RULES.ON',
    );
    expect(spectator.query('[data-testid="rules-roundTimerMs"]')).toHaveText(
      'ONLINE.RULES.SECONDS',
    );
    // The bots' level reads as a word.
    expect(spectator.query('[data-testid="rules-botLevel"]')).toHaveText(
      'ONLINE.RULES.LEVEL_2',
    );
    expect(spectator.query('lib-segmented-control')).not.toExist();
    expect(spectator.query('[data-testid="rules-pending"]')).not.toExist();
  });

  it('falls back to the defaults for a rule an older server does not send', () => {
    spectator.setInput('rules', {
      maxPlayers: 5,
      minPlayers: 2,
      countdownMs: 15_000,
      resultsMs: 5_000,
      outsiders: 1,
    } as never);
    expect(spectator.query('[data-testid="rules-roundTimerMs"]')).toHaveText(
      'ONLINE.RULES.SECONDS',
    );
    expect(spectator.query('[data-testid="rules-closingWalls"]')).toHaveText(
      'ONLINE.RULES.ON',
    );
    expect(
      spectator.component.valueOf({ key: 'outsiders', kind: 'number' }),
    ).toBe(1);
  });

  it('says a zero clock is off', () => {
    spectator.setInput('rules', {
      ...PUBLIC_ROOM_RULES,
      roundTimerMs: 0,
      closingWalls: false,
    });
    expect(spectator.query('[data-testid="rules-roundTimerMs"]')).toHaveText(
      'ONLINE.RULES.OFF',
    );
    expect(spectator.query('[data-testid="rules-closingWalls"]')).toHaveText(
      'ONLINE.RULES.OFF',
    );
  });

  it('says winner-stays is off at zero, and counts the wins otherwise', () => {
    spectator.setInput('rules', { ...PUBLIC_ROOM_RULES, winnerStays: 0 });
    expect(spectator.query('[data-testid="rules-winnerStays"]')).toHaveText(
      'ONLINE.RULES.OFF',
    );

    spectator.setInput('rules', { ...PUBLIC_ROOM_RULES, winnerStays: 5 });
    expect(spectator.query('[data-testid="rules-winnerStays"]')).toHaveText(
      'ONLINE.RULES.COUNT',
    );
  });

  it('shows the pending rules when a change waits for the next round', () => {
    spectator.setInput('nextRules', { ...PUBLIC_ROOM_RULES, outsiders: 0 });
    expect(spectator.query('[data-testid="rules-pending"]')).toExist();
    expect(
      spectator.component.valueOf({ key: 'outsiders', kind: 'number' }),
    ).toBe(0);
  });

  it('gives an admin a control per rule and emits one change at a time', () => {
    const changes: unknown[] = [];
    spectator.component.ruleChange.subscribe((c) => changes.push(c));
    spectator.setInput('admin', true);

    expect(spectator.queryAll('lib-segmented-control')).toHaveLength(11);
    expect(spectator.queryAll('lib-switch')).toHaveLength(3);
    const outsiders = spectator.component.options({
      key: 'outsiders',
      kind: 'number',
      options: [0, 1],
      unit: 'count',
    });
    expect(outsiders).toEqual([
      { value: '0', label: '0' },
      { value: '1', label: '1' },
    ]);
    const timer = spectator.component.options({
      key: 'roundTimerMs',
      kind: 'number',
      options: [0, 60_000],
      unit: 'seconds',
    });
    expect(timer).toEqual([
      { value: '0', labelKey: 'ONLINE.RULES.OFF' },
      { value: '60000', label: '60 s' },
    ]);

    spectator.component.pick({ key: 'outsiders', kind: 'number' }, '3');
    spectator.component.toggle({ key: 'closingWalls', kind: 'boolean' }, false);
    expect(changes).toEqual([{ outsiders: 3 }, { closingWalls: false }]);
  });
});
