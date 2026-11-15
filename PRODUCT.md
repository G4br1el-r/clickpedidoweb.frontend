# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first. Testado em 11 telas (`playwright.config.ts`), do celular de 320 px ao desktop de 2560 px, com o celular deitado e o tablet incluídos.

## Users

Dois usuários com o mesmo peso nas decisões:

- **Cliente final da loja, no celular.** Chega por um link (WhatsApp, Instagram), quer achar o produto, montar a sacola, pagar e acompanhar o pedido sem atrito. Fluxo: cardápio → sacola → checkout → acompanhamento, mais a busca de pedidos e a conversa no WhatsApp.
- **Lojista e equipe, operando a loja.** Dono, caixa, cozinha e garçom no meio do movimento: fila de pedidos ao vivo, PDV no balcão, cozinha, mesas, garçom, pedidos, cardápio, estoque, entrega e configurações. Hoje é um usuário só, sem perfis.

Quem avalia este protótipo agora é o **lojista em potencial**, vendo a demonstração antes de contratar.

## Product Purpose

Uma plataforma única de pedidos online para pequenos negócios locais, com vitrine para o cliente e painel para a loja, num só código servindo vários segmentos. Ela substitui as cópias separadas de cada loja da linha ClickPedido (Adega da Vila, Açougue Sabor da Carne, Casa da Pizza, Empório das Deusas, Quiosque do Mineiro), que divergiram com o tempo; o levantamento está em `docs/levantamento-admin.md` e o plano em `docs/plano-painel-admin.md`.

**Uso atual:** protótipo para vender e validar. Os dados mockados são a demonstração comercial; o produto real (com backend) vem depois. Sucesso agora é o lojista ver a própria operação na demo e querer contratar.

## Positioning

- **Canal próprio, sem comissão.** O pedido é da loja, chega pelo WhatsApp dela, sem marketplace no meio nem taxa por pedido.
- **Feito por segmento.** Cada cliente tem um único segmento, e o segmento define o que existe: pesagem e venda por quilo no açougue, agenda no salão, meio a meio e borda na pizzaria, princípio ativo na farmácia, combos na adega, número mensal na lanchonete. Uma pizzaria nunca vê "corte"; um salão nunca vê "borda".
- **Marca do lojista.** A vitrine veste as cores e a identidade da loja, não a da plataforma.
- **Painel completo.** Fila, PDV, cozinha, mesas, garçom, agendamentos, estoque, entrega, impressão e som num lugar só, do balcão ao delivery.

## Operating Context

- **Cliente:** celular, uma mão, com pressa, muitas vezes vindo de uma conversa no WhatsApp e voltando para ela (link de acompanhamento, conversa simulada em `/whatsapp`).
- **Loja:** balcão, cozinha e salão em horário de pico. A fila atualiza a cada poucos segundos, toca alerta sonoro em pedido novo, marca atraso por tempo (25 e 40 min), imprime cupom de 80 mm (agente local, impressora do servidor ou navegador) e chama o motoboy pelo WhatsApp com mensagem pronta.
- **Vocabulário de status:** Aguardando pagamento → Recebido → Em preparo → Pronto → (Saiu para entrega →) Concluído, Cancelado a qualquer momento. Mesa só conclui ao fechar a conta; atendimento do salão vai de Agendado a Em atendimento e Concluído.
- Idioma: português do Brasil, moeda em reais formatada pelo `Intl`.

## Capabilities and Constraints

- **Segmentos na demo:** pizzaria, farmácia, adega, açougue, salão de beleza e lanchonete (`lib/segmentos.ts`), cada um com textos próprios na vitrine e no acompanhamento. O seletor no topo troca a loja na vitrine e o segmento no painel.
- **Módulos por segmento:** definidos em `lib/admin/segmentos-painel.ts`; módulo fora do segmento mostra aviso em vez da tela.
- **Plano Pro:** recursos avulsos ou pacote completo contratados pela sacola do próprio painel; as opções Pro aparecem com cadeado até serem liberadas (`lib/admin/config.ts`).
- **Tema por loja:** cores do lojista viram variáveis CSS com contraste mínimo de 4,5:1 garantido automaticamente (`lib/tema.ts`), em claro e escuro.
- **Dados:** tudo mockado, sem banco. Pedidos gerados de forma determinística (90 dias por segmento), salvos em IndexedDB, com "Restaurar dados de demonstração".
- **Stack:** Next.js 16, React 19, Tailwind 4, shadcn/ui, zustand, React Query, Motion. TDD obrigatório (Vitest + Testing Library, Playwright com screenshots), regras de negócio como funções puras em `lib/`.
- **Em aberto:** o nome e a marca da própria plataforma para o produto novo; perfis de acesso (garçom, cozinha, caixa) ainda não existem; preço e modelo comercial do plano Pro além dos valores da demo.

## Brand Commitments

- A marca que aparece para o cliente final é a **do lojista**, nunca a da plataforma.
- Voz em pt-BR, direta e próxima, adaptada a cada segmento ("Saúde!" na adega, "Bom churrasco!" no açougue, "Melhoras!" na farmácia, "Volte sempre!" no salão).
- Nomes das lojas de referência (Adega da Vila, Açougue Sabor da Carne, Casa da Pizza, Empório das Deusas, Quiosque do Mineiro, Drogaria Bem-Estar) são lojas reais ou de demonstração da linha atual.

## Evidence on Hand

- **Catálogos reais** extraídos dos seeds das lojas: adega 255 produtos (190 com foto), açougue, pizzaria (mesmo cardápio da vitrine), salão 13 serviços, lanchonete 41, farmácia; fotos em `public/mock`.
- **Levantamento das 5 lojas atuais** (`docs/levantamento-admin.md`), com o que é comum, o que é próprio e os bugs que não devem ser copiados.
- **Animações Lottie** em `public/lottie`.
- **Não existem:** depoimentos, números de clientes, métricas de uso, casos de sucesso ou imprensa. Não inventar.

## Product Principles

1. **O segmento manda.** Cada loja vê só o que o negócio dela usa, com as palavras do negócio dela. Nada genérico vaza entre segmentos.
2. **A loja aparece, a plataforma some.** Para o cliente final, a identidade é do lojista; a plataforma se mostra no painel, e com discrição.
3. **Pico de movimento é o caso de uso.** No painel, ler e agir em segundos importa mais que enfeite: estado do pedido, tempo e próxima ação sempre à vista.
4. **A melhor versão vale para todos.** Quando um módulo existe num segmento, ele usa a versão mais completa que as lojas têm, sem copiar os bugs.
5. **A demo tem que parecer a loja de verdade.** Dados realistas, fotos reais, pedidos em todas as etapas: o lojista precisa se reconhecer.

## Accessibility & Inclusion

- Contraste mínimo de 4,5:1 nas cores do lojista, ajustado automaticamente.
- Verificação com axe (`@axe-core/playwright`) nos testes E2E; tabelas no celular sem rolagem lateral inalcançável pelo teclado.
- Respeito a movimento reduzido (gráficos e animações não animam quando o aparelho pede).
- Tema claro e escuro.
