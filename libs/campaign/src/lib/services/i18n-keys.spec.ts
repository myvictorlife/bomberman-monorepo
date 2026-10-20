import { areaKey, bossKey, creatureKey, stageKey } from './i18n-keys';

describe('campaign i18n keys', () => {
  it('upper-cases ids and turns dashes into underscores', () => {
    expect(areaKey('gramado')).toBe('AREAS.GRAMADO');
    expect(stageKey('gramado-1', 'NAME')).toBe('STAGES.GRAMADO_1.NAME');
    expect(creatureKey('sauva', 'KIND')).toBe('CREATURES.SAUVA.KIND');
    expect(bossKey('rainha', 'DESC')).toBe('BOSSES.RAINHA.DESC');
  });
});
