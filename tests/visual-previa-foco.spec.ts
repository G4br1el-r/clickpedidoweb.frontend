import { expect, test } from "@playwright/test"
import { esperarAnimacoes } from "./apoio"

/** Cada teste começa com o painel de fábrica. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("clickpedido-admin")
    localStorage.removeItem("clickpedido-admin-segmento")
  })
})

for (const tema of ["light", "dark"] as const) {
  test(`prévia: marca o que está sendo editado (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/configuracoes/inicio")
    const interruptor = page.getByRole("switch", { name: "Mostrar Banner promocional" })
    await expect(interruptor).toBeVisible({ timeout: 15_000 })
    // A prévia só fica ao lado do editor em telas largas; nas outras, abre por cima dele.
    test.skip(
      await page.getByRole("button", { name: "Prévia", exact: true }).isVisible(),
      "sem a prévia ao lado, não há como mexer e ver ao mesmo tempo",
    )
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)

    await interruptor.click()
    const previa = page.getByRole("region", { name: "Prévia da loja" })
    await expect(previa.getByRole("status")).toContainText("Página inicial")
    await expect(previa.getByRole("status")).toContainText("Banner promocional")
    await expect(previa.getByTestId("contorno-foco")).toBeVisible()
    await esperarAnimacoes(page)
    await expect(previa).toHaveScreenshot(`previa-foco-banner-${tema}.png`)
  })
}
