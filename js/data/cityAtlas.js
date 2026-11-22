(function (NB) {
  'use strict';

  const neighborhoods = [
    ["viaduto", "Viaduto", ["home", "market", "kiosk"]],
    ["canal", "Canal do Jatobá", ["relay", "pension", "pump"]],
    ["estacao", "Estação Velha", ["kira", "terminal"]],
    ["tensao", "Baixa Tensão", ["arena", "ringArchive"]],
    ["oficinas", "Pátio das Oficinas", ["garage", "depots"]],
    ["muralha", "Muralha Setorial", ["cipher", "archive"]],
    ["espelho", "Espelho", ["vex", "theatre"]],
    ["morro", "Morro das Casas", ["clinic", "morroKitchen"]],
    ["cais", "Cais da Ressaca", ["docks", "ferry"]],
    ["centro", "Centro Cívico", ["archon", "registry", "square"]]
  ].map(([id, name, locations]) => ({ id, name, locations }));

  const places = [
    ["pump", "Casa de Bombas", 19, 36, "Maíra · operadora", "A água sempre avisa antes de subir. O truque é saber onde olhar."],
    ["terminal", "Terminal da Estação", 53, 43, "Mara · motorista", "O horário do painel é o de sempre. O do meu caderno é o de hoje."],
    ["ringArchive", "Arquivo do Ringue", 56, 85, "Leila · contadora", "Guardo os recibos pelo dia em que chegaram. Se mudar a data, some a história."],
    ["depots", "Depósito de Peças", 36, 93, "Giba · desmontador", "Uma boa máquina deixa rastro até quando quem encomendou troca a etiqueta."],
    ["archive", "Corredor de Serviço", 76, 63, "Raquel · técnica", "A portaria conhece crachás. Eu conheço quem trabalhava em cada turno."],
    ["theatre", "Teatro do Espelho", 54, 27, "Celina · contrarregra", "Quando não tem ensaio, dá pra ouvir o que diz o corredor."],
    ["clinic", "Clínica do Morro", 12, 11, "Ada · médica comunitária", "Cada bateria dessa tem o nome da casa que vai receber a próxima."],
    ["morroKitchen", "Cozinha Comunitária", 18, 13, "Cléo · cozinheira", "Se o freezer desligar de novo, amanhã vai ser dia de sopa pra todo mundo."],
    ["docks", "Subestação do Cais", 89, 90, "Renan · operador", "Naquele painel ficam os pedidos. No outro, o que aconteceu de verdade."],
    ["ferry", "Balsa da Ressaca", 95, 91, "Sol · condutora", "Quando a chuva engrossa, eu confio mais na régua que no anúncio."],
    ["registry", "Balcão Cívico", 89, 24, "Nalva · escrevente", "Você pode sair daqui sem resposta. Com o número do pedido, pelo menos consegue voltar à mesma fila."],
    ["square", "Praça do Centro", 94, 21, "Isa · repórter", "A praça enche quando o pessoal quer saber o que ficou de fora da edição."]
  ].map(([id, name, x, y, npc, line]) => ({ id, name, x, y, npc, line, scene: `./src/assets/bairros/${id}.webp`, atlasOnly: true }));

  const residents = [
    [1, "Dona Nair", "central", "home", "Testa as chaves antigas do prédio e conhece cada vizinho pelo som dos passos."],
    [2, "Lume", "central", "market", "Mantém a banca da Feira e conhece a origem de quase todas as peças."],
    [3, "Jota", "contato", "kiosk", "Trabalha no quiosque e deixa a cafeteira ligada até o último ônibus."],
    [4, "Beto", "contato", "market", "Confere encomendas na saída da Feira."],
    [10, "Damião", "morador", "kiosk", "Damião aquece solda na banca.", "./avatars/damiao.webp"],
    [11, "Nina Fase", "central", "relay", "Cuida da Antena Comunitária e organiza a manutenção por turnos."],
    [12, "Cris", "central", "pension", "Recebe hóspedes e separa as contas com um lápis azul."],
    [13, "Maíra", "contato", "pump", "Cuida da bomba do Canal.", "./avatars/maira.webp"],
    [21, "Kira", "central", "kira", "Cruza o pátio da estação entre entregas."],
    [22, "Mara", "contato", "terminal", "Atende no Terminal das 6h às 19h e deixa os horários no caderno."],
    [23, "Severino", "contato", "kira", "Conhece todos os portões da Estação."],
    [31, "Risco", "central", "arena", "Apresenta as lutas e mantém o livro de entradas."],
    [33, "Tuca", "contato", "arena", "Empresta baralhos de treino.", "./avatars/tuca.webp"],
    [34, "Leila", "contato", "ringArchive", "Mantém os recibos em ordem de entrada."],
    [39, "Dora", "morador", "arena", "Dora disputa os resultados com amigos.", "./avatars/dora.webp"],
    [41, "Íris", "central", "garage", "Monta bicicletas e desmonta implantes com a mesma bancada."],
    [43, "Giba", "contato", "depots", "Carrega um estojo só para etiquetas de série.", "./avatars/giba.webp"],
    [44, "Aline", "contato", "garage", "Conhece os atalhos usados por quem faz entrega.", "./avatars/aline.webp"],
    [45, "Sinal", "contato", "depots", "Mediadora dos duelistas de passagem.", "./avatars/sinal.webp"],
    [51, "Cipher", "central", "cipher", "Coordena a segurança da Muralha."],
    [52, "Raquel", "contato", "archive", "Resolve problemas de acesso no corredor de manutenção."],
    [61, "Vex", "central", "vex", "Prefere conversar onde ninguém precise dizer o número do quarto."],
    [63, "Celina", "contato", "theatre", "Abre as salas de ensaio."],
    [64, "Bia", "contato", "theatre", "Faz entregas entre hotel e teatro."],
    [71, "Ada", "central", "clinic", "Coordena o atendimento da clínica comunitária."],
    [72, "Omar", "contato", "clinic", "Cuida do estoque de baterias clínicas."],
    [73, "Cléo", "contato", "morroKitchen", "Organiza as refeições dos plantões."],
    [74, "Ravi", "contato", "clinic", "Conserta os equipamentos dos moradores."],
    [81, "Renan", "central", "docks", "Plantão na subestação."],
    [82, "Sol", "contato", "ferry", "Conduz a balsa antes de fechar a linha."],
    [84, "Nanda", "contato", "docks", "Organiza os manifestos das remessas.", "./avatars/nanda.webp"],
    [91, "Archon", "central", "archon", "Diretor de operações da Vértice."],
    [92, "Isa", "contato", "square", "Faz a edição do jornal de bairro."],
    [94, "Nalva", "contato", "registry", "Emite protocolos e históricos."],
    [101, "Helena", "contato", "theatre", "Autentica os registros da Holding Meridiano com Bia."]
  ].map(([id, name, role, location, line, portrait]) => ({ id, name, role, location, line, portrait }));

  const jobs = {
    delivery: { name: 'Correio Expresso', locations: ['kira', 'terminal', 'depots', 'registry', 'docks'] },
    escort: { name: 'Escolta de Beco', locations: ['morroKitchen', 'kira'], minutes: 50, energy: 14, pay: 24, hours: [19, 3] },
    drones: { name: 'Manutenção de Drones', locations: ['garage'], minutes: 40, energy: 7, pay: 12 },
    logs: { name: 'Limpeza de Logs', locations: ['registry', 'terminal'], minutes: 35, energy: 6, pay: 14 },
    scrap: { name: 'Triagem de Sucata', locations: ['depots'], minutes: 40, energy: 7, pay: 13 },
    cargo: { name: 'Ronda de Carga', locations: ['docks'], minutes: 50, energy: 9, pay: 18, hours: [7, 17] }
  };

  const residentDuels = {
    43: { hp: 15, credits: 8, card: 'unit_29', deck: ['unit_02', 'unit_08', 'unit_29', 'unit_01', 'exploit_01', 'exploit_14'] },
    44: { hp: 17, credits: 9, expansionCard: 'unit_55', card: 'unit_30', deck: ['unit_05', 'unit_06', 'unit_28', 'unit_30', 'unit_02', 'exploit_13', 'exploit_19'] },
    84: { hp: 19, credits: 10, expansionCard: 'unit_56', card: 'exploit_14', deck: ['unit_03', 'unit_28', 'unit_29', 'unit_08', 'unit_01', 'exploit_01', 'exploit_14'] }
  };

  const mapPins = {
    clinic: [10, 11, '✚', 'care'], morroKitchen: [25, 21, '🍲', 'food'],
    kiosk: [39, 9, '☕', 'food'], vex: [58, 17, '🛏', 'care'],
    archon: [81, 10, '🏙', 'story'], square: [91, 25, '📰', 'story'],
    registry: [75, 32, '📄', 'story'], theatre: [55, 34, '🎭', 'story'],
    relay: [10, 34, '📡', 'service'], pump: [27, 42, '💧', 'service'],
    terminal: [43, 46, '🚏', 'travel'], kira: [55, 54, '🚉', 'travel'],
    cipher: [72, 48, '🛡', 'duel'], archive: [89, 53, '🔑', 'story'],
    home: [11, 57, '⌂', 'care'], market: [24, 66, '🛒', 'trade'],
    garage: [38, 80, '🔧', 'trade'], depots: [19, 90, '⚙', 'service'],
    arena: [55, 72, '⚔', 'duel'], ringArchive: [60, 89, '📚', 'story'],
    pension: [78, 69, '🛏', 'care'], docks: [78, 88, '⚓', 'service'],
    ferry: [92, 81, '⛴', 'travel']
  };
  const shortNames = {
    clinic: 'Clínica', morroKitchen: 'Cozinha', square: 'Praça', pump: 'Bombas',
    theatre: 'Teatro', registry: 'Balcão', terminal: 'Terminal', archive: 'Corredor',
    depots: 'Depósito', ringArchive: 'Arquivo', docks: 'Cais', ferry: 'Balsa'
  };
  const encounters = {
    day: [
      { location: 'terminal', name: 'Nexo', portrait: './avatars/nexo.webp', hp: 13, credits: 8 },
      { location: 'square', name: 'Vagalume', portrait: './avatars/vagalume.webp', hp: 14, credits: 9 },
      { location: 'ferry', name: 'Maré', portrait: './avatars/mare.webp', hp: 15, credits: 10 }
    ],
    night: [
      { location: 'depots', name: 'Rebite', portrait: './avatars/rebite.webp', hp: 16, credits: 10 },
      { location: 'morroKitchen', name: 'Sombra Curta', portrait: './avatars/sombra-curta.webp', hp: 17, credits: 11 },
      { location: 'theatre', name: 'Contraluz', portrait: './avatars/contraluz.webp', hp: 18, credits: 12 }
    ]
  };

  NB.CityAtlas = { neighborhoods, places, residents, jobs, residentDuels, mapPins, shortNames, encounters };
})(window.NB = window.NB || {});
