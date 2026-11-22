# Equilíbrio de cartas e encontros PvE

A régua mede o valor de uma carta, o desempenho de um deck e a dificuldade de um encontro em registros distintos. A campanha permite que Kairo fique mais forte. Cartas raras e recompensas podem aumentar seu poder, e chefes podem ter regras próprias. O objetivo é oferecer decisões relevantes e manter as lutas obrigatórias vencíveis com cartas disponíveis pela progressão normal.

## Orçamento de carta

Use **1 ponto de poder (PP) por ATK impresso** como referência. Os valores são multiplicados pela quantidade efetivamente aproveitada. Em cada revisão registre a versão dos pesos, o valor típico, o teto plausível, o momento em que o efeito é útil e as combinações que exigem teste.

- **Unidade** = ATK + DEF ponderada + RAM gerada + valor esperado das habilidades.
- **Exploit** = valor esperado dos efeitos ao resolver, menos a RAM gasta e 2,5 PP pela carta usada. Registre à parte o percentual de mãos em que falta RAM ou alvo. Compare Exploits com outros de função e custo próximos.
- **Efeito condicional** = probabilidade de ativar × média de ativações quando funciona × valor efetivo. Use amostras da abertura, mesa disputada e finalização. Um efeito de área usa o número de alvos alcançados, com teto separado.

| Componente | PP | Aplicação |
| --- | ---: | --- |
| ATK de unidade | 1,0 | Inclui pressão e contra-ataque. Teste os limiares para eliminar os bloqueadores mais frequentes. |
| DEF de unidade | 0,75 | DEF perdida persiste. Valorize mais a sobrevivência que permite outra ação. |
| RAM gerada ou gasta | 0,9 base | Rede de recursos do duelo. Meça os turnos em que o deck atinge 2, 3 e 4 RAM. O cyberdeck é um atributo do perfil. |
| Compra, recuperação | 2,5 por carta útil | Desconte mão cheia, descarte inelegível e recuperação aleatória ruim. Escolher a carta aumenta consistência. |
| Dano direto | 1,6 por HP | Verifique o dano total que o deck pode concentrar num turno. |
| Dano a unidade | 0,9 por DEF perdida | Some apenas o valor residual da eliminação quando houver. |
| Cura ou escudo de HP | 0,6 por HP efetivo | Conte a cura ou absorção real. Escudos que não acumulam têm retorno menor em sequência. |
| Reparo | 0,55 por DEF efetiva | Limitado pelo dano existente e pela DEF máxima. |
| Bônus permanente | peso do atributo | Pondere por alvo e sobrevivência. Respeite a regra de não acumular o mesmo modificador na mesma unidade. |
| Roubo de RAM | 2,0 por RAM efetivamente roubada | Conte transferência e teste atraso de resposta. |
| Zero-Day | 1,2 provisório para ATK 3 | Depende de atacar imediatamente e do custo de abrir mão da defesa. |
| Firewall | 1,2 provisório quando útil | Prioridade e interceptação podem forçar uma troca desfavorável. |
| Bloqueio múltiplo | 0,8 por bloqueio adicional útil | Os atacantes consomem a mesma reserva de DEF. |

Afinidade tem valor contextual e entra na avaliação do deck, incluindo Overclock e afinidades modificadas na oficina. Ressonância usa a frequência de outra aliada compatível e a duração real do bônus. Dreno depende de alcançar o HP com RAM disponível. Vírus depende de o alvo sobreviver ao choque e ter ATK para perder. Vigilância e Formação contam bloqueios úteis que só ocorreram porque a unidade pôde defender depois de atacar. Só ataque e só defesa já perdem pontos pelo atributo ausente. Desconte apenas restrições residuais que o placar ainda não captura.

Varredura conta a compra base e a probabilidade da compra extra no topo. Lixeira usa o tamanho do descarte na janela em que o efeito é jogado. Dano na entrada entrega efeito, corpo e RAM na mesma invocação. Para destruição e banimento, estime o valor que o alvo ainda teria no campo. A RAM que ele já gerou foi realizada. Kill-Switch acrescenta valor quando impede reaproveitamento pelo descarte.

Para uma habilidade nova registre gatilho, alvos, duração, custo, frequência, limites e resposta do adversário. Traduza o resultado em atributos conhecidos. Se copiar ou repetir efeitos, teste a melhor combinação legal, incluindo duas cópias e reciclagem. Aplique limites explícitos quando o efeito puder gerar mais recursos do que consome, travar o oponente ou produzir um ciclo.

## Calibração 0.2

Em seis adversários (os quatro chefes, Viagem 2 e Viagem 5), acrescentei separadamente **+1 ATK**, **+1 DEF** ou **+1 RAM gerada** a todas as unidades do Equilibrado. O adversário, as sementes e a composição ficaram iguais. Cada variante alterou um atributo de cada vez. A média de vitórias subiu **20,1 pontos percentuais com ATK**, **15,0 com DEF** e **1,3 com RAM**.

Mantive ATK em **1,0** e subi DEF de **0,70 para 0,75**, pela razão observada entre os ganhos médios. Reduzi RAM de **1,4 para 0,9 PP** como peso padrão. Mantive **até 1,4 PP como faixa de revisão** em perfis que passam a usar uma resposta importante um turno antes ou gastam com Overclock de forma consistente. A ablação principal não usa Overclock no lado da Kairo, e um deck inicial tem apenas seis Exploits. O ganho baixo mede o valor marginal da RAM nesse cenário. Seria prematuro usar a proporção observada para definir um peso universal. Os outros efeitos da tabela continuam valores provisórios.

Com esses pesos, Kuroi-01 vale **8,8 PP** e Spidey-Drone vale **7,95 PP** antes de efeitos externos. Registre à parte que o Drone gera 3 RAM sozinho e pode abrir uma jogada mais cedo. Para uma revisão futura, repita o teste de RAM com decks de Exploits baratos, remoção de 4 RAM e políticas diferentes de Overclock.

## Níveis e recompensas

**Poder de deck de Kairo** usa a média de vitórias contra um painel congelado de referência, sempre com iniciativas divididas e um piloto comum. Na versão 0.2, o painel contém Kira, Cipher, Vex, Archon e os cinco encontros de viagem da versão simulada. Um perfil inclui lista, cyberdeck, afinidades e estratégia de combate. Preserve o painel quando criar outros NPCs, para manter a unidade de comparação.

| Nível do deck | Média de vitórias no painel |
| --- | ---: |
| P1 · Iniciante | abaixo de 35% |
| P2 · Equipado | 35% a menos de 55% |
| P3 · Especializado | 55% a menos de 70% |
| P4 · Avançado | 70% a menos de 85% |
| P5 · Elite | 85% ou mais |

**Grau do encontro** usa a taxa de vitória média dos três decks iniciais contra o oponente, com o mesmo piloto. Guarde também o resultado por iniciativa. Um encontro que fica abaixo de 20% é uma referência de dificuldade para um deck inicial, e pode ser adequado mais tarde.

| Grau | Vitória do grupo de referência | Uso |
| --- | ---: | --- |
| D1 · Treino | 85% ou mais | Apresentação de uma mecânica |
| D2 · Favorável | 70% a menos de 85% | Desafio curto com margem para erro |
| D3 · Disputado | 45% a menos de 70% | NPC competitivo e viagem regular |
| D4 · Difícil | 20% a menos de 45% | Especialista, aposta ou desafio anunciado |
| D5 · Chefe | abaixo de 20% | Encontro que pede preparação ou melhora de deck |

Chefes narrativos devem ter identidade e dificuldade fixas. Valide cada um com decks construíveis quando o jogador chega por duelo e por favores, incluindo recompensas e cyberdecks adquiríveis até ali. Para NPC fixo opcional, mostre quando ele representa um desafio superior. Para viagem, proponho manter um piso e um teto por capítulo e usar P3 ou superior para aumentar a frequência de **variantes** mais difíceis dentro desse intervalo. Faça ajustes de no máximo um grau por encontro, com adversários e recompensas identificáveis. Preserve encontros mais fáceis e calibre obrigatório e opcional separadamente. Evite que comprar uma melhoria imediatamente torne todas as viagens mais caras ou arriscadas.

Registre cada premiação com capítulo mínimo, confiabilidade de obtenção, arquétipo habilitado e teto de duas cópias. Uma carta rara pode ser mais forte. O desbloqueio atual é por ID e permite duas cópias em deck, então a raridade de obtenção deixa de limitar a repetição depois de adquirida. Aumentar a força do oponente deve trazer recompensa proporcional. As cartas secretas podem ampliar uma estratégia, e o clímax deve continuar vencível sem elas.

## Resultados da primeira bateria

Foram **33.200 partidas** em 83 cenários de 400, com 200 aberturas de cada lado por cenário. Apenas uma atingiu o limite sem desfecho. A versão de referência do catálogo e dos encontros é o commit `5e9df2c`. O perfil **Progressão mista** é um deck de bancada com premiações de combate, cartas de favores, Colosso e Relé de Bolso. Ele serve para testar crescimento de poder sem representar uma rota exclusiva ou uma lista garantida antes de determinado chefe.

| Encontro | Equilibrado | Oficina Neutra | Caça a Brechas | Progressão mista | Grau inicial |
| --- | ---: | ---: | ---: | ---: | --- |
| Kira | 62,5% | 76,0% | 59,0% | 63,0% | D3 |
| Cipher | 14,0% | 11,8% | 11,0% | 50,5% | D5 |
| Vex | 14,8% | 6,5% | 2,0% | 27,3% | D5 |
| Archon | 4,5% | 1,8% | 0,8% | 16,0% | D5 |
| Viagem 1 · Iniciante | 60,3% | 50,5% | 28,0% | 72,5% | D3 |
| Viagem 2 · Praticante | 62,3% | 64,8% | 45,0% | 78,3% | D3 |
| Viagem 3 · Experiente | 99,3% | 97,3% | 93,3% | 99,5% | D1 |
| Viagem 4 · Veterano | 88,3% | 98,3% | 92,3% | 90,5% | D1 |
| Viagem 5 · Elite | 79,5% | 72,5% | 64,3% | 96,5% | D2 |
| Tuca | 83,0% | 84,8% | 74,3% | 89,5% | D2 |
| Dora | 32,3% | 24,0% | 14,8% | 56,0% | D4 |
| Giba | 92,0% | 97,5% | 90,5% | 98,0% | D1 |
| Aline | 88,5% | 93,3% | 88,5% | 87,5% | D1 |
| Nanda | 99,8% | 98,0% | 98,5% | 100% | D1 |

No painel, **Equilibrado (53,9%)**, **Oficina Neutra (53,3%)** e **Caça a Brechas (44,0%)** ficam em **P2**. **Progressão mista (66,0%)** fica em **P3**. As faixas P1, P4 e P5 são pontos de referência a validar com mais perfis.

- **Viagem:** os níveis 3 e 4 entregaram mais vitórias que os níveis 1 e 2, mesmo com o aumento de HP. Antes de escalar por poder de deck, ordene as variantes por dificuldade observada. O nível Iniciante precisa de uma revisão de abertura, com atenção especial ao Caça a Brechas.
- **Iniciativa:** com o Equilibrado contra Kira, iniciar com Kairo elevou as vitórias de **33% para 92%**. Preserve a coluna por iniciativa em toda revisão e teste os itens que escolhem quem começa.
- **Campanha:** a Progressão mista elevou Cipher a **50,5%** e Vex a **27,3%**, mas chegou a **16%** contra Archon com o piloto de ataque normal. O Equilibrado obteve **6,3%** com a heurística de Overclock e **8,0%** quando Cipher também reduziu o HP do Eclipse. Isso indica onde testar decks de fim de campanha e melhores decisões de ataque e defesa antes de alterar o chefe.

A [planilha CSV](equilibrio-simulacoes-v0.2.csv) contém as taxas por iniciativa, a duração média e os resultados das ablações.

## Reprodução

Execute `node scripts/simular-combates.mjs 400` na raiz. A saída é CSV e a quantidade deve ser par. A simulação usa o motor real de regras, a IA dos NPCs, os decks reais e sementes fixas. O piloto de Kairo escolhe cartas e bloqueios por heurística. Na matriz principal ele ataca com todas as unidades prontas e reserva os testes de Overclock para cenários separados. Interfaces, animações e persistência são simuladas em memória. A partida é encerrada para análise após 30 ciclos de Kairo e sem desfecho conta como ausência de vitória. As taxas são referências comparativas do piloto, e medir dificuldade humana exige playtest.

Referências de design de cartas e restrições por ambiente em [Magic, New World Order](https://magic.wizards.com/en/news/making-magic/new-world-order-2011-12-05), [Magic, listas de restrição](https://magic.wizards.com/en/banned-restricted-list) e [Hearthstone, ajuste de Vol’jin](https://hearthstone.blizzard.com/en-us/news/24008697/28-2-patch-notes).
