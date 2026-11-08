import { expect, test } from "@playwright/test"
import {
  abrirCardapio,
  abrirCheckout,
  acaoCheckout,
  verificarAcessibilidade,
  verificarSemRolagemHorizontal,
} from "./apoio"

test.describe("tema escuro", () => {
  test.use({ colorScheme: "dark" })

  test("segue o tema do aparelho e o cardápio passa no contraste", async ({ page }) => {
    await abrirCardapio(page)
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.waitForTimeout(900)
    await verificarSemRolagemHorizontal(page)
    await verificarAcessibilidade(page)
  })

  test("o checkout passa no contraste", async ({ page }) => {
    await abrirCheckout(page)
    await page.getByLabel("Nome").fill("Gabriel")
    await page.getByLabel("WhatsApp").fill("(12) 99888-7766")
    await acaoCheckout(page).click()
    await page.getByTestId("opcao-retirada").click()
    await acaoCheckout(page).click()
    await page.getByTestId("pagamento-dinheiro").click()
    await page.waitForTimeout(400)
    await verificarAcessibilidade(page)
  })

  test("a página já abre com o fundo escuro", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("html")).toHaveClass(/dark/)
    const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const [r, g, b] = (fundo.match(/\d+/g) ?? []).map(Number)
    expect(r + g + b, `fundo ${fundo}`).toBeLessThan(120)
  })
  test("o botão troca para o claro e a escolha fica guardada", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByTestId("alternar-tema").click()
    await expect(page.locator("html")).not.toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator("html")).not.toHaveClass(/dark/)
  })
})
