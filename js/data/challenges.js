(function (NB) {
  'use strict';

  const challenges = [
    {
      id: 'infiltration', name: 'Turno da Estação', style: 'Infiltração', opponent: 'kira',
      goal: 'Use Zero-Day para pressionar cedo. Passagem de Serviço mantém cartas na mão.',
      cards: ['unit_24', 'exploit_08'],
      deck: ['unit_24', 'unit_04', 'unit_06', 'unit_22', 'unit_08', 'unit_01', 'unit_02', 'exploit_08', 'exploit_02', 'exploit_01']
    },
    {
      id: 'armor', name: 'Linha de Contenção', style: 'Blindagem', opponent: 'cipher',
      goal: 'Proteja a linha com Firewall e repare uma unidade que sobreviveu ao choque.',
      cards: ['unit_25', 'exploit_09'],
      deck: ['unit_25', 'unit_03', 'unit_10', 'unit_23', 'unit_01', 'unit_02', 'unit_05', 'exploit_09', 'exploit_04', 'exploit_01']
    },
    {
      id: 'sabotage', name: 'Ruído na Escuta', style: 'Sabotagem', opponent: 'vex',
      goal: 'Drene RAM e enfraqueça a unidade que ameaça seu campo antes de atacar.',
      cards: ['unit_26', 'exploit_10'],
      deck: ['unit_26', 'unit_09', 'unit_11', 'unit_08', 'unit_12', 'unit_01', 'unit_02', 'exploit_10', 'exploit_06', 'exploit_04']
    },
    {
      id: 'mixed', name: 'Frequência Cruzada', style: 'Overclock', opponent: 'archon',
      goal: 'Baixe unidades de afinidades diferentes e use a RAM extra para preparar a dupla.',
      cards: ['unit_27', 'exploit_11'],
      deck: ['unit_27', 'unit_04', 'unit_05', 'unit_10', 'unit_13', 'unit_09', 'unit_02', 'exploit_11', 'exploit_01', 'exploit_07']
    }
  ];
  for (const challenge of challenges) challenge.deck = challenge.deck.flatMap(id => [id, id]);

  NB.Challenges = challenges;
})(window.NB = window.NB || {});
