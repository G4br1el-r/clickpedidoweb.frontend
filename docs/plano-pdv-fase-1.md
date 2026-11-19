# PDV fase 1: equipe e turno de caixa

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Cada passo é um checkbox (`- [ ]`). TDD obrigatório (CLAUDE.md): nenhum código de produção sem um teste falhando antes.

**Objetivo:** o painel ganha equipe com perfis e PIN, e o PDV passa a vender só com o caixa aberto: abertura, sangria e suprimento com autorização do gerente, painel do turno, fechamento com conferência, reabertura e histórico.

**Arquitetura:** as regras ficam em duas funções puras novas (`lib/admin/regras/equipe.ts` e `lib/admin/regras/caixa.ts`). O servidor falso (`lib/admin/dados/servidor.ts`) ganha as seções `equipe` e `caixa`, que só carregam, conferem pelas regras e gravam. Os hooks ficam em `consultas-equipe.ts` e `consultas-caixa.ts`. Quem está usando o painel fica num store zustand persistido por segmento. A tela de venda atual não muda nesta fase: ela ganha o painel do turno em cima, e o PDV troca de tela conforme o caixa (aberto, fechado, `?tela=fechar`, `?tela=caixas`).

**Tecnologia:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rota), React Query, zustand, nuqs, zod, shadcn, Vitest + Testing Library, Playwright.

**Spec:** [plano-pdv.md](plano-pdv.md) e a prévia aprovada (canvas "Prévia do PDV", telas 1 e 4).

## Restrições globais

- Perfis: `"dono" | "gerente" | "caixa"`. O painel abre como o primeiro Dono ativo.
- PIN: só números, de 4 a 6 dígitos.
- Caixa vê só os módulos `pdv`, `pedidos` e `fila`, e não vê as configurações de aparência. Gerente vê tudo, menos o módulo `equipe` e, na tela da loja, as seções "Formas de pagamento" e "Pagamento online". Dono vê tudo.
- Exigem PIN de gerente ou dono quando quem opera é Caixa: `sangria` e `reabrir-caixa`.
- Padrões da seção "PDV e caixa": fundo sugerido R$ 100,00 e alerta de sangria acima de R$ 500,00.
- Cédulas e moedas da contagem: 200, 100, 50, 20, 10, 5, 2, 1, 0,50, 0,25, 0,10, 0,05.
- Um caixa por loja. Sem caixa aberto, `pdv.finalizar` recusa com "Abra o caixa antes de vender."
- Pix e cartão chegam conciliados no fechamento (contado = esperado). Só o dinheiro é contado.
- Diferença diferente de zero no dinheiro exige justificativa com pelo menos 5 caracteres.
- Equipe de demonstração (os PINs aparecem na tela Equipe para o Dono):

  | id | Nome | Perfil | PIN |
  | --- | --- | --- | --- |
  | `eq-dono` | Carla N. | dono | 1234 |
  | `eq-gerente` | Rafael M. | gerente | 2580 |
  | `eq-marina` | Marina S. | caixa | 1111 |
  | `eq-joao` | João P. | caixa | 2222 |

- Textos em pt-BR, dinheiro pelo `emReais` de `lib/formato`. Números vivos com NumberFlow. Visual segue o `DESIGN.md` (traço de 3 px para estado, laranja só para o alerta de sangria, régua entre fios).
- Formato guardado: `VERSAO` de `servidor.ts` sobe de 2 para 3 (a base antiga é gerada de novo).

## Foco da revisão

1. **Caixa de outra pessoa:** Marina abriu e João entra pelo "Trocar usuário". João não vende, não faz sangria e não fecha o caixa de Marina; o gerente e o dono podem. Teste na tarefa 5.
2. **Recarregar com o caixa aberto:** a página volta direto para a venda, com o mesmo operador. O turno vem do servidor e o usuário do store persistido. Teste na tarefa 7.
3. **Sangria maior que a gaveta:** recusa com "A gaveta só tem R$ X.", na tela e no servidor. Teste nas tarefas 2 e 5.
4. **Trocar de segmento com o caixa aberto:** cada segmento tem o seu caixa e o seu usuário; trocar não fecha nem mistura nada. Teste na tarefa 7.
5. **Dia virou com o caixa aberto:** reabrir no dia seguinte mantém o turno aberto (como numa loja real) e `completar` não gera turno para hoje. Teste na tarefa 4.

---

### Tarefa 1: tipos e regras da equipe

**Arquivos:**
- Modificar: `lib/admin/dados/tipos.ts`, `lib/admin/segmentos-painel.ts` (novo módulo `equipe`)
- Criar: `lib/admin/regras/equipe.ts`
- Teste: `lib/admin/regras/equipe.test.ts`, `lib/admin/segmentos-painel.test.ts`

**Interfaces:**
- Produz (em `tipos.ts`):
  ```ts
  export type PerfilAcesso = "dono" | "gerente" | "caixa"
  export type MembroEquipe = { id: string; nome: string; perfil: PerfilAcesso; pin: string; ativo: boolean }
  ```
  `BaseLoja` ganha `equipe: MembroEquipe[]` e `turnos: TurnoCaixa[]` (o tipo vem na tarefa 2).
- Produz (em `regras/equipe.ts`):
  - `TITULO_PERFIL: Record<PerfilAcesso, string>`, com "Dono", "Gerente" e "Caixa"
  - `type AcaoSensivel = "sangria" | "reabrir-caixa"`
  - `type SecaoLojaRestrita = "pagamentos" | "pagamento-online"`
  - `podeVerModulo(perfil: PerfilAcesso, modulo: ModuloId): boolean`
  - `podeVerAparencia(perfil: PerfilAcesso): boolean`
  - `podeVerSecaoLoja(perfil: PerfilAcesso, secao: SecaoLojaRestrita): boolean`
  - `precisaAutorizacao(perfil: PerfilAcesso, acao: AcaoSensivel): boolean`
  - `podeAutorizar(membro: MembroEquipe): boolean`
  - `errosDoPin(pin: string): string | undefined`
  - `errosDoMembro(dados: Omit<MembroEquipe, "id"> & { id?: string }, equipe: MembroEquipe[]): string | undefined`
  - `membroPadrao(equipe: MembroEquipe[]): MembroEquipe | undefined`
- Produz (em `segmentos-painel.ts`): `ModuloId` ganha `"equipe"`, que entra em todos os segmentos, no grupo "Loja", com título "Equipe", `href` `/admin/equipe` e ícone `UsersIcon`.

- [ ] **Passo 1: testes que falham.** Em `equipe.test.ts`:
  - `"o caixa só vê PDV, pedidos e fila"`: `podeVerModulo("caixa", m)` é true para `pdv`, `pedidos` e `fila`, e false para `visao-geral`, `estoque`, `loja` e `equipe`.
  - `"o gerente vê tudo menos a equipe"`: `podeVerModulo("gerente", "loja")` é true e `podeVerModulo("gerente", "equipe")` é false.
  - `"o gerente não vê pagamentos da loja; o dono vê"`: `podeVerSecaoLoja` para o par gerente × `"pagamentos"` é false, e para dono × `"pagamento-online"` é true.
  - `"só o caixa precisa de autorização"`: para `"sangria"`, caixa dá true e gerente e dono dão false.
  - `"autoriza só gerente ou dono ativo"`: gerente ativo dá true, gerente inativo dá false e caixa dá false.
  - `"PIN tem de 4 a 6 números"`: `"123"`, `"1234567"` e `"12a4"` dão `"O PIN tem de 4 a 6 números."`; `"1234"` e `"123456"` dão `undefined`.
  - `"não deixa o painel sem dono ativo"`: com um único dono, desativá-lo dá `"O painel precisa de um Dono ativo."`. Rebaixá-lo para gerente dá o mesmo erro.
  - `"nome de 2 a 40 letras"`: `"A"` dá `"Diga o nome (2 a 40 letras)."`.
  - `"o padrão é o primeiro dono ativo"`.

  Em `segmentos-painel.test.ts`: `"Equipe aparece em todos os segmentos, no grupo Loja"`.
- [ ] **Passo 2:** `pnpm vitest run lib/admin/regras/equipe.test.ts lib/admin/segmentos-painel.test.ts`. Esperado: FAIL (módulo não existe).
- [ ] **Passo 3:** implementar os tipos, `regras/equipe.ts` e o módulo `equipe`. `podeVerModulo` usa uma lista fixa para o caixa e exclui só `equipe` para o gerente.
- [ ] **Passo 4:** rodar os mesmos testes. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(admin): perfis da equipe e o que cada um vê`.

### Tarefa 2: regras do caixa

**Arquivos:**
- Modificar: `lib/admin/dados/tipos.ts`
- Criar: `lib/admin/regras/caixa.ts`
- Teste: `lib/admin/regras/caixa.test.ts`

**Interfaces:**
- Produz (em `tipos.ts`):
  ```ts
  export type FormaNoCaixa = "dinheiro" | "pix" | "cartao-na-entrega"
  export type MovimentoCaixa = { id: string; tipo: "sangria" | "suprimento"; valor: number; motivo: string; feitoPor: string; autorizadoPor?: string; criadoEm: string }
  export type Conferencia = { esperado: Record<FormaNoCaixa, number>; contado: Record<FormaNoCaixa, number>; justificativa?: string }
  export type TurnoCaixa = { id: string; abertoPor: string; abertoEm: string; fundo: number; movimentos: MovimentoCaixa[]; fechadoPor?: string; fechadoEm?: string; conferencia?: Conferencia; reaberturas?: { em: string; autorizadoPor: string }[] }
  export type ConfigPdv = { fundoSugerido: number; alertaSangria: number }
  ```
  - `ConfigLoja` ganha `pdv?: ConfigPdv`.
  - `Pedido` ganha `turnoId?: string` e `operadorId?: string`.
- Produz (em `regras/caixa.ts`):
  - `CEDULAS: readonly number[]`, na ordem das restrições globais
  - `totalDaContagem(quantidades: readonly number[]): number`, alinhado a `CEDULAS`, em centavos exatos
  - `configPdv(loja: ConfigLoja): ConfigPdv`, que devolve os padrões quando falta `pdv`
  - `type ResumoTurno = { vendas: number; total: number; ticketMedio: number; porForma: Record<FormaNoCaixa, number>; sangrias: number; suprimentos: number; dinheiroNaGaveta: number }`
  - `resumoDoTurno(turno: TurnoCaixa, pedidos: Pedido[]): ResumoTurno`, que conta os pedidos com `turnoId === turno.id` e sem status `cancelado`
  - `precisaSangria(resumo: ResumoTurno, config: ConfigPdv): boolean`
  - `errosDoFundo(fundo: number): string | undefined`
  - `errosDoMovimentoCaixa(m: { tipo: "sangria" | "suprimento"; valor: number; motivo: string }, dinheiroNaGaveta: number): string | undefined`
  - `conferir(resumo: ResumoTurno, contadoDinheiro: number, justificativa?: string): Conferencia`
  - `diferencaDinheiro(c: Conferencia): number`
  - `errosDoFechamento(c: Conferencia): string | undefined`
  - `podeOperarTurno(membro: MembroEquipe, turno: TurnoCaixa): boolean`, que vale para quem abriu ou para perfil diferente de caixa

- [ ] **Passo 1: testes que falham** (valores literais):
  - `"soma a contagem por cédula"`: 1×100, 2×20, 1×10, 1×0,10 e 2×0,05 dão `150.2`.
  - `"dinheiro na gaveta = fundo + vendas em dinheiro + suprimentos − sangrias"`. O turno tem fundo 100, suprimento 50 e sangria 300. Os pedidos são dinheiro 400, Pix 80 e um dinheiro 30 cancelado. Esperado: `dinheiroNaGaveta` 250, `vendas` 2, `total` 480 e `ticketMedio` 240.
  - `"ignora vendas de outro turno"`.
  - `"alerta de sangria só acima do limite"`: gaveta 500 dá false e 500,01 dá true, com `alertaSangria` 500.
  - `"padrões do PDV"`: `configPdv` de uma loja sem `pdv` dá `{ fundoSugerido: 100, alertaSangria: 500 }`.
  - `"recusa movimento sem valor, sem motivo ou sangria maior que a gaveta"`. As mensagens são exatamente estas:
    - `"Informe um valor maior que zero."`
    - `"Diga o motivo."` (motivo com menos de 3 caracteres)
    - `"A gaveta só tem R$ 120,00."`
  - `"fundo de 0 a 9.999"`: −1 e 10000 dão `"O fundo vai de R$ 0,00 a R$ 9.999,00."`.
  - `"conferência: pix e cartão conciliados, dinheiro contado"`: com esperado dinheiro 792,60 e contado 790,60, `diferencaDinheiro` dá `-2`.
  - `"diferença exige justificativa"`: sem justificativa dá `"Justifique a diferença de −R$ 2,00."`; com `"Troco a mais"` dá `undefined`; diferença zero sem justificativa também dá `undefined`.
  - `"opera o turno quem abriu, o gerente ou o dono"`.
- [ ] **Passo 2:** `pnpm vitest run lib/admin/regras/caixa.test.ts`. Esperado: FAIL.
- [ ] **Passo 3:** implementar. Arredonde em centavos (`Math.round(v * 100) / 100`) a cada soma.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(pdv): regras do turno de caixa`.

### Tarefa 3: equipe e turnos de demonstração

**Arquivos:**
- Criar: `lib/admin/dados/equipe-demo.ts`, `lib/admin/dados/gerar-turnos.ts`
- Modificar: `lib/admin/dados/gerar-pedidos.ts` (sem venda de PDV no dia de hoje)
- Teste: `lib/admin/dados/gerar-turnos.test.ts`, `lib/admin/dados/gerar-pedidos.test.ts`

**Interfaces:**
- Consome: `sorteadorDaSemente` (de `gerar-pedidos.ts`) e `resumoDoTurno`, `conferir` e `CEDULAS` (tarefa 2).
- Produz:
  - `EQUIPE_DEMO: readonly MembroEquipe[]`, a tabela das restrições globais
  - `gerarTurnos({ pedidos, agora }: { pedidos: Pedido[]; agora: Date }): { turnos: TurnoCaixa[]; pedidos: Pedido[] }`

**Regras do gerador:**
- Um turno por dia anterior a hoje que teve venda do PDV. O id é `turno-AAAAMMDD`.
- Marina abre nos dias pares e João nos ímpares.
- Abre 30 min antes da primeira venda e fecha 20 min depois da última.
- Fundo de R$ 100.
- Sangria do Rafael ("Retirada para o cofre") sempre que a gaveta passa de R$ 500. Ela deixa R$ 100 na gaveta, arredondado a dezenas.
- Em 1 de cada 7 dias, suprimento de R$ 50 ("Reforço de moedas") logo na abertura.
- Em 1 de cada 6 dias, falta de R$ 2 a R$ 10 no dinheiro, com a justificativa "Troco dado a mais".
- Cada pedido do PDV recebe `turnoId` e `operadorId`.

- [ ] **Passo 1: testes que falham.**
  - `"mesmo dia gera os mesmos turnos"`.
  - `"todo pedido do PDV de dias anteriores pertence a um turno fechado"`.
  - `"nenhum turno hoje"`.
  - `"a gaveta nunca passa de R$ 500 depois de uma venda"`: confira com `resumoDoTurno` a cada pedido.
  - `"diferença só com justificativa"`: todo turno com diferença tem justificativa.

  Em `gerar-pedidos.test.ts`: `"hoje não há venda do PDV (o caixa ainda não abriu)"`.
- [ ] **Passo 2:** `pnpm vitest run lib/admin/dados/gerar-turnos.test.ts lib/admin/dados/gerar-pedidos.test.ts`. Esperado: FAIL.
- [ ] **Passo 3:** implementar. No `gerar-pedidos.ts`, a origem `"pdv"` passa a exigir que o pedido seja de um dia anterior a hoje.
- [ ] **Passo 4:** rodar os testes. Esperado: PASS. Rode também `pnpm vitest run lib/admin/dados` inteiro: o teste de estoque da demonstração pode depender das vendas de hoje. Se quebrar, corrija a expectativa só depois de entender o porquê.
- [ ] **Passo 5:** commit `feat(pdv): equipe e turnos de caixa na demonstração`.

### Tarefa 4: servidor, base e equipe

**Arquivos:**
- Modificar: `lib/admin/dados/servidor.ts`
- Teste: `lib/admin/dados/servidor-caixa.test.ts` (novo, no padrão de `servidor-estoque.test.ts`)

**Interfaces:**
- Consome: `EQUIPE_DEMO` e `gerarTurnos` (tarefa 3), e `errosDoMembro` e `errosDoPin` (tarefa 1).
- Produz, dentro de `criarServidor`:
  ```ts
  equipe: {
    listar(): Promise<MembroEquipe[]>
    salvar(dados: Omit<MembroEquipe, "id"> & { id?: string }): Promise<MembroEquipe>
    entrar(id: string, pin: string): Promise<MembroEquipe>
  }
  ```
  - `VERSAO = 3`.
  - `doZero` grava `equipe: EQUIPE_DEMO` e os turnos de `gerarTurnos`.
  - `completar` gera turnos só para os pedidos dos dias novos e mantém um turno que ficou aberto.

- [ ] **Passo 1: testes que falham.**
  - `"a base nova traz a equipe de demonstração e turnos fechados"`.
  - `"entrar com o PIN certo devolve a pessoa; errado recusa"`: o erro é `"PIN errado."`.
  - `"pessoa desativada não entra"`: o erro é `"Esta pessoa está desativada."`.
  - `"salvar confere pelas regras"`: o PIN `"12"` recusa com a mensagem da tarefa 1.
  - `"salvar cria com id novo e edita pelo id"`.
  - `"no dia seguinte, a base ganha os turnos dos dias que faltavam e nenhum de hoje"`.
- [ ] **Passo 2:** `pnpm vitest run lib/admin/dados/servidor-caixa.test.ts`. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar o teste e depois `pnpm vitest run lib/admin/dados`. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(admin): equipe no servidor de demonstração`.

### Tarefa 5: servidor, caixa e venda com turno

**Arquivos:**
- Modificar: `lib/admin/dados/servidor.ts` (seção `caixa` e `pdv.finalizar`)
- Teste: `lib/admin/dados/servidor-caixa.test.ts` e os casos de `pdv.finalizar` em `servidor.test.ts`

**Interfaces:**
- Consome: as regras das tarefas 1 e 2.
- Produz:
  ```ts
  type Autorizacao = { membroId: string; pin: string }
  caixa: {
    atual(): Promise<TurnoCaixa | null>
    resumo(turnoId: string): Promise<ResumoTurno>
    abrir(d: { operadorId: string; pin: string; fundo: number }): Promise<TurnoCaixa>
    movimentar(d: { operadorId: string; tipo: "sangria" | "suprimento"; valor: number; motivo: string; autorizacao?: Autorizacao }): Promise<TurnoCaixa>
    fechar(d: { operadorId: string; contadoDinheiro: number; justificativa?: string }): Promise<TurnoCaixa>
    reabrir(d: { operadorId: string; turnoId: string; autorizacao?: Autorizacao }): Promise<TurnoCaixa>
    historico(): Promise<{ turno: TurnoCaixa; resumo: ResumoTurno }[]>
  }
  ```
  - `VendaPdv` ganha `operadorId: string`.
  - `finalizar` recusa sem turno aberto e grava `turnoId` e `operadorId` no pedido.
  - Uma função interna `autorizar(base, operadorId, acao, autorizacao?)` lança `"Precisa do PIN de um gerente."` quando falta a autorização e `"PIN do gerente errado."` quando o PIN não confere.

- [ ] **Passo 1: testes que falham** (no `servidor-caixa.test.ts`, com `AGORA` fixo e `clear()` do IndexedDB):
  - `"abre o caixa com PIN e fundo; abrir de novo recusa"`: o erro é `"O caixa já está aberto por Marina S."`.
  - `"abrir com PIN errado recusa"`.
  - `"suprimento do caixa não pede autorização; sangria pede"`: sem a autorização dá `"Precisa do PIN de um gerente."`; com Rafael + 2580 passa e grava `autorizadoPor: "eq-gerente"`.
  - `"sangria do gerente não pede autorização"`.
  - `"sangria maior que a gaveta recusa"`: o erro é `"A gaveta só tem R$ 100,00."`.
  - `"João não mexe no caixa de Marina; Rafael mexe"`: o erro é `"Este caixa está aberto por Marina S."`. Vale para `movimentar`, `fechar` e `pdv.finalizar`.
  - `"fechar confere o dinheiro e exige justificativa"`. Este é o cenário:
    1. abre com fundo de 100;
    2. vende 30 em dinheiro;
    3. fecha com contado 125 sem justificativa e recusa com `"Justifique a diferença de −R$ 5,00."`;
    4. fecha com justificativa e grava `conferencia.contado.dinheiro` como 125.
  - `"reabrir pede o gerente e só vale para o último turno com o caixa fechado"`.
  - `"histórico do mais novo para o mais antigo, com resumo"`.
  - `"no dia seguinte, o turno que ficou aberto continua aberto"`: abra, avance `setSystemTime` um dia, crie um servidor novo e confira `caixa.atual()`.

  No `servidor.test.ts`:
  - ajuste os testes atuais de `pdv.finalizar` para abrir o caixa antes;
  - acrescente `"sem caixa aberto, a venda recusa"`, com o erro `"Abra o caixa antes de vender."`;
  - acrescente `"a venda leva o turno e o operador"`.
- [ ] **Passo 2:** `pnpm vitest run lib/admin/dados/servidor-caixa.test.ts lib/admin/dados/servidor.test.ts`. Esperado: FAIL.
- [ ] **Passo 3:** implementar. As conferências chamam as regras puras. O servidor só carrega, valida e grava.
- [ ] **Passo 4:** rodar os testes. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(pdv): turno de caixa no servidor e venda só com caixa aberto`.

### Tarefa 6: hooks e usuário atual

**Arquivos:**
- Criar: `lib/admin/usuario-atual.ts`, `lib/admin/dados/consultas-equipe.ts`, `lib/admin/dados/consultas-caixa.ts`
- Modificar: `lib/admin/segmento-atual.ts` (`useSegmentoCarregado` também reidrata o usuário)
- Teste: `lib/admin/usuario-atual.test.ts`, `lib/admin/dados/consultas-caixa.test.tsx`

**Interfaces:**
- Produz:
  - `useUsuarioSalvo`: store zustand `persist` chamado `"clickpedido-admin-usuario"`, com `skipHydration`. Estado: `{ porSegmento: Partial<Record<SegmentoPainelId, string>>; entrar(segmento, id): void; sair(segmento): void }`.
  - `useEquipe()`, `useSalvarMembro()`, `useEntrar()` (confere no servidor e grava no store) e `useUsuarioAtual(): { membro: MembroEquipe | undefined; carregando: boolean }` (o salvo, se estiver ativo, senão `membroPadrao`).
  - `useCaixaAtual()`, `useResumoTurno(turnoId?: string)`, `useAbrirCaixa()` (grava o operador no store ao abrir), `useMovimentarCaixa()`, `useFecharCaixa()`, `useReabrirCaixa()`, `useHistoricoCaixas()`.
  - Chaves `["admin", segmento, "caixa", ...]` e `["admin", segmento, "equipe"]`.
  - `useFinalizarVenda` passa o `operadorId` do usuário atual.

- [ ] **Passo 1: testes que falham.**
  - `"o usuário salvo volta depois de recarregar"` (`persist.rehydrate()` + `localStorage`).
  - `"cada segmento tem o seu usuário"`.
  - `"sem nada salvo, o usuário é o dono"`.
  - `"abrir o caixa troca o usuário para quem abriu"`.
  - `"sangria invalida o resumo do turno"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(admin): usuário atual e consultas do caixa`.

### Tarefa 7: menu, páginas e seções por perfil

**Arquivos:**
- Modificar:
  - `lib/admin/segmentos-painel.ts`: `menuDo(segmento, perfil)`
  - `components/admin/menu-modulos.tsx`
  - `components/admin/pagina-modulo.tsx`: aviso de sem acesso
  - `components/admin/barra-lateral-admin.tsx`: grupos de aparência escondidos para o caixa
  - `components/admin/layout-configuracoes.tsx`: sem acesso para o caixa
  - `components/admin/loja/pagina-loja.tsx`: esconde pagamentos para o gerente
- Teste: `menu-modulos.test.tsx`, `pagina-modulo.test.tsx`, `barra-lateral-admin.test.tsx`, `loja/pagina-loja.test.tsx`

**Interfaces:**
- Consome: `podeVerModulo`, `podeVerAparencia` e `podeVerSecaoLoja` (tarefa 1) e `useUsuarioAtual` (tarefa 6).
- Produz: `menuDo(segmento: SegmentoPainelId, perfil: PerfilAcesso = "dono")`.

- [ ] **Passo 1: testes que falham.**
  - `"logada como caixa, o menu só tem PDV, Pedidos e Fila"`.
  - `"o gerente não vê Equipe"`.
  - `"o caixa não vê os grupos de aparência"`.
  - `"/admin/estoque para o caixa avisa que não tem acesso"`: o título é `"Sem acesso a Estoque"` e a descrição `"Peça a um gerente ou troque de usuário no topo."`.
  - `"o gerente não vê Formas de pagamento nem Pagamento online na loja"`.
  - Os dois do Foco da revisão: `"recarregar mantém o operador"` e `"trocar de segmento mostra o usuário daquele segmento"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(admin): menu e páginas por perfil`.

### Tarefa 8: teclado de PIN, trocar usuário e autorização do gerente

**Arquivos:**
- Criar: `components/admin/equipe/teclado-pin.tsx`, `components/admin/equipe/trocar-usuario.tsx`, `components/admin/equipe/janela-autorizacao.tsx`
- Modificar: `components/admin/cabecalho-admin.tsx`
- Teste: os `*.test.tsx` ao lado de cada um

**Interfaces:**
- Produz:
  - `TecladoPin({ id, rotulo, valor, aoMudar, aoConfirmar })`: um campo `type="password"` com `inputMode="numeric"`, máximo de 6, só dígitos, mais o teclado na tela (1–9, Limpar, 0, Apagar) e os pontos.
  - `TrocarUsuario()`: no topo, mostra "Nome · Perfil". Ao clicar ou com `Ctrl+U`, abre a janela "Trocar usuário": escolhe a pessoa, digita o PIN e entra.
  - `JanelaAutorizacao({ aberta, acao, aoFechar, aoAutorizar })`: `aoAutorizar: (a: Autorizacao) => Promise<void>`. Lista gerentes e donos ativos. Se a promessa falhar, mostra o erro e limpa o PIN.

- [ ] **Passo 1: testes que falham.**
  - `"o teclado da tela e o do computador digitam o PIN"`.
  - `"letras não entram no PIN"`.
  - `"Ctrl+U abre Trocar usuário; Marina + 1111 entra e o topo mostra Marina S. · Caixa"`.
  - `"PIN errado mostra 'PIN errado.' e limpa"`.
  - `"a autorização lista só gerente e dono"`.
  - `"a autorização devolve membro e PIN"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar. Use `useHotkeys` como o PDV já faz.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(admin): trocar usuário e autorização do gerente por PIN`.

### Tarefa 9: módulo Equipe

**Arquivos:**
- Criar: `components/admin/equipe/pagina-equipe.tsx`
- Modificar: `components/admin/pagina-modulo.tsx` (`PAGINAS.equipe`)
- Teste: `components/admin/equipe/pagina-equipe.test.tsx`

**Interfaces:**
- Consome: `useEquipe` e `useSalvarMembro` (tarefa 6).
- Produz: a página com `CabecalhoPagina` ("Equipe", resumo "4 pessoas · 1 dono, 1 gerente, 2 no caixa") e a lista em linhas (nome, perfil, ativo, PIN escondido com "Mostrar"). "Adicionar pessoa" e editar abrem uma janela com nome, perfil (controle segmentado), PIN e ativo.

- [ ] **Passo 1: testes que falham.**
  - `"lista a equipe com o perfil"`.
  - `"adiciona Bia, caixa, PIN 3333"`.
  - `"desativar o único dono mostra o erro do servidor"`.
  - `"Mostrar revela o PIN"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(admin): módulo Equipe`.

### Tarefa 10: seção "PDV e caixa" na tela da loja

**Arquivos:**
- Modificar: `lib/admin/regras/esquema-loja.ts` (`pdv` opcional) e `components/admin/loja/pagina-loja.tsx` (seção nova, só quando o segmento tem PDV)
- Teste: `lib/admin/regras/esquema-loja.test.ts`, `components/admin/loja/pagina-loja.test.tsx`

**Interfaces:**
- Consome: `configPdv` (tarefa 2).
- Produz: os campos "Fundo de troco sugerido" e "Alerta de sangria acima de", em `CampoDinheiro`, de 0 a 9.999.

- [ ] **Passo 1: testes que falham.**
  - Esquema: `"aceita pdv com fundo e alerta; recusa negativo"`.
  - Tela: `"muda o alerta para R$ 800 e salva"`.
  - Tela: `"lanchonete não tem a seção"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(pdv): configurações do caixa na tela da loja`.

### Tarefa 11: abertura do caixa

**Arquivos:**
- Criar: `components/admin/pdv/caixa/abertura-caixa.tsx`, `components/admin/pdv/caixa/contagem-cedulas.tsx`
- Modificar: `components/admin/pdv/pagina-pdv.tsx` (sem turno → abertura)
- Teste: `components/admin/pdv/caixa/abertura-caixa.test.tsx` e os testes atuais de `pagina-pdv.test.tsx` (agora abrem o caixa antes)

**Interfaces:**
- Consome: `useEquipe`, `useAbrirCaixa`, `configPdv`, `TecladoPin` e `totalDaContagem`.
- Produz:
  - `ContagemCedulas({ quantidades, aoMudar })`: uma linha por cédula, com `label` "R$ 100" e um campo de quantidade.
  - `AberturaCaixa()`: segue a tela 1 da prévia. O fundo começa no sugerido; mexer na contagem passa a valer o contado.

- [ ] **Passo 1: testes que falham.**
  - `"sem caixa aberto, o PDV mostra Abrir o caixa"`.
  - `"o fundo começa no sugerido"`: R$ 100,00.
  - `"a contagem preenche o fundo"`: 2×50 e 1×20 dão R$ 120,00.
  - `"Marina + 1111 abre e mostra a venda com o painel do turno"`.
  - `"PIN errado mostra o erro"`.
  - Nos testes atuais de `pagina-pdv.test.tsx`: um ajudante `abrirCaixa()` no `beforeEach` (Marina + 1111 pelo servidor). Os 13 casos seguem iguais.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar `pnpm vitest run components/admin/pdv`. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(pdv): abertura do caixa com PIN e contagem`.

### Tarefa 12: painel do turno, sangria e suprimento

**Arquivos:**
- Criar: `components/admin/pdv/caixa/painel-turno.tsx`, `components/admin/pdv/caixa/janela-movimento.tsx`
- Modificar: `components/admin/pdv/pagina-pdv.tsx` (painel em cima da venda; `F11` e `F12`)
- Teste: `components/admin/pdv/caixa/painel-turno.test.tsx`

**Interfaces:**
- Consome: `useCaixaAtual`, `useResumoTurno`, `precisaSangria`, `useMovimentarCaixa`, `JanelaAutorizacao` e `precisaAutorizacao`.
- Produz:
  - `PainelTurno()`: régua com Turno ("Desde 08:02 · 4h12"), Vendas, Total vendido, Ticket médio e Dinheiro na gaveta.
    - acima do limite, mostra o traço laranja e "Sangria recomendada";
    - botões "Sangria ou suprimento" (`F11`) e "Fechar caixa" (`F12`, vai para `?tela=fechar`).
  - `JanelaMovimento()`: tipo em controle segmentado, valor e motivo. Na sangria do caixa, pede a autorização antes de enviar.

- [ ] **Passo 1: testes que falham.**
  - `"mostra vendas, total e gaveta do turno"`.
  - `"gaveta acima do limite mostra Sangria recomendada"`.
  - `"F11 abre a janela; suprimento de R$ 50 aumenta a gaveta"`.
  - `"sangria da Marina pede o PIN do Rafael e diminui a gaveta"`.
  - `"sangria maior que a gaveta mostra o erro"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(pdv): painel do turno, sangria e suprimento`.

### Tarefa 13: fechamento, reabertura e histórico de caixas

**Arquivos:**
- Criar: `components/admin/pdv/caixa/fechamento-caixa.tsx`, `components/admin/pdv/caixa/historico-caixas.tsx`
- Modificar: `components/admin/pdv/pagina-pdv.tsx` (`?tela=fechar` e `?tela=caixas` por `useQueryState` do nuqs)
- Teste: `components/admin/pdv/caixa/fechamento-caixa.test.tsx`, `components/admin/pdv/caixa/historico-caixas.test.tsx`

**Interfaces:**
- Consome: `conferir`, `diferencaDinheiro`, `errosDoFechamento`, `ContagemCedulas`, `useFecharCaixa`, `useReabrirCaixa` e `useHistoricoCaixas`.
- Produz:
  - `FechamentoCaixa()`: segue a tela 4 da prévia. Tem a régua do turno, a tabela "Conferência por forma de pagamento" (esperado, conferido e diferença), a contagem e a justificativa quando há diferença. Ao fechar, volta para a abertura.
  - `HistoricoCaixas()`: tabela (data, operador, abertura–fechamento, vendido, diferença com o traço verde ou vermelho). Uma linha abre o detalhe (vendas, sangrias e suprimentos com quem fez e quem autorizou). O último turno tem "Reabrir caixa".

- [ ] **Passo 1: testes que falham.**
  - `"F12 leva ao fechamento com o esperado em dinheiro"`.
  - `"contagem menor mostra a diferença e trava o botão até justificar"`.
  - `"fechar volta para Abrir o caixa"`.
  - `"o histórico mostra o turno recém-fechado no topo, com a diferença"`.
  - `"reabrir pela Marina pede o PIN do gerente"`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(pdv): fechamento com conferência, reabertura e histórico de caixas`.

### Tarefa 14: E2E, screenshots e verificação

**Arquivos:**
- Modificar: `tests/apoio.ts` (`abrirCaixa(page, { pessoa = "Marina S.", pin = "1111" } = {})`), `tests/admin.spec.ts` (os 3 testes do PDV abrem o caixa antes) e `tests/visual-admin.spec.ts`
- Criar: um E2E novo em `tests/admin.spec.ts`

- [ ] **Passo 1: teste que falha.** `"PDV: turno completo com sangria autorizada e fechamento com diferença"`:
  1. abre com Marina;
  2. vende em dinheiro;
  3. faz sangria com o PIN do Rafael;
  4. fecha com R$ 2 a menos e justifica;
  5. vê o turno no histórico;
  6. roda `verificarAcessibilidade` em cada tela.
- [ ] **Passo 2:** `pnpm test:e2e:rapido --grep "PDV"`. Esperado: FAIL até as telas existirem. Depois: PASS.
- [ ] **Passo 3: screenshots.**
  - Antes de qualquer atualização, rode `pnpm test:e2e:rapido --grep visual` e revise as diferenças de `painel-pdv-*` e `painel-pdv-caixa-*` (o painel do turno entrou).
  - Crie `painel-pdv-abertura`, `painel-pdv-fechamento` e `painel-equipe` nas mesmas telas dos atuais.
  - Só atualize (`--update-snapshots`) depois de olhar cada imagem.
- [ ] **Passo 4:** `pnpm check` e `pnpm test:e2e:rapido`. Mostre as duas saídas. Confira se a cobertura não caiu. Se subiu, suba o mínimo em `vitest.config.mts`.
- [ ] **Passo 5:** commit `test(pdv): E2E do turno de caixa e screenshots revisados`. Depois, PR da fase 1 com `docs/plano-pdv.md` e este plano.
