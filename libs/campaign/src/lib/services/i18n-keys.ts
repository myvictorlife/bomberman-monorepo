/** The i18n key of a catalogue id: upper case, `-` as `_` (`gramado-1` → `GRAMADO_1`). */
function keyOf(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}

export function areaKey(id: string): string {
  return `AREAS.${keyOf(id)}`;
}

export function stageKey(id: string, field: 'NAME' | 'DESC'): string {
  return `STAGES.${keyOf(id)}.${field}`;
}

export function creatureKey(
  id: string,
  field: 'NAME' | 'KIND' | 'DESC',
): string {
  return `CREATURES.${keyOf(id)}.${field}`;
}

export function bossKey(id: string, field: 'NAME' | 'DESC'): string {
  return `BOSSES.${keyOf(id)}.${field}`;
}
