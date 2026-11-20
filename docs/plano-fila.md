# Plano da fila de pedidos completa

Base: a [Fase 5 do plano do painel](plano-painel-admin.md#fase-5-fila-de-pedidos) (a fila de hoje) e o [levantamento](levantamento-admin.md). Decidido numa sessão de perguntas em 19/11/2026: 41 decisões, aqui agrupadas em 6 fases.

## Princípios

- **Central de despacho.** Tudo que se faz _durante_ o pedido acontece na fila, sem trocar de tela: aceitar, recusar, cancelar, cobrar, despachar, avisar o cliente e imprimir. Editar itens, fechar a conta da mesa e o histórico continuam em Pedidos e Mesas. A Cozinha continua sendo a tela da TV.
- **Desktop, tablet e celular com o mesmo peso.** Toque e mouse em tudo; atalhos de teclado são um extra do desktop.
- **Servidor falso.** Tudo novo entra no servidor de demonstração (IndexedDB) pela interface `Servidor`, com as regras em `lib/admin/regras/` como funções puras. O que é de fora (WhatsApp, notificação ao cliente, impressora, tempo real) é simulado, para trocar pelo back-end depois sem mexer na tela.
- **Os 6 segmentos,** cada um com o que é dele (fase 6). A pizzaria é a referência do desenho.
- **Vários aparelhos:** sincroniza entre abas do mesmo navegador (BroadcastChannel). Entre aparelhos, só com o back-end.
- **Visual:** segue o [DESIGN.md](../DESIGN.md). Telas novas (painel de chamada, gaveta, "Este aparelho") passam pela skill de design antes do código. A fila já tem screenshot de referência (`tests/visual-admin.spec.ts`, `painel-fila-*`, 11 telas, claro e escuro).
- **Uma fase por vez,** cada uma num PR que parte da anterior já integrada, porque todas mexem em `pagina-fila.tsx`, `cartao-fila.tsx`, `regras/fila.ts` e `servidor.ts`.

## Fase 1: aceite e alarme

**Desenho**

- **Linha do tempo do pedido.** O pedido guarda o que aconteceu e quando: recebido, aceito, recusado, cada etapa, cancelado (com motivo), pago, impresso. Aparece nos detalhes do pedido. É a base das métricas da fase 2.
- **Aceite manual** (Configurações da loja → nova seção **Fila e pedidos**, ligado por padrão na comida):
  - só pedidos que chegam **pelo site** esperam aceite. O que a equipe lança (PDV, garçom, agenda do painel) já entra aceito;
  - o cartão esperando aceite fica no topo de Novos, com **Aceitar** e **Recusar**, e mostra "esperando há N min";
  - **nunca recusa sozinho.** Passou do limite (padrão 5 min, configurável), o cartão fica vermelho;
  - enquanto espera aceite, o pedido não avança e não aparece na Cozinha;
  - desligado, é como hoje: o pedido entra aceito.
- **Recusar e cancelar pedem motivo**, de uma lista fixa por segmento, mais "Outro" com texto:
  - comida: sem estoque do item, fora da área de entrega, loja cheia, cliente pediu, endereço inválido, suspeita de fraude;
  - salão: + cliente não veio; farmácia: + receita inválida;
  - pedido pago online fica **"Estorno pendente"**; o estoque volta;
  - cancelar sai também do cartão da fila (hoje só nos detalhes), com confirmação. Recusar e cancelar não têm desfazer.
- **Alarme estourando:**
  - som novo **Sirene**: varredura de frequência, longo e no volume máximo, com compressor. Vira o padrão da comida. Os sons de hoje ficam mais altos (hoje o volume para em 0,3);
  - **repete a cada ~5 s enquanto houver pedido esperando aceite**, e para quando o último é aceito ou recusado;
  - com o alerta desligado, não toca, mas o cartão continua vermelho;
  - o navegador só libera som depois de um toque: quando o som estiver bloqueado, a fila mostra **"Toque para ativar o som"**.
- **Pedidos de dias anteriores** (corrige "um pedido esquecido fica lá para sempre"):
  - saem das colunas e aparecem num **aviso "N pedidos de dias anteriores"** no topo, que abre a lista com **Concluir todos** e **Cancelar todos** (motivo único);
  - ficam de fora do aviso: agendamentos do salão (continuam na coluna como atrasados) e retiradas do açougue marcadas para hoje ou depois.
- **Configurações da loja → Fila e pedidos:** aceite manual (chave), limite do aceite (minutos) e o som padrão (com Sirene). As fases seguintes acrescentam o resto.

**Modelo**

- `Pedido.historico: EventoPedido[]` (`{ tipo, em, detalhe? }`).
- `Pedido.esperaAceite?: boolean`, marcado pelo servidor na chegada.
- `Pedido.cancelamento?: { tipo: "recusa" | "cancelamento"; motivo: MotivoCancelamento; detalhe?: string; em: string }`.
- `SituacaoPagamento` ganha `"estorno-pendente"`.
- `ConfigLoja` ganha `aceiteManual: boolean` e `limiteAceiteMin: number`; `SomAlerta` ganha `"sirene"`.

**Fronteiras de teste**

1. **Regras** (puras, Vitest):
   - eventos da linha do tempo, em ordem;
   - quem espera aceite (origem, configuração), espera em minutos e se passou do limite;
   - motivos por segmento;
   - situação do pagamento ao recusar ou cancelar (pago online → estorno pendente);
   - pedidos de dias anteriores e as colunas sem eles (salão e retiradas futuras do açougue de fora);
   - se o alarme deve tocar (há pedido esperando aceite).
2. **Servidor:** chegada do site espera aceite (com aceite manual ligado), PDV e garçom não; aceitar, recusar e cancelar com motivo, gravando a linha do tempo; não avançar sem aceite; concluir e cancelar em lote; cada mutação grava o evento.
3. **Som:** a Sirene toca mais notas e mais alto que os outros; detectar som bloqueado (o `AudioContext` é simulado: fronteira externa).
4. **Tela da fila** (Testing Library):
   - Aceitar e Recusar no cartão; recusar abre os motivos e exige escolher um;
   - "esperando há N min" e o vermelho depois do limite (relógio simulado);
   - o alarme repete enquanto há pedido esperando e para ao aceitar;
   - aviso de som bloqueado;
   - aviso de dias anteriores com as ações em lote;
   - cancelar pelo cartão pede motivo e confirmação.
5. **Detalhes do pedido:** a linha do tempo.
6. **Configurações da loja:** a seção Fila e pedidos salva e volta.
7. **E2E:** aceitar um pedido do site, recusar com motivo e limpar os pedidos de dias anteriores; screenshot da fila revisado e atualizado.

## Fase 2: barra e ritmo

- **Barra em 3 faixas:**
  1. **Estado da loja**, sempre visível: Aberta/Pausada (com contagem), Entrega, prazo atual com +min e impressora;
  2. **Métricas**;
  3. **Ferramentas:** busca, filtros, compacto, "Este aparelho", tela cheia e painel de chamada.
     No celular, a faixa 1 fica fixa e as outras recolhem.
- **Prazo prometido:** tempo estimado por canal em Configurações (ex.: entrega 40–50 min, retirada 20 min). O cartão mostra "entregar até 20:15" com contagem regressiva. A urgência passa a ser pelo prazo: âmbar a 10 min do fim, vermelho quando passou. Ajuste rápido **+10/+15/+30 min** na barra, que vale para os pedidos novos.
- **Pausar pedidos** por 15/30/60 min, só da entrega ou da loja toda, voltando sozinho. A vitrine diz "loja ocupada, volte às 20:30".
- **Métricas ao vivo, clicáveis** (cada uma aplica o filtro): em andamento, atrasados, esperando aceite, tempo médio de preparo hoje, tempo médio até a entrega hoje, pedidos na última hora, concluídos e cancelados hoje. Sem faturamento.
- **"Este aparelho"** (menu na fila): som, tipo e testar, notificação do sistema com a aba em segundo plano, título da aba piscando ("🔔 2 novos"), vibração no celular, tela sempre acesa (Wake Lock), modo compacto e o modo demonstração (simular pedidos, que sai da barra).
- **Sincronização entre abas:** aceitar numa aba para o alarme nas outras.

## Fase 3: cartão e produtividade

- **Cartão:** botão de WhatsApp do cliente com a mensagem pronta da etapa; total e quantidade de itens; selos de origem (site, PDV, garçom) e "1º pedido" ou "cliente frequente".
- **Modo compacto:** uma linha por pedido, que expande ao tocar. A chave é por aparelho.
- **Busca e filtros:** busca por número, nome, telefone ou bairro; filtros rápidos por canal, "só atrasados" e "não pagos", valendo para todas as colunas. O filtro fica na URL.
- **Desfazer** por 6 s em toda ação de avançar.
- **Arrastar** o cartão entre colunas (mouse e toque; no celular, que usa abas, não), só para a etapa seguinte ou a anterior. **Atalhos** no desktop: setas, Enter avança, A aceita, R recusa, P imprime, / busca, e uma folha de ajuda no "?".
- **Ações em lote:** selecionar vários (caixa, ou Shift+clique) e avançar, imprimir ou despachar.
- **Gaveta "Finalizados hoje"** (concluídos e cancelados), com reimprimir e **Reabrir** (volta para Prontos).

## Fase 4: entrega e cliente

- **Despacho:** "Despachar" em cada entrega pronta. Os motoboys aparecem com status derivado dos pedidos (disponível, em rota com N, ausente), com a sugestão do disponível há mais tempo. Dá para agrupar entregas do mesmo bairro numa rota e **chamar no WhatsApp** com endereços, cobrança e troco. "Motoboy voltou" deixa o motoboy disponível de novo.
- **Visão por bairro** das entregas em andamento. O mapa real fica para o back-end, com geocodificação.
- **Avisar o cliente automaticamente** em cada etapa (aceito, saiu, pronto para retirar, recusado), com textos editáveis em Configurações. O envio é simulado: grava na linha do tempo e mostra a mensagem que teria saído.
- **Alertas secundários**, cada um com som suave próprio e uma chave: pronto parado há mais de X min, prestes a atrasar (5 min), pagamento online confirmado e cliente cancelou (simulado).
- **Adega, +18:** produto marcado "alcoólico" no cardápio. Pedido com álcool mostra "+18: conferir documento" no cartão, na via do entregador e na mensagem do motoboy, e na retirada um lembrete ao marcar "Cliente retirou".

## Fase 5: impressão e telas extras

- **Impressora:** indicador na barra (online, offline ou sem impressora, com o agente simulado) e aviso quando a impressão automática falhar.
- **Duas vias:** produção (sem preço, letra grande, observações em destaque) e cliente/entregador (com preços, cobrança e troco), configuráveis por canal (ex.: mesa só produção). Reimprimir pela gaveta de finalizados.
- **Tela cheia** da fila.
- **Painel de chamada** (rota própria, só leitura, para a TV virada ao cliente): "Preparando" e "Pronto, pode retirar", com número grande e som de chamada. Só retirada e balcão, nunca o nome completo.
- **Mesa** fica na fila até "Servido" (aí sai, e a conta continua em Mesas).
- **Cozinha:** selo "Na cozinha" no cartão e aviso suave quando a Cozinha marca pronto. As duas telas continuam podendo mover o pedido.

## Fase 6: segmentos

- **Açougue:** retiradas de outros dias numa faixa "Próximas retiradas", por data, que entram em Novos no dia. "Pesar" no cartão abre a pesagem ali mesmo. "Marcar pronto" fica bloqueado enquanto falta pesar, com o motivo no botão. Se o total mudou, avisa o cliente (simulado).
- **Salão:** colunas Agendados → Chegou → Em atendimento, com "Cliente chegou" e "Não veio" (motivo, conta como falta). O prazo é o horário marcado: o tempo por canal e o +min não se aplicam. Lembretes simulados na véspera e 1 h antes. O agendamento pelo site passa por "Confirmar horário", com alerta mais suave que a sirene. Sem painel de chamada e sem despacho.
- **Farmácia:** selo "Receita" e aceite bloqueado até o farmacêutico conferir a receita (a conferência do módulo Receitas abre ali mesmo). **Controlado não sai para entrega:** só retirada no balcão, com retenção da receita registrada ao marcar "Cliente retirou". Entrega com controlado chega marcada "precisa virar retirada", com as ações trocar para retirada ou recusar. A regra fica em `lib/admin/regras/farmacia.ts`.
- **Lanchonete e pizzaria:** sem regra própria. A lanchonete usa o painel de chamada com a numeração mensal.

## Situação

- **Fase 1: pronta em 19/11/2026** (branch `claude/admin-fila-pedidos-22418d`).
  - **Decidido no caminho:**
    - o volume dos alertas antigos subiu (suave 0,3, alto 0,6, muito alto 0,8; Sirene 1);
    - "Estorno pendente" vale para todo pedido pago e cancelado, não só o pago online;
    - a farmácia já liga o aceite manual; o salão fica desligado até a fase 6;
    - cancelar pelo cartão é um botão X ao lado de Detalhes, com motivo e confirmação;
    - o servidor de demonstração não conclui mais sozinho (nem dá como pago) o que ficou aberto ao virar o dia: isso vai para o aviso. Só o Pix não pago é cancelado sozinho;
    - a base guardada subiu para a versão 3 (os campos novos da loja): quem já usava o painel ganha dados de demonstração novos.
  - **Fica para depois:** o aviso de som bloqueado confere ao abrir a fila e a cada toque na página, não sozinho com o tempo.
  - **Screenshots:** no E2E rápido, o commit-base (`a18b187`) já falhava em 127 testes, 118 deles de screenshot. O motivo era um selo "1 Insight" que o servidor de desenvolvimento do Next desenhava em toda página: o aviso de segurança da versão 16.4.4, que o `devIndicators: false` não esconde. O Next foi para a 16.4.6 e o selo sumiu. Depois disso só falharam as telas que esta fase mudou de propósito (fila, configurações da loja e a linha do tempo nos detalhes da pesagem); foram revisadas nas 11 telas e atualizadas.
  - **X fora do cartão:** no tablet (768) e no celular deitado, o X de cancelar saía do cartão. O rodapé agora quebra linha, com teste E2E ("os botões de cada cartão ficam dentro do cartão, com o texto inteiro").
  - **Colunas estreitas:** no tablet e no celular deitado as 4 colunas ficavam estreitas demais (vinha do commit-base) e o botão principal cortava o texto, porque a barra lateral ocupa 256 px. A fila agora usa abas abaixo de 1024 px (`useTelaLarga`) e colunas do notebook para cima, com teste de componente e E2E ("com o texto inteiro").
  - **Fica para depois:** a acessibilidade (axe) do cartão esperando aceite no E2E: com o relógio controlado as animações param no meio.
- **Fase 2: pronta em 19/11/2026** (branch `claude/admin-fila-fase-2`, que parte da fase 1).
  - **Decidido no caminho:**
    - o prazo prometido sai do texto que a loja já mostra ao cliente ("40–60 min" promete 60; "1h30", 90), por canal: entrega pelo tempo de entrega, retirada e mesa pelo de retirada. Texto sem tempo: 50 min na entrega e 20 na retirada. Salão e retirada marcada para um dia seguem a hora marcada (`lib/admin/regras/prazo.ts`);
    - o pedido grava o prazo ao chegar (`prazoMin`, com o acréscimo da hora): mudar o acréscimo depois não altera quem já está na fila. Os pedidos gerados da demonstração não gravam; usam o da loja;
    - a vitrine do cliente ainda lê dados fixos. A pausa fica no servidor de demonstração e o texto que o cliente veria ("Loja ocupada, volte às 20:45") sai de `textoDaVitrine`, mostrado na barra; ligar na vitrine vem com o back-end;
    - os tempos médios saem da linha do tempo. Os pedidos de hoje que a demonstração gera já trazem as etapas por que passaram (em preparo aos 8 min, pronto aos 25, saiu aos 40);
    - concluídos e cancelados da régua levam à lista de pedidos filtrada (a gaveta "Finalizados hoje" é da fase 3);
    - a recusa de licença do navegador (notificação, tela acesa) aparece embaixo da chave, no menu, e não num toast;
    - o título da aba pisca só com a aba escondida, contando os que esperam aceite e os que chegaram enquanto ninguém olhava;
    - a sincronização entre abas vale para o painel todo (`useSincronizarAbas` no `ShellAdmin`), e não só para a fila. Antes, uma aba nunca via o que a outra gravava: cada uma guardava a base em memória;
    - no pé do cartão, imprimir, detalhes e cancelar andam juntos; o botão da etapa fica com a linha toda quando eles descem.
  - **Fica para depois:** busca, filtros por canal, compacto, tela cheia, painel de chamada e o indicador da impressora entram na faixa de ferramentas nas fases 3 e 5.
- **Fase 3: pronta em 19/11/2026** (branch `claude/admin-fila-fase-3`, que parte da fase 2).
  - **Decidido no caminho:**
    - "só atrasados" é o filtro da régua (fase 2); a busca e os filtros novos (canal, não pagos) ficam no endereço (`busca`, `canal`, `naoPagos`). A busca da lista de pedidos também passou a achar pelo bairro;
    - selo do cliente: "1º pedido" sem pedidos antes (pelo telefone, sem cancelados) e "Cliente frequente" com 10 ou mais nos 30 dias antes. Para isso a demonstração ganhou fregueses fiéis (8, mais da metade dos pedidos), clientes ocasionais e clientes novos: o cliente sai do mesmo sorteio de antes, mapeado pelo id, então itens, valores e horários continuam iguais e só os nomes mudaram. A base guardada subiu para a versão 4;
    - "voltar uma etapa" no servidor serve ao desfazer (6 s no aviso), ao arrastar de volta e, como "reabrir", à gaveta. Voltar de concluído desfaz a cobrança marcada ao concluir;
    - Reabrir devolve para Prontos (no salão, Em atendimento); a conta fechada da mesa reabre em Mesas e o cancelado não volta pela gaveta (só reimprime);
    - Concluídos e Cancelados da régua abrem a gaveta Finalizados hoje, no lugar de levar à lista de pedidos;
    - avançar em lote leva cada pedido à própria próxima etapa e pula o que não pode, com aviso; despachar em lote vem com o despacho, na fase 4;
    - os atalhos valem só no computador (colunas lado a lado), fora de campo de texto e de janela; R abre os motivos de recusa do cartão em foco;
    - arrastar usa o ponteiro para escolher a coluna e não rola a página sozinho; no celular e no tablet (abas) não arrasta.
  - **Achado no caminho:** no celular de 320 px, com o Mais aberto, os botões da faixa de ferramentas passavam da tela; agora quebram linha (E2E confere a largura da página contra a da tela).
  - **Screenshots:** além da fila, mudaram os nomes dos clientes nas telas que os mostram (pedidos, visão geral, cozinha, mesas e comanda, agenda, pesagem); revisadas por amostra (os valores, itens e status ficaram iguais) e atualizadas.
- **Fase 4: pronta em 19/11/2026** (branch `claude/admin-fila-fase-4`, que parte da fase 3).
  - **Decidido no caminho:**
    - a situação do motoboy sai dos pedidos (em rota, disponível desde a última entrega de hoje); ausente é o desligado no cadastro. A sugestão é o disponível livre há mais tempo;
    - com motoboys, a entrega pronta não "sai para entrega" direto: avançar, Enter e arrastar abrem o despacho. As prontas do mesmo bairro aparecem para levar junto (desmarcadas). Despachar em lote vem da seleção;
    - "Motoboy voltou" dá como entregue (e cobrado) tudo o que ele levava, inclusive o que já estava na rua;
    - os avisos ao cliente vêm ligados de fábrica, com textos de fábrica editáveis em Configurações → Fila e pedidos (até 500 caracteres; {nome}, {numero}, {loja}, {link}, {motivo}). O envio é simulado: entra na linha do tempo e a fila mostra a mensagem;
    - os alertas secundários são deste aparelho (Este aparelho → Alertas), ligados de fábrica; tocam o som suave só com o alerta sonoro ligado; vários do mesmo tipo juntos viram um aviso. Na demonstração, a cada 5 pedidos simulados um cliente cancela pelo site;
    - +18: o produto alcoólico se marca no cardápio só na adega (recurso "maioridade"); na demonstração, por categoria (cervejas, copão, caipirinhas, drinks, destilados e combos). O pedido pede documento quando algum item ou produto de combo é alcoólico.
  - **Achado no caminho:** as abas inativas da fila no celular não chegavam a 4,5:1 de contraste (o axe só via com as abas na tela); agora a 80%.
  - **Fica para depois:** o mapa de verdade das entregas (geocodificação) e o envio real das mensagens, com o back-end.
- **Fase 5: pronta em 20/11/2026** (branch `claude/admin-fila-fase-5`, que parte da fase 4).
  - **Decidido no caminho:**
    - a mesa pronta mostra "Servido" no lugar de "Fecha em Mesas": servida, sai da fila e a conta continua em Mesas. Rodada nova para a cozinha tira o "servido" e a mesa volta;
    - "Na cozinha" vale para o pedido que passa pela Cozinha enquanto está a fazer ou em preparo. O aviso "#N ficou pronto na Cozinha" é mais um alerta deste aparelho (Este aparelho → Alertas), com o som suave de duas notas, e só dispara quando quem marcou pronto foi a Cozinha;
    - as vias se escolhem por canal em Configurações → Impressão. De fábrica: entrega e retirada saem nas duas vias, mesa só na produção, salão só na do cliente. Canal sem via escolhida sai na do cliente, para nenhum pedido ficar sem cupom; o pedido vira "impresso" na última via;
    - a impressora é deste aparelho (Este aparelho → Impressora): pelo navegador (sempre pronta), pelo agente de impressão (simulado por uma chave, até o back-end) ou sem impressora. Fora do ar, o cupom não sai e a fila avisa; na impressão automática, avisa que o pedido ficou sem cupom;
    - tela cheia leva a fila inteira (barra e quadro) para o monitor do balcão; no celular o botão não aparece;
    - o painel de chamada mora em `/admin/chamada`, sem a barra lateral, e abre numa aba nova pelo botão da fila. Mostra a retirada já aceita (a venda do PDV também é retirada), o preparando por ordem de chegada e o pronto com o mais recente primeiro; o pronto esquecido sai da TV depois de 20 min. Do cliente, só o primeiro nome (a venda do balcão sem nome fica só no número). O som de chamada (dim-dom) só toca depois de um toque no botão de som, porque o navegador bloqueia o áudio até alguém tocar na página; cada número chamado também é anunciado ao leitor de tela. A regra fica em `lib/admin/regras/chamada.ts`.
  - **Achado no caminho:** com Alertas e Impressora, o popover Este aparelho passava da altura da tela e os últimos grupos ficavam fora de alcance até no 1080p. Agora limita à altura livre e rola por dentro (E2E "sem impressora neste aparelho").
  - **Screenshots:** mudaram a fila (selo Na cozinha, Servido, impressora e os botões do topo) e as configurações da loja (vias do cupom); o painel de chamada ganhou screenshot novo. Revisados e atualizados nas 11 telas.
  - **Fica para depois:** o agente de impressão de verdade e a conexão com a impressora, com o back-end; a numeração mensal do painel de chamada da lanchonete, na fase 6.
