import { expect, test } from "@playwright/test"
import {
  abrirCardapio,
  abrirMeioAMeio,
  abrirSacola,
  acaoCheckout,
  caixa,
  montarMeioAMeio,
  verificarAcessibilidade,
  verificarAreasDeToque,
  verificarLadoALado,
  verificarSemRolagemHorizontal,
} from "./apoio"

test.describe("produto", () => {
  test("seletor de quantidade e botão principal têm a mesma altura e alinhamento", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await page.waitForTimeout(600)

    const seletor = painel.getByTestId("seletor-quantidade")
    const acao = painel.getByTestId("cta-adicionar")
    await verificarLadoALado(seletor, acao)
    expect((await caixa(acao)).height).toBe(48)
  })

  test("o painel cabe inteiro na tela", async ({ page, viewport }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await page.waitForTimeout(600)
    const medida = await caixa(painel)
    expect(medida.y).toBeGreaterThanOrEqual(0)
    expect(medida.y + medida.height).toBeLessThanOrEqual((viewport?.height ?? 0) + 1)
    await expect(painel.getByTestId("cta-adicionar")).toBeInViewport({ ratio: 1 })
    await expect(painel.getByRole("button", { name: "Fechar" })).toBeInViewport({ ratio: 1 })
  })

  test("os passos avançam sozinhos, o preço acompanha e a seleção fica marcada", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const painel = await montarMeioAMeio(page)
    const acao = painel.getByTestId("cta-adicionar")
    await expect(acao).toContainText("Adicionar")
    // R$ 58 da pizza + R$ 5 do pepperoni + R$ 10 da borda.
    await expect(acao.getByLabel("R$ 73,00")).toBeVisible()
    await expect(painel.getByTestId("opcao-catupiry")).toHaveAttribute("aria-checked", "true")
  })

  test("sem as escolhas obrigatórias, o botão leva ao que falta", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await expect(painel.getByTestId("cta-adicionar")).toContainText("1º sabor")
    await painel.getByRole("tab", { name: /Borda/ }).click()
    await expect(painel.getByRole("radiogroup", { name: "Escolha a borda" })).toBeVisible()
    await painel.getByTestId("cta-adicionar").click()
    await expect(painel.getByRole("radiogroup", { name: "Escolha o 1º sabor" })).toBeVisible()
    await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola vazia")
  })

  test("as setas do teclado escolhem sem pular de passo", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await painel.getByTestId("opcao-calabresa").focus()
    await page.keyboard.press("Space")
    await page.keyboard.press("ArrowDown")
    await page.waitForTimeout(450)
    await expect(painel.getByRole("radiogroup", { name: "Escolha o 1º sabor" })).toBeVisible()
  })

  test("não tem controle pequeno e passa na acessibilidade", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await page.waitForTimeout(600)
    await verificarAreasDeToque(painel)
    await verificarSemRolagemHorizontal(page)
    await verificarAcessibilidade(page, '[data-testid="painel-produto"]')
  })

  test("produto sem opções abre com foto e observação", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByRole("button", { name: "Calzone de Queijo", exact: true }).click()
    const painel = page.getByTestId("painel-produto")
    // A foto vira o botão de ampliar, com o nome do produto.
    await expect(
      painel.getByRole("button", { name: "Ampliar foto de Calzone de Queijo" }),
    ).toBeVisible()
    await painel.getByRole("button", { name: "Adicionar observação" }).click()
    await painel.getByLabel("Observação", { exact: true }).fill("Bem assado")
    await painel.getByRole("button", { name: "Aumentar quantidade de Calzone de Queijo" }).click()
    await painel.getByTestId("cta-adicionar").click()
    await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola com 2 itens, R$ 68,00")
    await page.waitForTimeout(400)
    const sacola = await abrirSacola(page)
    await expect(sacola.getByText("Observação: Bem assado")).toBeVisible()
  })
})

test.describe("montagem da pizza", () => {
  test("sem escolher, adicionar avisa por toast e pinta de vermelho o que falta", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await painel.getByTestId("cta-adicionar").click()
    await expect(page.locator("[data-sonner-toast]").getByText(/Faltam 3 escolhas/)).toBeVisible()
    await expect(painel.getByTestId("opcao-calabresa")).toHaveAttribute("aria-invalid", "true")
    await expect(painel.getByRole("tab", { name: /1º sabor.*falta escolher/ })).toBeVisible()

    await painel.getByTestId("opcao-calabresa").click()
    await expect(painel.getByRole("tab", { name: /1º sabor.*escolhido/ })).toBeVisible()
    await expect(painel.getByRole("heading", { name: "Escolha o 2º sabor" })).toBeVisible()
    await expect(
      painel.getByRole("radiogroup", { name: "Escolha o 2º sabor" }).getByTestId("opcao-pepperoni"),
    ).toHaveAttribute("aria-invalid", "true")
  })

  test("sabores e bordas são desenhados, sem depender de foto", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await abrirMeioAMeio(page)
    await expect(painel.getByTestId("preview-produto").locator("svg")).toBeVisible()
    const lista = painel.getByRole("radiogroup", { name: "Escolha o 1º sabor" })
    const opcoes = await lista.getByRole("radio").count()
    expect(opcoes).toBeGreaterThan(3)
    await expect(lista.locator("label svg")).toHaveCount(opcoes * 2)
    await expect(lista.locator("img")).toHaveCount(0)
  })
})

test.describe("sacola", () => {
  test("não tem controle pequeno, passa na acessibilidade e mostra o mínimo atingido", async ({
    page,
  }) => {
    await abrirCardapio(page)
    const painel = await montarMeioAMeio(page)
    await painel.getByTestId("cta-adicionar").click()
    await expect(painel).toHaveCount(0)
    const sacola = await abrirSacola(page)
    await verificarAreasDeToque(sacola)
    await verificarSemRolagemHorizontal(page)
    await verificarAcessibilidade(page, '[role="dialog"]')
    expect((await caixa(sacola.getByTestId("continuar"))).height).toBe(48)
    await expect(sacola.getByTestId("continuar")).toBeInViewport({ ratio: 1 })
    await expect(sacola.getByText("Pedido mínimo atingido")).toBeVisible()
  })

  test("avisa quanto falta para o pedido mínimo", async ({ page }) => {
    await abrirCardapio(page)
    const botao = page.getByTestId("adicionar-refrigerante-guarana")
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    const sacola = await abrirSacola(page)
    await expect(sacola.getByText("Faltam R$ 17,00 para o pedido mínimo").first()).toBeVisible()
    await sacola.getByTestId("continuar").click()
    await expect(page.locator("[data-sonner-toast]").getByText("Faltam R$ 17,00")).toBeVisible()
    await expect(page).toHaveURL("/")
  })

  test("remover oferece desfazer sem fechar a sacola", async ({ page }) => {
    await abrirCardapio(page)
    const botao = page.getByTestId("adicionar-refrigerante-cola")
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    const sacola = await abrirSacola(page)
    await sacola.getByRole("button", { name: "Remover Refrigerante de cola 2L" }).click()
    await expect(sacola.getByText("Sua sacola está vazia")).toBeVisible()
    await page.locator("[data-sonner-toast]").getByText("Desfazer").click()
    await expect(sacola.getByText("Refrigerante de cola 2L", { exact: true })).toBeVisible()
    await expect(sacola).toBeVisible()
  })
})

test.describe("fluxo completo", () => {
  test("do cardápio ao checkout, ao acompanhamento e à conversa simulada", async ({ page }) => {
    await abrirCardapio(page)
    const painel = await montarMeioAMeio(page)
    await painel.getByTestId("cta-adicionar").click()
    await expect(painel).toHaveCount(0)
    const sacola = await abrirSacola(page)
    await sacola.getByTestId("continuar").click()
    await expect(page).toHaveURL("/finalizar", { timeout: 15_000 })

    const acao = acaoCheckout(page)
    await page.getByLabel("Nome").fill("Gabriel")
    await page.getByLabel("WhatsApp").fill("(12) 99888-7766")
    await acao.click()
    await page.getByTestId("opcao-retirada").click()
    await acao.click()
    await page.getByTestId("pagamento-dinheiro").click()
    await page.getByRole("radio", { name: "R$ 100" }).click()
    await expect(page.getByText("Seu troco será de R$ 27,00")).toBeVisible()
    await acao.click()
    await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
    await page.getByLabel(/Observação do pedido/).fill("Sem guardanapo")
    await acao.click()

    await expect(page.getByRole("status", { name: "Enviando seu pedido" })).toBeVisible()
    await expect(page).toHaveURL("/pedido", { timeout: 15_000 })
    await expect(page.getByRole("heading", { level: 1, name: "Pedido recebido" })).toBeVisible()
    await expect(page.getByText("Troco para R$ 100,00 (volta R$ 27,00)")).toBeVisible()
    await expect(page.getByText("Sem guardanapo")).toBeVisible()
    await verificarSemRolagemHorizontal(page)
    await verificarAreasDeToque(page.locator("main"))
    await verificarAcessibilidade(page)

    await page.getByRole("link", { name: "Falar com a loja no WhatsApp" }).click()
    await expect(page).toHaveURL("/whatsapp", { timeout: 15_000 })
    await expect(page.getByText("Simulação", { exact: true })).toBeVisible()
    await expect(page.getByText("Nenhuma mensagem foi enviada de verdade.")).toBeVisible()
    await expect(page.getByText("1× Pizza meio a meio")).toBeVisible()
    await expect(page.getByText("Retirada no balcão")).toBeVisible()
    await expect(page.getByText("Total: R$ 73,00")).toBeVisible()
    await expect(page.getByText(/Recebemos seu pedido/)).toBeVisible()
    await expect(page.getByText(/Fica pronto em/)).toBeVisible({ timeout: 8000 })

    const novoPedido = page.getByRole("link", { name: "Fazer novo pedido" })
    await expect(novoPedido).toBeVisible()
    await verificarSemRolagemHorizontal(page)
    await verificarAreasDeToque(page.locator("main"))
    await verificarAcessibilidade(page)

    await novoPedido.click()
    await expect(page).toHaveURL("/")
    await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola vazia")
  })

  test("abrir a conversa sem pedido leva de volta ao cardápio", async ({ page }) => {
    await page.goto("/whatsapp")
    await expect(page.getByText("Nenhum pedido por aqui")).toBeVisible()
    await expect(page.getByRole("link", { name: "Ver cardápio" })).toBeVisible()
  })
})
