(function (NB) {
  'use strict';

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
    'Kairo confere o horário. A equipe já estava no pátio quando o ônibus fez o desvio.'
  ], { evidence: 'O livro de Severino confirma a entrada pelo pátio antes da chegada de Kairo. A equipe mostrou o itinerário corrigido.' });

  scene('kiraDeal', 1, 'kira', 'Ouvir Kira sobre a rota vendida', ['route'], 'kiraDeal', dialogue[1], {
    choices: [
      { id: 'duel', label: 'Disputar a cópia em duelo' },
      { id: 'delivery', label: 'Aceitar o favor de conferir o recibo na Feira' }
    ]
  });

  scene('delivery', 1, 'market', 'Conferir o recibo anonimizado com Beto', ['kiraDeal'], 'delivery', [
    'Beto compara o valor e a data com a via da banca. O nome dos passageiros está coberto nas duas cópias.',
    'Beto — A dívida entrou quitada e reapareceu num recibo novo. Quem fez isso usou o código do equipamento da Estação.',
    'Ele entrega a via conferida. Kairo pode levá-la de volta a Kira.'
  ], { when: 'kiraDelivery', minutes: 35 });

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
    { id: 'tell', label: 'Explicar agora o que assinei', reaction: 'Nair puxa uma cadeira. Ela anota o ponto que ainda falta provar e pede uma cópia para a reunião dos moradores.' },
    { id: 'check', label: 'Combinar voltar depois da conferência', reaction: 'Nair empresta os recibos até a visita ao Cais. Ela reserva um espaço em branco para a resposta de Kairo.' }
  ] });

  scene('pass', 3, 'archive', 'Pedir a janela de manutenção a Raquel', ['nairChoice'], 'pass', [
    'Raquel encontra a lista dos plantonistas e separa as páginas que o terminal de manutenção pode copiar.',
    'Raquel — Cipher reabriu uma linha da Clínica e perdeu o acesso por uma noite. Tem uma cópia da decisão aqui.',
    'O diário anota onde Cipher está e a próxima janela em que Raquel pode ajudar.'
  ], { evidence: 'A equipe de Cipher já contestou o corte da Clínica. A auditoria interna interrompeu essa ação.' });

  scene('cipherDeal', 3, 'cipher', 'Ouvir Cipher antes de abrir o cofre', ['pass'], 'cipherDeal', dialogue[3],
    { choices: [{ id: 'duel', label: 'Disputar o acesso no terminal' }, { id: 'supervised', label: 'Combinar retirada supervisionada com Raquel' }] });

  scene('cipherAlt', 3, 'archive', 'Retirar a cópia supervisionada', ['cipherDeal'], 'cipherAlt', [
    'Raquel passa a ordem pelo terminal isolado. A coluna de credenciais pessoais fica no original.',
    'A cópia chega com o mesmo número da ordem e dois horários. Há um anexo ausente, associado a uma reserva no Hotel Espelho.'
  ], { when: 'cipherAlternative', minutes: 40 });

  scene('cipherProof', 3, 'cipher', 'Registrar as duas versões da ordem', ['cipherDeal'], 'cipherProof', [
    'A ordem de Cipher manda suspender o acesso de Kairo. A segunda versão tem um anexo de recolhimento que desapareceu do cofre.',
    'Cipher — Esse recibo de reserva foi anexado quando passaram a ordem para outra equipe. Leva o número para Cris antes de tentar abrir o registro todo.'
  ], { when: 'cipherResolution', next: true, evidence: 'O cofre contém versões diferentes da mesma ordem. O anexo que falta aponta para uma reserva no Hotel Espelho.' });

  scene('cris', 4, 'pension', 'Comparar as fichas de reserva com Cris', ['cipherProof'], 'reservation', [
    'Cris põe uma ficha de reserva sem entrada efetiva do lado do recibo usado para acolher Kairo.',
    'Cris — Uma reserva anuncia que alguém pode chegar. A entrada diz que alguém pediu um quarto. A sua ficha veio com outro nome porque eu queria que você dormisse sem visita.',
    'Ela mostra como identificar o quarto mantido vazio no Hotel Espelho sem entregar o nome de nenhum hóspede.'
  ], { evidence: 'A reserva do Hotel Espelho era um ponto de encontro. O registro não mostra uma pessoa hospedada ali.' });

  scene('vexDeal', 4, 'vex', 'Negociar acesso à ordem original', ['reservation'], 'vexDeal', [
    'Vex aponta para o corredor cheio e propõe mostrar o anexo fora dali.',
    'Vex — Guardei a cópia original porque a hora da ordem me chamou atenção. Posso colocar a cópia na mesa em duelo. Celina também tem uma sala, se você levar o arquivo junto com Bia.',
    'Kairo pode escolher quem testemunha a entrega. A lista de hóspedes fica no hotel.'
  ], { choices: [{ id: 'duel', label: 'Disputar a entrega em duelo' }, { id: 'witness', label: 'Pedir uma entrega testemunhada no Teatro' }] });

  scene('vexAlt', 4, 'theatre', 'Acompanhar Bia na entrega do arquivo', ['vexDeal'], 'vexAlt', [
    'Celina abre a sala de ensaio vazia. Bia entrega a chave e fica ao lado de Kairo enquanto a data do arquivo é conferida.',
    'O anexo fica pronto para leitura com Vex. A cópia de circulação ainda omite os nomes de quem estava sendo protegido.'
  ], { when: 'vexAlternative', minutes: 30 });

  scene('vexProof', 4, 'vex', 'Ler a ordem original com Vex', ['vexDeal'], 'vexProof', dialogue[4],
    { when: 'vexResolution', next: true, evidence: 'O aviso de baixa de Kairo precede o incidente. A ordem de recolher sua cópia traz a assinatura de Archon.' });

  scene('renan', 5, 'docks', 'Reproduzir os dois comandos com Renan', ['vexProof'], 'grid', [
    'Renan carrega uma cópia isolada do painel. Kairo digita o número do medidor de Dona Nair.',
    'Na primeira versão, o endereço entra na fila de verificação. Na segunda, some da lista e o painel permite desligá-lo.',
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
    'Nalva — Esse número fica com você. Se alguém oferecer uma segunda via por fora, pergunta se o prédio inteiro voltou a constar.',
    'Kairo guarda o protocolo e segue para a Torre. A equipe já tem reserva e canal de confirmação.'
  ], { evidence: 'O protocolo de Nalva preserva o histórico original do endereço e permite contestar a baixa com os documentos reunidos.' });

  scene('archonDeal', 5, 'archon', 'Confrontar Archon com os documentos', ['protocol'], 'archonDeal', dialogue[5]);

  scene('ending', 5, 'archon', 'Decidir como divulgar as provas', ['archonDeal'], 'ending', [
    'O duelo terminou. Renan pede a confirmação para assumir a operação. Nina e Isa esperam para saber quais provas vão circular e quando.',
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

  NB.StoryData = { chapters, scenes };
})(window.NB = window.NB || {});
