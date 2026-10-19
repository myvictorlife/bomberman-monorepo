import { MountId, PowerUpKind } from '@libs/game-core';

/**
 * What the announcer says, in Brazilian Portuguese. Original lines in the
 * spirit of a loud neighbour watching from the window — our own words, no
 * quotes from anyone's show. Keys are the moments the game reports.
 */
export type QuipMoment =
  | 'block'
  | 'power-bomb'
  | 'power-fire'
  | 'power-speed'
  | 'power-pierce'
  | 'power-remote'
  | 'power-vest'
  | 'power-glove'
  | 'power-kick'
  | 'mount-tatu'
  | 'mount-pato'
  | 'mount-bernardo'
  | 'mount-capivara'
  | 'mount-galinha'
  | 'mount-lost'
  | 'died'
  | 'hurry'
  | 'grab'
  | 'win'
  | 'draw';

export const QUIPS: Readonly<Record<QuipMoment, readonly string[]>> = {
  block: [
    'Ih, rapaz!',
    'Vixe!',
    'Quebrou tudo!',
    'Olha a caixa!',
    'Eita!',
    'Foi mal aí!',
    'Tá ficando sério!',
    'Lá vai mais um!',
  ],
  'power-bomb': ['Mais uma bomba!', 'Agora vai!', 'Bolso cheio!'],
  'power-fire': ['Fogo neles!', 'Esquentou!', 'Olha o alcance!'],
  'power-speed': ['Corre, corre!', 'Tá voando!', 'Ninguém pega!'],
  'power-pierce': ['Atravessa tudo!', 'Nem caixote segura!'],
  'power-remote': ['Controle remoto!', 'Agora é no botão!'],
  'power-vest': ['Blindado!', 'Colete novo!', 'Aguenta uma!'],
  'power-glove': ['Luva na mão!', 'Pega e joga!', 'Segura essa!'],
  'power-kick': ['Chuta que é gol!', 'Pé de ouro!', 'Lá vai bomba!'],
  'mount-tatu': ['Chocou um tatu!', 'Olha o tatu!', 'Blindado!'],
  'mount-pato': ['Um pato? Um pato!', 'Quá quá!', 'Pato de borracha, é sério?'],
  'mount-bernardo': ['Cachorrão!', 'Bom menino!', 'Resgate chegou!'],
  'mount-capivara': ['Capivara!', 'Ela nem tá ligando.', 'A rainha do rolê!'],
  'mount-galinha': [
    'Galinha elétrica!',
    'Có-có-choque!',
    'Curto-circuito na área!',
  ],
  'mount-lost': ['Perdeu a montaria!', 'Xiii...', 'Desceu a pé!'],
  grab: ['Pegou!', 'Lá vai ele!', 'Voa, passarinho!', 'Segura peão!'],
  hurry: ['Corre!', 'Tá fechando!', 'Acabou o tempo!', 'Olha a parede!'],
  died: ['Já era!', 'Volta no próximo!', 'Essa doeu.', 'Foi bonito, foi.'],
  win: ['Campeão!', 'Deu bom!', 'É o bicho!', 'Que jogo!'],
  draw: ['Empate!', 'Ninguém levou!', 'Todo mundo foi junto!'],
};

export function powerUpMoment(kind: PowerUpKind): QuipMoment | null {
  return kind === 'egg' ? null : `power-${kind}`;
}

/** The announcer's moments that belong to one item: its pick-up, and for the egg every mount. */
export function itemMoments(kind: PowerUpKind): QuipMoment[] {
  if (kind === 'egg')
    return [
      'mount-tatu',
      'mount-pato',
      'mount-bernardo',
      'mount-capivara',
      'mount-galinha',
      'mount-lost',
    ];
  const moment = powerUpMoment(kind);
  return moment ? [moment] : [];
}

export function mountMoment(mount: MountId): QuipMoment {
  return `mount-${mount}`;
}
