# NeonClash — referência técnica

Retrato da implementação após a atualização narrativa do Núcleo Eclipse. Para acompanhar a história passo a passo, consulte o [guia da aventura](aventura-baixa-luz.md). O [plano de expansão](plano-expansao.md) documenta metas futuras.

## Produto e superfícies

NeonClash é um jogo solo em português que combina exploração urbana, investigação e duelos de cartas contra IA. A protagonista Kairo circula por Baixa Luz e confronta a Vértice. Os mesmos arquivos do jogo rodam no navegador e na WebView do APK Android. O jogo usa dados e recursos empacotados, com progresso local por instalação ou origem do navegador.

| Superfície | Comportamento |
| --- | --- |
| Início | Exibe progresso, início da aventura, duelo rápido, coleção, galeria e volume/configurações. A primeira entrada na aventura apresenta três quadros do prólogo. Concluir ou pular marca a apresentação no save e inicia a investigação com a Casa de Kairo em destaque. |
| Cidade | Área rolável com relógio, créditos, energia, mapa, legenda com filtros e detalhes. A barra inferior usa ícones com nomes acessíveis para Mapa, Investigação, Bairros, Mochila, Pistas, Meu Deck e Configurações. O retorno ao início fica dentro de Configurações. |
| Investigação | Mostra passos disponíveis, viagens até os locais, cenas paginadas com retomada, decisões e provas já reunidas. O diário separa missão principal e missões secundárias e informa próximo local, contato e prêmios já recebidos. |
| Mercado e oficina | Compra de cartas na Feira. A oficina de Lume tem vitrine ilustrada das unidades possuídas, prévia de afinidade e confirmação. |
| Duelo | Dossiê com voltar ou iniciar, tabuleiro com três posições por lado, mão, visor de cartas, indicação de fase, previsão de defesa e tela de estatísticas/recompensas. |
| Coleção | Busca textual sem distinção de acentos, filtros, três baralhos, autocompletar e inspetor ampliado. |
| Galeria | Reúne cenas, retratos e cartas vistas, com visualização sem recorte e descrição. Acessível pelo menu inicial. |
| Configurações | Som geral, volume independente para música e efeitos e confirmação de reset do progresso. O painel de artes do combate mostra o estado dos recursos. |

## Estrutura e fluxo de execução

`index.html` declara as telas, os controles, os arquivos CSS e a ordem dos scripts `defer`. Os scripts expõem módulos em `window.NB`. A entrada efetiva é `js/main.js`, que carrega o save, inicia a resolução das artes, conecta eventos, prepara o estado inicial e restaura o áudio. A entrada Android acrescenta `?android=1` para solicitar reprodução na abertura. O Vite serve e empacota diretamente a interface HTML, CSS e JavaScript imperativa. O build usa apenas o plugin local de cópia dos arquivos estáticos.

| Camada | Módulos e responsabilidades |
| --- | --- |
| Dados | `js/data/cards.js` contém catálogo, afinidades e palavras-chave. `campaign.js` contém oponentes, baralhos, dossiês e recompensas. `cityAtlas.js` contém bairros, locais e moradores. `city.js` complementa os locais, estoque, rastros e adversários do Ringue. `story.js` contém capítulos, cenas, condições e escolhas. `challenges.js` descreve os desafios e decks emprestados. `dialogue.js` seleciona falas de combate. `music.js` e `soundEffects.js` definem trilhas e timbres. |
| Domínio | `js/core/saveManager.js` normaliza e salva progresso. `cityLife.js` calcula deslocamentos, relógio, descanso e inventário. `story.js` valida pré-requisitos e avança capítulos. `gameState.js` mantém partida, baralhos, mesa, recursos e resultado. `cardEffects.js` resolve efeitos declarativos e estima seu valor para a IA. `combatEngine.js` resolve choques, bloqueios e Overclock. `aiController.js` decide invocações, Exploits, ataques e bloqueios. |
| Interface | `js/ui/inputController.js` orquestra navegação, entrada e confirmação. `renderer.js` atualiza HUD, tabuleiro, mão, visor, dossiê e resultado. `city.js` apresenta o mapa e as ações urbanas. `story.js` implementa prólogo, leitor e diário. `deckBuilder.js` implementa coleção e editor. `gallery.js` detecta e exibe artes vistas. |
| Apresentação | `js/audio/soundEngine.js` agenda música e sintetiza efeitos. `js/physics/fxEngine.js` faz animações, partículas em canvas, feixes, retornos visuais e vibração quando suportada. `js/sprites/proceduralArt.js` resolve artes locais e pode gerar substitutas. `css/` divide base, HUD, cartas, modais, campanha, coleção e cidade. |
| Empacotamento | `vite.config.ts` usa base relativa, agrupa os estilos e copia `src/assets`, `js`, `cards`, `avatars` e `audio` para `dist`. O projeto `android/` usa `dist` como assets do aplicativo. |

Os controles consultam o estado corrente antes de realizar ações. Um duelo tem um identificador de geração em memória. As esperas animadas verificam essa geração para cancelar operações pendentes quando o jogador sai ou começa outra partida. Turnos, seleção, mão, campo, descarte, remoções e histórico de cartas usadas pertencem à partida em memória. Recompensas, gastos, avanço urbano e resultados registrados pertencem ao save.

## Save, migração e preferências

| Chave ou campo | Conteúdo |
| --- | --- |
| `localStorage.neon_breach_save_v1` | Documento JSON do progresso. O carregamento completa campos ausentes, valida IDs de cartas, ajusta limites e reconstrói decks inválidos. |
| Coleção e decks | `unlockedCards`, `customDeck`, `deckSlot` ativo e `deckSlots` para guardar as demais configurações. Os 12 IDs iniciais são preservados. |
| Histórico | `defeatedBosses`, `clues`, `challengeWins`, `wins`, `matches` e `city.residentWins`. `city.encounterWins` guarda as últimas vitórias dos encontros por período. As primeiras vitórias liberam os prêmios próprios. |
| Cidade | `city.credits`, `city.district`, `city.traced` e `city.life`. Vida urbana guarda minutos absolutos, vigília, energia, implante, veículos, estoque, favores, turno do quiosque, contagem diária de trabalhos, entrega ativa e aviso da última ação. |
| Investigação | `prologueSeen` controla a apresentação. `story` guarda ativação, capítulo, flags de passos, escolhas, páginas lidas, cenas de evidência, `allies`, `nairTruthEarly` e a aplicação única de `kiraSupportUsed`. |
| Personalização | `affinities` guarda recalibrações por ID. `seenArt` guarda caminhos dos recursos já visualizados, com deduplicação. |
| Áudio | `neon_breach_sound` guarda `on` ou `off`. `neon_breach_volume` guarda os dois valores de 0 a 100. Ambos têm padrão 70%. |

Uma partida nova começa na Estação Fantasma às 08:00 do dia 1, com 35 créditos, energia 100 e baralho inicial de 20 cartas. O reset da partida geral redefine o progresso da chave de save. As preferências de áudio usam chaves próprias. A galeria começa a coletar imagens quando o recurso é usado. Saves anteriores sem registro da arte passam a incluí-la quando ela reaparece.

## Cidade, tempo e economia

O atlas contém 10 bairros, 23 locais e um elenco ligado a cenas, serviços e duelos. O mapa oferece os 23 locais em posições ilustrativas, com ícones compactos e nomes para o destino ativo, a posição atual e lugares destacados. **Bairros** filtra o próprio mapa. Uma viagem tem cotação e execução. Abrir a cotação não cobra nem avança o relógio. Ao escolher transporte, o motor verifica disponibilidade, cobra a tarifa, salva a posição de destino e aplica tempo e energia.

A distância é `max(2, ceil(hypot(Δx, Δy) / 10))` com as coordenadas do mapa. Na tabela, `d` representa essa distância.

Quando uma entrega coincide com a missão principal, a ação local fica visível. Caso haja abordagem obrigatória, o botão explica a condição e fica ativo assim que ela termina. O Terminal informa o horário de Mara e indica Severino quando ela está fora do turno.

A cotação também descreve o que há no destino e mostra a tarifa de descanso quando aplicável. A Feira, o Quiosque e a Garagem abrem catálogos por serviço. Cartas que o jogador ainda não possui aparecem em cinza na coleção e não abrem o inspetor.

Um desafiante pode aparecer ao concluir a viagem. A chance base é de 35% a pé, 25% de bicicleta, 15% de ônibus ou balsa e 5% de moto. Ela dobra quando a energia prevista na chegada está nos 20% finais. Trajetos que terminam em colapso não oferecem duelo. A abordagem bloqueia a navegação até o duelo terminar ou o jogador desistir. O estado fica salvo entre sessões. A desistência custa 3, 4, 5, 7 ou 9 créditos conforme o nível, limitada ao saldo. Perder lutando segue o custo normal de tempo e energia do duelo. A dificuldade usa o capítulo atual, com cinco níveis de 10 a 22 HP e vitórias de 5 a 21 créditos. Aceitar usa o fluxo normal de um duelo urbano. Toda vitória paga os créditos do nível e sorteia, em separado, uma carta rara (3%), uma carta comum (12%) ou um energético (25%). Cartas já possuídas ficam fora da seleção. Um sorteio de carta sem opções vira energético. Se a mochila estiver cheia, o energético vira 4 créditos extras.

**Acordo das Rotas** começa no Terminal com Mara, passa pelo registro de Leila no Arquivo do Ringue e termina em duelo com Sinal no Depósito de Peças. Vencer Sinal torna as abordagens opcionais, sem cobrança para recusar ou abandonar. A partir do capítulo 3, após ajudar Maíra na Casa de Bombas, o jogador pode receber o Módulo de Rota Cega. Quando equipado na Mochila, ele desativa abordagens novas, sem afetar duelos locais.

A Feira vende o **Relé de Bolso** (+1 RAM inicial por 85 créditos). A Garagem vende a **Ponte de Fibra** (+2 por 170 a partir do capítulo 2) e a **Espinha Óptica** (+3 por 280 a partir do capítulo 4). Comprar equipa o modelo. A Mochila permite trocar entre os modelos adquiridos e o Terminal de Campo (+0). Desafios de arquétipo usam equipamento padrão com seus baralhos emprestados.

| Transporte | Tempo | Energia | Créditos e condição |
| --- | --- | --- | --- |
| A pé | 7 × d min | 2 × d | Grátis. |
| Bicicleta | 4 × d min | d | Compra por 100. Com a bicicleta comprada, converse com Aline na Garagem e vença o duelo para aprender o atalho. Entre Oficinas e Morro, o atalho reduz a distância para `max(2, ceil(d × 0,55))`. |
| Ônibus | 3 × d + 5 min | d | 4 por viagem. |
| Moto | 2 × d min | d | Compra por 450. |
| Balsa | 2 × d min | d | 3 por travessia Canal–Cais. Opera das 07:00 às 18:00, com a partida às 18:00 já indisponível. Requer ajudar Maíra na Casa de Bombas. |

- O dia da interface vai das 06:00 às 19:00. A vigília máxima normal é 16 h. O implante de 130 créditos aumenta o limite para 20 h e a capacidade para 120 de energia.
- Chegar com energia zero ou atingir o limite de vigília dispara o descanso. Em casa são 8 h grátis e energia cheia. Em outro local são 5 h na rua, energia volta a 60 e há 30% de chance de perder 60% do saldo restante, arredondado para cima. A tarifa vem antes do cálculo da perda.
- Dormir voluntariamente restaura toda a energia e zera a vigília. Casa custa 0/8 h, Pensão custa 12/7 h e Hotel Espelho custa 26/5 h. A cama precisa estar acessível no local onde Kairo está e o saldo precisa cobrir o preço.
- A mochila comporta 12 consumíveis no total. A Feira e o Quiosque vendem os mesmos consumíveis. Contar cedo a verdade a Dona Nair reduz o preço em 20%, arredondado ao crédito mais próximo. A decisão adiada abre falas opcionais com Vex e Archon. Café custa 4 e dá +15, energético custa 9 e dá +28, estímulo sintético custa 16 e dá +45. O consumo respeita o teto de energia e não reinicia a vigília.
- No fluxo original, rastrear pista usa quatro símbolos visíveis, dispensa cronômetro e avança 45 min e 8 de energia quando concluído. O rastreamento é uma etapa de progressão à parte dos trabalhos pagos.
- Ajudar Maíra rende 16 créditos e custa 30 min e 5 de energia.
- Os duelistas locais aparecem com acesso direto ao desafio. Os demais personagens aparecem nas ações e cenas em que têm função. Damião tem 10 HP e paga 5 por vitória. Tuca tem 14 HP e paga 7, com carta na primeira vitória. Dora tem 22 HP, usa Overclock e paga 12, com carta na primeira vitória. O estoque da Feira e essas vitórias oferecem rotas que podem coincidir.
- A Feira vende `unit_21` por 45, `unit_22` por 65, `unit_23` por 85, `exploit_07` por 30, `unit_28` por 48, `exploit_12` por 36 e `exploit_13` por 40. A oficina muda a afinidade por 15 créditos e restaura a original gratuitamente. Suas mudanças são de afinidade e convivem com ATK e DEF base.

### Mapa e navegação narrativa

A legenda combina ◆ pistas ativas (ciano/âmbar), ⚔ duelos (magenta) e ✦ atalhos e favores disponíveis (verde). **Todos**, **Pistas**, **Duelos** e **Segredos** filtram os pinos. O seletor de bairros combina seu recorte com o filtro atual. Ícones como a xícara do Quiosque, a chave de ferramenta da Garagem e a cruz da Clínica identificam suas funções. O cálculo de distâncias mantém as coordenadas próprias de viagem. Os destinos ativos vêm das cenas válidas e do duelo narrativo pendente. A cotação antecipa a ação em destaque. Depois da viagem, a ação aparece no topo das tarefas do local.

Os encontros urbanos são escolhidos de forma pseudoaleatória e estável por dia e período. O mapa muda a posição entre o período diurno (06h até antes das 19h) e noturno (19h até antes das 06h). Ao vencer o encontro, o indicador correspondente some até outro período. Cada vitória paga de 8 a 12 créditos conforme o oponente.

### Rotas pacifistas

Kira exige Beto → Leila → Estação. Cipher exige Raquel → Íris → Muralha. Vex exige Cris → Bia → Hotel. Cada conclusão registra a prova, avança o capítulo e aplica a recompensa no mesmo save, usando a prova concluída como trava de repetição. Os custos das etapas somam 45 min/8 energia, 50 min/8 energia e 45 min/8 energia, respectivamente, além das viagens. O diário e a Torre mostram uma advertência tática depois do protocolo de Nalva. Concluir **Confirmar preparação para a Torre** destrava a conversa com Archon.

| Rota | Recompensa e carta |
| --- | --- |
| Kira | 35 créditos e **Rastreador de Lote**, Exploit de 1 RAM. Compra 1 e dá +1 ATK a uma aliada Sombra ou Neutra. |
| Cipher | 50 créditos e **Filtro de Isolamento**, Exploit de 2 RAM. Restaura até 3 DEF e acrescenta +1 DEF permanente. |
| Vex | 65 créditos e **Auditora de Rede**, unidade Malha 2/4, +2 RAM. Na entrada reduz em 1 o maior ATK inimigo, com desempate pela posição de campo. |

### Trabalhos urbanos

`city.life.dailyJobCounts` guarda repetições por trabalho, acompanhado por `dailyJobDay`. Cada tipo paga 100% nas duas primeiras execuções e 50% na terceira, com arredondamento para baixo. A partir da quarta tentativa a UI mostra **Demanda esgotada por hoje**. A demanda reinicia na virada do dia ou ao dormir. Os dois níveis da Antena têm contagens separadas e cada erro custa 2 s e volta ao primeiro símbolo. Concluir ou deixar o prazo expirar conta como execução e consome tempo e energia. Expirar paga zero. Cancelar uma entrega ou interromper o minigame antes da resolução não conta.

| Trabalho | Local / horário de início | Custo urbano | Recompensa integral |
| --- | --- | --- | --- |
| Sinal Padrão | Antena Comunitária | 30 min e 5 energia | 12 créditos. 4 símbolos, 4 s de memorização e 12 s de entrada. |
| Sinal Criptografado | Antena Comunitária | 45 min e 8 energia | 22 créditos. 6 símbolos, 3,5 s de memorização e 12 s de entrada. |
| Correio Expresso | Estação Fantasma, Terminal da Estação, Depósito de Peças, Balcão Cívico ou Subestação do Cais | Deslocamentos escolhidos pelo jogador | Base de `6 + 2d`, bônus por velocidade ou multa por atraso. |
| Escolta de Beco | Cozinha Comunitária e Estação Fantasma, das 19h até antes das 03h | 50 min e 14 energia | 24 créditos. |
| Manutenção de Drones | Garagem da Íris | 40 min e 7 energia | 12 créditos e café ou energético aleatório. Com mochila cheia, 16 créditos. A saturação reduz a parte em créditos. |
| Limpeza de Logs | Balcão Cívico e Terminal da Estação | 35 min e 6 energia | 14 créditos, ou 18 com pelo menos 15 cartas desbloqueadas. |
| Triagem de Sucata | Depósito de Peças | 40 min e 7 energia | 13 créditos, ou 17 após aprender o atalho com Aline ou vencer Giba. |
| Ronda de Carga | Subestação do Cais, das 07h até antes das 17h | 50 min e 9 energia | 18 créditos. |
| Turno do Quiosque | Quiosque 24h, das 19h à 01h inclusive | 60 min e 12 energia | 14 créditos. O turno mantém seu limite de um pagamento por janela. |

A entrega sorteia um destino com distância original `d ≥ 4`. `activeDelivery` guarda destino, minuto de início e distância, permitindo uma entrega por vez. Chegar pela viagem normal conclui o contrato. O tempo real inclui desvios e espera entre a aceitação e a chegada. Quando ele fica dentro de `7d` minutos, o bônus é `min(12, max(0, floor(10 × (1 − tempoReal / (7d)))))`. Após `8d` minutos, a base cai para 75%, arredondada para baixo, e o bônus é zero. A saturação incide depois do cálculo. A entrega é creditada na chegada, antes de eventual descanso forçado.

### Terminais, Holding Meridiano e aliados

O prólogo apresenta os Terminais Portáteis de Diagnóstico de Malha que a Vértice distribuía aos técnicos. A adaptação NeonClash transforma os protocolos industriais de Pulso, Malha e Sombra em cartas visuais. O clímax usa a interface do duelo para representar a transferência do barramento elétrico a Renan sob a contenção do Núcleo Eclipse, acionado por Archon no console mestre.

A prova de Cipher abre automaticamente **Interceptação de Rádio**. A chamada registra a exigência de cortes pela Holding Meridiano e, ao ser concluída, libera o próximo capítulo. Saves que já passaram pela Muralha mantêm seu capítulo. As cenas de Renan e Nalva ligam a concessão, os relatórios adulterados e o corte de endereços mais pobres.

| Aliado | Condição e efeito |
| --- | --- |
| Kira | A conclusão pacifista ativa a rota que desvia os drones. A preparação da Torre restaura até 10 energia, limitado ao máximo de Kairo e uma vez por save. |
| Cipher | A extração isolada ativa a interferência. O duelo final da campanha começa com 18 HP, em vez de 20. O dossiê e a interface de combate mostram o aviso. Desafios, duelos rápidos e revanches após a vitória usam 20 HP. |
| Vex | A conclusão com Helena e Bia ativa provas complementares. Isa comenta a documentação na Praça e cada final recebe uma passagem própria sobre a Holding Meridiano no epílogo. |

A normalização do save deriva aliados antigos da evidência da conclusão pacifista e recupera `nairTruthEarly` da escolha original quando necessário. Recompensas existentes permanecem nas respectivas chaves de save. Os três IDs do lote pacifista são `exploit_15`, `exploit_16` e `unit_31`.

## Combate, cartas e progressão

O [guia de equilíbrio PvE](equilibrio-de-cartas.md) reúne a régua de pontos, os níveis de encontro e os resultados das simulações.

O catálogo atual tem **51 cartas**, sendo 32 unidades e 19 Exploits. Cada deck do jogador tem 20 cartas e aceita até duas cópias de cada ID. Há 12 cartas base antes da escolha do deck inicial. A coleção usa ID estável, metadados de arte, descrição e atributos. Cartas novas entram pelo catálogo em `cards.js` e pela respectiva rota de aquisição. IDs têm lacunas históricas e o sufixo maior não representa a contagem.

1. Cada lado começa com 0 RAM. Kairo tem 20 HP. A partida distribui quatro cartas iniciais por lado. A mão comporta seis cartas, com descarte quando uma compra excede esse limite. Quando o deck fica vazio, o descarte é embaralhado para continuar comprando. A unidade atingida pelo Kill-Switch vai para a área de removidas e fica fora da reciclagem. O botão LOG e a tela de resultado permitem consultar as cartas que cada lado jogou, o descarte atual e as cartas removidas. Cada entrada abre a arte e os atributos de catálogo.
2. Em seu turno, Kairo pode invocar uma unidade se houver posição livre, obter a RAM da carta e usar Exploits enquanto puder pagar. Uma unidade normalmente passa por boot antes de poder atacar. O turno seguinte libera as unidades e compra uma carta. A IA segue fluxo de compra, invocação, Exploits e ataque, com perfil do oponente.
3. Ataques são escolhidos antes da confirmação. Um atacante bloqueado troca dano simultâneo de ATK contra DEF com a unidade que bloqueou. DEF perdida persiste e uma unidade com DEF zero é destruída. Ataques sem bloqueio atingem HP. O painel prevê dano para bloqueios atribuídos, inclusive perfuração.
4. Overclock consome 3 RAM e duas unidades prontas. Elas combinam o ataque, concentram a resposta do bloqueio na unidade líder e o excesso sobre a DEF do bloqueador atinge HP. Se ninguém bloquear, o ataque ganha +1 de dano direto ao HP. Se houver bloqueio, a dupla ganha +1 contra o bloqueador somente com duas afinidades não neutras e diferentes.
5. HP zero encerra o duelo. A tela final registra turnos, dano, unidades inimigas destruídas e Exploits usados. Partidas urbanas resolvidas normalmente custam 40 min e 8 de energia. **Sair do duelo** abre confirmação e registra derrota, com até 3 créditos de taxa fora da aposta. Aposta já paga fica no Ringue e o duelo rápido é gratuito.

| Regra | Aplicação |
| --- | --- |
| Afinidade | Pulso vence Malha, Malha vence Sombra, Sombra vence Pulso. Em choque normal, vantagem dá +1 de dano se a unidade tem ATK positivo. Neutra fica fora do ciclo. Recompilar modifica a afinidade durante a partida. |
| Zero-Day | A unidade pode atacar no turno em que entra. |
| Firewall | Dá prioridade de bloqueio/ataque e pode interceptar automaticamente atacantes ainda sem bloqueio. |
| Vírus | Após causar dano de combate a uma unidade que sobreviveu, reduz seu ATK em 2, até o mínimo de zero. |
| Dreno | Rouba até 1 RAM ao causar dano direto a HP. Outros efeitos podem drenar valores próprios. |
| Ressonância | Requer outra aliada da mesma afinidade não neutra. Condensador Coral recebe DEF permanente na entrada. Ferro de Pulso recebe ATK no ataque, inclusive no Overclock. |
| Reciclar / Lixeira | O efeito pode filtrar cartas descartadas por ID ou tipo, escolher aleatoriamente ou recuperar a mais recente. Recuperação exige espaço na mão. Pressão de Sucata causa dano proporcional ao descarte, limitado a 3. |
| Varredura | Janela Espectral revela o topo e compra uma carta. Se o topo era Pulso, compra mais uma. O lote piloto usa a variante de compra condicional. |
| Exploits | Validam RAM e alvos antes de consumir a carta. Efeitos incluem dano direto, dano ou bônus de atributos, cura de HP, reparo limitado ao máximo de DEF, destruição, compra, dreno e afinidade. Há também efeitos de entrada de unidade. |

| Modo | Acesso e resultado |
| --- | --- |
| Campanha narrativa | Cada chefe é liberado por sua conversa de investigação. Kira, Cipher e Vex permitem obter a prova sem vitória de combate. Archon exige vitória. O [guia](aventura-baixa-luz.md) descreve todos os efeitos. |
| Campanha original | Com a investigação desativada, segue a sequência de dossiês, vitórias e rastros da Antena. |
| Duelo rápido | Oponente sorteado, usa o deck do jogador, registra vitórias/partidas sem custo urbano ou prêmios de campanha. |
| Desafio de rua | Oponente do Ringue com 14 HP. Vitória paga 15 créditos e a entrada é grátis. |
| Mesa de apostas | Liberada ao derrotar Kira. Entrada de 25 créditos, vitória paga 60 e derrota mantém a entrada no Ringue. |
| Moradores | Damião no Quiosque, Tuca e Dora no Ringue. Usam o sistema de arena, com perfis e prêmios próprios. |
| Desafios de arquétipo | Turno da Estação (Infiltração/Kira), Linha de Contenção (Blindagem/Cipher), Ruído na Escuta (Sabotagem/Vex) e Frequência Cruzada (Overclock/Archon). Os três primeiros só aparecem depois da vitória na aventura ou do registro da prova equivalente na rota pacifista. Frequência Cruzada aparece no Novo Jogo+. Emprestam decks de 20 cartas com afinidades de fábrica e liberam duas cartas por primeira vitória. |

### Fases e pontos de extensão

`PLAYER_MAIN` concentra invocações e Exploits. `SELECT_TARGET` aguarda o alvo de um Exploit. `PLAYER_ATTACK` permite seleção de atacantes e `PLAYER_OVERCLOCK` prepara a dupla. `ENEMY_TURN` executa a IA. `PLAYER_DEFENSE` recebe os bloqueios. `COMBAT_ANIM` protege a resolução animada. `GAME_OVER` encerra as ações da partida. A IA avalia alvos e efeitos possíveis, conserva RAM para Overclock quando seu perfil permite e considera prioridades de Firewall.

O **Novo Jogo+** aparece na tela inicial depois do epílogo. Reinicia história, prólogo e vida da cidade, preservando coleção, decks, afinidades, Galeria, estatísticas e recompensas já conquistadas no Ringue. O duelo rápido começa com Kira como oponente inicial e inclui os demais conforme os encontros são resolvidos. Archon entra nessa seleção no Novo Jogo+.

Após atacar, uma unidade fica exausta e não bloqueia até o início do próximo turno do seu lado. A regra vale para os dois lados e para as unidades usadas no Overclock. Firewall só intercepta se puder bloquear. Unidades em boot podem bloquear se estiverem aptas. Com um único atacante, tocar na unidade aliada marca ou desmarca o bloqueio. Se houver apenas um defensor apto, o bloqueio começa marcado. Contra vários atacantes, um defensor único já vem selecionado e o jogador escolhe o alvo. Firewall inimigo conserva a prioridade obrigatória.

A seleção de ataque mostra **+1** nas unidades adversárias que tomariam bônus de afinidade se bloqueassem. A linha tracejada e a prévia de DEF indicam o lado que recebe o bônus quando o bloqueio já está marcado.

Muralhas com Bloqueio Múltiplo podem assumir mais de um atacante. Os choques usam uma única reserva de DEF na ordem do ataque. Depois que a muralha cai, os próximos ataques atribuídos a ela acertam o HP. **Biombo de Sucata** custa 38 créditos, tem 3 DEF e pode bloquear até dois atacantes. **Colosso do Viaduto** custa 145 créditos, aparece na Feira no capítulo 5, tem 12 DEF e intercepta até três. Os dois têm 0 ATK. O Colosso gera apenas 1 RAM.

A Feira vende as cinco cartas que ampliam essa regra. **Vigia de Turno** (55 cr) tem Vigilância e bloqueia mesmo depois de atacar. **Estilhaço de Pulso** (46 cr) tem 4 ATK, zero DEF e é destruído quando seu ataque é bloqueado. **Anteparo de Rua** (60 cr) tem 6 DEF, zero ATK e bloqueia como Firewall sem contra-atacar. **Formação de Retaguarda** (65 cr, 3 RAM) permite que unidades exaustas aptas a defender bloqueiem até o próximo turno do dono. **Escudo de Emergência** (50 cr, 2 RAM) absorve até 4 de dano ao HP no mesmo intervalo, sem acumular.

Todo duelo sorteia quem começa com chances iguais. O lado que começa joga com quatro cartas. O segundo lado compra uma quinta carta ao receber seu primeiro turno, dentro da rodada 1. A Feira vende dois itens permanentes de iniciativa. Pulso de Partida (65 créditos) dá a abertura a Kairo e Relé de Espera (45 créditos) dá a abertura ao adversário. A Mochila mantém um único item de iniciativa ativo e permite desligá-lo para retomar o sorteio. A compra e a seleção persistem após fechar o app e no Novo Jogo+.

Bônus permanentes de ATK ou DEF da mesma carta são aplicados uma vez por unidade em campo. Bônus de cartas diferentes podem coexistir. O visor lista os modificadores e a seleção de alvos recusa repetição sem gastar carta ou RAM. Em efeitos coletivos, unidades já modificadas não ganham o bônus de novo, mas efeitos separados como cura de HP continuam funcionando.

Antes do primeiro prólogo, o jogador escolhe **Equilibrado**, **Oficina Neutra** ou **Caça a Brechas**. Cada lista tem 14 unidades, 6 Exploits e até duas cópias por carta. A escolha acrescenta apenas as cartas da lista escolhida à coleção inicial. Saves com aventura iniciada preservam o baralho existente.

**Curto de Placa** custa 2 RAM e causa 2 de dano à DEF de uma unidade inimiga. **Sonda de Bancada** e **Vigia de Brecha** causam respectivamente 1 e 2 de dano ao entrar. Quando há vários alvos, o jogador escolhe um, ou pula o efeito e mantém a unidade em campo. A IA prioriza alvos que consegue eliminar. As três cartas também estão à venda na Feira.

Unidades são instâncias de campo com UID, ATK e DEF atuais, DEF máxima, afinidade e marcadores de boot e ataque. Exploits declarativos usam alvo próprio, inimigo ou nenhum alvo, com ações sobre uma unidade, aliados ou inimigos conforme a definição. As cartas emprestadas dos desafios não substituem o deck ativo. O limite de duas cópias vale para os decks do jogador. Os baralhos dos adversários são listas de dados próprias.

| Desafio | Cartas da primeira vitória |
| --- | --- |
| Turno da Estação | Mensageira de Fase e Passagem de Serviço |
| Linha de Contenção | Sentinela do Canal e Cerâmica de Reparo |
| Ruído na Escuta | Escuta do Cais e Ferrugem Óptica |
| Frequência Cruzada | Condutor Bifásico e Ponte Dupla |

## Leitor de Webcomic Cinética

O prólogo e o leitor de investigação usam uma tira rolável progressiva. `Continuar` ou tocar no quadro ativo revela o próximo beat. Os anteriores ficam acima com `.comic-panel--past`. O leitor centraliza o novo quadro quando há espaço de rolagem e respeita a configuração de movimento reduzido. `story.read` mantém o índice de cena já existente. `story.prologueFrame` guarda a posição no prólogo e `story.comicDone` guarda ações concluídas por ID de cena e índice. Campos ausentes recebem os padrões no carregamento.

| Metadado | Uso |
| --- | --- |
| `scene.beats[index]` e `prologueBeats[index]` | Extensões opcionais por índice. Textos de `scene.lines` e os índices existentes continuam válidos. |
| `art`, `artTitle` | Imagem opcional que substitui a do local e título para o registro na Galeria. |
| `camera`, `focus` | `wide`, `zoom-in`, `focus-detail`, `pan-left` e `pan-right`. O foco aceita `top-left`, `center` e `bottom-right`. |
| `mood` | `neutral`, `tense`, `revelation`, `radio` ou `memory`, com iluminação e efeitos próprios. |
| `speaker`, `expression` | Chave do retrato em `comicPortraits` e atuação `default`, `alert`, `shock`, `whisper`, `secret` ou `radio`. Variantes de arquivo são opcionais. A base e os monogramas cobrem o elenco com o material atual. |
| `bubbleType` | `speech`, `thought`, `radio`, `narration` e `evidence`. Kairo fala pela esquerda e os NPCs pela direita. |
| `sfxVisual` | `text`, `style`, `pos` e `sound`. O efeito visual acompanha o som configurado e a vibração breve em dispositivo compatível. |
| `interact` | `tap-device`, `wipe` e `tune`. Os dois primeiros aceitam botão, e o recibo também aceita gesto de limpeza. O rádio usa um controle deslizante com faixa indicada. Ações pendentes bloqueiam o avanço. |

A Galeria registra o quadro quando sua imagem termina de carregar e a moldura aparece na tela. O [plano de arte](plano-arte-webcomic.md) organiza os novos cenários, retratos e detalhes em levas.

## Artes, áudio e navegação no Android

- O jogo usa imagens locais, principalmente WebP e PNG. A arte procedural serve como fallback. A galeria cadastra a abertura, o mapa, o marcador, os quadros do prólogo, imagens de locais, retratos e cartas. O observador de interseção registra imagens carregadas que atingem 50% da área visível, excluindo conteúdo inerte, miniaturas bloqueadas da coleção e a própria galeria. Abrir o inspetor de uma carta bloqueada conta como ver sua arte. Categorias vazias e artes não vistas não antecipam conteúdo.
- Web Audio usa nove temas sintetizados (abertura, cidade, Feira, Antena, Ringue, Kira, Cipher, Vex e Archon) e 14 efeitos. O agendamento é por passos musicais, com síntese procedimental, trilha contextual e um modo de combate. Música e efeitos passam por canais independentes, com compressão nos efeitos e limitação no master. O primeiro gesto normal retoma áudio se a política do navegador bloquear a abertura. Silêncio explícito persiste.
- O APK usa uma `MainActivity` Java e `WebViewAssetLoader` em `https://appassets.androidplatform.net/game/`. Restringe a navegação à origem e ao caminho do jogo, habilita JavaScript e DOM Storage e desabilita acesso via arquivos e conteúdo. Pausa/retoma o áudio com o ciclo de vida da Activity.
- A Activity usa modo imersivo e aplica insets de barras, recorte e gestos. O botão Voltar consulta `NB.Input.handleBack()`, que fecha a camada aberta ou desfaz a seleção/estado de navegação quando aplicável. Se o jogo devolve `false`, o Android mostra a confirmação de saída e pode encerrar a Activity.

## Desenvolvimento, testes e distribuição

| Item | Configuração |
| --- | --- |
| Web | Node.js 24 e npm. `npm ci`, `npm run dev` (porta 3000), `npm run lint` (TypeScript), `npm run build` e `npm run preview`. |
| Testes | `tests/game.spec.js` tem 48 cenários Playwright. Usa perfil Pixel 7 e o build servido na porta 4317. Cobre combate, campanha, cidade, economia, galeria, áudio, deck e navegação. Para rodar localmente, gere `dist`, instale Chromium com `npx playwright install chromium` ou defina `CHROMIUM_PATH`, e execute `npm test`. |
| Android | Application ID `io.github.chimiasama.neonclash`, versão `0.1.0` e código 1. JDK 17, AGP 9.5.1, Gradle 9.9.2, SDK alvo/compile 35, mínimo 23 e Build Tools 36.0.0. A Activity usa orientação retrato. |
| APK | Depois do build web, execute `./gradlew :app:assembleDebug` em `android/`. Saída `android/app/build/outputs/apk/debug/app-debug.apk`, com assinatura de depuração. |
| CI | `.github/workflows/android.yml` usa Linux, Chrome preinstalado quando disponível e Chromium Playwright como alternativa. Executa lint, build e testes, gera o APK, verifica assinatura e arquivos internos e publica `NeonClash-debug` como artefato. Gatilhos configurados para push/PR na `main` e execução manual. |

## Conteúdo atual e metas

O jogo disponível tem 51 cartas, 10 bairros, 23 locais, 34 personagens com função no jogo, quatro chefes, quatro desafios de arquétipo e 37 cenas da investigação. O [plano de expansão](plano-expansao.md) descreve a meta de 500 cartas, sendo 495 encontráveis e cinco secretas de missão. Os roteiros de construção e descrições de moradores nos demais arquivos de `docs/` registram escopo planejado além dos recursos já descritos aqui.

O lote piloto usa arte procedural. Condensador Coral, Ímã de Núcleo e Janela Espectral são vendidos na Feira. Catadora de Ecos, Ferro de Pulso e Pressão de Sucata são prêmios das primeiras vitórias sobre Giba, Aline e Nanda, respectivamente. Os três adversários também usam cartas do lote.

## Catálogo atual por ID

Os nomes e os atributos base abaixo também identificam a arte, a rota de aquisição e a afinidade de fábrica no código.

| ID | Carta | Tipo | ATK / DEF · RAM, ou custo | Afinidade |
| --- | --- | --- | --- | --- |
| `unit_01` | Kuroi-01 | Unidade | 4 / 4 · +2 RAM | Neutra |
| `unit_02` | Spidey-Drone | Unidade | 3 / 3 · +3 RAM | Neutra |
| `unit_03` | Aegis-Wall | Unidade | 2 / 7 · +2 RAM | Malha |
| `unit_04` | Ghost-Runner | Unidade | 3 / 2 · +2 RAM | Sombra |
| `unit_05` | Valkyrie-X | Unidade | 5 / 3 · +2 RAM | Pulso |
| `unit_06` | Neon-Hound | Unidade | 4 / 2 · +2 RAM | Pulso |
| `unit_07` | Chrome-Brute | Unidade | 6 / 6 · +2 RAM | Pulso |
| `unit_08` | Data-Wraith | Unidade | 3 / 5 · +2 RAM | Sombra |
| `unit_09` | Trojan-Mantis | Unidade | 3 / 4 · +2 RAM | Sombra |
| `unit_10` | Bastion-Core | Unidade | 3 / 6 · +2 RAM | Malha |
| `unit_11` | Siphon-Viper | Unidade | 4 / 3 · +2 RAM | Sombra |
| `unit_12` | Plague-Node | Unidade | 2 / 5 · +2 RAM | Malha |
| `unit_13` | Flash-Ronin | Unidade | 4 / 3 · +2 RAM | Pulso |
| `unit_14` | Malware-Rex | Unidade | 5 / 5 · +2 RAM | Pulso |
| `exploit_01` | Chip Overclock | Exploit | 2 RAM | — |
| `exploit_02` | Spike Neural | Exploit | 2 RAM | — |
| `exploit_03` | Kill-Switch | Exploit | 4 RAM | — |
| `exploit_04` | Patch v9 | Exploit | 3 RAM | — |
| `exploit_05` | Bomba EMP | Exploit | 3 RAM | — |
| `exploit_06` | Sifão de Memória | Exploit | 2 RAM | — |
| `unit_21` | Drone do Viaduto | Unidade | 1 / 4 · +3 RAM | Malha |
| `unit_22` | Moto-Fantasma | Unidade | 3 / 3 · +2 RAM | Sombra |
| `unit_23` | Guarda da Feira | Unidade | 3 / 5 · +2 RAM | Malha |
| `exploit_07` | Recompilar | Exploit | 1 RAM | — |
| `unit_24` | Mensageira de Fase | Unidade | 2 / 2 · +2 RAM | Sombra |
| `unit_25` | Sentinela do Canal | Unidade | 1 / 5 · +2 RAM | Malha |
| `unit_26` | Escuta do Cais | Unidade | 2 / 3 · +2 RAM | Sombra |
| `unit_27` | Condutor Bifásico | Unidade | 4 / 3 · +2 RAM | Pulso |
| `exploit_08` | Passagem de Serviço | Exploit | 2 RAM | — |
| `exploit_09` | Cerâmica de Reparo | Exploit | 1 RAM | — |
| `exploit_10` | Ferrugem Óptica | Exploit | 2 RAM | — |
| `exploit_11` | Ponte Dupla | Exploit | 2 RAM | — |
| `unit_28` | Condensador Coral | Unidade | 2 / 4 · +2 RAM | Malha |
| `unit_29` | Catadora de Ecos | Unidade | 2 / 3 · +2 RAM | Sombra |
| `unit_30` | Ferro de Pulso | Unidade | 3 / 3 · +2 RAM | Pulso |
| `exploit_12` | Ímã de Núcleo | Exploit | 2 RAM | — |
| `exploit_13` | Janela Espectral | Exploit | 2 RAM | — |
| `exploit_14` | Pressão de Sucata | Exploit | 2 RAM | — |
| `unit_31` | Auditora de Rede | Unidade | 2 / 4 · +2 RAM | Malha |
| `exploit_15` | Rastreador de Lote | Exploit | 1 RAM | — |
| `exploit_16` | Filtro de Isolamento | Exploit | 2 RAM | — |
