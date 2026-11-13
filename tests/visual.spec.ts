import { expect, test } from "@playwright/test"
import { abrirCardapio, abrirSoOEsqueleto } from "./apoio"

/**
 * Referências visuais: mudança de estilo só depois de existir a imagem do antes.
 * Para não multiplicar imagens, roda só em um celular e um computador.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

test.describe("visual", () => {
  test.beforeEach(() => {
    test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência visual só em 2 telas")
  })

  for (const tema of ["light", "dark"] as const) {
    test(`barra de categorias, tema ${tema === "light" ? "claro" : "escuro"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
      await abrirCardapio(page)
      const barra = page.getByTestId("barra-navegacao")
      await barra.scrollIntoViewIfNeeded()

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
