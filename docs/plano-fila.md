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
  - **Pendente:** os screenshots (`toHaveScreenshot`) não foram atualizados. No E2E rápido, 125 deles falham, inclusive em telas da vitrine que esta fase não tocou (checkout, WhatsApp, produto): parecem desatualizados desde antes. A fila mudou de propósito (som "Padrão da loja (Sirene)"). Falta comparar com o commit-base e revisar antes de atualizar.
  - **Fica para depois:** a acessibilidade (axe) do cartão esperando aceite no E2E: com o relógio controlado as animações param no meio.
