import { expect, test } from "@playwright/test"
import {
  abrirCardapio,
  caixa,
  verificarAcessibilidade,
  verificarSemRolagemHorizontal,
} from "./apoio"

test.describe("cabeçalho e barra", () => {
  test("o painel fica centrado na divisória entre a foto e a página", async ({ page }) => {
    await abrirCardapio(page)
    const divisoria = await caixa(page.getByTestId("divisoria-painel"))
    const painel = await caixa(page.getByTestId("painel-loja"))
    const linha = divisoria.y + divisoria.height / 2
    expect(Math.abs(painel.y + painel.height / 2 - linha)).toBeLessThanOrEqual(1)
    await verificarSemRolagemHorizontal(page)
  })

  test("grudada: marca à esquerda, categorias no centro e ações à direita", async ({
    page,
    viewport,
  }) => {
    const largura = viewport?.width ?? 0
    test.skip(largura < 768, "três zonas só do tablet em diante")
    await abrirCardapio(page)
    await page.evaluate(() => window.scrollTo(0, 900))
    const barra = page.getByTestId("barra-navegacao")
    await expect(barra).toHaveAttribute("data-grudada", "true")
    await page.waitForTimeout(600)

    const sacola = await caixa(page.getByTestId("icone-sacola-fixo"))
    const chips = await caixa(barra.locator('[aria-current="true"]').locator(".."))
    const acoes = await caixa(barra.getByRole("button", { name: /busca/i }))
    // Conteúdo da barra: até 1320 px (1640 px a partir de 1536 px), com 24 px de respiro.
    const larguraMaxima = largura >= 1536 ? 1640 : 1320
    const borda = Math.max(0, (largura - larguraMaxima) / 2) + 24
    const folgaDireita = largura - (sacola.x + sacola.width)
    expect(Math.abs(folgaDireita - borda), "sacola na borda direita").toBeLessThanOrEqual(2)
    // As ações nunca ficam por cima das categorias.
    expect(chips.x + chips.width, "categorias antes das ações").toBeLessThanOrEqual(acoes.x)

    const marca = barra.getByText("Casa da Pizza")
    if (largura >= 1280) {
      // A marca começa no logo, logo depois da borda esquerda, e não encosta nas categorias.
      const medida = await caixa(marca)
      expect(Math.abs(medida.x - borda), "marca na borda esquerda").toBeLessThanOrEqual(48)
      expect(medida.x + medida.width, "marca antes das categorias").toBeLessThanOrEqual(chips.x)
    } else {
      await expect(marca, "sem espaço, a marca sai da barra").toBeHidden()
    }
    if (largura >= 1920) {
      expect(
        Math.abs(chips.x + chips.width / 2 - largura / 2),
        "categorias no centro",
      ).toBeLessThanOrEqual(4)
    }
  })

  test("os três pontinhos só existem na barra grudada e abrem as opções", async ({ page }) => {
    await abrirCardapio(page)
    await expect(page.getByRole("button", { name: "Mais opções" })).toHaveCount(0)
    await page.evaluate(() => window.scrollTo(0, 900))
    const mais = page.getByRole("button", { name: "Mais opções" })
    await expect(mais).toBeVisible()
    await mais.click()
    const menu = page.getByRole("menu")
    await expect(menu.getByRole("menuitem", { name: "A loja" })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Compartilhar" })).toBeVisible()
    await verificarAcessibilidade(page, '[role="menu"]')
    await menu.getByRole("menuitem", { name: "A loja" }).click()
    await expect(page.getByRole("dialog").getByText("Terça a domingo")).toBeVisible()
  })

  test("a busca da barra grudada se recolhe sozinha 3 s depois de perder o foco", async ({
    page,
  }) => {
    await abrirCardapio(page)
    await page.evaluate(() => window.scrollTo(0, 900))
    await page.getByRole("button", { name: "Abrir busca" }).click()
    const barra = page.getByTestId("barra-navegacao")
    const campo = barra.getByRole("searchbox", { name: "Buscar no cardápio" })
    await campo.fill("cal")
    await campo.blur()
    await page.waitForTimeout(1500)
    await expect(campo, "ainda aberta antes dos 3 s").toBeVisible()
    await expect(campo).toHaveCount(0, { timeout: 3000 })
    // O texto continua valendo: a lista segue filtrada e a lupa avisa.
    await expect(barra.getByRole("button", { name: "Abrir busca, buscando cal" })).toBeVisible()
    await expect(page.getByTestId("produto-calzone")).toBeVisible()
    await expect(page.getByTestId("produto-mussarela")).toHaveCount(0)
  })

  test("Pedidos aparece em destaque sobre a foto", async ({ page }) => {
    await abrirCardapio(page)
    const pedidos = page.getByTestId("barra-topo").getByRole("link", { name: "Pedidos" })
    await expect(pedidos).toBeVisible()
    await expect(pedidos).toHaveCSS("background-color", "rgb(255, 255, 255)")
  })

  test("botões de ícone mostram dica no hover e tudo que clica tem a mãozinha", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 1024, "hover de mouse, no computador")
    await abrirCardapio(page)
    await page.getByTestId("icone-sacola").hover()
    await expect(page.getByRole("tooltip", { name: "Sua sacola" })).toBeVisible()
    const cursores = await page.evaluate(() =>
      [
        document.querySelector("[data-testid=icone-sacola]"),
        document.querySelector("[data-testid=barra-navegacao] [aria-current]"),
        document.querySelector("[data-testid=barra-topo] a"),
      ].map((elemento) => (elemento ? getComputedStyle(elemento).cursor : "ausente")),
    )
    expect(cursores).toEqual(["pointer", "pointer", "pointer"])
  })
})
