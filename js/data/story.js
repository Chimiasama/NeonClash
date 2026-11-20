(function (NB) {
  'use strict';

  const prologue = [
    ['prologo-oficina', 'As casas que ficaram acesas',
      'Kairo cresceu no Viaduto. Durante as enchentes, ela instalou baterias para manter geladeiras de remédios e rádios ligados. A Vértice contratou sua equipe e entregou Terminais Portáteis de Diagnóstico de Malha. Os técnicos chamavam esses aparelhos de decks e usavam suas simulações de carga e intrusão para testar os medidores.'],
    ['prologo-estacao', 'A noite em que o rádio calou',
      'O Ringue e hackers de rua desbloquearam os decks e chamaram a adaptação de NeonClash. Os protocolos apareciam como cartas: Pulso sobrecarregava, Malha continha e Sombra abria brechas silenciosas. Meses depois, Kairo descobriu que medidores que ela tinha assinado pararam de pedir manutenção. Ela marcou um encontro na Estação Fantasma para comparar os registros. Homens com lanternas chegaram antes do contato. Nina chamou pelo rádio até Kairo perder o sinal.'],
    ['prologo-casa', 'A chave ainda serve',
      'Dois dias depois, seu cartão já não abre a própria casa. A chave antiga abre. Dona Nair guardou as faturas que a Vértice diz nunca ter emitido. Kairo quer descobrir quem tirou aquelas casas do cadastro e reparar o estrago que sua assinatura ajudou a fazer.']
  ];
  const chapters = [
    'A chave que ainda serve', 'O bilhete da Estação', 'Quem pagou duas vezes',
    'O guarda do funcionamento', 'O quarto que nunca foi ocupado', 'Tirar a cidade do desligamento',
    'De volta ao Viaduto'
  ];
  const dialogue = [
    ["Nair — Encosta a chave para cima. Ela entorta desde o dia em que você tentou abrir com as sacolas na mão.", "Kairo — No balcão disseram que o apartamento não tem morador. Depois disseram que não podiam me contar qual morador tinha sido removido.", "Nair — No meu me pediram um comprovante de luz. A luz tinha sido cortada, então me ofereceram um prazo de três dias para eu produzir uma conta que eles mesmos pararam de mandar.", "Ela vira as duas folhas. A de cima é um aviso impresso naquela manhã; a de baixo é um recibo molhado que ela secou entre duas páginas de catálogo.", "Kairo — Reconheço esse número. Fui eu que numerei o medidor.", "Nair — Então escreve aqui do lado o que esse número prova. Amanhã, quando me pedirem de novo, eu quero poder dizer com as minhas palavras."],
    ["Kairo — A linha virou duas quadras antes. Quem tinha o itinerário velho teria esperado no lugar errado.", "Kira — A Mara anotou a virada no meu bilhete. Comprei passagem nela quase toda noite. Quando me ofereceram para pagar minha dívida por um trajeto que eu já fazia, achei que queriam saber por onde chegavam as peças.", "Kairo — No papel só tem o número do lote. Onde está meu nome?", "Kira abre a câmera, avança duas imagens e volta uma. No portão da estação, a equipe usa uma foto de Kairo impressa com a mesma referência do lote.", "Kira — Vi isso depois de receber. Deu tempo de apagar meu anúncio. Deu tempo de sair do pátio. Eu não voltei para te procurar.", "Kairo — A Nina voltou. Tenho ouvido o áudio dela há dois dias tentando descobrir o que aconteceu antes de eu ouvir a voz dela.", "Kira — Eu te dou a parte do recibo que mostra quem pagou. Os nomes das pessoas que vieram comigo ficam no meu terminal. Quer levar a cópia inteira, a gente combina o que você vai fazer com ela primeiro."],
    ["Íris — Aqui está sua rubrica. Você numerava os lotes com a data ao contrário. Metade da oficina aprendeu assim por sua causa.", "Kairo — Eu marquei esses endereços para conferência de rua. Se o equipamento vinha sem número, alguém precisava bater na porta.", "Íris — E bateram. Tenho uma etiqueta da Nair grudada na tampa. Agora olha a instrução da versão seguinte. O aparelho deixa de mandar o pedido de visita. A tela do escritório mostra o endereço como fora da malha.", "Kairo — Eu assinei a remessa. Nem abri as ocorrências de instalação quando desocupei a mesa.", "Íris — Então fala isso quando a Ada perguntar. Ela passou a noite trocando aparelhos de tomada. Vai querer saber qual parte você consegue desfazer."],
    ["Cipher — Nas enchentes eu transmitia uma lista de prédios. Quando uma equipe confirmava que chegou, eu riscava o prédio. Um dos riscos da minha lista estava errado. Archon percebeu e mandou a última bateria da central para a rua certa.", "Kairo — E foi você que fez a máquina voltar na clínica ontem. A Ada me contou.", "Cipher — Fiz. Hoje minha credencial serve para desligar a fila e para assinar a ordem pronta. Se eu abrir o cofre daqui, prints de carteiras de funcionários saem junto. Tem gente que vai perder o emprego antes que você consiga ler o primeiro arquivo.", "Kairo — A Raquel separou a cópia de manutenção. Se você abrir no terminal de isolamento, ninguém precisa levar as carteiras.", "Cipher — Então senta no terminal. Quero ver o que você faz quando tem de escolher qual parte do arquivo salvar primeiro."],
    ["Vex — O quarto em meu nome ficou vazio. Nele eu teria colocado uma pessoa que atendesse a porta e dissesse que você estava viajando, enquanto a equipe procurava o seu equipamento. Eu cobrei para ter essa pessoa à disposição.", "Kairo — Eu achei que o aviso de baixa tinha sido escrito depois. Na pensão, eu ainda ouvia o noticiário dizer que estavam procurando um desaparecido.", "Vex muda a ordem dos arquivos na tela, do mais antigo para o mais recente. O aviso tem hora, número de protocolo e um campo de revisão preparado antes da hora em que Kairo perdeu o sinal.", "Vex — As duas coisas correram juntas. Atrás da notícia, alguém já tinha preenchido a viagem de volta sem você.", "Kairo — Archon me ensinou a deixar uma instrução por escrito quando a mesma ordem passa por duas equipes.", "Vex — Foi assim que guardei isso. Eu sabia quem pagou um encontro e aceitei o dinheiro. Quando vi o segundo papel, comecei a fazer uma cópia. Se usar o meu nome, avisa primeiro quem ainda dorme no lugar que eu arranjei."],
    ["Archon — Quando o galpão alagou, eu tinha cinco baterias e oito pedidos urgentes. Pedi para Nina correr com a lista porque eu precisava encarar gente suficiente para entender o que significava deixar uma casa por último.", "Kairo — Eu lembro da lista. A Nair me fez voltar a uma casa que eu tinha marcado como vazia. Desde que virou contrato, as casas marcadas desse jeito sumiram do relatório.", "Archon — Sem renovar a concessão, eu perdia a equipe e as peças. O prazo vencia na sexta. Eu assinei o que precisava para segurar a operação.", "Kairo — E três meses depois assinou para buscar meu equipamento. A clínica continuava ligada quando fez isso. A ordem já tinha hora para me tirar do cadastro.", "Archon abre uma gaveta e tira o cartão que usavam para testar a entrada da primeira equipe. Ainda tem fita de isolamento no canto.", "Archon — Eu tinha certeza de que você ia publicar na hora e que eu ia ter de explicar por que não havia equipe suficiente para manter tudo ligado quando a diretoria recuasse. Escolhi tomar sua cópia. Hoje eu consigo devolver seu acesso em cinco minutos.", "Kairo — A Ada perguntou se eu consigo devolver o da casa onde a gente testou a primeira bateria. Eu vim com gente suficiente para fazer isso junto."]
  ];

  const scenes = [];
  function scene(id, chapter, location, title, requires, grants, lines, options = {}) {
    scenes.push({ id, chapter, location, title, requires, grants, lines, ...options });
  }

  scene('keys', 0, 'home', 'Testar o leitor e a chave', [], 'keys', [
    'Você encosta o cartão. A luz pisca duas vezes e o leitor acusa cadastro revogado. A chave antiga ainda gira.',
    'No quarto, o medidor desligado está marcado com seu número de instalador. Dona Nair deixou duas folhas sobre a mesa.'
  ], { evidence: 'O leitor rejeita Kairo, mas a chave abre a casa. O medidor de seu apartamento ainda está instalado.' });

  scene('nair', 0, 'home', 'Ler as faturas com Dona Nair', ['keys'], 'receipt', dialogue[0],
    { evidence: 'O recibo antigo de Dona Nair liga um endereço tido como vazio ao número de um medidor instalado por Kairo.' });

  scene('firstSignal', 0, 'relay', 'Levar a cópia do recibo à Antena', ['receipt'], 'signal', [
    'Nina arrasta duas marcas de horário na tela. A primeira corresponde ao medidor de Dona Nair. A segunda vem da Estação Fantasma.',
    'Nina — Depois que perdi seu sinal naquela noite, eu continuei chamando. Outra casa respondeu. Quando fui olhar os registros, tinham dado a mesma baixa nos dois endereços.',
    'Kairo — Você lembra de quem tinha acesso à estação antes da reunião?',
    'Nina — Lume recebeu a nota de um lote com o mesmo número que eu ouvi no rádio. Leva o áudio à Feira. Eu deixo o arquivo aberto aqui.'
  ], { next: true, evidence: 'Nina cruza o recibo com uma transmissão. O mesmo número de lote liga o Viaduto à Estação.' });

  scene('invoice', 1, 'market', 'Conferir a nota do lote na Feira', ['signal'], 'invoice', [
    'Lume segura o recibo na direção da luz do balcão. O número falado no rádio está impresso no rodapé.',
    'Lume — Fechei o lote antes de escurecer. Esta nota saiu de novo depois da sua reunião. No verso, carimbaram como se fosse a primeira via.',
    'Kairo — Com quem dá para conferir o horário de chegada?',
    'Lume — Mara anotou os desvios da linha. Se encontrar o terminal fechado, procura Severino na Estação. Ele fica com o controle de entrada do pátio.'
  ], { evidence: 'A nota da Feira foi reemitida depois do horário da reunião. Seu número coincide com a gravação de Nina.' });

  scene('mara', 1, 'terminal', 'Ler o itinerário de Mara', ['invoice'], 'route', [
    'Mara — Haviam fechado a curva. Eu desviei pelo pátio, escrevi o trajeto no caderno e dei uma cópia para Kira.',
    'Ela coloca o caderno de serviço e o bilhete anotado lado a lado. A equipe de manutenção aguardava no ponto do trajeto novo.',
    'Kairo — Então a equipe sabia do desvio antes de eu chegar.',
    'Mara — Pode anotar isso. Os nomes das pessoas que eu levei de volta ficam comigo.'
  ], { when: 'maraWindow', evidence: 'O itinerário corrigido de Mara coloca a equipe no pátio por onde Kairo chegou. A cópia de Kira traz o desvio.' });

  scene('guard', 1, 'kira', 'Conferir a entrada com Severino', ['invoice'], 'route', [
    'Severino abre o livro do pátio. Duas entradas estão abaixo do número do lote da Feira.',
    'Severino — Trouxeram o bilhete corrigido para justificar a entrada. Eu anotei a placa antes de abrir o portão.',
    'Severino — Lembra dos Terminais Portáteis de Diagnóstico de Malha? A equipe da Vértice usava esses decks para simular carga e intrusão nos medidores. Agora até o portão registra a assinatura deles.',
    'Kairo confere o horário. A equipe já estava no pátio quando o ônibus fez o desvio.'
  ], { evidence: 'O livro de Severino confirma a entrada pelo pátio antes da chegada de Kairo. A equipe mostrou o itinerário corrigido.' });

  scene('kiraDeal', 1, 'kira', 'Ouvir Kira sobre a rota vendida', ['route'], 'kiraDeal', [
    'Kira — Aqui na Estação, um duelo disputa o controle administrativo de um nó em tempo real. O Ringue deu o nome NeonClash para o que os técnicos já carregavam no bolso.',
    'Kairo — Pulso força a carga, Malha contém o impacto e Sombra procura a brecha. Quem segura o nó decide qual protocolo fica de pé.',
    ...dialogue[1]
  ], {
    choices: [
      { id: 'duel', label: 'Disputar a cópia em duelo' },
      { id: 'delivery', label: 'Aceitar o favor de conferir o recibo na Feira', finale: 'kiraPeace' }
    ]
  });

  scene('delivery', 1, 'market', 'Conferir o recibo anonimizado com Beto', ['kiraDeal'], 'delivery', [
    'Beto compara o valor e a data com a via da banca. O nome dos passageiros está coberto nas duas cópias.',
    'Beto — A dívida entrou quitada e reapareceu num recibo novo. Quem fez isso usou o código do equipamento da Estação.',
    'No verso, Beto encontra o carimbo de um terminal antigo do Ringue. Kairo guarda o código para conferir com Leila.',
    'Beto — O irmão da Kira precisava de tratamento na Clínica do Morro. Ela estava vendendo qualquer rota que pagasse pelo próximo atendimento.'
  ], { when: 'kiraDelivery', minutes: 25 });

  scene('kiraAudit', 1, 'ringArchive', 'Cruzar o código do terminal com Leila', ['delivery'], 'kiraAudit', [
    'Leila compara o carimbo com o livro de apostas. O código pertence a um terminal desativado.',
    'Leila — A dívida do irmão já estava quitada. Quem cobrou de novo usou o número antigo e lançou o dinheiro por fora do caixa. Aqui está a cópia sem os nomes dos apostadores.'
  ], { when: 'kiraDelivery', minutes: 20 });

  scene('kiraPeace', 1, 'kira', 'Entregar o dossiê auditado a Kira', ['kiraAudit'], 'kiraProof', [
    'Kairo entrega a via de Beto com a conferência de Leila. Kira compara o carimbo com o recibo da rota e reconhece a quitação do tratamento do irmão.',
    'Kira — O projeto da Vértice pagou a rota por fora do Ringue. Me fizeram vender teu trajeto por uma conta que já estava paga. Guarda a prova e leva meu rastreador. Se a Torre fechar em volta de você, chama no rádio.'
  ], { when: 'kiraDelivery', next: true, ally: 'kira', reward: { credits: 35, card: 'exploit_15' },
    evidence: 'O dossiê auditado comprova que o pagamento da rota saiu da verba da Vértice e entrou por fora do caixa do Ringue.' });

  scene('kiraProof', 1, 'kira', 'Registrar a prova da Estação', ['kiraDeal'], 'kiraProof', [
    'Kira passa o recibo sem a lista de passageiros. A autorização de pagamento pertence ao projeto de recuperação da Estação.',
    'Kira — Risco já tinha dado minha dívida por paga. Se esse recibo existir no livro dele, a gente sabe onde ela foi aberta de novo.',
    'Kairo guarda os dois horários no diário. Eles explicam quem pagou a rota e quando a equipe chegou; ainda falta a ordem da emboscada.'
  ], { when: 'kiraResolution', next: true, evidence: 'O pagamento da rota saiu da verba de recuperação da Estação vinculada à Vértice.' });

  scene('ringLedger', 2, 'ringArchive', 'Conferir o livro de apostas com Leila', ['kiraProof'], 'ringLedger', [
    'Risco deixa uma página marcada. A dívida de Kira está quitada no fechamento do livro.',
    'Leila — O segundo recibo não entrou na caixa do Ringue. Veio pronto num envelope de quem pagava a reforma.',
    'Kairo retira os nomes dos apostadores da cópia. A cobrança reaparece com o mesmo número do lote.'
  ], { evidence: 'O livro do Ringue confirma que a dívida original de Kira já estava quitada quando outra cobrança surgiu.' });

  scene('iris', 2, 'garage', 'Comparar as duas versões com Íris', ['ringLedger'], 'versions', dialogue[2],
    { minutes: 25, evidence: 'Íris separa a rotina que pedia visita da alteração que apagava endereços. Kairo assinou a remessa.' });

  scene('ada', 2, 'clinic', 'Visitar a casa atendida pela Clínica', ['versions'], 'outages', [
    'Ravi oferece a bateria provisória ao morador. Ada pede autorização para registrar o horário em que o aparelho parou.',
    'Ada — O atendimento continua aqui. No relatório da Vértice, a casa deixou de contar como atendida. Consegue olhar a hora em que trocaram o programa?',
    'Kairo compara as duas anotações. A troca aconteceu antes de as ocorrências da rua desaparecerem da fila.',
    'Ada — Guarde a hora e a identificação do aparelho. Se quiser usar o nome de alguém, volta aqui e pergunta.'
  ], { evidence: 'Os horários da Clínica ligam falhas reais de equipamentos a endereços excluídos após a troca da regra.' });

  scene('tellingNair', 2, 'home', 'Decidir o que contar a Dona Nair', ['outages'], 'nairChoice', [
    'Os recibos estão de volta à mesa. Kairo pode contar que sua assinatura aparece na remessa ou deixar a explicação para depois da conferência no Cais.',
    'Nair — Se você já sabe como a gente saiu da lista, senta. Eu tenho tempo pra uma resposta inteira.'
  ], { next: true, choices: [
    { id: 'tell', label: 'Explicar agora o que assinei', reaction: 'Nair puxa uma cadeira. Ela anota o que falta provar e reúne os vizinhos. A Feira e o Quiosque dão 20% de desconto nos consumíveis para ajudar Kairo a continuar.' },
    { id: 'check', label: 'Combinar voltar depois da conferência', reaction: 'Nair empresta os recibos até a visita ao Cais. Ela deixa o espaço em branco. Vai guardar os comprovantes, mas quer ouvir de Kairo o que aconteceu.' }
  ] });

  scene('pass', 3, 'archive', 'Pedir a janela de manutenção a Raquel', ['nairChoice'], 'pass', [
    'Raquel encontra a lista dos plantonistas e separa as páginas que o terminal de manutenção pode copiar.',
    'Raquel — Cipher reabriu uma linha da Clínica e perdeu o acesso por uma noite. Tem uma cópia da decisão aqui.',
    'O diário anota onde Cipher está e a próxima janela em que Raquel pode ajudar.'
  ], { evidence: 'A equipe de Cipher já contestou o corte da Clínica. A auditoria interna interrompeu essa ação.' });

  scene('cipherDeal', 3, 'cipher', 'Ouvir Cipher antes de abrir o cofre', ['pass'], 'cipherDeal', dialogue[3],
    { choices: [{ id: 'duel', label: 'Disputar o acesso no terminal' }, { id: 'supervised', label: 'Combinar retirada supervisionada com Raquel', finale: 'cipherPeace' }] });

  scene('cipherAlt', 3, 'archive', 'Solicitar a janela de manutenção isolada', ['cipherDeal'], 'cipherAlt', [
    'Raquel encontra um horário em que a ordem pode ser copiada sem passar pela auditoria.',
    'Raquel — Falta o token de isolamento óptico. Leva essa peça para Íris. Se o filtro ficar certo, as credenciais continuam no cofre.'
  ], { when: 'cipherAlternative', minutes: 25 });

  scene('cipherToken', 3, 'garage', 'Calibrar o filtro de isolamento com Íris', ['cipherAlt'], 'cipherToken', [
    'Íris testa o filtro em uma ficha antiga. O número da ordem atravessa o leitor. Os nomes ficam do outro lado.',
    'Íris — Agora leva o token para a Muralha. Foram esses técnicos que mantiveram as bombas e a Clínica ligadas durante as enchentes. O nome deles fica no cofre.'
  ], { when: 'cipherAlternative', minutes: 25 });

  scene('cipherPeace', 3, 'cipher', 'Executar a extração isolada', ['cipherToken'], 'cipherProof', [
    'Raquel conecta o token. Cipher passa as duas versões pela janela isolada. As credenciais ficam no cofre.',
    'Cipher — A primeira suspende seu acesso. A segunda inclui um recolhimento. O anexo que sumiu estava ligado a uma reserva no Hotel Espelho. Leva o número a Cris. Quando chegar à Torre, eu ainda tenho acesso à primeira camada de defesa do Eclipse.'
  ], { when: 'cipherAlternative', followup: 'meridianoRadio', ally: 'cipher', reward: { credits: 50, card: 'exploit_16' },
    evidence: 'A cópia isolada preserva as duas versões da ordem sem divulgar as credenciais. O anexo ausente aponta para o Hotel Espelho.' });

  scene('cipherProof', 3, 'cipher', 'Registrar as duas versões da ordem', ['cipherDeal'], 'cipherProof', [
    'A ordem de Cipher manda suspender o acesso de Kairo. A segunda versão tem um anexo de recolhimento que desapareceu do cofre.',
    'Cipher — Esse recibo de reserva foi anexado quando passaram a ordem para outra equipe. Leva o número para Cris antes de tentar abrir o registro todo.'
  ], { when: 'cipherResolution', followup: 'meridianoRadio', evidence: 'O cofre contém versões diferentes da mesma ordem. O anexo que falta aponta para uma reserva no Hotel Espelho.' });

  scene('meridianoRadio', 3, 'cipher', 'Interceptação de Rádio', ['cipherProof'], 'meridianoContact', [
    'A frequência privada de Kairo acorda com três estalos. Era o sinal da equipe de manutenção durante as enchentes.',
    'Archon — Lembra da bateria que mandamos para a rua da Nair? A Holding Meridiano, nossa diretoria externa, me deu até sexta para cortar os endereços deficitários. Se eu não entregasse os números, cancelariam a concessão. Toda Baixa Luz ficaria no escuro.',
    'Kairo — Você tirou as casas da lista para o contrato fechar. Lá embaixo a gente continuou atendendo gente que, para a diretoria, tinha deixado de existir.',
    'Archon — Eu sabia o que custava perder a equipe inteira. Achei que podia escolher quais ruas manter. Segue o recibo da reserva, Kairo. Depois me diz quem mais assinou.'
  ], { next: true, evidence: 'A Holding Meridiano exigiu cortes até sexta-feira sob pena de cancelar a concessão. Archon admitiu excluir endereços para manter o contrato.' });

  scene('cris', 4, 'pension', 'Comparar as fichas de reserva com Cris', ['cipherProof'], 'reservation', [
    'Cris põe uma ficha de reserva sem entrada efetiva do lado do recibo usado para acolher Kairo.',
    'Cris — Uma reserva anuncia que alguém pode chegar. A entrada diz que alguém pediu um quarto. A sua ficha veio com outro nome porque eu queria que você dormisse sem visita.',
    'Ela mostra como identificar o quarto mantido vazio no Hotel Espelho sem entregar o nome de nenhum hóspede.'
  ], { evidence: 'A reserva do Hotel Espelho era um ponto de encontro. O registro não mostra uma pessoa hospedada ali.' });

  scene('vexDeal', 4, 'vex', 'Negociar acesso à ordem original', ['reservation'], 'vexDeal', [
    'Vex aponta para o corredor cheio e propõe mostrar o anexo fora dali.',
    'Vex — Guardei a cópia original porque a hora da ordem me chamou atenção. Posso colocar a cópia na mesa em duelo. Celina também tem uma sala, se você levar o arquivo junto com Bia.',
    'Kairo pode escolher quem testemunha a entrega. A lista de hóspedes fica no hotel.'
  ], { aside: { label: 'Perguntar quanto vale uma testemunha',
    reply: 'Kairo — Você vendia silêncio por diária. Quanto vale uma testemunha hoje? Vex — Se ela voltar viva pra casa, hoje vale mais que qualquer contrato.' },
    choices: [{ id: 'duel', label: 'Disputar a entrega em duelo' }, { id: 'witness', label: 'Pedir uma entrega testemunhada no Teatro', finale: 'vexPeace' }] });

  scene('vexStub', 4, 'pension', 'Levantar o canhoto da reserva com Cris', ['vexDeal'], 'vexStub', [
    'Cris separa o canhoto da reserva sem hospedagem dos recibos de quem realmente dormiu na pensão.',
    'Cris — Esse número e esse horário bastam para Bia conferir a cópia. Os nomes dos hóspedes ficam aqui.'
  ], { when: 'vexAlternative', minutes: 20 });

  scene('vexAlt', 4, 'theatre', 'Conferir o horário do arquivo com Bia', ['vexStub'], 'vexAlt', [
    'Celina abre a sala neutra do Teatro. Vex escondeu Helena ali depois que a ex-auditora descobriu a fraude da Holding Meridiano. Bia compara o selo de horário do arquivo com o canhoto de Cris.',
    'Helena — Bia assina a conferência comigo. Leva esta chave complementar para Vex. Ela abre o anexo de horário sem expor os hóspedes.'
  ], { when: 'vexAlternative', minutes: 25 });

  scene('vexPeace', 4, 'vex', 'Apresentar a conferência testemunhada a Vex', ['vexAlt'], 'vexProof', [
    'Vex lê a conferência assinada por Bia e Helena. A chave complementar autentica o anexo e ele libera o original. O aviso de baixa já estava pronto antes de Kairo perder o sinal.',
    'Vex — A assinatura de Archon está aqui, na ordem de recolher sua cópia. A Auditora pode te ajudar na Torre. Depois leva a via de Helena à Isa: os números alcançam gente acima do Archon.'
  ], { when: 'vexAlternative', next: true, ally: 'vex', reward: { credits: 65, card: 'unit_31' },
    evidence: 'O canhoto, a confirmação testemunhada e a ordem original mostram que a baixa precedeu a emboscada. Archon assinou o recolhimento.' });

  scene('vexProof', 4, 'vex', 'Ler a ordem original com Vex', ['vexDeal'], 'vexProof', dialogue[4],
    { when: 'vexResolution', next: true, evidence: 'O aviso de baixa de Kairo precede o incidente. A ordem de recolher sua cópia traz a assinatura de Archon.' });

  scene('renan', 5, 'docks', 'Reproduzir os dois comandos com Renan', ['vexProof'], 'grid', [
    'Renan carrega uma cópia isolada do painel. Kairo digita o número do medidor de Dona Nair.',
    'Na primeira versão, o endereço entra na fila de verificação. Na segunda, some da lista e o painel permite desligá-lo.',
    'Renan — Os anexos da Holding Meridiano mostram o que Archon fez para manter a concessão. Contou como estáveis os bairros ricos e apagou da amostra as ruas em que a gente mais precisou trocar bateria.',
    'Renan — Eu consigo transferir o controle. A clínica precisa de uma bateria carregada e a equipe precisa de um canal para confirmar cada linha.',
    'Kairo anota duas rotas para a comunicação: a Antena ou a entrega do arquivo à Isa na praça.'
  ], { evidence: 'No painel isolado, a versão nova exclui o endereço e permite seu corte. O Cais confirmou como transferir o controle.' });

  scene('reserve', 5, 'clinic', 'Preparar a reserva de energia da Clínica', ['grid'], 'reserve', [
    'Ada confere as baterias com Omar e escolhe a que vai permanecer na casa durante a troca.',
    'Kairo deixa os horários em papel. Se a luz falhar, a equipe tem como ler os passos mesmo sem o painel.'
  ], { minutes: 25 });

  scene('radio', 5, 'relay', 'Reservar o canal com Nina', ['grid'], 'communication', [
    'Nina oferece alguns minutos de transmissão para a troca, intercalados com as chamadas de emergência.',
    'Ela reserva uma cópia física do plano para o próximo plantão. Os depoimentos autorizados ficam num arquivo separado.'
  ]);

  scene('press', 5, 'square', 'Entregar a cópia de transição à Isa', ['grid'], 'communication', [
    'Isa confere quais nomes vieram com autorização e imprime uma via de serviço sem os dados pessoais.',
    'Ela leva a cópia à equipe que vai acompanhar a mudança. Kairo pode seguir para o balcão da Torre.'
  ], { minutes: 20 });

  scene('registry', 5, 'registry', 'Pedir a Nalva o histórico do cadastro', ['reserve', 'communication'], 'protocol', [
    'Nalva confere o recibo de Dona Nair e emite o histórico do endereço de Kairo com um número de pedido.',
    'Nalva — A Holding Meridiano recebeu o relatório alterado. No arquivo original, a ordem manda cortar primeiro os endereços mais pobres. A pressão da diretoria está assinada no protocolo.',
    'Nalva — Esse número fica com você. Se alguém oferecer uma segunda via por fora, pergunta se o prédio inteiro voltou a constar.',
    'Kairo guarda o protocolo e segue para a Torre. A equipe já tem reserva e canal de confirmação.'
  ], { evidence: 'O protocolo de Nalva preserva o histórico original do endereço e permite contestar a baixa com os documentos reunidos.' });

  const archonWarning = 'Archon exige um duelo obrigatório. Antes de subir, revise seu baralho de 20 cartas e confira se tem energia para o confronto.';
  scene('archonPrep', 5, 'archon', 'Confirmar preparação para a Torre', ['protocol'], 'archonReady', [
    archonWarning
  ]);

  scene('archonDeal', 5, 'archon', 'Confrontar Archon com os documentos', ['archonReady'], 'archonDeal', [
    ...dialogue[5],
    'Kairo conecta seu Terminal Portátil de Diagnóstico ao barramento central. Renan aguarda no Cais para receber o controle da rede elétrica.',
    'No console mestre da diretoria, Archon aciona o Núcleo Eclipse, a IA Autônoma de Contenção Corporativa. A máquina trava a transferência e assume a defesa do barramento.',
    'Archon — Você está usando o protocolo de campo que eu te ensinei contra a própria malha central, Kairo!'
  ], { aside: { label: 'Perguntar quanto vale uma rua no balanço',
    reply: 'Kairo — Qual era a cotação de uma rua no seu balanço? Archon — Menos que uma concessão na sexta. Mais do que consigo admitir olhando para você.' } });

  scene('ending', 5, 'archon', 'Decidir como divulgar as provas', ['archonDeal'], 'ending', [
    'O Núcleo Eclipse perdeu o controle do barramento. Kairo confirma a transferência e Renan assume a rede elétrica. Nina e Isa esperam para saber quais provas vão circular e quando.',
    'Kairo separa os textos autorizados dos registros pessoais. A equipe pode divulgar agora com o plano de transição, entregar os arquivos a um conselho ou aceitar a regularização limitada oferecida por Archon.'
  ], { when: 'archonWon', next: true, choices: [
    { id: 'publish', label: 'Publicar com transição comunitária', reaction: 'Isa distribui a primeira edição na praça. A Clínica continua ligada durante a troca de controle.' },
    { id: 'council', label: 'Entregar as provas ao conselho dos bairros', reaction: 'Os depoimentos ficam sob guarda enquanto os bairros combinam a transição. Isa marca uma data para cobrar o próximo relatório.' },
    { id: 'settle', label: 'Aceitar a regularização limitada', reaction: 'O endereço de Kairo volta à lista. Dona Nair guarda as cópias dos outros pedidos para uma nova audiência.' }
  ] });

  scene('epilogue', 6, 'home', 'Voltar à Casa e falar com Dona Nair', ['ending'], 'epilogue', [
    'A chave antiga ainda serve. Dentro de casa, Dona Nair pede para Kairo escrever a nova leitura do contador no verso do primeiro recibo.',
    'Kira compartilhou os horários que pode divulgar. A Pensão continua aberta, com o registro de hóspedes sob guarda de Cris. Vex deixou uma via protegida para as testemunhas. A escala de Cipher foi devolvida à equipe que acompanha a transição.',
    'Nair coloca outra solicitação sobre a mesa. Desta vez, há lugar para anotar o que a cidade respondeu.'
  ]);

  const alliedLines = {
    preparation: 'Kira — Os drones foram atrás do sinal da minha sub-rede. Fica onde está e respira. Quando eu abrir a passagem, você sobe. Kairo recupera até 10 de energia sem gastar tempo nem créditos.',
    isa: 'Isa compara a chave de Helena ao relatório. Já pode mostrar que a Holding Meridiano recebeu números adulterados e acompanhou a ordem de corte.',
    publish: 'A edição inclui os horários certificados por Helena. A investigação alcança a Holding Meridiano, e a diretoria externa é chamada a explicar a ordem de corte.',
    council: 'O conselho protege o depoimento de Helena e usa a via certificada para convocar a Holding Meridiano. A auditoria passa dos escritórios de Archon à diretoria externa.',
    settle: 'Mesmo com o acordo limitado, Isa protocola a prova de Helena. Há uma investigação separada sobre a Holding Meridiano, com o relatório original anexado.',
    tell: 'Dona Nair põe o protocolo ao lado da assinatura. Os vizinhos trazem as próprias contas para ajudar a conferir as próximas casas. Nair — Você não veio prometer que ia dar conta sozinha. Você veio contar a verdade. Foi assim que deu pra gente chegar junto.',
    check: 'Dona Nair abre a página que deixou em branco. Nair — Nesse tempo todo eu fiquei imaginando que parte você achava que eu não aguentava ouvir. Fala agora. Ainda dá para começar a devolver a confiança.'
  };

  const comicPortraits = {
    kairo: { name: 'Kairo', art: './src/assets/kairo-token.webp' },
    nair: { name: 'Dona Nair', art: './avatars/nair.webp' },
    nina: { name: 'Nina', art: './avatars/nina.png' },
    lume: { name: 'Lume', art: './avatars/lume.png' },
    beto: { name: 'Beto', art: './avatars/beto.webp' },
    mara: { name: 'Mara' },
    severino: { name: 'Severino' },
    leila: { name: 'Leila' },
    kira: { name: 'Kira', art: './avatars/kira.png' },
    cipher: { name: 'Cipher', art: './avatars/cipher.png' },
    archon: { name: 'Archon', art: './avatars/archon.png' }
  };
  const prologueBeats = [
    { camera: 'wide', mood: 'memory' },
    { camera: 'pan-left', mood: 'tense' },
    { camera: 'zoom-in', mood: 'revelation' }
  ];

  const evidenceArt = (file, artTitle) => ({
    art: `./src/assets/comic/${file}.webp`, artTitle,
    camera: 'zoom-in', mood: 'revelation', bubbleType: 'evidence'
  });
  const kiraReceipt = evidenceArt('terminal-de-kira', 'O terminal e o recibo de Kira');
  const opticalFilter = evidenceArt('filtro-optico', 'O filtro óptico de Íris');
  const theatreProof = evidenceArt('conferencia-no-teatro', 'A conferência nos bastidores do Teatro');

  const beats = {
    kiraPeace: [kiraReceipt, { speaker: 'kira', bubbleType: 'speech', expression: 'whisper' }],
    kiraProof: [kiraReceipt, { speaker: 'kira', bubbleType: 'speech' }],
    cipherToken: [opticalFilter],
    cipherPeace: [{ ...opticalFilter, camera: 'focus-detail', focus: 'center', mood: 'tense' },
      { speaker: 'cipher', bubbleType: 'speech' }],
    vexAlt: [theatreProof],
    archonDeal: [
      ...Array(dialogue[5].length),
      { art: './src/assets/comic/barramento-vertice.webp', artTitle: 'O barramento central da Torre Vértice',
        camera: 'wide', mood: 'tense' },
      { art: './src/assets/comic/barramento-vertice.webp', camera: 'focus-detail', focus: 'center', mood: 'revelation' },
      { speaker: 'archon', expression: 'alert', bubbleType: 'speech', mood: 'tense' }
    ],
    keys: [
      { camera: 'wide', mood: 'tense', bubbleType: 'thought',
        art: './src/assets/comic/leitor-da-porta.webp', artTitle: 'O leitor da porta de Kairo',
        interact: { type: 'tap-device', label: 'Testar a chave no leitor', pos: 'bottom-right' },
        sfxVisual: { text: 'BIP-BIP', style: 'electric', pos: 'top-right', sound: 'beep' } },
      { camera: 'pan-right', mood: 'memory' }
    ],
    nair: [
      { camera: 'wide', speaker: 'nair', bubbleType: 'speech' },
      { camera: 'zoom-in', speaker: 'kairo', bubbleType: 'speech', mood: 'tense' },
      { camera: 'pan-left', speaker: 'nair', bubbleType: 'speech', expression: 'whisper' },
      { camera: 'wide', mood: 'revelation', bubbleType: 'evidence',
        art: './src/assets/comic/recibo-molhado.webp', artTitle: 'O recibo molhado de Dona Nair',
        interact: { type: 'wipe', label: 'Limpar o recibo molhado' } },
      { camera: 'zoom-in', speaker: 'kairo', expression: 'shock', bubbleType: 'speech', mood: 'revelation' },
      { camera: 'wide', speaker: 'nair', bubbleType: 'speech' }
    ],
    firstSignal: [
      { camera: 'focus-detail', focus: 'top-left', mood: 'radio', speaker: 'nina', expression: 'radio', bubbleType: 'radio',
        art: './src/assets/comic/radio-da-antena.webp', artTitle: 'O rádio da Antena Comunitária', interact: { type: 'tune', label: 'Sintonizar o rádio de Nina', target: 64 },
        sfxVisual: { text: 'BZZT!', style: 'electric', pos: 'top-right', sound: 'glitch' } },
      { camera: 'pan-right', mood: 'radio', speaker: 'nina', expression: 'radio', bubbleType: 'radio' },
      { camera: 'zoom-in', speaker: 'kairo', bubbleType: 'speech' },
      { camera: 'wide', mood: 'revelation', speaker: 'nina', bubbleType: 'radio' }
    ],
    invoice: [
      { camera: 'wide', mood: 'neutral' },
      { camera: 'focus-detail', focus: 'center', mood: 'revelation', speaker: 'lume', expression: 'alert', bubbleType: 'speech' },
      { camera: 'pan-left', speaker: 'kairo', bubbleType: 'speech' },
      { camera: 'zoom-in', speaker: 'lume', expression: 'secret', bubbleType: 'speech' }
    ],
    delivery: [
      { camera: 'wide', mood: 'memory' },
      { camera: 'zoom-in', speaker: 'beto', expression: 'whisper', bubbleType: 'speech' },
      { camera: 'focus-detail', focus: 'center', mood: 'revelation', bubbleType: 'evidence' },
      { camera: 'pan-right', speaker: 'beto', bubbleType: 'speech', mood: 'tense' }
    ],
    guard: [{ camera: 'wide' }, { camera: 'pan-right', mood: 'tense' }, { camera: 'focus-detail', focus: 'center' }],
    kiraDeal: [
      { camera: 'wide', speaker: 'kira', bubbleType: 'speech', mood: 'tense' },
      { camera: 'zoom-in', speaker: 'kairo', bubbleType: 'speech' },
      { camera: 'pan-left', mood: 'memory' },
      { camera: 'focus-detail', focus: 'center', speaker: 'kira', expression: 'alert', bubbleType: 'speech' }
    ],
    meridianoRadio: [
      { camera: 'wide', mood: 'radio', sfxVisual: { text: 'TRRRIM…', style: 'electric', pos: 'top-right', sound: 'glitch' } },
      { camera: 'zoom-in', mood: 'radio', speaker: 'archon', expression: 'radio', bubbleType: 'radio' }
    ]
  };
  const comicLocations = {
    relay: { art: './src/assets/comic/radio-da-antena.webp', artTitle: 'O rádio da Antena Comunitária' },
    market: { art: './src/assets/comic/feira-de-lume.webp', artTitle: 'A banca de Lume na Feira' },
    kira: { art: './src/assets/comic/estacao-fantasma.webp', artTitle: 'O portão da Estação Fantasma' }
  };
  for (const scene of scenes) {
    scene.comicArt = comicLocations[scene.location];
    if (beats[scene.id]) scene.beats = beats[scene.id];
    else if (scene.chapter < 2) scene.beats = [
      { camera: 'wide' }, { camera: 'zoom-in', mood: 'tense' },
      { camera: 'focus-detail', focus: 'center', mood: 'revelation' }
    ];
  }

  NB.StoryData = { chapters, scenes, archonWarning, prologue, alliedLines, prologueBeats, comicPortraits };
})(window.NB = window.NB || {});
