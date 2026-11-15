import { expect, test } from "@playwright/test"
import { esperarAnimacoes } from "./apoio"
import { abrirConversa, type LojaDaConversa, PEDIDOS } from "./apoio-whatsapp"

/**
 * Referência visual da conversa simulada no WhatsApp da loja, com o pedido já enviado e
 * todas as respostas da loja na tela. O relógio fica parado para os horários não mudarem.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

test.describe("visual da conversa no WhatsApp", () => {
  test.beforeEach(() => {
    test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência visual só em 2 telas")
  })

  for (const tema of ["light", "dark"] as const) {
    const nomeTema = tema === "light" ? "claro" : "escuro"

    for (const loja of Object.keys(PEDIDOS) as LojaDaConversa[]) {
      test(`conversa ${loja}, tema ${nomeTema}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
        await abrirConversa(page, loja)
        await expect(page.getByRole("link", { name: "Fazer novo pedido" })).toBeVisible({
          timeout: 10_000,
        })
        await page.waitForLoadState("networkidle")
        await esperarAnimacoes(page)
        await page.evaluate(() => window.scrollTo(0, 0))
        await expect(page.locator("main")).toHaveScreenshot(`conversa-${loja}-${tema}.png`, {
          animations: "disabled",
        })
      })
    }

    test(`conversa sem pedido, tema ${nomeTema}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
      await abrirConversa(page, null)
      await expect(page.getByText("Nenhum pedido por aqui")).toBeVisible()
      await esperarAnimacoes(page)
      await expect(page.locator("main")).toHaveScreenshot(`conversa-vazia-${tema}.png`, {
        animations: "disabled",
      })
    })
  }
})
