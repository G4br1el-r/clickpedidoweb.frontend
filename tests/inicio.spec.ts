import { expect, test } from "@playwright/test"
import {
  abrirCardapio,
  abrirMeioAMeio,
  caixa,
  verificarAcessibilidade,
  verificarAreasDeToque,
  verificarSemRolagemHorizontal,
} from "./apoio"

test.describe("início", () => {
  test("a vitrine começa dentro da primeira tela", async ({ page, viewport }) => {
    test.skip(
      (viewport?.height ?? 0) < 640,
      "em tela muito baixa o cabeçalho ocupa a primeira tela",
    )
    await abrirCardapio(page)
    // Os banners vêm antes de "Mais pedidas": é o primeiro conteúdo depois do cabeçalho.
    const primeiro = await caixa(page.getByTestId("banner-meio-a-meio"))
    expect(primeiro.y).toBeLessThan((viewport?.height ?? 0) - 40)
  })

  test("mostra todas as informações da loja", async ({ page }) => {
    await abrirCardapio(page)
    const cabecalho = page.locator("body")
    await expect(cabecalho.getByRole("heading", { name: "Casa da Pizza" })).toBeVisible()
    await expect(cabecalho.getByText("Aberto até 23h30")).toBeVisible()
    await expect(
      cabecalho.getByTestId("painel-loja").getByText("Entrega", { exact: true }),
    ).toBeVisible()
    await expect(cabecalho.getByText("35–50 min", { exact: true })).toBeVisible()
    await expect(cabecalho.getByText("20–30 min", { exact: true })).toBeVisible()
    await expect(cabecalho.getByText("R$ 30,00", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "A loja" }).click()
    const detalhes = page.getByRole("dialog")
    await expect(detalhes.getByText("Terça a domingo")).toBeVisible()
    await expect(detalhes.getByText("Av. da Tradição Italiana, 120, Centro")).toBeVisible()
  })

  test("não tem rolagem horizontal nem controle pequeno", async ({ page }) => {
    await abrirCardapio(page)
    await verificarSemRolagemHorizontal(page)
    await verificarAreasDeToque(page.locator("body"))
  })

  test("as informações da loja não vazam nem se sobrepõem", async ({ page }) => {
    await abrirCardapio(page)
    const larguraTela = page.viewportSize()?.width ?? 0
    const itens = page.locator('[data-testid="painel-loja"] dl > div:visible')
    const medidas = []
    for (let indice = 0; indice < (await itens.count()); indice += 1) {
      medidas.push(await caixa(itens.nth(indice)))
    }
    for (const [indice, medida] of medidas.entries()) {
      expect(medida.x + medida.width).toBeLessThanOrEqual(larguraTela)
      const proxima = medidas[indice + 1]
      if (proxima && proxima.y === medida.y) {
        expect(medida.x + medida.width).toBeLessThanOrEqual(proxima.x)
      }
    }
  })

  test("passa na checagem de acessibilidade e contraste", async ({ page }) => {
    await abrirCardapio(page)
    await page.waitForTimeout(1200)
    await verificarAcessibilidade(page)
  })

  test("categorias ficam presas no topo e levam à seção", async ({ page }) => {
    await abrirCardapio(page)
    const barra = page.getByTestId("barra-navegacao")
    await barra.getByRole("button", { name: "Bebidas" }).click()
    const titulo = page.getByRole("heading", { name: "Bebidas" })
    await expect(titulo).toBeInViewport()
    await expect(async () => {
      const topoBarra = await caixa(barra)
      expect(topoBarra.y).toBe(0)
      const medidaTitulo = await caixa(titulo)
      expect(medidaTitulo.y).toBeGreaterThanOrEqual(topoBarra.height - 2)
    }).toPass()
    await expect(barra.getByRole("button", { name: "Bebidas" })).toHaveAttribute(
      "aria-current",
      "true",
    )
  })

  test("a busca filtra na hora e explica quando não acha", async ({ page }) => {
    await abrirCardapio(page)
    const campo = page.getByTestId("busca-painel")
    await expect(campo).toBeVisible()

    await campo.fill("marguerita")
    await expect(page.getByTestId("produto-marguerita")).toBeVisible()
    await expect(page.getByTestId("produto-calabresa")).toHaveCount(0)
    await expect(page.getByText("1 resultado")).toBeVisible()

    await campo.fill("xyz")
    await expect(page.getByText('Nada encontrado para "xyz"')).toBeVisible()
    await page.getByRole("button", { name: "Limpar busca" }).click()
    await expect(page.getByTestId("produto-calabresa")).toBeVisible()
  })

  test("produto sem opções é adicionado direto com confirmação", async ({ page }) => {
    await abrirCardapio(page)
    const botao = page.getByTestId("adicionar-refrigerante-cola")
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByTestId("quantidade-refrigerante-cola")).toHaveAttribute(
      "aria-label",
      "1 na sacola",
    )
    await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola com 1 item, R$ 15,00")
  })

  test("em tela grande os produtos ficam em colunas", async ({ page }) => {
    const largura = page.viewportSize()?.width ?? 0
    test.skip(largura < 768, "uma coluna nesta largura")
    await abrirCardapio(page)
    const primeiro = await caixa(page.getByTestId("produto-calabresa"))
    const segundo = await caixa(page.getByTestId("produto-mussarela"))
    expect(segundo.x).toBeGreaterThan(primeiro.x + primeiro.width - 1)
    expect(Math.abs(segundo.y - primeiro.y)).toBeLessThanOrEqual(1)
  })

  test("a sacola é um ícone no topo que acompanha a rolagem e abre por cima de tudo", async ({
    page,
  }) => {
    await abrirCardapio(page)
    await page.mouse.wheel(0, 1200)
    const icone = page.getByTestId("icone-sacola-fixo")
    await expect(icone).toBeInViewport({ ratio: 1 })
    await icone.click()
    const ilha = page.getByRole("dialog", { name: "Sua sacola" })
    await expect(ilha.getByText("Sua sacola está vazia")).toBeVisible()
    await page.waitForTimeout(500)
    await expect(ilha).toBeInViewport({ ratio: 1 })
    await verificarSemRolagemHorizontal(page)
    await page.keyboard.press("Escape")
    await expect(ilha).toHaveCount(0)
    await expect(icone).toBeFocused()
  })

  test("no celular, a sacola sobe a partir da barra de baixo", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 768, "a barra de baixo só existe no celular")
    await abrirCardapio(page)
    const cola = page.getByTestId("adicionar-refrigerante-cola")
    await cola.scrollIntoViewIfNeeded()
    await cola.click()
    const barra = page.getByTestId("barra-sacola")
    await expect(barra).toBeVisible()
    await page.waitForTimeout(600)
    await barra.click()
    const ilha = page.getByTestId("ilha-sacola")
    await expect(ilha).toHaveAttribute("data-origem", "barra")
    await page.waitForTimeout(600)
    const medida = await caixa(ilha)
    // Presa embaixo, perto do polegar, e inteira na tela.
    expect(medida.y + medida.height).toBeGreaterThan((viewport?.height ?? 0) - 40)
    expect(medida.y).toBeGreaterThanOrEqual(0)
    await page.keyboard.press("Escape")
    await expect(ilha).toHaveCount(0)
    await expect(barra).toBeFocused()
  })

  test("só uma busca à vista: no painel, ou na barra quando ela gruda", async ({ page }) => {
    await abrirCardapio(page)
    await expect(page.getByRole("searchbox")).toHaveCount(1)
    await expect(page.getByRole("button", { name: "Abrir busca" })).toHaveCount(0)
    await page.evaluate(() => window.scrollTo(0, 900))
    const abrir = page.getByRole("button", { name: "Abrir busca" })
    await expect(abrir).toBeVisible()
    await expect(page.getByTestId("busca-painel")).not.toBeInViewport()
    await abrir.click()
    const campo = page
      .getByTestId("barra-navegacao")
      .getByRole("searchbox", { name: "Buscar no cardápio" })
    await expect(campo).toBeFocused()
    await campo.fill("calzone")
    await expect(page.getByTestId("produto-calzone")).toBeVisible()
    await page.getByRole("button", { name: "Fechar busca" }).click()
    await expect(page.getByTestId("produto-calabresa")).toBeVisible()
  })
})

test.describe("entrada da página", () => {
  test("abre direto, sem tela de carregamento", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeVisible()
    await expect(page.getByTestId("splash")).toHaveCount(0)
    await expect(page.getByRole("status", { name: /^Carregando/ })).toHaveCount(0)
  })

  test("os blocos entram animados e terminam visíveis", async ({ page }) => {
    await page.goto("/")
    const painel = page.getByTestId("painel-loja")
    await expect(painel).toHaveCSS("animation-name", /entrada-baixo/)
    await expect(painel).toHaveCSS("opacity", "1", { timeout: 3000 })
    await expect(page.getByTestId("produto-calabresa")).toBeVisible()
  })

  test("o que está abaixo da dobra entra ao chegar à tela", async ({ page }) => {
    await abrirCardapio(page)
    const ultimo = page.getByTestId("produto-refrigerante-guarana")
    await ultimo.scrollIntoViewIfNeeded()
    await expect(ultimo).toBeInViewport()
    await expect(ultimo.locator("xpath=..")).toHaveCSS("opacity", "1", { timeout: 3000 })
  })
})
test.describe("fim da página", () => {
  test("termina no rodapé, sem espaço vazio, com as informações da loja", async ({ page }) => {
    await abrirCardapio(page)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const rodape = page.getByTestId("rodape-loja")
    await expect(rodape).toBeInViewport()
    const { fimRodape, fimPagina } = await rodape.evaluate((elemento) => ({
      fimRodape: elemento.getBoundingClientRect().bottom + window.scrollY,
      fimPagina: document.documentElement.scrollHeight,
    }))
    expect(Math.abs(fimPagina - fimRodape)).toBeLessThanOrEqual(1)
    await expect(rodape.getByText(/Av\. da Tradição Italiana, 120, Centro/)).toBeVisible()
    await expect(rodape.getByRole("link", { name: "(12) 99888-7766" })).toBeVisible()
    await verificarAreasDeToque(rodape)
    await verificarAcessibilidade(page, '[data-testid="rodape-loja"]')
  })

  test("no fim da página, a última categoria fica marcada", async ({ page }) => {
    await abrirCardapio(page)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const barra = page.getByRole("navigation", { name: "Categorias do cardápio" })
    await expect(barra.locator('[aria-current="true"]')).toHaveText("Bebidas")
  })
})

test.describe("movimento reduzido", () => {
  test.use({ reducedMotion: "reduce" })

  test("a página aparece sem animação e o fluxo continua funcionando", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("painel-loja")).toHaveCSS("animation-name", "none")
    const painel = await abrirMeioAMeio(page)
    await painel.getByTestId("opcao-calabresa").click()
    await expect(painel.getByRole("heading", { name: "Escolha o 2º sabor" })).toBeVisible()
  })
})
