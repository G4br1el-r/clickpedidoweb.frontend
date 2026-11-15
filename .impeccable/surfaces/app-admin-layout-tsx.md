---
version: 1
slug: "app-admin-layout-tsx"
primary_target: "app/admin/layout.tsx"
related_targets: ["components/admin","app/admin"]
---

# Painel da loja (/admin)

Modo: Operate. Quem usa: lojista e equipe no pico (balcão, cozinha, salão) e o lojista em potencial vendo a demo. Tarefa: ler estado, tempo e próxima ação em segundos e agir. Restrições: TDD, 11 telas, claro e escuro, movimento reduzido, segmento define os módulos. Decisões do usuário (2026-11-15): mesma família visual da vitrine; ritmo de ferramenta de pico; o editor de aparência entra no redesenho.

## Direction contract

THESIS: O painel é o fundo da mesma loja: página quieta, linhas separadas por fios, e um único detalhe marcado, o traço da Etiqueta, que aqui marca estado e seleção. Recusa o dashboard shadcn padrão de cartões com borda, pílulas cinza para tudo e número grande em caixa.

OWN-WORLD: Geist 500/600, números tabulares. Fundo névoa neutra, superfície branca, lateral num segundo neutro. Tinta quase preta para ação primária; laranja só para atenção (atraso, alerta). Estado = traço de 3 px + texto, numa paleta fixa de status. Fios de 1 px, sombra só no que flutua.

STORY: Quem abre vê o que está acontecendo agora (fila, atrasos, caixa), entende o estado de cada pedido pela cor do traço e avança com um toque; o lojista em potencial reconhece a própria operação e a mesma casa da vitrine.

FIRST VIEWPORT: Topo plano de 56 px com trilha, segmento e tema; título de 24 px com resumo vivo ao lado das ações; logo abaixo a régua de números ou o quadro da tarefa, sem cartões de métrica.

FORM: Extensão do mundo estabelecido "A Etiqueta da Vitrine" a uma superfície Operate; padrões conhecidos (lateral, tabela, quadro). seed: none (pinned) — "Mesma família da vitrine" e "Ferramenta de pico", escolhidos pelo usuário.

SIGNATURE: o pedido anda. Ao avançar o status, o cartão desliza para a coluna seguinte (layout compartilhado, 250 ms, curva da casa) e o traço troca de cor; número que muda rola os dígitos; pedido novo entra com realce que esmaece.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
