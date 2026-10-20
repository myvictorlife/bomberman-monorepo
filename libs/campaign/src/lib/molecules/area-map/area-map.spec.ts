import { createComponentFactory, Spectator } from '@ngneat/spectator/vitest';
import { provideTranslateService } from '@ngx-translate/core';
import { StageView } from '../../+state/campaign.store';
import { AreaMap } from './area-map';

const stage = (
  id: string,
  status: StageView['status'],
  code: string,
): StageView => ({
  id,
  code,
  status,
  foes: [],
  boss: null,
  bonus: false,
  playable: false,
});

describe('AreaMap', () => {
  let spectator: Spectator<AreaMap>;

  const createComponent = createComponentFactory({
    component: AreaMap,
    providers: [provideTranslateService({ lang: 'en' })],
  });

  const stages = [
    stage('gramado-1', 'cleared', '1-1'),
    stage('gramado-2', 'open', '1-2'),
    stage('gramado-3', 'locked', '1-3'),
    { ...stage('gramado-4', 'locked', '1-4') },
    { ...stage('gramado-5', 'locked', '1-5'), boss: 'rainha' as const },
    stage('gramado-6', 'locked', '1-6'),
    stage('gramado-7', 'locked', '1-7'),
  ];

  beforeEach(() => {
    spectator = createComponent({
      props: { areaId: 'gramado', stages, selectedId: 'gramado-2' },
    });
  });

  it('puts a stop on the map for every stage that has a spot', () => {
    const stops = spectator.queryAll('[data-testid="area-map-stop"]');

    expect(stops).toHaveLength(6);
    expect(stops.map((s) => s.getAttribute('data-status'))).toEqual([
      'cleared',
      'open',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(stops[1]).toHaveAttribute('aria-pressed', 'true');
    expect(stops[1]).toHaveText('1-2');
    expect(stops[4]).toHaveClass('area-map__stop--boss');
  });

  it('tells which stop was picked', () => {
    const picked: string[] = [];
    spectator.output('picked').subscribe((id) => picked.push(id as string));

    spectator.click(
      spectator.queryAll('[data-testid="area-map-stop"]')[2] as Element,
    );

    expect(picked).toEqual(['gramado-3']);
  });

  it('shows the placeholder for an area without a map', () => {
    spectator.setInput({ areaId: 'subestacao', stages: [] });

    expect(spectator.query('[data-testid="area-map-soon"]')).toExist();
    expect(spectator.queryAll('[data-testid="area-map-stop"]')).toHaveLength(0);
  });
});
