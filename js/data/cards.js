(function (NB) {
  'use strict';

  const MAX_HP = 20;
  const MAX_HAND = 6;
  const OVERCLOCK_COST = 3;
  const DECK_SIZE = 20;
  const MAX_COPIES = 2;

  /* Metadados das 4 Palavras-Chave com ícones e cores */
  const KEYWORDS = {
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
      desc: 'Obriga o oponente a atacá-la ou bloqueá-la primeiro antes de atingir o HP diretamente.'
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
      desc: 'Ao causar dano direto ao HP do hacker inimigo, rouba 1 de RAM dele para você.'
    }
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
      img: './cards/unit_01.png',
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
      img: './cards/unit_02.png',
      accent: '#39FF14',
      ability: 'EXTRA_RAM',
      lore: 'Rasteja pelos dutos de fibra ótica desviando energia residual direto para o deck de Kairo.',
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
      img: './cards/unit_03.png',
      accent: '#38BDF8',
      lore: 'Um protocolo militar roubado que projeta escudos hexagonais impenetráveis no ciberespaço.',
      desc: '[FIREWALL] Muralha blindada de 7 DEF que obriga o inimigo a enfrentá-la antes de atingir seu HP. Gera +2 RAM.'
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
      img: './cards/unit_04.png',
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
      img: './cards/unit_05.png',
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
      img: './cards/unit_06.png',
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
      img: './cards/unit_07.png',
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
      img: './cards/unit_08.png',
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
      img: './cards/unit_09.png',
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
      img: './cards/unit_10.png',
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
      img: './cards/unit_11.png',
      accent: '#E879F9',
      lore: 'Serpente cibernética que crava presas de fibra ótica nos terminais rivais para sugar ciclos de RAM.',
      desc: '[DRENO] Ao atingir o HP do hacker inimigo diretamente, rouba 1 de RAM dele para você. Gera +2 RAM.'
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
      img: './cards/unit_12.png',
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
      img: './cards/unit_13.png',
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
      img: './cards/unit_14.png',
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
      img: './cards/exploit_01.png',
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
      img: './cards/exploit_02.png',
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
      img: './cards/exploit_03.png',
      accent: '#FF0055',
      targetType: 'enemy_unit',
      lore: 'Chave-mestra de desligamento remoto criada pela Diretoria Negra para apagar agentes traidores em um clique.',
      desc: 'Custo: 4 RAM. Dispara laser de execução e destrói instantaneamente uma Unidade inimiga escolhida.'
    },
    exploit_04: {
      id: 'exploit_04',
      kind: 'exploit',
      name: 'Patch v9',
      subtitle: 'Exploit de Restauração',
      cost: 3,
      keywords: [],
      copies: 1,
      img: './cards/exploit_04.png',
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
      img: './cards/exploit_05.png',
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
      img: './cards/exploit_06.png',
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
      desc: '[FIREWALL] Atrai confrontos e protege o HP de Kairo. Gera +2 RAM.'
    }
  });

  function hasKeyword(cardOrId, kw) {
    const def = typeof cardOrId === 'string' ? CARD_DB[cardOrId] : (cardOrId && cardOrId.cardId ? CARD_DB[cardOrId.cardId] : cardOrId);
    return Boolean(def && Array.isArray(def.keywords) && def.keywords.includes(kw));
  }

  const STARTER_CARD_IDS = [
    'unit_01', 'unit_02', 'unit_03', 'unit_04', 'unit_05', 'unit_06',
    'unit_08', 'unit_09', 'unit_11',
    'exploit_01', 'exploit_02', 'exploit_04'
  ];

  const AVATAR_ASSETS = {
    kira: { id: 'kira', name: 'KIRA // Rato de Sub-rede', img: './avatars/kira.png' },
    cipher: { id: 'cipher', name: 'CIPHER // Cão de Guarda Vértice', img: './avatars/cipher.png' },
    vex: { id: 'vex', name: 'VEX // Corretor de Dados Fantasma', img: './avatars/vex.png' },
    archon: { id: 'archon', name: 'ARCHON // Diretor de Operações Negras', img: './avatars/archon.png' }
  };

  const AVATAR_ASSET = AVATAR_ASSETS.vex;

  const ASSET_LIST = [
    ...Object.values(CARD_DB).filter(c => !c.fallbackArt).map(c => ({
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
    CARD_DB,
    STARTER_CARD_IDS,
    AVATAR_ASSETS,
    AVATAR_ASSET,
    ASSET_LIST,
    hasKeyword
  };
})(window.NB = window.NB || {});
