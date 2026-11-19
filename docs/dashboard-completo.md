# Dashboard completo do painel

Mapa da nova tela "Visão geral" (`/admin`), fechado numa sessão de perguntas e respostas em 19/11/2026. Parte do que a [Fase 3 do plano](plano-painel-admin.md#fase-3-visão-geral) entregou e leva o dashboard a um painel completo, com abas de análise, alertas e metas. Todos os dados continuam mockados, sem banco.

## Visão

- **Para quem:** o dono e o operador. O topo é o "agora" do dia (alertas, Hoje e meta); as abas são a análise do dono. A operação detalhada continua na Fila, na Cozinha e no PDV: o dashboard só leva até lá.
- **Layout fixo,** pensado por segmento. Sem esconder, reordenar ou arrastar blocos.
- **Celular e desktop:** no celular o foco é o "agora" (alertas, Hoje e meta); as abas funcionam no celular, mas são pensadas para o desktop. Vale para as 11 telas do Playwright.
- **Plano Pro:** nenhuma análise fica bloqueada. Hoje o Pro só vale para a vitrine, e o modelo comercial está em aberto no `PRODUCT.md`.
- **Sistema de design:** o `DESIGN.md` continua valendo (régua entre fios, sem cartão com número grande em caixa, gráfico de uma série azul, proporção em barra horizontal, sem pizza ou rosca). Duas exceções, registradas lá:
  - o bloco Hoje e a faixa de alertas se atualizam sozinhos a cada 30 s;
  - os gráficos de comparação ganham uma segunda série, em cinza neutro, para o período anterior.

## Estrutura

- **Abas na URL:** `/admin?aba=vendas`, junto com o período que já está lá (`?de=&ate=`). Sem `aba`, abre o **Resumo**. Não guardamos a última aba vista.
- **Um filtro de período** para todas as abas, o mesmo de hoje (atalhos Hoje, Ontem, 7, 15 e 30 dias, Este mês e intervalo de até 90 dias), e o mesmo padrão de hoje ao abrir. No Resumo, Hoje, Meta e alertas ignoram o período.
- **Dia / Semana:** com 14 dias ou mais no período, os gráficos por dia ganham a troca para agrupar por semana.
- **Abas por segmento:** aparecem pelo mesmo `temModulo` / `temRecurso` que monta o menu.

  | Aba         | Adega | Açougue | Pizzaria | Salão  | Lanchonete | Farmácia |
  | ----------- | ----- | ------- | -------- | ------ | ---------- | -------- |
  | Resumo      | sim   | sim     | sim      | sim    | sim        | sim      |
  | Vendas      | sim   | sim     | sim      | sim    | sim        | sim      |
  | Produtos    | sim   | sim     | sim      | sim    | sim        | sim      |
  | Clientes    | sim   | sim     | sim      | sim    | sim        | sim      |
  | Operação    | sim   | sim     | sim      | sim    | sim        | sim      |
  | Entrega     | sim   | sim     | sim      | não    | sim        | sim      |
  | Financeiro  | sim   | sim     | sim      | sim    | sim        | sim      |
  | Do segmento | não   | Pesagem | não      | Agenda | não        | Farmácia |

- **Celular:** a barra de abas fica presa logo abaixo do cabeçalho e rola para o lado, com um esmaecido na borda. No desktop, as abas aparecem inteiras.
- **Nomes por segmento:** no salão, "pedido" vira "atendimento" em todas as abas. A regra sai do componente e vai para uma função de `lib/`, com teste. A farmácia continua com "pedido" em tudo.

## Abas

### Resumo

De cima para baixo:

1. **Precisa de atenção:** a faixa de alertas (ver [Alertas](#alertas)). Só aparece quando há algo.
2. **Hoje:** pedidos, faturamento, ticket médio e em andamento, cada um com a comparação **"vs {dia da semana} passada, até esta hora"**. Abaixo, aguardando pagamento e cancelados, como hoje.
3. **Meta:** a barra do mês, a meta de hoje e a projeção (ver [Metas](#metas)).
4. **Bloco do segmento:**
   - salão: a agenda de hoje;
   - farmácia: receitas a conferir e lotes vencendo;
   - açougue: pedidos esperando pesagem;
   - onde há mesas: mesas ocupadas.
5. **Período resumido:** a régua de 4 números (faturamento com variação, pedidos, ticket e melhor dia) e o gráfico por dia.
6. **Top 5 mais vendidos** e **pedidos recentes**.

Saem do Resumo: formas de pagamento (vão para Financeiro), canais e a tabela dia a dia (vão para Vendas).

### Vendas

- Régua: faturamento, pedidos, ticket médio e itens por pedido.
- Gráfico por dia (faturamento ou pedidos) com o período anterior em cinza.
- **Mapa de calor** dia da semana × hora.
- Média de vendas por hora do dia.
- **Canais** (entrega, retirada, mesa, atendimento) e **origem** (site, PDV, garçom, painel).
- Tabela dia a dia, com CSV.

### Produtos

- Ranking com troca entre quantidade e faturamento.
- Vendas **por categoria**.
- **Curva ABC:** A são os produtos que somam 80% do faturamento, B os próximos 15% e C o resto.
- **Produtos sem venda** no período (ativos no cardápio).
- **Adicionais e opções** mais escolhidos.
- **Margem por produto,** quando há custo (ver [Custo e margem](#custo-e-margem)).
- Estoque: o valor parado e a **cobertura** ("acaba em ~X dias", pelo consumo médio do período).
- Açougue: kg vendidos.
- Tabela completa, com CSV.

### Clientes

Cliente é o **telefone normalizado** do pedido (só dígitos, com DDD), por uma função pura. Não há cadastro de cliente.

- A aba busca sempre **os 90 dias** de histórico, independente do período, e diz isso na tela. "Novo" quer dizer "primeiro pedido nos últimos 90 dias".
- Régua: clientes únicos, novos, % recorrentes e pedidos por cliente.
- **Melhores clientes:** quanto gastou, nº de pedidos e último pedido.
- **Sumidos:** compraram 2 vezes ou mais e não voltam há 30 dias. Cada um tem um botão que abre o WhatsApp (`wa.me`) com uma mensagem pronta. A pessoa revisa e envia; nada é mandado sozinho. A mensagem:

  > Oi, {primeiro nome}! Faz um tempinho que você não pede na {loja}. Bateu saudade? Dá uma olhada no que tem hoje: {link da vitrine}

  No salão, "pede" vira "agenda".

### Operação

Depende do [histórico de status](#horário-de-cada-etapa).

- **Tempo médio por etapa:** aceite, preparo, espera do motoboy, entrega e total. Cada um com a média e o "9 em 10 pedidos em até X min".
- **% no prazo,** com o prazo de 40 min da regra da fila (`urgencia` em `lib/admin/regras/fila.ts`).
- **Atrasos por hora do dia.**
- **Cancelamentos:** a taxa, por motivo e por canal.
- **Pagamento online que nunca foi pago.**
- Onde há mesas: ocupação, tempo médio de mesa, ticket por mesa e vendas por garçom.

### Entrega

Só nos segmentos com o módulo de motoboys.

- **Por motoboy:** entregas, tempo médio na rua e taxas das entregas dele.
- **Por bairro:** pedidos, faturamento, taxa arrecadada, ticket médio e tempo médio.
- Total de taxas de entrega no período.
- Sem mapa: o pedido não guarda coordenadas.

### Financeiro

- Bruto (subtotal), descontos, taxas de entrega e líquido.
- Formas de pagamento (a lista que hoje está no Resumo).
- **A receber:** pagamento na entrega ainda aberto e pagamentos pendentes.
- **Margem bruta** em R$ e %, com a cobertura: "custo informado em 72% do faturamento".
- Descontos dados no PDV.
- **Taxas de pagamento estimadas** e o líquido depois delas (ver [Taxas de pagamento](#taxas-de-pagamento)).

### Abas do segmento

- **Salão, Agenda:** ocupação da capacidade (`capacidadeAtendimentos`), horários vagos hoje e amanhã, serviços mais agendados e cancelamentos de agenda. Sem "por profissional": o dado não existe.
- **Farmácia:** receitas por canal e situação, **valor em risco** nos lotes que vencem em 30 e 90 dias, saldo dos controlados e vendas por tipo de medicamento (genérico, similar, referência).
- **Açougue, Pesagem:** kg vendidos, **diferença média** entre o estimado e o pesado, pedidos esperando pesagem e retiradas marcadas por dia.
- Adega, pizzaria e lanchonete não têm aba extra. As mesas ficam em Operação.

## Alertas

A faixa **Precisa de atenção** fica no topo do Resumo e só aparece quando há algo. Cada alerta traz a contagem e um botão que leva à tela que resolve. Não tem "dispensar": o alerta some quando o problema se resolve. Os limites são **fixos no código**, em constantes nomeadas em `alertas.ts`, sem tela de configuração nesta versão.

| Alerta                           | Regra                                                           | Leva para             | Onde vale             |
| -------------------------------- | --------------------------------------------------------------- | --------------------- | --------------------- |
| Pedido atrasado                  | 40 min ou mais pela regra da fila, ou 25 min ou mais na cozinha | Fila ou Cozinha       | Todos                 |
| Pagamento online pendente        | Aguardando pagamento há mais de 15 min                          | Pedidos filtrada      | Todos                 |
| Produto zerado                   | Estoque controlado com saldo 0 ou negativo                      | Estoque               | Quem controla estoque |
| Estoque baixo                    | Saldo no mínimo ou abaixo                                       | Estoque               | Quem controla estoque |
| Lote vencido ou vencendo         | Vencido ou vence em até 30 dias (`situacaoDoLote`)              | Lotes e validade      | Farmácia              |
| Receita esperando conferência    | Receita ainda não conferida                                     | Receitas              | Farmácia              |
| Pedido esperando pesagem         | `faltaPesar`                                                    | Fila                  | Açougue               |
| Loja fechada no horário de abrir | Fechada quando os horários dizem que devia estar aberta         | Configurações da loja | Todos                 |
| Meta do dia em risco             | Depois das 18h, abaixo do ritmo para bater a meta de hoje       | Resumo, bloco Meta    | Com meta definida     |

## Metas

- **Meta mensal** de faturamento e, opcionalmente, de pedidos. Fica salva por segmento, com as outras configurações locais do painel (zustand persistido).
- **Meta de hoje:** o que falta da meta do mês dividido pelos **dias de funcionamento** que restam no mês (contando hoje), pelos horários da loja.
- **Projeção:** a média dos dias abertos até agora vezes os dias abertos do mês. Só aparece a partir do **3º dia aberto** do mês; antes, "A projeção aparece a partir do 3º dia de funcionamento".
- **Sem meta:** o bloco mostra "Defina a meta do mês para acompanhar o ritmo" e o botão **Definir meta**, que abre o campo ali mesmo. Dá para mudar e apagar depois.
- Vale a meta definida agora. Não há histórico de metas antigas.

## Comparações

- **Período:** cada período continua comparado com o anterior, de mesmo tamanho.
- **Hoje:** comparado com o mesmo dia da semana passada, até a mesma hora. Se a loja estava fechada naquele dia, ou não vendeu nada até aquela hora, mostra "Sem base na {quinta} passada" em vez da porcentagem.
- **Sem comparação com o ano anterior:** os dados de demonstração cobrem só 90 dias.

## Atualização

- O **bloco Hoje e a faixa de alertas** se atualizam sozinhos a cada **30 s** (o `atualizarACada` que o `usePedidos` já aceita), com os números trocando pelo NumberFlow.
- As abas de análise não se atualizam sozinhas.
- Cada aba busca o período mais o anterior. A aba Clientes busca 90 dias. O React Query guarda o resultado para as outras abas reaproveitarem.

## Clicar para ver os pedidos

Todo número ou barra que representa pedidos leva para **Pedidos já filtrada** pela URL.

- A tela de Pedidos já aceita: período (`de`, `ate`, `data`), `busca`, `status`, `canal` e `pagamento`.
- Entram novos: **bairro, motoboy, cliente (telefone), motivo de cancelamento e origem.** Só pela URL, cada um como uma etiqueta removível no topo da lista ("Bairro: Centro ✕"), sem controle novo no painel de filtros. Cada filtro novo entra na etapa que precisa dele.

## Exportar e imprimir

- **CSV** de cada tabela das abas, gerado por uma função pura em `lib/`, sem biblioteca nova. Formato para o Excel em português:
  - separador `;`;
  - decimal com vírgula, sem "R$";
  - data `dd/mm/aaaa`;
  - UTF-8 com BOM;
  - nome `<loja>-<aba>-<de>-a-<ate>.csv`.
- **Imprimir** leva a aba aberta no período escolhido, com um cabeçalho (loja, período e data em que foi impresso), sem menus nem botões e com as tabelas abertas. Usa o `react-to-print`, que já está no projeto.
- Sem PDF gerado.

## Mudanças nos dados

O dashboard precisa de dados que o modelo não guarda. Estas mudanças saem da tela e valem para todo o painel.

### Horário de cada etapa

- Hoje o pedido só guarda `criadoEm` e `atualizadoEm` (a última mudança).
- O `Pedido` ganha `historico: { status, em }[]`, gravado a cada mudança de status, em todo o painel (Fila, Pedidos, PDV, Cozinha, Mesas, Garçom e pesagem).
- O gerador de demonstração passa a produzir o histórico com tempos realistas.

### Custo e margem

- Hoje o custo só existe em `estoque.custo`, nos produtos com estoque controlado, e a venda não guarda o custo.
- O `Produto` ganha um `custo` próprio, independente do estoque, editado no formulário do cardápio. O item vendido guarda **uma cópia do custo na hora da venda**, para a margem do passado não mudar quando o custo mudar.
- Item sem custo informado aparece como "sem custo" e fica fora da margem, com aviso de quantos são.

### Motivo do cancelamento

- Ao cancelar (hoje só em `components/admin/pedidos/detalhes-pedido.tsx`), a pessoa escolhe um motivo de uma lista fixa: cliente desistiu, sem estoque, fora da área, pagamento não aprovado, demora, loja fechou ou outro.
- O motivo é opcional, para não travar quem está com pressa. Sem motivo, entra como "Não informado".

### Taxas de pagamento

- A seção de pagamentos das Configurações da loja ganha a **% de cada forma**: crédito, débito e Pix online.
- Forma sem taxa informada conta como 0%, e o Financeiro mostra um aviso com link para configurar.

### Gerador de demonstração

- `VERSAO` sobe para 3, e os dados de demonstração são recriados.
- O gerador produz o histórico de status, o custo dos produtos e dos itens vendidos, os motivos de cancelamento e taxas plausíveis.

## Organização do código

- **Regras:** o `lib/admin/regras/dashboard.ts` atual vira a pasta `lib/admin/regras/dashboard/`, com funções puras por assunto: `comum.ts` (`ehValido`, `soma`, `noPeriodo`), `resumo.ts`, `alertas.ts`, `metas.ts`, `vendas.ts`, `produtos.ts`, `clientes.ts`, `operacao.ts`, `entrega.ts`, `financeiro.ts`, `salao.ts`, `farmacia.ts` e `acougue.ts`. A divisão do `resumir` atual é uma refatoração, feita com os testes verdes antes.
- **Componentes:** `components/admin/visao-geral/<aba>/`.
- **Gráficos:** o mapa de calor usa **só o azul do gráfico**, em 5 tons de opacidade, com o número da célula ao passar o mouse ou tocar. Todo gráfico tem uma **tabela equivalente**, recolhida na tela e sempre disponível para leitores de tela.

## Testes

Seguem o `CLAUDE.md`: TDD em tudo, uma fatia por vez.

- **Unitário** em cada função de `lib/`, com valores literais conhecidos.
- **Componente** por aba, com Testing Library (o que a pessoa vê e faz).
- **E2E** para navegar entre as abas e para o clique que abre Pedidos filtrada.
- **Screenshot** de cada aba no `tests/visual-admin.spec.ts`. O screenshot atual da Visão geral é atualizado **antes** de mexer no Resumo.
- Os mínimos de cobertura do `vitest.config.mts` sobem junto com a cobertura.

## Etapas

Cada etapa é um PR próprio para a `main`, em sequência, e o painel funciona ao fim de cada uma.

1. **Resumo:** estrutura das abas na URL, faixa de alertas, Hoje vs semana passada, atualização de 30 s, meta e bloco do segmento. Sem dado novo.
2. **Vendas:** mapa de calor, vendas por hora, canais e origem, troca Dia/Semana e a série cinza do período anterior.
3. **Base de dados:** histórico de status, custo no produto com cópia na venda, motivo de cancelamento, taxas de pagamento e gerador v3.
4. **Produtos e Financeiro:** dependem do custo e das taxas.
5. **Operação e Clientes:** dependem do histórico e do motivo.
6. **Entrega e abas do segmento.**
7. **CSV e impressão** em todas as abas.

## Fora desta versão

- Personalizar o layout (esconder, reordenar ou arrastar blocos).
- Bloquear análises pelo plano Pro.
- Cadastro de cliente (agrupamos pelo telefone).
- Métricas por profissional no salão.
- Mapa de entregas (sem coordenadas).
- Comparação com o ano anterior.
- Limites de alerta configuráveis.
- Histórico de metas.
- PDF gerado.
