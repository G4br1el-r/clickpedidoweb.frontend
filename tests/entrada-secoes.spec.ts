import { expect, test } from "@playwright/test"
import { abrirCardapio, esperarAnimacoes } from "./apoio"

/**
 * As categorias abaixo da primeira tela esperam a rolagem e entram ao chegar: a página abre
 * sem entregar o cardápio inteiro de uma vez, e quem rola vê cada seção chegar.
 */
test.describe("entrada das categorias ao rolar", () => {
  test("a última categoria fica guardada na abertura e entra ao chegar à tela", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const ultima = page.locator("section[id^='categoria-']").last()

    await expect(ultima.locator(".entrada-guardada")).toHaveCount(1)
    await expect(ultima.locator(".entrada-guardada")).toHaveCSS("opacity", "0")

    await ultima.scrollIntoViewIfNeeded()
    await expect(ultima.locator(".entrada")).toHaveCount(1)
    await esperarAnimacoes(page)
    await expect(ultima.locator(".entrada")).toHaveCSS("opacity", "1")
  })

  test("a primeira categoria nunca some de quem a vê: entra na abertura ou ao chegar", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const primeira = page.locator("section[id^='categoria-']").first()
    // Em tela baixa (celular deitado), ela começa abaixo da dobra e espera a rolagem.
    const aVista = await primeira.evaluate(
      (secao) => (secao.firstElementChild?.getBoundingClientRect().top ?? 0) < window.innerHeight,
    )
    const titulo = primeira.getByRole("heading", { level: 2 })
    // A seção é bem mais alta que a tela: rola até o título, não até o meio dela.
    if (!aVista) await titulo.scrollIntoViewIfNeeded()
    await expect(primeira.locator(".entrada-guardada")).toHaveCount(0)
    await esperarAnimacoes(page)
    await expect(primeira.locator(".entrada")).toHaveCSS("opacity", "1")
    if (!aVista) await expect(titulo).toBeInViewport()
    else await expect(titulo).toBeVisible()
  })

  test("tocar numa categoria da barra leva até ela e ela aparece inteira", async ({ page }) => {
    await abrirCardapio(page)
    const secoes = page.locator("section[id^='categoria-']")
    const alvo = secoes.nth(2)
    const nome = (await alvo.getByRole("heading", { level: 2 }).textContent()) ?? ""
    await page
      .getByTestId("barra-navegacao")
      .getByRole("button", { name: nome, exact: true })
      .click()
    await esperarAnimacoes(page)
    await expect(alvo.locator(".entrada-guardada")).toHaveCount(0)
    await expect(alvo.getByRole("heading", { level: 2 })).toBeInViewport()
  })
})
