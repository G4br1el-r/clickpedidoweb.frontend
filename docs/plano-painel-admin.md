# Plano do painel administrativo

Base: [levantamento-admin.md](levantamento-admin.md). Todos os dados são mockados, sem banco. Este plano aguarda aprovação.

## Segmentos do catálogo

O seletor no topo do painel troca entre 5 segmentos, cada um espelhando uma loja de hoje:

| Segmento        | Loja de referência     | Módulos                                                                                                              |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Adega           | Adega da Vila          | Visão geral, Fila, PDV, Cozinha, Mesas, Garçom, Pedidos, Cardápio, Categorias, Motoboys, Bairros, Configurações      |
| Açougue         | Açougue Sabor da Carne | Os mesmos da adega                                                                                                   |
| Pizzaria        | Casa da Pizza          | Os mesmos da adega                                                                                                   |
| Salão de beleza | Empório das Deusas     | Visão geral, Agendamentos, Fila, PDV, Pedidos, Cardápio, Categorias, Configurações                                   |
| Lanchonete      | Quiosque do Mineiro    | Visão geral, Fila, Cozinha, Mesas, Garçom, Pedidos, Cardápio, Categorias, Motoboys, Bairros, Configurações (sem PDV) |

Recursos que mudam o conteúdo das páginas compartilhadas:

| Recurso                        | Adega | Açougue | Pizzaria | Salão   | Lanchonete |
| ------------------------------ | ----- | ------- | -------- | ------- | ---------- |
| Adicionais (grupos de opções)  | sim   | sim     | sim      | **não** | sim        |
| Preço de balcão                | sim   | sim     | sim      | sim     | não        |
| Venda por quilo e pesagem      | não   | sim     | não      | não     | não        |
| Pagar após a pesagem           | não   | sim     | não      | não     | não        |
| Data de retirada               | não   | sim     | não      | não     | não        |
| Vitrines configuráveis         | não   | sim     | não      | não     | não        |
| Vídeo no produto e no banner   | não   | não     | não      | sim     | não        |
| Número do pedido mensal        | não   | não     | não      | não     | sim        |
| Combos que se ajustam sozinhos | sim   | não     | não      | não     | não        |

**Critério:** quando um módulo existe num segmento, ele usa a **melhor versão** que as lojas têm. Exemplo: a comanda de mesa completa da adega vale para todos os segmentos com Mesas. As versões reduzidas de hoje são correções que não chegaram a todas as lojas, não uma escolha de negócio. Os bugs do levantamento não são copiados.

O editor de aparência que já existe (Identidade, Cores, Telas…) continua no menu, em um grupo próprio.

## Fases

1. **Base:** catálogo de segmentos e módulos, seletor no topo, menu por segmento e aviso quando o módulo não é do segmento.
2. **Dados:** mocks de cada segmento (pedidos, produtos, categorias, mesas, motoboys, bairros, agendamentos) e uma API falsa em memória com React Query, com espera simulada e mutações.
3. **Visão geral:** dashboard com período, KPIs, gráficos (Chart do shadcn, que usa Recharts), formas de pagamento, canais e mais vendidos.
4. **Pedidos:** TanStack Table com busca, filtros, ordenação e paginação, mais a tela de detalhes com as ações.
5. **Fila:** kanban ao vivo, som, chamar o motoboy e as chaves da loja e do delivery.
6. **Cardápio:** lista de produtos com edição rápida, formulário conforme o segmento e categorias.
7. **PDV.**
8. **Cozinha, Mesas e Garçom.**
9. **Agendamentos** (salão), com data e hora de verdade.
10. **Motoboys, Bairros e Configurações da loja** (horários, entrega, pagamento, impressão e som).
11. **Recursos próprios:** pesagem, pagar após a pesagem, data de retirada, vitrines, vídeo, numeração mensal e combos.

Cada fase sai com testes (TDD), `pnpm check` e E2E das telas novas.

## Fase 1: fronteiras de teste

1. **`lib/admin/segmentos-painel.ts`** (função pura): quais módulos e recursos cada segmento tem. Garante, por exemplo, que o salão não tem Mesas e a lanchonete não tem PDV. Não cobre a tela.
2. **Store do segmento escolhido** (zustand com persistência): trocar e manter a escolha depois de recarregar. Não cobre a tela.
3. **Seletor de segmento** (componente): a pessoa abre, escolhe "Salão de beleza" e vê o nome trocar. Não cobre o menu.
4. **Barra lateral** (componente): com o salão, aparece Agendamentos e somem Mesas e Garçom; com a adega, é o contrário.
5. **Página de módulo fora do segmento** (componente): `/admin/mesas` no salão mostra "Mesas não faz parte de Salão de beleza", com um link para a visão geral.
6. **E2E (Playwright):** trocar o segmento no topo muda o menu, mais um screenshot do painel no celular e no desktop.

Situação: pronta em 13/11/2026.

## Fase 2: dados

**Desenho**

- **Modelo:** `lib/admin/dados/tipos.ts`, espelhando as entidades das lojas de hoje. Pedido tem tipo (entrega, retirada, mesa, atendimento), status, itens, pagamento, motoboy, mesa, agendamento (salão), data de retirada e pesagem (açougue).
- **Catálogos reais:** extraídos dos `Seed.cs` das lojas para `lib/mock/admin/<segmento>.ts`, com as fotos que existirem. A pizzaria reaproveita o cardápio que a vitrine já usa, para o painel e a loja mostrarem os mesmos produtos.
- **Pedidos gerados:** um gerador determinístico cria 90 dias de histórico por segmento, de acordo com o dia. Ele produz os mesmos pedidos para o mesmo dia, com hoje só até agora e alguns pedidos em andamento. Ao reabrir em outro dia, completa os dias que faltam.
- **Servidor falso:** funções assíncronas, com espera curta simulada (zero nos testes), que leem e alteram a base do segmento.
- **Onde fica salvo:** IndexedDB (`idb-keyval`), uma base por segmento, com versão. O `localStorage` não comporta 5 bases com 90 dias. Tem um "Restaurar dados de demonstração".
- **Performance:** cada catálogo e o gerador entram por importação dinâmica, só o do segmento escolhido. Busca de pedidos por id em `Map`.
- **React Query:** as chaves levam o segmento. Trocar de segmento traz a outra base, e as mutações atualizam a lista na hora, com atualização otimista onde fizer sentido.
- **Loja na barra lateral:** nome e logo passam a ser os da loja do segmento.

**Fronteiras de teste**

1. **Regras de status** (`lib/admin/regras/status.ts`, função pura): próxima etapa e textos por tipo de pedido. Garante que a mesa só conclui ao fechar a conta e que o atendimento vai de Agendado para Em atendimento e depois Concluído. Não cobre a tela.
2. **Gerador de pedidos** (função pura): mesmo dia gera os mesmos pedidos; total = itens + taxa − desconto; hoje só até agora, com pedidos em andamento; número mensal na lanchonete; agendamentos com data e hora no salão. Não cobre o realismo visual.
3. **Servidor falso:** listar pedidos com filtro, avançar, cancelar e marcar como pago; os dados continuam depois de reabrir; completar os dias que faltam; restaurar a demonstração. O IndexedDB é simulado no teste com `fake-indexeddb` (fronteira externa).
4. **Hooks do React Query:** trocar o segmento traz a base certa; avançar um pedido muda a lista sem recarregar.
5. **Cabeçalho da barra lateral** (componente): mostra o nome da loja do segmento escolhido.

Situação: pronta em 13/11/2026.

- **Catálogos:** adega 255 produtos (190 com foto), açougue 20, pizzaria a mesma da vitrine, salão 13 serviços e lanchonete 41.
- **Pedidos ao vivo:** a demonstração sempre abre com pedidos em todas as etapas nos últimos 80 minutos: aguardando pagamento, novo, em preparo, pronto, a caminho e mesa aberta.
- **Testes e cobertura:** 279 testes. Os mínimos de cobertura subiram: geral 30/27/28/30 e `lib/**` 89/93/89/91.

## Fase 3: visão geral

**Desenho** (base: o dashboard das lojas, seção 3 do levantamento)

- **Período:** atalhos Hoje, Ontem, 7, 15 e 30 dias e Este mês, mais um intervalo de datas (calendário do shadcn), com teto de 90 dias. Cada período é comparado com o anterior de mesmo tamanho. O período fica no endereço (`?de=&ate=`) pelo `nuqs`, para dar para compartilhar e voltar.
- **Hoje, ao vivo:** pedidos, faturamento, ticket médio e em andamento, mais aguardando pagamento e cancelados.
- **Indicadores do período:** faturamento com variação %, pedidos com média por dia, ticket médio e melhor dia. Os números animam com o NumberFlow, que já está no projeto.
- **Gráfico por dia:** faturamento ou pedidos, com hoje e o pico destacados. Clicar no dia leva aos pedidos daquele dia (a página chega na fase 4).
- **Também:** formas de pagamento, canais (entrega, retirada, mesa ou atendimento, conforme o segmento), mais vendidos (período e hoje), pedidos recentes e a tabela dia a dia, que pode ser recolhida.
- **Correção de um bug das lojas:** o faturamento conta só pedidos válidos (sem cancelados nem aguardando pagamento), e o rótulo diz isso. Lá, ele se chamava "receita confirmada" e somava pedidos não pagos.
- **Performance:** os gráficos usam o Chart do shadcn (Recharts), carregado só no navegador, por importação dinâmica, com esqueleto enquanto chega. As contas ficam em funções puras, memorizadas por período.
- **Carregamento:** esqueleto no formato final da tela, sem spinner.

**Fronteiras de teste**

1. **Período** (`lib/admin/regras/periodo.ts`, função pura): datas de cada atalho, período anterior, teto de 90 dias e datas inválidas voltando aos últimos 7 dias.
2. **Métricas** (`lib/admin/regras/dashboard.ts`, função pura): com uma lista pequena de pedidos montada à mão e valores conhecidos, testa faturamento, ticket, variação, melhor dia, série diária, pagamentos, canais e mais vendidos.
3. **Tela** (componente): mostra o esqueleto e depois os números; trocar o atalho troca o período; no salão, os canais falam em atendimento.
4. **E2E (Playwright):** com o relógio do navegador fixo, troca de período e screenshot no celular e no desktop, nos temas claro e escuro.

Situação: pronta em 13/11/2026.

- **Correções que surgiram na revisão:**
  - no salão, agendamento marcado para depois não conta como "em andamento";
  - no celular, as tabelas mostram só as colunas principais, porque a rolagem lateral não era alcançável pelo teclado (o axe acusou);
  - as barras de proporção usam a cor dos gráficos.
- **Movimento reduzido:** o gráfico não anima quando o aparelho pede menos movimento.
- **Testes e cobertura:** 302 testes. Os mínimos de cobertura subiram: geral 34/30/33/34 e `lib/**` 91/93/90/92.

## Fase 4: pedidos

**Desenho** (base: Pedidos das lojas, seção 9 do levantamento, sem os problemas de lá)

- **Lista com TanStack Table:**
  - colunas Nº, data e hora, cliente e telefone, canal, itens, total, pagamento (forma e situação) e status;
  - ordenação por coluna, paginação de 20 em 20 e contador "N pedidos · R$ X em vendas válidas";
  - no celular, ficam as colunas principais, sem rolagem lateral.
- **Filtros no endereço** (`nuqs`): período (o mesmo da visão geral; o `?data=` que vem do gráfico vira um dia só), busca por número, cliente, telefone ou item (sem diferenciar acento), e filtros de status, canal e forma de pagamento com contagem (Popover + Command do shadcn, o padrão "data table" deles).
- **Detalhes sem sair da lista:** clicar no pedido abre um painel lateral no computador e uma gaveta de baixo no celular. Fica em `?pedido=123`, então dá para compartilhar e o voltar do navegador fecha. O painel mostra:
  - itens com opções e observação, e o resumo de valores;
  - cliente, com WhatsApp e mensagem pronta;
  - endereço com "Abrir no mapa", mesa ou agendamento, conforme o tipo;
  - pagamento com troco;
  - motoboy, com escolher e chamar pelo WhatsApp com a mensagem das lojas.
- **Ações:** avançar (o texto do botão vem da regra de status), marcar como pago e cancelar (com confirmação). Todas otimistas, com toast.
- **Fora daqui:** o "mudar para qualquer status" e o "limpar todos os pedidos" das lojas saem. Eram a origem de bugs e de perda de histórico.

**Fronteiras de teste**

1. **Busca e filtros** (`lib/admin/regras/filtro-pedidos.ts`, função pura): busca por número, cliente, telefone e item, sem acento; filtros combinados; totais da lista.
2. **Mensagens de WhatsApp** (`lib/admin/regras/mensagens.ts`, função pura): texto para o cliente (status e link de acompanhamento) e para o motoboy (endereço, valor a cobrar ou "já pago", troco e mapa), mais o link `wa.me`.
3. **Servidor:** escolher o motoboy do pedido (só entrega e só motoboy ativo) e listar motoboys.
4. **Lista** (componente): mostra os pedidos; busca e filtro de status reduzem a lista; ordenar por total; paginação; clicar abre os detalhes.
5. **Detalhes** (componente): mostra o pedido conforme o tipo; o botão de avançar diz a próxima etapa; cancelar pede confirmação; marcar como pago some depois de pago.
6. **E2E:** vindo do gráfico da visão geral (`?data=`), buscar, abrir um pedido e avançar, com acessibilidade; screenshot da lista no celular e no desktop.

Situação: pronta em 13/11/2026.

- **TanStack Table 9:** a versão instalada é a 9, com API nova (`useTable` + `tableFeatures`). A tabela registra só ordenação e paginação, para o pacote ficar leve.
- **Correções da revisão:**
  - o número do pedido sumia no tema escuro e passou a usar a cor do texto;
  - o painel lateral não ia até o fim da tela no computador;
  - a situação de pagamento de um pedido cancelado virou "Sem cobrança", para não repetir o "Cancelado" do status.
- **Testes e cobertura:** 338 testes. Os mínimos de cobertura subiram: geral 37/34/37/38 e `lib/**` 91/93/91/93.

## Fase 5: fila de pedidos

**Desenho** (base: a Fila das lojas, seção 4 do levantamento)

- **Quadro ao vivo:** colunas Novos, Em preparo, Prontos e A caminho, com contagem, do mais antigo para o mais novo.
  - No celular, as colunas viram abas com a contagem, em vez de rolagem lateral (o axe já acusou esse padrão na fase 3).
  - No salão, as colunas são Agendados (só os de hoje, pela hora marcada) e Em atendimento.
- **Cartão do pedido:**
  - número e canal (Entrega, Retirada, Mesa 3);
  - hora e minutos desde a chegada, em âmbar a partir de 25 min e vermelho a partir de 40, com ícone além da cor;
  - cliente, endereço, itens com opções e observação;
  - cobrança ("Pago · Pix" ou "Cobrar R$ 51,00 · Dinheiro · troco para R$ 100,00") e motoboy.
  - Ações: o botão da próxima etapa e "Detalhes", que abre o mesmo painel da página de Pedidos.
- **Topo:**
  - resumo: em andamento, concluídos hoje e aguardando pagamento;
  - chave **Loja aberta**;
  - chave **Entrega**, que liga e desliga só a entrega. Nas lojas ela fechava a loja inteira e escondia as entregas em andamento; aqui não faz nenhum dos dois;
  - **alerta sonoro**: ligar, escolher entre suave, alto ou muito alto, e testar.
- **Ao vivo:**
  - a fila se atualiza a cada 5 s (React Query) e quando a aba volta a ficar visível;
  - na demonstração, chega um pedido novo a cada minuto, mais ou menos, com uma chave para desligar;
  - pedido novo toca o alerta (se estiver ligado) e entra com destaque;
  - as preferências ficam neste navegador.
- **Som:** sintetizado na hora com a Web Audio do navegador, sem arquivo de áudio para baixar.
- **Fica para depois:** impressão de cupom e arrastar o cartão entre colunas. A impressão entra com as configurações de impressora (fase 10).

**Fronteiras de teste**

1. **Regras da fila** (`lib/admin/regras/fila.ts`, função pura):
   - colunas por segmento e a ordem dos pedidos em cada uma;
   - o salão só mostra os agendamentos de hoje;
   - urgência por tempo;
   - texto da cobrança;
   - quais pedidos são novos desde a última leitura.
2. **Pedido simulado** (gerador): um pedido novo agora, com o número seguinte (mensal na lanchonete), sempre igual para a mesma semente.
3. **Servidor:** abrir e fechar a loja, ligar e desligar a entrega (sem fechar a loja), e o pedido simulado entrando na fila.
4. **Preferências** (store com persistência): som ligado, tipo do som e simulação, guardados e lidos de volta.
5. **Tela da fila** (componente):
   - colunas com contagem;
   - avançar muda o cartão de coluna;
   - pedido novo toca o alerta (o `AudioContext` do navegador é simulado, porque é fronteira externa);
   - desligar a entrega mantém as entregas na fila;
   - "Detalhes" abre o painel.
6. **E2E:** levar um pedido até sair da fila, desligar a entrega, acessibilidade e screenshot no celular e no desktop.

Situação: pronta em 13/11/2026.

- **Testes e cobertura:** 373 testes. Os mínimos de cobertura subiram: geral 41/37/40/42 e `lib/**` 93/93/93/94.
- **Pendente:** impressão de cupom (fase 10) e arrastar cartões entre colunas.

## Fase 6: cardápio e categorias

**Desenho** (base: seções 10 e 11 do levantamento)

- **Lista de produtos** (`/admin/cardapio`), agrupada por categoria:
  - busca (atalho `/`), filtro de categoria e de situação (todos, disponíveis, esgotados, ocultos, destaques, ofertas), com contagem;
  - cada linha: foto, nome, selos de destaque e oferta (%), quantos grupos de opções, preço editável na própria linha (Enter salva, Esc desfaz), preço de balcão e chaves de disponível e visível;
  - ações: edição rápida (janela), editar completo, copiar e excluir (com confirmação);
  - filtros e busca no endereço, como em Pedidos.
- **Formulário do produto** (painel largo no computador, tela cheia no celular; `?produto=novo` ou `?produto=id`), com React Hook Form + Zod e os campos do shadcn. Mostra só o que o segmento usa:
  - todos: categoria, nome, descrição, preço, foto (envio ou link; a foto é reduzida no navegador com `browser-image-compression` antes de guardar), disponível, visível, destaque, oferta com preço "de";
  - preço de balcão: menos na lanchonete;
  - venda por quilo (UN/KG): açougue;
  - vídeo e duração do serviço: salão;
  - grupos de opções (adicionais, sabores, bordas…): todos menos o salão. Cada grupo tem nome, mínimo, máximo, grátis até e ativo, e cada item tem nome, preço adicional e ativo. Grupos e itens são reordenados arrastando ou pelo teclado (dnd-kit).
  - validação que faltava nas lojas: mínimo ≤ máximo, grátis ≤ máximo, preço "de" maior que o preço quando em oferta;
  - "Replicar estas opções para a categoria", com confirmação.
- **Categorias** (`/admin/categorias`): criar, renomear na linha, mostrar ou ocultar, contagem de produtos, excluir só quando vazia, e a ordem do cardápio arrastando (ou pelo teclado).
- **Ajustes de combo da adega:** a sincronização automática fica para a fase 11, porque depende de configurar qual produto vira qual opção.

**Fronteiras de teste**

1. **Regras do cardápio** (`lib/admin/regras/cardapio.ts`, função pura): busca e filtros com contagem, % de desconto da oferta, copiar produto, replicar opções para a categoria e renumerar a ordem depois de arrastar.
2. **Esquema do produto** (Zod, por segmento): obrigatórios e limites, mínimo ≤ máximo, grátis ≤ máximo, preço "de" na oferta, e quais campos existem em cada segmento.
3. **Servidor:** salvar, alternar disponível e visível, preço na linha, copiar, excluir, replicar; categorias: criar, salvar, reordenar e excluir só vazia.
4. **Lista de produtos** (componente): busca e filtros; chaves; preço na linha com Enter e Esc; excluir com confirmação.
5. **Formulário** (componente): campos de cada segmento (salão sem adicionais e com duração; açougue com KG; lanchonete sem balcão); mensagens de validação; adicionar, remover e reordenar grupos; salvar.
6. **Categorias** (componente): criar, renomear, ocultar, não excluir com produtos e reordenar pelo teclado.
7. **E2E:** criar um produto com opções e vê-lo na lista; editar o preço na linha; screenshots.

Situação: pronta em 13/11/2026.

- **Mudança no desenho:** a edição rápida em janela saiu. O formulário completo já abre num painel por cima da lista, sem trocar de página, e as ações do dia a dia ficam na própria linha (preço, disponível e visível).
- **Bugs que os testes pegaram:**
  - o aviso "Produto excluído." não aparecia, porque a linha some antes do servidor responder;
  - quem clicava e digitava o preço de uma opção nova ficava com R$ 0. Agora o campo começa vazio ("Grátis") e vazio vale zero.
- **Tema escuro do painel:** o primário passou a ser claro. Antes, chaves ligadas e botões principais sumiam no fundo.
- **Testes e cobertura:** 421 testes. Os mínimos de cobertura subiram: geral 46/41/47/47 e `lib/**` 94/93/94/95.

## Fase 7: PDV (venda no balcão)

**Desenho** (base: seção 5 do levantamento; o PDV existe em adega, açougue, pizzaria e salão)

- **Tela em duas colunas:** catálogo à esquerda e caixa fixa à direita. No celular, o catálogo ocupa a tela e uma barra embaixo ("Ver venda · 3 itens · R$ 54,00") abre a caixa.
- **Catálogo:**
  - busca (atalho `/`) e categorias com contagem;
  - cartões com foto, nome e preço de balcão (quando houver);
  - tocar adiciona; produto com opções abre uma janela;
  - item avulso (nome, quantidade e valor) para o que não está no cardápio.
- **Janela de opções:** escolha única vira rádio, múltipla vira caixas de marcar. Respeita mínimo e máximo, e "grátis até" não cobra os N mais baratos. Também tem observação, quantidade e o botão "Adicionar · R$ total".
- **Caixa:**
  - itens com quantidade (− +), preço unitário editável e remover; "Limpar venda" com confirmação; itens iguais se juntam;
  - desconto em R$ ou %, com atalhos de 5% e 10% e sem passar do subtotal;
  - pagamento em Dinheiro, Pix ou Cartão. No dinheiro: valor recebido, atalhos (exato, 20, 50, 100) e "Troco: R$ X" ou "Faltam R$ X";
  - cliente e observação;
  - chave "Venda concluída no balcão" (ligada). Desligada, a venda vai para a fila e a cozinha.
  - **Finalizar venda** (atalho F9).
- **Ticket:** depois de finalizar, abre o ticket com o número, os itens, os totais, o pagamento e o troco, com "Imprimir" (`react-to-print`, cupom de 80 mm) e "Nova venda".
- **Últimas vendas de hoje:** só as do PDV. Nas lojas, a lista misturava retiradas feitas pelo site.
- **Correções das lojas:**
  - o servidor refaz as contas a partir dos itens: o total que chega do navegador não é aceito sem conferir;
  - o desconto não passa do subtotal;
  - no dinheiro, o valor recebido não pode ser menor que o total;
  - o preço com milhar (R$ 1.234,50) funciona, porque usa a máscara do `react-number-format` em vez de fazer a conta à mão.
- **Atalhos:** `react-hotkeys-hook`.
- **Pesagem do açougue:** fica para a fase 11.

**Fronteiras de teste**

1. **Regras do PDV** (`lib/admin/regras/pdv.ts`, função pura):
   - preço de balcão;
   - preço com opções e "grátis até";
   - validação de mínimo e máximo, com o texto das opções escolhidas;
   - juntar itens iguais;
   - totais com desconto em R$ e %;
   - troco e "faltam".
2. **Servidor:** finalizar venda (paga, concluída ou para a fila, contas refeitas, dinheiro insuficiente e desconto acima do subtotal recusados) e últimas vendas só do PDV de hoje.
3. **Tela** (componente):
   - adicionar sem opções e com opções (pede o mínimo e cobra certo);
   - quantidade, preço editável, remover e limpar;
   - desconto em %;
   - troco e "faltam";
   - finalizar mostra o ticket e limpa a caixa;
   - a venda não concluída aparece na fila.
4. **Atalhos:** `/` vai para a busca e F9 finaliza.
5. **E2E:** venda em dinheiro com troco, acessibilidade e screenshots.

Situação: pronta em 13/11/2026.

- **O que os testes pegaram:**
  - o nome falado dos cartões não continha o texto visível (axe, WCAG 2.5.3);
  - o F9 não disparava em todo teclado (passou a usar a tecla produzida, `useKey`).
- **Testes e cobertura:** 447 testes. Os mínimos de cobertura subiram: geral 48/43/49/49 e `lib/**` 94/93/95/95.

## Fase 8: cozinha, mesas e garçom

**Desenho** (base: seções 6, 7 e 8 do levantamento, na versão da adega, que é a mais completa; vale para adega, açougue, pizzaria e lanchonete)

- **Rodadas da comanda (correção da adega):** nas lojas, mandar mais itens de uma mesa para a cozinha fazia o pedido inteiro voltar a "Novo", e a cozinha via de novo tudo o que já tinha servido. Aqui cada item guarda a rodada em que foi lançado e se vai ou não para a cozinha. A cozinha vê só a rodada nova; o resto aparece apagado, como "já servido".
- **Cozinha (KDS):**
  - colunas A fazer, Preparando e Prontos, do mais antigo para o mais novo;
  - filtros Todos, Mesas, Entrega e Retirada. Nas lojas, "Delivery" também pegava retirada;
  - ticket com origem (Mesa 3, Entrega, Retirada), número, cronômetro (âmbar a partir de 15 min, vermelho a partir de 25), cliente, garçom, itens em letra grande, opções e observação;
  - botões Iniciar preparo e Marcar pronto. Pronto sai da mão da cozinha: entrega e retirada seguem pela Fila, e mesa só fecha em Mesas.
  - Nas lojas, o "Finalizar" da cozinha concluía a comanda e a marcava como paga sem fechar a conta. Esse caminho não existe aqui.
  - tela cheia para TV, atualização a cada 4 s e o mesmo alerta sonoro da Fila.
- **Mesas:**
  - grade com livre e ocupada: cliente, há quanto tempo, garçom, itens e total;
  - nova mesa (número único, nome opcional) e excluir só mesa livre;
  - comanda num painel: quantidade (− +), remover item, item avulso e total;
  - imprimir a conta (80 mm) e fechar a conta com a forma de pagamento, o que conclui, marca como pago e libera a mesa;
  - "Liberar mesa" só sem comanda aberta. Nas lojas, liberar deixava o pedido perdido na fila e na cozinha.
- **Garçom** (pensado para o celular):
  - escolher a mesa (livre ou ocupada), o nome do garçom (guardado no aparelho) e o cliente;
  - o mesmo catálogo e a mesma janela de opções do PDV, com preço de balcão;
  - bandeja dos itens novos, com "Lançar na mesa" (sem cozinha) e "Enviar para a cozinha";
  - ver e editar a comanda da mesa ali mesmo.
- **Correção de segurança:** o garçom manda as escolhas de opções, e o servidor recalcula o preço (balcão + adicionais + grátis) e valida mínimo e máximo. Nas lojas, o preço vinha pronto do navegador. Item avulso é a exceção declarada, com preço digitado.
- **Salão:** não tem esses módulos.

**Fronteiras de teste**

1. **Regras da cozinha e das rodadas** (`lib/admin/regras/cozinha.ts`, função pura):
   - só entra o que vai para a cozinha, e só a rodada atual de cada mesa;
   - colunas e ordem;
   - filtro de entrega sem retirada;
   - cronômetro de 15 e 25 min.
2. **Servidor das mesas:**
   - criar mesa (número único) e excluir só mesa livre;
   - lançar: abre comanda nova ou acrescenta, com e sem cozinha, cria rodada nova, recalcula o preço com balcão e opções e recusa opções inválidas;
   - alterar e remover item, e item avulso;
   - fechar conta (paga, concluída, mesa livre);
   - liberar recusado com comanda aberta.
3. **Cozinha** (componente): colunas, iniciar e marcar pronto, mesa pronta sem botão de concluir, filtro e só os itens da rodada nova.
4. **Mesas** (componente): grade, nova mesa, comanda com +, −, remover e avulso, imprimir e fechar a conta.
5. **Garçom** (componente): escolher a mesa, montar a bandeja, lançar sem cozinha, enviar para a cozinha e o nome do garçom guardado.
6. **E2E:** o garçom lança na mesa, a cozinha prepara e a mesa fecha a conta, com acessibilidade e screenshots.

Situação: pronta em 13/11/2026.

- **O que os testes pegaram:**
  - nas abas da cozinha no celular, o texto da aba inativa não passava no contraste (axe); a cozinha usa um texto mais forte;
  - o nome acessível do cartão da mesa juntava "Mesa 60" com "Ocupada"; o nome passou a vir do título e o resto virou descrição.
- **Reaproveitado:** o catálogo de balcão saiu do PDV para `components/admin/pdv/catalogo-balcao.tsx`, usado também pelo Garçom; a janela de opções agora devolve as escolhas.
- **Testes e cobertura:** 481 testes e 222 no E2E rápido. Os mínimos de cobertura subiram: geral 52/47/53/53 e `lib/**` 95/93/95/96.

## Fase 9: agendamentos do salão

**Desenho** (base: seção do Empório das Deusas no levantamento; só o salão tem este módulo)

- **Data e hora de verdade (correção do Empório):** no Empório, a data e a hora do atendimento eram texto dentro da observação, e os filtros usavam o dia em que o pedido foi feito. Aqui o agendamento guarda início e duração, e tudo (agenda, filtros, resumo, fila) usa o dia do atendimento.
- **Capacidade do salão:** a loja tem quantos atendimentos cabem ao mesmo tempo (o mock do Empório começa com 2; a tela de configurações chega na fase 10). Um horário cheio não aparece como livre e o servidor recusa. Assim "ver conflitos" vira impedir o conflito.
- **Agenda (`/admin/agendamentos`):**
  - resumo no topo com Hoje, Amanhã e Próximos 7 dias (quantos atendimentos e quanto somam), como os cartões do Empório;
  - **Dia:** linha do tempo das 9h às 19h (o horário da loja daquele dia), blocos do tamanho da duração, lado a lado quando há dois ao mesmo tempo, linha de "agora" em hoje; dia anterior, próximo, "Hoje" e calendário (dias fechados apagados);
  - **Lista:** os próximos e os passados, com busca por cliente, telefone ou serviço, filtro por status e por período do atendimento;
  - tocar num atendimento abre os detalhes que já existem (painel lateral), com iniciar, concluir, marcar como pago, cancelar, WhatsApp e imprimir o comprovante, mais **Remarcar**.
- **Novo agendamento** (janela):
  - cliente (nome e telefone com máscara), um ou mais serviços do cardápio (a duração soma), data no calendário (só dias abertos, de hoje em diante) e os horários livres de 30 em 30 min, observação e forma de pagamento;
  - o preço e a duração vêm do servidor, a partir dos serviços;
  - aparece na agenda e na fila no dia certo. A origem do pedido passa a ter "Agenda do painel", fora das últimas vendas do PDV.
- **Remarcar:** mesma escolha de data e horários livres, só para quem ainda não começou. O WhatsApp do cliente já sai com a data nova.
- **Validações do servidor:** dia aberto, dentro do horário da loja (o serviço termina até o fechamento), não no passado, dentro da capacidade, serviço existente e disponível.
- **Demonstração:** o gerador passa a respeitar os dias fechados (domingo e segunda no Empório) e a capacidade, o que hoje não faz.

**Fronteiras de teste**

1. **Regras da agenda** (`lib/admin/regras/agenda.ts`, funções puras):
   - horários livres de um dia, conforme horário da loja, duração, capacidade e agora;
   - faixas para os blocos lado a lado;
   - resumo de Hoje, Amanhã e 7 dias pelo dia do atendimento;
   - busca e filtros da lista.
2. **Servidor:**
   - criar (preço e duração do servidor; recusa dia fechado, fora do horário, passado, horário cheio e serviço esgotado);
   - remarcar (mesmas regras, sem contar o próprio; só antes de começar);
   - o gerador respeita dias fechados e capacidade.
3. **Agenda** (componente): blocos do dia na hora certa, navegar entre dias, resumo, lista com busca e filtro, abrir os detalhes.
4. **Novo agendamento e Remarcar** (componente): serviços, dias fechados desabilitados, só horários livres, cria e aparece na agenda; remarcar muda o horário.
5. **E2E:** marcar um horário, ver na agenda, iniciar e concluir com o pagamento, com acessibilidade e screenshots (claro e escuro).

Situação: pronta em 13/11/2026.

- **O que os testes pegaram:**
  - gerar 90 dias da agenda ficou lento ao conferir a capacidade contra a agenda inteira; agora só entra o expediente do dia e o que ainda não terminou (de ~100 ms para ~50 ms);
  - com 5 a 10 atendimentos por dia, a demonstração ficava com o salão quase sempre cheio (65% a 95% do dia); passou para 3 a 6 (cerca de 40%);
  - tocar de novo no dia escolhido desmarcava o calendário; agora a escolha é obrigatória;
  - o calendário falava inglês para o leitor de tela ("Go to the Previous Month"); os três calendários do painel usam o locale do próprio calendário em português;
  - o texto das abas inativas não passava no contraste (axe), como na cozinha.
- **Também mudou:** a mensagem de WhatsApp do agendamento marcado diz o dia e a hora; os detalhes de um agendamento têm Remarcar e Imprimir comprovante.
- **Testes e cobertura:** 504 testes e 228 no E2E rápido. O E2E da mesa passou a procurar o ticket dentro da coluna (o ticket que sai fica no DOM durante a animação de saída). Os mínimos de cobertura subiram: geral 55/49/56/56 e `lib/**` 95/93/96/96.

## Fase 10: motoboys, bairros e configurações da loja

**Desenho** (base: seção 4 do levantamento, "Entrega" e "Configurações"; motoboys e bairros só nos segmentos com entrega)

- **Motoboys (`/admin/motoboys`):**
  - lista com nome, WhatsApp (com máscara), ativo e quantas entregas fez hoje; criar, editar, ativar e desativar;
  - "Chamar no WhatsApp" com o link pronto;
  - excluir só quem não tem entrega em andamento; com entrega, a tela oferece desativar. Nas lojas, excluir deixava o pedido apontando para ninguém;
  - na Fila, só os ativos aparecem para escolher (já é assim).
- **Bairros e taxas (`/admin/bairros`):**
  - tabela (TanStack Table) com busca, filtro por cidade, taxa editável na própria linha e ativo;
  - bairro novo e editar; bairro repetido na mesma cidade é recusado (sem diferença de acento e maiúscula);
  - selecionar vários e mudar a taxa ou desativar de uma vez;
  - excluir pede confirmação; os pedidos antigos guardam o endereço e a taxa, nada se perde.
- Com a entrega desligada nas configurações, as duas telas continuam acessíveis, com um aviso de que a loja não está aceitando entregas.
- **Configurações da loja (`/admin/loja`)**, um formulário com seções e uma barra "Salvar alterações / Descartar" que aparece quando algo mudou (e avisa ao sair com alteração pendente):
  1. **Loja:** nome, slogan, telefone, WhatsApp, endereço e texto do horário. Vazio, o texto é montado sozinho a partir dos horários ("Terça a sábado, das 9h às 19h").
  2. **Horários:** os 7 dias com aberto, abre e fecha; "copiar para todos"; expediente que passa da meia-noite (18h às 2h); abrir e fechar sozinho pelo horário; mensagem de loja fechada.
  3. **Entrega e retirada:** aceita cada uma, taxa padrão (quando o bairro não tem taxa), pedido mínimo, tempo estimado de cada uma e cidades atendidas. No salão, só a parte de atendimento no local.
  4. **Formas de pagamento:** Pix, cartão online, dinheiro, cartão na entrega (e "pagar após a pesagem" no açougue, que chega na fase 11). Pelo menos uma ligada.
  5. **Pagamento online:** no protótipo, a conta do Mercado Pago aparece como conectada ou não, com "Conectar" e "Desconectar" de demonstração. **Nenhuma chave ou token é digitado nem guardado no navegador**; Pix e cartão online só ligam com a conta conectada, como nas lojas.
  6. **Impressão:** cupom de 80 mm pelo navegador, impressão automática dos pedidos novos, cortar o papel e "Imprimir cupom de teste". O Agente local das lojas fica fora do protótipo (não há impressora conectada).
  7. **Alerta sonoro:** o som padrão da loja, com "Ouvir". Cada aparelho (fila, cozinha) começa com o padrão da loja e pode escolher outro. Nas lojas, o som salvo nas configurações era ignorado pela fila.
- **Abrir e fechar (correção):** nas lojas, as chaves da Fila desligavam o horário automático sem avisar. Aqui, com o automático ligado, a chave da Fila mostra "Aberta pelo horário" e, se a pessoa mexer, pergunta se quer passar para o controle manual.
- **Cupom do pedido:** "Imprimir cupom" nos detalhes do pedido e no cartão da Fila, com itens, opções, observação, cliente, endereço, pagamento e troco. O pedido guarda "Impresso às 20:31" e o botão vira "Reimprimir". A impressão automática imprime cada pedido novo uma vez só (nas lojas, com as duas chaves ligadas, saía em dobro).
- **Fora desta fase:** o editor do site (`/admin/configuracoes`) continua cuidando de como as formas de pagamento e o pedido mínimo aparecem para o cliente. Ligar os dois exige um servidor de verdade; aqui as configurações da loja são a fonte do que a loja aceita.

**Fronteiras de teste**

1. **Regras da loja** (`lib/admin/regras/loja.ts`, funções puras):
   - loja aberta agora pelo horário, inclusive expediente depois da meia-noite e dia fechado;
   - texto do horário montado a partir dos dias (agrupando dias iguais);
   - copiar o horário para todos;
   - esquema da configuração (zod): abre e fecha válidos, telefones, taxa e pedido mínimo, pelo menos uma forma de pagamento, Pix e cartão online só com a conta conectada;
   - taxa de entrega: a do bairro ativo, senão a padrão.
2. **Servidor:** motoboys (criar, salvar, alternar, excluir só sem entrega em andamento), bairros (criar, salvar, alternar, excluir, mudar a taxa de vários, recusa repetido), salvar a configuração (com o esquema) e marcar o pedido como impresso.
3. **Motoboys** (componente).
4. **Bairros** (componente): busca, cidade, taxa na linha, seleção e mudança em lote.
5. **Configurações** (componente): seções, copiar horário, texto gerado, salvar e descartar, erros nos campos, Pix bloqueado sem conta conectada.
6. **Cupom e som** (componente): imprimir e reimprimir nos detalhes e na Fila, impressão automática uma vez por pedido, chave da Fila com horário automático, som padrão da loja no aparelho que não escolheu.
7. **E2E:** cadastrar um motoboy e escolhê-lo na Fila, criar um bairro, mudar o horário e ver a loja fechar, com acessibilidade e screenshots (claro e escuro).

Situação: pronta em 13/11/2026.

- **O que os testes e as fotos pegaram:**
  - o campo de hora nativo mostrava "06:00 PM" e cortava o texto; virou um campo de 24 h com máscara, igual em qualquer navegador;
  - dinheiro aparecia como "R$ 6"; os campos de valor mostram os centavos;
  - dois "Centro" em cidades diferentes tinham a mesma caixa "Selecionar Centro"; a cidade entrou no nome;
  - no celular, o horário quebrava em duas linhas e as ações das tabelas ficavam cortadas; as linhas foram compactadas e a tabela de bairros rola dentro do próprio cartão;
  - o teste das preferências esperava o som "alto" por padrão; agora o aparelho começa seguindo o som da loja, como foi desenhado.
- **Também mudou:** a Fila ganhou "Imprimir cupom" em cada cartão, "Impresso às" e o som "Padrão da loja"; os detalhes do pedido também imprimem.
- **Testes e cobertura:** 550 testes e 234 no E2E rápido. Os mínimos de cobertura subiram: geral 59/53/59/60 e `lib/**` 95/93/96/96.

## Fase 11: recursos próprios de cada loja

**Desenho** (base: seção 3 do levantamento, "O que cada loja tem de próprio")

- **Pesagem (açougue):**
  - nos detalhes de um pedido com item por quilo, o bloco "Pesagem" lista cada item com o peso pedido, o preço do quilo e o valor estimado; o operador digita o **peso da balança** (em gramas) e vê o valor real, o total estimado, o novo total e a diferença (a mais ou a menos);
  - ao confirmar, o pedido guarda os valores novos e quando foi pesado ("Pesado às 20:41"); dá para pesar de novo até o pagamento;
  - correções das lojas: pedido já pago não muda de valor; o preço do item com quantidade maior que 1 sai certo; quem pesa digita o peso e o sistema faz a conta (nas lojas, digitava-se o valor);
  - na Fila, o cartão mostra "A pesar" até a pesagem.
- **Pagar após a pesagem (açougue):**
  - forma de pagamento que deixa o pedido "aguardando pagamento" sem travar o preparo;
  - depois de pesar, "Enviar link de pagamento" abre o WhatsApp do cliente com o valor final e o link `/checkout/{token}`. Nas lojas, o link do PDV usava o id do pedido, que dá para adivinhar;
  - o gerador da demonstração passa a criar pedidos assim no açougue.
- **Data de retirada (açougue):** o pedido guarda o dia escolhido pelo cliente; aparece nos detalhes e no cartão da Fila ("Retirar sáb., 14/11"), e a demonstração passa a gerar pedidos com data.
- **Vitrines (açougue):** título e liga/desliga de "Destaques" e "Ofertas" numa seção própria das Configurações da loja (nas lojas, a mesma opção aparecia em dois lugares).
- **Vídeo (salão):** o link de vídeo do produto já existe no formulário; entra o **vídeo do banner da loja** nas Configurações, com a mesma validação (YouTube, Shorts ou Reels). Envio de arquivo de até 50 MB fica fora do protótipo, que não tem onde guardar.
- **Numeração mensal (lanchonete):** hoje só os pedidos gerados recomeçam no mês; os criados pelo servidor (garçom, simulação) usam o id. Todo pedido novo passa a pegar o próximo número do mês, e todas as telas mostram esse número (nas lojas, a visão geral e a cozinha mostravam o id interno).
- **Combos que se ajustam sozinhos (adega), sem depender de nome:**
  - uma opção de um grupo pode ser **ligada a um produto** do cardápio ("esta opção é o produto Gelo de Coco"), no formulário do produto;
  - esgotar o produto desliga a opção em todos os combos; voltar a ter liga de novo; renomear o produto renomeia a opção;
  - "Adicionar produto como opção" cria a opção já ligada, com nome e preço;
  - na demonstração da adega, os gelos e energéticos dos combos já vêm ligados aos produtos de mesmo nome (a regra de nome das lojas vira ligação explícita, uma vez).
- **Pizzaria:** nada próprio, como nas lojas.

**Fronteiras de teste**

1. **Regras puras:**
   - pesagem (`lib/admin/regras/pesagem.ts`): valor de cada item pelo peso, total estimado, novo total e diferença, quantidade maior que 1, recusa de pedido pago;
   - mensagem do link de pagamento com o token;
   - opções ligadas a produtos: desligar, religar e renomear nos combos (`cardapio.ts`);
   - próximo número do pedido (mensal ou sequencial);
   - texto da data de retirada.
2. **Servidor:** registrar a pesagem; número mensal em todo pedido criado pelo servidor; esgotar e renomear produto propagam nos combos; o gerador do açougue cria data de retirada e "pagar após a pesagem", e o da adega liga as opções aos produtos.
3. **Componentes:**
   - Pesagem nos detalhes do pedido e o link de pagamento;
   - "A pesar" e a data de retirada no cartão da Fila;
   - opção ligada a produto e "Adicionar produto como opção" no formulário;
   - Vitrines (açougue) e vídeo do banner (salão) nas Configurações.
4. **E2E:** açougue pesa um pedido e manda o link; adega esgota um gelo e ele some do combo no PDV; com acessibilidade e screenshots (claro e escuro).

Situação: pronta em 13/11/2026.

- **O que os testes e as fotos pegaram:**
  - a demonstração do açougue nunca tinha pedido aberto para pesar (o "pagar após a pesagem" só saía nos pedidos antigos); os pedidos ao vivo que não pagaram online também podem usar;
  - os nomes dos gelos não batiam entre combo e cardápio ("c/" e "com", acento, "Blue Ice"); a ligação compara como as lojas comparavam, com um apelido para o Blue Ice, e vira explícita;
  - o campo de busca do cmdk ganha o nome pelo `Command` (o `aria-label` no campo era ignorado); a busca de produto abre dentro do grupo, sem janela por cima do painel;
  - o peso ficou com a unidade ao lado do campo, não dentro do valor: colar "1200" funciona como digitar;
  - no celular, "Ligada a…" apertava o nome da opção; foi para uma linha própria.
- **Também mudou:** o link de vídeo do produto passou a aceitar só YouTube, Shorts e Reels, como o do banner.
- **Testes e cobertura:** 578 testes e 245 no E2E rápido. Os mínimos de cobertura subiram: geral 60/54/60/60 e `lib/**` 95/93/96/96.

## Fechamento (revisão, segurança e correções)

Em 13/11/2026, o fechamento rodou testes, revisão de código e auditoria de segurança sobre todo o painel. Os 28 itens apontados foram corrigidos com teste vermelho antes:

- **PDV:** o servidor refaz o preço de cada item do cardápio (balcão, adicionais e grátis); preço digitado só no item avulso. Na caixa, o preço do cardápio fica só para leitura.
- **Pagamento e status:** "marcar como pago" recusa pedido cancelado, já pago ou ainda sem pesagem; a pesagem recusa pedido encerrado; avançar e cancelar conferem a etapa esperada (duas abas não pulam etapa).
- **Cadastro:** o servidor valida o produto com o mesmo esquema do formulário; excluir um produto solta as opções de combo ligadas a ele; a configuração da loja não liga Pix sem a conta conectada.
- **Robustez:** token do pedido com 128 bits; IndexedDB que falha uma vez não trava o painel; limites de texto, forma de pagamento e números conferidos no servidor.
- **Telas:** a Fila não cria consulta nova a cada 30 s e conta os concluídos de hoje criados ontem; tirar da comanda o que a cozinha já preparou pede confirmação; o salão mostra agendamentos atrasados de dias anteriores.
- **Testes e cobertura:** 636 testes, 50 screenshots e 247 no E2E rápido. Os mínimos subiram para geral 61/55/62/62 e `lib/**` 96/94/97/96.

## Fase 12: controle de estoque (novo, nenhuma loja tem)

**Desenho**

- **Onde fica:** módulo "Estoque" no grupo Gestão do menu, em todos os segmentos. Cada produto escolhe se o estoque é controlado: na adega e no açougue quase tudo; na pizzaria e na lanchonete, o que é revenda (bebidas, sobremesas prontas); no salão, os produtos vendidos no balcão (os serviços não têm estoque).
- **Unidade:** a mesma do produto. Unidade conta peças; quilo conta em kg com 3 casas (o açougue).
- **Tela (`/admin/estoque`):**
  - resumo no topo: itens controlados, abaixo do mínimo, zerados e o valor parado em estoque (pelo custo);
  - tabela (TanStack Table) com produto, categoria, saldo, mínimo, situação (ok, baixo, zerado) e a última movimentação; busca, filtro por situação e por categoria, ordenar pelo saldo;
  - **Entrada** (compra ou reposição): quantidade, custo unitário opcional e observação (fornecedor, nota);
  - **Saída** (perda, quebra, vencimento, consumo interno): quantidade e motivo obrigatório;
  - **Contagem** (inventário): digita o que contou; o sistema mostra e registra a diferença;
  - **Histórico do produto** (painel lateral): data, tipo, quantidade, saldo depois, motivo e o pedido quando foi venda;
  - **Configurar:** controlar ou não, estoque mínimo, custo e "esgotar sozinho ao zerar".
- **Baixa automática nas vendas:**
  - o pedido baixa o estoque quando entra na loja (o do site, ao ser recebido; o pedido aguardando pagamento online ainda não baixa), a venda do PDV ao fechar e a comanda a cada lançamento do garçom;
  - **cancelar devolve** ao estoque; tirar item da comanda também;
  - **açougue:** baixa o peso pedido e a pesagem acerta a diferença pelo peso real;
  - **combos (adega):** a opção ligada a um produto baixa o estoque daquele produto (o gelo do combo sai do estoque de gelo).
- **Zerou, esgotou:** com "esgotar sozinho ao zerar", o produto fica esgotado no cardápio, no PDV e no garçom quando o saldo chega a zero, e os combos ligados a ele acompanham; a entrada seguinte volta a deixar disponível (só se foi o estoque que esgotou, não quem esgotou na mão).
- **Vender além do saldo:** o PDV e o garçom recusam ("Só restam 2 de Gelo de Coco"). Os pedidos do site, que chegam sem o operador, entram mesmo assim e deixam o saldo negativo, com aviso na tela de estoque (o produto já fica esgotado para os próximos).
- **Avisos:** o menu mostra quantos itens estão abaixo do mínimo, e o cartão do catálogo do balcão mostra "Restam 3" quando está baixo.
- **Demonstração:** cada loja começa com saldos, mínimos e custos plausíveis e um histórico recente (entradas de compra, vendas do dia, uma perda), com alguns itens baixos e um zerado para a tela não nascer vazia.

**Fronteiras de teste**

1. **Regras puras** (`lib/admin/regras/estoque.ts`): situação do item (ok, baixo, zerado, negativo), consumo de um pedido (itens, quantidade, quilo e opções ligadas de combo), saldo depois de cada movimento, diferença da contagem, resumo (contagens e valor parado) e validação dos movimentos (quantidade, motivo).
2. **Servidor:** entrada, saída e contagem com histórico; baixa na venda do PDV, na comanda e no pedido recebido, devolução no cancelamento e ao tirar item da comanda; acerto na pesagem; zerar esgota e a entrada devolve (com os combos); PDV e garçom recusam vender além do saldo; os dados de demonstração.
3. **Tela de Estoque** (componente): resumo, tabela com busca e filtros, entrada, saída com motivo, contagem com a diferença, histórico e configurar.
4. **Integrações** (componente): número no menu, "Restam 3" no balcão e o produto que zera sumindo do PDV.
5. **E2E:** entrada de mercadoria, venda no PDV baixando o saldo, zerar esgota o produto e cancelar devolve; acessibilidade e screenshots (claro e escuro).

Situação: pronta em 13/11/2026.

- **O que os testes e as fotos pegaram:**
  - no celular, a coluna Situação e o botão de ações saíam da tela; a situação foi para baixo do nome do produto, como na lista de pedidos, e um teste confere que as ações ficam visíveis;
  - a demonstração passou a nascer com itens zerados e esgotados (a Água Mineral na lanchonete, bebidas na pizzaria), e as contagens de "Esgotados" do cardápio mudaram junto.
- **Também mudou:** a pedido dele, pizzaria e farmácia deixaram de ter cor própria no painel; todos os segmentos usam a mesma cor neutra (saiu o `lib/admin/tema-segmento.ts` e a faixa colorida da barra lateral).
- **Testes e cobertura:** `tsc` e Biome limpos nos arquivos do painel; 757 testes no Vitest; os mínimos de cobertura subiram para geral 68/61/67/69 e `lib/**` 96/94/97/97. O E2E de estoque (contagem, venda no PDV que zera e esgota, cancelamento que devolve, com acessibilidade) passa; as fotos do Estoque (claro, escuro, celular e computador) foram revisadas.
- **Pendente de outra sessão:** quem está mexendo no bloco "Personalizar loja" da barra lateral precisa revisar e atualizar as fotos do painel no computador, e o Biome acusa formatação em `components/produto/info-remedio*.tsx` e `produto-sheet.tsx`.

## Fase 13: dashboard completo

**Desenho** em [dashboard-completo.md](dashboard-completo.md), fechado em 19/11/2026. A visão geral da Fase 3 vira um painel com abas na URL (Resumo, Vendas, Produtos, Clientes, Operação, Entrega, Financeiro e uma aba própria do segmento), faixa de alertas, metas do mês, comparação com a semana passada, clique para Pedidos filtrada, CSV e impressão.

- **Fora da tela:** o pedido passa a guardar o horário de cada status, o produto ganha custo (com cópia na venda), o cancelamento ganha motivo, as Configurações ganham a taxa de cada forma de pagamento e o gerador de demonstração sobe para a versão 3.
- **Etapas,** cada uma num PR: 1. Resumo; 2. Vendas; 3. Base de dados; 4. Produtos e Financeiro; 5. Operação e Clientes; 6. Entrega e abas do segmento; 7. CSV e impressão.

Situação: planejada em 19/11/2026; etapa 1 (Resumo), etapa 2 (Vendas) e etapa 3 (Base de dados) prontas em 19/11/2026; etapa 4 (Produtos e Financeiro) pronta em 20/11/2026; etapa 5 (Operação e Clientes) pronta em 21/11/2026.

- **Etapa 1:**
  - abas Resumo, Vendas e Financeiro no endereço (`?aba=`), dentro do painel de cada aba para leitores de tela;
  - Resumo com a faixa Precisa de atenção, Hoje comparado com o mesmo dia da semana passada, a meta do mês (definir, mudar e apagar; meta de hoje e projeção), o bloco Agora na loja do segmento, o período resumido e os 5 mais vendidos;
  - o Resumo confere os pedidos a cada 30 s;
  - regras novas em `lib/admin/regras/dashboard/` (abas, nomes, semana passada, metas, alertas, destaques do segmento, contagens e a busca), e as metas em `lib/admin/metas.ts`.
- **Diferente do desenho:**
  - Vendas e Financeiro já nascem nesta etapa, só com o que saiu do Resumo (canais e o dia a dia; formas de pagamento); as etapas 2 e 4 completam;
  - a barra de abas ainda não fica presa no topo nem rola de lado no celular: com 3 abas, ela cabe (entrou na etapa 2).
- **Etapa 2:**
  - aba Vendas com a régua (faturamento, pedidos, ticket e itens por pedido, cada um comparado ao período anterior), o gráfico por dia com o período anterior em cinza atrás e a troca Dia/Semana a partir de 14 dias, o mapa de calor dia da semana × hora (uma tabela, com o número ao passar o mouse, tocar ou focar), a média por hora do dia, canais, origem e o dia a dia em tabela;
  - clicar no canal ou na origem abre Pedidos filtrada no período; a lista de Pedidos aceita `?origem=` só pelo endereço, como etiqueta removível;
  - no celular, a barra de abas fica presa embaixo do cabeçalho e rola para o lado, com a borda esmaecida;
  - regras em `lib/admin/regras/dashboard/vendas.ts`; o `fatias` foi para `comum.ts`.
- **Etapa 2, diferente do desenho:** a semana agrupa os dias de 7 em 7 a partir do início do período (a última pode ser menor), para cada semana ter a mesma semana do período anterior ao lado; o mapa de calor mostra só as horas entre a primeira e a última com venda.
- **Etapa 3:**
  - o pedido guarda o `historico` de status (etapa e hora), anotado pelo `comEtapa` (`lib/admin/regras/historico.ts`) em toda mudança do servidor: Fila, Pedidos, PDV, Cozinha, Mesas, Garçom, agenda, pagamento e o encerramento do dia;
  - cancelar aceita um motivo opcional, escolhido na confirmação (lista fixa em `rotulos.ts`); o pedido cancelado mostra "Motivo: …" ou "Não informado";
  - o produto ganha `custo`, com o campo Custo no formulário do cardápio; PDV, mesa, agenda e o gerador copiam o custo no item vendido (`custoUnitario`);
  - as Configurações ganham a seção Taxas de pagamento;
  - gerador v3: histórico com tempos plausíveis (num sorteador próprio, para os outros sorteios não mudarem), custos de 31% a 59% do preço (no salão, 16% a 34%; cerca de 1 em 12 sem custo), motivos nos cancelados (uns sem motivo) e taxas nas lojas de demonstração.
- **Etapa 3, diferente do desenho:**
  - **taxas por forma do painel,** não por crédito e débito: o pedido não diz qual cartão foi usado. São três: Pix online, cartão online e cartão na maquininha. Dinheiro e Pix no balcão não têm taxa;
  - **um custo só,** no produto: o custo que ficava no estoque saiu, e a entrada de compra e a configuração do estoque passam a gravar o custo do produto;
  - nos pedidos em andamento gerados, o `atualizadoEm` continua o da criação (a Cozinha usa esse campo para os prontos recentes); o histórico tem as horas de cada etapa.
- **Etapa 3, corrigido no caminho:** salvar o formulário do produto apagava o estoque e os dados do medicamento; agora eles ficam como estavam.
- **Etapa 4:**
  - aba Produtos (entre Vendas e Financeiro): régua com produtos vendidos, unidades (kg no açougue), margem e sem venda; ranking por R$ ou quantidade, com o caminho para os pedidos de cada produto (`?busca=`); categorias; curva ABC; margem por produto, com o aviso de quem ficou sem custo; adicionais e opções mais escolhidos; estoque, com o valor parado e em quantos dias cada produto acaba; o que não vendeu; e a tabela de todos os produtos;
  - aba Financeiro completa: do bruto ao líquido (com os descontos do PDV), depois das taxas e do custo (taxas estimadas, líquido depois delas, margem bruta com a cobertura do custo e o que falta receber), formas de pagamento com o caminho para os pedidos e as taxas de cada forma, com o aviso da forma sem taxa e o link para configurar;
  - regras em `lib/admin/regras/dashboard/produtos.ts` e `financeiro.ts`.
- **Etapa 4, decidido no caminho:**
  - a margem usa o total do item (com os adicionais, que não têm custo próprio) contra o custo do produto vezes a quantidade (no quilo, vezes o peso); a tela avisa;
  - o faturamento por produto é o total do item como foi vendido, sem ratear o desconto do pedido; os descontos ficam no Financeiro;
  - a barra do ranking se mede pelo primeiro colocado (com muitos produtos, a parte de cada um é pequena); a % ao lado continua sendo a parte no faturamento;
  - o caminho de um produto para os pedidos usa a busca por nome, que também acha os produtos com nome parecido.
- **Etapa 5:**
  - aba Clientes (depois de Produtos): usa sempre os últimos 90 dias, numa busca própria, e o filtro de período dá lugar a "Últimos 90 dias, até hoje"; régua com clientes, novos, % que voltou e pedidos por cliente; melhores clientes levando aos pedidos de cada um; sumidos com o botão que abre o WhatsApp com a mensagem pronta, sem enviar nada sozinho;
  - aba Operação (depois de Clientes): régua com % no prazo, tempo na loja, cancelados e o online que não foi pago; tempo por etapa com a média e os 9 em 10; atrasos por hora; cancelamentos por motivo (levando aos cancelados) e por canal; mesas e vendas por garçom; no salão, a pontualidade toma o lugar dos tempos da fila;
  - Pedidos aceita `?cliente=` e `?motivo=` pelo endereço, como etiquetas removíveis;
  - regras em `lib/admin/regras/dashboard/clientes.ts` e `operacao.ts`; `MINUTOS_DE_ATRASO` virou constante da fila.
- **Etapa 5, decidido no caminho:**
  - **no prazo** é abaixo dos 40 min da fila, contando o que depende da loja: a entrega até entregar; a retirada e a mesa até ficar pronto; pago online, a partir do pagamento;
  - **novos** são os clientes cujo primeiro pedido caiu nos últimos 30 dias (com 90 dias de histórico, todos teriam o primeiro pedido nos 90 dias);
  - o telefone da própria loja (PDV e mesa) não conta como cliente;
  - **no salão**, a pontualidade mede o atraso para começar (adiantado conta como zero), a % que começou até 10 min depois da hora e a duração real contra a marcada;
  - a **ocupação das mesas** ficou de fora: o painel não guarda quanto tempo cada mesa ficou ocupada além das comandas; no lugar, o tempo de mesa e o ticket por mesa.
- **Etapa 5, a demonstração:** com 42 clientes pedindo sem parar, a aba Clientes não tinha sumido nem novo. O gerador agora faz 1 em 7 clientes sumir (não pede há 40 dias) e 1 em 9 começar há 20 dias; o pedido que sai deles vai para um cliente de uma vez só. VERSAO 4.
- **Também mudou:** as fotos do Playwright escondem o selo de avisos do Next no modo dev (`tests/sem-avisos-do-next.css`), que aparecia mesmo com `devIndicators: false`.
