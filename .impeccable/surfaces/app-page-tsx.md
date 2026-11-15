---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["components/cardapio"]
---

# Vitrine (cardápio)

Escopo: a página inicial da loja (`app/page.tsx`, `components/cardapio/**`, barra e ilha da sacola). Modo: operate (a pessoa faz um pedido). Construção guiada pelo código, sem comp.

Quem e o quê: cliente no celular, vindo do WhatsApp, acha o produto, entende preço e o dado que importa no segmento e adiciona em um toque. A mesma tela serve pizzaria, farmácia, adega, açougue, salão e lanchonete; só mudam as quatro cores, a marca e os dados da etiqueta.

Pedido do usuário: minimalista, com acabamento, animações de qualidade que agregam, design único e segmentos únicos pelos detalhes, acessível. Errado se: igual a todo app, bonito mas lento, serve a uma loja só, parece site institucional.

Em aberto: a folha do produto, o checkout e o acompanhamento ganham o mesmo mundo depois.

## Direction contract

THESIS: A vitrine é uma página quieta em que a etiqueta de preço é o único detalhe marcado. Recusa o arranjo de app de delivery: capa colorida, cartão flutuante sobre ela, pílulas de categoria, cards com sombra e carrinho gritando.

OWN-WORLD: O fundo da loja, sem cartões: produtos separados por espaço e fios finos. Uma família tipográfica (Geist) em dois pesos, números tabulares. A cor da loja só onde tem função: logo, sublinhado da aba ativa, traço da etiqueta, o botão de adicionar (a ação do produto) e a sacola. Sem sombra, exceto a sacola flutuante. Raio base de 12 px.

STORY: A pessoa reconhece a loja e três fatos (entrega, retirada, mínimo), acha o produto pela aba ou pela busca, lê na etiqueta o dado do segmento e o preço, adiciona em um toque e vê a sacola somar até o mínimo.

FIRST VIEWPORT: Celular 390: linha de status e Pedidos; logo de 44 px, nome em 26/600 e slogan; régua de três fatos entre fios; busca de 40 px; abas de texto com sublinhado de 2 px; a primeira seção com foto de 112 px à esquerda, nome, descrição em duas linhas, etiqueta (traço da cor da loja, atributo do segmento, preço) e o botão de adicionar; a sacola fixa de 56 px na cor da loja, com um fio que enche até o mínimo. Desktop: mesma ordem numa coluna de leitura central de até 1120 px, lista em duas colunas. Logo de 56 px no celular e 72 px no desktop, foto de 104 px no celular e 112 px do tablet em diante.

FORM: A Etiqueta da Vitrine, quarta da lista ordenada, seed:29d4c9464bd67af3. Assinatura: ao adicionar, a etiqueta se solta do produto e desliza até a sacola, que soma o valor e enche o fio do mínimo. Movimento: saída rápida (`cubic-bezier(0.23, 1, 0.32, 1)`), 150 a 300 ms, toque com escala 0,97, nada surgindo ao rolar, tudo parado com movimento reduzido.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
