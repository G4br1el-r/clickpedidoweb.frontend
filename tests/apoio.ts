import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page } from "@playwright/test"

/** Abre o cardápio e espera os produtos aparecerem e a entrada da página terminar. */
export async function abrirCardapio(page: Page) {
  await page.goto("/")
  await expect(page.getByTestId("produto-calabresa")).toBeVisible()
  await esperarAnimacoes(page)
}

/**
 * Espera as animações de entrada terminarem. Medir ou checar contraste no meio delas
 * pega elementos deslocados ou meio transparentes. Animações infinitas são ignoradas.
 */
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

/** Monta uma pizza meio a meio e deixa o painel aberto, pronto para adicionar. */
export async function montarMeioAMeio(page: Page) {
  const painel = await abrirMeioAMeio(page)
  await escolher(painel, "Escolha o 1º sabor", "opcao-calabresa")
  await escolher(painel, "Escolha o 2º sabor", "opcao-pepperoni")
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
