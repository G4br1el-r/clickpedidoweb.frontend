import { expect, type Page, test } from "@playwright/test"
import {
  abrirCardapio,
  abrirMeioAMeio,
  avancar,
  caixa,
  esperarAnimacoes,
  esperarParado,
  verificarAcessibilidade,
  verificarAreasDeToque,
  verificarSemRolagemHorizontal,
} from "./apoio"

const largura = (page: Page) => page.viewportSize()?.width ?? 0

test.describe("banners da vitrine", () => {
  test("vêm depois da primeira categoria e antes de Mais pedidas, no mosaico de quatro colunas", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const secao = page.getByTestId("banners-loja")
    await expect(secao).toBeVisible()
    const [grande, doces, bebidas, largo] = await Promise.all(
      ["banner-meio-a-meio", "banner-doces", "banner-bebidas", "banner-oferta-calabresa"].map(
        (id) => caixa(page.getByTestId(id)),
      ),
    )
    const maisPedidas = await caixa(page.getByTestId("mais-pedidas"))
    expect(grande.y).toBeLessThan(maisPedidas.y)
    const primeiraCategoria = await caixa(page.locator("section[id^=categoria-]").first())
    expect(grande.y, "depois da primeira categoria").toBeGreaterThan(
      primeiraCategoria.y + primeiraCategoria.height,
    )

    // Os dois quadrados, lado a lado e do mesmo tamanho.
    expect(Math.abs(doces.y - bebidas.y)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(doces.height - bebidas.height)).toBeLessThanOrEqual(0.5)
    expect(doces.x + doces.width).toBeLessThan(bebidas.x)

    if (largura(page) >= 768) {
      // Grande à esquerda, de cima a baixo; à direita, quadrados em cima e o largo embaixo.
      expect(Math.abs(grande.y - doces.y)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(grande.y + grande.height - (largo.y + largo.height))).toBeLessThanOrEqual(0.5)
      expect(Math.abs(largo.x - doces.x)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(largo.x + largo.width - (bebidas.x + bebidas.width))).toBeLessThanOrEqual(0.5)
      expect(Math.abs(largo.height - doces.height)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(grande.width - largo.width)).toBeLessThanOrEqual(0.5)
    } else {
      // No celular: o grande inteiro em cima, os quadrados e o largo embaixo.
      expect(doces.y).toBeGreaterThan(grande.y + grande.height)
      expect(largo.y).toBeGreaterThan(doces.y + doces.height)
      expect(Math.abs(largo.width - grande.width)).toBeLessThanOrEqual(0.5)
    }
    await verificarSemRolagemHorizontal(page)
    await verificarAreasDeToque(secao)
    await verificarAcessibilidade(page, "[data-testid=banners-loja]")
  })

  test("os banners não têm sobrelinha: o título fala sozinho", async ({ page }) => {
    await abrirCardapio(page)
    await expect(page.getByTestId("banner-meio-a-meio")).not.toContainText("Monte a sua")
    await expect(page.getByTestId("banner-oferta-calabresa")).not.toContainText("Preço especial")
  })

  test("o grande abre o produto e o quadrado leva à categoria", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByTestId("banner-meio-a-meio").click()
    const painel = page.getByTestId("painel-produto")
    await expect(painel.getByRole("heading", { name: "Pizza meio a meio" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(painel).toBeHidden()

    await page.getByTestId("banner-bebidas").click()
    await expect(page.locator("#categoria-bebidas")).toBeInViewport()
  })

  test("a oferta mostra o preço de e por do próprio produto", async ({ page }) => {
    await abrirCardapio(page)
    const oferta = page.getByTestId("banner-oferta-calabresa")
    await expect(oferta).toContainText("R$ 52")
    await expect(oferta).toContainText("R$ 46")
  })
})

test.describe("foto ampliada", () => {
  test("tocar na foto do cartão abre a foto grande no centro, sem abrir o produto", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const cartao = page.getByTestId("produto-calabresa")
    await cartao.scrollIntoViewIfNeeded()
    await cartao.getByRole("button", { name: "Ampliar foto de Calabresa Especial" }).click()
    const foto = page.getByTestId("foto-ampliada")
    await expect(foto).toBeVisible()
    await expect(page.getByTestId("painel-produto")).toBeHidden()
    await esperarAnimacoes(page)
    const medida = await caixa(foto)
    expect(Math.abs(medida.x + medida.width / 2 - largura(page) / 2)).toBeLessThanOrEqual(1)
    // O que fica atrás do fundo escuro não conta: só a foto aberta está em uso.
    await verificarAcessibilidade(page, "[data-testid=foto-ampliada]")
    await page.keyboard.press("Escape")
    await expect(foto).toBeHidden()
  })
})

test.describe("passar de um produto ao outro", () => {
  test("as setas trocam para o vizinho do cardápio", async ({ page }) => {
    await abrirCardapio(page)
    const cartao = page.getByTestId("produto-calabresa")
    await cartao.scrollIntoViewIfNeeded()
    await cartao.getByRole("heading").click()
    const painel = page.getByTestId("painel-produto")
    await expect(painel.getByRole("heading", { name: "Calabresa Especial" })).toBeVisible()

    await painel.getByRole("button", { name: "Próximo produto" }).click()
    await expect(painel.getByRole("heading", { name: "Mussarela da Casa" })).toBeVisible()
    await painel.getByRole("button", { name: "Produto anterior" }).click()
    await expect(painel.getByRole("heading", { name: "Calabresa Especial" })).toBeVisible()
    for (const id of ["produto-anterior", "produto-proximo"]) {
      const { width, height } = await caixa(painel.getByTestId(id))
      expect(Math.min(width, height), id).toBeGreaterThanOrEqual(44)
    }
  })

  test("no teclado, ← e → trocam de produto, mas não dentro das opções", async ({ page }) => {
    test.skip(largura(page) < 1024, "Atalho de teclado é para o computador")
    await abrirCardapio(page)
    const cartao = page.getByTestId("produto-calabresa")
    await cartao.scrollIntoViewIfNeeded()
    await cartao.getByRole("heading").click()
    const painel = page.getByTestId("painel-produto")
    await expect(painel.getByRole("heading", { name: "Calabresa Especial" })).toBeVisible()
    await page.keyboard.press("ArrowRight")
    await expect(painel.getByRole("heading", { name: "Mussarela da Casa" })).toBeVisible()
    await page.keyboard.press("ArrowLeft")
    await expect(painel.getByRole("heading", { name: "Calabresa Especial" })).toBeVisible()

    await painel.getByRole("radio").first().focus()
    await page.keyboard.press("ArrowRight")
    await expect(painel.getByRole("heading", { name: "Calabresa Especial" })).toBeVisible()
  })
})

test.describe("cabeçalho da folha do produto", () => {
  test("o nome e a descrição nunca passam por baixo das setas e do fechar", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByTestId("produto-calabresa").getByRole("heading").click()
    const painel = page.getByTestId("painel-produto")
    await expect(painel).toBeVisible()
    await page.waitForTimeout(500)
    const setas = await caixa(painel.getByTestId("produto-anterior"))
    for (const texto of [
      painel.getByRole("heading", { name: "Calabresa Especial" }),
      painel.getByText(/^Calabresa fatiada, cebola/),
    ]) {
      const medida = await caixa(texto)
      const naMesmaAltura = medida.y < setas.y + setas.height && medida.y + medida.height > setas.y
      if (naMesmaAltura)
        expect(medida.x + medida.width, "o texto termina antes das setas").toBeLessThanOrEqual(
          setas.x,
        )
    }
  })
})

test.describe("troca de sabor", () => {
  test("escolher não pula de passo; Avançar leva ao 2º sabor, que diz o que já foi escolhido", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await painel
      .getByRole("radiogroup", { name: "Escolha o 1º sabor" })
      .getByTestId("opcao-calabresa")
      .click()
    // Mesmo depois de um tempo, continua no 1º sabor, com a escolha marcada.
    await page.waitForTimeout(1200)
    await expect(painel.getByRole("tab", { name: /1º sabor/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await avancar(painel)
    // Agora o 2º sabor, lembrando o 1º.
    const segundo = painel.getByRole("tabpanel", { name: /2º sabor/ })
    await expect(painel.getByRole("tab", { name: /2º sabor/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(segundo).toContainText("1º sabor: Calabresa Especial")
    await expect(painel.getByRole("radiogroup")).toHaveCount(1, { timeout: 3000 })
  })
})

test.describe("acompanhe seu pedido", () => {
  test("sem pedidos neste celular, avisa com clareza", async ({ page }) => {
    await page.goto("/pedidos")
    await expect(page.getByRole("heading", { name: "Acompanhe seu pedido" })).toBeVisible()
    await page.getByRole("button", { name: "Ver meu pedido" }).click()
    await expect(page.getByText("Digite o celular com DDD")).toBeVisible()
    await page.getByLabel("Celular (WhatsApp)").fill("12988887766")
    await page.getByRole("button", { name: "Ver meu pedido" }).click()
    // A espera e o aviso usam o desenho do nicho, não um ícone genérico.
    const procurando = page.getByRole("status", { name: "Procurando seus pedidos" })
    await expect(procurando.getByTestId("carregador-pizzaria")).toBeVisible()
    const aviso = page.getByTestId("sem-pedidos")
    await expect(aviso).toBeVisible({ timeout: 4000 })
    await expect(aviso.getByTestId("carregador-pizzaria")).toBeVisible()
    await verificarSemRolagemHorizontal(page)
    await verificarAreasDeToque(page.locator("main"))
    await verificarAcessibilidade(page)
  })

  test("com um pedido no celular, vai direto para o acompanhamento", async ({ page }) => {
    await page.addInitScript(() => {
      const pedido = {
        numero: 5555,
        itens: [],
        subtotal: 46,
        taxaEntrega: 6,
        total: 52,
        criadoEm: Date.now(),
        cliente: { nome: "Ana", whatsapp: "(12) 97777-6655" },
        tipo: "entrega",
        endereco: "Rua A, 1",
        pagamento: "dinheiro",
        troco: null,
        observacao: "",
      }
      localStorage.setItem(
        "clickpedido-sacola",
        JSON.stringify({
          state: { itens: [], ultimoPedido: null, pedidos: [pedido], dadosLembrados: null },
          version: 0,
        }),
      )
    })
    await page.goto("/pedidos")
    await page.getByLabel("Celular (WhatsApp)").fill("12977776655")
    await page.getByRole("button", { name: "Ver meu pedido" }).click()
    await expect(page).toHaveURL("/pedido", { timeout: 5000 })
    await expect(page.getByText("Pedido nº 5555").first()).toBeVisible()
  })

  test("o botão Pedidos do cardápio leva à busca", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByRole("link", { name: "Pedidos" }).first().click()
    await expect(page).toHaveURL("/pedidos")
  })
})

test.describe("mais opções", () => {
  test("as opções do menu de 3 pontinhos mostram a mãozinha e a dica não cobre o menu", async ({
    page,
  }) => {
    await abrirCardapio(page)
    await page.evaluate(() => window.scrollTo(0, 1100))
    const botao = page.getByRole("button", { name: "Mais opções" })
    await expect(botao).toBeVisible()
    // O botão ainda entra na barra grudada: sem esperar, o Playwright rola a página para alcançá-lo.
    await esperarParado(botao)
    await botao.hover()
    await botao.click()
    const item = page.getByRole("menuitem", { name: "Compartilhar" })
    await expect(item).toBeVisible()
    await expect(page.getByRole("tooltip")).toBeHidden()
    expect(await item.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer")
  })
})
