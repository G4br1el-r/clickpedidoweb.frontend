import { expect, type Locator, type Page, test } from "@playwright/test"
import { abrirCardapio, abrirMeioAMeio, caixa, esperarAnimacoes, montarMeioAMeio } from "./apoio"

/**
 * Referências visuais da folha do produto: mudança de estilo só depois de existir a imagem
 * do antes. Como as outras referências, roda só em um celular e um computador.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

/** Sexta, 13/11/2026, 20:30: a loja aberta e os textos sempre iguais. */
const AGORA = new Date("2026-11-13T20:30:00-03:00")

test.use({ timezoneId: "America/Sao_Paulo" })

test.beforeEach(async ({ page }) => {
  test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência visual só em 2 telas")
  await page.clock.setFixedTime(AGORA)
})

async function fotografar(page: Page, alvo: Locator, nome: string) {
  // O ponteiro fora da folha: nada de hover nem dica aberta na foto.
  await page.mouse.move(0, 0)
  await page.waitForTimeout(500)
  await esperarAnimacoes(page)
  // Recorte da tela, sem rolar até a folha: ela já está inteira à vista.
  const { x, y, width, height } = await caixa(alvo)
  const largura = page.viewportSize()?.width ?? width
  await expect(page).toHaveScreenshot(nome, {
    animations: "disabled",
    clip: { x, y, width: Math.min(width, largura - x), height },
  })
}

async function irParaFarmacia(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeVisible()
  await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
  await page.getByRole("menuitemradio", { name: /Drogaria Bem Estar/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Drogaria Bem Estar" })).toBeVisible()
  await esperarAnimacoes(page)
}

for (const tema of ["light", "dark"] as const) {
  const nomeTema = tema === "light" ? "claro" : "escuro"

  test.describe(`folha do produto, tema ${nomeTema}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    })

    test("meio a meio aberto, no 1º sabor", async ({ page }) => {
      await abrirCardapio(page)
      const painel = await abrirMeioAMeio(page)
      await expect(painel.getByRole("radiogroup", { name: "Escolha o 1º sabor" })).toBeVisible()
      await fotografar(page, painel, `meio-a-meio-aberto-${tema}.png`)
    })

    test("meio a meio montado, na borda", async ({ page }) => {
      await abrirCardapio(page)
      const painel = await montarMeioAMeio(page)
      await expect(painel.getByTestId("opcao-catupiry")).toHaveAttribute("aria-checked", "true")
      // Para alcançar cada opção, o clique rola a folha uma distância que varia; a foto é do topo,
      // com a pizza montada inteira.
      await painel.getByTestId("corpo-folha").evaluate((corpo) => corpo.scrollTo({ top: 0 }))
      await fotografar(page, painel, `meio-a-meio-montado-${tema}.png`)
    })

    test("remédio da farmácia", async ({ page }) => {
      await irParaFarmacia(page)
      const produto = page.getByTestId("produto-amoxicilina-500")
      await produto.scrollIntoViewIfNeeded()
      await produto.getByRole("heading").getByRole("button").click()
      const painel = page.getByTestId("painel-produto")
      await expect(painel.getByText("Amoxicilina tri-hidratada")).toBeVisible()
      await fotografar(page, painel, `remedio-${tema}.png`)
    })

    test("foto ampliada de um produto sem opções", async ({ page }) => {
      await abrirCardapio(page)
      await page.getByRole("button", { name: "Calzone de Queijo", exact: true }).click()
      const painel = page.getByTestId("painel-produto")
      await painel.getByRole("button", { name: "Ampliar foto de Calzone de Queijo" }).click()
      const foto = page.getByTestId("foto-ampliada")
      await expect(foto).toBeVisible()
      await page.waitForLoadState("networkidle")
      await fotografar(page, foto, `foto-ampliada-${tema}.png`)
    })
  })
}
