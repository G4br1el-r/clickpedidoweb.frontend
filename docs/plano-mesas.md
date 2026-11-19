# Plano da tela de Mesas

> **Para quem for executar:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`, tarefa por tarefa. Os passos usam `- [ ]` para acompanhar. TDD é obrigatório (CLAUDE.md): nenhum código de produção sem um teste falhando antes.

**Objetivo:** transformar a tela de Mesas do painel no centro de operação do salão: abrir, lançar, mover, dividir e receber, com mapa, reservas, lista de espera e pedido pelo QR.

**Arquitetura:** as regras (estado da mesa, conta, divisão, alertas, mapa, reservas) ficam em `lib/admin/regras/` como funções puras. As operações ficam no servidor de demonstração (`lib/admin/dados/servidor.ts`, IndexedDB), expostas por hooks React Query em `lib/admin/dados/consultas-mesas.ts`. As telas só chamam.

**Tecnologias:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rota), React Query, zustand, zod, `@dnd-kit` (mapa), `qrcode.react` (QR), `react-to-print` (cupons), Motion, Vitest + Testing Library, Playwright. Nenhuma dependência nova.

**Origem:** as decisões Q1 a Q52 da sessão de perguntas de 18 e 19/11/2026, registradas abaixo. Base anterior: Fase 8 de [plano-painel-admin.md](plano-painel-admin.md).

**Situação:** aguarda revisão. Só a Fase 1 tem passo a passo. Cada fase seguinte ganha o seu quando a anterior for mesclada, já sobre o código real.

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

| Estado          | Rótulo            | Tom         | Quando                                                        |
| --------------- | ----------------- | ----------- | ------------------------------------------------------------- |
| `bloqueada`     | Bloqueada         | `cancelado` | `mesa.bloqueio` existe                                        |
| `juntada`       | Com a mesa 4      | `caminho`   | `mesa.juntadaCom` aponta a principal                          |
| `conta-pedida`  | Pediu a conta     | `novo`      | ocupada e `comanda.contaPedidaEm`                             |
| `servir`        | Servir            | `pronto`    | ocupada e `comanda.servirDesde` (a cozinha terminou a rodada) |
| `na-cozinha`    | Na cozinha        | `preparo`   | ocupada e a comanda está em `recebido` ou `em-preparo`        |
| `ocupada`       | Ocupada           | `caminho`   | ocupada, sem nenhum dos acima                                 |
| `limpeza`       | Limpeza           | `espera`    | livre e `mesa.limpezaDesde` (só com a limpeza ligada)         |
| `reservada`     | Reservada 20:00   | `espera`    | livre e há reserva marcada a menos da antecedência (30 min)   |
| `livre`         | Livre             | `fim`       | o resto                                                       |

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

    | Segmento   | Taxa de serviço | Couvert          |
    | ---------- | --------------- | ---------------- |
    | Pizzaria   | 10%, ligada     | R$ 8,00, ligado  |
    | Adega      | 10%, ligada     | desligado        |
    | Açougue    | 10%, ligada     | desligado        |
    | Lanchonete | desligada       | desligado        |

  - limpeza ligada nos 4 segmentos.
- **Migração:** quem tem a versão 2 salva não perde nada. Todas as mesas vão para a área "Salão", com 4 lugares, forma quadrada e posições em fileiras de 6. Taxa, couvert e limpeza começam desligados. Os garçons saem dos nomes já usados nas comandas.

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
  for (const mesa of mesas) expect(mesa).toMatchObject({ areaId: "area-salao", lugares: 4, forma: "quadrada" })
})
test("posições em fileiras de 6, a cada 4 células", () => {
  expect(migrarDaVersao2(baseV2).mesas.map((mesa) => mesa.posicao)).toEqual([
    { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }, { x: 12, y: 0 }, { x: 16, y: 0 }, { x: 20, y: 0 },
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
  expect(migrarDaVersao2(baseV2).salao.garcons.map((garcom) => garcom.nome)).toEqual(["Bia", "Paula"])
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
  await set("clickpedido-admin-dados:pizzaria", { versao: 2, geradoEm: AGORA.toISOString(), base: antiga })
  const api = servidor()
  const mesas = await api.mesas.listar()
  expect(mesas.every((mesa) => mesa.areaId === "area-salao")).toBe(true)
  const ocupada = mesas.find((mesa) => mesa.status === "ocupada")
  expect(ocupada?.pedidoAtivoId).toBe(antiga.mesas.find((mesa) => mesa.status === "ocupada")?.pedidoAtivoId)
  expect((await get("clickpedido-admin-dados:pizzaria")).base.pedidos).toHaveLength(antiga.pedidos.length)
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
  const area = (numero: number) => salao.areas.find((a) => a.id === mesas.find((m) => m.numero === numero)?.areaId)?.nome
  expect([1, 10, 11, 16, 17, 20].map(area)).toEqual(["Salão", "Salão", "Varanda", "Varanda", "Balcão", "Balcão"])
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
  expect(salaoDemo("lanchonete").mesas.find((m) => m.numero === 20)?.bloqueio).toEqual({ motivo: "Em manutenção" })
})
test.each(["adega", "acougue", "pizzaria", "lanchonete"] as const)("%s: nenhuma mesa se sobrepõe nem sai do mapa", (segmento) => {
  // retângulos de tamanhoDaMesa na mesma área não se cruzam; x + largura ≤ 24 e y + altura ≤ 16
})
test("taxa e couvert por segmento; limpeza ligada em todos", () => {
  expect(salaoDemo("pizzaria").salao).toMatchObject({ taxaServico: { ativa: true, percentual: 10 }, couvert: { ativo: true, porPessoa: 8 }, limpeza: true })
  expect(salaoDemo("adega").salao).toMatchObject({ taxaServico: { ativa: true, percentual: 10 }, couvert: { ativo: false }, limpeza: true })
  expect(salaoDemo("acougue").salao).toMatchObject({ taxaServico: { ativa: true }, couvert: { ativo: false } })
  expect(salaoDemo("lanchonete").salao).toMatchObject({ taxaServico: { ativa: false }, couvert: { ativo: false } })
})
test("garçons da demonstração", () => {
  expect(salaoDemo("pizzaria").salao.garcons.map((g) => g.nome)).toEqual(["Lucas", "Paula", "Rafa", "Bia"])
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
  expect(primeiraPosicaoLivre([ocupada], "a", { forma: "quadrada", lugares: 4 })).toEqual({ x: 2, y: 0 })
  expect(primeiraPosicaoLivre([ocupada], "b", { forma: "quadrada", lugares: 4 })).toEqual({ x: 0, y: 0 })
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
  const outras = (await api.mesas.listar()).filter((m) => m.id !== mesa.id && m.areaId === mesa.areaId)
  // não se sobrepõe a nenhuma outra
})
test("lugares fora de 1 a 20 e área que não existe são recusados", async () => {
  await expect(servidor().mesas.criar({ numero: 31, lugares: 0 })).rejects.toThrow("Informe de 1 a 20 lugares.")
  await expect(servidor().mesas.criar({ numero: 31, areaId: "nada" })).rejects.toThrow("Escolha uma área do salão.")
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
  expect(estadoDaMesa({ status: "ocupada", bloqueio: {} }, { status: "recebido" })).toEqual({ estado: "bloqueada", rotulo: "Bloqueada", tom: "cancelado" })
})
test("juntada mostra a principal", () => {
  expect(estadoDaMesa({ status: "ocupada", juntadaCom: "mesa-4" }, undefined, { principal: { numero: 4 } }).rotulo).toBe("Com a mesa 4")
})
test("pediu a conta vence servir e cozinha", () => {
  expect(estadoDaMesa({ status: "ocupada" }, { status: "recebido", contaPedidaEm: "x", servirDesde: "y" })).toMatchObject({ estado: "conta-pedida", rotulo: "Pediu a conta", tom: "novo" })
})
test("rodada pronta para servir", () => {
  expect(estadoDaMesa({ status: "ocupada" }, { status: "pronto", servirDesde: "y" })).toMatchObject({ estado: "servir", rotulo: "Servir", tom: "pronto" })
})
test("livre em limpeza", () => {
  expect(estadoDaMesa({ status: "livre", limpezaDesde: "x" }, undefined)).toMatchObject({ estado: "limpeza", rotulo: "Limpeza", tom: "espera" })
})
test("reservada só a partir da antecedência", () => {
  const reserva = { inicio: "2026-11-19T20:00:00-03:00" }
  expect(estadoDaMesa({ status: "livre" }, undefined, { reserva, agora, antecedenciaMin: 30 })).toMatchObject({ estado: "reservada", rotulo: "Reservada 20:00", tom: "espera" })
  expect(estadoDaMesa({ status: "livre" }, undefined, { reserva, agora, antecedenciaMin: 15 }).estado).toBe("livre")
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
  [{ areas: [{ id: "a", nome: "Varanda", ordem: 1 }, { id: "b", nome: " varanda ", ordem: 2 }] }, "Já existe a área Varanda."],
  [{ garcons: [{ id: "g", nome: "", ativo: true }] }, "Informe o nome do garçom."],
  [{ alertas: { ...padrao.alertas, semPedidoMin: 0 } }, "Os alertas vão de 1 a 600 minutos."],
])("recusa %o com a mensagem certa", (mudanca, mensagem) => { /* safeParse → primeira mensagem */ })
test("nomes de área e garçom são aparados e limitados a 30 e 40 caracteres", () => { /* … */ })
```

Em `servidor.test.ts`:

```ts
test("salvar a configuração guarda e devolve; a próxima leitura vê a mudança", async () => { /* … */ })
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

## Fase 2: grade nova

**Desenho:**

- grade agrupada por área, com o cartão desenhado para cada estado;
- faixa dos 4 números com "ver mais";
- busca e filtros no endereço, e o filtro "Precisam de atenção";
- menu ⋯ com: abrir comanda, editar, bloquear e desbloquear, marcar limpa e excluir;
- painel "Configurar salão" (áreas, garçons, taxa, couvert, limpeza, alertas);
- atalhos com a folha `?` (o `M` entra na Fase 6, junto com o mapa);
- atualização a cada 4 s.

Antes de mudar o visual, conferir que `painel-mesas-*` está atualizado com a Fase 1.

**Fronteiras de teste**

1. **`lib/admin/regras/alertas-mesa.ts`:** `alertasDaMesa(mesa, comanda, config, agora)` com os quatro limites, testando 1 min antes e no minuto exato.
2. **`lib/admin/regras/indicadores-salao.ts`:**
   - ocupação ("12/20 · 60%", sem contar as bloqueadas);
   - pessoas no salão;
   - faturamento hoje (decorrência 5);
   - ticket por pessoa e por mesa;
   - permanência média e giro.
3. **`lib/admin/regras/filtro-mesas.ts`:** busca sem acento e sem maiúscula, filtros combinados e as duas ordens.
4. **Servidor:**
   - editar (número único);
   - bloquear e desbloquear (recusa mesa ocupada);
   - marcar limpa;
   - fechar a conta com limpeza ligada deixa `limpezaDesde`.
5. **Componentes:**
   - grade por área;
   - cartão por estado (nome falado pelo título, estado na descrição, como hoje);
   - filtros lidos e escritos no endereço;
   - menu ⋯ por estado;
   - editar, Configurar salão e atalhos (Enter com número abre a mesa, e os atalhos não disparam dentro de um campo).
6. **E2E:** filtrar por "Precisam de atenção", bloquear e desbloquear, e screenshots claro e escuro no celular e no desktop.

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
- `BroadcastChannel("clickpedido-admin")` invalida as consultas das outras abas;
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
