import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page, type Route } from "@playwright/test"

/** Abre o cardápio e espera os produtos aparecerem e a entrada da página terminar. */
export async function abrirCardapio(page: Page) {
  await page.goto("/")
  await expect(page.getByTestId("produto-calabresa")).toBeVisible()
  await esperarAnimacoes(page)
}

/**
 * Abre o cardápio só com o HTML do servidor, que é o esqueleto: os scripts da página ficam
 * segurados até chamar a função devolvida. Assim dá para medir e fotografar o esqueleto parado.
 */
export async function abrirSoOEsqueleto(page: Page) {
  const segurados: Route[] = []
  const ehScript = (url: URL) => url.pathname.startsWith("/_next/") && url.pathname.endsWith(".js")
  await page.route(ehScript, (rota) => {
    segurados.push(rota)
  })
  await page.goto("/", { waitUntil: "commit" })
  await expect(page.getByRole("status", { name: "Carregando cardápio" })).toBeVisible()
  return async function soltarScripts() {
    // Solta os segurados antes de tirar a interceptação: ao tirá-la, o Playwright os trataria sozinho.
    for (const rota of segurados) await rota.continue()
    await page.unroute(ehScript)
  }
}

/**
 * Espera as animações de entrada terminarem. Medir ou checar contraste no meio delas
 * pega elementos deslocados ou meio transparentes. Animações infinitas são ignoradas.
 */
/**
 * Espera um elemento parar de se mexer: o Motion anima o layout em JavaScript, fora do
 * `getAnimations`. Clicar num botão grudado ainda deslizando faz o Playwright rolar a página
 * até o lugar original dele, coisa que um toque de verdade não faz.
 */
export async function esperarParado(alvo: Locator) {
  await expect
    .poll(
      async () => {
        const antes = await alvo.boundingBox()
        await alvo.page().waitForTimeout(120)
        const depois = await alvo.boundingBox()
        return JSON.stringify(antes) === JSON.stringify(depois)
      },
      { timeout: 5000 },
    )
    .toBe(true)
}

export async function esperarAnimacoes(page: Page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (animacao) =>
            animacao.playState !== "running" ||
            animacao.effect?.getTiming().iterations === Number.POSITIVE_INFINITY,
        ),
    undefined,
    { timeout: 5000 },
  )
}

export async function verificarAcessibilidade(page: Page, contexto?: string) {
  await esperarAnimacoes(page)
  const construtor = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ])
  if (contexto) construtor.include(contexto)
  const { violations } = await construtor.analyze()
  const resumo = violations.map(
    ({ id, impact, nodes }) =>
      `${impact} ${id}: ${nodes.map((no) => no.target.join(" ")).join(", ")}`,
  )
  expect(resumo).toEqual([])
}

export async function caixa(elemento: Locator) {
  const medida = await elemento.boundingBox()
  if (!medida) throw new Error("Elemento sem medida na tela")
  return medida
}

/** Elementos lado a lado precisam ter a mesma altura e o mesmo alinhamento. */
export async function verificarLadoALado(a: Locator, b: Locator) {
  const [caixaA, caixaB] = [await caixa(a), await caixa(b)]
  expect(Math.abs(caixaA.height - caixaB.height), "mesma altura").toBeLessThanOrEqual(0.5)
  expect(Math.abs(caixaA.y - caixaB.y), "mesmo topo").toBeLessThanOrEqual(0.5)
  expect(caixaA.x + caixaA.width, "sem sobreposição").toBeLessThanOrEqual(caixaB.x)
}

/** Todo controle visível precisa ter pelo menos 44 px para o dedo. */
export async function verificarAreasDeToque(escopo: Locator) {
  const problemas = await escopo.evaluate((raiz) => {
    const seletor = 'button, a[href], [role="radio"], [data-slot="input-group"], textarea'
    return Array.from(raiz.querySelectorAll(seletor)).flatMap((elemento) => {
      // Nomes de produto usam a área do cartão inteiro como alvo de toque.
      if (elemento.closest("h3") && elemento.matches("button")) return []
      // Num cartão de escolha, o alvo do dedo é o cartão inteiro, não só o círculo do rádio.
      const alvo = elemento.matches('[role="radio"]')
        ? (elemento.closest("label") ?? elemento)
        : elemento
      const { width, height } = alvo.getBoundingClientRect()
      if (width === 0 || height === 0) return []
      if (Math.round(width) < 44 || Math.round(height) < 44) {
        const nome = elemento.getAttribute("aria-label") ?? elemento.textContent ?? elemento.tagName
        return [`${nome.trim().slice(0, 40)}: ${Math.round(width)}x${Math.round(height)}`]
      }
      return []
    })
  })
  expect(problemas).toEqual([])
}

export async function verificarSemRolagemHorizontal(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
}

/** Clica num produto com opções e devolve o painel aberto. */
export async function abrirMeioAMeio(page: Page) {
  await page.getByTestId("adicionar-meio-a-meio").first().click()
  const painel = page.getByTestId("painel-produto")
  await expect(painel).toBeVisible()
  return painel
}

async function escolher(painel: Locator, titulo: string, opcao: string) {
  const lista = painel.getByRole("radiogroup", { name: titulo })
  await expect(lista).toBeVisible()
  await lista.getByTestId(opcao).click()
}

/** Escolher não muda de passo: quem leva ao próximo é o botão "Avançar". */
export async function avancar(painel: Locator) {
  const acao = painel.getByTestId("cta-adicionar")
  await expect(acao).toContainText("Avançar")
  await acao.click()
}

/** Monta uma pizza meio a meio e deixa o painel aberto, pronto para adicionar. */
export async function montarMeioAMeio(page: Page) {
  const painel = await abrirMeioAMeio(page)
  await escolher(painel, "Escolha o 1º sabor", "opcao-calabresa")
  await avancar(painel)
  await escolher(painel, "Escolha o 2º sabor", "opcao-pepperoni")
  await avancar(painel)
  await escolher(painel, "Escolha a borda", "opcao-catupiry")
  return painel
}

/** No celular, a ação do checkout fica na barra de baixo; do tablet em diante, no fim do cartão. */
export function acaoCheckout(page: Page) {
  const celular = (page.viewportSize()?.width ?? 0) < 768
  return page.getByTestId(celular ? "acao-checkout-celular" : "acao-checkout")
}

/** Põe na sacola o suficiente para passar do pedido mínimo e abre o checkout. */
export async function abrirCheckout(page: Page) {
  await abrirCardapio(page)
  const botao = page.getByTestId("adicionar-refrigerante-cola")
  await botao.scrollIntoViewIfNeeded()
  await botao.click()
  await botao.click()
  await page.goto("/finalizar")
  await expect(page.getByRole("heading", { name: "Para quem é o pedido?" })).toBeVisible()
}

/**
 * Abre a sacola pelo ícone à vista: o da barra grudada, se ela estiver grudada,
 * ou o de cima da foto.
 */
export async function abrirSacola(page: Page): Promise<Locator> {
  const fixo = page.getByTestId("icone-sacola-fixo")
  const gatilho = (await fixo.count()) > 0 ? fixo : page.getByTestId("icone-sacola")
  await expect(gatilho).toBeVisible()
  // Espera o item que acabou de ser adicionado terminar o voo até o ícone.
  await page.waitForTimeout(450)
  await gatilho.click()
  const painel = page.getByRole("dialog", { name: "Sua sacola" })
  await expect(painel).toBeVisible()
  await page.waitForTimeout(450)
  return painel
}

/**
 * Abre o caixa do PDV (sem caixa aberto não se vende): escolhe a pessoa, digita o PIN e
 * espera o painel do turno.
 */
export async function abrirCaixa(page: Page, { pessoa = "Marina S.", pin = "1111" } = {}) {
  await page.goto("/admin/pdv")
  const abertura = page.getByRole("region", { name: "Abrir o caixa" })
  await expect(abertura).toBeVisible({ timeout: 15_000 })
  await abertura.getByRole("radio", { name: new RegExp(`^${pessoa}`) }).click()
  await abertura.getByLabel(`PIN de ${pessoa}`).fill(pin)
  await abertura.getByRole("button", { name: /Abrir caixa/ }).click()
  await expect(page.getByRole("region", { name: "Turno do caixa" })).toBeVisible({
    timeout: 15_000,
  })
}
