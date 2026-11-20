(function (NB) {
  'use strict';

  const districts = [
    { id: 'market', name: 'Feira do Viaduto', short: 'Feira', icon: '▦', x: 19, y: 75, npc: 'Lume · comerciante', line: 'A corp vende o futuro em parcelas. Aqui você paga uma vez e a carta é sua.' },
    { id: 'relay', name: 'Antena Comunitária', short: 'Antena', icon: '⌁', x: 22, y: 22, npc: 'Nina Fase · operadora', line: 'A Vértice quer cortar nossa rede comunitária. Remende os pacotes e eu pago pelo turno.' },
    { id: 'arena', name: 'Ringue Baixa Tensão', short: 'Ringue', icon: '◇', x: 53, y: 80, npc: 'Risco · anfitrião', line: 'Pode lutar pela bolsa ou pôr seus créditos na mesa. Minha regra é simples: acabou o duelo, acabou a dívida.' },
    { id: 'kira', name: 'Estação Fantasma', short: 'Estação', icon: '01', x: 48, y: 49, npc: 'Kira · contrabandista de rotas', line: 'Eu vendi uma rota, Kairo. Só depois descobri que vinha com o seu nome.' },
    { id: 'cipher', name: 'Muralha Setorial', short: 'Muralha', icon: '02', x: 74, y: 55, npc: 'Cipher · segurança corporativa', line: 'Seu acesso consta como revogado. Eu mesmo revisei o relatório.' },
    { id: 'vex', name: 'Hotel Espelho', short: 'Hotel', icon: '03', x: 55, y: 19, npc: 'Vex · corretor de dados', line: 'Tenho três versões da sua morte. A mais cara é a verdadeira.' },
    { id: 'archon', name: 'Torre Vértice', short: 'Torre', icon: '04', x: 83, y: 20, npc: 'Archon · diretor de operações', line: 'Quando te ensinei a ler a cidade, devia ter ensinado o preço de sair da linha.' }
  ];

  const stock = [
    { id: 'unit_21', price: 45 },
    { id: 'unit_22', price: 65 },
    { id: 'unit_23', price: 85 }
  ];

  const traces = {
    kira: 'Nina localizou a conta que comprou a rota. O pagamento saiu da Muralha Setorial.',
    cipher: 'Os recibos do cofre usam um repetidor no Hotel Espelho. É o endereço de Vex.',
    vex: 'A assinatura de Archon abre a rota de manutenção da Torre. Nina envia as coordenadas a Kairo.'
  };

  const kira = NB.Campaign.getNodeById('kira');
  const sparringBoss = {
    ...kira, id: 'risco', name: 'RISCO', fullTitle: 'RISCO // Campeão do Viaduto',
    avatar: './avatars/risco.webp', fallbackArt: 'kira', accent: '#ffaf53', hp: 14, title: 'Campeão do Viaduto', archetype: 'Treino de controle de campo',
    deckList: [...NB.Cards.STARTER_CARD_IDS.slice(0, 11), ...NB.Cards.STARTER_CARD_IDS.slice(0, 9)],
    lines: {
      start: ['"Três vagas. Quero ver como você usa cada uma."'],
      attack: ['"Escolha bem o que deixar passar."'],
      hit: ['"Boa. Agora sustenta essa pressão."']
    }
  };

  const wagerBoss = {
    ...sparringBoss,
    hp: 19,
    archetype: 'Pressão · OVERCLOCK',
    canOverclock: true,
    deckList: [...sparringBoss.deckList.slice(0, -4), 'unit_07', 'unit_10', 'unit_13', 'exploit_05'],
    lines: { ...sparringBoss.lines, start: ['"Agora valendo. Tenta segurar meu Overclock."'], overclock: ['"Aumenta o volume. O ringue vai tremer."'] }
  };

  const campaignCredits = boss => 40 + boss.index * 15;
  NB.CityData = { districts, stock, traces, sparringBoss, wagerBoss, campaignCredits };
})(window.NB = window.NB || {});
