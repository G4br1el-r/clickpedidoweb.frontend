# Levantamento dos painéis administrativos (5 lojas)

Levantado em 13/11/2026. As lojas abertas foram as que estavam rodando em `localhost:5081` a `5085`, e o código lido foi o de `Projetos/betaup.clickpedidoweb/<loja>/ClickPedido.Web`: controllers, views com o JS embutido, API do admin, serviços e modelo. A visão geral do sistema (stack, branches, riscos) está em `betaup.clickpedidoweb/CONTEXTO.md`; este documento trata **só do `/Admin`**.

Objetivo: saber o que é comum, o que é de cada loja e o que falta no nosso painel, para trazer tudo para um painel único.

## 1. Quadro geral

Legenda: **●** completo · **◐** versão reduzida · **○** não tem · **⚙** existe, mas pode ser desligado

| Módulo                              | Adega                        | Açougue           | Pizza                | Empório            | Quiosque             |
| ----------------------------------- | ---------------------------- | ----------------- | -------------------- | ------------------ | -------------------- |
| Visão geral (dashboard com período) | ●                            | ● +coluna "Pesar" | ● +coluna "Pesar"    | ●                  | ●                    |
| Fila de pedidos (kanban)            | ●                            | ●                 | ●                    | ●                  | ◐ sem chave Delivery |
| PDV (venda no balcão)               | ●                            | ● +pesagem        | ● +pesagem (sem uso) | ⚙ ligado           | ○                    |
| Cozinha (KDS)                       | ● filtra o que vai à cozinha | ◐ tudo vai        | ◐ tudo vai           | ⚙ desligado        | ◐ tudo vai           |
| Mesas do salão                      | ● comanda editável           | ◐ só leitura      | ◐ só leitura         | ⚙ desligado, ◐     | ◐ só leitura         |
| Modo Garçom                         | ●                            | ◐                 | ◐                    | ⚙ desligado, ◐     | ◐                    |
| Agendamentos                        | ○                            | ○                 | ○                    | ⚙ ligado           | ○                    |
| Pedidos (lista e detalhes)          | ●                            | ● +pesagem e link | ●                    | ●                  | ● numeração mensal   |
| Cardápio: lista de produtos         | ●                            | ●                 | ●                    | ●                  | ◐ simples            |
| Cardápio: formulário do produto     | ●                            | ● +UN/KG          | ● +UN/KG             | ● +vídeo           | ◐                    |
| Categorias                          | ●                            | ● +vitrines       | ●                    | ●                  | ●                    |
| Motoboys                            | ●                            | ●                 | ●                    | some sem entrega   | ●                    |
| Bairros e taxas                     | ●                            | ●                 | ●                    | some sem entrega   | ●                    |
| Configurações                       | ●                            | ● +vitrines       | ●                    | ● +módulos e vídeo | ●                    |
| Trocar senha                        | não persiste                 | não persiste      | não persiste         | não persiste       | ● funciona           |

Confirmado no navegador: o menu do Quiosque não tem PDV, e o do Empório mostra Agendamentos e esconde Cozinha, Mesas, Garçom, Motoboys e Bairros.

**Por que as versões divergem:** cada loja é uma cópia do código. A adega recebeu três commits de mesa, garçom e cozinha depois que açougue e pizza saíram dela; o empório saiu um commit antes do último; o quiosque é outra linha, que saiu da `main`. Quase tudo o que "falta" numa loja não foi removido: a correção nunca chegou lá.

---

## 2. O que todas têm em comum

Isto é o núcleo do painel. A referência é a adega, a versão mais completa.

### Acesso e estrutura

- Login e senha, sessão de 12 h, limite de 10 tentativas a cada 5 min. Depois de entrar, abre a **Fila**, não a visão geral.
- **Um usuário só, sem perfis.** Garçom, cozinha e caixa usam o mesmo login, com acesso a tudo.
- Barra lateral com logo, nome, selo "Loja aberta/fechada", menu, "Ver loja", "Trocar senha" e "Sair".
- Mensagens de sucesso e erro no topo e um toast global.

### Visão geral (dashboard)

- Período por duas datas ou atalhos: Hoje, Ontem, 7, 15 e 30 dias, Este mês. Teto de 90 dias. O período é comparado com o anterior de mesmo tamanho.
- **Movimento de hoje:** pedidos, faturamento, ticket médio e "em andamento agora", mais os aguardando pagamento e os cancelados.
- **Período:** faturamento com variação %, pedidos, ticket médio e melhor dia.
- Gráfico de barras por dia, alternando entre faturamento e quantidade. Destaca hoje e o pico, e clicar numa barra abre os pedidos daquele dia.
- Tabela dia a dia, formas de pagamento e canais (Entrega, Retirada, Mesa), com % e barra.
- Produtos mais vendidos (período e hoje) e os 10 pedidos mais recentes.
- "Pedido válido" = não cancelado e não aguardando pagamento.

### Fila de pedidos

- Kanban: Novos → Em preparo → Prontos → Em rota. Atualiza a cada **5 s** e quando a aba volta a ficar visível.
- Card: número, tipo (Entrega, Retirada, Mesa N), hora e minutos desde a criação (amarelo a partir de 25 min, vermelho a partir de 40), cliente com link do WhatsApp, endereço, itens com opções e observação, pagamento ("Pago" ou "Cobrar R$ X, troco para Y") e motoboy.
- Ações: avançar etapa (o texto muda: "Iniciar preparo", "Marcar como pronto", "Saiu para entrega", "Cliente retirou"), escolher e **chamar motoboy pelo WhatsApp** com mensagem pronta, imprimir ou reimprimir, ver detalhes.
- Chaves: **Loja aberta**, **Alerta sonoro** (suave, alto ou muito alto, com botão de teste) e **Imprimir novos pedidos**.
- Status da impressora: o Agente local fica online quando deu sinal nos últimos 12 s.
- Só na linha da adega (fora o quiosque): chave **Delivery** e uma tabela de entregas em andamento.

### Pedidos

- **Lista** de um dia, com filtro de status: número, hora, cliente, tipo, total, pagamento e status, mais o total do dia. Não tem paginação nem busca.
- **Detalhes:** itens, subtotal, desconto, taxa e total; cliente, endereço com "Abrir no mapa"; botão "Avisar cliente no WhatsApp" com o link de acompanhamento; pagamento com troco e ids do gateway; motoboy.
- **Ações:** avançar, **mudar para qualquer status**, marcar como pago e cancelar.
- **Imprimir:** cupom HTML de 80 mm.
- "Limpar todos os pedidos" apaga o histórico inteiro e zera a numeração. Não existe no quiosque.

### Cardápio

- **Categorias:** criar, renomear, ordenar, mostrar ou ocultar e excluir (só quando vazia).
- **Produto:** categoria, nome, descrição, preço, preço "de" (oferta com % calculado), foto por upload, disponível (esgotado), visível, destaque e oferta.
- **Grupos de opções** (tamanhos, sabores, adicionais): nome, mínimo (0 = opcional), máximo, **grátis até N** e ativo. Cada item tem nome, preço adicional e ativo. É com isso que se montam pizza meio a meio, borda, combos e serviços.
- "Replicar opções para toda a categoria" substitui os grupos dos outros produtos da categoria.
- Excluir um produto não apaga o histórico, porque o item do pedido guarda nome e preço.

### Entrega

- **Motoboys:** nome, WhatsApp e ativo. A mensagem para o motoboy leva endereço, valor a cobrar ou "já pago" e o link do mapa.
- **Bairros e taxas:** cidade, bairro, taxa e ativo, com busca e filtro por cidade. A taxa do pedido vem do bairro; sem bairro, usa a taxa padrão da loja.

### Configurações (um formulário, tudo salvo junto)

1. **Loja:** nome, slogan, telefone, WhatsApp, endereço e texto do horário (gerado sozinho quando vazio).
2. **Horários:** 7 dias com abre e fecha, "copiar para todos", abrir e fechar automaticamente pelo horário (aceita expediente que passa da meia-noite) e mensagem de loja fechada.
3. **Entrega e retirada:** aceita cada uma, taxa padrão, pedido mínimo, tempos estimados e cidades atendidas.
4. **Formas de pagamento:** Pix, cartão online, dinheiro e cartão na entrega. Pix e cartão online só aparecem com gateway configurado.
5. **Mercado Pago:** token, chave pública, client id e secret.
6. **Impressão:** Agente local (download, status, teste), impressora do servidor Windows, impressão automática e guilhotina.
7. **Alerta sonoro:** tipo de som e demonstração.

### Regras que valem para todas

- **Status:** Aguardando pagamento → Recebido → Em preparo → Pronto → (Entrega: Saiu para entrega →) Concluído; Cancelado a qualquer momento. Pagamento online não pago em 60 min é cancelado.
- **Situação do pagamento:** pendente (online), na entrega (dinheiro e maquininha), pago e cancelado. Concluir um pedido "na entrega" marca como pago.
- **Impressão:** primeiro o Agente local, depois a impressora Windows do servidor, por último o navegador.
- **Som:** toca quando chega um pedido novo, em três tipos gerados pelo navegador.

---

## 3. O que cada loja tem de próprio

### Adega da Vila (a base)

- **Comanda de mesa completa:** o garçom escolhe entre **"Lançar na mesa"** (não vai à cozinha) e **"Enviar p/ cozinha"**; vê a comanda aberta; muda quantidade, observação ou remove item; lança **item avulso** (nome, quantidade e valor).
- A **cozinha só recebe** o que foi enviado para ela.
- A mesa **só conclui ao fechar a conta**. Nas outras lojas, "Pronto" já conclui, e a rodada seguinte do garçom some da conta.
- **Preço de balcão** usado no PDV e na mesa. Também existe no açougue, na pizza e no empório; o quiosque não tem.
- **Combos que se ajustam sozinhos:** esgotar um gelo, energético ou destilado desliga a opção de mesmo nome nos combos, e os sabores de gelo são criados nos combos automaticamente. A regra é amarrada aos nomes do catálogo da adega.

### Açougue Sabor da Carne

- **Venda por quilo:** o produto é UN ou KG. No site, o cliente escolhe o peso (de 100 em 100 g) e vê um preço estimado.
- **Pesagem:** no PDV e nos detalhes do pedido, o operador digita o valor real da balança por item. O sistema mostra o total estimado, o novo total e a diferença (a mais ou a menos), e grava quando foi pesado.
- **Pagar após a pesagem:** forma de pagamento própria. O operador manda pelo WhatsApp o link `/checkout/{token}`, e o cliente paga o valor final por Pix ou cartão.
- **Data de retirada** escolhida pelo cliente, que aparece nos detalhes.
- **Vitrines configuráveis:** título e liga/desliga de "Destaques" e "Ofertas". A opção aparece duas vezes, em Categorias e em Configurações.
- Coluna "⚖️ Pesar" nos pedidos recentes da visão geral.

### Casa da Pizza

- **Nada próprio no painel.** O "Monte sua pizza" é só cadastro com os grupos de opções comuns: 1º sabor, 2º sabor, borda e massa.
- **Preço:** base + adicional de cada metade + borda. Não é o "maior sabor" nem a média.
- Herdou do açougue a pesagem, o UN/KG e textos de "Casa de Carnes", que não servem para pizzaria.

### Empório das Deusas (salão)

- **Agendamentos** (`/Admin/Agendamentos`):
  - cartões Hoje, Amanhã, Próximos 7 dias e Todos;
  - busca por cliente, telefone ou serviço, filtro por data e por status;
  - ações iniciar, concluir, marcar como pago e cancelar;
  - link do WhatsApp do cliente e impressão do ticket.
  - Por trás, o **agendamento é um pedido comum**. A data e a hora são **texto dentro da observação**, e os filtros usam a data em que o pedido foi feito, não a do atendimento.
- **Módulos ligáveis** em Configurações: Agendamentos, PDV, Cozinha e Mesas (que inclui o Garçom). Eles só escondem o menu, porque as telas continuam abrindo pelo endereço.
- **Entrega desligada** esconde Motoboys e Bairros do menu.
- **Vídeo no produto** (upload até 50 MB ou link do YouTube, Shorts ou Reels) e **vídeo no banner** da loja.

### Quiosque do Mineiro

- **Número do pedido que recomeça todo mês** (`#1`, `#2`… em novembro). Aparece na fila, nos pedidos, nas mesas, no cupom e no WhatsApp, mas a visão geral e a cozinha ainda mostram o id interno.
- **Consulta de pedido por telefone**, do lado do cliente: pedidos das últimas 48 h. Não tem tela no admin.
- Tudo o mais é uma versão mais simples:
  - sem PDV, sem preço de balcão e sem desconto;
  - lista de produtos sem busca, filtros, preço na linha, edição rápida ou copiar;
  - formulário sem link de imagem e sem ordenar grupos e itens;
  - Fila sem a chave Delivery;
  - mesa e garçom só de leitura e lançamento.
- É a única loja em que **trocar a senha funciona**.

---

## 4. A mesma função com comportamentos diferentes

| Ponto            | Como varia                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Comanda de mesa  | Adega: completa. Empório: edita, mas sem observação e sem avulso. Açougue, pizza e quiosque: só lança, e tudo vai para a cozinha |
| Mesa em "Pronto" | Adega espera fechar a conta; nas outras conclui, e a rodada seguinte some da conta                                               |
| Número do pedido | Id sequencial em 4 lojas; número mensal no quiosque                                                                              |
| Vitrines         | Títulos e liga/desliga só no açougue; fixas nas outras                                                                           |
| Agendamento      | Só no empório, e guardado como texto                                                                                             |
| Venda por peso   | Funciona no açougue; inútil na pizza; o PDV e o garçom ignoram o KG                                                              |
| Senha            | Volta à original a cada reinício em 4 lojas                                                                                      |

---

## 5. O nosso painel hoje

O `/admin` do protótipo é um **editor da loja**, com prévia ao vivo das telas do cliente. As seções são:

- **Marca:** Identidade (nome, subtítulo, logo, banner).
- **Aparência:** Cores e botões, Tipografia, Animações.
- **Telas:** Página inicial, Produtos e cards, Tela do produto, Sacola (inclui pedido mínimo), Finalizar pedido (inclui formas de pagamento), Acompanhar pedido, Conversa no WhatsApp.
- **Recursos:** Funcionalidades (liga e desliga recursos do site).
- O Início do painel ainda está vazio.

Nenhuma das lojas antigas tem essa parte: lá, a aparência era mudada no código de cada cópia. **Nós não temos nada da operação:**

- visão geral, fila, PDV, cozinha, mesas e garçom;
- pedidos e agendamentos;
- cardápio (produtos, opções, categorias);
- motoboys e bairros;
- e a parte operacional das configurações: horários, entrega, gateway, impressão e som.

Os pontos que se encostam:

- **Identidade:** nome, slogan, logo e banner.
- **Pedido mínimo e formas de pagamento:** aparecem nas nossas seções Sacola e Finalizar.
- **Funcionalidades:** a ideia é a mesma dos módulos ligáveis do empório, só que do lado do cliente.

---

## 6. Pontos para conversar antes de construir

São observações, não decisões.

1. **Módulos por loja e por segmento.** Os `Habilitar*` do empório são o embrião. A lista natural:
   - **núcleo:** visão geral, pedidos, fila, cardápio e configurações;
   - **ligáveis:** PDV, cozinha, mesas e garçom, entrega (motoboys e bairros), agendamentos, venda por peso, pagar após pesagem, data de retirada, numeração mensal, vitrines, vídeo e combos automáticos.
   - Isso casa com a regra já decidida de que o segmento define o que aparece.
2. **Agendamento precisa de data e hora de verdade**, não texto na observação, para ordenar, filtrar pelo dia do atendimento e ver conflitos.
3. **Perfis de acesso** (dono, caixa, garçom, cozinha) não existem em nenhuma loja.
4. **Qual versão de cada módulo vira a referência:**
   - mesa, garçom e cozinha: a da adega;
   - pesagem: a do açougue;
   - numeração mensal: a do quiosque.
5. A **sincronização de combos** da adega depende dos nomes do catálogo dela. No painel único, precisaria virar algo configurável, por exemplo "esta opção é o produto X".

## 7. O que não copiar (bugs vistos no código)

- A API do Agente de impressão não tem autenticação: qualquer um pode puxar os cupons, com os dados dos clientes.
- O texto digitado pelo cliente entra sem escape no KDS e no garçom (XSS).
- "Mudar status" e a cozinha aceitam qualquer transição. Pela cozinha, uma comanda de mesa vira "Concluída" e "Paga" sem fechar a conta.
- PDV e garçom confiam no preço que vem do navegador.
- A chave "Delivery" fecha a loja inteira, e as chaves de loja e delivery desligam o horário automático sem avisar.
- "Liberar mesa" deixa o pedido órfão na fila e na cozinha.
- A fila mostra pedidos de qualquer dia, e um pedido esquecido fica lá para sempre.
- O faturamento "confirmado" do dia soma pedidos não pagos.
- A impressão automática do servidor usa uma conexão de banco já fechada e tende a falhar em silêncio. Com as duas chaves de impressão ligadas, sai em dobro.
- Os botões "Conectar POS-80", "USB/Serial" e "Desconectar" chamam funções que não existem.
- Pesagem do açougue:
  - dá para ajustar o valor de pedido já pago;
  - o preço unitário fica errado com quantidade maior que 1;
  - o link do PDV usa o id do pedido em vez do token.
- O som escolhido em Configurações é salvo no banco, mas a fila lê só o do aparelho.
