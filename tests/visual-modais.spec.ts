import { expect, test } from "@playwright/test"
import { abrirCardapio, esperarAnimacoes } from "./apoio"

/**
 * Referência visual dos modais que não têm teste próprio: "A loja" e a confirmação de
 * troca de loja. Roda só em um celular e um computador, nos dois temas, sem movimento.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

for (const tema of ["light", "dark"] as const) {
  test.describe(`modais, tema ${tema === "light" ? "claro" : "escuro"}`, () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência só em 2 telas")
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    })

    test("a loja", async ({ page }) => {
      await abrirCardapio(page)
      await page.getByRole("button", { name: "A loja" }).first().click()
      const painel = page.getByRole("dialog")
      await expect(painel).toBeVisible()
      await page.mouse.move(0, 0)
      await esperarAnimacoes(page)
      await expect(page).toHaveScreenshot(`a-loja-${tema}.png`, { animations: "disabled" })
    })

    test("trocar de loja com a sacola cheia", async ({ page }) => {
      await abrirCardapio(page)
      await page.getByTestId("adicionar-refrigerante-cola").click()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
      await page.getByRole("menuitemradio", { name: /Drogaria Bem Estar/ }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      await page.mouse.move(0, 0)
      await esperarAnimacoes(page)
      await expect(page).toHaveScreenshot(`trocar-loja-${tema}.png`, { animations: "disabled" })
    })
  })
}
