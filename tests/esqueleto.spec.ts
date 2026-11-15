import { expect, test } from "@playwright/test"
import { abrirSoOEsqueleto, caixa, esperarAnimacoes } from "./apoio"

/** Cada peça do esqueleto e o banner real que entra no lugar dela. */
const PECAS = [
  ["grande", "banner-meio-a-meio"],
  ["primeiro", "banner-doces"],
  ["segundo", "banner-bebidas"],
  ["largo", "banner-oferta-calabresa"],
] as const

test("o cardápio começa onde o esqueleto começa: a primeira linha no mesmo lugar", async ({
  page,
}) => {
  const soltarScripts = await abrirSoOEsqueleto(page)
  const antes = await caixa(page.getByTestId("esqueleto-linha-1"))

  await soltarScripts()
  const primeira = page.locator("section[id^=categoria-]").first().getByRole("article").first()
  await expect(primeira).toBeVisible()
  await esperarAnimacoes(page)

  const real = await caixa(primeira)
  for (const medida of ["x", "y", "width"] as const) {
    expect(
      Math.abs(real[medida] - antes[medida]),
      `${medida} do esqueleto (${antes[medida]}) e da primeira linha (${real[medida]})`,
    ).toBeLessThanOrEqual(1)
  }
})

test("o mosaico do esqueleto tem a mesma geometria do mosaico real", async ({ page }) => {
  const soltarScripts = await abrirSoOEsqueleto(page)
  const esqueleto: Record<string, Awaited<ReturnType<typeof caixa>>> = {}
  for (const [peca] of PECAS) {
    esqueleto[peca] = await caixa(page.getByTestId(`esqueleto-banner-${peca}`))
  }

  await soltarScripts()
  await expect(page.getByTestId("banner-meio-a-meio")).toBeVisible()
  await esperarAnimacoes(page)

  // A posição na página depende de quantos produtos a primeira categoria tem;
  // o que precisa bater é o tamanho de cada peça e o lugar dela dentro do mosaico.
  const origemReal = await caixa(page.getByTestId("banner-meio-a-meio"))
  const origemEsqueleto = esqueleto.grande
  for (const [peca, banner] of PECAS) {
    const real = await caixa(page.getByTestId(banner))
    const antes = esqueleto[peca]
    const pares = [
      ["x", real.x - origemReal.x, antes.x - origemEsqueleto.x],
      ["y", real.y - origemReal.y, antes.y - origemEsqueleto.y],
      ["width", real.width, antes.width],
      ["height", real.height, antes.height],
    ] as const
    for (const [medida, deReal, deEsqueleto] of pares) {
      expect(
        Math.abs(deReal - deEsqueleto),
        `${peca}: ${medida} do esqueleto (${deEsqueleto}) e do banner (${deReal})`,
      ).toBeLessThanOrEqual(1)
    }
  }
})
