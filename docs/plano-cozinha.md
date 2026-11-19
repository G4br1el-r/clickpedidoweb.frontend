# Plano da cozinha completa (KDS)

Base: a Fase 8 do [plano do painel](plano-painel-admin.md), que entregou o quadro A fazer → Preparando → Prontos. Este plano transforma a tela num KDS completo. Vale para os segmentos com cozinha: adega, açougue, pizzaria e lanchonete. Salão e farmácia não têm cozinha. Todos os dados continuam mockados. Este plano aguarda aprovação.

## Onde estamos hoje

- **Ticket:** um ticket por pedido. Na comanda, só a rodada mais nova aparece; as anteriores ficam apagadas como "já servido". Se a mesa manda a rodada 2 enquanto a 1 está no fogo, a rodada 1 some da vista.
- **Avanço:** o ticket inteiro avança por `proximoStatus`. Não existe voltar etapa, desfazer, prioridade nem pronto por item.
- **Tempos:** 15 e 25 min para atenção e atraso, e 15 min para o pronto sair da tela, todos fixos em `lib/admin/regras/cozinha.ts`.
- **Horários:** o pedido guarda só `criadoEm`, `atualizadoEm` e `impressoEm`. Não há horário de cada etapa, por isso não há métricas da cozinha.
- **Comunicação:** o garçom não sabe quando fica pronto. Um pedido cancelado some do quadro sem aviso. As telas se falam só pela consulta repetida ao servidor mockado.
- **Impressão:** só o cupom do pedido, impresso automaticamente na Fila. Não existe via de cozinha.
- **Plano Pro:** cobre só a aparência do site (`CATALOGO_PRO`). Nada do painel de operação é Pro.
- **Tempo da loja:** `tempoEntrega` e `tempoRetirada` são texto livre ("30–50 min"). O pedido não tem horário prometido nem agendamento, fora o salão e a data de retirada do açougue.

## Decisões

O alvo é um **tablet deitado** operado com o dedo. Há um **modo TV** só de leitura, e o celular continua com as abas de coluna.

### Quadro

1. **Ticket por rodada:** cada rodada de comanda é um ticket próprio ("Mesa 5 · rodada 2"). A rodada 1 em preparo não some quando chega a 2.
2. **Pronto por item:** o cozinheiro toca no item para riscar, e o ticket mostra o andamento ("2 de 4"). "Marcar pronto" risca tudo.
3. **Desfazer:** um toast de alguns segundos depois de cada avanço.
4. **Voltar etapa no ticket:** de Pronto para Preparando, e de Preparando para A fazer.
5. **Prioridade:** cozinha, caixa (Fila e Pedidos) e garçom podem marcar. O ticket fica no topo da coluna, com destaque. Não há arrastar para reordenar; a ordem segue a chegada.
6. **Cancelado e alterado:** o pedido cancelado, ou o item tirado de uma comanda que já estava na cozinha, fica no quadro riscado e marcado **CANCELADO** (ou **ALTERADO**). Toca um som insistente até alguém tocar em **Ciente**. A cozinha não cancela, só toma ciência.
7. **Esgotar:** "Acabou" num item do ticket ou no resumo de produção. O produto sai da vitrine na hora (`useAlternarProduto`). A lista de esgotados permite devolver o produto quando voltar.
8. **Resumo de produção ("all day"):** um painel recolhível à direita soma por produto o que está aberto ("7× X-Burger"), filtrado pela praça. Tocar num produto destaca os tickets que têm aquele item. No celular, vira o botão "Em produção (12)", que abre uma gaveta de baixo com duas abas: Em produção e Esgotados.
9. **Tamanho e densidade:** A− / A+ e "compacto", guardados por aparelho.
10. **Atalhos de teclado** (só no desktop):
    - setas escolhem o ticket;
    - Enter avança;
    - Z desfaz;
    - P marca prioridade;
    - 1 a 9 riscam itens;
    - ? mostra a lista de atalhos.

### Praças e expedição

11. **Praças cadastradas na aba Ajustes.** Cada praça tem:
    - nome e cor (o traço do painel);
    - as categorias ligadas a ela;
    - se imprime a via e se toca som.

    O formulário do produto ganha um campo "Praça" opcional, que sobrepõe a da categoria. Uma categoria sem praça cai em "Geral". Cada segmento da demo vem com praças prontas, como na pizzaria: Forno, Montagem e Bebidas.
12. **Praça por aparelho:** um seletor no topo, persistido como o som, com "Todas" de padrão. Sem praças cadastradas, o seletor não aparece.
13. **Fluxo entre praças:**
    - "Iniciar preparo" vale para o ticket inteiro, e qualquer praça pode tocar.
    - Na visão de uma praça, o ticket mostra só os itens dela, mais uma linha com o que falta nas outras ("Fritura: 2 itens").
    - O botão vira "Pronto na Chapa" e risca só os itens dela.
    - O ticket vai para Prontos sozinho quando todos os itens estão riscados.
    - A visão "Todas" é a expedição: o "Marcar pronto" dela risca tudo.
14. **Via de cozinha impressa:**
    - a impressão é por praça e automática quando a rodada chega;
    - a via traz só os itens da praça, em letra grande e sem preço;
    - o ticket e o histórico têm a ação "Reimprimir".

### Tempo

15. **Tempos de alerta configuráveis na aba Ajustes**, com 15 e 25 min de padrão. Na mesma aba fica quanto tempo o pronto continua na tela, com 15 min de padrão.
16. **Tempo de preparo por produto:** um campo opcional no formulário do produto. Quando existe, a urgência conta a partir dele: uma pizza de 20 min só atrasa depois de 20 min.
17. **Disparo:** com tempos diferentes no mesmo ticket, cada item diz quando começar, para tudo ficar pronto junto ("comece agora" / "comece em 12 min").
18. **Tempo da loja em minutos:** a loja informa mínimo e máximo para entrega e para retirada, e o texto da vitrine é gerado a partir desses números. O ticket de entrega e de retirada mostra o horário prometido ("sai até 19:40") e quanto falta, além de quanto já passou.
19. **Agendados:**
    - o pedido ganha um "agendado para";
    - o PDV e o garçom podem marcar "para as 20:00", e o gerador da demo cria alguns;
    - o pedido fica numa faixa **Mais tarde** e entra em A fazer quando chega a hora de começar (o horário agendado menos o tempo de preparo).

    Deixar o cliente agendar no checkout da vitrine fica fora deste plano.

### Salão e Fila

20. **Saída de Prontos:** o ticket sai quando a próxima etapa acontece:
    - mesa: o garçom toca **Servido**;
    - entrega: a Fila marca "Saiu para entrega";
    - retirada: a Fila marca "Concluído".

    O tempo configurado do item 15 é só a rede de segurança.
21. **Aviso ao garçom:** quando a rodada da mesa fica pronta, o Garçom e Mesas mostram o selo "Pronto para servir", tocam um som e ganham o botão **Servido**. Na entrega e na retirada, o aviso vai para a Fila.
22. **Mensagens rápidas:** a cozinha manda mensagens fixas, sem texto livre, presas ao ticket. O garçom ou a Fila veem o aviso na mesa ou no cartão. As mensagens são:
    - "Vai atrasar ~10 min";
    - "Acabou um item, ver substituição";
    - "Dúvida no pedido, venha à cozinha".

### Sons

23. **Um som para cada evento**, cada um com chave própria nos Ajustes:
    - pedido ou rodada nova;
    - cancelado ou alterado (insistente até o Ciente);
    - ticket que ficou atrasado (curto);
    - opção de repetir o alerta de pedido novo até alguém iniciar.

### Histórico e refazer

24. **Aba Histórico:**
    - hoje por padrão, com escolha de data;
    - busca por número, mesa ou cliente, e filtro por tipo;
    - cada ticket abre uma linha do tempo (chegou, iniciou, cada praça pronta, saiu), com a duração de cada etapa;
    - ações Refazer e Reimprimir.
25. **Refazer:** o ticket volta para A fazer marcado **REFAZER**, com o motivo (errado, caiu, reclamação, outro) e só os itens escolhidos. O status do pedido, o pagamento e a conta não mudam. Conta como retrabalho nas métricas.

### Desempenho

26. **Faixa do turno no topo do Quadro:** tempo médio de preparo de hoje, tickets que saíram, atrasados agora e o item mais pedido.
27. **Aba Desempenho:**
    - período de hoje, 7 dias ou 30 dias;
    - números principais: tempo médio da chegada ao pronto, % no prazo, tickets, retrabalho e cancelados depois de iniciados;
    - volume e tempo médio por hora do dia;
    - tempo por praça, produtos mais demorados contra o tempo cadastrado e tempo por tipo de pedido.

    Segue a skill de dataviz e o DESIGN.md.

### Telas novas

28. **Navegação:** abas no topo da Cozinha: **Quadro · Histórico · Desempenho · Ajustes**. Modo TV e Chamada ficam no menu "⋯" do cabeçalho, ao lado de Tela cheia.
29. **Modo TV** (`/admin/cozinha/tv`): o quadro em letra grande, sem botões, que pagina sozinho quando não cabe. A praça vem no link.
30. **Painel de chamada** (`/admin/cozinha/chamada`): virado para o cliente da retirada e do balcão, com as colunas "Preparando" e "Pode retirar". Mostra só o número do pedido e toca um som de chamada quando fica pronto.

### Segmentos

31. **Pizzaria:** sabores em frações ("½ Calabresa / ½ Portuguesa"), borda em destaque e tamanho no topo.
32. **Açougue:** corte e modo de preparo grandes e o peso pedido. O açougueiro pesa no próprio ticket, com o componente de pesagem que já existe.
33. **Adega:** os combos abertos em itens ("Combo Gin: 1× Gin, 2× Tônica, gelo").
34. **Lanchonete:** o número do mês, grande.

### Plano Pro

35. **Grátis:**
    - o quadro;
    - ticket por rodada, riscar item, resumo de produção;
    - desfazer, voltar, histórico e refazer;
    - prioridade, cancelado e ciente, esgotar;
    - aviso ao garçom, mensagens, tempos da loja e sons.

    **Pro (com cadeado):**
    - mais de uma praça;
    - modo TV e painel de chamada;
    - aba Desempenho;
    - tempo de preparo por produto com disparo;
    - via de cozinha impressa.

    Os recursos Pro entram no `CATALOGO_PRO` e na sacola do painel, como os de aparência.

### Fora deste plano

- **Perfis e login de cozinheiro** ("quem está na chapa"). É uma decisão do painel inteiro, e o Desempenho mede por praça.
- **Agendar pedido no checkout da vitrine.**

### Dados da demo

O gerador determinístico passa a criar:

- o horário de cada etapa;
- praças por segmento e categoria;
- tempo de preparo dos produtos;
- alguns pedidos agendados, refazer e cancelamentos depois de iniciados.

Assim o Histórico e o Desempenho abrem com 90 dias de números.

## Fases

Cada fase segue TDD e só fecha com `pnpm check` e `pnpm test:e2e:rapido` verdes. Mudança visual leva screenshot revisado. Cada fase vira um commit neste branch, e o trabalho para no fim de cada uma para revisão.

1. **Base de dados:** horário de cada etapa, rodada como unidade da cozinha, item feito, prioridade e as transições de volta, no modelo e no servidor mockado.
2. **Quadro:** ticket por rodada, riscar item, desfazer e voltar, prioridade, cancelado/alterado com Ciente, esgotar.
3. **Salão:** Servido no Garçom e em Mesas, saída de Prontos, aviso de pronto, mensagens rápidas.
4. **Tempo e ajustes:**
   - tempos da loja em minutos;
   - pedido agendado (no modelo, no PDV, no garçom e no gerador), horário prometido e faixa Mais tarde;
   - tempos de alerta configuráveis;
   - sons por evento;
   - aba Ajustes e navegação por abas.
5. **Produção:** praças e expedição, resumo de produção e esgotados, via impressa por praça, tamanho e densidade, atalhos.
6. **Histórico e refazer.**
7. **Desempenho:** faixa do turno, aba Desempenho e o gerador de dados da demo.
8. **Pro:** modo TV, painel de chamada, tempo por produto com disparo e cadeados no `CATALOGO_PRO`.
9. **Segmentos:** pizzaria, açougue com pesagem, adega e lanchonete.

## Fase 1: base de dados

**Desenho**

- **O horário fica no item.** Além de `rodada` e `lancadoEm` (a chegada), o item ganha:
  - `iniciadoEm`: quando a rodada começou a ser preparada;
  - `feitoEm`: quando o item foi riscado.

  O estado de cada rodada sai dos itens: nenhum iniciado é **A fazer**, algum iniciado é **Preparando**, todos riscados é **Pronto**. Não existe uma segunda lista de rodadas para manter em dia.
- **O status do pedido acompanha a rodada mais atrás:** alguma nova dá `recebido`, alguma em preparo dá `em-preparo`, todas prontas dá `pronto`. Fila e Mesas continuam iguais.
- **O caminho inverso:** quando a Fila avança o pedido inteiro, os itens da cozinha acompanham. Em preparo inicia todas as rodadas; pronto risca o que faltava. O que já tinha hora guarda a sua.
- **O pedido ganha dois campos:**
  - `etapas`: a hora em que entrou em cada status. É gravada em toda mudança e no pedido novo. Voltar apaga as etapas que vinham depois.
  - `prioridade`: vale para o pedido inteiro.
- **Regras puras** em `lib/admin/regras/cozinha.ts`: `ticketsDaCozinha`, `statusPelasRodadas`, `avancarRodada`, `voltarRodada` e `riscarItem`. O servidor e a previsão otimista dos hooks usam as mesmas funções.
- **Servidor:** `cozinha.avancar`, `cozinha.voltar`, `cozinha.riscar` e `pedidos.priorizar`. Os dados guardados sobem para a versão 3, e a demo é gerada de novo.
- **Gerador:** os horários são calculados sem sortear de novo, para não mudar os outros pedidos:
  - o preparo começa 2 a 5 min depois da chegada;
  - fica pronto 8 a 15 min depois;
  - a entrega sai 3 a 8 min depois de pronta.

  A venda concluída no balcão não passa pela cozinha.
- **O agendado foi para a Fase 4**, onde é usado.

**Fronteiras de teste**

1. **`ticketsDaCozinha`** (função pura):
   - um ticket por rodada, com o estado tirado dos itens;
   - pronto com tudo riscado;
   - a chegada vem do lançamento da rodada ou da criação do pedido;
   - ficam de fora o salão, a comanda sem cozinha e o que não está na cozinha.
2. **Servidor:**
   - cada rodada anda sozinha e o pedido acompanha a mais atrasada;
   - voltar de Pronto para Preparando e de Preparando para A fazer;
   - recusa o ticket que já mudou;
   - riscar item, inclusive num ticket de A fazer, e desriscar;
   - só risca item da cozinha;
   - a Fila avançando move os tickets;
   - a hora de cada etapa, e voltar apaga as seguintes;
   - todo pedido novo nasce com a hora da chegada;
   - prioridade só em pedido em andamento;
   - o dia que passou encerra com a hora.
3. **Hooks:** avançar, voltar, riscar e prioridade aparecem no quadro sem recarregar.
4. **Gerador:** cada pedido traz a hora de cada etapa, em ordem e até agora, e a cozinha bate com o status.

As fronteiras de cada fase seguinte são escritas no início dela, como foi feito no plano do painel.

## Fase 2: quadro

**Desenho**

- **Ticket por rodada na tela:** o quadro monta as colunas com `colunasDaCozinha`, uma rodada por ticket. A partir da 2ª rodada, o cabeçalho mostra "2ª rodada". O bloco "Já servido" saiu.
- **Riscar item:** cada linha é um `Checkbox` com rótulo, e a linha inteira é o alvo de toque. O rodapé mostra o andamento ("1 de 2"). Riscar o último item leva o ticket para Prontos.
- **Menu "⋯" do ticket:**
  - Prioridade (liga e desliga);
  - Voltar para A fazer, ou Voltar para Preparando;
  - Acabou…, com os produtos do ticket que ainda estão à venda.
- **Desfazer:** o toast de 6 s com Desfazer aparece depois de Iniciar preparo, Marcar pronto, Voltar e Acabou.
- **Prioridade:** o ticket fica no topo da coluna, com o anel e o raio no laranja de atenção. O texto "Prioridade" fica na tinta.
- **Avisos para a cozinha** (`Pedido.avisosCozinha`):
  - o servidor grava um aviso ao cancelar um pedido que já tinha chegado à cozinha;
  - também grava ao tirar ou diminuir um item de um ticket que ainda está na tela;
  - o cancelado fica tachado, marcado "Cancelado" e com o botão Ciente, e o preparo dele não anda;
  - o alterado mostra a faixa "Alterado: tirou 2× …" com Ciente;
  - a rodada que ficou sem itens continua na tela até o ciente;
  - o Ciente vale para todas as telas;
  - o aviso novo toca o alerta uma vez.
- **Lista da cozinha:** um filtro novo no servidor, `naCozinha`, traz o que está com a cozinha e o cancelado ainda sem ciente.
- **Prontos:** o tempo na coluna conta do último item riscado, e não mais do `atualizadoEm`. Por isso os prontos da demonstração passaram a aparecer.
- **Cronômetro:** passou a ser de cada ticket (`urgenciaNaCozinha(ticket)`).
- **Cabeçalho do ticket:** quebra linha em coluna estreita. No tablet com a lateral aberta, o tempo e o menu passavam da borda.

**Ambiente de teste**

- O Playwright lê a porta de `PORTA_E2E` (o padrão continua 3010). Com o reaproveitamento ligado, outra worktree na mesma porta era testada no lugar desta.
- Os screenshots escondem `nextjs-portal`, a camada de desenvolvimento do Next 16.4. O selo "Insights", com o aviso de segurança, aparecia mesmo com `devIndicators: false` e quebrava todas as comparações.

**Fronteiras de teste**

1. **Regras:**
   - cada rodada na coluna da sua etapa;
   - o filtro continua valendo;
   - a prioridade vai para o topo;
   - o cancelado fica até o ciente;
   - o alterado fica no ticket da rodada, e a rodada esvaziada continua;
   - o cronômetro é de cada rodada;
   - novidades para o alerta.
2. **Servidor:**
   - aviso ao cancelar, e só para o que já chegou à cozinha;
   - aviso ao tirar ou diminuir um item;
   - o ciente, e o cancelado não anda mais;
   - a lista da cozinha.
3. **Hooks:** o ciente tira o ticket do quadro.
4. **Tela:**
   - a rodada nova é outro ticket;
   - riscar item;
   - voltar pelo menu;
   - Desfazer;
   - prioridade;
   - cancelado e alterado com Ciente;
   - Acabou com Desfazer.
5. **Screenshots:** a cozinha nas 11 telas, revisados antes de atualizar.
