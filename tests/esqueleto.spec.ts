import { expect, test } from "@playwright/test"
import { abrirSoOEsqueleto, caixa, esperarAnimacoes } from "./apoio"

/** Cada peça do esqueleto e o banner real que entra no lugar dela. */
const PECAS = [
  ["grande", "banner-meio-a-meio"],
  ["primeiro", "banner-doces"],
  ["segundo", "banner-bebidas"],
  ["largo", "banner-oferta-calabresa"],
] as const

test("o esqueleto dos banners ocupa exatamente o lugar dos banners", async ({ page }) => {
  const soltarScripts = await abrirSoOEsqueleto(page)
  const esqueleto: Record<string, Awaited<ReturnType<typeof caixa>>> = {}
  for (const [peca] of PECAS) {
    esqueleto[peca] = await caixa(page.getByTestId(`esqueleto-banner-${peca}`))
  }

  await soltarScripts()
  await expect(page.getByTestId("banner-meio-a-meio")).toBeVisible()
  await esperarAnimacoes(page)

  for (const [peca, banner] of PECAS) {
    const real = await caixa(page.getByTestId(banner))
    const antes = esqueleto[peca]
    for (const medida of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(real[medida] - antes[medida]),
        `${peca}: ${medida} do esqueleto (${antes[medida]}) e do banner (${real[medida]})`,
      ).toBeLessThanOrEqual(1)
    }
  }
})
