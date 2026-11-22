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

## Fase 3: salão

**Desenho**

- **Servido:** o item ganhou `servidoEm`.
  - O garçom toca Servido e a rodada pronta inteira sai da cozinha (`servirRodada`); só rodada pronta pode ser servida.
  - O status da comanda não muda: a mesa só conclui quando a conta fecha.
  - A comanda toda servida não tem mais rodada na cozinha e continua pronta.
- **Pronto para servir:**
  - `estadoDaMesa` ganhou o estado "Pronto para servir" (tom pronto), que vem antes de "Na cozinha";
  - a comanda aberta em Mesas mostra cada rodada pronta com o botão Servido;
  - Garçom e Mesas mostram no topo a faixa **Prontos para servir**, com as rodadas prontas de todas as mesas (Servido) e as mensagens da cozinha (Ok). A faixa some quando não há nada.
- **Saída de Prontos:** a mesa sai quando é servida; entrega e retirada saem quando a Fila avança; continua a rede de segurança de 15 min.
- **Mensagens rápidas** (`Pedido.mensagensCozinha`):
  - o menu "⋯" do ticket ganhou "Avisar o salão…" (mesa) ou "Avisar o caixa…" (entrega e retirada), com as três mensagens fixas;
  - a mesma mensagem pendente não se repete na rodada;
  - o ticket mostra "Avisado: …" até alguém dar Ok;
  - a mensagem da mesa aparece na faixa do Garçom e de Mesas, com Ok, e no cartão da mesa. O Ok fica na faixa, porque o cartão inteiro já é um botão;
  - a da entrega e da retirada aparece no cartão da Fila, com Ok.
- **Som:** Garçom e Mesas ganharam a chave "Alerta sonoro", a mesma preferência do aparelho. O som toca quando uma rodada fica pronta ou chega mensagem (`chavesDeQuemServe`). A Fila toca também quando uma entrega ou retirada fica pronta.
- **Confirmação ao tirar item:** `cozinhaJaPreparou` olha a rodada do item, não o status da comanda. Uma rodada nova, que ainda não começou, sai sem pergunta.
- **Demo:** o gerador serve a rodada pronta da mesa 3 a 6 min depois de pronta, se já deu tempo. `VERSAO` subiu para 4, e a base guardada é gerada de novo.

**Fronteiras de teste**

1. **Regras:**
   - `servirRodada`;
   - a rodada servida sai dos tickets;
   - `prontosParaServir`;
   - `estadoDaMesa` com "Pronto para servir";
   - `cozinhaJaPreparou` por rodada;
   - as mensagens;
   - `chavesDeQuemServe`.
2. **Servidor:**
   - `cozinha.servir`;
   - `cozinha.avisar`;
   - `pedidos.verMensagem`;
   - o gerador com `servidoEm`.
3. **Hooks:** servir tira o ticket do quadro; a mensagem aparece e o Ok tira.
4. **Tela:**
   - Cozinha: "Avisar o salão…", "Avisar o caixa…" e a linha Avisado;
   - faixa Prontos para servir: Servido, mensagem com Ok, alerta;
   - Garçom: a faixa e a chave do alerta;
   - Mesas: o estado, a mensagem no cartão, Servido na comanda e a chave do alerta;
   - Fila: a mensagem com Ok e o alerta de pronto.
5. **E2E:** o fluxo do salão passa pela faixa do Garçom e pelo Servido na comanda antes de fechar a conta.

## Fase 4: tempo e ajustes

**Desenho**

- **Tempos da loja em minutos:** a loja guarda o mínimo e o máximo da entrega e da retirada (`prazos`). Ao salvar, o servidor gera o texto da vitrine ("35–50 min", ou "15 min" quando os dois são iguais), e a vitrine continua lendo o texto. O salão não tem cozinha e segue com o texto livre.
- **Horário prometido:** o ticket de entrega e o de retirada mostram "até 19:40 · faltam 12 min", e depois "passou 3 min" em vermelho. O horário é a criação do pedido mais o tempo máximo, ou o agendado. A mesa não tem horário prometido.
- **Agendado:** `agendadoPara` fica nos itens da rodada, como o `lancadoEm`.
  - O PDV, no modo "Mandar para a fila", e o garçom, ao lançar uma rodada para a cozinha, têm um campo opcional "Para as", só para hoje e sempre no futuro.
  - O servidor recusa horário no passado ou de outro dia.
  - O gerador da demo acrescenta, no fim do movimento de agora, uma entrega e uma retirada agendadas para a meia hora cheia uma hora e meia e uma hora depois. Ficam no fim para não mudar o sorteio dos pedidos de antes.
- **Faixa Mais tarde:**
  - o ticket agendado fica acima do quadro até a hora de começar: o agendado menos o tempo mínimo de retirada da loja (o tempo de preparo por produto chega na Fase 8);
  - quando entra em A fazer, toca o alerta, e a urgência conta a partir dessa hora;
  - cada agendado é um cartão compacto em grade, como a faixa Prontos para servir, com a hora, o pedido, quando começa e "Iniciar agora", que adianta;
  - o cartão da Fila ganha o selo "Para 20:00".
- **Tempos de alerta da loja:** atenção (15 min), atraso (25 min) e quanto o pronto fica na tela (15 min), guardados na loja e válidos para todos os aparelhos. Atenção menor que atraso, os dois entre 1 e 120 min, e o pronto entre 1 e 60 min.
- **Sons por evento, no aparelho:** o "Alerta sonoro" continua sendo a chave geral. Cada evento tem a sua chave e o seu som:
  - pedido ou rodada nova (ligada);
  - cancelado ou alterado, repetindo a cada 5 s até o Ciente (ligada);
  - ticket que ficou atrasado, um toque curto (ligada);
  - repetir o alerta de novo a cada 30 s enquanto houver ticket em A fazer (desligada).
- **Abas:** Quadro · Ajustes no topo da Cozinha, guardadas no endereço (`?aba=ajustes`). Histórico e Desempenho entram nas Fases 6 e 7. A aba Ajustes tem "Tempos da cozinha" (da loja, com Salvar) e "Sons deste aparelho" (salvam na hora), e um link para os tempos de entrega e retirada na tela Loja.

**Fronteiras de teste**

1. **Regras:**
   - o texto gerado dos números;
   - o horário prometido e o que falta ou passou;
   - o agendado da rodada e a hora de começar;
   - a faixa Mais tarde fora das colunas;
   - a urgência e o pronto com os tempos da loja;
   - o alerta quando o agendado entra em A fazer;
   - os eventos de som.
2. **Servidor:**
   - salvar a loja gera o texto;
   - "Para as" no PDV e no garçom, e a recusa;
   - salvar os tempos da cozinha, com a validação;
   - o gerador com agendados;
   - a versão dos dados sobe para 5.
3. **Hooks:** salvar os tempos muda o quadro sem recarregar.
4. **Tela:**
   - Cozinha: abas, Ajustes, Mais tarde com Iniciar agora, o horário prometido e os sons;
   - PDV e Garçom: "Para as";
   - Loja: mínimo e máximo;
   - Fila: o selo.
5. **E2E e screenshots:** agendado do PDV em Mais tarde, o tempo de atraso mudado nos Ajustes, e os screenshots revisados da Cozinha, do PDV e da Loja.

## Fase 5: produção

A fase sai em dois commits, com revisão entre eles: **5a** (praças, expedição, via impressa e som por praça) e **5b** (resumo de produção, esgotados, tamanho e densidade, atalhos).

**Desenho**

- **Praças:**
  - a loja guarda as praças (`ConfigLoja.pracas`): nome, cor de uma paleta de 6 tons (o traço), categorias ligadas, se imprime a via e se toca som;
  - uma categoria fica em uma praça só;
  - o cadastro fica na aba Ajustes da Cozinha, seção Praças, com lista e janela de edição;
  - o produto ganha o campo opcional "Praça", que vale mais que a da categoria;
  - a demo vem com praças: pizzaria (Forno, Montagem, Bebidas), lanchonete (Chapa, Fritura, Bebidas), adega (Bar, Balcão) e açougue (Corte, Balcão).
- **Praça do item:** calculada na hora pelo cardápio atual: a do produto, senão a da categoria, senão **Geral**. O item avulso vai para Geral. Mudar a praça vale na hora, até nos tickets abertos; o desempenho por praça (Fase 7) usa o cadastro atual.
- **Praça por aparelho:** seletor no topo do Quadro, "Todas" e cada praça, guardado no aparelho. Sem praças, não aparece.
- **Quadro de uma praça:**
  - o ticket mostra só os itens da praça e a linha "Falta: Montagem 2, Bebidas 1";
  - o ticket sem itens da praça não aparece;
  - a coluna sai dos itens da praça: com os dela riscados, vai para Prontos da praça, "aguardando" as outras;
  - "Iniciar preparo" vale para o ticket inteiro; "Marcar pronto · Forno" risca só os itens da praça (o nome da praça pode ser feminino, e "no/na" não dá para escolher sozinho);
  - com tudo riscado, o ticket fica pronto sozinho;
  - "Todas" é a expedição, como o quadro de hoje.
- **Som por praça:** o aparelho de uma praça só toca para ticket com itens dela, e não toca se a praça estiver com som desligado. "Todas" toca para tudo.
- **Via impressa:**
  - chave por aparelho "Imprimir as vias neste aparelho", desligada de fábrica;
  - o aparelho imprime sozinho a via da sua praça (em "Todas", a de cada praça que imprime) quando a rodada chega em A fazer; na primeira leitura, o que já estava na tela não sai (ligar no meio do serviço não imprime tudo de uma vez);
  - as vias do mesmo pedido são marcadas uma de cada vez: duas gravações ao mesmo tempo apagariam uma marca;
  - o servidor marca a via impressa por rodada e praça, para dois aparelhos não repetirem;
  - a via tem letra grande e não tem preço: "MESA 5 · 2ª rodada · FORNO · 20:31 · #1410", os itens com opções e observação;
  - "Reimprimir via" no menu do ticket;
  - sem praças, uma via só (Geral), com a chave da loja "Imprimir a via da cozinha".
- **Resumo de produção (5b):** soma A fazer e Preparando por produto ("7× X-Burger"), seguindo a praça e o filtro. No desktop, painel à direita que abre e fecha; tocar num produto destaca os tickets dele e apaga os outros. No celular, botão "Em produção (12)" com gaveta de baixo, abas Em produção e Esgotados. Cada linha tem "Acabou".
- **Esgotados (5b):** os produtos à venda que estão esgotados, com "Voltou", na aba Esgotados do painel.
- **Tamanho e densidade (5b):** no aparelho; o botão "Exibição" abre A−, A+ (4 tamanhos) e "Compacto", que esconde cliente e garçom e aperta os espaços. O tamanho muda a escala só do quadro.
- **Atalhos (5b, só no desktop):** setas movem o foco entre os tickets (← → colunas, ↑ ↓ na coluna); Enter avança; P prioridade; 1 a 9 riscam itens; Z desfaz a última ação com Desfazer; ? abre a lista. Não valem com campo, menu ou janela aberta.

**Fronteiras de teste**

1. **Regras (5a):** praça do item (produto, categoria, Geral, avulso); tickets e colunas de uma praça, com "Falta" e "aguardando"; pronto na praça; som por praça; vias a imprimir, sem repetir; validação do cadastro (nome, categoria em uma praça só).
2. **Servidor (5a):** salvar praças; praça no produto; pronto na praça; marcar a via impressa; praças da demo.
3. **Tela (5a):** Ajustes > Praças; campo Praça no produto; seletor de praça; quadro da praça com "Pronto no Forno"; via impressa e "Reimprimir via", com o `react-to-print` simulado.
4. **Regras e tela (5b):** resumo somado e destaque; esgotados com "Voltou"; tamanho e compacto guardados no aparelho; cada atalho.
5. **E2E e screenshots:** pizzaria: o Forno marca pronto, depois a Montagem, e o ticket vai para Prontos na expedição; o resumo no desktop e a gaveta no celular; screenshots revisados da Cozinha, dos Ajustes e da via.

**Na implementação (5b)**

- **Resumo:** soma só o que falta: o item já riscado e o pedido cancelado (esperando o ciente) não contam. O avulso soma pelo nome. No empate, a ordem é a do nome.
- **Gaveta do celular:** tocar num produto fecha a gaveta e destaca os tickets dele (a gaveta cobria o quadro).
- **Acabou:** só aparece no produto que ainda está à venda. O aviso tem Desfazer. A aba Esgotados também fica no painel do desktop.
- **Tamanho:** 85%, 100%, 115% e 130%, com `zoom` só na área das colunas. A barra e o resumo não mudam.
- **Atalhos:**
  - na praça, o Enter no ticket em preparo faz o "Marcar pronto · Forno";
  - o Z vale enquanto o aviso com Desfazer está na tela;
  - os números não riscam item de pedido cancelado, como o clique.

## Fase 6: histórico e refazer

**Desenho**

- **O que entra no Histórico:** cada rodada que foi para a cozinha e chegou no dia escolhido, inclusive as que já saíram, as canceladas e as que ainda estão no quadro ("No quadro"). A venda de balcão que não passou pela cozinha fica de fora.
- **Lista:** no desktop, tabela com a chegada, o ticket, o resumo dos itens, o tempo até ficar pronto (âmbar quando passou do atraso) e como terminou: Servido, Saiu para entrega, Retirado, Entregue, Cancelado, Pronto ou No quadro, mais a marca Refeito. No celular, cartões.
- **Linha do tempo:** chegou, iniciou, cada praça pronta (o último item dela riscado), pronto e saiu, com a duração de cada passo; os avisos com o ciente e os refazer ligados ao ticket; os itens com as opções. Abre num painel à direita no desktop e numa gaveta no celular.
- **Dia:** atalhos Hoje e Ontem e um calendário dos 90 dias. O dia fica no endereço (`?aba=historico&dia=2026-11-13`).
- **Busca e filtros:** a busca entende número ("1410", "#1410"), mesa ("mesa 5") e nome do cliente, sem acento nem maiúscula. Filtro de tipo (Todos, Mesas, Entrega, Retirada) e de situação (Todos, Atrasados, Cancelados, Refeitos).
- **Refazer guardado à parte:** o pedido ganha `refacoes`, cada uma com número, rodada, motivo, texto, hora e as cópias dos itens escolhidos, com os próprios horários de preparo. A cozinha mostra cada refazer como um ticket ("pedido:rodada:rN"), que inicia, risca, avança, volta e sai como os outros. Os itens, o total, o pagamento, o cupom e o status do pedido não mudam.
- **De onde se refaz:** no detalhe do Histórico e no menu "⋯" do ticket em Prontos. A janela tem os itens com a quantidade (de fábrica, tudo) e o motivo: Errado, Caiu, Reclamação ou Outro, com texto curto opcional.
- **Quando pode:** só o ticket de hoje que já ficou pronto ou já saiu, de pedido não cancelado. Em A fazer e Preparando corrige-se com voltar ou desriscar. Nos dias anteriores, o Histórico só mostra e reimprime.
- **No quadro:** o ticket entra em A fazer marcado **REFAZER · Caiu**, no topo da coluna como prioridade, toca o alerta de novo e imprime a via com "REFAZER" (com as vias ligadas). Mostra só os itens escolhidos e segue as praças.
- **Saída de Prontos:** na mesa, o garçom toca Servido (o Garçom e Mesas mostram "Pronto para servir"). Na entrega e na retirada, sai pelo tempo de segurança dos Ajustes ou pelo botão **Entregue** no ticket.
- **Reimprimir** no Histórico: a via da praça do aparelho, ou uma por praça em "Todas", de qualquer dia, sem depender da chave de imprimir as vias.
- **Dados da demo:** refazer e cancelamento depois de iniciado entram no gerador na Fase 7. O Histórico abre com os 90 dias que já existem.

**Fronteiras de teste**

1. **Regras:** os tickets do dia, com busca, filtros e como terminou; a linha do tempo (etapas, praças, durações); a validação do refazer (só hoje, já pronto, itens e quantidade, motivo); o refazer como ticket da cozinha (iniciar, riscar, avançar, voltar, servir, entregar) sem mudar status, itens e total do pedido.
2. **Servidor:** criar o refazer e mexer no ticket dele; o pedido original fica igual.
3. **Tela:** aba Histórico (lista, dia, busca, filtros), detalhe com linha do tempo e Reimprimir, janela de refazer no Histórico e no menu do ticket em Prontos, ticket REFAZER no quadro, Servido no Garçom e Entregue em Prontos.
4. **E2E e screenshots:** pizzaria: abrir o Histórico, buscar, abrir a linha do tempo, refazer com motivo Caiu e ver o ticket REFAZER em A fazer; screenshots revisados do Histórico (desktop e celular), do detalhe e da janela de refazer.

**Na implementação (6)**

- A linha do tempo mostra o pronto de cada praça só quando o ticket passa por mais de uma: com uma praça só, ele repetiria o Pronto.
- O botão de cada linha do Histórico tem o nome do ticket como texto (a verificação de acessibilidade pede que o nome bata com o que se vê).
- No servidor, a hora do aparelho decide o "hoje": antes dela, o Histórico mostra o esqueleto (sem isso, a data do servidor e a do navegador divergiam).

## Fase 7: desempenho

**Desenho** (das decisões 26 e 27 e dos dados da demo)

- **Faixa do turno**, no topo do Quadro, na régua do painel: tempo médio até pronto de hoje, prontos hoje, atrasados agora e o item mais pedido. Grátis.
- **Aba Desempenho**, entre Histórico e Ajustes: período Hoje, 7 dias ou 30 dias.
  - Régua: tempo até pronto, % no prazo (abaixo do atraso da loja), tickets (com os cancelados depois de iniciar) e retrabalho (refazer sobre tickets).
  - Gráfico de tickets por hora da chegada, uma série, com o tempo médio na dica.
  - Listas com barra: por praça (da chegada ao último item dela), por tipo de pedido e os cinco produtos mais demorados (da chegada ao item riscado).
  - O cancelado e o refazer não entram no tempo médio; o refazer conta só no retrabalho.
- **Demo:** um em cada três cancelados da cozinha foi cancelado depois de iniciar, e um em cada 23 pedidos que saíram teve um item refeito, com horários sem sorteio novo. `VERSAO` 7.

**Fronteiras de teste**

1. **Regras:** resumo do turno, números do período, por hora, por tipo, por praça e produtos mais demorados.
2. **Gerador:** cancelados depois de iniciar e refazer, com horas em ordem e até agora.
3. **Tela:** a faixa, a régua e as listas com valores literais; a aba com período e listas na página.
4. **E2E e screenshots:** a faixa e a aba Desempenho do mês, desktop e celular.

**Na implementação (7)**

- A demo abre pedidos do dia a qualquer hora, então os números na tela são testados nos componentes que recebem os valores prontos; a página confere só que eles aparecem.

## Fase 8: Pro

**Desenho** (da decisão 35)

- **Chaves no `CATALOGO_PRO`:** `cozinha.pracas` (mais de uma praça), `cozinha.tv` (modo TV), `cozinha.chamada` (painel de chamada), `cozinha.desempenho` (aba Desempenho), `cozinha.tempoPreparo` (tempo de preparo por produto) e `cozinha.via` (via impressa sozinha). Elas não são campos da aparência, então nunca entram na sacola sozinhas: o cadeado mostra o preço e o botão Contratar, e o "Liberar todos" da lateral libera junto.
- **O que fica com cadeado:** a aba Desempenho (a faixa do turno continua grátis); "Nova praça" quando já existe uma (as praças da demo continuam funcionando); as chaves de imprimir a via sozinha (o Reimprimir manual continua grátis); o campo de tempo de preparo do produto e o disparo nos tickets; o modo TV e o painel de chamada.
- **Modo TV** (`/admin/cozinha/tv`, praça no endereço): só leitura, letra grande, as três colunas, tela inteira por cima da lateral. Quando os tickets não cabem, pagina sozinho a cada 8 s, com "1/2" no canto.
- **Painel de chamada** (`/admin/cozinha/chamada`): para o cliente da retirada (do site e do balcão). Colunas "Preparando" e "Pode retirar", só o número do pedido, grande. O número que chega em "Pode retirar" toca o som de chamada. Sai quando a retirada é concluída.
- **Tempo de preparo por produto:** campo opcional (1 a 120 min). Com ele, cada item do ticket diz quando começar para tudo ficar pronto junto ("Comece agora" / "Comece em 12 min"), e o ticket só entra em atenção depois do maior tempo de preparo e em atraso depois dele mais a folga da loja (atraso − atenção).
- O menu "⋯" do cabeçalho da Cozinha ganha "Modo TV" e "Painel de chamada", ao lado de Tela cheia.

**Fronteiras de teste**

1. **Regras:** páginas da TV; números da chamada; disparo dos itens; tempos do ticket com preparo; chaves Pro fora da sacola.
2. **Tela:** cadeado e Contratar em cada recurso; TV paginando; chamada com o som; campo de preparo e "Comece em".
3. **E2E e screenshots:** a TV e a chamada no desktop; o cadeado da aba Desempenho.

**Na implementação (8)**

- O cadeado (`RecursoPro`) fica no lugar do recurso, com o nome, "· Pro", para que serve e o botão "Contratar o … · R$ …/mês", que contrata só aquele recurso. No lugar de um botão (Nova praça, campo do produto), uma linha só do `sm` em diante.
- As telas de TV e chamada moram em `app/admin/[modulo]/tv` e `.../chamada`, só para `cozinha`: uma pasta fixa `cozinha` ao lado da rota dinâmica podia esconder `/admin/cozinha`.
- O som de chamada toca com o "Alerta sonoro" do aparelho ligado, como os outros sons.

## Fase 9: segmentos

**Desenho** (das decisões 31 a 34)

- **Leitura do item** (`leituraDoItem`), usada no ticket:
  - **Pizzaria:** os sabores viram frações ("½ Calabresa", "½ Portuguesa"); a borda que não é a tradicional fica em destaque, no tom de atenção; a opção "Tamanho", se houver, vai para o topo do item. Um sabor só fica como veio.
  - **Adega:** cada escolha do combo vira uma linha com a quantidade do item ("2× Red Bull").
  - **Açougue:** "Peso: 1,5 kg", o peso pedido da linha toda; as opções do corte em letra maior. O pedido a pagar depois da pesagem ganha o botão "Pesar" no ticket, que abre a pesagem que já existe.
  - **Lanchonete:** o número do pedido (que recomeça no mês) fica grande no ticket, para chamar.

**Fronteiras de teste**

1. **Regra:** a leitura do item em cada segmento.
2. **Tela:** o ticket da pizzaria com frações e borda, o combo aberto da adega, o peso e o Pesar do açougue, o número grande da lanchonete.
3. **E2E e screenshots:** o ticket da pizzaria meio a meio e o do açougue com o Pesar.
