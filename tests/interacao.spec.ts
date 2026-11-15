import { expect, test } from "@playwright/test"
import { abrirCardapio, caixa, montarMeioAMeio } from "./apoio"

test.describe("botão de adicionar", () => {
  test("o + vira seletor de quantidade e volta ao + quando zera", async ({ page }) => {
    await abrirCardapio(page)
    const mais = page.getByTestId("adicionar-refrigerante-cola")
    const quantidade = page.getByTestId("quantidade-refrigerante-cola")
    const resumo = page.getByTestId("resumo-sacola")
    const produto = page.getByTestId("produto-refrigerante-cola")
    await mais.scrollIntoViewIfNeeded()
    await expect(quantidade).toHaveCount(0)

    const larguraInicial = (await caixa(mais)).width
    await mais.click()
    await expect(quantidade).toHaveAttribute("aria-label", "1 na sacola")
    await expect(resumo).toHaveText("Sacola com 1 item, R$ 15,00")

    await mais.click()
    await expect(quantidade).toHaveAttribute("aria-label", "2 na sacola")
    await expect(resumo).toHaveText("Sacola com 2 itens, R$ 30,00")

    await produto
      .getByRole("button", { name: "Diminuir quantidade de Refrigerante de cola 2L" })
      .click()
    await expect(quantidade).toHaveAttribute("aria-label", "1 na sacola")

    await produto.getByRole("button", { name: "Remover Refrigerante de cola 2L" }).click()
    await expect(quantidade).toHaveCount(0)
    await expect(resumo).toHaveText("Sacola vazia")
    await expect(async () => {
      expect((await caixa(mais)).width).toBeCloseTo(larguraInicial, 0)
    }).toPass()
  })

  test("com o seletor completo, preço e seletor ficam na mesma linha, dentro do cartão", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const mais = page.getByTestId("adicionar-refrigerante-cola")
    await mais.scrollIntoViewIfNeeded()
    // 22 unidades: os quatro controles à vista e um número de dois dígitos.
    for (let vez = 0; vez < 22; vez += 1) await mais.click()
    await expect(page.getByTestId("quantidade-refrigerante-cola")).toHaveAttribute(
      "aria-label",
      "22 na sacola",
    )
    await page.waitForTimeout(700)
    const cartao = await caixa(page.getByTestId("produto-refrigerante-cola"))
    const rodape = page.getByTestId("rodape-refrigerante-cola")
    const preco = await caixa(rodape.locator("p"))
    const seletor = await caixa(mais.locator(".."))
    expect(seletor.y, "o seletor não desce para outra linha").toBeLessThan(preco.y + preco.height)
    expect(seletor.x, "o seletor não cobre o preço").toBeGreaterThanOrEqual(preco.x + preco.width)
    expect(seletor.x + seletor.width).toBeLessThanOrEqual(cartao.x + cartao.width)
    expect(seletor.y + seletor.height).toBeLessThanOrEqual(cartao.y + cartao.height)
  })

  test("o seletor continua dentro da tela e com área de toque", async ({ page, viewport }) => {
    await abrirCardapio(page)
    const mais = page.getByTestId("adicionar-refrigerante-cola")
    await mais.scrollIntoViewIfNeeded()
    await mais.click()
    await page.waitForTimeout(600)
    const menos = page
      .getByTestId("produto-refrigerante-cola")
      .getByRole("button", { name: "Remover Refrigerante de cola 2L" })
    for (const controle of [menos, mais]) {
      const medida = await caixa(controle)
      expect(Math.round(medida.width)).toBeGreaterThanOrEqual(44)
      expect(Math.round(medida.height)).toBeGreaterThanOrEqual(44)
      expect(medida.x).toBeGreaterThanOrEqual(0)
      expect(medida.x + medida.width).toBeLessThanOrEqual(viewport?.width ?? 0)
    }
  })

  test("produto com opções ganha excluir, diminuir e aumentar; o + repete a montagem", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const painel = await montarMeioAMeio(page)
    await painel.getByTestId("cta-adicionar").click()
    await expect(painel).toHaveCount(0)
    const cartao = page.getByTestId("destaque-meio-a-meio")
    const quantidade = cartao.getByTestId("quantidade-meio-a-meio")
    await expect(quantidade).toHaveAttribute("aria-label", "1 na sacola")
    await expect(cartao.getByRole("button", { name: "Remover Pizza meio a meio" })).toBeVisible()

    await cartao.getByRole("button", { name: "Aumentar quantidade de Pizza meio a meio" }).click()
    await expect(page.getByTestId("painel-produto")).toHaveCount(0)
    await expect(quantidade).toHaveAttribute("aria-label", "2 na sacola")

    await cartao.getByRole("button", { name: "Diminuir quantidade de Pizza meio a meio" }).click()
    await expect(quantidade).toHaveAttribute("aria-label", "1 na sacola")

    await cartao.getByRole("button", { name: "Aumentar quantidade de Pizza meio a meio" }).click()
    await cartao.getByRole("button", { name: "Remover Pizza meio a meio" }).click()
    await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola vazia")
    await page.locator("[data-sonner-toast]").getByText("Desfazer").click()
    await expect(quantidade).toHaveAttribute("aria-label", "2 na sacola")
  })

  test("no cartão em destaque, o seletor cabe inteiro e não cobre o texto", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await montarMeioAMeio(page)
    await painel.getByTestId("cta-adicionar").click()
    await expect(painel).toHaveCount(0)
    const cartao = page.getByTestId("destaque-meio-a-meio")
    await cartao.getByRole("button", { name: "Aumentar quantidade de Pizza meio a meio" }).click()
    await page.waitForTimeout(700)

    const medidaCartao = await caixa(cartao)
    const seletor = await caixa(cartao.getByTestId("adicionar-meio-a-meio").locator(".."))
    const preco = await caixa(cartao.locator("p").last())
    expect(seletor.x).toBeGreaterThanOrEqual(medidaCartao.x)
    expect(seletor.x + seletor.width).toBeLessThanOrEqual(medidaCartao.x + medidaCartao.width)
    expect(seletor.y + seletor.height).toBeLessThanOrEqual(medidaCartao.y + medidaCartao.height)
    // O seletor mora no canto da foto; o nome e a etiqueta ficam embaixo dela, sem cobrir nada.
    expect(preco.y, "a etiqueta começa abaixo do seletor").toBeGreaterThanOrEqual(
      seletor.y + seletor.height,
    )
  })

  test("produto com opções abre o painel e depois mostra a quantidade", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await montarMeioAMeio(page)
    await painel.getByTestId("cta-adicionar").click()
    await expect(painel).toHaveCount(0)
    await expect(page.getByTestId("quantidade-meio-a-meio").first()).toHaveAttribute(
      "aria-label",
      "1 na sacola",
    )
  })
})

test.describe("voo até a sacola", () => {
  test("o item voa ao ser adicionado e some ao chegar", async ({ page }) => {
    await abrirCardapio(page)
    const mais = page.getByTestId("adicionar-refrigerante-cola")
    await mais.scrollIntoViewIfNeeded()
    await mais.click()
    const voo = page.getByTestId("voo")
    await expect(voo).toBeAttached()
    await expect(voo).toHaveCount(0, { timeout: 3000 })
  })

  test.describe("com movimento reduzido", () => {
    test.use({ reducedMotion: "reduce" })

    test("o item entra direto, sem voo", async ({ page }) => {
      await abrirCardapio(page)
      const mais = page.getByTestId("adicionar-refrigerante-cola")
      await mais.scrollIntoViewIfNeeded()
      await mais.click()
      await expect(page.getByTestId("voo")).toHaveCount(0)
      await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola com 1 item, R$ 15,00")
    })
  })
})

test.describe("observação", () => {
  test("abre com animação, recebe o foco e fecha voltando ao botão", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByRole("button", { name: "Calzone de Queijo", exact: true }).click()
    const painel = page.getByTestId("painel-produto")
    const abrir = painel.getByRole("button", { name: "Adicionar observação" })
    await abrir.click()

    const campo = painel.getByLabel("Observação", { exact: true })
    await expect(campo).toBeVisible()
    await expect(campo).toBeFocused()
    await campo.fill("Sem orégano")
    await expect(painel.getByText("129 caracteres restantes")).toBeVisible()

    await painel.getByRole("button", { name: "Remover observação" }).click()
    await expect(campo).toHaveCount(0)
    await expect(abrir).toBeFocused()
    await abrir.click()
    await expect(painel.getByLabel("Observação", { exact: true })).toHaveValue("")
  })
})
