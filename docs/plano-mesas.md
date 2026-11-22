# Plano da tela de Mesas

> **Para quem for executar:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`, tarefa por tarefa. Os passos usam `- [ ]` para acompanhar. TDD é obrigatório (CLAUDE.md): nenhum código de produção sem um teste falhando antes.

**Objetivo:** transformar a tela de Mesas do painel no centro de operação do salão: abrir, lançar, mover, dividir e receber, com mapa, reservas, lista de espera e pedido pelo QR.

**Arquitetura:** as regras (estado da mesa, conta, divisão, alertas, mapa, reservas) ficam em `lib/admin/regras/` como funções puras. As operações ficam no servidor de demonstração (`lib/admin/dados/servidor.ts`, IndexedDB), expostas por hooks React Query em `lib/admin/dados/consultas-mesas.ts`. As telas só chamam.

**Tecnologias:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rota), React Query, zustand, zod, `@dnd-kit` (mapa), `qrcode.react` (QR), `react-to-print` (cupons), Motion, Vitest + Testing Library, Playwright. Nenhuma dependência nova.

**Origem:** as decisões Q1 a Q52 da sessão de perguntas de 18 e 19/11/2026, registradas abaixo. Base anterior: Fase 8 de [plano-painel-admin.md](plano-painel-admin.md).

**Situação:** a Fase 1 ficou pronta em 19/11/2026 e está no PR #1. A Fase 2 ficou pronta em 21/11/2026, na branch `claude/admin-mesas-fase-2`, empilhada sobre a Fase 1. A Fase 3 está em andamento na branch `claude/admin-mesas-fase-3`, empilhada sobre a Fase 2. As Fases 1, 2 e 3 já têm passo a passo. Cada fase seguinte ganha o seu quando a anterior estiver pronta, já sobre o código real.

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

- **Item preparado:** é o item que foi para a cozinha e é de uma rodada anterior à última rodada da cozinha, ou da última rodada com a comanda em preparo ou pronta. É a mesma leitura da tela da cozinha, que mostra as rodadas anteriores como já servidas. O item lançado sem cozinha (bebida pronta) nunca conta como preparado: sai devolvendo o estoque, sem motivo. A regra mora em `cozinhaJaPreparou` (`lib/admin/regras/cozinha.ts`), que passa a contar as rodadas anteriores.
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
  - lançar numa mesa com a conta pedida limpa `contaPedidaEm`, a tela avisa "A mesa 1 tinha pedido a conta e voltou para Ocupada." e a mesa volta ao estado do lançamento (Na cozinha ou Ocupada).
- **Editar item (Q29):** troca a observação e, no item do cardápio, as opções (o preço é refeito no servidor). As escolhas passam a ser guardadas no item (`ItemPedido.escolhas`) para a janela abrir marcada. Item já preparado recusa: "A cozinha já preparou Calabresa. Tire com motivo e lance de novo.". Item sem escolhas guardadas (lançado antes desta fase) só troca a observação.
- **Tirar e diminuir (Q10, Q38):**
  - item preparado só sai com motivo ("Diga o motivo para tirar o que a cozinha já preparou."), aparado e cortado em 140;
  - diminuir um item preparado é tirar parte dele, com a mesma regra;
  - item preparado não aumenta: "A cozinha já preparou Calabresa. Lance de novo para pedir mais.";
  - no estoque, o item não preparado devolve (movimento "devolucao", como hoje). O preparado não volta: a venda é desfeita e o mesmo tanto sai como **perda**, com o motivo. São dois movimentos com o saldo igual ao de antes, para o histórico do estoque continuar somando certo.
- **Cancelar comanda (Q36):** comanda vazia continua saindo por "Liberar mesa". Com itens, "Cancelar comanda" exige motivo, deixa a comanda cancelada com `motivoCancelamento: "outro"` e o texto em `detalheCancelamento`, aplica o estoque item a item (preparado vira perda) e libera a mesa sem passar pela limpeza. Em Pedidos, o detalhe mostra "Motivo: Outro · Cliente foi embora".
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

  O `por` é o garçom escolhido ao abrir (no evento `aberta`) e, nas outras ações da tela de Mesas, o nome guardado neste aparelho (`useGarcom`), quando houver. A comanda antiga, sem `eventos`, mostra "Sem histórico registrado.".
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

Situação: implementada em 21/11/2026, na branch `claude/admin-mesas-fase-3`, empilhada sobre a Fase 2. Faltam o E2E rápido completo e a revisão dos screenshots.

- **Mudou fora do plano:**
  - a conta pedida limpa ao lançar entrou na Tarefa 24 (e não na 32), junto com o teste antigo que a fixava;
  - a confirmação com motivo do item preparado entrou na Tarefa 25, para o commit do servidor continuar verde;
  - "Editar" na comanda troca só a observação. O servidor já troca as opções (e guarda as escolhas no item), mas a janela de opções com valores iniciais fica para depois;
  - "Seu nome" no Garçom usa botões, não `datalist` (ver as decisões);
  - os testes de `comanda-mesa.test.tsx` têm 15 s de limite: cada um monta a tela inteira.
- **Testes antigos que mudaram (mudança de comportamento planejada):**
  - "o resumo conta a rodada na cozinha… mesmo com a conta pedida" virou "a rodada lançada depois de pedir a conta limpa o pedido" (Q23);
  - "tirar ou diminuir o que a cozinha já preparou pede confirmação" passa a digitar o motivo (Q10, Q38);
  - "o erro do servidor ao editar" usa a mesa livre 12, porque a 3 está ocupada e o número dela agora trava;
  - a tabela do menu ⋯ em `cartao-mesa.test.tsx` ganha "Marcar servido" em Servir.
- **Fica para depois:**
  - a janela de opções ao editar o item (servidor pronto);
  - a confirmação de reserva na tela, com as reservas (Fase 7);
  - "Imprimir conta" ainda não marca "Pediu a conta": entra com a pré-conta (Fase 4);
  - aumentar a quantidade de um item não preparado não entra no histórico.
- **Testes e cobertura:** 1412 testes no Vitest; os mínimos de cobertura subiram para 83/75/81/84 no geral, e `lib/**` continua em 98/94/98/98. O E2E novo passou em `desktop-1920` e `celular-390`.
- **Telas que mudam no visual:** `painel-mesas-*` (botão "Atalhos do teclado" no cabeçalho), `painel-comanda-*` (abas, "Adicionar itens", "Editar" nos itens), a gaveta da mesa livre (formulário "Abrir mesa" no lugar do convite ao Garçom) e o Garçom (botões dos garçons abaixo de "Seu nome").

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
