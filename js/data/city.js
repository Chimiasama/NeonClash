(function (NB) {
  'use strict';

  const districts = [
    ...NB.CityAtlas.places,
    { id: 'market', portrait: './avatars/lume.png', name: 'Feira do Viaduto', short: 'Feira', icon: '▦', x: 19, y: 70, npc: 'Lume · comerciante', line: 'A corp vende o futuro em parcelas. Aqui você paga uma vez e a carta é sua.' },
    { id: 'relay', portrait: './avatars/nina.png', name: 'Antena Comunitária', short: 'Antena', icon: '⌁', x: 22, y: 30, npc: 'Nina Fase · operadora', line: 'A Vértice quer cortar nossa rede comunitária. Remende os pacotes e eu pago pelo turno.' },
    { id: 'arena', music: 'risco', portrait: './avatars/risco.webp', name: 'Ringue Baixa Tensão', short: 'Ringue', icon: '◇', x: 58, y: 79, npc: 'Risco · anfitrião', line: 'Pode lutar pela bolsa ou pôr seus créditos na mesa. Minha regra é simples: acabou o duelo, acabou a dívida.' },
    { id: 'kira', portrait: './avatars/kira.png', name: 'Estação Fantasma', short: 'Estação', icon: '01', x: 48, y: 49, npc: 'Kira · contrabandista de rotas', line: 'Eu vendi uma rota, Kairo. Só depois descobri que vinha com o seu nome.' },
    { id: 'cipher', portrait: './avatars/cipher.png', name: 'Muralha Setorial', short: 'Muralha', icon: '02', x: 74, y: 55, npc: 'Cipher · segurança corporativa', line: 'Seu acesso consta como revogado. Eu mesmo revisei o relatório.' },
    { id: 'vex', rest: 'hotel', portrait: './avatars/vex.png', name: 'Hotel Espelho', short: 'Hotel', icon: '03', x: 55, y: 19, npc: 'Vex · corretor de dados', line: 'Tenho três versões da sua morte. A mais cara é a verdadeira.' },
    { id: 'archon', portrait: './avatars/archon.png', name: 'Torre Vértice', short: 'Torre', icon: '04', x: 83, y: 20, npc: 'Archon · diretor de operações', line: 'Quando te ensinei a ler a cidade, devia ter ensinado o preço de sair da linha.' },
    { id: 'home', name: 'Casa de Kairo', short: 'Casa', icon: '⌂', x: 12, y: 49, rest: 'home', scene: './src/assets/quarto-kairo.webp', npc: 'Dona Nair · vizinha', line: 'O trinco ainda funciona. Fecha a porta e dorme um pouco, Kairo.' },
    { id: 'pension', name: 'Pensão do Canal', short: 'Pensão', icon: '◇', x: 84, y: 83, rest: 'pension', scene: './src/assets/pensao-canal.webp', npc: 'Cris · recepcionista', line: 'Tem cama limpa e uma porta com chave. O ventilador faz parte do pacote.' },
    { id: 'kiosk', name: 'Quiosque 24h', short: 'Quiosque', icon: '☕', x: 33, y: 10, scene: './src/assets/quiosque-24h.webp', npc: 'Jota · balconista', line: 'Café, energético ou estímulo sintético. Quando o corpo pedir cama, nenhum dos três resolve.' },
    { id: 'garage', name: 'Garagem da Íris', short: 'Garagem', icon: '⚙', x: 35, y: 90, scene: './src/assets/garagem-iris.webp', npc: 'Íris · mecânica', line: 'Uma bike encurta os atalhos. A moto faz valer a pena atravessar a cidade.' }
  ];

  const stock = [
    { id: 'unit_21', price: 45 },
    { id: 'unit_22', price: 65 },
    { id: 'unit_23', price: 85 },
    { id: 'exploit_07', price: 30 },
    { id: 'unit_28', price: 48 },
    { id: 'exploit_12', price: 36 },
    { id: 'exploit_13', price: 40 },
    { id: 'unit_32', price: 55 },
    { id: 'unit_33', price: 46 },
    { id: 'unit_34', price: 60 },
    { id: 'exploit_17', price: 65 },
    { id: 'exploit_18', price: 50 },
    { id: 'unit_35', price: 38 },
    { id: 'unit_36', price: 145, chapter: 4 }
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
