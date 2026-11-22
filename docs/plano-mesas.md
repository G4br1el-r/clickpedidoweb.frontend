# Plano da tela de Mesas

> **Para quem for executar:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`, tarefa por tarefa. Os passos usam `- [ ]` para acompanhar. TDD é obrigatório (CLAUDE.md): nenhum código de produção sem um teste falhando antes.

**Objetivo:** transformar a tela de Mesas do painel no centro de operação do salão: abrir, lançar, mover, dividir e receber, com mapa, reservas, lista de espera e pedido pelo QR.

**Arquitetura:** as regras (estado da mesa, conta, divisão, alertas, mapa, reservas) ficam em `lib/admin/regras/` como funções puras. As operações ficam no servidor de demonstração (`lib/admin/dados/servidor.ts`, IndexedDB), expostas por hooks React Query em `lib/admin/dados/consultas-mesas.ts`. As telas só chamam.

**Tecnologias:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rota), React Query, zustand, zod, `@dnd-kit` (mapa), `qrcode.react` (QR), `react-to-print` (cupons), Motion, Vitest + Testing Library, Playwright. Nenhuma dependência nova.

**Origem:** as decisões Q1 a Q52 da sessão de perguntas de 18 e 19/11/2026, registradas abaixo. Base anterior: Fase 8 de [plano-painel-admin.md](plano-painel-admin.md).

**Situação:** a Fase 1 ficou pronta em 19/11/2026 e está no PR #1. A Fase 2 ficou pronta em 21/11/2026, na branch `claude/admin-mesas-fase-2`, empilhada sobre a Fase 1. A Fase 3 ficou pronta em 21/11/2026, na branch `claude/admin-mesas-fase-3`, empilhada sobre a Fase 2. A Fase 4 ficou pronta em 22/11/2026, na branch `claude/admin-mesas-fase-4`, empilhada sobre a Fase 3. A Fase 5 ficou pronta em 22/11/2026, na branch `claude/admin-mesas-fase-5`, empilhada sobre a Fase 4. A Fase 6 ficou pronta em 22/11/2026, na branch `claude/admin-mesas-fase-6`, empilhada sobre a Fase 5. A Fase 7 ficou pronta em 22/11/2026, na branch `claude/admin-mesas-fase-7`, empilhada sobre a Fase 6. As Fases 1 a 7 já têm passo a passo. Cada fase seguinte ganha o seu quando a anterior estiver pronta, já sobre o código real.

## Restrições gerais

- Tudo mockado, sem banco: dados no IndexedDB do navegador, chave `clickpedido-admin-dados:{segmento}` (PRODUCT.md).
- Vale para os 4 segmentos com Mesas: adega, açougue, pizzaria e lanchonete. O salão de beleza e a farmácia continuam sem Mesas.
- Não existe login nem perfil. O "quem fez" do histórico é o garçom escolhido no aparelho.
- Dinheiro em reais, calculado em **centavos inteiros** e arredondado meio para cima (`reais()` do servidor).
- Fuso: America/Sao_Paulo ("hoje" e "mesmo dia" seguem o fuso da loja).
- Visual segue o [DESIGN.md](../DESIGN.md). Antes de mudar uma tela, o screenshot dela tem que existir em `tests/visual-admin.spec.ts`, e só se atualiza depois de revisar a diferença.
- Desenho para tablet e desktop primeiro. O celular funciona, mas não é o foco (o garçom tem a tela dele).
- Cada fase sai em um PR para `main`, com `pnpm check` e `pnpm test:e2e:rapido` verdes e a saída mostrada. As fases rodam em sequência nesta sessão porque mexem nos mesmos arquivos (`tipos.ts`, `servidor.ts`).
- Os mínimos de cobertura em `vitest.config.mts` nunca baixam. Ao subir a cobertura, o mínimo sobe junto.

## Decisões

### Papel e público

- **Centro do salão (Q1):** tudo que dá para fazer numa mesa dá para fazer pela tela de Mesas. O Garçom continua como atalho de lançamento no celular.
- **Quem usa (Q2):** o gerente ou o caixa, num tablet ou desktop no balcão.
- **Plano Pro (Q32):** mapa do salão, reservas com lista de espera e QR (pedido e chamados) são Pro, com cadeado igual ao da vitrine. O resto é básico. Cada função pode ser ligada nas configurações do salão.

### Estados da mesa (Q5, Q12, Q18, Q23)

O estado aparece no cartão e no mapa como **rótulo + traço de tom** (`TomStatus`). A precedência vai do mais forte para o mais fraco:

| Estado         | Rótulo          | Tom         | Quando                                                        |
| -------------- | --------------- | ----------- | ------------------------------------------------------------- |
| `bloqueada`    | Bloqueada       | `cancelado` | `mesa.bloqueio` existe                                        |
| `juntada`      | Com a mesa 4    | `caminho`   | `mesa.juntadaCom` aponta a principal                          |
| `conta-pedida` | Pediu a conta   | `novo`      | ocupada e `comanda.contaPedidaEm`                             |
| `servir`       | Servir          | `pronto`    | ocupada e `comanda.servirDesde` (a cozinha terminou a rodada) |
| `na-cozinha`   | Na cozinha      | `preparo`   | ocupada e a comanda está em `recebido` ou `em-preparo`        |
| `ocupada`      | Ocupada         | `caminho`   | ocupada, sem nenhum dos acima                                 |
| `limpeza`      | Limpeza         | `espera`    | livre e `mesa.limpezaDesde` (só com a limpeza ligada)         |
| `reservada`    | Reservada 20:00 | `espera`    | livre e há reserva marcada a menos da antecedência (30 min)   |
| `livre`        | Livre           | `fim`       | o resto                                                       |

### Operação

- **Abrir mesa (Q6):** nome do cliente (opcional), **nº de pessoas** (obrigatório, de 1 a 99) e garçom da lista. Mais pessoas que lugares só gera aviso (Q17). Mesa reservada pede confirmação.
- **Lançar (Q15):** "Adicionar itens" na comanda usa o mesmo seletor e a mesma bandeja do Garçom, com "Enviar para a cozinha" ou "Só lançar". Lançar numa mesa com a conta pedida avisa e volta o estado para Ocupada (Q23).
- **Editar item (Q29):** dá para trocar observação e opções enquanto a cozinha não preparou. Depois disso, só tirando (com motivo) e lançando de novo.
- **Cancelar (Q10, Q36):** tirar item já preparado exige motivo. "Cancelar comanda" com itens também exige motivo, e a comanda vai para Pedidos como cancelada, com o motivo.
- **Servir (decorrência de Q12):** quando a cozinha marca pronto uma rodada de mesa, a comanda ganha `servirDesde`. "Marcar servido" na comanda (ou no menu ⋯) limpa o campo. É isso que alimenta o estado Servir e o alerta "pronta e não servida".
- **Movimentações (Q7, Q18):**
  - transferir mesa;
  - juntar (a mesa principal fica com a comanda única, as outras mostram "Com a mesa X", e as comandas que elas tinham migram para a principal, com as rodadas e as pessoas somadas);
  - separar (as secundárias voltam livres, e os itens ficam na principal);
  - transferir itens, com quantidade parcial.
- **Desfazer (Q46):** transferir, juntar, separar, transferir itens e marcar limpa mostram "Desfazer" por 6 s. O desfazer restaura o estado anterior das mesas e comandas envolvidas se nada mais mudou nelas. Se algo mudou, ele recusa com "A mesa mudou depois disso. Desfaça pela comanda.". Operações com dinheiro não têm desfazer: têm motivo, histórico e reabrir.
- **Histórico (Q10):** a linha do tempo da comanda registra abertura, rodadas, itens editados e removidos, cancelamentos, transferências, junções, impressões, pedido de conta, descontos, cortesias, taxa removida, pagamentos e reabertura. Cada evento tem hora e garçom.
- **Limpeza (Q5, Q21):** com a etapa de limpeza ligada, fechar a conta deixa a mesa em Limpeza até alguém "Marcar limpa". Desligada, a mesa fica livre na hora.
- **Bloquear e editar (Q42):** bloquear tem motivo opcional e tira a mesa do Garçom e das sugestões. Editar muda número (continua único), nome, área, lugares e forma. Excluir continua permitido só para mesa livre e sem reserva marcada.

### Conta (Q8, Q9, Q19, Q20, Q45)

- **Modelo:** pagamentos contra um saldo. Cada pagamento guarda forma, valor, troco (no dinheiro), cartão (crédito ou débito) e, se for o caso, os itens que cobre. A mesa fecha sozinha quando o saldo chega a zero.
  - "Dividir igualmente" sugere o valor por pessoa.
  - "Por item" soma os itens marcados, com a parte da taxa deles.
  - "Misto" é simplesmente mais de um pagamento.
- **Total:** itens − cortesias − descontos + taxa de serviço + couvert.
- **Taxa de serviço:** percentual (10% padrão) sobre os **itens já com desconto**, sem couvert e sem cortesias. É calculada uma vez sobre a conta, em centavos, meio para cima. Tirar a taxa exige motivo.
- **Couvert:** valor por pessoa × nº de pessoas. Pode ser tirado com motivo.
- **Congelamento:** a taxa e o couvert entram na comanda com os valores da configuração **no momento da abertura**. Mudar a configuração não altera conta aberta.
- **Desconto:** em R$ ou %, com motivo, e nunca maior que o valor dos itens. **Cortesia** zera um item, com motivo.
- **Divisão:** R$ 100,00 ÷ 3 = 33,33 + 33,33 + 33,34. O centavo que sobra vai para a **última** parte.
- **Reabrir (Q37):** só no mesmo dia, só a última conta fechada da mesa e só com a mesa livre ou em Limpeza. Exige motivo, e os pagamentos voltam a ficar editáveis.
- **Em Pedidos e no Início (Q34):**
  - conta paga em mais de uma forma aparece como "Misto", e o detalhe lista cada pagamento;
  - o faturamento por forma soma cada parte na forma certa;
  - a taxa de serviço aparece separada, porque é do garçom e não da casa.
- **Impressões (Q30):** pré-conta (com taxa, couvert, descontos, valor por pessoa e pagamentos feitos) e comprovante de cada pagamento parcial, em 80 mm. A folha de QR sai em A4. Imprimir a pré-conta marca "Pediu a conta".

### Estoque (Q38)

- Lançamento baixa (como hoje).
- Item tirado antes de a cozinha preparar devolve.
- Item tirado depois de preparado **não devolve** e vira movimento de **perda**, com o motivo.
- Cortesia não devolve (foi consumido).
- Transferir, juntar e separar não mexem no estoque.
- Cancelar a comanda aplica a regra item a item.

### Salão

- **Áreas (Q4):** cada mesa pertence a uma área (Salão, Varanda, Balcão…). A grade e o mapa separam as mesas por área.
- **Capacidade e forma (Q16, Q17):** a mesa tem lugares (1 a 20), forma (quadrada, redonda ou retangular) e posição no mapa da área, numa grade de **24 × 16 células**. Tamanho no mapa: quadrada e redonda 2 × 2, retangular 3 × 2 (4 × 2 com mais de 6 lugares).
- **Mapa (Q3, Q16, Q47):** alternador Grade/Mapa, com a grade como padrão.
  - No modo edição (só tablet e desktop), a mesa é arrastada com `@dnd-kit`, com encaixe na grade e sem sobrepor outra mesa.
  - Também dá para mover pelo teclado: Tab seleciona, as setas movem 1 célula e Shift+setas movem 4.
  - No celular o mapa só é visualizado.
  - Leitores de tela recebem a mesma informação da grade.
- **Configurar salão (Q21):** fica num painel dentro de Mesas, com:
  - áreas (excluir uma área com mesas é recusado);
  - garçons;
  - taxa de serviço (liga/desliga e %, de 0 a 20);
  - couvert (liga/desliga e valor, de R$ 0 a R$ 100);
  - limpeza (liga/desliga);
  - limites dos alertas;
  - antecedência e tolerância das reservas;
  - opções do QR;
  - as três funções Pro.
- **Garçons (Q22):** lista só de nomes, sem login. Aparece ao abrir mesa, no Garçom e no filtro da grade.

### Tela

- **Números no topo (Q13, Q31):**
  - visíveis: ocupação ("12/20 · 60%"), pessoas no salão, faturamento do salão hoje e ticket médio por pessoa;
  - em "ver mais": permanência média, giro de mesas, ticket por mesa e tempo médio de atendimento de chamado.
- **Alertas (Q12):** limites padrão, configuráveis:
  - ocupada sem pedido há **15 min**;
  - pediu a conta há **10 min**;
  - pronta e não servida há **10 min**;
  - aberta há **150 min**.

  A mesa com alerta ganha destaque, e o filtro "Precisam de atenção" junta essas mesas.
- **Busca, filtros e ordem (Q39):**
  - busca por número, nome ou cliente, sem diferenciar acento e maiúscula;
  - filtros por área, estado, garçom e atenção;
  - ordem por número (padrão) ou "mais tempo aberta";
  - tudo fica no endereço da página.
- **Menu ⋯ no cartão (Q41):** mostra as ações do estado atual (toque longo no celular). As ações de fases futuras entram quando a fase delas chegar.
- **Comanda (Q28):** painel lateral mais largo (de baixo no celular), com abas Itens / Conta / Histórico. A mesa aberta fica no endereço (`?mesa=3`).
- **Atalhos (Q40):**
  - número + Enter abre a mesa;
  - `/` vai para a busca, `N` abre uma nova mesa e `M` alterna Grade/Mapa;
  - Esc fecha;
  - `?` mostra a folha de atalhos.

  Os atalhos ficam desligados enquanto o foco está num campo de texto.
- **Ao vivo (Q43):** a grade atualiza a cada 4 s, e um `BroadcastChannel` atualiza na hora as outras abas do mesmo navegador.

### Reservas e lista de espera (Q11, Q24, Q25)

- **Reserva:**
  - tem nome, telefone opcional, horário, pessoas e mesa (opcional, com sugestão pela capacidade);
  - a mesa fica "Reservada HH:MM" a partir de **30 min** antes;
  - passada a tolerância de **15 min**, a reserva vira "não compareceu";
  - "Sentar" abre a mesa com nome e pessoas.
- **Espera:**
  - tem nome, pessoas, telefone opcional e chegada, com o tempo de espera correndo;
  - quando uma mesa libera, ela é sugerida ao primeiro da fila que cabe nela;
  - "Chamar" abre `https://wa.me/55{telefone}` com a mensagem pronta (nada é enviado sozinho);
  - "Sentar" abre a mesa.
- **Sugestão de mesa:** a menor mesa livre que cabe, desempatada pelo número. Mesa bloqueada ou reservada não entra.

### QR (Q14, Q26, Q27, Q35)

- **Na vitrine, em modo mesa:**
  - sem entrega e sem pagamento online;
  - o cliente pede para a mesa, "Chama o garçom", "Pede a conta" e "Vê a conta";
  - mesa bloqueada ou que não existe mostra "Mesa indisponível".
- **Pedido do cliente:** entra como "aguardando aceite" (padrão) ou direto, conforme a configuração. Em mesa livre, o primeiro pedido abre a mesa (configurável).
- **Chamados:** "garçom" ou "conta". Aparecem como selo no cartão, som, contador "Chamados" no topo e botão "Atender", que registra o tempo de resposta. O chamado de conta também marca "Pediu a conta".
- **Simular cliente na mesa:** disponível no modo de demonstração. Abre a vitrine da mesa numa aba nova, porque os dados só existem neste navegador.
- **Folha de QR:** em A4, um QR por mesa com número e nome da loja.

### Fora da tela de Mesas (Q33)

As mudanças nas outras telas ficam no mínimo necessário:

- **Garçom:** seletor e bandeja compartilhados, e a lista de garçons.
- **Cozinha:** o ticket de mesas juntadas mostra "Mesa 3 + 4", e marcar pronto em mesa preenche `servirDesde`.
- **Pedidos e Início:** "Misto", pagamentos, taxa e couvert.
- **Vitrine:** o modo mesa.

### Dados de demonstração e migração (Q44, Q49)

- **Demonstração:**
  - **20 mesas em 3 áreas** nos 4 segmentos: Salão (1 a 10), Varanda (11 a 16) e Balcão (17 a 20), com o mapa montado;
  - 8 ocupadas em estados variados: uma pediu a conta, uma para servir;
  - uma em limpeza e a 20 bloqueada ("Em manutenção");
  - nas fases seguintes entram um par juntado, uma conta com pagamento parcial, 2 reservas para hoje, 3 pessoas na espera e 1 chamado aberto;
  - taxa e couvert por segmento:

    | Segmento   | Taxa de serviço | Couvert         |
    | ---------- | --------------- | --------------- |
    | Pizzaria   | 10%, ligada     | R$ 8,00, ligado |
    | Adega      | 10%, ligada     | desligado       |
    | Açougue    | 10%, ligada     | desligado       |
    | Lanchonete | desligada       | desligado       |

  - limpeza ligada nos 4 segmentos.
- **Migração:** quem tem a base salva não perde nada. Era a versão 2 no plano; depois que o `main` subiu a base para a versão 3 (custos e histórico de status, que exigem gerar a demonstração de novo a partir da 2), a migração das mesas passou a valer para essa versão 3, e o resultado é a versão 4. Todas as mesas vão para a área "Salão", com 4 lugares, forma quadrada e posições em fileiras de 6. Taxa, couvert e limpeza começam desligados. Os garçons saem dos nomes já usados nas comandas.

### Decorrências que assumi (confirmar na revisão)

1. **Servir:** o estado e o alerta "pronta e não servida" exigem o botão "Marcar servido" e o campo `servirDesde`, que a cozinha preenche.
2. **Desfazer por foto:** o desfazer restaura uma foto do estado anterior das mesas e comandas envolvidas, válida por 10 s no servidor.
3. **Taxa e couvert congelados** na abertura da comanda.
4. **Crédito e débito:** são um detalhe do pagamento em cartão (`cartao: "credito" | "debito"`), e não formas novas em `FormaPagamento`. Assim, Pedidos e Início não quebram.
5. **Faturamento do salão hoje:** soma os pagamentos recebidos hoje em comandas de mesa, incluindo os parciais de contas ainda abertas, sem a taxa de serviço.
6. **Preços Pro propostos:** mapa do salão R$ 19,90, reservas e espera R$ 24,90, QR na mesa R$ 39,90.
7. **Grade do mapa:** 24 × 16 células, nos tamanhos de mesa descritos em "Salão".

## Pontos de atenção na revisão

Situações que o desenho implica e que é fácil esquecer. Cada uma tem teste na fase dona dela.

1. **Centavo flutuante:** 10% de R$ 87,45 tem que dar **R$ 8,75** (e não 8,74 por causa de 8,744999…). Teste na Fase 4, em `conta.test.ts`.
2. **Duas abas na mesma mesa:** transferir uma mesa que outra aba acabou de fechar tem que ser recusado com mensagem, sem duplicar comanda. Teste na Fase 5, no servidor.
3. **Virada do dia:** uma comanda aberta às 23:40 e paga às 00:10 entra no faturamento do dia do pagamento, e "reabrir no mesmo dia" usa o `pagoEm` no fuso de São Paulo. Teste na Fase 4.
4. **Base antiga com comanda aberta:** a migração mantém a mesa ocupada com a mesma comanda e o mesmo total. Teste na Fase 1, Tarefa 2.
5. **Mesa sumindo por baixo de algo:** excluir mesa com reserva marcada é recusado, e o QR de mesa bloqueada ou excluída mostra "Mesa indisponível". Testes nas Fases 7 e 8.
6. **Mesas sobrepostas no mapa:** nem a demonstração, nem a migração, nem a mesa nova podem nascer em cima de outra. Testes na Fase 1 (Tarefas 3 e 4) e na Fase 6.

## Fases

Cada fase depende da anterior e sai como um PR revisável.

1. **Fundação de dados:**
   - campos novos da mesa e configuração do salão;
   - coleções de reservas, espera e chamados (ainda vazias);
   - migração da versão 2;
   - salão de demonstração e estado da mesa completo.
2. **Grade nova:**
   - cartão por estado e números no topo;
   - busca e filtros no endereço;
   - alertas e menu ⋯;
   - editar, bloquear e marcar limpa;
   - Configurar salão (áreas, garçons, taxa, couvert, limpeza, alertas);
   - atalhos e atualização a cada 4 s.
3. **Comanda:**
   - abas e `?mesa=`;
   - abrir mesa e adicionar itens (seletor compartilhado com o Garçom);
   - editar item, cancelar item e comanda com motivo, e a perda no estoque;
   - marcar servido e pediu a conta;
   - histórico.
4. **Conta:**
   - pagamentos contra saldo e divisão;
   - taxa, couvert, desconto e cortesia;
   - pré-conta e comprovante;
   - reabrir;
   - reflexo em Pedidos e no Início.
5. **Movimentações:**
   - transferir, juntar e separar;
   - transferir itens;
   - desfazer;
   - ticket da cozinha.
6. **Mapa do salão:** vista, editor com arrasto e teclado, cadeado Pro.
7. **Reservas e lista de espera:** sugestão de mesa, WhatsApp, sentar, cadeado Pro.
8. **QR:**
   - vitrine em modo mesa;
   - aceite e chamados;
   - `BroadcastChannel`;
   - simular cliente e folha de QR;
   - cadeado Pro.

## Fase 1: fundação de dados

**Desenho**

- **`Mesa`** ganha:
  - obrigatórios: `areaId`, `lugares`, `forma` e `posicao: { x, y }`;
  - opcionais: `bloqueio?: { motivo?: string }`, `limpezaDesde?` e `juntadaCom?`.

  O `status` livre/ocupada continua sendo derivado da comanda (`abrirMesas`).
- **`Pedido`** ganha:
  - `mesa.pessoas?`;
  - `contaPedidaEm?`;
  - `servirDesde?`.

  Os campos da conta (pagamentos, ajustes, taxa, couvert, histórico) entram na Fase 3 e na Fase 4, como opcionais, sem migração.
- **`CatalogoLoja`** ganha `salao: ConfigSalao`. **`BaseLoja`** ganha `reservas`, `espera` e `chamados` (vazios até as Fases 7 e 8). É a única mudança que obriga a migrar, por isso vai toda agora.
- **Servidor** na versão 3:
  - lê a versão 2 e migra;
  - a mesa nova nasce na primeira área, com 4 lugares, quadrada e na primeira posição livre;
  - `salao.config()` e `salao.salvar()` validados.
- **Tela:** nada novo além do que o estado completo já mostra no cartão atual ("Bloqueada", "Pediu a conta", "Servir", "Limpeza"). A grade passa a ter 20 mesas na demonstração.

**Interfaces que a Fase 1 entrega** (as fases seguintes usam estes nomes)

```ts
// lib/admin/dados/tipos.ts
export type FormaMesa = "quadrada" | "redonda" | "retangular"
export type PosicaoMesa = { x: number; y: number } // células da grade 24 × 16 da área
export type Mesa = {
  id: string; numero: number; nome: string
  status: "livre" | "ocupada"
  pedidoAtivoId?: number; clienteNome?: string; ocupadaEm?: string
  areaId: string; lugares: number; forma: FormaMesa; posicao: PosicaoMesa
  bloqueio?: { motivo?: string }
  limpezaDesde?: string
  /** Mesa juntada: id da principal, que guarda a comanda. */
  juntadaCom?: string
}
export type AreaSalao = { id: string; nome: string; ordem: number }
export type Garcom = { id: string; nome: string; ativo: boolean }
export type ConfigSalao = {
  areas: AreaSalao[]
  garcons: Garcom[]
  taxaServico: { ativa: boolean; percentual: number }
  couvert: { ativo: boolean; porPessoa: number }
  limpeza: boolean
  alertas: { semPedidoMin: number; contaPedidaMin: number; servirMin: number; abertaMin: number }
  reservas: { antecedenciaMin: number; toleranciaMin: number }
  qr: { aceite: "garcom" | "direto"; abrirMesaPeloQr: boolean }
  funcoes: { mapa: boolean; reservas: boolean; qr: boolean }
}
export type Reserva = {
  id: string; nome: string; telefone?: string; inicio: string; pessoas: number
  mesaId?: string; status: "marcada" | "sentou" | "nao-compareceu" | "cancelada"
}
export type EntradaEspera = {
  id: string; nome: string; pessoas: number; telefone?: string; chegouEm: string
  chamadaEm?: string; status: "esperando" | "sentou" | "desistiu"
}
export type Chamado = {
  id: string; mesaId: string; tipo: "garcom" | "conta"; criadoEm: string; atendidoEm?: string
}
// Pedido.mesa: { id; numero; garcom?; pessoas? }; Pedido.contaPedidaEm?; Pedido.servirDesde?
// CatalogoLoja: + salao: ConfigSalao
// BaseLoja: + reservas: Reserva[]; espera: EntradaEspera[]; chamados: Chamado[]

// lib/admin/dados/migracao.ts
export type BaseLojaV2 = Omit<BaseLoja, "salao" | "reservas" | "espera" | "chamados" | "mesas"> & {
  mesas: Pick<Mesa, "id" | "numero" | "nome" | "status" | "pedidoAtivoId" | "clienteNome" | "ocupadaEm">[]
}
export function migrarDaVersao2(base: BaseLojaV2): BaseLoja

// lib/admin/dados/salao-demo.ts
export function salaoDemo(segmento: SegmentoPainelId): { mesas: Mesa[]; salao: ConfigSalao }

// lib/admin/regras/salao.ts
export const GRADE_MAPA = { colunas: 24, linhas: 16 } as const
export function tamanhoDaMesa(mesa: Pick<Mesa, "forma" | "lugares">): { largura: number; altura: number }
export function primeiraPosicaoLivre(mesas: Mesa[], areaId: string, nova: Pick<Mesa, "forma" | "lugares">): PosicaoMesa | null

// lib/admin/regras/mesas.ts
export type EstadoMesa =
  | "livre" | "reservada" | "bloqueada" | "limpeza" | "juntada"
  | "ocupada" | "na-cozinha" | "servir" | "conta-pedida"
export function estadoDaMesa(
  mesa: Pick<Mesa, "status" | "bloqueio" | "limpezaDesde" | "juntadaCom">,
  comanda: Pick<Pedido, "status" | "contaPedidaEm" | "servirDesde"> | undefined,
  contexto?: { principal?: { numero: number }; reserva?: { inicio: string }; agora?: Date; antecedenciaMin?: number },
): { estado: EstadoMesa; rotulo: string; tom: TomStatus }

// lib/admin/regras/esquema-salao.ts
export const esquemaSalao: z.ZodType<ConfigSalao>

// servidor: api.salao.config(): Promise<ConfigSalao>; api.salao.salvar(config): Promise<ConfigSalao>
// lib/admin/dados/consultas-mesas.ts: useConfigSalao(), useSalvarConfigSalao()
```

**Arquivos**

- Criar:
  - `lib/admin/dados/migracao.ts` e `migracao.test.ts`;
  - `lib/admin/dados/salao-demo.ts` e `salao-demo.test.ts`;
  - `lib/admin/regras/salao.ts` e `salao.test.ts`;
  - `lib/admin/regras/esquema-salao.ts` e `esquema-salao.test.ts`.
- Mudar:
  - `lib/admin/dados/tipos.ts`;
  - `lib/admin/dados/servidor.ts` (`VERSAO`, `carregar`, `mesas.criar`, `salao`) e `servidor.test.ts`;
  - `lib/admin/dados/gerar-pedidos.ts` (`AO_VIVO`, pessoas, conta pedida, servir) e `gerar-pedidos.test.ts`;
  - `lib/admin/regras/mesas.ts` e `mesas.test.ts`;
  - `lib/admin/dados/consultas-mesas.ts` e `consultas-mesas.test.tsx`;
  - `components/admin/mesas/pagina-mesas.test.tsx`.
- Fora do ciclo de TDD:
  - `lib/mock/admin/{adega,acougue,pizzaria,lanchonete}.ts`, que passam a usar `salaoDemo()`;
  - `lib/mock/admin/{salao,farmacia}.ts`, que recebem `salao` vazio para fechar o tipo.

### Task 1 (Tarefa 1): migração pura da versão 2

**Consome:** os tipos acima. **Entrega:** `migrarDaVersao2`.

- [ ] **Passo 1: escrever os testes que falham** em `lib/admin/dados/migracao.test.ts`. Monte uma `BaseLojaV2` com 7 mesas (a mesa 2 ocupada pelo pedido 7) e pedidos de mesa com os garçons "Paula", "Bia" e "Paula", usando os construtores de `lib/admin/dados/catalogo-de-teste.ts` e `lib/admin/regras/pedidos-de-teste.ts`.

```ts
test("toda mesa vai para a área Salão, com 4 lugares e forma quadrada", () => {
  const { mesas, salao } = migrarDaVersao2(baseV2)
  expect(salao.areas).toEqual([{ id: "area-salao", nome: "Salão", ordem: 1 }])
  for (const mesa of mesas)
    expect(mesa).toMatchObject({ areaId: "area-salao", lugares: 4, forma: "quadrada" })
})
test("posições em fileiras de 6, a cada 4 células", () => {
  expect(migrarDaVersao2(baseV2).mesas.map((mesa) => mesa.posicao)).toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 8, y: 0 },
    { x: 12, y: 0 },
    { x: 16, y: 0 },
    { x: 20, y: 0 },
    { x: 0, y: 4 },
  ])
})
test("taxa, couvert e limpeza começam desligados", () => {
  const { salao } = migrarDaVersao2(baseV2)
  expect(salao.taxaServico).toEqual({ ativa: false, percentual: 10 })
  expect(salao.couvert).toEqual({ ativo: false, porPessoa: 0 })
  expect(salao.limpeza).toBe(false)
  expect(salao.funcoes).toEqual({ mapa: false, reservas: false, qr: false })
})
test("os garçons saem das comandas, sem repetir, em ordem alfabética", () => {
  expect(migrarDaVersao2(baseV2).salao.garcons.map((garcom) => garcom.nome)).toEqual([
    "Bia",
    "Paula",
  ])
})
test("a mesa ocupada continua com a mesma comanda", () => {
  expect(migrarDaVersao2(baseV2).mesas[1]).toMatchObject({ status: "ocupada", pedidoAtivoId: 7 })
})
test("pedidos, produtos e estoque não mudam; reservas, espera e chamados começam vazios", () => {
  const migrada = migrarDaVersao2(baseV2)
  expect(migrada.pedidos).toEqual(baseV2.pedidos)
  expect(migrada.produtos).toEqual(baseV2.produtos)
  expect(migrada.movimentosEstoque).toEqual(baseV2.movimentosEstoque)
  expect([migrada.reservas, migrada.espera, migrada.chamados]).toEqual([[], [], []])
})
```

Os demais valores padrão de `ConfigSalao` são `alertas: { semPedidoMin: 15, contaPedidaMin: 10, servirMin: 10, abertaMin: 150 }`, `reservas: { antecedenciaMin: 30, toleranciaMin: 15 }` e `qr: { aceite: "garcom", abrirMesaPeloQr: true }`. Ponha esses literais num teste também.

- [ ] **Passo 2:** `pnpm vitest run lib/admin/dados/migracao.test.ts`. Deve falhar, porque `migracao.ts` não existe.
- [ ] **Passo 3:** mudar os tipos em `tipos.ts` e implementar `migrarDaVersao2` em `lib/admin/dados/migracao.ts`. Exporte também `CONFIG_SALAO_PADRAO`, sem áreas e sem garçons, para a demonstração e as fases seguintes reaproveitarem. Ids dos garçons: `garcom-{nome normalizado}`.
- [ ] **Passo 4:** rodar de novo. Deve passar.
- [ ] **Passo 5:** `git commit -m "feat(mesas): migração da base para áreas, lugares e configuração do salão"`.

### Task 2 (Tarefa 2): o servidor lê a versão 2 sem perder nada

**Consome:** `migrarDaVersao2`. **Entrega:** `VERSAO = 3`. Lê a 2 migrando, e qualquer outra versão continua gerando do zero.

- [ ] **Passo 1: escrever o teste que falha** em `servidor.test.ts`, num `describe("migração")`:

```ts
test("base da versão 2 é migrada: mesmos pedidos, mesa ocupada com a mesma comanda", async () => {
  const antiga = await baseDaVersao2() // gera com o servidor e tira os campos novos
  await set("clickpedido-admin-dados:pizzaria", {
    versao: 2,
    geradoEm: AGORA.toISOString(),
    base: antiga,
  })
  const api = servidor()
  const mesas = await api.mesas.listar()
  expect(mesas.every((mesa) => mesa.areaId === "area-salao")).toBe(true)
  const ocupada = mesas.find((mesa) => mesa.status === "ocupada")
  expect(ocupada?.pedidoAtivoId).toBe(
    antiga.mesas.find((mesa) => mesa.status === "ocupada")?.pedidoAtivoId,
  )
  expect((await get("clickpedido-admin-dados:pizzaria")).base.pedidos).toHaveLength(
    antiga.pedidos.length,
  )
  expect((await get("clickpedido-admin-dados:pizzaria")).versao).toBe(3)
})
```

`baseDaVersao2()` é um helper do próprio teste: ele lê a base gerada pelo servidor e remove `salao`, `reservas`, `espera`, `chamados` e os campos novos das mesas. Use o segmento do helper `servidor()` do arquivo.

- [ ] **Passo 2:** `pnpm vitest run lib/admin/dados/servidor.test.ts -t "migração"`. Deve falhar, porque a base é gerada do zero e os pedidos mudam.
- [ ] **Passo 3:** mudar `VERSAO` para 3 e, em `carregar()`, fazer `versao === 2 ? completar({ ...guardado, base: migrarDaVersao2(guardado.base) }) : …`.
- [ ] **Passo 4:** rodar o arquivo inteiro. Deve passar.
- [ ] **Passo 5:** commit `feat(mesas): servidor migra a base salva da versão 2`.

### Task 3 (Tarefa 3): salão de demonstração

**Consome:** os tipos e `tamanhoDaMesa` (criado aqui em `lib/admin/regras/salao.ts`). **Entrega:** `salaoDemo(segmento)`, usado pelos 4 mocks.

- [ ] **Passo 1: escrever os testes que falham.**

Em `lib/admin/regras/salao.test.ts`:

```ts
test("tamanho no mapa: quadrada e redonda 2 × 2, retangular 3 × 2, retangular grande 4 × 2", () => {
  expect(tamanhoDaMesa({ forma: "quadrada", lugares: 4 })).toEqual({ largura: 2, altura: 2 })
  expect(tamanhoDaMesa({ forma: "redonda", lugares: 2 })).toEqual({ largura: 2, altura: 2 })
  expect(tamanhoDaMesa({ forma: "retangular", lugares: 6 })).toEqual({ largura: 3, altura: 2 })
  expect(tamanhoDaMesa({ forma: "retangular", lugares: 8 })).toEqual({ largura: 4, altura: 2 })
})
```

Em `lib/admin/dados/salao-demo.test.ts`:

```ts
test("20 mesas: Salão 1 a 10, Varanda 11 a 16, Balcão 17 a 20", () => {
  const { mesas, salao } = salaoDemo("pizzaria")
  expect(salao.areas.map((area) => area.nome)).toEqual(["Salão", "Varanda", "Balcão"])
  const area = (numero: number) =>
    salao.areas.find((a) => a.id === mesas.find((m) => m.numero === numero)?.areaId)?.nome
  expect([1, 10, 11, 16, 17, 20].map(area)).toEqual([
    "Salão",
    "Salão",
    "Varanda",
    "Varanda",
    "Balcão",
    "Balcão",
  ])
})
test("lugares e formas", () => {
  const por = (numero: number) => salaoDemo("adega").mesas.find((m) => m.numero === numero)
  expect(por(1)).toMatchObject({ forma: "quadrada", lugares: 4 })
  expect(por(9)).toMatchObject({ forma: "retangular", lugares: 8 })
  expect(por(11)).toMatchObject({ forma: "redonda", lugares: 2 })
  expect(por(15)).toMatchObject({ forma: "retangular", lugares: 6 })
  expect(por(17)).toMatchObject({ forma: "redonda", lugares: 2 })
})
test("a mesa 20 está bloqueada para manutenção", () => {
  expect(salaoDemo("lanchonete").mesas.find((m) => m.numero === 20)?.bloqueio).toEqual({
    motivo: "Em manutenção",
  })
})
test.each(["adega", "acougue", "pizzaria", "lanchonete"] as const)(
  "%s: nenhuma mesa se sobrepõe nem sai do mapa",
  (segmento) => {
    // retângulos de tamanhoDaMesa na mesma área não se cruzam; x + largura ≤ 24 e y + altura ≤ 16
  },
)
test("taxa e couvert por segmento; limpeza ligada em todos", () => {
  expect(salaoDemo("pizzaria").salao).toMatchObject({
    taxaServico: { ativa: true, percentual: 10 },
    couvert: { ativo: true, porPessoa: 8 },
    limpeza: true,
  })
  expect(salaoDemo("adega").salao).toMatchObject({
    taxaServico: { ativa: true, percentual: 10 },
    couvert: { ativo: false },
    limpeza: true,
  })
  expect(salaoDemo("acougue").salao).toMatchObject({
    taxaServico: { ativa: true },
    couvert: { ativo: false },
  })
  expect(salaoDemo("lanchonete").salao).toMatchObject({
    taxaServico: { ativa: false },
    couvert: { ativo: false },
  })
})
test("garçons da demonstração", () => {
  expect(salaoDemo("pizzaria").salao.garcons.map((g) => g.nome)).toEqual([
    "Lucas",
    "Paula",
    "Rafa",
    "Bia",
  ])
})
test("as três funções Pro vêm ligadas para a demonstração mostrar tudo", () => {
  expect(salaoDemo("pizzaria").salao.funcoes).toEqual({ mapa: true, reservas: true, qr: true })
})
```

- [ ] **Passo 2:** rodar os dois arquivos. Devem falhar.
- [ ] **Passo 3:** implementar `tamanhoDaMesa` e `salaoDemo`. Os ids das mesas continuam `mesa-{numero}`, para os pedidos já gerados baterem. Os 4 mocks trocam o `Array.from({ length: 8 }…)` por `...salaoDemo("<segmento>")`. Salão e farmácia recebem `salao: { ...CONFIG_SALAO_PADRAO, areas: [], garcons: [] }`.
- [ ] **Passo 4:** `pnpm vitest run`. Testes que contavam 8 mesas mudam de propósito: confira cada um e atualize o literal (é mudança de comportamento pedida, não ajuste para passar).
- [ ] **Passo 5:** commit `feat(mesas): salão de demonstração com 20 mesas em 3 áreas`.

### Task 4 (Tarefa 4): mesa nova com área, lugares, forma e posição

**Consome:** `tamanhoDaMesa`. **Entrega:** `primeiraPosicaoLivre`. `mesas.criar` passa a aceitar `{ numero, nome?, areaId?, lugares?, forma? }`.

- [ ] **Passo 1: escrever os testes que falham.**

Em `salao.test.ts`:

```ts
test("primeira posição livre: varre linha a linha, da esquerda para a direita, sem sobrepor", () => {
  const ocupada = { areaId: "a", forma: "quadrada", lugares: 4, posicao: { x: 0, y: 0 } } as Mesa
  expect(primeiraPosicaoLivre([ocupada], "a", { forma: "quadrada", lugares: 4 })).toEqual({
    x: 2,
    y: 0,
  })
  expect(primeiraPosicaoLivre([ocupada], "b", { forma: "quadrada", lugares: 4 })).toEqual({
    x: 0,
    y: 0,
  })
})
test("área cheia não tem posição", () => {
  // 96 mesas 2 × 2 enchem 24 × 16
  expect(primeiraPosicaoLivre(cheia, "a", { forma: "quadrada", lugares: 4 })).toBeNull()
})
```

Em `servidor.test.ts`, no `describe("mesas")`:

```ts
test("mesa nova entra na primeira área, com 4 lugares, quadrada e na primeira posição livre", async () => {
  const api = servidor()
  const mesa = await api.mesas.criar({ numero: 30 })
  const salao = await api.salao.config() // da Tarefa 7
  expect(mesa).toMatchObject({ areaId: salao.areas[0].id, lugares: 4, forma: "quadrada" })
  const outras = (await api.mesas.listar()).filter(
    (m) => m.id !== mesa.id && m.areaId === mesa.areaId,
  )
  // não se sobrepõe a nenhuma outra
})
test("lugares fora de 1 a 20 e área que não existe são recusados", async () => {
  await expect(servidor().mesas.criar({ numero: 31, lugares: 0 })).rejects.toThrow(
    "Informe de 1 a 20 lugares.",
  )
  await expect(servidor().mesas.criar({ numero: 31, areaId: "nada" })).rejects.toThrow(
    "Escolha uma área do salão.",
  )
})
test("área sem espaço no mapa recusa a mesa nova", async () => {
  // .rejects.toThrow("Não cabe mais mesa nessa área do mapa.")
})
```

Se a Tarefa 7 ainda não estiver feita, leia a área por `salaoDemo(segmento).salao.areas[0]` e troque pela leitura do servidor quando ela existir.

- [ ] **Passo 2:** rodar. Deve falhar.
- [ ] **Passo 3:** implementar `primeiraPosicaoLivre` (varrer `y` de 0 a 15 e `x` de 0 a 23 e devolver a primeira posição em que o retângulo cabe sem cruzar outro da mesma área) e mudar `mesas.criar`.
- [ ] **Passo 4:** rodar. Deve passar.
- [ ] **Passo 5:** commit `feat(mesas): mesa nova nasce na área, com lugares, forma e posição livre`.

### Task 5 (Tarefa 5): demonstração ao vivo com o salão cheio

**Consome:** `salaoDemo`. **Entrega:** a demonstração abre com 8 mesas ocupadas, todas com `mesa.pessoas`. A comanda mais antiga já pediu a conta, uma está para servir e uma mesa livre está em limpeza.

- [ ] **Passo 1: escrever os testes que falham** em `gerar-pedidos.test.ts` e `servidor.test.ts`:

```ts
test("a demonstração abre com 8 mesas ocupadas, cada uma com pessoas entre 1 e os lugares", async () => {
  const mesas = await servidor().mesas.listar()
  const ocupadas = mesas.filter((m) => m.status === "ocupada")
  expect(ocupadas).toHaveLength(8)
  // para cada comanda: 1 ≤ pedido.mesa.pessoas ≤ mesa.lugares
})
test("a comanda aberta há mais tempo já pediu a conta, 5 min atrás", async () => {
  // contaPedidaEm === new Date(AGORA.getTime() - 5 * 60_000).toISOString()
})
test("uma comanda está pronta para servir há 4 min", async () => {
  // exatamente uma com servirDesde === AGORA − 4 min
})
test("a mesa 9 está em limpeza há 3 min; a 20 continua bloqueada e nunca recebe comanda", async () => {
  // limpezaDesde === AGORA − 3 min; nenhum pedido em andamento na mesa-20
})
```

- [ ] **Passo 2:** rodar. Deve falhar.
- [ ] **Passo 3:** colocar mais 5 entradas de mesa em `AO_VIVO` (idades 95, 70, 48, 33 e 12 min). O gerador passa a pular mesa bloqueada, sortear `pessoas` entre 1 e os lugares e preencher `contaPedidaEm` e `servirDesde` como nos testes. A limpeza da mesa 9 é aplicada em `doZero()`, depois de `abrirMesas`.
- [ ] **Passo 4:** `pnpm vitest run`. As contagens que mudarem por causa das 5 comandas novas (Fila, Cozinha, Início) são revisadas uma a uma e atualizadas com o literal novo.
- [ ] **Passo 5:** commit `feat(mesas): demonstração abre com o salão cheio`.

### Task 6 (Tarefa 6): estado completo da mesa

**Consome:** os campos novos. **Entrega:** `estadoDaMesa` com os 9 estados e a precedência da tabela de "Estados da mesa".

- [ ] **Passo 1: escrever os testes que falham** em `lib/admin/regras/mesas.test.ts`. Os testes que já existem continuam, e passam a comparar também `estado`.

```ts
const agora = new Date("2026-11-19T19:40:00-03:00")
test("bloqueada vence tudo, até comanda aberta", () => {
  expect(estadoDaMesa({ status: "ocupada", bloqueio: {} }, { status: "recebido" })).toEqual({
    estado: "bloqueada",
    rotulo: "Bloqueada",
    tom: "cancelado",
  })
})
test("juntada mostra a principal", () => {
  expect(
    estadoDaMesa({ status: "ocupada", juntadaCom: "mesa-4" }, undefined, {
      principal: { numero: 4 },
    }).rotulo,
  ).toBe("Com a mesa 4")
})
test("pediu a conta vence servir e cozinha", () => {
  expect(
    estadoDaMesa(
      { status: "ocupada" },
      { status: "recebido", contaPedidaEm: "x", servirDesde: "y" },
    ),
  ).toMatchObject({ estado: "conta-pedida", rotulo: "Pediu a conta", tom: "novo" })
})
test("rodada pronta para servir", () => {
  expect(estadoDaMesa({ status: "ocupada" }, { status: "pronto", servirDesde: "y" })).toMatchObject(
    { estado: "servir", rotulo: "Servir", tom: "pronto" },
  )
})
test("livre em limpeza", () => {
  expect(estadoDaMesa({ status: "livre", limpezaDesde: "x" }, undefined)).toMatchObject({
    estado: "limpeza",
    rotulo: "Limpeza",
    tom: "espera",
  })
})
test("reservada só a partir da antecedência", () => {
  const reserva = { inicio: "2026-11-19T20:00:00-03:00" }
  expect(
    estadoDaMesa({ status: "livre" }, undefined, { reserva, agora, antecedenciaMin: 30 }),
  ).toMatchObject({ estado: "reservada", rotulo: "Reservada 20:00", tom: "espera" })
  expect(
    estadoDaMesa({ status: "livre" }, undefined, { reserva, agora, antecedenciaMin: 15 }).estado,
  ).toBe("livre")
})
test("limpeza vence reserva: a mesa precisa ser limpa antes", () => {
  // livre + limpezaDesde + reserva dentro da antecedência → "limpeza"
})
```

- [ ] **Passo 2:** rodar. Deve falhar.
- [ ] **Passo 3:** implementar na ordem da tabela. A hora da reserva sai com `format(…, "HH:mm")`, no fuso fixo do setup.
- [ ] **Passo 4:** em `pagina-mesas.test.tsx`, um teste de tela: com a demonstração carregada, o cartão da mesa 20 tem a descrição "Bloqueada", e o da comanda mais antiga, "Pediu a conta". Deve passar sem mudar o componente, que já mostra `estado.rotulo`. Se não passar, corrija o componente.
- [ ] **Passo 5:** commit `feat(mesas): estado da mesa com bloqueio, limpeza, reserva, servir e conta pedida`.

### Task 7 (Tarefa 7): configuração do salão no servidor

**Consome:** `ConfigSalao`. **Entrega:** `esquemaSalao`, `api.salao.config()`, `api.salao.salvar()`, `useConfigSalao()` e `useSalvarConfigSalao()`.

- [ ] **Passo 1: escrever os testes que falham.**

Em `esquema-salao.test.ts`:

```ts
test.each([
  [{ taxaServico: { ativa: true, percentual: 21 } }, "A taxa de serviço vai de 0% a 20%."],
  [{ couvert: { ativo: true, porPessoa: 100.01 } }, "O couvert vai até R$ 100,00 por pessoa."],
  [{ areas: [] }, "O salão precisa de pelo menos uma área."],
  [
    {
      areas: [
        { id: "a", nome: "Varanda", ordem: 1 },
        { id: "b", nome: " varanda ", ordem: 2 },
      ],
    },
    "Já existe a área Varanda.",
  ],
  [{ garcons: [{ id: "g", nome: "", ativo: true }] }, "Informe o nome do garçom."],
  [{ alertas: { ...padrao.alertas, semPedidoMin: 0 } }, "Os alertas vão de 1 a 600 minutos."],
])("recusa %o com a mensagem certa", (mudanca, mensagem) => {
  /* safeParse → primeira mensagem */
})
test("nomes de área e garçom são aparados e limitados a 30 e 40 caracteres", () => {
  /* … */
})
```

Em `servidor.test.ts`:

```ts
test("salvar a configuração guarda e devolve; a próxima leitura vê a mudança", async () => {
  /* … */
})
test("excluir uma área com mesas é recusado", async () => {
  // tirar "Varanda" de areas → rejects.toThrow("Mova as mesas da Varanda antes de excluir a área.")
})
```

Em `consultas-mesas.test.tsx`: `useSalvarConfigSalao` invalida `useConfigSalao` e `useMesas`, no padrão dos testes que já existem no arquivo.

- [ ] **Passo 2:** rodar. Deve falhar.
- [ ] **Passo 3:** implementar o esquema (zod, mensagens acima), `salao.config` e `salao.salvar` no servidor (validar, conferir áreas com mesas, `substituir`) e os dois hooks.
- [ ] **Passo 4:** rodar. Deve passar.
- [ ] **Passo 5:** commit `feat(mesas): configuração do salão no servidor`.

### Task 8 (Tarefa 8): fechamento da fase

- [ ] **Passo 1:** `pnpm check`. Mostrar a saída: Biome, tsc e Vitest verdes.
- [ ] **Passo 2:** `pnpm test:coverage`. Se a cobertura subiu, subir os mínimos em `vitest.config.mts`.
- [ ] **Passo 3:** `pnpm test:e2e:rapido`. O screenshot `painel-mesas-*` vai mudar (20 mesas e os rótulos novos). Revise a diferença antes de atualizar com `--update-snapshots`, só nesse teste.
- [ ] **Passo 4:** registrar no fim desta seção a "Situação" (data, o que os testes pegaram, total de testes, mínimos de cobertura), como em `plano-painel-admin.md`.
- [ ] **Passo 5:** abrir o PR da Fase 1 para `main`.

Situação: pronta em 19/11/2026, aguardando o PR.

- **O que as revisões pegaram:**
  - a demonstração só abria com o salão do roteiro em parte dos dias. Um pedido de mesa sorteado entre 90 e 120 min antes ficava aberto. Agora só as comandas do roteiro ficam abertas hoje;
  - na migração, "Bia", "bia" e "Bía" viravam garçons com o mesmo id, o que travaria o salvamento do salão. Agora a deduplicação usa o nome normalizado;
  - na migração, com mais de 24 mesas, as mesas nasciam fora do mapa. Agora vão para a primeira posição livre, e com mais de 96 para a área "Salão 2";
  - a mesa retangular grande valia só a partir de 8 lugares (a decisão é mais de 6);
  - estados da comanda apareciam em mesa livre, e o resumo "com rodada na cozinha" deixava de contar a mesa que pediu a conta;
  - a mesa bloqueada ainda recebia comanda pelo Garçom. Agora `lancar` recusa e o Garçom não a lista;
  - ids repetidos de área e de garçom passavam no esquema do salão;
  - o E2E de estoque navegava antes de o IndexedDB gravar o cancelamento.
- **Mudou fora do plano:** a mensagem de área com mesas virou "Mova as mesas da área {nome} antes de excluí-la." (por causa do gênero). A forma inválida usa "Escolha a forma da mesa.". O garçom das comandas geradas sai da lista do salão.
- **Screenshots:** mudaram em 8 telas do painel (visão geral, pedidos, fila, cozinha, mesas, comanda, motoboys, pesagem), por conteúdo da demonstração. As diferenças foram revisadas e o layout é o mesmo.
- **Testes e cobertura:** 1105 testes no Vitest e 406 no E2E rápido (28 pulados). Os mínimos de cobertura subiram para 81/72/79/82 no geral e 97/94/98/98 em `lib/**`.
- **Para a Fase 2:**
  - cartão estreito (320 px) quebra "Pediu a conta" em duas linhas;
  - limpeza de outro dia continua na mesa até haver "Marcar limpa";
  - regex `\b` dentro de template literal em `pagina-garcom.test.tsx`;
  - teste da migração de 3 dias sem `ocupadas.length > 0`;
  - limites de centavos no esquema do salão (antes da Fase 4);
  - o teste de "pediu a conta depois de nova rodada" vai inverter na Fase 3 (Q23).

## Fase 2: grade nova

**Desenho:**

- grade agrupada por área, com o cartão desenhado para cada estado;
- faixa dos 4 números com "ver mais";
- busca e filtros no endereço, e o filtro "Precisam de atenção";
- menu ⋯ com: abrir comanda, editar, bloquear e desbloquear, marcar limpa e excluir;
- painel "Configurar salão" (áreas, garçons, taxa, couvert, limpeza, alertas);
- atalhos com a folha `?` (o `M` entra na Fase 6, junto com o mapa);
- atualização a cada 4 s.

Antes de mudar o visual, conferir que `painel-mesas-*` está atualizado com a Fase 1 (conferido em 20/11/2026: 438 screenshots iguais).

**Branch:** `claude/admin-mesas-fase-2`, criada sobre a Fase 1 enquanto o PR dela não é mesclado. O PR da Fase 2 vai para `main` depois da Fase 1.

**Decisões de detalhe desta fase** (decorrem de Q12, Q13, Q39, Q40, Q41 e Q42)

- **Ocupação:** conta as mesas ocupadas e as juntadas sobre as não bloqueadas, com o percentual arredondado ("12/20 · 60%").
- **Pessoas:** a comanda sem `mesa.pessoas` (lançada pelo Garçom antes da Fase 3) conta 1.
- **Faturamento do salão hoje:** até a Fase 4, é o `total` das comandas de mesa pagas hoje (`pagoEm` no dia de hoje). Na Fase 4 passa a ser a soma dos pagamentos, sem a taxa (decorrência 5).
- **Ticket por pessoa:** faturamento ÷ pessoas das comandas pagas hoje. **Ticket por mesa:** faturamento ÷ comandas pagas hoje.
- **Permanência média:** média de `pagoEm − criadoEm` das pagas hoje, em minutos. **Giro:** comandas pagas hoje ÷ mesas não bloqueadas, com 1 casa ("1,5").
- **Tempo médio de chamado:** entra na Fase 8, com os chamados.
- **Alertas:** valem só para a mesa ocupada (nem bloqueada, nem juntada) e disparam **no minuto exato** do limite.
  - "Sem pedido" é a comanda aberta sem nenhum item. Só acontece a partir da Fase 3, com "Abrir mesa".
  - A ordem é da mais urgente: conta pedida, servir, sem pedido, aberta.
  - A demonstração passa a ter a conta pedida há 12 min, para existir um alerta.
- **Busca:** com dígitos, acha a mesa cujo número começa pelo termo ("12" acha 12 e 120). Com texto, procura no nome da mesa e no cliente. Nos dois casos ignora acento e maiúscula (`normalizar` de `filtro-pedidos.ts`).
- **Filtro de estado:** "Ocupada" junta todas as mesas ocupadas (na cozinha, servir e conta pedida também). Os outros estados casam exatamente.
- **Filtro de garçom:** usa os garçons ativos de `salao.garcons` e compara pelo nome normalizado do garçom da comanda.
- **Ordem "mais tempo aberta":** do `ocupadaEm` mais antigo para o mais novo, com as não ocupadas no fim, pelo número.
- **Endereço:** os parâmetros são `busca`, `area`, `estado`, `garcom`, `atencao=sim` e `ordem=tempo`. O padrão não aparece na URL.
- **Editar mesa:**
  - número único;
  - mesa ocupada não troca de número: "Feche a conta antes de mudar o número da mesa.";
  - se mudar de área, ou se o tamanho novo sobrepuser outra mesa, vai para a primeira posição livre da área;
  - nome vazio volta ao padrão "Mesa 07".
- **Bloquear:** recusa mesa ocupada com "Feche a conta antes de bloquear a mesa.". O motivo é aparado e cortado em 80 caracteres.
- **Limpeza:** fechar a conta com `salao.limpeza` ligada deixa `limpezaDesde = pagoEm` na mesa. "Liberar" (comanda vazia) não passa pela limpeza. A limpeza de outro dia continua até alguém "Marcar limpa", como já é hoje.
- **Esquema do salão:** o couvert passa a aceitar só centavos inteiros ("Informe o couvert em reais e centavos."). A taxa aceita até 2 casas.
- **Menu ⋯:** o botão fica sempre visível, ao lado do cartão (não dentro dele), e por isso serve também no celular. Não há toque longo. Os itens por estado são:

  | Estado                             | Itens                                       |
  | ---------------------------------- | ------------------------------------------- |
  | livre, reservada                   | Abrir comanda, Editar, Bloquear, Excluir    |
  | limpeza                            | Marcar limpa, Editar, Bloquear, Excluir     |
  | ocupada, na cozinha, servir, conta | Abrir comanda, Editar                       |
  | bloqueada                          | Desbloquear, Editar, Excluir                |
  | juntada                            | Abrir comanda (abre a principal, na Fase 5) |

- **Atalhos:** a lógica é pura (`lerTecla`). Os dígitos acumulam até 3 e aparecem num aviso discreto ("Mesa 12 ↵"), que some depois de 2 s sem tecla.
  - Enter abre a mesa. Número que não existe avisa "Não existe a mesa 12.".
  - `/` vai para a busca, `N` abre Nova mesa e `?` abre a folha de atalhos.
  - Nada dispara com o foco num campo, com Ctrl/Alt/Meta apertado ou com uma janela aberta.
- **Atualização:** a grade de mesas busca a cada 4 s. A fila continua a cada 5 s, como no resto do painel.

**Interfaces que a Fase 2 entrega**

```ts
// lib/admin/regras/alertas-mesa.ts
export type TipoAlertaMesa = "conta-pedida" | "servir" | "sem-pedido" | "aberta"
export type AlertaMesa = { tipo: TipoAlertaMesa; texto: string } // "Pediu a conta há 12 min"
/** "25 min" ou "2 h 05" (sai do cartão da página). */
export function tempoDesde(inicio: string, agora: Date): string
export function alertasDaMesa(
  mesa: Pick<Mesa, "status" | "ocupadaEm" | "bloqueio" | "juntadaCom">,
  comanda: Pick<Pedido, "itens" | "contaPedidaEm" | "servirDesde"> | undefined,
  limites: ConfigSalao["alertas"],
  agora: Date,
): AlertaMesa[]

// lib/admin/regras/indicadores-salao.ts
export type IndicadoresSalao = {
  ocupacao: { ocupadas: number; total: number; percentual: number; texto: string }
  pessoas: number
  faturamento: number
  ticketPorPessoa: number | null
  ticketPorMesa: number | null
  permanenciaMin: number | null
  giro: number | null
}
export function indicadoresSalao(entrada: {
  mesas: Mesa[]
  abertas: Pedido[] // comandas de mesa em aberto (a fila)
  concluidos: Pedido[] // pedidos concluídos; a função pega os de mesa pagos no dia de `agora`
  agora: Date
}): IndicadoresSalao

// lib/admin/regras/filtro-mesas.ts
export type FiltroEstadoMesa = EstadoMesa // "ocupada" junta as ocupadas
export type FiltrosMesas = {
  busca: string
  area: string | null
  estado: FiltroEstadoMesa | null
  garcom: string | null
  atencao: boolean
}
export type OrdemMesas = "numero" | "tempo"
export type MesaNaGrade = {
  mesa: Mesa
  comanda?: Pedido
  estado: ReturnType<typeof estadoDaMesa>
  alertas: AlertaMesa[]
}
export function filtrarMesas(
  linhas: MesaNaGrade[],
  filtros: FiltrosMesas,
  ordem: OrdemMesas,
): MesaNaGrade[]

// lib/admin/regras/atalhos-mesas.ts
export type AcaoAtalho =
  | { tipo: "nenhuma" }
  | { tipo: "buscar" }
  | { tipo: "nova-mesa" }
  | { tipo: "ajuda" }
  | { tipo: "abrir-mesa"; numero: number }
export function lerTecla(
  digitado: string,
  tecla: { key: string; emCampo: boolean; comModificador: boolean; janelaAberta: boolean },
): { digitado: string; acao: AcaoAtalho }

// servidor: api.mesas.editar(id, { numero, nome?, areaId, lugares, forma }): Promise<Mesa>
//           api.mesas.bloquear(id, motivo?): Promise<Mesa>
//           api.mesas.desbloquear(id): Promise<Mesa>
//           api.mesas.marcarLimpa(id): Promise<Mesa>
// consultas-mesas: useEditarMesa, useBloquearMesa, useDesbloquearMesa, useMarcarLimpa;
//                  useCriarMesa passa a aceitar areaId, lugares e forma
// components/admin/mesas/estado-grade.ts: useFiltrosMesas() (nuqs, como pedidos/estado-lista.ts)
```

**Arquivos**

- Criar:
  - `lib/admin/regras/{alertas-mesa,indicadores-salao,filtro-mesas,atalhos-mesas}.ts`, cada um com o seu `.test.ts`;
  - `components/admin/mesas/cartao-mesa.tsx` e `cartao-mesa.test.tsx`;
  - `components/admin/mesas/numeros-salao.tsx`;
  - `components/admin/mesas/filtros-mesas.tsx` e `estado-grade.ts`;
  - `components/admin/mesas/formulario-mesa.tsx` (nova e editar) e `bloquear-mesa.tsx`;
  - `components/admin/mesas/configurar-salao.tsx` e `configurar-salao.test.tsx`;
  - `components/admin/mesas/atalhos-mesas.tsx`.
- Mudar:
  - `lib/admin/dados/servidor.ts` e `servidor.test.ts`;
  - `lib/admin/dados/consultas-mesas.ts` e `consultas-mesas.test.tsx`;
  - `lib/admin/regras/esquema-salao.ts` e `esquema-salao.test.ts`;
  - `lib/admin/dados/gerar-pedidos.ts` (conta pedida há 12 min) e `gerar-pedidos.test.ts`;
  - `components/admin/mesas/pagina-mesas.tsx`, `nova-mesa.tsx` e `pagina-mesas.test.tsx`;
  - `tests/admin.spec.ts` e `tests/visual-admin.spec.ts`.

### Task 9 (Tarefa 9): pendências da Fase 1 nos testes

Só teste: nenhum código de produção muda.

- [ ] Em `components/admin/garcom/pagina-garcom.test.tsx`, a regex da mesa bloqueada usa `\b` dentro de template literal, que vira o caractere de backspace. Com isso o `queryByRole` nunca acha nada e o teste não pode falhar. Trocar por `\\b`. Para ver que ele pode falhar, mostrar temporariamente a mesa bloqueada no Garçom, ver o vermelho, e desfazer.
- [ ] Em `lib/admin/dados/servidor.test.ts`, no teste "base da versão 3 guardada há 3 dias", acrescentar `expect(ocupadas.length).toBeGreaterThan(0)` antes do laço sobre `ocupadas`.
- [ ] `pnpm test` dos dois arquivos verde. Commit `test: pendências da Fase 1 das mesas`.

### Task 10 (Tarefa 10): alertas da mesa

**Entrega:** `tempoDesde` e `alertasDaMesa` em `lib/admin/regras/alertas-mesa.ts`.

- [ ] Testes que falham, com `agora` fixo e limites `{ semPedidoMin: 15, contaPedidaMin: 10, servirMin: 10, abertaMin: 150 }`:
  - `tempoDesde`: "0 min" (inclusive para início no futuro), "59 min", "1 h 00" e "2 h 05";
  - para cada um dos quatro alertas, nada a 1 min do limite e o alerta no minuto exato, com o texto: "Pediu a conta há 10 min", "Pronta há 10 min", "Sem pedido há 15 min" e "Aberta há 2 h 30";
  - a mesa livre, a bloqueada e a juntada não têm alerta, mesmo com uma comanda antiga;
  - a comanda que bate três limites devolve os três, na ordem conta pedida, servir, aberta.
- [ ] Implementar. Em `pagina-mesas.tsx`, o cartão passa a importar `tempoDesde` daqui (sem mudar o que aparece).
- [ ] Commit `feat(mesas): alertas da mesa pelos limites do salão`.

### Task 11 (Tarefa 11): números do salão

**Entrega:** `indicadoresSalao` em `lib/admin/regras/indicadores-salao.ts`.

- [ ] Testes que falham, montados com `pedidoDeTeste` (`lib/admin/regras/pedidos-de-teste.ts`) e mesas literais:
  - 20 mesas, 1 bloqueada, 11 ocupadas e 1 juntada: ocupação `{ ocupadas: 12, total: 19, percentual: 63, texto: "12/19 · 63%" }`;
  - pessoas: comandas abertas com 4, 2 e sem `pessoas` somam 7;
  - faturamento: só pedidos de mesa, pagos e com `pagoEm` hoje. Um de ontem às 23:40 e um de entrega pago hoje ficam de fora. Com R$ 120,00, R$ 80,50 e R$ 99,50, dá R$ 300,00;
  - ticket por pessoa (4 + 2 + 4 pessoas) = R$ 30,00, e ticket por mesa = R$ 100,00;
  - permanência: 60, 90 e 45 min dão 65. Giro: 3 pagas em 19 mesas dá 0,2;
  - sem nenhuma paga hoje, os quatro valores por conta paga são `null` e o faturamento é 0;
  - nenhuma mesa: ocupação `0/0 · 0%`, sem dividir por zero.
- [ ] Implementar. O dinheiro é arredondado em centavos, meio para cima. O percentual e a permanência são arredondados para inteiro, e o giro tem 1 casa.
- [ ] Commit `feat(mesas): números do salão (ocupação, pessoas, faturamento, tickets, giro)`.

### Task 12 (Tarefa 12): busca, filtros e ordem das mesas

**Entrega:** `filtrarMesas` em `lib/admin/regras/filtro-mesas.ts`.

- [ ] Testes que falham, com 6 linhas literais (`MesaNaGrade`):
  - "12" acha as mesas 12 e 120, mas não a 1 nem a 21;
  - "julia" acha a cliente "Júlia", e "VARANDA" acha a mesa de nome "Varanda 3";
  - área, estado e garçom combinam (E);
  - o estado "ocupada" pega ocupada, na cozinha, servir e conta pedida;
  - `atencao` deixa só as mesas com alerta;
  - a ordem "numero" vai 1, 2, 12. A ordem "tempo" vai da aberta há mais tempo para a mais nova, e as livres ficam no fim, pelo número;
  - os filtros vazios devolvem tudo na ordem do número.
- [ ] Implementar e fazer o commit `feat(mesas): busca, filtros e ordem da grade`.

### Task 13 (Tarefa 13): atalhos da tela de mesas

**Entrega:** `lerTecla` em `lib/admin/regras/atalhos-mesas.ts`.

- [ ] Testes que falham:
  - "1" e depois "2" acumulam "12", e "Enter" devolve `abrir-mesa` 12 e zera o que foi digitado;
  - o quarto dígito é ignorado (fica em 3);
  - "Enter" sem dígitos não faz nada;
  - "Escape" zera os dígitos;
  - "/" dá `buscar`, "n" e "N" dão `nova-mesa` e "?" dá `ajuda`, e cada um zera os dígitos;
  - com `emCampo`, `comModificador` ou `janelaAberta`, nenhuma tecla faz nada e os dígitos ficam como estavam;
  - outras teclas não fazem nada.
- [ ] Implementar e fazer o commit `feat(mesas): leitura pura dos atalhos`.

### Task 14 (Tarefa 14): servidor, esquema e demonstração

**Entrega:** `editar`, `bloquear`, `desbloquear` e `marcarLimpa` no servidor, a limpeza no fechamento, o esquema em centavos, os hooks e a demonstração com alerta.

- [ ] Testes que falham em `servidor.test.ts`, um comportamento por vez:
  - editar: troca nome, área, lugares e forma;
    - número repetido: "Já existe a mesa 3.";
    - mesa ocupada trocando de número: "Feche a conta antes de mudar o número da mesa.";
    - mesa ocupada pode mudar o nome e os lugares;
    - trocando de área, a mesa vai para a primeira posição livre da área nova;
    - virando retangular de 8 lugares sobre uma vizinha, a mesa vai para uma posição livre e não sobrepõe ninguém (`mesasSeCruzam`);
    - nome vazio volta para "Mesa 07";
    - lugares, forma e área inválidos usam as mesmas mensagens de `criar`;
  - bloquear: guarda o motivo aparado e cortado em 80. Sem motivo, `bloqueio` fica `{}`. Mesa ocupada recusa com "Feche a conta antes de bloquear a mesa.";
  - desbloquear: tira o `bloqueio`, e a mesa volta a aceitar `lancar`;
  - marcar limpa: tira o `limpezaDesde`;
  - fechar a conta com `salao.limpeza` ligada deixa `limpezaDesde` igual ao `pagoEm`. Desligada, não deixa. `liberar` nunca deixa;
  - id inexistente nas quatro operações: "Mesa não encontrada".
- [ ] Teste que falha em `esquema-salao.test.ts`: couvert 8,555 recusado com "Informe o couvert em reais e centavos."; 8,5 e 8,55 passam; taxa 12,345 recusada e 12,5 passa.
- [ ] Teste que falha em `gerar-pedidos.test.ts`: a comanda mais antiga do roteiro pediu a conta há 12 min. Depois, trocar `contaPedidaHa: 5` por 12.
- [ ] Em `consultas-mesas.test.tsx`: `useEditarMesa`, `useBloquearMesa`, `useDesbloquearMesa` e `useMarcarLimpa` chegam ao servidor e invalidam as mesas. `useCriarMesa` repassa área, lugares e forma.
- [ ] Implementar cada um depois do seu vermelho. Commits por bloco (`feat(mesas): editar, bloquear e limpar a mesa no servidor`, `feat(mesas): couvert em centavos`, `feat(mesas): a demonstração tem uma conta pedida há 12 min`).

### Task 15 (Tarefa 15): cartão por estado, grade por área e menu ⋯

**Consome:** Tarefas 10 e 14. **Entrega:** `CartaoMesa` em `cartao-mesa.tsx` e a grade agrupada.

- [ ] Testes de componente que falham (`cartao-mesa.test.tsx` para o cartão, `pagina-mesas.test.tsx` para a grade):
  - o nome falado continua "Mesa N" pelo título, e a descrição traz o estado, o cliente, o total e os alertas;
  - livre mostra "4 lugares". Limpeza mostra "Limpeza há 5 min". Bloqueada mostra o motivo, ou "Sem motivo". Ocupada mostra o cliente, o tempo, o garçom, "3 pessoas", os itens e o total;
  - com alerta, o cartão mostra o texto do alerta mais urgente e fica marcado (`data-alerta`);
  - a grade tem uma seção por área, na ordem das áreas, com título (`heading`) e lista nomeada pela área. Área sem mesa não aparece;
  - o menu ⋯ ("Ações da mesa N") mostra só os itens do estado, pela tabela das decisões;
  - "Marcar limpa" e "Desbloquear" funcionam pelo menu. "Excluir" pede confirmação;
  - o rótulo "Pediu a conta" não quebra linha. É uma classe de layout, e quem confere é o screenshot do celular.
- [ ] Antes de mudar o visual: o screenshot `painel-mesas-*` já existe e está em dia. Implementar seguindo o DESIGN.md e os tons de `Traco`. O destaque do alerta usa o tom `novo`, nunca vermelho de erro. A busca do teste de comanda continua achando "Mesa 60".
- [ ] Ajustar os testes antigos de `pagina-mesas.test.tsx` que procuravam a lista única "Mesas" para a lista da área, porque o comportamento mudou de propósito.
- [ ] Commit `feat(mesas): cartão por estado, grade por área e menu de ações`.

### Task 16 (Tarefa 16): números no topo

**Consome:** Tarefa 11.

- [ ] Teste que falha em `pagina-mesas.test.tsx`: com a demonstração da pizzaria e o relógio fixo, a faixa "Números do salão" mostra a ocupação, as pessoas, o faturamento de hoje e o ticket por pessoa. "Ver mais" mostra a permanência, o giro e o ticket por mesa, com os valores lidos da própria demonstração por `indicadoresSalao`. Isso é permitido porque a função tem teste próprio com literais; aqui o teste confere a ligação.
- [ ] Implementar `numeros-salao.tsx`. O faturamento vem de `usePedidos({ status: ["concluido"], concluidosEm: hoje })`. O "ver mais" usa `Collapsible`. Valor nulo aparece como "—".
- [ ] Commit `feat(mesas): números do salão no topo`.

### Task 17 (Tarefa 17): busca e filtros no endereço

**Consome:** Tarefas 12 e 15.

- [ ] Testes que falham, com `NuqsTestingAdapter` (como em `pagina-agendamentos.test.tsx`):
  - digitar na busca escreve `?busca=` e a grade mostra só as mesas que batem;
  - o endereço `?estado=bloqueada` abre já filtrado;
  - "Precisam de atenção" mostra a contagem ("Precisam de atenção (1)") e grava `atencao=sim`;
  - a ordem "Mais tempo aberta" grava `ordem=tempo`;
  - sem resultado, aparece "Nenhuma mesa com esses filtros" com "Limpar filtros", que volta ao endereço limpo.
- [ ] Implementar `estado-grade.ts` (os parâmetros nuqs) e `filtros-mesas.tsx` (busca, área, estado, garçom, atenção e ordem), seguindo os filtros da lista de pedidos.
- [ ] Commit `feat(mesas): busca, filtros e ordem no endereço`.

### Task 18 (Tarefa 18): nova mesa, editar e bloquear

**Consome:** Tarefas 14 e 15.

- [ ] Testes que falham:
  - Nova mesa pergunta número, nome, área (as áreas do salão, com a primeira escolhida), lugares (4) e forma (quadrada), e a mesa nasce na área escolhida;
  - "Editar" no menu abre o mesmo formulário preenchido ("Editar mesa 3"), salva, e o erro do servidor aparece no aviso;
  - "Bloquear" abre a janela com o motivo opcional. Ao confirmar, o cartão fica "Bloqueada" com o motivo;
  - o bloqueio da mesa ocupada não aparece no menu (pela tabela), e o servidor também recusa.
- [ ] Implementar `formulario-mesa.tsx` (usado por `nova-mesa.tsx` e pelo editar) e `bloquear-mesa.tsx`.
- [ ] Commit `feat(mesas): editar e bloquear a mesa; nova mesa com área, lugares e forma`.

### Task 19 (Tarefa 19): Configurar salão

**Consome:** Tarefa 14.

- [ ] Testes que falham em `configurar-salao.test.tsx`:
  - o botão "Configurar salão" no cabeçalho abre o painel lateral com as áreas, os garçons, a taxa de serviço, o couvert, a limpeza e os alertas carregados do servidor;
  - adicionar a área "Terraço" e salvar grava a área no servidor e avisa "Salão salvo.";
  - excluir a área com mesas mostra o erro do servidor ("Mova as mesas da área Varanda antes de excluí-la.") e não fecha o painel;
  - desligar um garçom tira ele do filtro de garçom da grade;
  - taxa 25% mostra o erro do esquema ("A taxa de serviço vai de 0% a 20%.") sem salvar;
  - o couvert desligado esconde o campo de valor;
  - reservas, QR e funções Pro não aparecem e voltam iguais no que é salvo.
- [ ] Implementar `configurar-salao.tsx` com `Sheet`. Áreas novas ganham `area-${crypto.randomUUID()}` e garçons novos ganham `garcom-…`. A ordem das áreas é a posição na lista.
- [ ] Commit `feat(mesas): painel Configurar salão`.

### Task 20 (Tarefa 20): atalhos e atualização a cada 4 s

**Consome:** Tarefas 13, 15 e 18.

- [ ] Testes que falham em `pagina-mesas.test.tsx`:
  - digitar "6", "0" e Enter fora de campo abre a comanda da mesa 60;
  - "9", "9", "9" e Enter avisa "Não existe a mesa 999.";
  - "/" põe o foco na busca;
  - "n" abre Nova mesa;
  - "?" abre a folha "Atalhos do teclado";
  - digitar "n" dentro da busca só escreve na busca;
  - uma mesa criada no servidor depois da tela aberta aparece em até 4 s, sem recarregar. Avançar o relógio do intervalo com `vi.advanceTimersByTime`, ou ler o `refetchInterval` pela consulta, se o relógio falso travar o React Query.
- [ ] Implementar `atalhos-mesas.tsx` (o ouvinte de teclado, o aviso "Mesa 12 ↵" e a folha) e trocar `useMesas()` por `useMesas(4_000)` na página.
- [ ] Commit `feat(mesas): atalhos do teclado e atualização a cada 4 s`.

### Task 21 (Tarefa 21): E2E, screenshots e fechamento

- [ ] Em `tests/admin.spec.ts`:
  - filtrar "Precisam de atenção" mostra só a mesa que pediu a conta há 12 min, e o endereço guarda o filtro;
  - bloquear a mesa 5 pelo menu, com motivo, e desbloquear.
- [ ] `pnpm check`, mostrando a saída.
- [ ] `pnpm test:coverage`. Se a cobertura subiu, subir os mínimos.
- [ ] `pnpm test:e2e:rapido`. `painel-mesas-*` e `painel-comanda-*` vão mudar: revisar a diferença (claro e escuro, celular e desktop) e só então atualizar esses testes.
- [ ] Registrar a "Situação" no fim desta seção e abrir o PR da Fase 2 quando a Fase 1 estiver no `main`.

Situação: pronta em 21/11/2026, na branch `claude/admin-mesas-fase-2`, empilhada sobre a Fase 1. O PR sai depois que a Fase 1 estiver no `main`.

- **O que as revisões pegaram:**
  - a busca achava o número em qualquer posição ("12" achava 112), olhava nome e cliente mesmo com dígitos, e comparava o garçom com acento e maiúscula;
  - a limpeza ficou primeiro numa rotina que roda a cada gravação. Com isso, reabrir a demonstração num dia novo punha em "Limpeza" as mesas das comandas de ontem, encerradas sozinhas. Agora a limpeza só entra quando a conta é fechada no painel;
  - o ⋯ perdia o `absolute` para a área de toque e caía embaixo do cartão;
  - o nome padrão "Mesa 07" estava escrito em quatro lugares e virou `nomePadraoDaMesa`;
  - o resumo do cabeçalho dizia "12 livres" contando bloqueada e limpeza, e agora diz "10 livres";
  - a gaveta dizia "Mesa livre." para a mesa bloqueada ou em limpeza, e agora mostra o estado, com "Desbloquear" ou "Marcar limpa";
  - desligar a limpeza deixava mesas presas em "Limpeza";
  - "Nova mesa" aberta antes de as áreas carregarem dava "Escolha uma área do salão.";
  - Configurar salão abria em branco enquanto carregava, e um valor inválido escondido pelo interruptor bloqueava o salvar;
  - os atalhos disparavam com o menu ⋯ ou um filtro aberto, e o foco se perdia ao fechar as janelas abertas pelo ⋯;
  - no celular de 320 px, os filtros saíam cortados e "3 itens" quebrava linha.
- **Mudou fora do plano:**
  - o E2E de bloquear usa a mesa 11, porque a 5 está ocupada na demonstração;
  - a taxa com mais de 2 casas tem a mensagem própria "Informe a taxa com até 2 casas decimais.";
  - "Reservada" e "Juntada" saíram do filtro de estado até as Fases 5 e 7;
  - "07" acha a mesa 7;
  - a descrição falada do cartão traz o que ele mostra: nome, motivo, limpeza, lugares, garçom e pessoas;
  - a confirmação de excluir virou um componente só (`ConfirmarExclusaoMesa`), usado pelo menu e pela gaveta.
- **Fica para depois:**
  - **"ao vivo" entre abas:** a grade consulta a cada 4 s, mas o servidor de demonstração guarda a base em memória. Mudança feita em outra aba só aparece depois de recarregar, e uma aba desatualizada pode apagar ao gravar o que a outra gravou. Isso já era assim antes desta fase e fica para a Fase 8, com o `BroadcastChannel` esvaziando também a cópia em memória do servidor;
  - **pendências pequenas registradas na revisão:**
    - os atalhos de uma letra não podem ser desligados;
    - a limpeza depende de qual operação marca o pagamento;
    - o número ativo ao editar a mesa ocupada;
    - garçons com o mesmo nome;
    - a demonstração sem conta fechada hoje às 20:30, com o faturamento em R$ 0,00 (junto com a Fase 4).
- **Screenshots:**
  - `painel-mesas-*` e `painel-comanda-*` mudaram nas 11 telas, com a grade nova;
  - entraram `painel-nova-mesa-*` e `painel-configurar-salao-*`;
  - todas as diferenças foram revisadas antes de atualizar.
- **Testes e cobertura:**
  - 1345 testes no Vitest e 436 no E2E rápido (28 pulados);
  - os mínimos de cobertura subiram para 82/74/81/83 no geral, e `lib/**` continua em 98/94/98/98.

## Fase 3: comanda

**Desenho:**

- abas Itens / Conta / Histórico, e `?mesa=` no endereço;
- abrir mesa e "Adicionar itens", com o seletor e a bandeja extraídos do Garçom para um componente compartilhado;
- editar item, cancelar item e comanda com motivo;
- marcar servido, pediu a conta e o histórico;
- Garçom e abrir mesa usam a lista de garçons;
- cozinha preenche `servirDesde` ao marcar pronto em mesa.

**Fronteiras de teste**

1. **Servidor:**
   - abrir mesa (pessoas de 1 a 99, garçom da lista, mesa bloqueada recusada, reservada pede `confirmarReserva`);
   - editar item (recusa item já preparado);
   - tirar item já preparado sem motivo é recusado, e com motivo vira movimento `perda` sem devolver o estoque;
   - item não preparado devolve o estoque;
   - cancelar comanda com motivo, item a item no estoque;
   - marcar servido;
   - pediu a conta, e lançar depois disso limpa `contaPedidaEm`;
   - cada operação grava o evento certo no histórico.
2. **`lib/admin/regras/estoque.ts`:** o tipo `perda` com o motivo.
3. **Componentes:**
   - abas, e o endereço abre a mesa;
   - abrir mesa com aviso de lugares;
   - adicionar itens pelo seletor compartilhado (o Garçom continua passando nos testes dele);
   - motivo obrigatório, histórico e marcar servido.
4. **E2E:** abrir mesa, adicionar itens, a cozinha prepara, marcar servido e pedir a conta.

**Branch:** `claude/admin-mesas-fase-3`, empilhada sobre as Fases 1 e 2. O PR vai para `main` depois delas.

**Decisões de detalhe desta fase** (decorrem de Q6, Q10, Q12, Q15, Q22, Q23, Q28, Q29, Q36 e Q38)

- **Item preparado:** é o item que foi para a cozinha e é de uma rodada anterior à última rodada da cozinha, ou da última rodada com a comanda em preparo ou pronta. É a mesma leitura da tela da cozinha, que mostra as rodadas anteriores como já servidas. O item lançado sem cozinha (bebida pronta) nunca conta como preparado: sai devolvendo o estoque, sem motivo. A regra mora em `cozinhaJaPreparou` (`lib/admin/regras/cozinha.ts`), que passa a contar as rodadas anteriores. Tirar inteira a rodada que está na cozinha devolve a comanda a "pronto" (`depoisDeTirar`): a rodada anterior continua preparada e não volta para "A fazer". Sem nada pronto na mesa, o `servirDesde` sai. Na cozinha, a comanda conta os 15 min de "Prontos" desde o evento `pronta`, e não desde a última mudança.
- **Abrir mesa:**
  - `mesas.abrir` cria a comanda vazia (status "pronto", sem cozinha), com `mesa.pessoas` e `mesa.garcom`;
  - pessoas de 1 a 99 ("Informe de 1 a 99 pessoas.");
  - com garçons ativos no salão, o garçom é obrigatório ("Escolha o garçom.") e tem que ser um deles ("Esse garçom não está na lista do salão."). Sem garçom nenhum cadastrado, fica sem garçom;
  - mesa bloqueada recusa ("A mesa 20 está bloqueada."), mesa ocupada recusa ("A mesa 5 já está aberta."), e a mesa em limpeza abre (como no lançamento, a limpeza sai);
  - mesa com reserva marcada dentro da antecedência pede `confirmarReserva` ("A mesa 3 está reservada às 20:00. Confirme para abrir."). A tela só ganha essa confirmação na Fase 7, quando as reservas existirem;
  - mais pessoas que lugares não recusa: a tela avisa "A mesa 3 tem 4 lugares.".
- **Lançar:**
  - "Adicionar itens" na comanda usa o seletor e a bandeja do Garçom, extraídos para `components/admin/garcom/montar-rodada.tsx`. Os botões continuam "Enviar para a cozinha" e "Lançar na mesa" (os nomes de hoje, que o Garçom e os testes já usam);
  - o lançamento vai com o garçom da comanda;
  - lançar numa mesa com a conta pedida limpa `contaPedidaEm`, a tela avisa "A mesa 1 tinha pedido a conta e voltou para Ocupada." e a mesa volta ao estado do lançamento (Na cozinha ou Ocupada). Vale também para o item avulso;
  - **lançar na mesa livre (pelo Garçom) abre a mesa com as regras de abrir** (decidido na revisão): grava o evento `aberta` com o garçom, `pessoas: 1`, recusa garçom fora da lista quando o salão tem garçons ("Esse garçom não está na lista do salão.", sem diferenciar acento e maiúscula) e recusa a mesa reservada dentro da antecedência ("A mesa 3 está reservada. Abra pela tela de Mesas."). Sem nome, continua lançando sem garçom;
  - sem `por`, o evento da rodada leva o garçom do lançamento.
- **Editar item (Q29):** troca a observação e, no item do cardápio, as opções (o preço é refeito no servidor). As escolhas passam a ser guardadas no item (`ItemPedido.escolhas`) para a janela abrir marcada. Item já preparado recusa: "A cozinha já preparou Calabresa. Tire com motivo e lance de novo.". Item sem escolhas guardadas (lançado antes desta fase) só troca a observação.
- **Tirar e diminuir (Q10, Q38):**
  - item preparado só sai com motivo ("Diga o motivo para tirar o que a cozinha já preparou."), aparado e cortado em 140;
  - diminuir um item preparado é tirar parte dele, com a mesma regra;
  - item preparado não aumenta: "A cozinha já preparou Calabresa. Lance de novo para pedir mais.";
  - no estoque, o item não preparado devolve (movimento "devolucao", como hoje). O preparado não volta: a venda é desfeita e o mesmo tanto sai como **perda**, com o motivo. São dois movimentos com o saldo igual ao de antes, para o histórico do estoque continuar somando certo.
- **Cancelar comanda (Q36):** comanda vazia continua saindo por "Liberar mesa". Com itens, "Cancelar comanda" exige motivo, deixa a comanda cancelada com `motivoCancelamento: "outro"` e o texto em `detalheCancelamento`, aplica o estoque item a item (preparado vira perda) e libera a mesa sem passar pela limpeza. Em Pedidos, o detalhe mostra "Motivo: Outro · Cliente foi embora". A comanda aberta não se cancela por Pedidos: o painel troca "Cancelar pedido" por "Cancele pela tela de Mesas." com o link "Abrir a mesa 5", e o servidor recusa `pedidos.cancelar` na comanda de mesa (decidido na revisão: é o caminho mais simples, e a regra de Q36 fica num lugar só).
- **Servir:** a cozinha, ao marcar pronta uma comanda de mesa, preenche `servirDesde` (se já houver, fica o mais antigo). "Marcar servido" limpa o campo. Fica no topo da comanda e no menu ⋯ da mesa em "Servir".
- **Pediu a conta:** "Pediu a conta" na aba Conta grava `contaPedidaEm` (se já houver, fica o primeiro). Lançar depois limpa.
- **Histórico (Q10):** `Pedido.eventos`, do mais antigo para o mais novo, com `tipo`, `em`, `por` (opcional) e `texto` pronto. Nesta fase:

  | Tipo            | Texto                                            |
  | --------------- | ------------------------------------------------ |
  | `aberta`        | "Mesa aberta para 4 pessoas"                     |
  | `rodada`        | "Rodada 2 para a cozinha: 2× Calabresa, 1× Coca" |
  |                 | "Rodada 3 lançada na mesa: 1× Água"              |
  | `item-editado`  | "Calabresa: Sem cebola · Borda: Catupiry"        |
  | `item-removido` | "Tirou 1× Calabresa" (com `motivo` no preparado) |
  | `cancelada`     | "Comanda cancelada" (com `motivo`)               |
  | `pronta`        | "A cozinha terminou a rodada 2"                  |
  | `servida`       | "Rodada servida"                                 |
  | `conta-pedida`  | "Pediu a conta"                                  |

  O `por` é o garçom escolhido ao abrir (no evento `aberta`) e, nas outras ações da tela de Mesas, o nome guardado neste aparelho (`useGarcom`) e, sem ele, o garçom da comanda (`autorDaAcao`). A comanda antiga, sem `eventos`, mostra "Sem histórico registrado.".
- **Abas e endereço (Q28):** a gaveta ganha as abas Itens / Conta / Histórico. O rodapé com o total, "Imprimir conta" e "Fechar conta" fica fora das abas, à vista. Nesta fase a aba Conta mostra os itens somados, o total, "Pediu a conta" e "Cancelar comanda". A mesa aberta vai para o endereço pelo número (`?mesa=3`), com nuqs. Número que não existe no endereço não abre nada.
- **Garçons:**
  - no Garçom, "Seu nome" continua um campo de texto (o nome fica no aparelho), agora com os garçons ativos do salão em botões logo abaixo, que preenchem o campo (um `datalist` mudaria o papel do campo para combobox e quebraria os testes do Garçom);
  - em "Abrir mesa", o garçom é um Select com os garçons ativos, já marcado com o nome deste aparelho quando ele está na lista.
- **Pendências da Fase 2:**
  - o esquema do salão recusa dois garçons com o mesmo nome, sem diferenciar acento e maiúscula: "Já existe o garçom Rafa.";
  - editar a mesa ocupada deixa o campo Número travado, com o aviso "Feche a conta antes de mudar o número da mesa." (o servidor já recusa);
  - os atalhos de uma tecla (`/`, `N`, `?` e os dígitos com Enter) podem ser desligados neste aparelho, pelo interruptor "Atalhos de uma tecla" na folha de atalhos (WCAG 2.1.4). A folha passa a abrir também pelo botão "Atalhos do teclado" no cabeçalho, para quem desligou o `?`. A preferência fica em `lib/admin/preferencias-mesas.ts` (zustand com `persist`, como `preferencias-fila.ts`).

**Interfaces que a Fase 3 entrega**

```ts
// lib/admin/dados/tipos.ts
export type TipoMovimento = "entrada" | "saida" | "contagem" | "venda" | "devolucao" | "pesagem" | "perda"
export type TipoEventoComanda =
  | "aberta" | "rodada" | "item-editado" | "item-removido" | "cancelada"
  | "pronta" | "servida" | "conta-pedida"
export type EventoComanda = { tipo: TipoEventoComanda; em: string; por?: string; texto: string; motivo?: string }
// Pedido ganha: eventos?: EventoComanda[]; detalheCancelamento?: string
// ItemPedido ganha: escolhas?: Record<string, string[]>

// lib/admin/regras/estoque.ts
export function rotuloDoMovimento(tipo: TipoMovimento): string // "Perda"

// lib/admin/regras/historico.ts
export function comEvento(pedido: Pedido, evento: EventoComanda): Pedido
export function itensEmTexto(itens: Pick<ItemPedido, "quantidade" | "nome">[]): string // "2× Calabresa, 1× Coca"

// lib/admin/regras/atalhos-mesas.ts
// TeclaApertada ganha `ligados?: boolean` (padrão true). Desligados, só o Escape faz algo.

// servidor (api.mesas):
abrir(mesaId, { pessoas, garcom?, clienteNome?, confirmarReserva?, por? }): Promise<Pedido>
editarItem(pedidoId, itemId, { observacao?, escolhas?, por? }): Promise<Pedido>
alterarQuantidade(pedidoId, itemId, quantidade, { motivo?, por? } = {}): Promise<Pedido>
removerItem(pedidoId, itemId, { motivo?, por? } = {}): Promise<Pedido>
cancelarComanda(pedidoId, { motivo, por? }): Promise<Pedido>
marcarServido(pedidoId, por?): Promise<Pedido>
pedirConta(pedidoId, por?): Promise<Pedido>
// LancamentoMesa ganha `por?`. pedidos.avancar preenche servirDesde na comanda de mesa que fica pronta.

// consultas-mesas: useAbrirMesa, useEditarItem, useCancelarComanda, useMarcarServido, usePedirConta;
//                  useAlterarQuantidade e useRemoverItem passam a aceitar motivo
// components/admin/garcom/montar-rodada.tsx: useRodada() (itens, incluir, tocar no produto) e <Bandeja>
// components/admin/mesas/estado-grade.ts: useMesaAberta() (?mesa=, nuqs)
// lib/admin/preferencias-mesas.ts: usePreferenciasMesas({ atalhosLigados })
```

**Arquivos**

- Criar:
  - `lib/admin/dados/servidor-comanda.test.ts` (os testes de servidor desta fase);
  - `lib/admin/preferencias-mesas.ts` e `.test.ts`;
  - `components/admin/garcom/montar-rodada.tsx`;
  - `components/admin/mesas/abrir-mesa.tsx`, `adicionar-itens.tsx`, `tirar-item.tsx` (motivo), `historico-comanda.tsx`;
  - `components/admin/mesas/comanda-mesa.test.tsx`.
- Mudar:
  - `lib/admin/dados/tipos.ts`, `servidor.ts`, `consultas-mesas.ts` e `consultas-mesas.test.tsx`;
  - `lib/admin/regras/{cozinha,estoque,historico,atalhos-mesas,esquema-salao}.ts` e os seus testes;
  - `components/admin/mesas/{comanda-mesa,pagina-mesas,cartao-mesa,formulario-mesa,atalhos-mesas,estado-grade}.tsx`;
  - `components/admin/garcom/pagina-garcom.tsx`, `components/admin/estoque/janelas-estoque.tsx`, `components/admin/pdv/janela-opcoes.tsx` (valores iniciais) e `components/admin/pedidos/detalhes-pedido.tsx`;
  - `tests/admin.spec.ts`.

### Task 22 (Tarefa 22): pendências da Fase 2

- [ ] Teste que falha em `esquema-salao.test.ts`: "Rafa" e "rafa" (e "Bia" e "Biá") são recusados com "Já existe o garçom Rafa.", no caminho do segundo. Implementar no `superRefine`, como o das áreas. Commit `fix(mesas): o salão recusa dois garçons com o mesmo nome`.
- [ ] Teste que falha em `pagina-mesas.test.tsx`: "Editar" na mesa ocupada 5 mostra o campo Número desabilitado e o aviso "Feche a conta antes de mudar o número da mesa.". Na mesa livre o campo continua editável. Commit `fix(mesas): o número da mesa ocupada fica travado ao editar`.
- [ ] Testes que falham:
  - `atalhos-mesas.test.ts`: com `ligados: false`, "1", "/", "n", "?" e "Enter" não fazem nada, e "Escape" ainda zera os dígitos;
  - `preferencias-mesas.test.ts`: começa ligado, desligar grava no `localStorage` e volta pelo `rehydrate`;
  - `pagina-mesas.test.tsx`: o botão "Atalhos do teclado" abre a folha; desligar "Atalhos de uma tecla" faz o "n" não abrir Nova mesa.
- [ ] Implementar e fazer o commit `feat(mesas): desligar os atalhos de uma tecla (WCAG 2.1.4)`.

### Task 23 (Tarefa 23): perda no estoque, eventos e item preparado

- [ ] Testes que falham:
  - `estoque.test.ts`: `rotuloDoMovimento` dá "Perda", "Devolução" e "Venda". A janela do histórico do estoque passa a ler daqui;
  - `historico.test.ts`: `comEvento` acrescenta no fim sem mudar o resto, e cria a lista na comanda sem `eventos`; `itensEmTexto` dá "2× Calabresa, 1× Coca" e "" para a lista vazia;
  - `cozinha.test.ts`: o item da rodada 1, com a rodada 2 na cozinha em "recebido", conta como preparado; o da rodada 2 não; o item sem cozinha nunca conta.
- [ ] Implementar (tipos novos em `tipos.ts`) e fazer o commit `feat(mesas): perda no estoque, eventos da comanda e item preparado por rodada`.

### Task 24 (Tarefa 24): abrir mesa e lançar no servidor

**Entrega:** `mesas.abrir`, o evento das rodadas e a conta pedida limpa ao lançar.

- [ ] Testes que falham em `servidor-comanda.test.ts` (lanchonete de teste com os garçons "Rafa" e "Bia", e "Lucas" inativo):
  - abrir a mesa 1 para 3 pessoas com Rafa: comanda vazia, mesa ocupada, `mesa: { numero: 1, garcom: "Rafa", pessoas: 3 }`, cliente "Ana" quando informado, e o evento `{ tipo: "aberta", por: "Rafa", texto: "Mesa aberta para 3 pessoas" }`;
  - 0, 100 e 2,5 pessoas: "Informe de 1 a 99 pessoas.";
  - sem garçom: "Escolha o garçom."; Lucas (inativo) e "Zé": "Esse garçom não está na lista do salão."; sem nenhum garçom no salão, abre sem garçom;
  - mesa bloqueada, ocupada e inexistente recusam com as mensagens das decisões;
  - mesa com reserva marcada às 20:45 (agora 20:30, antecedência 30) recusa sem `confirmarReserva` e abre com ela. A reserva entra direto na base guardada, porque a Fase 7 ainda não tem a operação;
  - 5 pessoas numa mesa de 4 lugares abre;
  - lançar grava o evento `rodada` com o texto da cozinha ou da mesa, e o `por`;
  - lançar numa comanda com `contaPedidaEm` limpa o campo.
- [ ] Implementar e fazer o commit `feat(mesas): abrir a mesa com pessoas e garçom; a rodada entra no histórico`.

### Task 25 (Tarefa 25): editar, tirar e cancelar no servidor

- [ ] Testes que falham em `servidor-comanda.test.ts`, com Refri (5 un) e Bacon (10 un) no estoque, como em `servidor-estoque.test.ts`:
  - editar a observação e as opções do X-Burger refaz o preço e grava `item-editado`; as escolhas ficam no item;
  - editar item preparado: recusa com a mensagem das decisões;
  - tirar o Refri não preparado devolve o estoque (5), sem motivo, com o evento `item-removido` "Tirou 2× Refri lata";
  - tirar o Refri preparado sem motivo recusa; com "Caiu no chão" tira, o saldo continua 3, e o histórico do estoque ganha `devolucao` +2 e `perda` −2 com o motivo; o evento leva o motivo;
  - diminuir o preparado de 2 para 1 pede motivo e perde 1; aumentar o preparado recusa;
  - cancelar comanda sem motivo recusa; com motivo, a comanda fica cancelada com `detalheCancelamento`, o não preparado volta, o preparado vira perda, a mesa fica livre e sem limpeza, e o evento `cancelada` leva o motivo;
  - cancelar a comanda vazia recusa: "A comanda está vazia. Libere a mesa.".
- [ ] Implementar e fazer o commit `feat(mesas): editar item, tirar com motivo e cancelar a comanda, com a perda no estoque`.

### Task 26 (Tarefa 26): servir e pedir a conta no servidor

- [ ] Testes que falham em `servidor-comanda.test.ts`:
  - a cozinha marca pronta a comanda de mesa: `servirDesde` vira a hora, com o evento `pronta` "A cozinha terminou a rodada 2". Pronta de novo, com `servirDesde` já preenchido, fica o mais antigo. Pedido de entrega pronto não ganha o campo;
  - "marcar servido" limpa `servirDesde` e grava `servida`; sem nada a servir, recusa "Não há nada para servir.";
  - "pedir a conta" grava `contaPedidaEm` e `conta-pedida`; pedir de novo mantém a primeira hora;
  - as duas operações recusam a comanda que não está aberta.
- [ ] Implementar e fazer o commit `feat(mesas): a cozinha avisa o que servir; marcar servido e pedir a conta`.

### Task 27 (Tarefa 27): hooks da comanda

- [ ] Testes que falham em `consultas-mesas.test.tsx`: `useAbrirMesa`, `useEditarItem`, `useCancelarComanda`, `useMarcarServido` e `usePedirConta` chegam ao servidor, guardam a comanda devolvida e invalidam as mesas; `useRemoverItem` e `useAlterarQuantidade` repassam o motivo.
- [ ] Implementar e fazer o commit `feat(mesas): hooks de abrir, editar, cancelar, servir e pedir a conta`.

### Task 28 (Tarefa 28): seletor e bandeja compartilhados

- [ ] Extrair a bandeja e a montagem da rodada (`useRodada`: itens, incluir com aviso, tocar no produto, janela de opções) de `pagina-garcom.tsx` para `components/admin/garcom/montar-rodada.tsx`, sem mudar o comportamento: os testes de `pagina-garcom.test.tsx` cobrem e continuam verdes, sem mudar.
- [ ] Teste que falha em `pagina-garcom.test.tsx`: o campo "Seu nome" sugere os garçons ativos do salão (Lucas, Paula, Rafa e Bia na pizzaria). Implementar com botões abaixo do campo (grupo "Garçons do salão").
- [ ] Commits `refactor(garcom): bandeja e rodada num componente compartilhado` e `feat(garcom): "Seu nome" sugere os garçons do salão`.

### Task 29 (Tarefa 29): abas da comanda e a mesa no endereço

- [ ] Testes que falham em `pagina-mesas.test.tsx`:
  - clicar na mesa 60 grava `?mesa=60`; fechar a gaveta tira o parâmetro;
  - o endereço `?mesa=60` abre a gaveta da mesa 60; `?mesa=999` não abre nada;
  - a comanda tem as abas Itens, Conta e Histórico, e começa em Itens;
  - os atalhos (número + Enter) também gravam `?mesa=`.
- [ ] Implementar `useMesaAberta` em `estado-grade.ts` e as abas em `comanda-mesa.tsx`, com o rodapé fora das abas.
- [ ] Commit `feat(mesas): comanda com abas e a mesa aberta no endereço`.

### Task 30 (Tarefa 30): abrir mesa e adicionar itens na tela

- [ ] Testes que falham em `comanda-mesa.test.tsx` (pizzaria):
  - a gaveta da mesa livre 11 pergunta pessoas, garçom e cliente; com 3 pessoas e Bia, a mesa abre, a gaveta mostra a comanda vazia e o cartão fica "Ocupada" com "3 pessoas";
  - 3 pessoas na mesa 11 (2 lugares) mostram "A mesa 11 tem 2 lugares." e deixam abrir;
  - sem garçom, o botão "Abrir mesa" fica desabilitado;
  - "Adicionar itens" abre o catálogo com a bandeja; um produto e "Enviar para a cozinha" lançam a rodada, que aparece em Itens, e a mesa fica "Na cozinha";
  - adicionar itens na mesa 1 (pediu a conta) avisa "A mesa 1 tinha pedido a conta e voltou para Ocupada.".
- [ ] Implementar `abrir-mesa.tsx` e `adicionar-itens.tsx`. Sai o convite "Abrir o Garçom" da gaveta da mesa livre; o teste antigo que procurava esse link na mesa 20 e na 9 continua valendo (ele confere a ausência).
- [ ] Commit `feat(mesas): abrir a mesa e adicionar itens pela comanda`.

### Task 31 (Tarefa 31): editar, tirar com motivo e cancelar na tela

- [ ] Testes que falham em `comanda-mesa.test.tsx`:
  - "Editar" no item não preparado abre a janela com a observação; salvar mostra a observação nova;
  - o item preparado não tem "Editar" nem "Mais um";
  - "Remover" no preparado pede o motivo; "Tirar da comanda" fica desabilitado sem motivo; com "Caiu no chão", o item sai;
  - "Cancelar comanda" (aba Conta) pede o motivo; ao confirmar, a mesa fica livre.
- [ ] Mudar o teste antigo "tirar ou diminuir o que a cozinha já preparou pede confirmação" de `pagina-mesas.test.tsx`: a confirmação passa a pedir o motivo (mudança planejada, Q10).
- [ ] Teste que falha em `detalhes-pedido`: a comanda cancelada mostra "Motivo: Outro · Cliente foi embora".
- [ ] Implementar `tirar-item.tsx`, o editar com `JanelaOpcoes` (que ganha valores iniciais e o botão "Salvar") e o cancelar. Commit `feat(mesas): editar item, tirar com motivo e cancelar a comanda pela tela`.

### Task 32 (Tarefa 32): servir, pedir a conta e histórico na tela

- [ ] Testes que falham:
  - a comanda da mesa em "Servir" mostra "Marcar servido"; ao marcar, o estado vira o seguinte e o botão some;
  - o menu ⋯ da mesa em "Servir" tem "Marcar servido";
  - "Pediu a conta" na aba Conta deixa o cartão "Pediu a conta";
  - a aba Histórico lista os eventos com hora e garçom ("20:30 · Mesa aberta para 3 pessoas · Bia"), do mais novo para o mais antigo, e "Sem histórico registrado." na comanda antiga;
  - a cozinha (`pagina-cozinha.test.tsx`): marcar pronto o ticket de mesa deixa a comanda com `servirDesde`.
- [ ] Mudar o teste antigo "o resumo conta a rodada na cozinha pelo status da comanda, mesmo com a conta pedida": com a Fase 3, a rodada nova limpa o "Pediu a conta" (Q23), e o cartão da mesa 1 passa a dizer "Na cozinha".
- [ ] Implementar `historico-comanda.tsx`, os botões e o item do menu. Commit `feat(mesas): marcar servido, pedir a conta e histórico da comanda`.

### Task 33 (Tarefa 33): E2E e fechamento

- [ ] Em `tests/admin.spec.ts`: abrir a mesa 11 com 2 pessoas, adicionar uma pizza e enviar para a cozinha, a cozinha inicia e marca pronto, a mesa fica "Servir", marcar servido, pedir a conta e ver "Pediu a conta" no cartão.
- [ ] `pnpm check`, mostrando a saída. `pnpm test:coverage` e subir os mínimos se a cobertura subiu.
- [ ] `pnpm test:e2e:rapido`, revisando os screenshots que mudaram (`painel-mesas-*` pelo botão de atalhos no cabeçalho, `painel-comanda-*` pelas abas).
- [ ] Registrar a "Situação" no fim desta seção.

Situação: pronta em 21/11/2026, na branch `claude/admin-mesas-fase-3`, empilhada sobre a Fase 2. O PR sai depois que as Fases 1 e 2 estiverem no `main`.

- **O que a revisão pegou** (cada correção com o teste vermelho antes):
  - tirar a rodada nova (ainda na cozinha) fazia a rodada anterior, já preparada, voltar a "não preparada": ela reaparecia em "A fazer" e saía sem motivo, devolvendo o estoque. Agora a comanda volta a "pronto" quando a rodada da cozinha sai inteira (`depoisDeTirar`), o "Servir" sai quando não sobra nada pronto, e a cozinha conta os 15 min de "Prontos" desde o evento `pronta`. Vale também para base antiga, sem marca nova no item;
  - em Pedidos, "Cancelar pedido" cancelava a comanda aberta sem motivo escrito, sem perda e sem evento. Escolhi o caminho mais simples: o painel mostra "Cancele pela tela de Mesas." com o link "Abrir a mesa 5", e o servidor recusa;
  - "Menos um", "Remover", o item avulso e o Garçom gravavam eventos sem quem fez. Agora as ações assinam com o nome do aparelho ou o garçom da comanda (`autorDaAcao`), e o servidor usa o `garcom` do lançamento quando falta `por`;
  - o item avulso limpava "Pediu a conta" sem o aviso. Ele passa pelo mesmo lançamento do "Adicionar itens" (`useLancarNaComanda`);
  - "Editar" não trocava as opções (Q29): a `JanelaOpcoes` abre marcada, com "Salvar";
  - lançar pelo Garçom em mesa livre abria sem as regras de abrir mesa (ver "Lançar" nas decisões);
  - menores: a mesa em limpeza com reserva abria sem confirmação; `abrir` não aceitava `por`; a conferência do "Abrir mesa" estava no componente (foi para `conferirAbertura`, e o botão diz o que falta ao tentar abrir); o campo Garçom aparecia vazio sem garçons; o cliente aceitava 60 letras e o servidor 80; a mesa em Limpeza não oferecia "Abrir mesa"; as janelas de motivo abriam com o foco no "Voltar", e "Tirar" fechava antes da resposta, perdendo o motivo em erro; o "Menos um" perguntava "Tirar Pizza da comanda?"; "Pediu a conta" aparecia na comanda vazia; `servirDesde` sobrava depois de tirar a rodada pronta; a gaveta continuava estreita no desktop; o botão do garçom no Garçom não marcava "rafa"; o histórico usava o índice invertido como chave; `?mesa=999` ficava no endereço.
- **Mudou fora do plano:**
  - a conta pedida limpa ao lançar entrou na Tarefa 24 (e não na 32), junto com o teste antigo que a fixava;
  - a confirmação com motivo do item preparado entrou na Tarefa 25, para o commit do servidor continuar verde;
  - "Seu nome" no Garçom usa botões, não `datalist` (ver as decisões);
  - "Abrir mesa" valida ao enviar, com a mensagem no campo, em vez de deixar o botão desabilitado sem dizer por quê;
  - os testes de `comanda-mesa.test.tsx` têm 15 s de limite: cada um monta a tela inteira.
- **Testes antigos que mudaram (mudança de comportamento planejada):**
  - "o resumo conta a rodada na cozinha… mesmo com a conta pedida" virou "a rodada lançada depois de pedir a conta limpa o pedido" (Q23);
  - "tirar ou diminuir o que a cozinha já preparou pede confirmação" passa a digitar o motivo (Q10, Q38) e, no "Menos um", procura o título "Tirar 1 Pizza?";
  - "sem pessoas ou sem garçom, Abrir mesa fica desabilitado" virou "Abrir mesa diz o que falta e não abre";
  - "o erro do servidor ao editar" usa a mesa livre 12, porque a 3 está ocupada e o número dela agora trava;
  - a tabela do menu ⋯ em `cartao-mesa.test.tsx` ganha "Marcar servido" em Servir.
  - Os testes do Garçom continuam passando sem mudança: os nomes usados (Rafa) estão na lista do salão.
- **Fica para depois:**
  - a confirmação de reserva na tela, com as reservas (Fase 7). Até lá, o Garçom recusa a mesa reservada e manda abrir pela tela de Mesas;
  - "Imprimir conta" ainda não marca "Pediu a conta": entra com a pré-conta (Fase 4);
  - aumentar a quantidade de um item não preparado não entra no histórico.
- **Screenshots:**
  - mudaram nas 11 telas: `painel-mesas-*` (botão "Atalhos do teclado"), `painel-comanda-*` (abas, "Adicionar itens", gaveta mais larga, "Mais um" desabilitado no que a cozinha preparou), `painel-nova-mesa-*` e `painel-configurar-salao-*` no celular (o cabeçalho novo por trás da janela) e `painel-garcom-*` (os garçons abaixo de "Seu nome");
  - entraram `painel-abrir-mesa-*`, `painel-adicionar-itens-*` e `painel-atalhos-mesas-*`;
  - todas as diferenças foram revisadas (claro e escuro, celular e desktop, e uma amostra de cada tamanho) antes de atualizar.
- **Testes e cobertura:** 1444 testes no Vitest e 450 no E2E rápido (`celular-390` e `desktop-1920`, 28 pulados, nenhuma falha). A cobertura ficou em 83,38/75,78/81,92/84,44 no geral: os mínimos continuam 83/75/81/84, e `lib/**` em 98/94/98/98.

## Fase 4: conta

**Desenho:**

- aba Conta: resumo, pagamentos, saldo, dividir (igual e por item), desconto, cortesia, tirar taxa e tirar couvert;
- receber em dinheiro (com troco, usando `sugestoesDeTroco` de `lib/checkout.ts`), Pix ou cartão (crédito ou débito);
- pré-conta e comprovante;
- reabrir;
- em Pedidos, "Misto" e a lista de pagamentos;
- no Início, o faturamento por forma soma as partes, e a taxa aparece separada;
- cenário de demonstração com uma conta já paga em parte.

**Fronteiras de teste**

1. **`lib/admin/regras/conta.ts`:**
   - `resumoDaConta`: itens, cortesias, descontos, base da taxa, taxa, couvert, total, pago e saldo;
   - `dividirIgualmente(100, 3)` → `[33.33, 33.33, 33.34]`;
   - `valorDosItens`, com a parte da taxa;
   - taxa de 10% sobre R$ 87,45 = **8,75**;
   - desconto acima dos itens é recusado.
2. **Servidor:**
   - taxa e couvert congelados na abertura;
   - pagamento parcial, misto e por item;
   - pagamento acima do saldo é recusado (menos em dinheiro, que gera troco);
   - fecha sozinha com saldo zero;
   - cortesia não devolve o estoque;
   - reabrir só no mesmo dia (incluindo o caso 23:40 → 00:10) e só com a mesa livre ou em limpeza.
3. **`lib/admin/regras/dashboard.ts` e `rotulos.ts`:** formas somadas por parte, "Misto" e taxa separada.
4. **Componentes:** aba Conta, divisão, receber com troco, reabrir e a pré-conta com os campos certos.
5. **E2E:** dividir por 3, pagar uma parte em Pix e o resto em dinheiro com troco, e ver "Misto" em Pedidos.

**Branch:** `claude/admin-mesas-fase-4`, empilhada sobre as Fases 1 a 3. O PR vai para `main` depois delas.

**Decisões de detalhe desta fase** (decorrem de Q8, Q9, Q19, Q20, Q30, Q34, Q37, Q45 e das decorrências 3, 4 e 5)

- **Dinheiro:** as regras da conta trabalham em centavos inteiros (`emCentavos`, que arredonda o valor em reais antes) e só voltam para reais no fim. A taxa é `(base × percentual em centésimos + 5000) ÷ 10000`, arredondada para baixo: a conta inteira, sem `Math.round` de número quebrado. Assim 10% de R$ 87,45 dá R$ 8,75.
- **Resumo da conta** (`resumoDaConta`, em `lib/admin/regras/conta.ts`):
  - **itens:** a soma do `total` de todos os itens, inclusive as cortesias;
  - **cortesias:** a soma dos itens com `cortesia`;
  - **descontos:** o desconto da conta (`Pedido.descontoConta`), em R$ ou em % de (itens − cortesias), meio para cima;
  - **base da taxa:** itens − cortesias − descontos;
  - **taxa:** o percentual congelado (`Pedido.taxaServico`) sobre a base, ou 0 se tirada ou ausente;
  - **couvert:** o valor congelado (`Pedido.couvert`) × pessoas (`mesa.pessoas`, ou 1), ou 0 se tirado ou ausente;
  - **total:** base + taxa + couvert; **pago:** a soma dos pagamentos; **saldo:** total − pago (nunca negativo).
- **Total no pedido:** toda mudança na comanda refaz `subtotal` (itens), `desconto` (o desconto da conta, sem as cortesias) e `total` (o total do resumo), por `comTotais`. Pedidos, Início e o cartão da mesa continuam lendo `total`.
- **Congelamento (decorrência 3):** a comanda nova (por "Abrir mesa" ou pelo lançamento na mesa livre) guarda `taxaServico: { percentual }` se a taxa está ligada no salão e `couvert: { porPessoa }` se o couvert está ligado. Comanda sem os campos (base antiga, ou aberta com eles desligados) não tem taxa nem couvert. Mudar o salão não mexe em conta aberta.
- **Pagamento** (`Pedido.pagamentos`, do mais antigo ao mais novo): `{ id, forma, valor, em, por?, recebido?, troco?, cartao?, itens? }`.
  - `forma` é uma das três formas da loja (`PagamentoMesa`: dinheiro, Pix, cartão na maquininha). Crédito ou débito é o `cartao` (decorrência 4), obrigatório no cartão ("Escolha crédito ou débito.");
  - `valor` é o que abate do saldo, de R$ 0,01 até o saldo ("Informe um valor acima de zero.", "O valor passa do saldo de R$ 66,67.");
  - no dinheiro, `recebido` (opcional, padrão = valor) é o que o cliente entregou e não pode ser menor que o valor ("O valor recebido é menor que o da parte."). Dinheiro acima do saldo é aceito: o valor vira o saldo e o resto vira troco;
  - `itens` (pagamento por item): ids dos itens que ele cobre. O servidor refaz o valor por `valorDosItens` (o item marcado mais a taxa sobre ele) e recusa item inexistente, em cortesia ou já pago ("Esse item já foi pago.");
  - o evento `pagamento` tem o texto "Pix R$ 33,33", "Dinheiro R$ 66,67 · troco R$ 13,33" ou "Cartão de crédito R$ 10,00 · 2 itens".
- **Fecha sozinha:** quando o saldo chega a zero, a comanda fica concluída e paga, com `pagoEm`, o evento `fechada` ("Conta fechada") e a mesa livre (em Limpeza, com a limpeza ligada). O `pagamento` do pedido passa a ser a forma do maior pagamento (o primeiro, no empate), e o `trocoPara` fica só quando houve um pagamento único em dinheiro. `fecharConta(pedidoId, forma)` continua existindo: é pagar o saldo inteiro de uma vez; sem saldo (tudo em cortesia, ou a conta reaberta sem mudança), fecha sem pagamento. Desconto, cortesia ou item tirado que zera o saldo de uma conta já paga em parte também fecha sozinho. Sem saldo, receber recusa ("Não há saldo a receber. Feche a conta.") (revisão).
- **Limpeza unificada:** só fechar a conta põe a mesa em limpeza, e isso acontece no mesmo ponto (`alterar`), qualquer que seja o caminho. Por isso "Marcar como pago" em Pedidos deixa de valer para a comanda de mesa aberta: o servidor recusa ("Receba a conta pela tela de Mesas.") e o painel mostra o aviso com o link "Abrir a mesa 5", como no cancelar (decidido: um lugar só para o dinheiro da mesa, com saldo, troco e histórico).
- **Desconto:** em R$ (até 2 casas) ou em % (de 0,01 a 100), com motivo obrigatório ("Diga o motivo do desconto."), nunca maior que itens − cortesias ("O desconto passa do valor dos itens."). Um desconto novo troca o anterior; valor zero tira o desconto, com motivo e o evento "Tirou o desconto" (revisão: botão "Tirar desconto" na aba Conta). Evento `desconto`: "Desconto de R$ 10,00" ou "Desconto de 10% (R$ 8,75)", com o motivo.
- **Cortesia:** zera um item, com motivo. O item continua na comanda (o estoque não volta: foi consumido). Recusa item já em cortesia ou já pago. Evento `cortesia`: "Cortesia: 1× Coca", com o motivo. A cortesia não se desfaz nesta fase.
- **Tirar taxa e couvert:** com motivo, guardado no próprio campo (`taxaServico.removida`, `couvert.removido`). Recusa se a comanda não tem taxa ("Esta conta não tem taxa de serviço.") ou couvert. Eventos `taxa-removida` ("Tirou a taxa de serviço") e `couvert-removido` ("Tirou o couvert").
- **Conta menor que o pago:** desconto, cortesia, tirar taxa, tirar couvert e tirar item recusam quando o total ficaria abaixo do que já foi pago: "A conta ficaria menor que o já pago. Estorne um pagamento antes.".
- **Estornar pagamento:** na comanda aberta, com motivo. Tira o pagamento e grava `pagamento-estornado` ("Estornou Pix R$ 33,33"). É o que torna os pagamentos editáveis depois de reabrir (Q37).
- **Pré-conta (Q30):** `imprimirPreConta` marca "Pediu a conta" (se ainda não estava) e grava o evento `pre-conta` ("Pré-conta impressa"). A pré-conta sai em 80 mm com: loja, mesa e cliente, data e hora, itens (a cortesia com "cortesia"), itens, cortesias, desconto, taxa (com o %), couvert (pessoas × valor), total, pagamentos feitos, saldo e o valor por pessoa. O comprovante de cada pagamento sai em 80 mm com loja, mesa, data e hora, forma (com crédito ou débito), valor, recebido e troco no dinheiro, e o saldo que ficou. O comprovante não grava evento.
- **Reabrir (Q37):** só a comanda de mesa concluída e paga, só no mesmo dia do `pagoEm` no fuso de São Paulo ("Só dá para reabrir a conta no mesmo dia."), só a última conta fechada da mesa ("Só dá para reabrir a última conta da mesa.") e só com a mesa livre ou em Limpeza, sem bloqueio ("A mesa 5 já está aberta." ou "A mesa 5 está bloqueada."). Exige motivo. A comanda volta para "pronto", sem `pagoEm`, com `situacaoPagamento: "na-entrega"`, os pagamentos mantidos e o evento `reaberta` com o motivo; a mesa volta a ficar ocupada e sai da limpeza. Na gaveta da mesa livre ou em Limpeza, "Reabrir a conta" aparece quando `mesas.ultimaConta(mesaId)` devolve a conta que pode ser reaberta.
- **Virada do dia (ponto 3):** o faturamento usa o dia de cada pagamento (`em`), e reabrir usa o dia do `pagoEm`. A comanda aberta às 23:40 e paga às 00:10 entra no faturamento do dia seguinte e pode ser reaberta nesse dia.
- **Faturamento do salão hoje (decorrência 5):** para cada comanda de mesa (aberta ou concluída), a soma dos pagamentos com `em` hoje, sem a parte da taxa: `pago hoje × (total − taxa) ÷ total`, em centavos, uma vez por comanda. A comanda paga antes desta fase, sem `pagamentos`, conta como um pagamento único do total no `pagoEm` (`pagamentosDoPedido`). Os tickets, a permanência e o giro continuam contando só as contas fechadas hoje, agora sem a taxa.
- **Pedidos (Q34):**
  - a forma de pagamento da lista e do detalhe é "Misto" quando os pagamentos têm mais de uma forma (`rotuloPagamentoDoPedido`); o filtro por forma põe a conta Misto em cada forma que ela tem (`formasDoPedido`), e a comanda aberta paga em parte numa forma só mostra essa forma (revisão);
  - o detalhe lista cada pagamento ("Pix · R$ 33,33", "Dinheiro · R$ 66,67 · troco R$ 13,33", "Cartão de crédito · R$ 10,00") e mostra cortesias, taxa de serviço e couvert nos totais.
- **Início (Q34):** em Financeiro, "Formas de pagamento" soma cada pagamento na sua forma (o pedido misto conta nas duas). A taxa de serviço aparece separada, abaixo, como "Taxa de serviço · dos garçons", com o total do período. O faturamento, o ticket, a série, o melhor dia, os canais e a meta do Início ficam sem a taxa (`valorSemTaxa`); "Formas de pagamento" continua com o que entrou no caixa e avisa que inclui a taxa; o bloco da taxa soma só as contas pagas, pelo dia do pagamento (revisão).
- **Tela, aba Conta:**
  - resumo (itens, cortesias, desconto, taxa, couvert, total, pago e saldo);
  - lista de pagamentos, cada um com "Comprovante" e "Estornar" (motivo);
  - "Dividir igualmente": partes de 2 a 20 (começa nas pessoas da mesa), com o valor de cada parte do **total** (a última leva o centavo) e "Receber" em cada uma;
  - "Por item": os itens ainda não pagos e sem cortesia, com caixa de marcar; "Receber R$ X" leva os itens;
  - "Desconto", "Tirar taxa" e "Tirar couvert" abrem a janela de motivo. A cortesia fica no item, na aba Itens ("Cortesia", com motivo), e o item em cortesia mostra "Cortesia" e o valor riscado;
  - "Pediu a conta" e "Cancelar comanda" continuam.
- **Receber:** janela "Receber da mesa 5" com a forma (Dinheiro, Pix, Cartão), crédito ou débito no cartão, o valor (o saldo, ou a parte escolhida) e, no dinheiro, "Valor recebido" com as notas de `sugestoesDeTroco(valor)` e o troco. O rodapé da gaveta mostra o total e, com pagamento feito, o saldo. "Fechar conta" abre o Receber com o saldo. "Imprimir conta" vira "Imprimir pré-conta".

**Interfaces que a Fase 4 entrega**

```ts
// lib/admin/dados/tipos.ts
export type CartaoPagamento = "credito" | "debito"
export type PagamentoConta = {
  id: string
  forma: "dinheiro" | "pix" | "cartao-na-entrega"
  valor: number
  em: string
  por?: string
  recebido?: number
  troco?: number
  cartao?: CartaoPagamento
  itens?: string[]
}
export type DescontoConta = { modo: "reais" | "percentual"; valor: number; motivo: string }
// TipoEventoComanda ganha: "pagamento" | "pagamento-estornado" | "fechada" | "desconto" | "cortesia"
//                          | "taxa-removida" | "couvert-removido" | "pre-conta" | "reaberta"
// ItemPedido ganha: cortesia?: { motivo: string }
// Pedido ganha: pagamentos?: PagamentoConta[]; descontoConta?: DescontoConta
//   taxaServico?: { percentual: number; removida?: { motivo: string } }
//   couvert?: { porPessoa: number; removido?: { motivo: string } }

// lib/admin/regras/conta.ts
export const emCentavos: (reais: number) => number
export function taxaSobre(base: number, percentual: number): number // 87.45, 10 → 8.75
export type ResumoConta = {
  itens: number; cortesias: number; descontos: number; baseDaTaxa: number
  taxa: number; couvert: number; total: number; pago: number; saldo: number
}
export function resumoDaConta(pedido: Pick<Pedido, "itens" | "mesa" | "taxaServico" | "couvert" | "descontoConta" | "pagamentos">): ResumoConta
export function comTotais(pedido: Pedido): Pedido
export function valorDoDesconto(desconto: DescontoConta | undefined, base: number): number
export function erroDoDesconto(desconto: DescontoConta, base: number): string | null
export function dividirIgualmente(valor: number, partes: number): number[] // (100, 3) → [33.33, 33.33, 33.34]
export function valorDosItens(pedido: Pedido, itemIds: string[]): number
export function itensPagos(pedido: Pick<Pedido, "pagamentos">): Set<string>
export function pagamentosDoPedido(pedido: Pedido): Pick<PagamentoConta, "forma" | "valor" | "em" | "cartao" | "troco">[]
export function pagoNoDiaSemTaxa(pedido: Pedido, dia: Date): number

// lib/admin/regras/rotulos.ts
export function rotuloPagamentoDoPedido(pedido: Pedido): string // "Misto"
export function rotuloDoPagamento(pagamento: Pick<PagamentoConta, "forma" | "cartao">): string // "Cartão de crédito"

// lib/admin/regras/dashboard/resumo.ts: Resumo ganha `taxaServico: number`; `pagamentos` soma por parte

// servidor (api.mesas):
pagar(pedidoId, { forma, valor?, recebido?, cartao?, itens?, por? }): Promise<Pedido>
estornarPagamento(pedidoId, pagamentoId, { motivo, por? }): Promise<Pedido>
descontar(pedidoId, { modo, valor, motivo, por? }): Promise<Pedido>
darCortesia(pedidoId, itemId, { motivo, por? }): Promise<Pedido>
tirarTaxa(pedidoId, { motivo, por? }): Promise<Pedido>
tirarCouvert(pedidoId, { motivo, por? }): Promise<Pedido>
imprimirPreConta(pedidoId, por?): Promise<Pedido>
ultimaConta(mesaId): Promise<Pedido | null> // a que pode ser reaberta agora
reabrir(pedidoId, { motivo, por? }): Promise<Pedido>
// fecharConta(pedidoId, forma) = pagar o saldo; pedidos.marcarPago recusa a comanda de mesa aberta

// consultas-mesas: usePagar, useEstornarPagamento, useDescontar, useDarCortesia, useTirarTaxa,
//                  useTirarCouvert, useImprimirPreConta, useUltimaConta, useReabrirConta
```

**Arquivos**

- Criar:
  - `lib/admin/regras/conta.ts` e `conta.test.ts`;
  - `lib/admin/dados/servidor-conta.test.ts` (os testes de servidor desta fase);
  - `components/admin/mesas/conta-mesa.tsx` (aba Conta, dividir e por item), `receber-conta.tsx`, `motivo-conta.tsx` (janela de motivo), `impressao-conta.tsx` (pré-conta e comprovante) e `conta-mesa.test.tsx`.
- Mudar:
  - `lib/admin/dados/tipos.ts`, `servidor.ts`, `gerar-pedidos.ts` (e o teste), `consultas-mesas.ts` (e o teste);
  - `lib/admin/regras/{rotulos,indicadores-salao}.ts`, `lib/admin/regras/dashboard/resumo.ts` e os seus testes;
  - `components/admin/mesas/comanda-mesa.tsx`, `components/admin/pedidos/{detalhes-pedido,lista-pedidos}.tsx`, `components/admin/visao-geral/painel-visao-geral.tsx`;
  - `tests/admin.spec.ts`.

### Task 34 (Tarefa 34): regras da conta

**Entrega:** `lib/admin/regras/conta.ts`, sem servidor nem tela.

- [ ] Testes que falham em `conta.test.ts`, um comportamento por vez:
  - `taxaSobre(87.45, 10)` = 8,75; `taxaSobre(100, 12.5)` = 12,50; `taxaSobre(0.05, 10)` = 0,01;
  - `resumoDaConta`: itens R$ 87,45 (uma cortesia de R$ 5,00 dentro), desconto de R$ 10,00, taxa de 10% e couvert de R$ 8,00 para 2 pessoas, com R$ 30,00 pago: itens 87,45, cortesias 5, descontos 10, base 72,45, taxa 7,25, couvert 16, total 95,70, pago 30, saldo 65,70;
  - taxa e couvert tirados não somam; comanda sem os campos (base antiga) não tem taxa, couvert nem pagamentos;
  - desconto de 10% sobre 72,45 = 7,25; `erroDoDesconto` recusa acima dos itens, sem motivo e % acima de 100;
  - `dividirIgualmente(100, 3)` → `[33.33, 33.33, 33.34]`; `(10, 4)` → `[2.5, 2.5, 2.5, 2.5]`; `(0.02, 3)` → `[0, 0, 0.02]`;
  - `valorDosItens` soma os itens marcados com a taxa deles (R$ 40,00 com 10% → 44,00), sem as cortesias;
  - `pagamentosDoPedido` da comanda paga sem `pagamentos` devolve um pagamento único do total no `pagoEm`; a não paga, nada;
  - `pagoNoDiaSemTaxa`: total 110 com taxa 10, pago 55 hoje e 55 ontem → 50 hoje; a paga às 00:10 conta no dia do pagamento.
- [ ] Implementar e fazer o commit `feat(mesas): regras da conta (taxa, couvert, desconto, divisão e pagamentos)`.

### Task 35 (Tarefa 35): taxa e couvert congelados e o total da comanda

- [ ] Testes que falham em `servidor-conta.test.ts` (lanchonete de teste com taxa de 10% e couvert de R$ 8,00 ligados):
  - abrir a mesa para 2 pessoas guarda `taxaServico: { percentual: 10 }` e `couvert: { porPessoa: 8 }`; lançar R$ 23,00 deixa o total em R$ 41,30 (23 + 2,30 + 16);
  - mudar o salão depois (taxa 15%, couvert desligado) não muda a conta aberta;
  - lançar na mesa livre (pelo Garçom) também congela, com 1 pessoa;
  - com a taxa e o couvert desligados, a comanda nasce sem os campos.
- [ ] Ajustar a montagem de `mesaOcupada` em `pagina-mesas.test.tsx` para desligar taxa e couvert da pizzaria antes de lançar: os testes de lá conferem a soma dos itens (mudança planejada, decorrência 3).
- [ ] Implementar (`comTotais` no lugar de `recalcular`) e fazer o commit `feat(mesas): taxa e couvert congelados na abertura da comanda`.

### Task 36 (Tarefa 36): pagar contra o saldo

- [ ] Testes que falham em `servidor-conta.test.ts`, com a comanda de R$ 100,00 (sem taxa):
  - Pix de R$ 33,33: saldo 66,67, comanda aberta, evento "Pix R$ 33,33";
  - misto: Pix 33,33 e dinheiro 66,67 recebendo 80: troco 13,33, a comanda fecha (`concluido`, `pago`, `pagoEm`), evento `fechada`, `pagamento: "dinheiro"` (o maior) e sem `trocoPara`;
  - cartão sem crédito ou débito recusa; com crédito, guarda `cartao: "credito"`;
  - Pix de R$ 100,01 recusa com "O valor passa do saldo de R$ 100,00."; dinheiro de R$ 150,00 fecha com valor 100 e troco 50; valor zero recusa;
  - por item: o item de R$ 40,00 numa conta com 10% paga 44,00 e marca o item; pagar o mesmo item de novo recusa;
  - a conta fechada pelo último pagamento deixa a mesa em limpeza (limpeza ligada) e livre sem ela;
  - `fecharConta` paga o saldo inteiro e registra o pagamento;
  - `pedidos.marcarPago` na comanda de mesa aberta recusa com "Receba a conta pela tela de Mesas.".
- [ ] Mudar o teste de `detalhes-pedido.test.tsx` que marcava como pago, se ele usar comanda de mesa aberta (não usa: é entrega). Implementar e fazer o commit `feat(mesas): pagamentos contra o saldo, com troco, cartão e por item`.

### Task 37 (Tarefa 37): desconto, cortesia, taxa, couvert e estorno no servidor

- [ ] Testes que falham em `servidor-conta.test.ts`:
  - desconto de R$ 10,00 com motivo muda o total e grava o evento; de 10% guarda o modo; sem motivo e acima dos itens recusam; zero tira;
  - cortesia no Refri: o total cai 6, o estoque continua 3 (não devolve), o evento leva o motivo; cortesia de novo recusa;
  - tirar a taxa e o couvert com motivo; sem motivo recusa; comanda sem taxa recusa;
  - com R$ 30,00 pago numa conta de R$ 40,00, desconto de R$ 15,00 recusa com "A conta ficaria menor que o já pago. Estorne um pagamento antes.";
  - estornar o Pix devolve o saldo e grava "Estornou Pix R$ 33,33"; sem motivo recusa.
- [ ] Implementar e fazer o commit `feat(mesas): desconto, cortesia, tirar taxa e couvert, e estornar pagamento`.

### Task 38 (Tarefa 38): pré-conta e reabrir no servidor

- [ ] Testes que falham em `servidor-conta.test.ts`:
  - `imprimirPreConta` marca `contaPedidaEm` e grava `pre-conta`; imprimir de novo mantém a primeira hora;
  - reabrir a conta fechada hoje (mesa em limpeza): a comanda volta aberta com os pagamentos, a mesa ocupada e sem limpeza, evento `reaberta` com o motivo;
  - sem motivo recusa; no dia seguinte recusa; com a mesa já aberta de novo recusa; a penúltima conta da mesa recusa;
  - virada do dia: aberta às 23:40 e paga às 00:10, reabre às 00:30 e recusa no dia seguinte às 00:30;
  - `ultimaConta` devolve a última conta fechada hoje da mesa livre, e `null` para a mesa ocupada ou sem conta hoje.
- [ ] Implementar e fazer o commit `feat(mesas): pré-conta marca pediu a conta; reabrir a última conta do dia`.

### Task 39 (Tarefa 39): demonstração com conta paga em parte e conta fechada hoje

- [ ] Testes que falham em `gerar-pedidos.test.ts`:
  - uma comanda aberta tem um pagamento parcial em Pix (metade do total, há 5 min);
  - uma comanda de mesa foi fechada hoje, há 20 min, em Pix e dinheiro (Misto), com `pagamentos` somando o total;
  - as comandas de hoje levam a taxa e o couvert do salão (pizzaria: 10% e R$ 8,00), e o total bate com `resumoDaConta`.
- [ ] Mudar o teste antigo de `pagina-mesas.test.tsx` "a faixa Números do salão mostra os quatro números da demonstração": a demonstração passa a ter a conta fechada hoje (pendência da Fase 2), e o faturamento deixa de ser R$ 0,00.
- [ ] Implementar e fazer o commit `feat(mesas): a demonstração tem conta paga em parte e conta fechada hoje`.

### Task 40 (Tarefa 40): faturamento por parte, Misto e taxa separada

- [ ] Testes que falham:
  - `indicadores-salao.test.ts`: o faturamento soma os pagamentos de hoje sem a taxa (inclusive o parcial de uma comanda aberta); a comanda aberta às 23:40 e paga às 00:10 entra no dia do pagamento; o ticket por pessoa conta só as fechadas, sem a taxa;
  - `rotulos.test.ts`: `rotuloPagamentoDoPedido` dá "Misto" com Pix e dinheiro, "Pix" com dois Pix e a forma do pedido sem `pagamentos`; `rotuloDoPagamento` dá "Cartão de crédito" e "Cartão de débito";
  - `resumo.test.ts`: o pedido de R$ 100,00 pago 40 em Pix e 60 em dinheiro soma 40 no Pix e 60 no dinheiro; `taxaServico` soma a taxa do período.
- [ ] Implementar e fazer o commit `feat(mesas): faturamento por parte, Misto e taxa de serviço separada`.

### Task 41 (Tarefa 41): hooks da conta

- [ ] Testes que falham em `consultas-mesas.test.tsx`: `usePagar`, `useDescontar`, `useDarCortesia`, `useTirarTaxa`, `useTirarCouvert`, `useEstornarPagamento`, `useImprimirPreConta` e `useReabrirConta` chegam ao servidor e guardam a comanda; `useUltimaConta` lê a conta que pode ser reaberta.
- [ ] Implementar e fazer o commit `feat(mesas): hooks da conta`.

### Task 42 (Tarefa 42): aba Conta, receber e dividir na tela

- [ ] Testes que falham em `conta-mesa.test.tsx` (pizzaria):
  - a aba Conta mostra o resumo com taxa e couvert, o total e o saldo;
  - "Fechar conta" abre "Receber da mesa N" com o saldo; Pix recebe tudo e a mesa fica em Limpeza;
  - dinheiro: "Valor recebido" sugere as notas de `sugestoesDeTroco` e mostra o troco;
  - cartão pede crédito ou débito;
  - "Dividir igualmente" em 3 mostra as partes e "Receber" de uma parte abre com o valor dela; o pagamento aparece na lista e o saldo cai;
  - "Por item" soma os itens marcados com a taxa.
- [ ] Mudar o teste antigo "imprimir a conta e fechar com a forma de pagamento…" de `pagina-mesas.test.tsx`: "Imprimir pré-conta" e a janela "Receber da mesa 60" (mudança planejada).
- [ ] Implementar `conta-mesa.tsx` e `receber-conta.tsx`. Commit `feat(mesas): aba Conta com pagamentos, saldo, receber e dividir`.

### Task 43 (Tarefa 43): desconto, cortesia, taxa, couvert e estorno na tela

- [ ] Testes que falham em `conta-mesa.test.tsx`: "Desconto" com motivo muda o total; "Cortesia" no item com motivo mostra "Cortesia"; "Tirar taxa" e "Tirar couvert" pedem motivo e somem do resumo; "Estornar" pede motivo e devolve o saldo; o erro do servidor aparece no aviso.
- [ ] Implementar `motivo-conta.tsx` e os botões. Commit `feat(mesas): desconto, cortesia, tirar taxa e couvert e estornar pela tela`.

### Task 44 (Tarefa 44): pré-conta, comprovante e reabrir na tela

- [ ] Testes que falham:
  - `impressao-conta` (em `conta-mesa.test.tsx`): a pré-conta tem itens, cortesia, desconto, taxa com o %, couvert com as pessoas, total, pagamentos, saldo e o valor por pessoa; o comprovante tem a forma, o valor, o troco e o saldo;
  - "Imprimir pré-conta" imprime e deixa o cartão em "Pediu a conta";
  - a gaveta da mesa em Limpeza com a conta fechada hoje mostra "Reabrir a conta"; com o motivo, a comanda volta com os pagamentos.
- [ ] Implementar `impressao-conta.tsx` e o reabrir. Commit `feat(mesas): pré-conta e comprovante em 80 mm; reabrir a conta`.

### Task 45 (Tarefa 45): Pedidos e Início

- [ ] Testes que falham:
  - `detalhes-pedido.test.tsx`: a comanda paga em Pix e dinheiro mostra "Misto" e cada pagamento, com o troco; os totais mostram a taxa de serviço e o couvert; a comanda de mesa aberta não tem "Marcar como pago" e mostra "Receba pela tela de Mesas.";
  - `lista-pedidos.test.tsx`: a coluna de pagamento diz "Misto";
  - a aba Financeiro do Início mostra "Taxa de serviço".
- [ ] Implementar e fazer o commit `feat(pedidos): Misto, pagamentos, taxa e couvert; Início com a taxa separada`.

### Task 46 (Tarefa 46): E2E e fechamento

- [ ] Em `tests/admin.spec.ts`: na pizzaria, abrir a mesa 11 com 2 pessoas, lançar um item, dividir por 3, receber uma parte em Pix e o resto em dinheiro com troco, e ver "Misto" no pedido em Pedidos.
- [ ] `pnpm check`, mostrando a saída. `pnpm test:coverage` e subir os mínimos se a cobertura subiu.
- [ ] O E2E rápido e os screenshots (`painel-mesas-*`, `painel-comanda-*` e os de Pedidos e Início) ficam para a revisão.
- [ ] Registrar a "Situação" no fim desta seção.

Situação: pronta em 22/11/2026, na branch `claude/admin-mesas-fase-4`, empilhada sobre a Fase 3, depois da revisão. O PR sai depois que as Fases 1 a 3 estiverem no `main`.

- **O que a revisão pegou** (cada correção com o teste vermelho antes):
  - a conta com saldo zero não fechava: tudo em cortesia, desconto que iguala o já pago e a conta reaberta sem mudança ficavam em "Receber R$ 0,00" desabilitado. Agora `fecharConta` fecha sem pagamento quando não há saldo, a mudança que zera o saldo de uma conta paga em parte fecha sozinha, e receber sem saldo recusa (antes gravava pagamento de R$ 0,00 com troco). O rodapé usa `useFecharConta`, que estava sem uso;
  - recarregar a página no dia seguinte dava como paga a conta de mesa aberta (o `encerrar` da virada do dia). Agora a comanda que alguém mexeu (tem histórico) continua aberta, e a demonstração do dia novo não senta ninguém na mesa dela (`mesasOcupadas` em `gerarPedidos`). Só a comanda da demonstração, intocada, fecha sozinha, e a paga em parte recebe o resto na forma dela: a demonstração não fica com comanda de ontem pendurada;
  - o troco da tela e o gravado diferiam com a parte acima do saldo: os dois usam `trocoDoPagamento`;
  - "Mais um" no item em cortesia ou já pago por item: o servidor recusa ("Lance o item de novo.") e a tela esconde o botão;
  - o comprovante de um pagamento antigo mostrava o saldo de agora (`saldoDepoisDe`);
  - cancelar a comanda com pagamento sumia com o dinheiro: recusa com "Estorne os pagamentos antes.";
  - o Início somava a taxa no faturamento (Q34; ver "Início" nas decisões, já atualizado);
  - tirar o desconto não tinha tela nem histórico: "Tirar desconto", com motivo, e o evento "Tirou o desconto";
  - testes que recalculavam o esperado com a própria regra (`indicadoresSalao`, `resumoDaConta`) ou trocavam valores por "não é —": agora com valores literais, conferidos à mão (o teste da conta fechada hoje volta a conferir os tickets);
  - menores: a mensagem quando o desconto passaria dos itens ("O desconto passaria do valor dos itens. Tire ou diminua o desconto antes.", em vez de "menor que o já pago"); a comanda paga antes da Fase 4 reaberta grava o pagamento que teve (`pagamentosDoPedido`); valor recebido com fração de centavo é recusado; em Pedidos, a comanda aberta paga em parte numa forma diz essa forma, o filtro e a contagem por forma põem a conta Misto em cada forma que ela tem (`formasDoPedido`), e o "Reimprimir cupom" da conta de mesa mostra cortesias, desconto, taxa, couvert, Misto, cada pagamento e, na conta aberta, cobra o saldo; no Receber, o recebido menor que a parte e o valor acima do saldo avisam no campo; "Partes" fora de 2 a 20 avisa; "Por item" não perde a marcação ao fechar a janela; as partes já recebidas aparecem como "Recebida" (`partesRecebidas`).
- **Mudou fora do plano:**
  - o `rotuloDoPagamento` ("Cartão de crédito") entrou na Tarefa 36, porque o texto do evento de pagamento depende dele;
  - a previsão da tela (`useAlterarQuantidade`, `useRemoverItem`) passou a usar `comTotais`: sem isso, o total da comanda com taxa caía e voltava ao mudar a quantidade (teste novo em `consultas-mesas.test.tsx`, com o servidor sem responder);
  - "Marcar como pago" em Pedidos sai na comanda de mesa aberta, e o aviso junta os dois caminhos: "Receba ou cancele a conta pela tela de Mesas.";
  - a comanda aberta já soma o couvert, mesmo vazia;
  - "Por item" e "Dividir igualmente" só aparecem com saldo; as partes da divisão são do total;
  - na lista de definição do resumo, "Tirar taxa", "Tirar couvert" e "Tirar desconto" ficam dentro do `dd` (o axe do E2E recusou o botão solto);
  - a demonstração ganhou a conta fechada no roteiro ao vivo (há 20 min, aberta 90 min antes) e a parcial na comanda de 80 min. O sorteio do dia muda com isso: as pessoas no salão da pizzaria passam de 21 para 16, e os pedidos de hoje de todas as lojas mudam (por isso mudam também a fila, a cozinha, os motoboys e a pesagem do açougue);
  - **por item com desconto** (revisão): em vez de ratear o desconto entre os itens, o pagamento por item fica de fora quando a conta tem desconto ("Com desconto na conta, divida igualmente ou receba um valor.");
  - **Início e Mesas** (revisão): o faturamento do Início fica sem a taxa e conta as vendas pelo dia do pedido (inclusive a conta aberta); o de Mesas conta o que entrou no dia, pelo pagamento. Os dois batem na conta aberta e fechada no mesmo dia (teste em `resumo.test.ts`); a conta aberta paga em parte, e a que atravessa a meia-noite, contam diferente nas duas telas, de propósito.
- **Testes antigos que mudaram (mudança de comportamento planejada):**
  - `mesaOcupada` em `pagina-mesas.test.tsx`, dois testes de `consultas-mesas.test.tsx` e um de `pagina-garcom.test.tsx` desligam a taxa e o couvert da pizzaria na montagem: eles conferem a soma dos itens (decorrência 3);
  - "a faixa Números do salão…" e "a conta fechada hoje entra no faturamento…": a demonstração passou a ter conta fechada hoje; na revisão, os valores ficaram literais (R$ 159,00, R$ 42,00 e R$ 126,00; com a mesa 60, R$ 172,50, R$ 34,88 e R$ 69,75);
  - em `gerar-pedidos.test.ts`, a parcial (R$ 62,53 de R$ 125,07), a conta fechada (R$ 36,61 + R$ 36,61) e os totais das comandas de hoje da pizzaria passaram a valores literais;
  - "imprimir a conta e fechar…": "Imprimir pré-conta" e a janela "Receber da mesa 60";
  - "a comanda de mesa aberta não se cancela aqui": o aviso agora é "Receba ou cancele a conta pela tela de Mesas.";
  - E2E "salão: o garçom lança…": a janela é "Receber da mesa 90";
  - revisão: "reabrir a base em outro dia encerra a comanda aberta…" virou "…mantém a comanda aberta, e a mesa ocupada sem limpeza"; "desconto… zero tira o desconto" passa a pedir motivo e conferir o evento; em `resumo.test.ts`, a conta Misto ganhou `pagoEm` (a taxa conta pelo dia do pagamento).
- **Fica para depois:**
  - desfazer a cortesia;
  - ratear o desconto no pagamento por item (com o centavo na última parte);
  - diminuir um item já pago por item (hoje só o aumento é recusado);
  - o "Por item" da conta já paga em parte por valor mostra os itens a preço cheio (o servidor recusa quando passa do saldo);
  - a pré-conta não ganhou teste visual: ela só existe no papel (fica escondida na tela); o conteúdo tem teste de componente.
- **Screenshots** (revisados nas imagens esperada, atual e diferença, claro e escuro, celular e desktop, antes de atualizar):
  - mudaram pela Fase 4: `painel-comanda-*` (rodapé com saldo, "Imprimir pré-conta", "Cortesia" no item, a mesa 2 com a parcial), `painel-mesas-*` (totais com taxa e couvert, faturamento de R$ 159,00 e ticket de R$ 42,00), `painel-abrir-mesa-*`, `painel-adicionar-itens-*`, `painel-atalhos-mesas-*`, `painel-nova-mesa-*` e `painel-configurar-salao-*` (os números do salão por trás da janela), `painel-pedidos-*` (Misto, e Pix na comanda aberta paga em parte), `painel-visao-geral-*` (faturamento sem a taxa) e `painel-visao-geral-financeiro-*` (o aviso nas formas e a taxa de R$ 10,20);
  - mudaram pelo sorteio novo da demonstração (só dados, sem mudança de layout): `painel-fila-*`, `painel-cozinha-*`, `painel-motoboys-*`, `painel-pesagem-*`, `painel-visao-geral-vendas-*` e `painel-visao-geral-abas-rolada-*`;
  - entraram `painel-comanda-conta-*` (aba Conta com pagamento, partes e "Recebida") e `painel-receber-conta-*` (Receber em dinheiro com troco);
  - atualizados em `celular-390` e `desktop-1920` e gerados nos outros 9 tamanhos, com uma amostra de cada tamanho conferida.
- **Testes e cobertura:** 1550 testes no Vitest; 456 no E2E rápido (`celular-390` e `desktop-1920`, 28 pulados, nenhuma falha), contra o `next start` na porta 3011 (o `next dev` para no aviso de segurança do Next; atualizar o Next é decisão do usuário). A cobertura ficou em 84,03/76,94/82,49/85,09 no geral e 98,25/95,33/98,89/98,94 em `lib/**`: os mínimos subiram para 84/76/82/85 no geral; `lib/**` continua em 98/95/98/98.

## Fase 5: movimentações

**Desenho:** transferir, juntar e separar, transferir itens (com quantidade parcial), desfazer por 6 s, o ticket da cozinha "Mesa 3 + 4" e o cenário de demonstração com um par de mesas juntadas.

**Fronteiras de teste**

1. **Servidor:**
   - transferir para mesa livre (recusa ocupada e bloqueada, e pede confirmação em reservada);
   - juntar com e sem comanda nas secundárias (os itens migram, as pessoas somam e as rodadas são mantidas);
   - separar;
   - transferir 1 de 3 unidades divide a linha;
   - o estoque não muda;
   - duas abas: a operação sobre uma comanda que acabou de fechar é recusada;
   - desfazer dentro de 10 s, e recusa se algo mudou depois.
2. **`lib/admin/regras/cozinha.ts`:** o rótulo "Mesa 3 + 4".
3. **Componentes:** fluxos de transferir, juntar e transferir itens, e o aviso com "Desfazer".
4. **E2E:** juntar duas mesas, ver na cozinha e desfazer.

**Branch:** `claude/admin-mesas-fase-5`, empilhada sobre as Fases 1 a 4. O PR vai para `main` depois delas.

**Decisões de detalhe desta fase** (decorrem de Q7, Q18, Q38, Q46 e da decorrência 2)

- **Onde mora a junção:** na comanda da principal, em `Pedido.mesa.juntadas` (`{ id, numero }[]`, pelo número). A mesa secundária não tem comanda: fica `status: "livre"` sem `pedidoAtivoId`, e `abrirMesas` (que já refaz as mesas pelas comandas abertas) põe nela o `juntadaCom` da principal. É uma fonte só: quando a conta da principal fecha ou é cancelada, as secundárias voltam sozinhas. Com a limpeza ligada, fechar a conta põe a principal **e** as secundárias em Limpeza.
- **A secundária aponta para a comanda da principal** (`comandaDa` procura também nas `juntadas`): lançar na mesa 16 (pelo Garçom) entra na comanda da 15; abrir, bloquear, excluir e mudar o número da 16 recusam como numa mesa aberta. Na grade, o cartão diz "Com a mesa 15", o toque e "Abrir comanda" abrem a gaveta da principal, e o filtro de garçom acha a secundária pelo garçom da principal.
- **Só a principal com comanda junta:** juntar parte de uma comanda aberta (a mesa livre se abre antes). Recusa:
  - a própria mesa ("Escolha outra mesa."), mesa bloqueada ("A mesa 20 está bloqueada."), mesa já junta a outra ("A mesa 16 já está junto com a mesa 15.") e mesa reservada dentro da antecedência ("A mesa 5 está reservada às 20:45."; juntar com confirmação fica para a Fase 7);
  - secundária que já é principal de outras ("Separe as mesas da mesa 5 antes de juntar.") ou com desconto na conta ("Tire o desconto da mesa 5 antes de juntar.": os dois descontos não se somam);
  - as duas com rodada na cozinha ("A cozinha está com rodadas das mesas 3 e 5. Junte depois que uma ficar pronta.").
- **Como as contas se combinam ao juntar** (`juntarComandas`, pura, em `lib/admin/regras/movimentacoes.ts`):
  - itens, cortesias e pagamentos da secundária passam para a principal com os mesmos ids (o pagamento por item continua batendo);
  - as rodadas são mantidas e renumeradas: a que está na cozinha fica por último, para a cozinha continuar vendo só ela; sem nenhuma na cozinha, as da secundária vêm depois das da principal. O status é o da comanda que ficou por último. Cada item guarda o `vaiParaCozinha` que tinha (a comanda junta liga `enviarParaCozinha` se uma das duas ligava);
  - as pessoas somam; `servirDesde` e `contaPedidaEm` ficam com a hora mais antiga das duas;
  - **taxa e couvert passam a ser os da principal** (congelados na abertura dela), sobre a conta inteira, e o couvert multiplica as pessoas somadas. A taxa ou o couvert tirados na secundária deixam de valer. Se a conta junta ficasse menor que o já pago (a secundária pagou com taxa e a principal não tem), recusa com "A conta ficaria menor que o já pago. Estorne um pagamento antes.";
  - o histórico da secundária entra no da principal, na ordem da hora, com o texto prefixado ("Mesa 5: Mesa aberta para 2 pessoas"), e a comanda da secundária **sai de Pedidos**: ela não foi cancelada, virou parte da principal. O evento `juntada` diz "Juntou a mesa 5: 2× Coca, 1× Pizza" (ou "Juntou a mesa 16", sem comanda).
- **Separar:** solta todas as secundárias de uma vez (voltam livres); itens, pessoas e pagamentos ficam na principal. Evento `separada`: "Separou a mesa 16" ou "Separou as mesas 4 e 5". Sem junção, recusa "A mesa 3 não está junto com outra.".
- **Transferir mesa:** leva a comanda para uma mesa livre (ou em Limpeza, que sai da limpeza). Recusa a própria mesa, a bloqueada, a aberta ("A mesa 7 já está aberta. Junte as mesas ou transfira os itens."), a secundária ("A mesa 16 está junto com a mesa 15.") e a comanda com junção ("Separe as mesas antes de transferir."). Mesa reservada dentro da antecedência pede `confirmarReserva` ("A mesa 7 está reservada às 20:45. Confirme para transferir."; a confirmação na tela chega com as reservas, na Fase 7). A mesa de origem fica livre, **sem** limpeza: como na Fase 4, só fechar a conta põe a mesa em limpeza. Evento `transferida`: "Transferida da mesa 3 para a mesa 7".
- **Transferir itens:** escolhe os itens e a quantidade de cada um (1 a 3 de 3 unidades) e a mesa de destino (livre, em limpeza ou aberta; a secundária leva para a principal dela). Parte de uma linha divide a linha: a origem fica com o resto e o destino ganha uma linha nova, com o mesmo preço unitário. Na mesa livre, abre a comanda com o garçom da origem, 1 pessoa e a taxa e o couvert do salão de agora (é uma comanda nova). Recusa:
  - o item pago por item ("Esse item já foi pago.") e o item da rodada que a cozinha ainda tem, em "recebido" ou "em preparo" ("A cozinha ainda está com Calabresa. Transfira quando ficar pronta."): a cozinha não muda a mesa de um ticket no meio do preparo;
  - destino igual à origem ou do mesmo grupo de juntadas ("Escolha outra mesa."), bloqueado, ou reservado sem `confirmarReserva`;
  - a origem que ficaria menor que o já pago, ou com o desconto acima dos itens (as mensagens da Fase 4).

  O item que chega guarda `transferido: { daMesa, preparado }`: a cozinha do destino não o vê como rodada nova, e tirá-lo pede motivo (e vira perda) se ele já estava preparado na origem. Receber itens limpa o "Pediu a conta" do destino, como lançar (Q23). Eventos `itens-transferidos`: "Transferiu 1× Coca para a mesa 7" na origem e "Recebeu 1× Coca da mesa 3" no destino.
- **Estoque (Q38):** transferir, juntar, separar e transferir itens gravam as comandas direto, sem `aplicarEstoque`: nenhum movimento novo. A venda continua no estoque uma vez só, agora na comanda onde o item está.
- **Duas abas (ponto de atenção 2):** cada aba tem o seu servidor, com a base em memória. As movimentações e o desfazer **releem a base guardada** antes de mudar (`reler`), e partem do `pedidoId` que a tela mostrava, não da mesa: transferir a comanda que outra aba acabou de fechar recusa com "A comanda da mesa 3 não está mais aberta. Atualize a tela.", sem criar nem duplicar comanda. As outras operações continuam na base em memória (a sincronia entre abas é da Fase 8, com o `BroadcastChannel`).
- **Desfazer (Q46, decorrência 2):** transferir, juntar, separar, transferir itens e marcar limpa devolvem, além do resultado, o id de uma **foto** que o servidor guarda em memória por **10 s**: as mesas e comandas envolvidas antes e depois. `desfazer(id)` relê a base; se as mesas e comandas da foto continuam iguais ao "depois", volta o "antes" (a comanda que a operação criou sai; a que ela tirou de Pedidos volta no lugar pelo id; a limpeza volta) e a foto some. Se algo mudou, recusa com "A mesa mudou depois disso. Desfaça pela comanda."; passado o prazo (ou já desfeita), "O tempo para desfazer acabou.". O desfazer volta o estado como era, sem evento: a movimentação some do histórico. A tela mostra o aviso com "Desfazer" por **6 s**.
- **Cozinha (Q33):** o ticket da comanda junta diz "Mesa 15 + 16" (`rotuloDaMesa`).
- **Grade e menu ⋯ (Q41):** "Juntada" volta ao filtro de estado (depois de "Pediu a conta"). O menu ⋯ da mesa aberta ganha "Transferir" e "Juntar mesas" e, com junção, "Separar"; a secundária oferece "Abrir comanda" (a da principal) e "Separar". Na gaveta, a descrição diz "Junto com a mesa 16", e a aba Itens ganha "Transferir itens". "Marcar limpa" (menu e gaveta) passa a avisar com "Desfazer".
- **Demonstração:** a comanda mais nova do roteiro ao vivo senta na **mesa 15, junta com a 16** (as duas retangulares de 6 lugares da Varanda). Ela deixa de ocupar a mesa 8, que fica livre; as pessoas continuam sorteadas pelos lugares da principal. Sem sorteio novo: o resto da demonstração não muda, mas a ocupação passa a contar a 16 ("9/19 · 47%") e a grade tem 9 livres. Na virada do dia, a demonstração do dia novo também não senta ninguém nas secundárias de uma comanda que continuou aberta.

**Interfaces que a Fase 5 entrega**

```ts
// lib/admin/dados/tipos.ts
// Pedido.mesa ganha: juntadas?: { id: string; numero: number }[]
// ItemPedido ganha: transferido?: { daMesa: number; preparado: boolean }
// TipoEventoComanda ganha: "transferida" | "juntada" | "separada" | "itens-transferidos"

// lib/admin/regras/cozinha.ts
export function rotuloDaMesa(pedido: Pick<Pedido, "mesa">): string // "Mesa 15 + 16"
// itensDaCozinha deixa de fora o item transferido; cozinhaJaPreparou lê `transferido.preparado`

// lib/admin/regras/movimentacoes.ts
export function numerosEmTexto(numeros: number[]): string // [4, 5, 6] → "4, 5 e 6"
export function porQueNaoTransfere(comanda: Pedido, item: ItemPedido): string | null
export function separarQuantidade(item: ItemPedido, quantidade: number, novoId: string): {
  fica: ItemPedido | null
  vai: ItemPedido
}
export function porQueNaoJunta(principal: Pedido, secundaria: Pedido): string | null
export function juntarComandas(principal: Pedido, secundaria: Pedido): Pedido // sem o evento

// servidor (api.mesas). Toda movimentação devolve `desfazer`: o id da foto.
transferir(pedidoId, mesaDestinoId, { confirmarReserva?, por? }): Promise<{ comanda: Pedido; desfazer: string }>
juntar(pedidoId, mesaIds: string[], { por? }): Promise<{ comanda: Pedido; desfazer: string }>
separar(pedidoId, { por? }): Promise<{ comanda: Pedido; desfazer: string }>
transferirItens(pedidoId, {
  mesaDestinoId, itens: { itemId: string; quantidade: number }[], confirmarReserva?, por?
}): Promise<{ comanda: Pedido; destino: Pedido; desfazer: string }>
marcarLimpa(id): Promise<{ mesa: Mesa; desfazer: string }> // antes devolvia a mesa
desfazer(id: string): Promise<void>

// consultas-mesas: useTransferirMesa, useJuntarMesas, useSepararMesas, useTransferirItens, useDesfazer
// components/admin/mesas/aviso-desfazer.ts: useAvisoComDesfazer() → (texto, desfazer) => void
```

**Arquivos**

- Criar:
  - `lib/admin/regras/movimentacoes.ts` e `movimentacoes.test.ts`;
  - `lib/admin/dados/servidor-movimentacoes.test.ts` (os testes de servidor desta fase);
  - `components/admin/mesas/aviso-desfazer.ts`, `transferir-mesa.tsx`, `juntar-mesas.tsx`, `transferir-itens.tsx` e `movimentacoes.test.tsx`.
- Mudar:
  - `lib/admin/dados/tipos.ts`, `servidor.ts`, `gerar-pedidos.ts` (e o teste), `consultas-mesas.ts` (e o teste);
  - `lib/admin/regras/cozinha.ts` (e o teste);
  - `components/admin/mesas/{pagina-mesas,cartao-mesa,comanda-mesa,estado-grade}.tsx` e `components/admin/cozinha/ticket-cozinha.tsx`;
  - `tests/admin.spec.ts`.

### Task 47 (Tarefa 47): "Mesa 15 + 16" e o item transferido na cozinha

- [ ] Testes que falham em `cozinha.test.ts`:
  - `rotuloDaMesa`: "Mesa 3" sem junção, "Mesa 15 + 16" com uma, "Mesa 3 + 4 + 5" com duas;
  - o item com `transferido` não entra em `itensDaCozinha` e não muda a rodada atual; `cozinhaJaPreparou` dá `true` para `transferido.preparado` e `false` sem ele, qualquer que seja o status.
- [ ] Teste que falha em `pagina-cozinha.test.tsx`: o ticket da comanda com `juntadas` diz "Mesa 15 + 16".
- [ ] Implementar (tipos novos em `tipos.ts`) e fazer o commit `feat(mesas): a cozinha mostra Mesa 15 + 16 e ignora o item transferido`.

### Task 48 (Tarefa 48): regras das movimentações

- [ ] Testes que falham em `movimentacoes.test.ts`, um comportamento por vez:
  - `numerosEmTexto`: "4", "4 e 5", "4, 5 e 6";
  - `separarQuantidade`: 1 de 3 Cocas de R$ 6,00 → fica 2 (R$ 12,00) e vai 1 (R$ 6,00) com o id novo; 3 de 3 → não fica nada e vai a linha com o id dela;
  - `porQueNaoTransfere`: o item pago por item, o da rodada em "recebido" e em "em preparo" recusam; o da rodada anterior, o da comanda pronta e o sem cozinha passam;
  - `porQueNaoJunta`: secundária com junção, com desconto, e as duas na cozinha;
  - `juntarComandas`: itens, pagamentos e pessoas somados; taxa e couvert da principal; a secundária na cozinha fica por último (rodadas 1 e 2 da principal, a 1 e a 2 da secundária viram 3 e 4, status "recebido"); a principal na cozinha fica por último (as da principal são renumeradas); `servirDesde` e `contaPedidaEm` mais antigos; eventos da secundária prefixados, na ordem da hora; `juntadas` pelo número; o `total` refeito (R$ 40,00 + R$ 20,00 com 10% e couvert de R$ 8,00 para 2 + 3 pessoas: R$ 106,00).
- [ ] Implementar e fazer o commit `feat(mesas): regras de juntar comandas, dividir a linha e o que pode ser transferido`.

### Task 49 (Tarefa 49): transferir a mesa e desfazer no servidor

- [ ] Testes que falham em `servidor-movimentacoes.test.ts` (lanchonete de teste com Refri e Bacon no estoque, como em `servidor-comanda.test.ts`):
  - transferir a comanda da mesa 30 para a 31: a comanda vai com os mesmos itens e total, a 31 fica ocupada, a 30 livre sem limpeza, o evento `transferida` com o garçom, e o estoque e o histórico do estoque não mudam;
  - a 31 em limpeza sai da limpeza;
  - recusas: a própria mesa, a bloqueada, a aberta, a inexistente e a comanda com junção (esta, montada direto na base guardada);
  - reservada às 20:45 (agora 20:30) recusa sem `confirmarReserva` e transfere com ela;
  - duas instâncias de `criarServidor` sobre o mesmo IndexedDB: a segunda fecha a conta, e a primeira (com a base em memória de antes) recusa a transferência com "A comanda da mesa 30 não está mais aberta. Atualize a tela.", sem comanda nova em Pedidos e com a 31 livre;
  - desfazer em 9 s volta a comanda para a 30 (a 31 livre de novo, sem o evento); em 11 s recusa com "O tempo para desfazer acabou."; desfazer duas vezes recusa na segunda;
  - desfazer depois de lançar na comanda recusa com "A mesa mudou depois disso. Desfaça pela comanda.";
  - desfazer devolve a limpeza que a 31 tinha.
- [ ] Implementar `reler`, `mover` (a foto) e `desfazer`. Commit `feat(mesas): transferir a mesa, com desfazer por 10 s e a base relida`.

### Task 50 (Tarefa 50): juntar e separar no servidor

- [ ] Testes que falham em `servidor-movimentacoes.test.ts`:
  - juntar a 31 livre à 30 aberta: a 31 fica `livre` com `juntadaCom` da 30, sem `pedidoAtivoId`; a comanda ganha `juntadas` e o evento "Juntou a mesa 31";
  - juntar a 31 aberta (2 Refris, 2 pessoas, um Pix de R$ 6,00) à 30 (1 X-Burger, 3 pessoas): a comanda da 31 sai de Pedidos, a da 30 fica com os 2 itens, 5 pessoas, o pagamento, o evento com os itens, e o estoque não muda;
  - recusas das decisões, uma por teste;
  - lançar na 31 junta entra na comanda da 30; abrir, bloquear e excluir a 31 recusam;
  - fechar a conta da 30 libera as duas e põe as duas em Limpeza;
  - separar: a 31 volta livre, os itens ficam na 30, evento "Separou a mesa 31"; sem junção recusa;
  - desfazer o juntar devolve a comanda da 31 a Pedidos, com o mesmo id, e as duas comandas como eram;
  - desfazer o separar junta de novo.
- [ ] Implementar e fazer o commit `feat(mesas): juntar e separar mesas, com as contas somadas na principal`.

### Task 51 (Tarefa 51): transferir itens no servidor

- [ ] Testes que falham em `servidor-movimentacoes.test.ts`:
  - transferir 1 de 3 Refris da 30 para a 31 livre: a 30 fica com 2 (R$ 12,00), a 31 abre com 1 (R$ 6,00), 1 pessoa e o garçom da 30, os eventos dos dois lados, e o estoque (2) não muda;
  - transferir para a 32 aberta acrescenta na comanda dela e limpa o "Pediu a conta";
  - transferir para a 31 secundária leva para a comanda da principal dela;
  - o item preparado chega com `transferido: { daMesa: 30, preparado: true }`, e tirá-lo no destino sem motivo recusa; o Refri sem cozinha chega com `preparado: false` e sai sem motivo, devolvendo o estoque;
  - recusas: sem itens, quantidade 0 ou acima da linha, o item na cozinha, o item pago, a mesma mesa, a bloqueada, a origem que ficaria menor que o já pago;
  - desfazer devolve a linha inteira à 30 e tira a comanda criada na 31.
- [ ] Implementar e fazer o commit `feat(mesas): transferir itens, com quantidade parcial`.

### Task 52 (Tarefa 52): marcar limpa com desfazer

- [ ] Testes que falham em `servidor-movimentacoes.test.ts`: marcar limpa devolve `{ mesa, desfazer }`; desfazer volta a limpeza com a hora de antes; abrir a mesa depois disso faz o desfazer recusar.
- [ ] Mudar o teste antigo "marcar limpa tira a limpeza" de `servidor.test.ts`: o retorno passa a ser `{ mesa, desfazer }` (mudança planejada, Q46).
- [ ] Implementar e fazer o commit `feat(mesas): marcar limpa também pode ser desfeito`.

### Task 53 (Tarefa 53): demonstração com o par juntado

- [ ] Testes que falham em `gerar-pedidos.test.ts`: a comanda mais nova do roteiro ao vivo senta na mesa 15 com `juntadas: [{ id: "mesa-16", numero: 16 }]`; as comandas abertas ficam nas mesas 1 a 7 e 15 (o teste antigo "nas mesas 1 a 8" muda, mudança planejada); `mesasOcupadas` com a 15 também deixa a 16 de fora.
- [ ] Teste que falha em `servidor.test.ts`: a demonstração abre com a 16 juntada à 15; na virada do dia, com a comanda da 15 mexida, ninguém senta na 16.
- [ ] Mudar os testes antigos de `pagina-mesas.test.tsx` que contam a demonstração: "8 ocupadas · 9 livres", ocupação "9/19 · 47%" e as pessoas, conferidas à mão (mudança planejada).
- [ ] Implementar e fazer o commit `feat(mesas): a demonstração tem as mesas 15 e 16 juntas`.

### Task 54 (Tarefa 54): hooks das movimentações

- [ ] Testes que falham em `consultas-mesas.test.tsx`: `useTransferirMesa`, `useJuntarMesas`, `useSepararMesas` e `useTransferirItens` chegam ao servidor, guardam a comanda devolvida e invalidam as mesas; `useDesfazer` desfaz e invalida; `useMarcarLimpa` devolve o `desfazer`.
- [ ] Implementar e fazer o commit `feat(mesas): hooks de transferir, juntar, separar e desfazer`.

### Task 55 (Tarefa 55): grade, menu ⋯ e o aviso com Desfazer

- [ ] Testes que falham em `movimentacoes.test.tsx` (pizzaria):
  - a mesa 16 diz "Com a mesa 15"; tocar nela abre a gaveta da Mesa 15;
  - o filtro de estado oferece "Juntada" e `?estado=juntada` mostra só a 16 (o teste antigo "não oferece Reservada nem Juntada" passa a esperar Juntada, mudança planejada);
  - menu ⋯ da mesa 1 → "Transferir" → escolher a mesa 8 → "Transferir": o aviso "Mesa 1 transferida para a mesa 8." tem "Desfazer"; desfazer volta a comanda para a 1;
  - menu ⋯ da mesa 1 → "Juntar mesas" → marcar a 8 → "Juntar": a 8 diz "Com a mesa 1"; "Separar" no menu solta;
  - "Marcar limpa" na mesa 9 tem "Desfazer", e desfazer volta a Limpeza;
  - o erro do servidor aparece no aviso.
- [ ] Mudar a tabela do menu ⋯ em `cartao-mesa.test.tsx` (as ações novas, mudança planejada).
- [ ] Implementar `aviso-desfazer.ts`, `transferir-mesa.tsx`, `juntar-mesas.tsx`, o cartão da secundária e os itens do menu. Commit `feat(mesas): transferir, juntar e separar pelo menu, com Desfazer`.

### Task 56 (Tarefa 56): transferir itens na gaveta

- [ ] Testes que falham em `movimentacoes.test.tsx`:
  - a gaveta da 15 diz "Junto com a mesa 16";
  - "Transferir itens" na mesa 60 (Água e 3 Sucos): escolher 1 Suco e a mesa 8, "Transferir": a 60 fica com 2 Sucos, a 8 abre com 1, o aviso tem "Desfazer";
  - o item que a cozinha ainda tem aparece travado, com "Na cozinha";
  - sem item ou sem mesa, "Transferir" diz o que falta.
- [ ] Implementar `transferir-itens.tsx` e o botão. A gaveta deixa o clique no aviso passar sem fechar (`manterToastClicavel`). Commit `feat(mesas): transferir itens pela comanda`.

### Task 57 (Tarefa 57): E2E e fechamento

- [ ] Em `tests/admin.spec.ts`: na pizzaria, juntar a mesa 8 à mesa 1 pelo menu ⋯, lançar uma pizza na cozinha, ver "Mesa 1 + 8" na Cozinha, voltar, separar e desfazer pelo aviso. Rodar só ele, em `desktop-1920`.
- [ ] `pnpm check`, mostrando a saída. `pnpm test:coverage` e subir os mínimos se a cobertura subiu.
- [ ] Os screenshots ficam para a revisão.
- [ ] Registrar a "Situação" no fim desta seção.

Situação: pronta em 22/11/2026, na branch `claude/admin-mesas-fase-5`, empilhada sobre a Fase 4, depois da revisão. O PR sai depois que as Fases 1 a 4 estiverem no `main`.

- **O que a revisão pegou** (cada correção com o teste vermelho antes):
  - **ids repetidos:** juntar tira a comanda da secundária de Pedidos, e o pedido novo usava o id do último da lista: o id e o número voltavam a ser usados, os itens ficavam com ids repetidos (tirar uma linha tirava as duas) e o estoque apontava para a comanda errada. O id agora segue do pedido mais novo que a base já teve (`proximoId`), e a junção guarda o último em `base.ultimoPedido`;
  - **reabrir a principal:** a conta reabria com as juntadas mesmo com a secundária ocupada, bloqueada, junta a outra ou excluída. Escolha: recusar ("A mesa 31 já está aberta. Reabrir não junta de novo."), e o botão some; com as secundárias livres, reabre junta. `comandaDa` prefere a comanda da própria mesa;
  - **Garçom na mesa juntada:** a 16 aparecia "livre", com Cliente, e o nome digitado renomeava a comanda da 15. Agora diz "Mesa 16 · com a mesa 15", sem Cliente, com o resumo da comanda da 15, e o aviso diz "Mesa 15 + 16"; o servidor só usa `clienteNome` ao abrir a comanda;
  - fechar Transferir e Juntar devolve o foco ao ⋯ (`devolverFocoA`);
  - na virada do dia, a demonstração não senta ninguém nas juntadas de uma comanda que continuou aberta (o teste da Tarefa 53 que tinha ficado de fora);
  - transferir o item pronto e não servido leva o "Servir" para o destino (`servirDesdeAoReceber`, a hora mais antiga); a origem só perde quando não sobra nada pronto;
  - transferir itens que deixa a origem já paga com saldo zero fecha a conta (a mesma regra `quitou` do `alterarComanda`), com limpeza se ligada; desfazer volta tudo;
  - transferir para uma secundária diz "A mesa 16 está junto com a mesa 15.";
  - juntar não toca o alerta de rodada nova na cozinha: a leitura guarda também os itens da rodada, e a rodada com um item que a cozinha já tinha (na mesma comanda ou numa que saiu da tela) não é nova;
  - o leitor de tela não lê o total da principal no cartão da secundária;
  - Juntar não oferece a mesa que já tem outras juntas a ela;
  - Transferir itens: "Na cozinha" e "Pago" descrevem o campo travado, a mesma coisa em linhas de rodadas diferentes diz a rodada ("3× Suco · rodada 1"), mais de uma unidade diz "foram para", e com todos os itens travados a gaveta não oferece o botão;
  - a conferência de bloqueio repetida em `transferirItens` saiu (não era alcançável);
  - ganhou teste a recusa "O desconto passaria do valor dos itens" ao transferir itens.
- **Mudou fora do plano:**
  - na gaveta, abaixo da descrição, "Transferir mesa", "Juntar mesas" e (com junção) "Separar"; transferir pela gaveta fecha a gaveta (a mesa dela ficou livre);
  - o cartão da Fila diz "Mesa 15 + 16" (`rotuloDaMesa`);
  - o teste "juntar que ficaria menor que o pago" entrou junto com o E2E, depois do código da Tarefa 50 (a regra já estava lá; o teste a fixa);
  - na gaveta, o clique em "Desfazer" passa por cima dela (`manterToastClicavel`, como a sacola); no teste de componente o clique no aviso desliga a conferência de `pointer-events` do jsdom, que não lê o CSS do sonner.
- **Testes antigos que mudaram (mudança de comportamento planejada):**
  - "marcar limpa tira a limpeza" (`servidor.test.ts`): o retorno passa a ser `{ mesa, desfazer }` (Q46);
  - "abre 8 comandas, nas mesas 1 a 8" (`gerar-pedidos.test.ts`) virou "nas mesas 1 a 7 e 15"; a lista das comandas de hoje da pizzaria troca a mesa 8 (2 pessoas, R$ 118,30) pela 15 (6 pessoas, R$ 150,30: 93 + 9,30 + 6 × 8);
  - em `pagina-mesas.test.tsx`: "8 ocupadas · 9 livres", ocupação "9/19 · 47%" e 20 pessoas no salão (a demonstração tem a 16 junto com a 15); o filtro de estado volta a oferecer "Juntada" (o teste "não oferece Reservada nem Juntada" virou "não oferece Reservada");
  - a tabela do menu ⋯ em `cartao-mesa.test.tsx` ganha "Transferir" e "Juntar mesas" na mesa aberta;
  - revisão: "o item que a cozinha ainda tem fica travado" (`movimentacoes.test.tsx`) ganhou uma rodada sem cozinha, porque com tudo na cozinha o botão Transferir itens agora some; e passou a conferir a descrição "Na cozinha" do campo.
- **Fica para depois:**
  - a confirmação de reserva na tela (transferir e transferir itens já aceitam `confirmarReserva` no servidor) e juntar mesa reservada com confirmação, com as reservas (Fase 7). Até lá nenhuma reserva chega à tela (não há como criar uma, e a demonstração não tem), então Transferir e Transferir itens não marcam a mesa reservada: o servidor recusa com "Confirme para transferir";
  - as outras operações continuam na base em memória da aba: duas abas mexendo na mesma comanda por fora das movimentações ainda podem se sobrescrever (Fase 8, `BroadcastChannel`);
  - separar só uma das mesas juntadas; transferir a comanda com mesas juntadas (hoje pede para separar antes); transferir item que a cozinha ainda prepara;
  - juntar uma mesa em limpeza e separar depois deixa ela livre, sem a limpeza de antes (achado H da revisão, sem correção pedida).
- **Screenshots** (revisados nas imagens esperada, atual e diff, claro e escuro, em celular-390 e desktop-1920; depois gerados nas outras 9 telas, com uma amostra de cada tamanho conferida):
  - pela demonstração: `painel-mesas-*` (a 8 livre, a 15 ocupada com R$ 150,30, a 16 "Com a mesa 15", 9/19 · 47% e 20 pessoas), `painel-cozinha-*` ("Mesa 15 + 16"), `painel-fila-*` ("Mesa 15 + 16" e o valor a cobrar), `painel-pedidos-*` e `painel-visao-geral-*` (o #1416 passa de R$ 118,30 para R$ 150,30, e os totais do dia e da semana sobem R$ 32,00) e, por trás das janelas, `painel-abrir-mesa-*`, `painel-atalhos-mesas-*`, `painel-nova-mesa-*` e `painel-configurar-salao-*`;
  - pela tela: `painel-comanda-*`, `painel-comanda-conta-*`, `painel-receber-conta-*` e `painel-adicionar-itens-*` (a gaveta ganhou "Transferir mesa" e "Juntar mesas"; na aba Itens, "Transferir itens");
  - novos: `painel-transferir-mesa-*`, `painel-juntar-mesas-*` e `painel-transferir-itens-*`;
  - `painel-garcom-*` não mudou.
- **Testes e cobertura:** 1639 testes no Vitest (`pnpm check` verde). E2E rápido (celular-390 e desktop-1920) verde contra o `next start` na porta 3010: 466 passaram, 28 pulados, nenhum falhou. Na primeira rodada, as únicas falhas eram os screenshots acima. A cobertura ficou em 84,72/77,65/83,18/85,76 no geral: os mínimos continuam em 84/77/83/85 (nenhum ponto inteiro a mais); `lib/**` continua em 98/95/98/98.

## Fase 6: mapa do salão

**Desenho:**

- alternador Grade/Mapa (`?vista=mapa`, atalho `M`) e abas por área;
- mesa desenhada pela forma e pelos lugares, com o tom do estado;
- modo edição em tablet e desktop: `@dnd-kit` com encaixe, sem sobrepor e com teclado;
- salvar as posições em lote;
- cadeado Pro quando a função estiver desligada no plano.

**Fronteiras de teste**

1. **`lib/admin/regras/salao.ts`:** `colide`, `posicaoValida` (dentro de 24 × 16 e sem cruzar) e `moverPorTeclado` (1 ou 4 células, parando na borda).
2. **Servidor:** `mesas.posicionar([{ id, posicao }])` recusa o lote inteiro se uma posição for inválida.
3. **Componentes:**
   - mapa por área;
   - mesa como botão com o mesmo nome falado da grade;
   - mover pelo teclado no modo edição;
   - celular sem o modo edição;
   - cadeado.
4. **E2E:** mover uma mesa pelo teclado, salvar e recarregar, e screenshot do mapa.

**Branch:** `claude/admin-mesas-fase-6`, empilhada sobre as Fases 1 a 5. O PR vai para `main` depois delas.

**Decisões de detalhe desta fase** (decorrem de Q3, Q16, Q17, Q32, Q40, Q47 e das decorrências 6 e 7)

- **Posição e tamanho:** a posição é a célula do canto de cima à esquerda da mesa, na grade 24 × 16 da área; o tamanho sai de `tamanhoDaMesa` (já existe). Duas mesas colidem quando são da mesma área e os retângulos se cruzam (encostar não conta, como em `mesasSeCruzam`). Uma posição é válida com coordenadas inteiras, a mesa inteira dentro do mapa e sem colidir.
- **Mover pelo teclado:** setas movem 1 célula, Shift+setas 4, e a mesa para na borda (não sai nem recusa). O movimento **não** pula nem recusa a colisão: no rascunho a mesa pode passar por cima de outra (é o único jeito de atravessá-la pelo teclado). A mesa por cima fica marcada ("sobre outra mesa") e o salvar recusa.
- **Arrastar:** `@dnd-kit/core` (`useDraggable`, `PointerSensor` com 4 px de distância). O deslocamento em pixels vira células arredondadas para a mais próxima (encaixe), também enquanto arrasta, e a mesa para na borda (`arrastar`). Soltar por cima de outra mesa vale a mesma regra do teclado: marca e o salvar recusa. O arrasto não tem teste de componente (o jsdom não mede a planta nem simula o ponteiro do dnd-kit): a conta é pura e testada, e o arrasto entra no E2E.
- **Servidor, `mesas.posicionar(lote)`:** grava as posições de uma vez, conferidas contra o resultado final (trocar duas mesas de lugar no mesmo lote vale). Recusa o lote inteiro, sem gravar nada:
  - mesa que não existe: "Mesa não encontrada";
  - mesas de áreas diferentes no mesmo lote: "Salve as posições de uma área por vez." (o editor mexe numa área só);
  - fora do mapa ou coordenada quebrada: "A mesa 3 sai do mapa.";
  - por cima de outra: "A mesa 3 ficaria sobre a mesa 4.".

  Mesa de outra área no mesmo lugar não colide. A posição não depende do estado: mesa aberta, bloqueada ou juntada também se move. Lote vazio devolve `[]` sem gravar. Devolve as mesas do lote, pelo número.
- **Editar mesa (ponto de atenção 6):** a regra de ficar ou ir para a primeira posição livre passa a usar `posicaoValida`. Até aqui ela só olhava o cruzamento, e a quadrada em x 22 virando retangular de 8 lugares (4 × 2) ficava com metade fora do mapa. A mesa nova já nasce sem sobrepor (`primeiraPosicaoLivre`, Tarefa 4).
- **Vista no endereço:** `?vista=mapa` (nuqs; a grade é o padrão e não aparece). O alternador "Grade | Mapa" fica acima da grade (`ToggleGroup` no estilo segmento, nomeado "Vista"). `M` (e `m`) alterna, com as mesmas travas dos outros atalhos (campo, modificador, janela aberta, atalhos de uma tecla desligados). Durante a edição do mapa o alternador e o `M` ficam travados.
- **Mapa por área:** abas com as áreas (só as que têm mesa), na ordem das áreas. A aba escolhida fica em `?area=`, o mesmo parâmetro do filtro de área da grade (sem área, a primeira). No mapa, a barra de filtros some: o mapa mostra a área inteira. Os números do salão continuam no topo. Cada área é uma lista ("Mapa do Salão") desenhada numa grade CSS de 24 × 16 com proporção 3:2, e as mesas vêm na ordem de leitura (linha, depois coluna), para o Tab seguir o desenho. No celular a planta tem 720 px de largura mínima e rola de lado dentro da própria faixa (a página não rola de lado).
- **Mesa no mapa:** é um botão com o mesmo nome ("Mesa 3") e a **mesma descrição falada** do cartão (`descricaoDaMesa`, extraída do cartão). Desenho: redonda em círculo, quadrada e retangular com cantos arredondados; o número grande, o traço e o rótulo do estado; os lugares como cadeiras em volta (decorativas, escondidas do leitor de tela). Ocupada com o fundo do cartão; com alerta, o anel no tom novo e `data-alerta`, como na grade. Tocar abre a gaveta (a juntada abre a da principal). O ⋯ fica ao lado da mesa, com o mesmo menu da grade (`MenuMesa`, exportado do cartão).
- **Modo edição (Q47):** botão "Editar mapa" só em tela de tablet para cima (`useTelaGrande`, ≥ 768 px) e com a função ligada. Em edição:
  - as abas, o alternador e o `M` travam, o ⋯ some e tocar na mesa não abre a gaveta;
  - Tab passa de mesa em mesa (a focada é a que as setas movem), e a lista ganha a instrução "Use Tab para escolher a mesa e as setas para mover. Com Shift, anda 4 células.";
  - a descrição de cada mesa passa a dizer a posição ("coluna 2, linha 2", contando de 1) e, se for o caso, "sobre outra mesa";
  - uma região viva anuncia cada movimento: "Mesa 3: coluna 5, linha 2" (e ", sobre outra mesa");
  - "Salvar posições" manda só as mesas que mudaram. Com uma mesa por cima de outra, a tela recusa sem chamar o servidor ("A mesa 3 está sobre outra mesa. Mova antes de salvar."). Sem mudança, só sai da edição. Deu certo: "Mapa salvo.";
  - "Cancelar" volta as posições de antes.
- **Cadeado Pro (Q32, decorrência 6):** com `salao.funcoes.mapa` desligada, o "Mapa" do alternador mostra o selo Pro com cadeado (`SeloPro`, o mesmo da vitrine). Tocar nele (ou `M`) não troca a vista: abre a janela "Mapa do salão é Pro", que explica o recurso, diz o preço (R$ 19,90 por mês) e tem "Abrir Configurar salão". `?vista=mapa` com a função desligada mostra a grade. Configurar salão ganha o bloco "Funções Pro" com o interruptor "Mapa do salão" e o selo (cadeado desligado, brilho ligado). Ligar não passa pela sacola nesta fase: a entrada no `CATALOGO_PRO` continua na Fase 8, como já está no desenho dela (as chaves do catálogo são da vitrine, e `opcaoEmUso` quebraria com `salao.*`). Reservas e QR continuam fora do painel até as fases deles. A demonstração já vem com o mapa ligado.

**Interfaces que a Fase 6 entrega**

```ts
// lib/admin/regras/salao.ts
export type MesaNoMapa = Pick<Mesa, "id" | "areaId" | "forma" | "lugares" | "posicao">
export type Direcao = "esquerda" | "direita" | "cima" | "baixo"
export function colide(mesa: MesaNoMapa, mesas: MesaNoMapa[]): boolean
export function posicaoValida(mesa: MesaNoMapa, mesas: MesaNoMapa[]): boolean
export function noMapa(mesa: Pick<Mesa, "forma" | "lugares">, posicao: PosicaoMesa): PosicaoMesa
export function moverPorTeclado(
  mesa: Pick<Mesa, "forma" | "lugares" | "posicao">,
  direcao: Direcao,
  passo: 1 | 4,
): PosicaoMesa
export function arrastar(
  mesa: Pick<Mesa, "forma" | "lugares" | "posicao">,
  deslocamento: { x: number; y: number }, // em pixels
  celula: { largura: number; altura: number }, // em pixels
): PosicaoMesa
export function descreverPosicao(posicao: PosicaoMesa): string // "coluna 3, linha 2"
export const FUNCOES_PRO_SALAO: Record<keyof ConfigSalao["funcoes"], { nome: string; preco: number }>

// servidor (api.mesas)
posicionar(lote: { id: string; posicao: PosicaoMesa }[]): Promise<Mesa[]>

// consultas-mesas: usePosicionarMesas() (guarda as posições novas na lista de mesas e invalida)
// lib/admin/regras/atalhos-mesas.ts: AcaoAtalho ganha { tipo: "alternar-vista" } ("m" e "M")
// components/admin/mesas/estado-grade.ts: useVista() (?vista=mapa)
// components/admin/mesas/cartao-mesa.tsx: export function descricaoDaMesa(linha, agora): string; export MenuMesa
// components/admin/mesas/mapa-salao.tsx: <MapaSalao />, <MapaPro /> (a janela do cadeado)
```

**Arquivos**

- Criar:
  - `lib/admin/dados/servidor-mapa.test.ts` (os testes de servidor desta fase);
  - `components/admin/mesas/mapa-salao.tsx` e `mapa-salao.test.tsx`.
- Mudar:
  - `lib/admin/regras/salao.ts` e `salao.test.ts`;
  - `lib/admin/dados/servidor.ts` e `servidor.test.ts` (editar dentro do mapa);
  - `lib/admin/dados/consultas-mesas.ts` e `consultas-mesas.test.tsx`;
  - `lib/admin/regras/atalhos-mesas.ts` e `atalhos-mesas.test.ts`;
  - `components/admin/mesas/{pagina-mesas,cartao-mesa,atalhos-mesas,estado-grade,configurar-salao}.tsx` e `configurar-salao.test.tsx`;
  - `tests/admin.spec.ts` e `tests/visual-admin.spec.ts`.

### Task 58 (Tarefa 58): regras do mapa

- [ ] Testes que falham em `salao.test.ts`, um comportamento por vez:
  - `colide`: a quadrada em (1, 1) colide com a de (2, 2) da mesma área; encostar ((3, 1)) não colide; a mesma mesa (mesmo id) não conta; a de outra área no mesmo lugar não colide; a retangular de 8 em (0, 0) colide com a quadrada em (3, 0);
  - `posicaoValida`: (22, 14) vale para a quadrada; (23, 0) não (passa da coluna 24); (0, 15) não (passa da linha 16); (-1, 0) e (1.5, 0) não; a retangular de 8 em (20, 0) vale e em (21, 0) não; colidindo, não;
  - `moverPorTeclado`: da quadrada em (5, 5), direita 1 → (6, 5), esquerda 4 → (1, 5), cima 1 → (5, 4), baixo 4 → (5, 9); em (1, 5), esquerda 4 → (0, 5); em (21, 13), direita 4 → (22, 13) e baixo 4 → (21, 14); a retangular de 8 em (19, 0), direita 4 → (20, 0);
  - `arrastar` com células de 40 × 30 px: da (5, 5), (+41, −29) → (6, 4); (+19, +14) não sai do lugar; (+21, +16) → (6, 6); (−400, +1000) → (0, 14);
  - `descreverPosicao({ x: 2, y: 1 })` → "coluna 3, linha 2".
- [ ] Implementar e fazer o commit `feat(mesas): regras do mapa: colisão, posição válida, teclado e arrasto`.

### Task 59 (Tarefa 59): posicionar as mesas no servidor

- [ ] Testes que falham em `servidor-mapa.test.ts` (lanchonete de teste: mesas 1 e 2 do Salão em (0, 0) e (4, 0)):
  - posicionar a mesa 1 em (10, 3) e a 2 em (0, 8) grava as duas (a leitura seguinte vê) e devolve as duas, pelo número;
  - trocar a 1 e a 2 de lugar no mesmo lote vale;
  - recusas que não gravam nada, uma por teste: a mesa 1 em (2, 0) por cima de uma mesa nova em (2, 0) ("A mesa 1 ficaria sobre a mesa 3."), a mesa 1 em (23, 0) ("A mesa 1 sai do mapa."), em (1.5, 0), a mesa inexistente no meio de um lote válido ("Mesa não encontrada", e a outra do lote não mudou), duas mesas de áreas diferentes ("Salve as posições de uma área por vez.");
  - a mesa da Varanda no mesmo lugar de uma mesa do Salão não colide;
  - mesa ocupada e bloqueada se movem sem mudar a comanda nem o bloqueio;
  - lote vazio devolve `[]`.
- [ ] Implementar `posicionar` e fazer o commit `feat(mesas): o servidor grava as posições do mapa em lote`.

### Task 60 (Tarefa 60): editar a mesa sem sair do mapa

- [ ] Teste que falha em `servidor.test.ts`, no `describe("editar")`: a quadrada em (22, 8) virando retangular de 8 lugares vai para uma posição válida (a primeira livre, (6, 0)), em vez de ficar com metade fora do mapa.
- [ ] Trocar a conferência de `editar` por `posicaoValida`. Commit `fix(mesas): editar a mesa não deixa metade dela fora do mapa`.

### Task 61 (Tarefa 61): hook de posicionar

- [ ] Teste que falha em `consultas-mesas.test.tsx`: `usePosicionarMesas` chega ao servidor e a lista de `useMesas` já traz a posição nova logo depois do sucesso.
- [ ] Implementar e fazer o commit `feat(mesas): hook para salvar as posições do mapa`.

### Task 62 (Tarefa 62): o atalho M

- [ ] Testes que falham em `atalhos-mesas.test.ts`: "m" e "M" dão `alternar-vista` e zeram os dígitos; com campo, modificador, janela aberta ou atalhos desligados, nada.
- [ ] Implementar e fazer o commit `feat(mesas): o atalho M na leitura das teclas`.

### Task 63 (Tarefa 63): vista Mapa com abas por área

- [ ] Testes que falham em `mapa-salao.test.tsx` (pizzaria, tela grande):
  - o alternador "Vista" mostra "Grade" marcada; tocar em "Mapa" grava `?vista=mapa` e mostra as abas Salão, Varanda e Balcão, com o Salão escolhido e a lista "Mapa do Salão" com as mesas 1 a 10;
  - `?vista=mapa&area=area-varanda` abre na Varanda; trocar de aba grava `?area=`;
  - no mapa, a barra de filtros some;
  - a mesa no mapa tem o mesmo nome e a mesma descrição do cartão: "Mesa 16" com "Com a mesa 15, 6 lugares", e a 20 com "Bloqueada, Em manutenção";
  - as mesas da lista vêm na ordem de leitura (no Salão: 1, 2, 3, 4, 9, 5, 6, 7, 8, 10);
  - tocar na 16 abre a gaveta da Mesa 15; o ⋯ da mesa 9 oferece "Marcar limpa";
  - a mesa que pediu a conta há 12 min fica com `data-alerta`.
- [ ] Extrair `descricaoDaMesa` do cartão (com os testes do cartão verdes), exportar `MenuMesa` e implementar `useVista`, o alternador e `mapa-salao.tsx`. Commit `feat(mesas): vista Mapa, com abas por área e as mesmas ações da grade`.

### Task 64 (Tarefa 64): M na tela

- [ ] Testes que falham em `mapa-salao.test.tsx`: "m" fora de campo leva ao mapa (`?vista=mapa`) e "M" volta à grade; "m" na busca só escreve; a folha de atalhos lista "M" ("Alternar entre grade e mapa").
- [ ] Implementar e fazer o commit `feat(mesas): M alterna grade e mapa`.

### Task 65 (Tarefa 65): editar o mapa pelo teclado

- [ ] Testes que falham em `mapa-salao.test.tsx`:
  - no celular (sem `telaGrande`), o mapa não tem "Editar mapa";
  - "Editar mapa" mostra "Salvar posições" e "Cancelar", trava as abas e o alternador e esconde o ⋯; a lista ganha a instrução;
  - com o foco na mesa 1 (1, 1), seta para a direita leva a (2, 1) ("coluna 3, linha 2" na descrição) e a região viva diz "Mesa 1: coluna 3, linha 2"; Shift+seta para baixo duas vezes leva a (2, 9) ("coluna 3, linha 10");
  - tocar na mesa em edição não abre a gaveta;
  - "Salvar posições" grava só a mesa 1 no servidor, avisa "Mapa salvo." e sai da edição;
  - por cima de outra mesa (a 1 em (2, 5), sobre a mesa 5, com seta para a direita e Shift+seta para baixo uma vez), a descrição diz "sobre outra mesa", e salvar avisa "A mesa 1 está sobre outra mesa. Mova antes de salvar." sem gravar;
  - "Cancelar" volta a mesa para (1, 1) sem gravar;
  - o erro do servidor aparece no aviso e a edição continua.
- [ ] Implementar o modo edição em `mapa-salao.tsx`, com o arrasto do `@dnd-kit` (sem teste de componente, ver as decisões). Commit `feat(mesas): editar o mapa pelo teclado e arrastando, e salvar em lote`.

### Task 66 (Tarefa 66): cadeado Pro

- [ ] Testes que falham:
  - em `mapa-salao.test.tsx`, com `funcoes.mapa` desligada: "Mapa" tem o selo Pro; tocar nele não muda a vista e abre "Mapa do salão é Pro" com o preço "R$ 19,90"; "Abrir Configurar salão" abre o painel; `?vista=mapa` mostra a grade; "m" abre a mesma janela;
  - em `configurar-salao.test.tsx`: o interruptor "Mapa do salão" mostra o estado do servidor e desligar grava `funcoes.mapa: false`, com reservas e QR iguais. O teste antigo "reservas, QR e funções Pro não aparecem…" passa a não esperar "mapa" (mudança planejada: o mapa entrou no painel).
- [ ] Implementar e fazer o commit `feat(mesas): mapa do salão com cadeado Pro e a função em Configurar salão`.

### Task 67 (Tarefa 67): E2E e fechamento

- [ ] Em `tests/admin.spec.ts`: na pizzaria, `?vista=mapa`, "Editar mapa", mover a mesa 1 pelo teclado (seta para a direita e duas vezes Shift+seta para baixo, até "coluna 3, linha 10"), salvar, recarregar e ver a posição nova na descrição da mesa em edição; arrastar uma mesa e salvar. Rodar só ele, em `desktop-1920`.
- [ ] Em `tests/visual-admin.spec.ts`: os screenshots `painel-mapa-*` (mapa do Salão) e `painel-mapa-edicao-*` (modo edição). Eles e os que mudam (`painel-mesas-*` pelo alternador, `painel-configurar-salao-*` pelo bloco Funções Pro) ficam para a revisão.
- [ ] `pnpm check`, mostrando a saída. `pnpm test:coverage` e subir os mínimos se a cobertura subiu.
- [ ] Registrar a "Situação" no fim desta seção.

Situação: pronta em 22/11/2026, na branch `claude/admin-mesas-fase-6`, empilhada sobre a Fase 5, depois da revisão. O PR sai depois que as Fases 1 a 5 estiverem no `main`.

- **O que os testes pegaram** (cada correção com o teste vermelho antes):
  - editar a quadrada em x 22 para retangular de 8 lugares deixava metade da mesa fora do mapa (Tarefa 60);
  - a primeira versão do teste do hook conferia a lista logo depois da mutação e falhava de vez em quando (o React Query avisa a tela num tempo próprio). Agora a leitura do servidor fica pendurada no teste e só a cópia que o hook grava pode trazer a posição nova;
  - o axe do E2E recusou o contraste das abas inativas (texto mais forte, como na Cozinha e na Agenda) e o texto visível do estado dentro do botão da mesa, que não cabia no nome "Mesa 3".
- **O que a revisão pegou** (cada correção com o teste vermelho antes):
  - os dois E2E da edição clicavam em "Editar mapa" sem pular as telas abaixo de 768 px e falhavam nos celulares: agora pulam, e um E2E novo de celular confere que `?vista=mapa` mostra o mapa sem "Editar mapa" e que a página não rola de lado;
  - desligar o mapa em Configurar salão durante a edição, ou a tela cair abaixo de 768 px, deixava a edição presa (alternador e `M` travados). A edição agora só vale com o mapa liberado e a tela grande (`editandoMapa && noMapa && telaGrande`, e um efeito zera o pedido), e fora dela a planta desenha as posições salvas, sem o rascunho;
  - na edição, número + Enter e `N` não abrem mais janela (a mesma trava do `M`);
  - "Cancelar" trava enquanto o salvar não volta;
  - só a mesa do rascunho fica marcada "sobre outra mesa" (a parada embaixo dela não), e o aviso do salvar fala da última movida (a ordem do rascunho é a do último movimento);
  - na edição, a descrição falada mantém o estado da mesa e acrescenta a posição ("Bloqueada, Em manutenção, coluna 15, linha 8");
  - setas com Alt, Ctrl ou Meta ficam para o navegador: não movem a mesa nem fazem `preventDefault`;
  - fechar a aba com posição não salva pede confirmação (`beforeunload`, como em Configurações da loja); mover e voltar ao lugar salvo não conta;
  - `posicionar([])` devolve `[]` sem regravar a base (o teste confere o `geradoEm` guardado);
  - lacunas de teste fechadas (cada uma conferida desligando a regra e vendo o vermelho): a linha quebrada em `posicaoValida`, a resposta de `posicionar` pelo número com a base fora de ordem (mesa 30 criada antes da 3) e mover e voltar sem chamar o servidor.
- **Achado nos screenshots:** com só a mesa movida marcada, o anel vermelho sumia, porque a mesa movida é a que tem o foco e o anel do foco ganhava dele. Agora o vermelho ganha do alerta e do foco, e o foco vira contorno (`outline`) por fora; conferido no `painel-mapa-edicao-*` antes e depois.
- **Mudou fora do plano:**
  - a lista de cada área se chama "Mapa: Salão" (e não "Mapa do Salão": o artigo depende do nome da área);
  - no botão da mesa, o nome vem de um texto só para o leitor ("Mesa 3"), o número visível fica escondido dele e o rótulo do estado fica por cima do botão, fora dele. A descrição falada continua a do cartão, que já começa pelo estado;
  - na edição, a mesa com o foco fica por cima das outras, e a que está por cima de outra ganha o anel de erro (`ring-destructive`), que o foco não apaga;
  - `ConfigurarSalao` passou a aceitar `aberto` e `aoMudar` de fora: "Abrir Configurar salão", na janela do Pro, abre o painel;
  - `FUNCOES_PRO_SALAO` já tem os três preços da decorrência 6 (reservas e QR só são usados nas fases deles);
  - o E2E ganhou um segundo teste, o do arrasto da mesa 2 (o arrasto não tem teste de componente). Para passar em todas as telas, ele espera 100 ms antes de salvar (o dnd-kit engole o clique dos 50 ms depois de soltar) e arrasta em dois trechos de 4 células logo abaixo do cabeçalho (no celular deitado, chegar perto da borda de baixo rolava a página durante o arrasto);
  - o screenshot do mapa procurava "Mesa 1" sem `exact` e achava também a 10 e o ⋯: agora com `exact`.
- **Testes antigos que mudaram (mudança de comportamento planejada):**
  - "reservas, QR e funções Pro não aparecem…" (`configurar-salao.test.tsx`) virou "reservas e QR não aparecem…", porque o mapa entrou no painel;
  - revisão: em `mapa-salao.test.tsx` ("as setas movem…", "mesa por cima de outra…", "Cancelar volta…") e nos dois E2E da edição, a descrição na edição passou a ser conferida pelo fim (`/, coluna 3, linha 2$/`), porque agora ela começa pelo estado da mesa.
- **Testes que passaram de primeira**, porque a regra já saía do desenho de outra fatia: em `servidor-mapa.test.ts`, trocar duas mesas de lugar, a mesa de outra área, a mesa aberta e a bloqueada e o lote vazio; em `mapa-salao.test.tsx`, as fatias da Tarefa 63 depois da primeira, o celular, o `M` travado, cancelar e tocar na edição. Cada grupo foi conferido desligando a regra no código e vendo o vermelho.
- **Fica para depois:**
  - ligar a função na sacola do painel (`CATALOGO_PRO`), na Fase 8, como já estava no desenho dela;
  - filtros no mapa (o mapa mostra a área inteira) e editar mais de uma área de uma vez;
  - desfazer a edição do mapa depois de salvar;
  - onde a planta fica na largura mínima (720 px: celulares, `tablet-768` e `notebook-1024`), o rótulo do estado corta com reticências ("Ocup…", "Pediu…"); o número aparece inteiro e a descrição falada continua completa. Mudar o tamanho da planta ou do rótulo é decisão de desenho.
- **Screenshots** (revisados nas imagens esperada, atual e diff, claro e escuro, em celular-390 e desktop-1920; depois gerados nas outras 9 telas, com uma amostra de cada tamanho conferida):
  - novos: `painel-mapa-*` (as mesas sem sobrepor, nos lugares da demonstração) e `painel-mapa-edicao-*` (só de 768 px para cima; a mesa 1 por cima da 5 com o anel vermelho e o contorno do foco);
  - mudam pela tela: `painel-mesas-*` (o alternador Grade/Mapa acima dos filtros) e `painel-atalhos-mesas-*` (a linha do `M`);
  - mudam só pelo fundo, com a grade descendo 52 px por causa do alternador: `painel-configurar-salao-*` (o bloco Funções Pro fica abaixo da dobra do painel, fora da foto), `painel-comanda-*`, `painel-comanda-conta-*`, `painel-receber-conta-*`, `painel-adicionar-itens-*`, `painel-abrir-mesa-*`, `painel-nova-mesa-*`, `painel-transferir-mesa-*`, `painel-juntar-mesas-*` e `painel-transferir-itens-*`.
- **Testes e cobertura:** 1711 testes no Vitest (`pnpm check` verde). E2E rápido (celular-390 e desktop-1920) contra o `next start` na porta 3010: 473 passaram, 31 pulados, nenhum falhou (na primeira rodada, as falhas eram só os screenshots acima). Os E2E do mapa (`-g "mapa"`) nas 11 telas: 39 passaram, 16 pulados (a edição abaixo de 768 px e o de celular de 768 px para cima). A cobertura ficou em 84,91/78,02/83,33/85,95 no geral: o mínimo de ramos sobe para 78 (84/78/83/85); `lib/**` continua em 98/95/98/98.

## Fase 7: reservas e lista de espera

**Desenho:**

- painel de Reservas do dia e da Espera, ao lado da grade;
- nova reserva, sentar, não compareceu e cancelar;
- entrar na espera, chamar (WhatsApp), sentar e desistir;
- sugestão de mesa;
- cenário de demonstração com 2 reservas e 3 pessoas na espera;
- cadeado Pro.

**Fronteiras de teste**

1. **`lib/admin/regras/reservas.ts`:**
   - `reservaDaMesa(mesa, reservas, agora, config)`;
   - "não compareceu" depois da tolerância;
   - `sugerirMesa(pessoas, mesas, reservas)` pega a menor que cabe, desempata pelo número e pula bloqueada e reservada;
   - `linkWhatsApp(telefone, loja)` com a mensagem fixa.
2. **Servidor:**
   - criar, cancelar e sentar reserva (abre a mesa com nome e pessoas);
   - espera;
   - excluir mesa com reserva marcada é recusado.
3. **Componentes:** formulários, sugestão e o rótulo "Reservada 20:00" no cartão.
4. **E2E:** reservar, chegar a hora, sentar e fechar.

**Branch:** `claude/admin-mesas-fase-7`, empilhada sobre as Fases 1 a 6. O PR vai para `main` depois delas.

**Decisões de detalhe desta fase** (decorrem de Q6, Q11, Q24, Q25, Q32, Q42, da decorrência 6 e do ponto de atenção 5)

- **Reserva só para hoje:** o formulário pede nome (obrigatório, até 80), telefone (opcional, com DDD: 10 ou 11 números, guardado só com os dígitos), horário (`HH:MM`, hoje), pessoas (1 a 99) e mesa (opcional). O horário não pode ser antes do minuto de agora ("Esse horário já passou."). Reservar para outro dia fica para depois: o painel é "do dia".
- **Janela da reserva** (`reservaDaMesa`): a reserva marcada segura a mesa de `antecedenciaMin` antes do horário até `toleranciaMin` depois. Dentro dela a mesa livre fica "Reservada 20:50" (já era assim em `estadoDaMesa`), abrir e transferir pedem `confirmarReserva` e o Garçom recusa. Passada a tolerância, a reserva conta como **"não compareceu"** sem gravar nada (`statusDaReserva`, derivado da hora): ela some da mesa, e o painel mostra "Não compareceu". O botão "Não compareceu" grava o status antes disso (libera a mesa na hora). A reserva atrasada ainda pode ser sentada: a pessoa chegou tarde.
- **Reserva ativa e conflito:** ativa é a marcada que ainda não passou da tolerância. Duas reservas ativas na mesma mesa conflitam quando os horários ficam a menos de **2 h** um do outro (`DURACAO_RESERVA_MIN = 120`, o tempo que a mesa fica com a reserva). Criar ou editar com conflito recusa: "A mesa 13 já tem reserva às 20:50.". Reservar mesa bloqueada recusa ("A mesa 20 está bloqueada."). Mesa ocupada ou juntada agora pode ser reservada para mais tarde (ela pode liberar até lá); a sugestão é que evita.
- **Sugestão de mesa** (`sugerirMesa(pessoas, mesas, reservas, { agora, config, inicio?, ignorar? })`): a menor mesa que cabe (lugares ≥ pessoas), desempatada pelo número. Pula a bloqueada, a juntada e a que tem reserva ativa em conflito (a menos de 2 h do horário; sem horário, de agora). Quando o horário está dentro da antecedência (ou é agora, na espera), a mesa precisa estar livre já: pula também a ocupada e a em **limpeza** (ela ainda não liberou; quem quiser escolhe a mesa à mão). Para uma reserva mais tarde, a mesa ocupada agora entra.
- **Espera:** a fila mostra quem está esperando, pela chegada, com "há 12 min" correndo (`useAgora`). A mesa livre é sugerida ao primeiro da fila que cabe nela (`sugestoesDaEspera`: cada um, na ordem da chegada, fica com a menor que cabe entre as que sobraram). "Chamar" grava `chamadaEm` e, com telefone, é um link que abre `https://wa.me/55{telefone}` numa aba nova com a mensagem pronta ("Olá! Sua mesa na {loja} está pronta. Pode vir, estamos te esperando."): nada é enviado sozinho. Sem telefone, "Chamar" só marca a hora (chama-se pelo nome). "Desistiu" tira da fila.
- **Sentar** (reserva e espera): a janela "Sentar Marina Costa" pede a mesa (a da reserva, ou a sugestão já escolhida; a lista traz as mesas que podem abrir: livres e em limpeza, sem bloqueio e sem junção) e o garçom (como em Abrir mesa). O servidor abre a mesa com as regras de `abrir`, com o nome e as pessoas da reserva ou da espera, e grava o status `sentou` (a reserva guarda a mesa em que sentou). A própria reserva não pede confirmação; outra reserva da vez na mesa escolhida pede `confirmarReserva`, como abrir.
- **Recusas na mesa (ponto de atenção 5, Q42):** excluir e bloquear a mesa com reserva ativa recusam com "A mesa 13 tem reserva às 20:50. Tire a mesa da reserva antes.". Mudar a mesa da reserva é pelo "Editar" da reserva.
- **Confirmação na tela** (pendência das Fases 3 e 5): Abrir mesa, Transferir, Transferir itens e Juntar mostram o aviso "Reservada às 20:50 para Marina Costa, 2 pessoas." quando a mesa escolhida (livre e sem comanda) está na janela de uma reserva, e o botão vira "… mesmo assim", que manda `confirmarReserva`. Juntar passa a aceitar `confirmarReserva` no servidor (antes recusava a reservada sem opção). A gaveta da mesa reservada oferece também "Sentar Marina Costa", que senta a reserva com o garçom escolhido.
- **Grade, mapa e Garçom:** o cartão e a mesa do mapa mostram "Reservada 20:50" (a grade passa a reserva da vez para `estadoDaMesa`) e, no lugar dos lugares, "Marina Costa · 2 pessoas", também na descrição falada. "Reservada" volta ao filtro de estado (depois de "Livre"). O Garçom diz "Mesa 13 · reservada 20:50" na lista, com o traço de tom espera (pendência "Garçom e reservas": o servidor já recusa e manda abrir pela tela de Mesas).
- **Painel:** "Reservas e espera" é uma coluna à direita da grade a partir de 1280 px (`xl`); abaixo disso fica acima da grade. Duas abas: "Reservas" (as de hoje, pelo horário: hora, nome, pessoas, mesa ou "Sem mesa", e "Não compareceu", "Sentou" ou "Cancelada" quando for o caso; nas marcadas, "Sentar" e o ⋯ com Editar, Não compareceu e Cancelar) e "Espera" (nome, pessoas, tempo, "Chamada há 2 min", a sugestão "Mesa 8 livre", "Chamar", "Sentar" e "Desistiu"). Cada aba tem o seu botão "Nova reserva" / "Entrar na espera" e mostra o vazio quando não há ninguém. O painel aparece na grade e no mapa.
- **Cadeado Pro (Q32, decorrência 6):** com `funcoes.reservas` desligada, o painel vira o bloco "Reservas e lista de espera" com o selo Pro, o texto, o preço (R$ 24,90 por mês) e "Abrir Configurar salão". As reservas que já existem continuam valendo na grade e no servidor (o servidor não confere o plano, como no mapa). Configurar salão ganha o bloco "Reservas" (antecedência e tolerância, em minutos, de 0 a 600) e o interruptor "Reservas e lista de espera" em Funções Pro. A entrada no `CATALOGO_PRO` fica para a Fase 8.
- **Demonstração** (só com `funcoes.reservas` ligada; o catálogo de teste do servidor vem desligado e continua sem reservas): 2 reservas de hoje e 3 pessoas na espera, relativas à hora de gerar:
  - Marina Costa, 2 pessoas, (12) 99123-4567, às `agora + 20 min` arredondado para baixo de 5 em 5 (20:50 às 20:30), na **mesa 13** (2 lugares, Varanda, livre; nenhuma outra fase usa a 13 nos testes): a mesa já fica "Reservada 20:50";
  - Roberto Andrade, 6 pessoas, (12) 99765-4321, às `agora + 2 h` arredondado para baixo de 15 em 15 (22:30), sem mesa (o painel sugere);
  - na espera: Carlos Mendes (2 pessoas, (12) 99876-1234, chegou há 25 min, chamado há 2 min), Juliana Rocha (4 pessoas, sem telefone, há 12 min) e Pedro Alves (5 pessoas, (12) 99654-3210, há 5 min). As sugestões às 20:30 são as mesas 11, 8 e 10.

  A mesa 13 só recebe a reserva se estiver livre, sem bloqueio e sem junção (senão a reserva fica sem mesa), e a reserva que cairia depois da meia-noite não entra. A grade da pizzaria passa a ter 8 livres (a 13 fica reservada).
- **Virada do dia:** ao completar os dias, a reserva marcada de um dia que passou vira `nao-compareceu`, quem estava na espera vira `desistiu`, e a demonstração do dia novo ganha as reservas e a espera dela (ids com a data, sem repetir).

**Interfaces que a Fase 7 entrega**

```ts
// lib/admin/regras/reservas.ts
export const DURACAO_RESERVA_MIN = 120
type ConfigReservas = ConfigSalao["reservas"]
export function statusDaReserva(reserva, agora, config): Reserva["status"] // marcada vencida → "nao-compareceu"
export function reservaAtiva(reserva, agora, config): boolean
export function reservaDaMesa(mesa: Pick<Mesa, "id">, reservas, agora, config): Reserva | undefined
export function reservaEmConflito(mesaId, inicio: Date, reservas, agora, config, ignorar?): Reserva | undefined
export type MesaParaSugerir = Pick<Mesa, "id" | "numero" | "lugares" | "status" | "bloqueio" | "juntadaCom" | "limpezaDesde">
export function sugerirMesa<M extends MesaParaSugerir>(pessoas, mesas: M[], reservas, quando: { agora; config; inicio?: Date; ignorar?: string }): M | undefined
export function sugestoesDaEspera<M extends MesaParaSugerir>(espera: EntradaEspera[], mesas: M[], reservas, quando): Map<string, M>
export function chamadaPeloWhatsApp(telefone: string, loja: string): string // https://wa.me/55…?text=…
export function conferirReserva(campos: { nome; telefone; horario; pessoas: string }, agora): { erros; reserva?: NovaReserva }
export function conferirEspera(campos: { nome; telefone; pessoas: string }): { erros; entrada?: NovaEntradaEspera }

// servidor
reservas: {
  listar(): Promise<Reserva[]> // as de hoje, pelo horário
  criar(dados: NovaReserva): Promise<Reserva>
  editar(id, dados: NovaReserva): Promise<Reserva>
  cancelar(id): Promise<Reserva>
  naoCompareceu(id): Promise<Reserva>
  sentar(id, { mesaId?, garcom?, confirmarReserva?, por? }): Promise<{ reserva: Reserva; comanda: Pedido }>
}
espera: {
  listar(): Promise<EntradaEspera[]> // quem está esperando, pela chegada
  entrar(dados: NovaEntradaEspera): Promise<EntradaEspera>
  chamar(id): Promise<EntradaEspera>
  sentar(id, { mesaId, garcom?, confirmarReserva?, por? }): Promise<{ entrada: EntradaEspera; comanda: Pedido }>
  desistir(id): Promise<EntradaEspera>
}
mesas.juntar(pedidoId, mesaIds, { confirmarReserva?, por? })
// NovaReserva = { nome; telefone?; inicio; pessoas; mesaId? }; NovaEntradaEspera = { nome; pessoas; telefone? }

// lib/admin/dados/reservas-demo.ts
export function reservasDemo(mesas: Mesa[], agora: Date): { reservas: Reserva[]; espera: EntradaEspera[] }

// consultas-mesas: useReservas, useEspera, useCriarReserva, useEditarReserva, useCancelarReserva,
// useNaoCompareceu, useSentarReserva, useEntrarNaEspera, useChamarDaEspera, useSentarDaEspera, useDesistirDaEspera
// components/admin/mesas/aviso-reserva.tsx: useReservaDaVez() → (mesa) => Reserva | undefined; <AvisoReserva />
// components/admin/mesas/reservas-espera.tsx: <PainelReservas />; sentar.tsx: <Sentar />
// MesaNaGrade ganha reserva?: Reserva
```

**Arquivos**

- Criar:
  - `lib/admin/regras/reservas.ts` e `reservas.test.ts`;
  - `lib/admin/dados/reservas-demo.ts` e `reservas-demo.test.ts`;
  - `lib/admin/dados/servidor-reservas.test.ts`;
  - `components/admin/mesas/{aviso-reserva,reservas-espera,formulario-reserva,sentar}.tsx` e `reservas-espera.test.tsx`.
- Mudar:
  - `lib/admin/dados/servidor.ts` (e `servidor-movimentacoes.test.ts`, `servidor.test.ts`), `consultas-mesas.ts` (e o teste);
  - `lib/admin/regras/filtro-mesas.ts`;
  - `components/admin/mesas/{pagina-mesas,cartao-mesa,estado-grade,abrir-mesa,transferir-mesa,transferir-itens,juntar-mesas,configurar-salao,comanda-mesa}.tsx` e os testes deles;
  - `components/admin/garcom/pagina-garcom.tsx` e o teste;
  - `tests/admin.spec.ts`.

### Task 68 (Tarefa 68): regras das reservas

- [ ] Testes que falham em `reservas.test.ts`, um comportamento por vez (agora 20:30, antecedência 30, tolerância 15):
  - `reservaDaMesa`: a reserva das 20:50 da mesa vale às 20:30 e às 21:05; às 20:19 e às 21:06 não; a de outra mesa, a cancelada e a que sentou não; com duas na janela, a mais cedo;
  - `statusDaReserva`: a marcada das 20:10 continua marcada às 20:25 e às 20:26 vira "nao-compareceu"; as gravadas voltam como estão;
  - `reservaEmConflito`: outra ativa na mesma mesa às 22:00 conflita com 20:50 (1h10) e às 22:50 não (2 h); a da mesa vizinha, a ignorada e a vencida não;
  - `sugerirMesa`: para 3 pessoas entre mesas de 2, 4, 4 e 8 lugares, a 4 de menor número; pula bloqueada, juntada, ocupada, em limpeza e com reserva em conflito; para as 22:30 a ocupada agora entra; sem mesa que caiba, nada;
  - `sugestoesDaEspera`: o primeiro da fila fica com a menor; o segundo com a próxima que sobra; quem não cabe fica sem;
  - `chamadaPeloWhatsApp("(12) 99123-4567", "Pizzaria Bella")` → "https://wa.me/5512991234567?text=Ol%C3%A1!%20Sua%20mesa%20na%20Pizzaria%20Bella%20est%C3%A1%20pronta.%20Pode%20vir%2C%20estamos%20te%20esperando.";
  - `conferirReserva`: nome vazio, telefone com 9 números, sem horário, horário passado (20:29), pessoas 0; o certo devolve o `inicio` de hoje às 20:50 (ISO) e o telefone só com dígitos;
  - `conferirEspera`: nome vazio, pessoas 100, telefone curto; o certo devolve os dados limpos.
- [ ] Implementar e fazer o commit `feat(mesas): regras das reservas e da lista de espera`.

### Task 69 (Tarefa 69): reservas no servidor

- [ ] Testes que falham em `servidor-reservas.test.ts` (lanchonete de teste, sexta 13/11/2026 às 20:30):
  - criar grava e `listar` devolve as de hoje pelo horário (a de ontem, posta direto na base, fica de fora);
  - recusas, uma por teste: nome vazio, telefone curto, pessoas 0, horário passado, outro dia, mesa inexistente, mesa bloqueada, conflito ("A mesa 1 já tem reserva às 20:50.");
  - editar troca os dados (sem mudar o horário passado, ele não é conferido de novo) e não conflita consigo; editar a cancelada recusa ("Essa reserva não está mais marcada.");
  - cancelar e não compareceu gravam o status; a mesa deixa de estar reservada (abrir sem confirmação passa);
  - `abrir` e `transferir` usam a janela de `reservaDaMesa` (os testes antigos continuam verdes).
- [ ] Implementar e fazer o commit `feat(mesas): criar, editar, cancelar e marcar a reserva que não veio`.

### Task 70 (Tarefa 70): sentar a reserva

- [ ] Testes que falham em `servidor-reservas.test.ts`:
  - sentar a reserva da mesa 1 abre a mesa com o nome e as pessoas, o garçom e o evento "Mesa aberta para 2 pessoas"; a reserva fica `sentou`, sem pedir confirmação;
  - sentar sem mesa na reserva usa a `mesaId` dada e guarda nela; sem nenhuma, "Escolha a mesa.";
  - a atrasada (20:50 sentada às 21:10) senta; a cancelada recusa;
  - outra reserva da vez na mesa escolhida pede `confirmarReserva`.
- [ ] Implementar (o miolo de `abrir` vira `abrirComanda`) e fazer o commit `feat(mesas): sentar a reserva abre a mesa com o nome e as pessoas`.

### Task 71 (Tarefa 71): lista de espera no servidor

- [ ] Testes que falham em `servidor-reservas.test.ts`: entrar (com as recusas de nome, pessoas e telefone); listar só quem espera, pela chegada; chamar grava `chamadaEm`; desistir tira da lista; sentar abre a mesa com nome e pessoas e tira da lista; sentar quem desistiu recusa ("Essa pessoa não está mais na espera.").
- [ ] Implementar e fazer o commit `feat(mesas): lista de espera no servidor: entrar, chamar, sentar e desistir`.

### Task 72 (Tarefa 72): a mesa com reserva não some

- [ ] Testes que falham: excluir e bloquear a mesa com reserva ativa recusam (a vencida e a cancelada não impedem) em `servidor-reservas.test.ts`; em `servidor-movimentacoes.test.ts`, juntar a mesa reservada recusa sem `confirmarReserva` e junta com ela.
- [ ] Implementar e fazer o commit `feat(mesas): excluir e bloquear respeitam a reserva, e juntar aceita a confirmação`.

### Task 73 (Tarefa 73): demonstração e virada do dia

- [ ] Testes que falham em `reservas-demo.test.ts` (as reservas e a espera das decisões, a mesa 13 ocupada deixa a reserva sem mesa, a das 23:00 + 2 h não entra) e em `servidor-reservas.test.ts` (o catálogo com `funcoes.reservas` ligada abre com elas; na virada a marcada de ontem vira `nao-compareceu`, a espera de ontem `desistiu`, e o dia novo ganha a demonstração dele).
- [ ] Mudar os testes antigos que contam as livres da demonstração (`pagina-mesas.test.tsx`: "8 livres", mudança planejada).
- [ ] Implementar e fazer o commit `feat(mesas): a demonstração tem 2 reservas e 3 pessoas na espera`.

### Task 74 (Tarefa 74): hooks

- [ ] Testes que falham em `consultas-mesas.test.tsx`: `useReservas` e `useEspera` leem o servidor; criar, sentar (reserva e espera), entrar e desistir chegam ao servidor e invalidam.
- [ ] Implementar e fazer o commit `feat(mesas): hooks das reservas e da espera`.

### Task 75 (Tarefa 75): Reservada na grade, no mapa, no filtro e no Garçom

- [ ] Testes que falham:
  - `pagina-mesas.test.tsx`: a mesa 13 diz "Reservada 20:50" e "Marina Costa · 2 pessoas"; o filtro oferece "Reservada" e `?estado=reservada` mostra só a 13 (os dois testes antigos de "não oferece Reservada" mudam, mudança planejada);
  - `mapa-salao.test.tsx`: a 13 no mapa da Varanda com a mesma descrição;
  - `pagina-garcom.test.tsx`: "Mesa 13 · reservada 20:50".
- [ ] Implementar e fazer o commit `feat(mesas): a mesa reservada na grade, no mapa, no filtro e no Garçom`.

### Task 76 (Tarefa 76): confirmação de reserva na tela

- [ ] Testes que falham (pizzaria, 20:30): a gaveta da 13 avisa "Reservada às 20:50 para Marina Costa, 2 pessoas.", e "Abrir mesmo assim" abre; "Sentar Marina Costa" senta a reserva; Transferir e Transferir itens para a 13 avisam e transferem com "Transferir mesmo assim"; Juntar a 13 avisa e junta com "Juntar mesmo assim".
- [ ] Implementar `aviso-reserva.tsx` e os quatro fluxos. Commit `feat(mesas): confirmar a reserva ao abrir, transferir e juntar`.

### Task 77 (Tarefa 77): painel de reservas

- [ ] Testes que falham em `reservas-espera.test.tsx`:
  - o painel "Reservas e espera" lista Marina Costa às 20:50 na mesa 13 e Roberto Andrade às 22:30 sem mesa;
  - "Nova reserva" valida ao enviar (as mensagens de `conferirReserva` nos campos) e, com 4 pessoas às 21:00, sugere "mesa 8" com "Usar a mesa 8"; salvar mostra a reserva na lista;
  - Editar, Não compareceu e Cancelar pelo ⋯; às 21:06 a reserva da Marina diz "Não compareceu";
  - o erro do servidor aparece no aviso.
- [ ] Implementar e fazer o commit `feat(mesas): painel das reservas do dia`.

### Task 78 (Tarefa 78): sentar e a espera na tela

- [ ] Testes que falham em `reservas-espera.test.tsx`:
  - a aba Espera lista Carlos (há 25 min, chamado há 2 min), Juliana e Pedro, com as sugestões 11, 8 e 10; um minuto depois, "há 26 min";
  - "Chamar" do Pedro é um link para o WhatsApp numa aba nova e grava a chamada; o da Juliana (sem telefone) só grava;
  - "Entrar na espera" valida e põe no fim da fila; "Desistiu" tira;
  - "Sentar" da Juliana já vem com a mesa 8 e o garçom do aparelho: senta, a mesa 8 fica ocupada com "Juliana Rocha" e ela sai da fila; "Sentar" da Marina abre a mesa 13.
- [ ] Implementar `sentar.tsx` e a aba Espera. Commit `feat(mesas): lista de espera, chamar pelo WhatsApp e sentar`.

### Task 79 (Tarefa 79): cadeado Pro e Configurar salão

- [ ] Testes que falham:
  - `reservas-espera.test.tsx`, com `funcoes.reservas` desligada: o bloco com o selo Pro, "R$ 24,90" e "Abrir Configurar salão", sem as abas;
  - `configurar-salao.test.tsx`: o interruptor "Reservas e lista de espera" grava `funcoes.reservas`; antecedência e tolerância gravam os minutos, e 700 mostra o erro do servidor. O teste antigo "reservas e QR não aparecem…" vira "o QR não aparece…" (mudança planejada: as reservas entraram no painel).
- [ ] Implementar e fazer o commit `feat(mesas): reservas com cadeado Pro e ajustes em Configurar salão`.

### Task 80 (Tarefa 80): E2E e fechamento

- [ ] Em `tests/admin.spec.ts`: na pizzaria às 20:30, nova reserva para as 21:00 com 4 pessoas na mesa 8; às 20:40 a mesa 8 diz "Reservada 21:00"; "Sentar" a reserva com o garçom; a mesa 8 ocupada com o nome; receber a conta (o couvert) e a mesa vai para Limpeza. Rodar só ele, em `desktop-1920` e `celular-390`.
- [ ] `pnpm check`, mostrando a saída. `pnpm test:coverage` e subir os mínimos se a cobertura subiu.
- [ ] Os screenshots ficam para a revisão.
- [ ] Registrar a "Situação" no fim desta seção.

Situação: pronta em 22/11/2026, na branch `claude/admin-mesas-fase-7`, empilhada sobre a Fase 6, antes da revisão. O PR sai depois que as Fases 1 a 6 estiverem no `main`.

- **Mudou fora do plano:**
  - a confirmação de reserva na tela ganhou o arquivo de teste próprio, `aviso-reserva.test.tsx`, e "Entrar na espera" ganhou o componente `entrar-na-espera.tsx` (botão "Pôr na fila");
  - as abas do painel dizem a contagem: "Reservas 2" (as marcadas dentro da tolerância) e "Espera 3";
  - com o painel à direita a partir de 1280 px, a grade passa a ter 5 colunas só de 1536 px para cima (`2xl`; antes, `xl`);
  - o E2E escolhe a mesa 8 na lista: às 20:30, para as 21:15 (fora da antecedência), a sugestão para 4 pessoas é a mesa 1, ocupada agora (a regra deixa a ocupada entrar para mais tarde). A conta ganha uma Água antes de fechar, porque a comanda vazia só oferece "Liberar mesa";
  - minutos da reserva fora de 0 a 600 em Configurar salão mostram a mensagem que o esquema já tinha ("Informe os minutos.").
- **Testes antigos que mudaram (mudança de comportamento planejada):**
  - `pagina-mesas.test.tsx`: o resumo passa a "8 ocupadas · 8 livres" (a 13 fica reservada); "o filtro de estado não oferece Reservada" virou "oferece Reservada, depois de Livre"; "?estado=reservada não filtra" virou "mostra só a mesa 13"; "uma seção por área…" passa a esperar o título "Reservas e espera" antes das áreas; os dois que contavam todos os `listitem` da página (`?estado=bloqueada` e "Precisam de atenção") passam a contar os botões das mesas (`/^Mesa \d+$/`), porque o painel também tem listas;
  - `movimentacoes.test.tsx`: "?estado=juntada mostra só a 16" conta os botões das mesas, pelo mesmo motivo;
  - `configurar-salao.test.tsx`: "reservas e QR não aparecem…" virou "o QR não aparece…" (as reservas entraram no painel).
- **Testes que passaram de primeira**, porque a regra já saía do desenho de outra fatia: em `reservas.test.ts`, "quem conta" em `reservaDaMesa` e "sem mesa que caiba"; em `servidor-reservas.test.ts`, a reserva de ontem fora da lista, as recusas de sentar (mesa dada, atrasada, cancelada, outra reserva da vez; a exclusão da própria reserva foi conferida tirando-a do código e vendo o vermelho) e a reserva vencida ou cancelada que não impede excluir e bloquear; em `mapa-salao.test.tsx`, a mesa 13 no mapa (o mapa recebe as linhas da grade).
- **Fica para depois:**
  - reservar para outro dia (o painel é "do dia");
  - confirmação antes de cancelar a reserva e desfazer o cancelamento;
  - "Sentar a reserva" no menu ⋯ da mesa reservada (hoje está na gaveta e no painel);
  - entradas `salao.reservas` no `CATALOGO_PRO` (Fase 8, com as outras);
  - avisar sozinho quando uma mesa libera (a sugestão aparece na fila, sem som nem destaque);
  - os E2E antigos e os screenshots não foram rodados nesta fase (ficaram para a revisão).
- **Telas que mudam nos screenshots** (para a revisão):
  - pela tela e pela demonstração: `painel-mesas-*` (o painel "Reservas e espera", a 13 "Reservada 20:50" com "Marina Costa · 2 pessoas", "8 livres", a grade com 4 colunas entre 1280 e 1535 px), `painel-mapa-*` e `painel-mapa-edicao-*` (a 13 reservada no mapa da Varanda não aparece no Salão, mas o painel fica ao lado), `painel-configurar-salao-*` (o interruptor de reservas em Funções Pro e o bloco Reservas);
  - por trás das janelas e da gaveta: `painel-comanda-*`, `painel-comanda-conta-*`, `painel-receber-conta-*`, `painel-adicionar-itens-*`, `painel-abrir-mesa-*`, `painel-nova-mesa-*`, `painel-atalhos-mesas-*`, `painel-transferir-mesa-*`, `painel-juntar-mesas-*` (a 13 "reservada 20:50" na lista) e `painel-transferir-itens-*`;
  - sem screenshot ainda: a janela "Nova reserva", "Sentar" e "Entrar na espera", a aba Espera e o painel com o cadeado Pro.
- **Testes e cobertura:** 1801 testes no Vitest (`pnpm check` verde). O E2E novo ("mesas: reservar a mesa 8, chegar a hora, sentar a reserva e fechar a conta") passou em `desktop-1920` e `celular-390`, contra o `next start` na porta 3010. A cobertura ficou em 85,42/78,64/83,81/86,45 no geral: os mínimos sobem para 85/78/83/86; `lib/**` continua em 98/95/98/98.

## Fase 8: QR na mesa

**Desenho:**

- vitrine em modo mesa: a rota e o parâmetro seguem o roteamento atual da vitrine (ler `node_modules/next/dist/docs/` antes);
- pedido do cliente "aguardando aceite" ou direto;
- chamados com selo, som, contador e Atender;
- `BroadcastChannel("clickpedido-admin")` invalida as consultas das outras abas. Ele também esvazia a cópia em memória do servidor de demonstração (`carregar()`), e cada gravação parte da leitura mais recente do IndexedDB, para uma aba desatualizada não apagar o que a outra gravou (achado da revisão da Fase 2);
- simular cliente e folha de QR em A4;
- entradas `salao.mapa`, `salao.reservas` e `salao.qr` no `CATALOGO_PRO` (preços da decorrência 6);
- cenário de demonstração com 1 chamado aberto.

**Fronteiras de teste**

1. **Servidor:**
   - pedido do cliente: aceite, direto e abrir a mesa pelo QR (ligado e desligado);
   - mesa bloqueada ou inexistente é recusada com "Mesa indisponível.";
   - chamado e atender (com o tempo de resposta);
   - chamado de conta marca `contaPedidaEm`.
2. **`lib/admin/regras/`:** tempo médio de atendimento para o "ver mais".
3. **Componentes:**
   - vitrine em modo mesa sem entrega e sem pagamento;
   - selo e contador de chamados;
   - aceitar o pedido;
   - folha de QR com uma URL por mesa;
   - cadeado Pro.
4. **E2E:** simular o cliente, pedir, aceitar no painel, chamar o garçom e atender, mais o screenshot da folha de QR.
