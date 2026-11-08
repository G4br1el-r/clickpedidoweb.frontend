@AGENTS.md

## Testes e TDD (obrigatório)

TDD é obrigatório em todo o projeto. **Nenhum código de produção é escrito sem um teste falhando antes**: feature, bugfix, componente de UI, hook, função de `lib/`, store. Refatoração só com os testes verdes cobrindo o trecho antes de mexer. Não existe exceção por pressa ou por ser "só visual".

- **Ciclo:** use a skill `tdd:tdd`. Um teste falhando (red) → o mínimo de código para passar (green) → repete. Refatoração só com tudo verde.
- **Uma fatia por vez:** um comportamento, um teste, uma implementação. Nunca escreva todos os testes antes do código.
- **Bug:** primeiro um teste que reproduz o bug e falha; só depois a correção. Os testes marcados com `// BUG:` fixam um comportamento atual que parece errado: ao corrigir, mude a asserção para o esperado (é o teste vermelho) e só então o código.
- **Onde mora a regra:** regra de negócio (dinheiro, validação, troco, status do pedido, plano Pro) fica em `lib/` como função pura, testada direto. O componente só chama. Exemplos: `lib/checkout.ts`, `lib/sacola.ts`, `lib/pedido.ts`, `lib/produto.ts`.
- **O que testar:** comportamento pela interface pública. Em `lib/`, entrada → saída ou efeito no store. No componente, o que a pessoa vê e faz (Testing Library, queries por role e label).
- **Onde fica o teste:** unitário e de componente com Vitest + Testing Library, em `*.test.ts(x)` ao lado do código. E2E com Playwright em `tests/*.spec.ts`, só para fluxo de tela e layout por tamanho de tela.
- **Tempo, fetch e navegador:** controle no teste (`vi.useFakeTimers` + `vi.setSystemTime`, `vi.stubGlobal("fetch", …)`, `vi.mock("next/navigation")`). Stores zustand: resete com `useX.setState(useX.getInitialState(), true)` no `beforeEach`. Persistência: teste pelo `localStorage` e `useX.persist.rehydrate()`. O setup global (`vitest.setup.ts`) já fixa o fuso em America/Sao_Paulo e simula `matchMedia`, os observadores e `next/font`.
- **Valor esperado:** literal conhecido, nunca recalculado do jeito que o código calcula. Dinheiro do `Intl` usa espaço não separável (`"R$ 30,00"`); a busca por texto da Testing Library normaliza para espaço comum.
- **UI e visual:** componente nasce do teste do que ele renderiza, dos estados e da interação. Mudança de estilo exige teste visual (`toHaveScreenshot` do Playwright) da página ou componente afetado; se ainda não houver screenshot, crie antes de mudar. Atualize o screenshot só depois de revisar a diferença.
- **Mocks:** só nas fronteiras externas (HTTP, tempo, navegação do Next, WASM do Lottie). Nunca mocke a própria lógica testada.
- **Proibido:** escrever código de produção sem teste falhando antes, alterar um teste só para ele passar, pular ou desativar teste, atualizar snapshot ou screenshot sem revisar, teste que recalcula o esperado do mesmo jeito que o código.
- **Fluxos do usuário** (cardápio → sacola → checkout → acompanhamento, busca de pedidos, painel admin) também têm teste E2E com Playwright.
- **Fora do ciclo:** `components/ui/**` (gerado pelo shadcn), `lib/mock/**`, tipos puros e configuração. O comportamento que depende deles tem teste.
- **Antes de dizer que terminou:** rode `pnpm check` e mostre a saída (skill `core:verification-before-completion`). Mudou tela ou fluxo: rode também `pnpm test:e2e:rapido`. Código sem teste bloqueia o fechamento (`/core:finish`).
- **Cobertura:** os mínimos ficam em `vitest.config.mts` (`thresholds`, geral e `lib/**`) e nunca baixam. Ao subir a cobertura, suba o mínimo junto.

Comandos:

- `pnpm test`: Vitest, unitário e componente (~2 s)
- `pnpm test:watch`: Vitest em modo watch, para o ciclo red-green
- `pnpm test:coverage`: cobertura, falha abaixo do mínimo
- `pnpm test:e2e:rapido`: Playwright em 2 telas (celular-390 e desktop-1920), ~5 min
- `pnpm test:e2e`: Playwright nas 11 telas, antes de entregar
- `pnpm check`: Biome + tsc + Vitest
