(function (NB) {
  'use strict';

  /* Campanha de Vingança — 4 Nós Conectados na Rede Neural */
  const CAMPAIGN_NODES = [
    {
      index: 0,
      id: 'kira',
      nodeCode: 'NÓ 01',
      name: 'KIRA',
      title: 'Rato de Sub-rede',
      fullTitle: 'KIRA // Rato de Sub-rede',
      avatar: './avatars/kira.png',
      accent: '#00F0FF',
      hp: 18,
      archetype: 'Agressivo · [ZERO-DAY]',
      canOverclock: false,
      rewardCards: ['unit_13', 'exploit_06'],
      clueTitle: 'PISTA #01 · CONTRATO DA ARASAKA-CORP',
      clueText: 'Os logs de proxy da Kira confirmam que a emboscada contra você foi financiada por uma subconta da Arasaka-Corp — blindada pelo cão de guarda CIPHER.',
      dossierDialogue: [
        { speaker: 'KAIRO', text: 'Seu sinal estava no ponto de acesso onde tentaram fritar meu córtex, Kira. Quem pagou pelo serviço?' },
        { speaker: 'KIRA', text: 'Calma, fantasma! Eu só vendi a rota da sub-rede. Se quer o nome do contratante, tente acompanhar minha velocidade!' }
      ],
      deckList: [
        'unit_04', 'unit_04', 'unit_04',
        'unit_06', 'unit_06', 'unit_06',
        'unit_13', 'unit_13',
        'unit_01', 'unit_01',
        'unit_02', 'unit_02',
        'unit_05', 'unit_05',
        'exploit_01', 'exploit_01',
        'exploit_02', 'exploit_02',
        'exploit_04', 'exploit_06'
      ],
      lines: {
        start: ['"Rápido demais pro seu firewall velho, Kairo!"', '"Zero-Day engatilhado. Tenta piscar!"'],
        playerSummonStrong: ['"Pesado demais... minhas unidades vão passar antes!"', '"Boa placa, mas lento demais."'],
        playerExploit: ['"Ei! Tira esse código da minha sub-rede!"', '"Trapaceando com Exploit, Kairo?"'],
        hit: ['"Droga! Você ainda tem reflexo!"', '"Ai! Isso queimou meu roteador!"'],
        critical: ['"Espera! Eu passo os logs se você aliviar!"', '"Meu nó tá quase caindo!"'],
        attack: ['"Ataque relâmpago! Bloqueia se puder!"', '"Zero-Day em cima de você!"'],
        destroyPlayer: ['"Mais um alvo vaporizado!"', '"Muito lento, ex-netrunner!"'],
        playerCritical: ['"Quase lá! Um golpe e você desconecta!"', '"Acabou a bateria, Kairo?"'],
        summon: ['"Injetando corredor rápido no campo!"', '"Mais velocidade, mais RAM!"']
      }
    },
    {
      index: 1,
      id: 'cipher',
      nodeCode: 'NÓ 02',
      name: 'CIPHER',
      title: 'Cão de Guarda da Arasaka-Corp',
      fullTitle: 'CIPHER // Cão de Guarda da Arasaka-Corp',
      avatar: './avatars/cipher.png',
      accent: '#38BDF8',
      hp: 20,
      archetype: 'Defensivo · [FIREWALL] & Buffs',
      canOverclock: false,
      rewardCards: ['unit_10', 'unit_12'],
      clueTitle: 'PISTA #02 · O CORRETOR FANTASMA',
      clueText: 'Dentro do cofre da Arasaka-Corp, Cipher guardava a transferência das suas coordenadas neurais em tempo real — vendidas pelo corretor VEX.',
      dossierDialogue: [
        { speaker: 'CIPHER', text: 'Intruso identificado: Kairo. Status oficial: eliminado. Protocolo de contenção corporativa ativado.' },
        { speaker: 'KAIRO', text: 'A Arasaka-Corp pagou pela minha emboscada. Vou derrubar cada camada do seu Firewall até arrancar o nome do mandante.' }
      ],
      deckList: [
        'unit_03', 'unit_03', 'unit_03',
        'unit_10', 'unit_10', 'unit_10',
        'unit_12', 'unit_12',
        'unit_01', 'unit_01',
        'unit_02', 'unit_02',
        'unit_07', 'unit_07',
        'exploit_01', 'exploit_01', 'exploit_01',
        'exploit_04', 'exploit_04', 'exploit_04'
      ],
      lines: {
        start: ['"Perímetro selado. Nenhuma invasão passará pelo Firewall."', '"Autorização negada, Kairo. Iniciando expurgo."'],
        playerSummonStrong: ['"Ameaça detectada. Reforçando blindagem frontal."', '"Força bruta não rompe a Arasaka-Corp."'],
        playerExploit: ['"Exploit registrado no log de segurança."', '"Tentativa de invasão contida parcialmente."'],
        hit: ['"Alerta: integridade do cofre comprometida!"', '"Dano no núcleo detectado. Recalibrando."'],
        critical: ['"Aviso crítico! Protocolo de emergência falhando!"', '"Impossível... você atravessou minha defesa!"'],
        attack: ['"Contra-ataque corporativo autorizado."', '"Avançando muralha blindada."'],
        destroyPlayer: ['"Processo hostil neutralizado."', '"Unidade intrusa removida da memória."'],
        playerCritical: ['"Sua conexão está colapsando. Renda-se."', '"Expurgo quase concluído."'],
        summon: ['"Erguendo barreira Firewall nível máximo."', '"Reforço blindado em posição."']
      }
    },
    {
      index: 2,
      id: 'vex',
      nodeCode: 'NÓ 03',
      name: 'VEX',
      title: 'Corretor de Dados Fantasma',
      fullTitle: 'VEX // Corretor de Dados Fantasma',
      avatar: './avatars/vex.png',
      accent: '#FF0055',
      hp: 20,
      archetype: 'Técnico · [VÍRUS], [DRENO] & Exploits',
      canOverclock: false,
      rewardCards: ['unit_14', 'exploit_05'],
      clueTitle: 'PISTA #03 · A TRAIÇÃO DO MENTOR',
      clueText: 'Com o servidor invadido, Vex entrega a assinatura biométrica do mandante final: ARCHON, Diretor de Operações Negras — o próprio mentor de Kairo.',
      dossierDialogue: [
        { speaker: 'KAIRO', text: 'Você vendeu minha posição naquela noite, Vex. Quem comprou a minha cabeça?' },
        { speaker: 'VEX', text: 'Nada pessoal, Kairo — só negócios de alto escalão. Sobreviva aos meus Vírus e Drenos que eu te dou a chave do diretor.' }
      ],
      deckList: [
        'unit_09', 'unit_09', 'unit_09',
        'unit_11', 'unit_11',
        'unit_08', 'unit_08',
        'unit_12', 'unit_12',
        'unit_14', 'unit_14',
        'unit_02',
        'exploit_02', 'exploit_02',
        'exploit_03', 'exploit_03',
        'exploit_05', 'exploit_05',
        'exploit_06', 'exploit_06'
      ],
      lines: {
        start: ['"Kairo? Achei que a emboscada tinha apagado você..."', '"Prepare-se para ter sua RAM drenada até o osso."'],
        playerSummonStrong: ['"Belo brinquedo... vamos ver como se sai infectado por Vírus."', '"ATK alto? Nada que um Kill-Switch não resolva."'],
        playerExploit: ['"Tsc! Exploit sujo. Você não mudou nada, Kairo."', '"Invasão detectada! Ajustando meu proxy..."'],
        hit: ['"Argh! Meu núcleo sofreu dano!"', '"Maldito! Isso queimou minha rota de fuga!"'],
        critical: ['"Espera! Eu só vendi sua localização pro Diretor!"', '"Impossível... minha integridade está caindo!"'],
        attack: ['"Hora de drenar sua conexão de vez!"', '"Tente bloquear isso, fantasma!"'],
        destroyPlayer: ['"Mais um processo eliminado. Sem chance, Kairo."', '"Seu baralho está corrompido!"'],
        playerCritical: ['"Sua integridade está por um fio. Desista."', '"O sindicato mandou lembranças."'],
        summon: ['"Injetando malware tático no servidor."', '"Mais RAM, mais controle. Você está cercado."']
      }
    },
    {
      index: 3,
      id: 'archon',
      nodeCode: 'NÓ 04 · CHEFE FINAL',
      name: 'ARCHON',
      title: 'Diretor de Operações Negras',
      fullTitle: 'ARCHON // Diretor de Operações Negras',
      avatar: './avatars/archon.png',
      accent: '#FFB800',
      hp: 22,
      archetype: 'Híbrido · OVERCLOCK Frequente',
      canOverclock: true,
      rewardCards: ['unit_07', 'exploit_03'],
      clueTitle: 'PISTA FINAL · OPERAÇÃO ECLIPSE EXPOSTA',
      clueText: 'O núcleo central de ARCHON foi destruído e os arquivos da Operação Eclipse vazaram para toda a rede. Sua vingança foi concluída e seu nome limpo.',
      dossierDialogue: [
        { speaker: 'ARCHON', text: 'Impressionante, Kairo. Eu mesmo ensinei você a hackear... mas você descobriu demais sobre a Operação Eclipse.' },
        { speaker: 'KAIRO', text: 'Você me traiu para enterrar os testes ilegais, Archon. Hoje eu derrubo seu núcleo e exponho tudo na rede aberta!' }
      ],
      deckList: [
        'unit_07', 'unit_07',
        'unit_05', 'unit_05',
        'unit_13', 'unit_13',
        'unit_14', 'unit_14',
        'unit_10', 'unit_10',
        'unit_02', 'unit_02',
        'unit_06', 'unit_08',
        'exploit_01', 'exploit_01',
        'exploit_03', 'exploit_04',
        'exploit_05', 'exploit_06'
      ],
      lines: {
        start: ['"Eu criei você na rede, Kairo. E vou deletá-lo pessoalmente."', '"Contemple o verdadeiro poder do Overclock corporativo!"'],
        playerSummonStrong: ['"Boa tentativa. Mas minhas unidades dominam o núcleo."', '"Apenas mais sucata diante da Operação Eclipse."'],
        playerExploit: ['"Você ousa usar minhas próprias técnicas contra mim?"', '"Um arranhão irrelevante no servidor central."'],
        hit: ['"Insolente! Como conseguiu romper minha guarda?!"', '"Você ficou mais forte no subsolo, Kairo..."'],
        critical: ['"Não! Os arquivos da Operação Eclipse não podem vazar!"', '"Núcleo em colapso! Ativando potência máxima!"'],
        attack: ['"Esmaguem esse traidor!"', '"Sinta o peso das Operações Negras!"'],
        overclock: ['"⚡ OVERCLOCK SUPREMO! NENHUM FIREWALL VAI TE SALVAR!"', '"⚡ UNITE ATTACK ATIVADO! PREPARE-SE PARA A PERFURAÇÃO!"'],
        destroyPlayer: ['"Fraco demais para me enfrentar."', '"Você nunca deveria ter voltado, Kairo."'],
        playerCritical: ['"Sua vingança termina aqui, discípulo."', '"Mais um golpe e você vira poeira digital."'],
        summon: ['"Convocando unidade de elite das Operações Negras."', '"Acumulando RAM para o golpe final..."']
      }
    }
  ];

  function getNodeById(id) {
    return CAMPAIGN_NODES.find(n => n.id === id) || CAMPAIGN_NODES[0];
  }

  function getRandomBoss() {
    return CAMPAIGN_NODES[Math.floor(Math.random() * CAMPAIGN_NODES.length)];
  }

  NB.Campaign = {
    NODES: CAMPAIGN_NODES,
    getNodeById,
    getRandomBoss
  };
})(window.NB = window.NB || {});
