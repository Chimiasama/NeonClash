(function (NB) {
  'use strict';

  const MAX_HP = 20;
  const MAX_HAND = 6;
  const OVERCLOCK_COST = 3;
  const DECK_SIZE = 20;
  const MAX_COPIES = 2;

  const AFFINITIES = {
    pulso: { name: 'Pulso', icon: '▲', color: '#ffad62', beats: 'malha' },
    malha: { name: 'Malha', icon: '■', color: '#62e8fd', beats: 'sombra' },
    sombra: { name: 'Sombra', icon: '◆', color: '#d99afc', beats: 'pulso' }
  };
  const AFFINITY_CYCLE = 'Pulso vence Malha · Malha vence Sombra · Sombra vence Pulso';
  function affinityLabel(id) {
    const affinity = AFFINITIES[id];
    return affinity ? `${affinity.icon} ${affinity.name}` : 'Neutra';
  }

  function describeAffinity(id) {
    const affinity = AFFINITIES[id];
    return affinity ? ` Afinidade ${affinity.name}: +1 de dano em choques contra ${AFFINITIES[affinity.beats].name}.` : '';
  }

  /* Metadados das palavras-chave com ícones e cores. */
  const KEYWORDS = {
    MULTI_BLOCK: { tag: 'BLOQUEIO MÚLTIPLO', short: 'BM', icon: '⬡', color: '#8ef1d5',
      desc: 'Pode bloquear vários ataques seguidos enquanto tiver DEF. O limite depende da carta.' },
    VIGILANCE: { tag: 'VIGILÂNCIA', short: 'VG', icon: '◈', color: '#a8f5f3',
      desc: 'Pode bloquear mesmo depois de atacar.' },
    ATTACK_ONLY: { tag: 'SÓ ATAQUE', short: 'AT', icon: '▲', color: '#ffad62',
      desc: 'Sem DEF. Não pode bloquear e é destruída ao colidir com um bloqueador.' },
    GUARD_ONLY: { tag: 'SÓ DEFESA', short: 'DF', icon: '■', color: '#62e8fd',
      desc: 'Sem ATK. Pode bloquear, mas não ataca nem contra-ataca.' },
    ZERO_DAY: {
      id: 'ZERO_DAY',
      tag: 'ZERO-DAY',
      short: 'ZD',
      icon: '⚡',
      color: '#00F0FF',
      desc: 'Pode atacar no mesmo turno em que entra em campo (ignora BOOTING).'
    },
    FIREWALL: {
      id: 'FIREWALL',
      tag: 'FIREWALL',
      short: 'FW',
      icon: '🛡',
      color: '#38BDF8',
      desc: 'Tem prioridade no bloqueio quando estiver apta a defender ou quando estiver atacando.'
    },
    VIRUS: {
      id: 'VIRUS',
      tag: 'VÍRUS',
      short: 'VIR',
      icon: '☣',
      color: '#39FF14',
      desc: 'Ao causar dano a uma unidade inimiga, reduz permanentemente o ATK dela em -2.'
    },
    DRENO: {
      id: 'DRENO',
      tag: 'DRENO',
      short: 'DRN',
      icon: '⟐',
      color: '#E879F9',
      desc: 'Ao causar dano direto ao HP, transfere até 1 RAM do adversário para quem controla a unidade.'
    },
    RESONANCE: { tag: 'RESSONÂNCIA', short: 'RES', icon: '◈', color: '#88e8fc',
      desc: 'Ativa com outra unidade aliada da mesma afinidade não neutra.' },
    RECYCLE: { tag: 'RECICLAR', short: 'REC', icon: '♻', color: '#83eca0',
      desc: 'Recupera cartas do descarte ou usa sua quantidade como recurso.' },
    SCAN: { tag: 'VARREDURA', short: 'VAR', icon: '⌖', color: '#f8c280',
      desc: 'Revela o topo do baralho e pode conceder compra adicional.' }
  };

  /* Banco de Cartas: 20 cartas distintas (14 Unidades + 6 Exploits).
     Caminhos estritamente relativos (./cards/... e ./avatars/...) para Android Studio WebView. */
  const CARD_DB = {
    unit_01: {
      id: 'unit_01',
      kind: 'unit',
      name: 'Kuroi-01',
      subtitle: 'Samurai Cibernético',
      atk: 4,
      def: 4,
      ramGain: 2,
      keywords: [],
      copies: 1,
      img: './cards/unit_01.webp',
      accent: '#00F0FF',
      lore: 'Forjado nas oficinas clandestinas do Setor 9, seu chassi de carbono guarda o código de honra dos antigos runners.',
      desc: 'Unidade tática equilibrada de linha de frente. Gera +2 RAM ao entrar em campo.'
    },
    unit_02: {
      id: 'unit_02',
      kind: 'unit',
      name: 'Spidey-Drone',
      subtitle: 'Coletor de Rede',
      atk: 3,
      def: 3,
      ramGain: 3,
      keywords: [],
      copies: 1,
      img: './cards/unit_02.webp',
      accent: '#39FF14',
      ability: 'EXTRA_RAM',
      lore: 'Rasteja pelos dutos de fibra ótica desviando energia residual para alimentar o deck de quem controla o drone.',
      desc: 'Coletor de pacotes: gera +3 RAM total ao entrar no campo para acelerar Exploits e Overclock.'
    },
    unit_03: {
      id: 'unit_03',
      kind: 'unit',
      name: 'Aegis-Wall',
      subtitle: 'Sentinela Firewall',
      atk: 2,
      def: 7,
      ramGain: 2,
      keywords: ['FIREWALL'],
      copies: 1,
      img: './cards/unit_03.webp',
      accent: '#38BDF8',
      lore: 'Um protocolo militar roubado que projeta escudos hexagonais impenetráveis no ciberespaço.',
      desc: '[FIREWALL] Muralha blindada de 7 DEF com prioridade para interceptar ataques e proteger o HP de quem controla a unidade. Gera +2 RAM.'
    },
    unit_04: {
      id: 'unit_04',
      kind: 'unit',
      name: 'Ghost-Runner',
      subtitle: 'Infiltrador Zero-Day',
      atk: 3,
      def: 2,
      ramGain: 2,
      keywords: ['ZERO_DAY'],
      copies: 1,
      img: './cards/unit_04.webp',
      accent: '#00F0FF',
      lore: 'Atravessa barreiras de autenticação em milissegundos, deixando apenas um rastro de estática ciano.',
      desc: '[ZERO-DAY] Ignora o BOOTING e ataca no mesmo turno em que entra em campo. Gera +2 RAM.'
    },
    unit_05: {
      id: 'unit_05',
      kind: 'unit',
      name: 'Valkyrie-X',
      subtitle: 'Exoesqueleto de Assalto',
      atk: 5,
      def: 3,
      ramGain: 2,
      keywords: [],
      copies: 1,
      img: './cards/unit_05.webp',
      accent: '#FFB800',
      lore: 'Protótipo aéreo de combate urbano equipado com lâminas térmicas de alta voltagem.',
      desc: 'Alto poder de fogo (5 ATK), excelente parceira para ataques combinados de Overclock. Gera +2 RAM.'
    },
    unit_06: {
      id: 'unit_06',
      kind: 'unit',
      name: 'Neon-Hound',
      subtitle: 'Predador Zero-Day',
      atk: 4,
      def: 2,
      ramGain: 2,
      keywords: ['ZERO_DAY'],
      copies: 1,
      img: './cards/unit_06.webp',
      accent: '#FF0055',
      lore: 'Cão caçador sintético solto nos becos da sub-rede para farejar assinaturas neurais vulneráveis.',
      desc: '[ZERO-DAY] Predador de ataque instantâneo com 4 ATK no turno de entrada. Gera +2 RAM.'
    },
    unit_07: {
      id: 'unit_07',
      kind: 'unit',
      name: 'Chrome-Brute',
      subtitle: 'Titã Hidráulico',
      atk: 6,
      def: 6,
      ramGain: 2,
      keywords: [],
      copies: 1,
      img: './cards/unit_07.webp',
      accent: '#F59E0B',
      lore: 'Ex-operador de demolição da Vértice reconstruído com blindagem pesada de titânio cromado.',
      desc: 'Colosso ciborgue 6/6 capaz de esmagar defensores pesados ou liderar um Overclock devastador. Gera +2 RAM.'
    },
    unit_08: {
      id: 'unit_08',
      kind: 'unit',
      name: 'Data-Wraith',
      subtitle: 'Espectro de Dreno',
      atk: 3,
      def: 5,
      ramGain: 2,
      keywords: ['DRENO'],
      copies: 1,
      img: './cards/unit_08.webp',
      accent: '#C084FC',
      ability: 'PING_1',
      lore: 'Uma IA fantasma nascida de servidores mortos que se alimenta da memória ativa de hackers descuidados.',
      desc: '[DRENO] Causa 1 dano direto ao entrar e rouba 1 RAM do inimigo ao causar dano direto ao HP. Gera +2 RAM.'
    },
    unit_09: {
      id: 'unit_09',
      kind: 'unit',
      name: 'Trojan-Mantis',
      subtitle: 'Lâmina Viral',
      atk: 3,
      def: 4,
      ramGain: 2,
      keywords: ['VIRUS'],
      copies: 1,
      img: './cards/unit_09.webp',
      accent: '#39FF14',
      lore: 'Suas foices serrilhadas injetam código polimórfico que corrói os servomotores do alvo a cada corte.',
      desc: '[VÍRUS] Ao causar dano em uma unidade inimiga, reduz permanentemente o ATK dela em -2. Gera +2 RAM.'
    },
    unit_10: {
      id: 'unit_10',
      kind: 'unit',
      name: 'Bastion-Core',
      subtitle: 'Torre de Contenção',
      atk: 3,
      def: 6,
      ramGain: 2,
      keywords: ['FIREWALL'],
      copies: 1,
      img: './cards/unit_10.webp',
      accent: '#0EA5E9',
      lore: 'Monólito de criptografia quântica projetado para segurar invasões inteiras no perímetro corporativo.',
      desc: '[FIREWALL] Protege sua integridade obrigando o oponente a atacar ou bloquear esta unidade primeiro. Gera +2 RAM.'
    },
    unit_11: {
      id: 'unit_11',
      kind: 'unit',
      name: 'Siphon-Viper',
      subtitle: 'Parasita de Memória',
      atk: 4,
      def: 3,
      ramGain: 2,
      keywords: ['DRENO'],
      copies: 1,
      img: './cards/unit_11.webp',
      accent: '#E879F9',
      lore: 'Serpente cibernética que crava presas de fibra ótica nos terminais rivais para sugar ciclos de RAM.',
      desc: '[DRENO] Ao causar dano direto ao HP, transfere até 1 RAM do adversário para quem controla a unidade. Gera +2 RAM.'
    },
    unit_12: {
      id: 'unit_12',
      kind: 'unit',
      name: 'Plague-Node',
      subtitle: 'Barreira Corrosiva',
      atk: 2,
      def: 5,
      ramGain: 2,
      keywords: ['FIREWALL', 'VIRUS'],
      copies: 1,
      img: './cards/unit_12.webp',
      accent: '#84CC16',
      lore: 'Um nó de contenção contaminado que devolve enxames de nanovírus a qualquer atacante que o toque.',
      desc: '[FIREWALL] [VÍRUS] Força combates diretos e reduz permanentemente em -2 o ATK das unidades que ferir. Gera +2 RAM.'
    },
    unit_13: {
      id: 'unit_13',
      kind: 'unit',
      name: 'Flash-Ronin',
      subtitle: 'Executor Relâmpago',
      atk: 4,
      def: 3,
      ramGain: 2,
      keywords: ['ZERO_DAY', 'DRENO'],
      copies: 1,
      img: './cards/unit_13.webp',
      accent: '#22D3EE',
      lore: 'Mercenário veloz da sub-rede cuja katana de plasma corta firewalls e drena créditos num só golpe.',
      desc: '[ZERO-DAY] [DRENO] Ataca no turno em que entra e rouba 1 RAM ao causar dano direto ao HP inimigo. Gera +2 RAM.'
    },
    unit_14: {
      id: 'unit_14',
      kind: 'unit',
      name: 'Malware-Rex',
      subtitle: 'Predador Corrompido',
      atk: 5,
      def: 5,
      ramGain: 2,
      keywords: ['VIRUS'],
      copies: 1,
      img: './cards/unit_14.webp',
      accent: '#A3E635',
      lore: 'Um programa-besta banido da Deep Net que devora bancos de dados inteiros e infecta o que sobrevive.',
      desc: '[VÍRUS] Besta digital 5/5 que corrói permanentemente -2 ATK de qualquer unidade inimiga atingida. Gera +2 RAM.'
    },
    exploit_01: {
      id: 'exploit_01',
      kind: 'exploit',
      name: 'Chip Overclock',
      subtitle: 'Exploit de Amplificação',
      cost: 2,
      keywords: [],
      copies: 1,
      img: './cards/exploit_01.webp',
      accent: '#FFB800',
      targetType: 'ally_unit',
      lore: 'Destrava os limitadores térmicos de uma unidade aliada para extrair potência brutal acima do limite.',
      desc: 'Custo: 2 RAM. Aumenta em +3 ATK permanentemente uma Unidade aliada no campo.'
    },
    exploit_02: {
      id: 'exploit_02',
      kind: 'exploit',
      name: 'Spike Neural',
      subtitle: 'Exploit de Ataque Direto',
      cost: 2,
      keywords: [],
      copies: 1,
      img: './cards/exploit_02.webp',
      accent: '#FF0055',
      targetType: 'none',
      lore: 'Descarga elétrica ilegal disparada direto pela interface neural do oponente, ignorando defesas físicas.',
      desc: 'Custo: 2 RAM. Dispara um feixe neural que causa 3 de dano direto ao HP do hacker inimigo.'
    },
    exploit_03: {
      id: 'exploit_03',
      kind: 'exploit',
      name: 'Kill-Switch',
      subtitle: 'Exploit de Execução',
      cost: 4,
      keywords: [],
      copies: 1,
      img: './cards/exploit_03.webp',
      accent: '#FF0055',
      targetType: 'enemy_unit',
      lore: 'Chave-mestra de desligamento remoto criada pela Diretoria Negra para apagar agentes traidores em um clique.',
      desc: 'Custo: 4 RAM. Remove da partida uma unidade inimiga escolhida. Ela não entra no descarte e não pode ser recuperada.'
    },
    exploit_04: {
      id: 'exploit_04',
      kind: 'exploit',
      name: 'Patch v9',
      subtitle: 'Exploit de Restauração',
      cost: 3,
      keywords: [],
      copies: 1,
      img: './cards/exploit_04.webp',
      accent: '#39FF14',
      targetType: 'none',
      lore: 'Pacote de emergência do mercado negro que sela vazamentos neurais e reforça a blindagem da equipe.',
      desc: 'Custo: 3 RAM. Restaura +4 HP (até 20) e fortalece todas as suas Unidades em campo com +2 DEF.'
    },
    exploit_05: {
      id: 'exploit_05',
      kind: 'exploit',
      name: 'Bomba EMP',
      subtitle: 'Exploit de Pulso em Área',
      cost: 3,
      keywords: ['VIRUS'],
      copies: 1,
      img: './cards/exploit_05.webp',
      accent: '#FFB800',
      targetType: 'none',
      lore: 'Detona uma onda eletromagnética suja que frita circuitos hostis e paralisa armamentos em massa.',
      desc: 'Custo: 3 RAM. Causa 2 de dano em TODAS as Unidades inimigas e reduz o ATK delas em -2.'
    },
    exploit_06: {
      id: 'exploit_06',
      kind: 'exploit',
      name: 'Sifão de Memória',
      subtitle: 'Exploit de Dreno Tático',
      cost: 2,
      keywords: ['DRENO'],
      copies: 1,
      img: './cards/exploit_06.webp',
      accent: '#E879F9',
      targetType: 'none',
      lore: 'Injeta um túnel fantasma no barramento do alvo para roubar RAM e extrair pacotes secretos.',
      desc: 'Custo: 2 RAM. Causa 2 de dano direto ao HP inimigo, rouba até 2 RAM dele e compra 1 carta.'
    }
  };

  Object.assign(CARD_DB, {
    unit_21: {
      ...CARD_DB.unit_02, id: 'unit_21', name: 'Drone do Viaduto', atk: 1, def: 4,
      fallbackArt: 'unit_02', img: './cards/drone-viaduto.webp', lore: 'Peças reaproveitadas mantêm a Antena Comunitária no ar.',
      desc: 'Gera +3 RAM ao entrar em campo. Tem 1 ATK e 4 DEF.'
    },
    unit_22: {
      ...CARD_DB.unit_06, id: 'unit_22', name: 'Moto-Fantasma', atk: 3, def: 3, fallbackArt: 'unit_06', img: './cards/moto-fantasma.webp',
      lore: 'Uma mensageira autônoma que conhece as ruelas fora do alcance dos radares.',
      desc: '[ZERO-DAY] Pode atacar no turno de entrada. Gera +2 RAM.'
    },
    unit_23: {
      ...CARD_DB.unit_03, id: 'unit_23', name: 'Guarda da Feira', atk: 3, def: 5, fallbackArt: 'unit_03', img: './cards/guarda-feira.webp',
      lore: 'A associação dos feirantes programou esta unidade para proteger suas bancas.',
      desc: '[FIREWALL] Tem prioridade para interceptar ataques quando pode bloquear, protegendo o HP de quem controla a unidade. Gera +2 RAM.'
    }
  });

  const unitAffinities = {
    unit_03: 'malha', unit_04: 'sombra', unit_05: 'pulso', unit_06: 'pulso',
    unit_07: 'pulso', unit_08: 'sombra', unit_09: 'sombra', unit_10: 'malha',
    unit_11: 'sombra', unit_12: 'malha', unit_13: 'pulso', unit_14: 'pulso',
    unit_21: 'malha', unit_22: 'sombra', unit_23: 'malha'
  };
  for (const [id, affinity] of Object.entries(unitAffinities)) CARD_DB[id].affinity = affinity;

  CARD_DB.exploit_07 = {
    id: 'exploit_07', kind: 'exploit', name: 'Recompilar',
    subtitle: 'Exploit de Reconfiguração', cost: 1, keywords: [],
    img: './cards/recompilar.webp', fallbackArt: 'exploit_01', accent: '#62e8fd',
    targetType: 'ally_unit',
    lore: 'Um compilador de rua que troca o protocolo ativo sem desligar o programa.',
    desc: 'Muda a afinidade de uma unidade aliada até o fim do duelo. Neutra vira Pulso; as demais avançam no ciclo Pulso → Malha → Sombra → Pulso.'
  };

  const effects = {
    exploit_01: [{ type: 'atk', target: 'selected', value: 3 }],
    exploit_02: [{ type: 'direct', value: 3 }],
    exploit_03: [{ type: 'banish', target: 'selected' }],
    exploit_04: [{ type: 'heal', value: 4 }, { type: 'def', target: 'allies', value: 2 }],
    exploit_05: [{ type: 'atk', target: 'enemies', value: -2 }, { type: 'damage', target: 'enemies', value: 2 }],
    exploit_06: [{ type: 'direct', value: 2 }, { type: 'drain', value: 2 }, { type: 'draw', value: 1 }],
    exploit_07: [{ type: 'affinity', target: 'selected' }]
  };
  for (const [id, cardEffects] of Object.entries(effects)) CARD_DB[id].effects = cardEffects;
  CARD_DB.exploit_05.requiresEnemy = true;

  function addUnit(id, name, archetype, atk, def, affinity, keywords, desc, onDeploy) {
    CARD_DB[id] = { id, kind: 'unit', subtitle: archetype, name, archetype, atk, def, affinity,
      keywords, ramGain: 2, img: `./cards/${id}.webp`, accent: AFFINITIES[affinity]?.color || '#a8f5f3', desc, onDeploy };
  }

  function addExploit(id, name, archetype, cost, targetType, desc, cardEffects) {
    CARD_DB[id] = { id, kind: 'exploit', subtitle: archetype, name, archetype, cost, targetType,
      keywords: [], img: `./cards/${id}.webp`, accent: '#d48afd', desc, effects: cardEffects };
  }

  addUnit('unit_24', 'Mensageira de Fase', 'Infiltração', 2, 2, 'sombra', ['ZERO_DAY'],
    'Zero-Day. Ao entrar em campo, compre 1 carta.', [{ type: 'draw', value: 1 }]);
  addUnit('unit_25', 'Sentinela do Canal', 'Blindagem', 1, 5, 'malha', ['FIREWALL'],
    'Firewall. Ao entrar em campo, fortalece todas as unidades aliadas, inclusive ela, com +1 DEF.',
    [{ type: 'def', target: 'allies', value: 1 }]);
  addUnit('unit_26', 'Escuta do Cais', 'Sabotagem', 2, 3, 'sombra', ['VIRUS'],
    'Vírus. Ao entrar em campo, drena 1 RAM do adversário.', [{ type: 'drain', value: 1 }]);
  addUnit('unit_27', 'Condutor Bifásico', 'Overclock', 4, 3, 'pulso', [],
    'Ao entrar em campo, gera +1 RAM adicional se outra unidade aliada tiver uma afinidade diferente e nenhuma das duas for neutra.',
    [{ type: 'ram', value: 1, mixed: true }]);
  addExploit('exploit_08', 'Passagem de Serviço', 'Infiltração', 2, 'none',
    'Compre 2 cartas.', [{ type: 'draw', value: 2 }]);
  addExploit('exploit_09', 'Cerâmica de Reparo', 'Blindagem', 1, 'ally_unit',
    'Recupere até 3 DEF de uma unidade aliada, sem ultrapassar o máximo dela.', [{ type: 'repair', target: 'selected', value: 3 }]);
  addExploit('exploit_10', 'Ferrugem Óptica', 'Sabotagem', 2, 'enemy_unit',
    'Uma unidade inimiga perde 1 ATK e sofre 2 de dano.', [
      { type: 'atk', target: 'selected', value: -1 }, { type: 'damage', target: 'selected', value: 2 }
    ]);
  addExploit('exploit_11', 'Ponte Dupla', 'Overclock', 2, 'ally_unit',
    'Avance a afinidade de uma unidade aliada e conceda +1 ATK e +1 DEF a ela.', [
      { type: 'affinity', target: 'selected' }, { type: 'atk', target: 'selected', value: 1 },
      { type: 'def', target: 'selected', value: 1 }
    ]);

  addUnit('unit_28', 'Condensador Coral', 'Ressonância', 2, 4, 'malha', ['RESONANCE'],
    'Ressonância de entrada: ganha +1 DEF se já houver outra unidade aliada da mesma afinidade em campo.',
    [{ type: 'def', target: 'self', value: 1, resonance: true }]);
  addUnit('unit_29', 'Catadora de Ecos', 'Reciclar', 2, 3, 'sombra', ['RECYCLE'],
    'Ao entrar, recupera um Exploit aleatório do descarte se houver espaço na mão.',
    [{ type: 'recycle', kind: 'exploit' }]);
  addUnit('unit_30', 'Ferro de Pulso', 'Ressonância', 3, 3, 'pulso', ['RESONANCE'],
    'Ressonância de ataque: +1 ATK naquele ataque se houver outra unidade aliada da mesma afinidade em campo.');
  CARD_DB.unit_30.onAttack = [{ type: 'atk', value: 1, resonance: true }];
  addExploit('exploit_12', 'Ímã de Núcleo', 'Reciclar', 2, 'none',
    'Recupere a unidade mais recente do descarte se houver espaço na mão.',
    [{ type: 'recycle', kind: 'unit', order: 'latest' }]);
  addExploit('exploit_13', 'Janela Espectral', 'Varredura', 2, 'none',
    'Revele o topo e compre 1 carta. Se o topo era uma unidade de Pulso, compre outra.',
    [{ type: 'scan', affinity: 'pulso' }]);
  addExploit('exploit_14', 'Pressão de Sucata', 'Reciclar', 2, 'none',
    'Cause 1 dano direto a cada duas cartas no seu descarte, até 3 de dano.',
    [{ type: 'discardDamage', divisor: 2, cap: 3 }]);
  CARD_DB.exploit_12.keywords = ['RECYCLE'];
  CARD_DB.exploit_13.keywords = ['SCAN'];
  CARD_DB.exploit_14.keywords = ['RECYCLE'];

  addExploit('exploit_15', 'Rastreador de Lote', 'Investigação', 1, 'ally_unit',
    'Escolha uma unidade aliada de Sombra ou Neutra. Compre 1 carta e conceda +1 ATK à unidade.',
    [{ type: 'draw', value: 1 }, { type: 'atk', target: 'selected', value: 1 }]);
  CARD_DB.exploit_15.targetAffinities = ['sombra', null];
  addExploit('exploit_16', 'Filtro de Isolamento', 'Proteção', 2, 'ally_unit',
    'Restaure até 3 DEF da unidade aliada e conceda +1 DEF permanente.',
    [{ type: 'repair', target: 'selected', value: 3 }, { type: 'def', target: 'selected', value: 1 }]);
  addUnit('unit_31', 'Auditora de Rede', 'Suporte tático', 2, 4, 'malha', [],
    'Ao entrar, reduz em 1 o ATK da unidade inimiga com maior ATK. Empates favorecem a primeira posição.',
    [{ type: 'atk', target: 'strongestEnemy', value: -1 }]);

  addUnit('unit_32', 'Vigia de Turno', 'Vigilância', 2, 3, 'malha', ['VIGILANCE'],
    'Pode bloquear mesmo depois de atacar.');
  addUnit('unit_33', 'Estilhaço de Pulso', 'Só ataque', 4, 0, 'pulso', ['ATTACK_ONLY'],
    'Sem DEF. Só pode atacar e é destruída se for bloqueada.');
  addUnit('unit_34', 'Anteparo de Rua', 'Só defesa', 0, 6, 'malha', ['GUARD_ONLY', 'FIREWALL'],
    'Sem ATK. Bloqueia como Firewall, mas não ataca nem causa dano no contra-ataque.');
  addExploit('exploit_17', 'Formação de Retaguarda', 'Proteção', 3, 'none',
    'Até o início do seu próximo turno, unidades aliadas que atacaram podem bloquear se forem capazes de defender.',
    [{ type: 'counterFormation' }]);
  addExploit('exploit_18', 'Escudo de Emergência', 'Proteção', 2, 'none',
    'Protege quem joga esta carta, absorvendo até 4 de dano ao HP até o início do próximo turno desse lado. O escudo não acumula.',
    [{ type: 'hpShield', value: 4 }]);

  addUnit('unit_35', 'Biombo de Sucata', 'Muralha comum', 0, 3, 'malha', ['GUARD_ONLY', 'MULTI_BLOCK'],
    'Sem ATK. Pode bloquear até dois atacantes. O dano do primeiro choque fica na unidade para o segundo.');
  CARD_DB.unit_35.blockLimit = 2;
  addUnit('unit_36', 'Colosso do Viaduto', 'Muralha rara', 0, 12, 'malha', ['GUARD_ONLY', 'MULTI_BLOCK', 'FIREWALL'],
    'Sem ATK. Intercepta até três atacantes por fase. Cada choque consome a mesma reserva de DEF. Gera apenas 1 RAM.');
  CARD_DB.unit_36.blockLimit = 3;
  CARD_DB.unit_36.ramGain = 1;

  addUnit('unit_37', 'Sonda de Bancada', 'Dano de entrada', 2, 2, null, [],
    'Ao entrar em campo, causa 1 de dano à unidade inimiga escolhida.',
    [{ type: 'damage', target: 'selected', value: 1 }]);
  CARD_DB.unit_37.targetType = 'enemy_unit';
  addUnit('unit_38', 'Vigia de Brecha', 'Dano de entrada', 1, 2, 'sombra', [],
    'Ao entrar em campo, causa 2 de dano à unidade inimiga escolhida. Gera apenas 1 RAM.',
    [{ type: 'damage', target: 'selected', value: 2 }]);
  CARD_DB.unit_38.targetType = 'enemy_unit';
  CARD_DB.unit_38.ramGain = 1;
  addExploit('exploit_19', 'Curto de Placa', 'Sabotagem', 2, 'enemy_unit',
    'Causa 2 de dano à DEF de uma unidade inimiga. Pode destruí-la se ela tiver 2 DEF ou menos.',
    [{ type: 'damage', target: 'selected', value: 2 }]);

  addUnit('unit_39', 'Âncora de Malha', 'Liderança de Overclock', 2, 5, 'malha', [],
    'Ao liderar um Overclock bloqueado, recebe 2 a menos de dano do contra-ataque.');
  CARD_DB.unit_39.overclock = { counterReduction: 2 };
  addUnit('unit_40', 'Operadora de Reserva', 'Retaguarda de Overclock', 2, 3, 'sombra', [],
    'Como segunda unidade de um Overclock, pode bloquear até o início do seu próximo turno.');
  CARD_DB.unit_40.overclock = { partnerBlock: true };
  addUnit('unit_41', 'Recuperador de Pulso', 'Recarga de Overclock', 3, 3, 'pulso', [],
    'Ao liderar um Overclock que destrói o bloqueador, recupera 1 RAM. Uma vez por turno.');
  CARD_DB.unit_41.overclock = { refund: 1 };
  addExploit('exploit_20', 'Acoplador de Fase', 'Sinergia de Overclock', 1, 'none',
    'No próximo Overclock deste turno, uma unidade Neutra e outra com afinidade podem ganhar o bônus contra um bloqueador.',
    [{ type: 'overclockCoupler' }]);
  for (const id of ['unit_39', 'unit_40', 'unit_41', 'exploit_20']) {
    CARD_DB[id].rarity = 'rare';
    CARD_DB[id].proceduralOnly = true;
  }

  addUnit('unit_42', 'Escudo de Reboque', 'Escolta de Overclock', 1, 4, 'malha', [],
    'Como segunda unidade de um Overclock bloqueado, recebe todo o contra-ataque no lugar da líder.');
  CARD_DB.unit_42.overclock = { escort: true };
  addUnit('unit_43', 'Guarda do Barramento', 'Escolta de Overclock', 1, 7, 'malha', [],
    'Como segunda unidade de um Overclock bloqueado, recebe todo o contra-ataque no lugar da líder. Gera 1 RAM.');
  CARD_DB.unit_43.overclock = { escort: true };
  CARD_DB.unit_43.ramGain = 1;
  addUnit('unit_44', 'Chassi de Choque', 'Liderança de Overclock', 3, 3, 'pulso', [],
    'Ao liderar um Overclock bloqueado, recebe 1 a menos de dano do contra-ataque.');
  CARD_DB.unit_44.overclock = { counterReduction: 1 };
  addUnit('unit_45', 'Técnica do Intervalo', 'Suporte', 1, 3, 'malha', [],
    'Ao entrar, restaura até 2 DEF de cada unidade aliada.', [{ type: 'repair', target: 'allies', value: 2 }]);
  addUnit('unit_46', 'Marcadora de Trincas', 'Dano de entrada', 2, 2, 'sombra', [],
    'Ao entrar, causa 1 de dano a uma unidade inimiga escolhida, ou 3 se ela já tiver perdido DEF.',
    [{ type: 'woundedDamage', target: 'selected', value: 1, bonus: 2 }]);
  CARD_DB.unit_46.targetType = 'enemy_unit';
  addUnit('unit_47', 'Corta-Sinal', 'Sabotagem', 2, 2, 'sombra', [],
    'Ao entrar, uma unidade inimiga escolhida perde a capacidade de bloquear até o próximo turno dela.',
    [{ type: 'blockLock', target: 'selected' }]);
  CARD_DB.unit_47.targetType = 'enemy_unit';
  addUnit('unit_48', 'Pulso de Amparo', 'Proteção', 2, 3, 'pulso', [],
    'Ao entrar, concede um escudo de 2 HP até o início do seu próximo turno.', [{ type: 'hpShield', value: 2 }]);
  addUnit('unit_49', 'Observadora de Malha', 'Varredura', 1, 3, 'malha', [],
    'Ao entrar, compre 1 carta. Se o topo era Malha, compre mais uma.', [{ type: 'scan', affinity: 'malha' }]);
  addUnit('unit_50', 'Muralha Basculante', 'Bloqueio múltiplo', 0, 8, 'malha', ['GUARD_ONLY', 'MULTI_BLOCK'],
    'Só Defesa. Pode bloquear até dois atacantes, usando a mesma reserva de DEF. Gera 1 RAM.');
  CARD_DB.unit_50.blockLimit = 2;
  CARD_DB.unit_50.ramGain = 1;
  addUnit('unit_51', 'Estafeta dos Ecos', 'Reciclagem rápida', 2, 2, 'sombra', ['ZERO_DAY'],
    'Zero-Day. Ao entrar, recupera a unidade mais recente do descarte se houver espaço.', [{ type: 'recycle', kind: 'unit', order: 'latest' }]);
  addUnit('unit_52', 'Drone de Bancada', 'Dano de entrada', 2, 3, null, [],
    'Ao entrar, causa 1 de dano à unidade inimiga com maior ATK.', [{ type: 'damage', target: 'strongestEnemy', value: 1 }]);
  addUnit('unit_53', 'Escudeira do Ringue', 'Escolta de Overclock', 2, 4, null, [],
    'Como segunda unidade de um Overclock bloqueado, recebe todo o contra-ataque no lugar da líder.');
  CARD_DB.unit_53.overclock = { escort: true };
  addUnit('unit_54', 'Ponta de Retorno', 'Recarga de Overclock', 4, 2, 'pulso', [],
    'Ao liderar um Overclock que destrói o bloqueador, recupera 1 RAM. Uma vez por turno.');
  CARD_DB.unit_54.overclock = { refund: 1 };
  addUnit('unit_55', 'Sombra de Desvio', 'Ressonância', 2, 4, 'sombra', [],
    'Ressonância de ataque: +1 ATK neste ataque se outra unidade aliada for Sombra.');
  CARD_DB.unit_55.onAttack = [{ type: 'atk', value: 1, resonance: true }];
  addUnit('unit_56', 'Cargueira Blindada', 'Vigilância e proteção', 2, 5, 'malha', ['VIGILANCE'],
    'Vigilância. Ao entrar, concede escudo de 2 HP até o início do seu próximo turno. Gera 1 RAM.', [{ type: 'hpShield', value: 2 }]);
  CARD_DB.unit_56.ramGain = 1;

  addExploit('exploit_21', 'Corte de Guarda', 'Sabotagem', 2, 'enemy_unit',
    'A unidade perde a capacidade de bloquear até o próximo turno dela.', [{ type: 'blockLock', target: 'selected' }]);
  addExploit('exploit_22', 'Sonda de Fratura', 'Sabotagem', 2, 'enemy_unit',
    'Causa 2 de dano à unidade, ou 4 se ela já tiver perdido DEF.', [{ type: 'woundedDamage', target: 'selected', value: 2, bonus: 2 }]);
  addExploit('exploit_23', 'Curto de Escudo', 'Ataque direto', 2, 'none',
    'Remove até 4 pontos do escudo inimigo e causa 2 de dano ao HP.', [{ type: 'shieldBreak', value: 4 }, { type: 'direct', value: 2 }]);
  addExploit('exploit_24', 'Manutenção Expressa', 'Blindagem', 2, 'none',
    'Restaura até 2 DEF de cada unidade aliada.', [{ type: 'repair', target: 'allies', value: 2 }]);
  addExploit('exploit_25', 'Eco de Retaguarda', 'Proteção', 3, 'none',
    'Concede escudo de 2 HP e permite que suas unidades aptas bloqueiem depois de atacar até seu próximo turno.',
    [{ type: 'hpShield', value: 2 }, { type: 'counterFormation' }]);
  addExploit('exploit_26', 'Ponte de Emergência', 'Overclock', 2, 'none',
    'Compre 1 carta. No próximo Overclock deste turno, Neutra + afinidade pode ativar a sinergia contra bloqueio.',
    [{ type: 'draw', value: 1 }, { type: 'overclockCoupler' }]);
  addExploit('exploit_27', 'Varredura Noturna', 'Varredura', 1, 'none',
    'Compre 1 carta. Se o topo era Sombra, compre mais uma.', [{ type: 'scan', affinity: 'sombra' }]);
  addExploit('exploit_28', 'Ruído de Vizinhança', 'Sabotagem', 3, 'none',
    'Causa 1 de dano a cada inimigo, ou 3 em cada inimigo que já perdeu DEF.', [{ type: 'woundedDamage', target: 'enemies', value: 1, bonus: 2 }]);
  addExploit('exploit_29', 'Reserva de Peças', 'Reciclar', 2, 'none',
    'Recupera o Exploit mais recente do descarte se houver espaço e restaura até 1 DEF das aliadas.',
    [{ type: 'recycle', kind: 'exploit', order: 'latest' }, { type: 'repair', target: 'allies', value: 1 }]);
  addExploit('exploit_30', 'Isolamento de Cabine', 'Proteção', 3, 'ally_unit',
    'Restaura até 3 DEF da unidade e concede escudo de 3 HP até o início do seu próximo turno.',
    [{ type: 'repair', target: 'selected', value: 3 }, { type: 'hpShield', value: 3 }]);

  const expansionRarity = {
    common: ['unit_42', 'unit_45', 'unit_52', 'unit_55', 'exploit_24', 'exploit_27', 'exploit_29'],
    uncommon: ['unit_44', 'unit_46', 'unit_47', 'unit_48', 'unit_49', 'unit_50', 'unit_53',
      'exploit_21', 'exploit_22', 'exploit_23', 'exploit_26'],
    rare: ['unit_43', 'unit_51', 'unit_54', 'unit_56', 'exploit_25', 'exploit_28', 'exploit_30']
  };
  for (const [rarity, ids] of Object.entries(expansionRarity)) {
    for (const id of ids) {
      CARD_DB[id].rarity = rarity;
      CARD_DB[id].proceduralOnly = true;
    }
  }

  for (const id of ['unit_28', 'unit_29', 'unit_30', 'exploit_12', 'exploit_13', 'exploit_14', 'exploit_15', 'exploit_16', 'unit_31', 'unit_32', 'unit_33', 'unit_34', 'exploit_17', 'exploit_18', 'unit_37', 'unit_38', 'exploit_19']) {
    CARD_DB[id].proceduralOnly = true;
  }

  function hasKeyword(cardOrId, kw) {
    const def = typeof cardOrId === 'string' ? CARD_DB[cardOrId] : (cardOrId && cardOrId.cardId ? CARD_DB[cardOrId.cardId] : cardOrId);
    return Boolean(def && Array.isArray(def.keywords) && def.keywords.includes(kw));
  }

  const STARTER_CARD_IDS = [
    'unit_01', 'unit_02', 'unit_03', 'unit_04', 'unit_05', 'unit_06',
    'unit_08', 'unit_09', 'unit_11',
    'exploit_01', 'exploit_02', 'exploit_04'
  ];

  const STARTER_DECKS = {
    balanced: { name: 'Equilibrado', description: 'Ataque, defesa e Exploits de apoio. Uma abertura versátil.',
      cards: ['unit_01', 'unit_02', 'unit_03', 'unit_04', 'unit_05', 'unit_08', 'unit_09', 'exploit_01', 'exploit_02', 'exploit_04'] },
    tools: { name: 'Oficina Neutra', description: 'Mais unidades neutras, reparo e dano leve contra unidades.',
      cards: ['unit_01', 'unit_02', 'unit_03', 'unit_05', 'unit_08', 'unit_11', 'unit_37', 'exploit_01', 'exploit_09', 'exploit_19'] },
    breach: { name: 'Caça a Brechas', description: 'Pulso, Malha e Sombra para explorar afinidades e abrir a defesa.',
      cards: ['unit_01', 'unit_02', 'unit_04', 'unit_05', 'unit_06', 'unit_09', 'unit_38', 'exploit_01', 'exploit_07', 'exploit_19'] }
  };

  const AVATAR_ASSETS = {
    kira: { id: 'kira', name: 'KIRA // Rato de Sub-rede', img: './avatars/kira.png' },
    cipher: { id: 'cipher', name: 'CIPHER // Cão de Guarda Vértice', img: './avatars/cipher.png' },
    vex: { id: 'vex', name: 'VEX // Corretor de Dados Fantasma', img: './avatars/vex.png' },
    archon: { id: 'archon', name: 'ARCHON // Diretor de Operações Negras', img: './avatars/archon.png' }
  };

  const AVATAR_ASSET = AVATAR_ASSETS.vex;

  const ASSET_LIST = [
    ...Object.values(CARD_DB).map(c => ({
      id: c.id,
      label: c.name + ' (' + (c.kind === 'unit' ? 'Unidade' : 'Exploit') + ')',
      path: c.img
    })),
    ...Object.values(AVATAR_ASSETS).map(a => ({
      id: a.id,
      label: a.name + ' (Avatar)',
      path: a.img
    }))
  ];

  NB.Cards = {
    MAX_HP,
    MAX_HAND,
    OVERCLOCK_COST,
    DECK_SIZE,
    MAX_COPIES,
    KEYWORDS,
    AFFINITIES,
    AFFINITY_CYCLE,
    affinityLabel,
    describeAffinity,
    CARD_DB,
    rarityLabel: rarity => ({ common: 'Comum', uncommon: 'Incomum', rare: 'Rara' })[rarity] || '',
    STARTER_CARD_IDS,
    STARTER_DECKS,
    AVATAR_ASSETS,
    AVATAR_ASSET,
    ASSET_LIST,
    hasKeyword
  };
})(window.NB = window.NB || {});
