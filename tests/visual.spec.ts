import { expect, type Page, test } from "@playwright/test"
import { abrirCardapio, abrirSoOEsqueleto, esperarAnimacoes } from "./apoio"

/**
 * Referências visuais: mudança de estilo só depois de existir a imagem do antes.
 * Para não multiplicar imagens, roda só em um celular e um computador.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

/**
 * A barra de categorias gruda no topo e cai por cima da seção numa altura que varia de uma
 * rodada para outra. Ela tem a própria foto; na foto da seção, fica de fora. A sacola também.
 */
async function esconderFlutuantes(page: Page) {
  await page.addStyleTag({
    content:
      "[data-testid=barra-navegacao],[data-testid=barra-sacola]{visibility:hidden!important}",
  })
}

test.describe("visual", () => {
  test.beforeEach(() => {
    test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência visual só em 2 telas")
  })

  for (const tema of ["light", "dark"] as const) {
    for (const loja of [
      "adega-da-vila",
      "acougue-sabor-da-carne",
      "emporio-das-deusas",
      "quiosque-do-mineiro",
    ]) {
      test(`vitrine ${loja}, tema ${tema === "light" ? "claro" : "escuro"}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
        await page.addInitScript(
          (id) =>
            localStorage.setItem("clickpedido-loja", JSON.stringify({ state: { id }, version: 1 })),
          loja,
        )
        await page.goto("/")
        const primeira = page.locator("section[id^=categoria-]").first()
        await expect(primeira.getByRole("article").first()).toBeVisible()
        await page.waitForLoadState("networkidle")
        await esperarAnimacoes(page)
        await expect(page.getByTestId("cabecalho-loja")).toHaveScreenshot(
          `${loja}-cabecalho-${tema}.png`,
          { animations: "disabled" },
        )
        await esconderFlutuantes(page)
        await primeira.scrollIntoViewIfNeeded()
        await esperarAnimacoes(page)
        await expect(primeira).toHaveScreenshot(`${loja}-primeira-categoria-${tema}.png`, {
          animations: "disabled",
        })
      })
    }

    test(`vitrine da farmácia, tema ${tema === "light" ? "claro" : "escuro"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
      await page.addInitScript(() =>
        localStorage.setItem(
          "clickpedido-loja",
          JSON.stringify({ state: { id: "drogaria-bem-estar" }, version: 1 }),
        ),
      )
      await page.goto("/")
      const antibioticos = page.locator("#categoria-antibioticos")
      await expect(antibioticos.getByTestId("produto-amoxicilina-500")).toBeVisible()
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)

      await expect(page.getByTestId("cabecalho-loja")).toHaveScreenshot(
        `farmacia-cabecalho-${tema}.png`,
        { animations: "disabled" },
      )
      await esconderFlutuantes(page)
      await antibioticos.scrollIntoViewIfNeeded()
      await esperarAnimacoes(page)
      await expect(antibioticos).toHaveScreenshot(`farmacia-antibioticos-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`barra de categorias, tema ${tema === "light" ? "claro" : "escuro"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
      await abrirCardapio(page)
      const barra = page.getByTestId("barra-navegacao")
      await barra.scrollIntoViewIfNeeded()
      // As abas são só texto: basta a ativa estar marcada.
      await expect(barra.locator("[aria-current]")).toBeVisible()

      await expect(barra).toHaveScreenshot(`barra-categorias-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`esqueleto do cardápio, tema ${tema === "light" ? "claro" : "escuro"}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
      await abrirSoOEsqueleto(page)
      const esqueleto = page.getByRole("status", { name: "Carregando cardápio" })
      await expect(esqueleto).toBeVisible()

      await expect(esqueleto).toHaveScreenshot(`esqueleto-cardapio-${tema}.png`, {
        animations: "disabled",
        // O esqueleto é todo em tons próximos: com a tolerância padrão (0,2) nenhuma mudança aparece.
        threshold: 0.02,
      })
    })
  }
})
